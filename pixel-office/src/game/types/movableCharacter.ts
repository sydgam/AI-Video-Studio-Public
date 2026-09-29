import type Phaser from 'phaser';
import type { AgentState } from '../../types/agent';

export type MovableCharacter = {
  readonly container: Phaser.GameObjects.Container;
  setMoving(moving: boolean): void;
  face(direction: Phaser.Math.Vector2): void;
  faceDirection?(facing?: string): void;
  setActivity?(state: AgentState): void;
  destroy(): void;
};
