import Phaser from 'phaser';
import type { MovableCharacter } from '../types/movableCharacter';
import type { AgentState } from '../../types/agent';

export type ExecutiveCharacterConfig = {
  id: string;
  textureId?: string;
  sourceKey: string;
  cropTop: number;
  cropHeight: number;
  displayWidth?: number;
  displayHeight?: number;
};

const FRAME_NAMES = ['front-a', 'front-b', 'back-a', 'back-b', 'side-a', 'side-b'] as const;

export class ExecutiveCharacter implements MovableCharacter {
  readonly container: Phaser.GameObjects.Container;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private moving = false;
  private facing: 'front' | 'back' | 'side' = 'front';
  private readonly bubble: Phaser.GameObjects.Container;
  private readonly bubbleText: Phaser.GameObjects.Text;
  private activityTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly config: ExecutiveCharacterConfig) {
    this.prepareTexture(scene);
    const frame = scene.textures.getFrame(this.textureKey, 'front-a');
    const aspectRatio = frame.width / frame.height;
    const displayHeight = config.displayHeight ?? (config.displayWidth ? config.displayWidth / aspectRatio : 109);
    const displayWidth = config.displayWidth ?? displayHeight * aspectRatio;
    const shadow = scene.add.ellipse(0, 3, 38, 13, 0x05070b, .46);
    this.sprite = scene.add.sprite(0, 16, this.textureKey, 'front-a')
      .setOrigin(.5, 1)
      .setDisplaySize(displayWidth, displayHeight);
    const bubblePlate = scene.add.rectangle(0, -111, 74, 26, 0x101827, .94)
      .setStrokeStyle(2, 0x8de7ff, .9);
    this.bubbleText = scene.add.text(0, -111, '', {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#e8fbff', fontStyle: 'bold'
    }).setOrigin(.5);
    this.bubble = scene.add.container(0, 0, [bubblePlate, this.bubbleText]).setVisible(false);
    this.container = scene.add.container(x, y, [shadow, this.sprite, this.bubble]).setDepth(30);
  }

  setMoving(moving: boolean): void {
    this.moving = moving;
    if (moving) this.stopActivityTween();
    if (!this.sprite.active || !this.sprite.anims) return;
    if (moving) this.playDirectionalAnimation();
    else {
      this.sprite.anims.stop();
      this.sprite.setFrame(`${this.facing}-a`);
    }
  }

  face(direction: Phaser.Math.Vector2): void {
    if (!this.moving) return;
    if (Math.abs(direction.x) > Math.abs(direction.y) * .7) {
      this.facing = 'side';
      this.sprite.setFlipX(direction.x < 0);
    } else {
      this.facing = direction.y < 0 ? 'back' : 'front';
      this.sprite.setFlipX(false);
    }
    this.playDirectionalAnimation();
  }

  faceDirection(facing?: string): void {
    if (facing === 'north') this.facing = 'back';
    else if (facing === 'south') this.facing = 'front';
    else if (facing === 'east' || facing === 'west') {
      this.facing = 'side';
      this.sprite.setFlipX(facing === 'west');
    }
    if (this.facing !== 'side') this.sprite.setFlipX(false);
    if (!this.moving) this.sprite.setFrame(`${this.facing}-a`);
  }

  setActivity(state: AgentState): void {
    this.stopActivityTween();
    this.bubble.setVisible(false);
    if (state === 'moving' || state === 'blocked') return;
    if (state === 'idle') {
      const horizontalDrift = Phaser.Math.Between(0, 1) ? 1 : -1;
      this.activityTween = this.scene.tweens.add({
        targets: this.sprite,
        x: { from: 0, to: horizontalDrift },
        y: { from: 16, to: 15 },
        duration: Phaser.Math.Between(1250, 1900),
        delay: Phaser.Math.Between(0, 700),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      });
      return;
    }
    this.bubbleText.setText(state === 'meeting' ? '회의 중' : '작업 중');
    this.bubble.setVisible(true);
    this.activityTween = this.scene.tweens.add({
      targets: this.sprite,
      y: { from: 16, to: 13 },
      duration: state === 'meeting' ? 520 : 760,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });
  }

  destroy(): void { this.stopActivityTween(); this.container.destroy(true); }

  private get assetId(): string { return this.config.textureId ?? this.config.id; }

  private get textureKey(): string { return `${this.assetId}-directional`; }

  private get scene(): Phaser.Scene { return this.container.scene; }

  private stopActivityTween(): void {
    this.activityTween?.stop();
    this.activityTween = undefined;
    if (this.sprite) {
      this.sprite.x = 0;
      this.sprite.y = 16;
    }
  }

  private prepareTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(this.textureKey)) return;
    const source = scene.textures.get(this.config.sourceKey).getSourceImage() as HTMLImageElement;
    const frameWidth = Math.floor(source.width / FRAME_NAMES.length);
    const cropHeight = Math.min(this.config.cropHeight, source.height - this.config.cropTop);
    const canvasTexture = scene.textures.createCanvas(this.textureKey, frameWidth * FRAME_NAMES.length, cropHeight);
    if (!canvasTexture) throw new Error(`${this.config.id} character texture could not be created.`);
    const context = canvasTexture.context;
    context.clearRect(0, 0, canvasTexture.width, canvasTexture.height);
    context.drawImage(source, 0, this.config.cropTop, frameWidth * FRAME_NAMES.length, cropHeight, 0, 0, frameWidth * FRAME_NAMES.length, cropHeight);
    this.removeConnectedLightBackground(context, canvasTexture.width, canvasTexture.height);
    canvasTexture.refresh();
    FRAME_NAMES.forEach((name, index) => canvasTexture.add(name, 0, index * frameWidth, 0, frameWidth, cropHeight));
    this.createAnimation(scene, 'front', 'front-a', 'front-b');
    this.createAnimation(scene, 'back', 'back-a', 'back-b');
    this.createAnimation(scene, 'side', 'side-a', 'side-b');
  }

  private playDirectionalAnimation(): void {
    const key = `${this.assetId}-walk-${this.facing}`;
    if (this.sprite.anims.currentAnim?.key !== key || !this.sprite.anims.isPlaying) this.sprite.play(key);
  }

  private createAnimation(scene: Phaser.Scene, direction: string, first: string, second: string): void {
    const key = `${this.assetId}-walk-${direction}`;
    if (scene.anims.exists(key)) return;
    scene.anims.create({ key, frames: [{ key: this.textureKey, frame: first }, { key: this.textureKey, frame: second }], frameRate: 6, repeat: -1 });
  }

  private removeConnectedLightBackground(context: CanvasRenderingContext2D, width: number, height: number): void {
    const image = context.getImageData(0, 0, width, height);
    const pixels = image.data;
    const visited = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let head = 0;
    let tail = 0;
    const enqueue = (x: number, y: number): void => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const pixelIndex = y * width + x;
      if (visited[pixelIndex]) return;
      const colorIndex = pixelIndex * 4;
      if (pixels[colorIndex] < 220 || pixels[colorIndex + 1] < 220 || pixels[colorIndex + 2] < 220) return;
      visited[pixelIndex] = 1;
      queue[tail++] = pixelIndex;
    };
    for (let x = 0; x < width; x += 1) { enqueue(x, 0); enqueue(x, height - 1); }
    for (let y = 0; y < height; y += 1) { enqueue(0, y); enqueue(width - 1, y); }
    while (head < tail) {
      const pixelIndex = queue[head++];
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      pixels[pixelIndex * 4 + 3] = 0;
      enqueue(x - 1, y); enqueue(x + 1, y); enqueue(x, y - 1); enqueue(x, y + 1);
    }
    context.putImageData(image, 0, 0);
  }
}
