import Phaser from 'phaser';
import { PALETTE, textStyle } from './theme';

/** Bouton provisoire (panneau arrondi + texte), cible ≥ 48 px. Le design final vient de l'UI/UX. */
export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: { width?: number; size?: number; primary?: boolean } = {},
): Phaser.GameObjects.Container {
  const width = opts.width ?? 220;
  const height = Math.max(56, (opts.size ?? 24) * 2.2);
  const bg = scene.add
    .rectangle(
      0,
      0,
      width,
      height,
      opts.primary ? PALETTE.accent : PALETTE.panel,
      opts.primary ? 1 : 0.85,
    )
    .setStrokeStyle(2, PALETTE.accent, opts.primary ? 0 : 0.6);
  const text = scene.add
    .text(0, 0, label, textStyle(opts.size ?? 24, opts.primary ? '#1B2350' : undefined))
    .setOrigin(0.5);
  const box = scene.add.container(x, y, [bg, text]).setSize(width, height);
  box.setInteractive({ useHandCursor: true });
  box.on('pointerover', () => box.setScale(1.04));
  box.on('pointerout', () => box.setScale(1));
  box.on('pointerup', onClick);
  return box;
}
