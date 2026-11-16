import Phaser from 'phaser';
import { PLAYFIELD } from '../config';
import type { LevelData } from '../core/levelFormat';
import { PALETTE, type CRYSTAL_COLORS } from './theme';

/** Mini-silhouette d'un niveau : fond nuit arrondi, un point par cristal à sa couleur. */
export function drawLevelPreview(
  g: Phaser.GameObjects.Graphics,
  level: LevelData,
  x: number,
  y: number,
  w: number,
  h: number,
  colors: typeof CRYSTAL_COLORS,
  dot = 1.6,
): void {
  g.fillStyle(PALETTE.night, 0.6).fillRoundedRect(x, y, w, h, 8);
  const sx = w / PLAYFIELD.w;
  const sy = h / PLAYFIELD.h;
  for (const peg of level.pegs) {
    if (peg.kind === 'wall' || peg.shape === 'brick') {
      g.fillStyle(PALETTE.starDim, 0.8).fillCircle(x + peg.x * sx, y + peg.y * sy, dot * 0.8);
      continue;
    }
    g.fillStyle(peg.kind ? colors[peg.kind] : PALETTE.starDim, 1);
    g.fillCircle(x + peg.x * sx, y + peg.y * sy, dot);
  }
}
