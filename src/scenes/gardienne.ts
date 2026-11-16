import type Phaser from 'phaser';

/**
 * Couleurs de la lanterne de la Gardienne (DA, public/da/gardienne.js) : monture lavande,
 * lumière crème, halo or pâle. Jamais d'ambre : il est réservé aux cristaux-cœurs.
 */
export const LANTERN = { frame: 0x8c93c9, light: 0xfff6e0, glow: 0xffe6a8 };
const INK = 0x3a3f7a;

/** Silhouette de la Gardienne, pieds en (x, y), avec sa lanterne ; face = fond derrière. */
export function drawGardienne(g: Phaser.GameObjects.Graphics, x = 0, y = 0, face = 0x232a5c): void {
  g.fillStyle(INK, 1);
  // Robe et capuche
  g.fillTriangle(x - 30, y, x + 30, y, x, y - 92);
  g.fillCircle(x, y - 92, 17);
  g.fillStyle(face, 1).fillCircle(x + 3, y - 90, 10); // creux du visage sous la capuche
  // Bras tendu et lanterne
  g.lineStyle(6, INK, 1).lineBetween(x + 6, y - 62, x + 34, y - 52);
  g.lineStyle(2, LANTERN.frame, 1).lineBetween(x + 34, y - 52, x + 34, y - 42);
  g.fillStyle(LANTERN.glow, 0.18).fillCircle(x + 34, y - 32, 26);
  g.fillStyle(LANTERN.glow, 0.35).fillCircle(x + 34, y - 32, 14);
  g.fillStyle(LANTERN.frame, 1).fillRoundedRect(x + 27, y - 42, 14, 20, 4);
  g.fillStyle(LANTERN.light, 1).fillRoundedRect(x + 29, y - 40, 10, 16, 3);
}
