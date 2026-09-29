import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { createGameConfig } from '../../game/config/gameConfig';

export function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || gameRef.current) return;

    const game = new Phaser.Game(createGameConfig(container));
    gameRef.current = game;

    const resizeObserver = new ResizeObserver(() => {
      game.scale.refresh();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (gameRef.current === game) gameRef.current = null;
      game.destroy(true);
    };
  }, []);

  return <div ref={containerRef} className="phaser-game" aria-label="Phaser Pixel Office game area" />;
}
