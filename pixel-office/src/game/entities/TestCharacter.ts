import Phaser from 'phaser';

export class TestCharacter {
  readonly container: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Arc;
  private readonly directionMarker: Phaser.GameObjects.Triangle;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const shadow = scene.add.ellipse(0, 13, 25, 9, 0x05070b, .48);
    this.body = scene.add.circle(0, 0, 12, 0x6ee7ff, 1).setStrokeStyle(3, 0xe8fbff, 1);
    this.directionMarker = scene.add.triangle(0, -2, -4, 4, 4, 4, 0, -5, 0x113047, 1);
    this.container = scene.add.container(x, y, [shadow, this.body, this.directionMarker]).setDepth(30);
  }

  setMoving(moving: boolean): void {
    this.body.setFillStyle(moving ? 0x38bdf8 : 0x6ee7ff, 1);
  }

  face(direction: Phaser.Math.Vector2): void {
    if (direction.lengthSq() > 0) this.directionMarker.setRotation(direction.angle() + Math.PI / 2);
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
