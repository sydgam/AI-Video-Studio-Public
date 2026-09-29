import Phaser from 'phaser';
import type { MovableCharacter } from '../types/movableCharacter';

export class CharacterMovementSystem {
  private path: Phaser.Math.Vector2[] = [];
  private readonly speed = 185;
  private onComplete?: () => void;

  constructor(
    private readonly character: MovableCharacter,
    private readonly canOccupy: (x: number, y: number) => boolean,
    private readonly onBlocked?: () => void
  ) {}

  follow(path: Phaser.Math.Vector2[], onComplete?: () => void): void {
    this.path = path.map((point) => point.clone());
    this.onComplete = onComplete;
    this.character.setMoving(this.path.length > 0);
    if (this.path.length === 0) this.complete();
  }

  stop(): void {
    this.path = [];
    this.onComplete = undefined;
    this.character.setMoving(false);
  }

  update(deltaMilliseconds: number): void {
    if (!Number.isFinite(deltaMilliseconds) || deltaMilliseconds <= 0) return;
    let remaining = this.speed * Math.min(deltaMilliseconds, 100) / 1000;
    while (this.path.length && remaining > 0) {
      const target = this.path[0];
      const position = new Phaser.Math.Vector2(this.character.container.x, this.character.container.y);
      const direction = target.clone().subtract(position);
      const distance = direction.length();
      if (distance < .001) {
        this.path.shift();
        if (this.path.length === 0) this.complete();
        continue;
      }
      // Sweep short steps, including the final snap, even after a slow frame.
      const step = Math.min(remaining, distance, 2);
      direction.normalize();
      this.character.face(direction);
      const nextX = this.character.container.x + direction.x * step;
      const nextY = this.character.container.y + direction.y * step;
      if (!this.canOccupy(nextX, nextY)) {
        this.stop();
        this.onBlocked?.();
        return;
      }
      this.character.container.setPosition(nextX, nextY);
      remaining -= step;
      if (step >= distance) {
        this.path.shift();
        if (this.path.length === 0) this.complete();
      }
    }
  }

  private complete(): void {
    this.character.setMoving(false);
    const callback = this.onComplete;
    this.onComplete = undefined;
    callback?.();
  }
}
