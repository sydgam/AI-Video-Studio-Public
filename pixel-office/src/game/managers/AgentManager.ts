import Phaser from 'phaser';
import type { AgentCommand, AgentDefinition, AgentSnapshot, AgentState } from '../../types/agent';
import type { OfficeNavigationMapData } from '../types/navigationMap';
import type { MovableCharacter } from '../types/movableCharacter';
import { AgentStateMachine } from '../systems/AgentStateMachine';
import { CharacterMovementSystem } from '../systems/CharacterMovementSystem';
import { NavigationSystem } from '../systems/NavigationSystem';

type AgentRuntime = {
  definition: AgentDefinition;
  character: MovableCharacter;
  movement: CharacterMovementSystem;
  stateMachine: AgentStateMachine;
  targetAnchorId?: string;
  statusMessage?: string;
};

export class AgentManager {
  private readonly agents = new Map<string, AgentRuntime>();

  constructor(
    private readonly navigation: NavigationSystem,
    private readonly mapData: OfficeNavigationMapData,
    private readonly onStateChanged: (snapshot: AgentSnapshot) => void
  ) {}

  register(definition: AgentDefinition, character: MovableCharacter): CharacterMovementSystem {
    let runtime: AgentRuntime;
    const movement = new CharacterMovementSystem(
      character,
      (x, y) => this.navigation.canOccupy(x, y),
      () => this.block(runtime, 'Movement blocked by navigation boundary')
    );
    runtime = {
      definition,
      character,
      movement,
      stateMachine: new AgentStateMachine()
    };
    this.agents.set(definition.id, runtime);
    character.setActivity?.('idle');
    this.emit(runtime);
    return movement;
  }

  command(agentId: string, command: AgentCommand): boolean {
    const runtime = this.agents.get(agentId);
    if (!runtime) return false;
    const target = command === 'GO_TO_WORK' || command === 'END_MEETING'
      ? runtime.definition.workAnchorId
      : command === 'JOIN_MEETING'
        ? runtime.definition.meetingAnchorId
        : runtime.definition.spawnAnchorId;
    const arrivalState: AgentState = command === 'GO_TO_WORK' || command === 'END_MEETING'
      ? 'working'
      : command === 'JOIN_MEETING'
        ? 'meeting'
        : 'idle';
    return this.moveToAnchor(runtime, target, arrivalState);
  }

  moveToPoint(agentId: string, destination: Phaser.Math.Vector2, onArrival?: () => void): boolean {
    const runtime = this.agents.get(agentId);
    if (!runtime) return false;
    return this.startMove(runtime, destination, 'idle', onArrival);
  }

  moveToAnchorId(agentId: string, anchorId: string, onArrival?: () => void): boolean {
    const runtime = this.agents.get(agentId);
    if (!runtime) return false;
    const anchor = [...this.mapData.interactionAnchors, ...this.mapData.seats, ...this.mapData.spawns, ...this.mapData.waypoints]
      .find((candidate) => candidate.id === anchorId);
    if (!anchor) return this.block(runtime, `Anchor not found: ${anchorId}`);
    runtime.targetAnchorId = anchorId;
    return this.startMove(runtime, new Phaser.Math.Vector2(anchor.position.x, anchor.position.y), 'idle', onArrival, anchor);
  }

  update(delta: number): void {
    this.agents.forEach((runtime) => runtime.movement.update(delta));
  }

  snapshots(): AgentSnapshot[] {
    return [...this.agents.values()].map((runtime) => this.snapshot(runtime));
  }

  stop(agentId: string): void {
    const runtime = this.agents.get(agentId);
    if (!runtime) return;
    runtime.movement.stop();
    runtime.stateMachine.transition('idle');
    runtime.character.setActivity?.('idle');
    runtime.targetAnchorId = undefined;
    runtime.statusMessage = undefined;
    this.emit(runtime);
  }

  unregister(agentId: string): boolean {
    const runtime = this.agents.get(agentId);
    if (!runtime) return false;
    runtime.movement.stop();
    this.agents.delete(agentId);
    return true;
  }

  destroy(): void {
    this.agents.forEach((runtime) => runtime.movement.stop());
    this.agents.clear();
  }

  private moveToAnchor(runtime: AgentRuntime, anchorId: string, arrivalState: AgentState): boolean {
    const anchor = [
      ...this.mapData.interactionAnchors,
      ...this.mapData.seats,
      ...this.mapData.spawns,
      ...this.mapData.waypoints
    ].find((candidate) => candidate.id === anchorId);
    if (!anchor) return this.block(runtime, `Anchor not found: ${anchorId}`);
    runtime.targetAnchorId = anchorId;
    return this.startMove(runtime, new Phaser.Math.Vector2(anchor.position.x, anchor.position.y), arrivalState, undefined, anchor);
  }

  private startMove(
    runtime: AgentRuntime,
    destination: Phaser.Math.Vector2,
    arrivalState: AgentState,
    onArrival?: () => void,
    arrivalAnchor?: { facing?: string }
  ): boolean {
    const start = new Phaser.Math.Vector2(runtime.character.container.x, runtime.character.container.y);
    const path = this.navigation.findPath(start, destination, arrivalAnchor ? 140 : 72);
    if (!path) return this.block(runtime, 'No connected route');
    runtime.statusMessage = undefined;
    runtime.stateMachine.transition('moving');
    runtime.character.setActivity?.('moving');
    this.emit(runtime);
    runtime.movement.follow(path, () => {
      runtime.stateMachine.transition(arrivalState);
      runtime.character.faceDirection?.(arrivalAnchor?.facing);
      runtime.character.setActivity?.(arrivalState);
      runtime.targetAnchorId = undefined;
      this.emit(runtime);
      onArrival?.();
    });
    return true;
  }

  private block(runtime: AgentRuntime, message: string): false {
    runtime.movement.stop();
    runtime.stateMachine.transition('blocked');
    runtime.character.setActivity?.('blocked');
    runtime.statusMessage = message;
    this.emit(runtime);
    return false;
  }

  private emit(runtime: AgentRuntime): void {
    this.onStateChanged(this.snapshot(runtime));
  }

  private snapshot(runtime: AgentRuntime): AgentSnapshot {
    return {
      ...runtime.definition,
      state: runtime.stateMachine.state,
      targetAnchorId: runtime.targetAnchorId,
      statusMessage: runtime.statusMessage
    };
  }
}
