import Phaser from 'phaser';
import { OfficeScene } from '../scenes/OfficeScene';

export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;

export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#101622',
    transparent: false,
    pixelArt: true,
    antialias: false,
    antialiasGL: false,
    roundPixels: true,
    render: {
      pixelArt: true,
      antialias: false,
      antialiasGL: false,
      roundPixels: true
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT
    },
    scene: [OfficeScene]
  };
}
