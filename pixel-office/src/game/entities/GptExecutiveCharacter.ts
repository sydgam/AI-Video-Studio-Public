import Phaser from 'phaser';

const SOURCE_KEY = 'gpt-executive-source';
const TEXTURE_KEY = 'gpt-executive';
const FRAME_COUNT = 6;
const CROP_TOP = 50;
const CROP_HEIGHT = 610;

export class GptExecutiveCharacter {
  readonly container: Phaser.GameObjects.Container;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private moving = false;
  private facing: 'front' | 'back' | 'side' = 'front';

  static prepareTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(TEXTURE_KEY)) return;
    const source = scene.textures.get(SOURCE_KEY).getSourceImage() as HTMLImageElement;
    const frameWidth = Math.floor(source.width / FRAME_COUNT);
    const canvasTexture = scene.textures.createCanvas(TEXTURE_KEY, frameWidth * FRAME_COUNT, CROP_HEIGHT);
    if (!canvasTexture) throw new Error('GPT character canvas texture could not be created.');
    const context = canvasTexture.context;
    context.clearRect(0, 0, canvasTexture.width, canvasTexture.height);
    context.drawImage(source, 0, CROP_TOP, frameWidth * FRAME_COUNT, CROP_HEIGHT, 0, 0, frameWidth * FRAME_COUNT, CROP_HEIGHT);
    this.removeConnectedLightBackground(context, canvasTexture.width, canvasTexture.height);
    canvasTexture.refresh();
    ['front-a', 'front-b', 'back-a', 'back-b', 'side-a', 'side-b'].forEach((name, index) => {
      canvasTexture.add(name, 0, index * frameWidth, 0, frameWidth, CROP_HEIGHT);
    });
    this.createWalkAnimation(scene, 'gpt-walk-front', 'front-a', 'front-b');
    this.createWalkAnimation(scene, 'gpt-walk-back', 'back-a', 'back-b');
    this.createWalkAnimation(scene, 'gpt-walk-side', 'side-a', 'side-b');
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    GptExecutiveCharacter.prepareTexture(scene);
    const shadow = scene.add.ellipse(0, 3, 38, 13, 0x05070b, .46);
    // The generated source frames retain a small transparent strip below the shoes.
    // Lowering the visual sprite keeps the logical navigation point at the feet.
    this.sprite = scene.add.sprite(0, 16, TEXTURE_KEY, 'front-a')
      .setOrigin(.5, 1)
      .setDisplaySize(74, 109);
    this.container = scene.add.container(x, y, [shadow, this.sprite]).setDepth(30);
  }

  setMoving(moving: boolean): void {
    this.moving = moving;
    if (!this.sprite.active || !this.sprite.anims) return;
    if (moving) {
      this.playDirectionalAnimation();
    } else {
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

  destroy(): void {
    this.container.destroy(true);
  }

  private playDirectionalAnimation(): void {
    if (!this.sprite.active || !this.sprite.anims) return;
    const key = `gpt-walk-${this.facing}`;
    if (this.sprite.anims.currentAnim?.key !== key || !this.sprite.anims.isPlaying) this.sprite.play(key);
  }

  private static createWalkAnimation(scene: Phaser.Scene, key: string, first: string, second: string): void {
    if (scene.anims.exists(key)) return;
    scene.anims.create({
      key,
      frames: [{ key: TEXTURE_KEY, frame: first }, { key: TEXTURE_KEY, frame: second }],
      frameRate: 6,
      repeat: -1
    });
  }

  private static removeConnectedLightBackground(
    context: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
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
      if (pixels[colorIndex] < 225 || pixels[colorIndex + 1] < 225 || pixels[colorIndex + 2] < 225) return;
      visited[pixelIndex] = 1;
      queue[tail++] = pixelIndex;
    };
    for (let x = 0; x < width; x += 1) {
      enqueue(x, 0);
      enqueue(x, height - 1);
    }
    for (let y = 0; y < height; y += 1) {
      enqueue(0, y);
      enqueue(width - 1, y);
    }
    while (head < tail) {
      const pixelIndex = queue[head++];
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      pixels[pixelIndex * 4 + 3] = 0;
      enqueue(x - 1, y);
      enqueue(x + 1, y);
      enqueue(x, y - 1);
      enqueue(x, y + 1);
    }
    context.putImageData(image, 0, 0);
  }
}
