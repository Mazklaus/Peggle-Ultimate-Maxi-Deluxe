/**
 * Effets de pouvoir lisibles sans la couleur (règles du DA, valables en mode normal comme en
 * mode daltonien) : particules et ondes HEXAGONALES (la forme des pouvoirs), cœur blanc chaud
 * au centre des éclats, léger contour nuit sur les traits fins.
 */
import Phaser from 'phaser';
import { PALETTE, powerColor } from './theme';

const WARM = PALETTE.lit; // #FFF6E0
const OUTLINE = PALETTE.panel; // #1B2350

/** Sommets d'un hexagone (pointe en haut) de rayon r, centré en 0. */
export function hexPoints(r: number): Phaser.Math.Vector2[] {
  return Array.from({ length: 6 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    return new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r);
  });
}

/** Particule de pouvoir : petit hexagone à la couleur des pouvoirs, liseré nuit. */
export function powerParticle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  r: number,
  alpha = 0.9,
): Phaser.GameObjects.Polygon {
  // Points décalés en positif : l'origine 0,5 du polygone tombe au centre de l'hexagone.
  const pts = hexPoints(r).map((p) => ({ x: p.x + r, y: p.y + r }));
  return scene.add.polygon(x, y, pts, powerColor(), alpha).setStrokeStyle(1, OUTLINE, 0.6);
}

/**
 * Éclat de pouvoir : hexagone couleur pouvoir qui grandit et s'efface, avec un cœur blanc
 * chaud au centre (le distingue du jaune de Pip et du cœur orange en mode daltonien).
 */
export function powerFlash(
  scene: Phaser.Scene,
  x: number,
  y: number,
  r: number,
  depth: number,
  grow = 3,
  duration = 260,
): void {
  const halo = powerParticle(scene, x, y, r, 0.5).setDepth(depth);
  const core = scene.add.circle(x, y, r * 0.45, WARM, 0.95).setDepth(depth + 0.1);
  scene.tweens.add({
    targets: halo,
    scale: grow,
    alpha: 0,
    duration,
    ease: 'Quad.Out',
    onComplete: () => halo.destroy(),
  });
  scene.tweens.add({
    targets: core,
    scale: grow * 0.6,
    alpha: 0,
    duration: duration * 0.8,
    ease: 'Quad.Out',
    onComplete: () => core.destroy(),
  });
}

/** Trait fin couleur pouvoir avec un léger contour nuit dessous. */
export function outlinedLine(
  g: Phaser.GameObjects.Graphics,
  width: number,
  alpha: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  g.lineStyle(width + 2, OUTLINE, alpha * 0.6).lineBetween(x1, y1, x2, y2);
  g.lineStyle(width, powerColor(), alpha).lineBetween(x1, y1, x2, y2);
}

/** Cercle fin couleur pouvoir avec un léger contour nuit dessous. */
export function outlinedCircle(
  g: Phaser.GameObjects.Graphics,
  width: number,
  alpha: number,
  x: number,
  y: number,
  r: number,
): void {
  g.lineStyle(width + 2, OUTLINE, alpha * 0.6).strokeCircle(x, y, r);
  g.lineStyle(width, powerColor(), alpha).strokeCircle(x, y, r);
}

/** Hexagone fin (anneau d'onde) avec contour nuit, rayon r, centré en (x, y). */
export function outlinedHex(
  g: Phaser.GameObjects.Graphics,
  width: number,
  alpha: number,
  x: number,
  y: number,
  r: number,
): void {
  const pts = hexPoints(r).map((p) => new Phaser.Math.Vector2(p.x + x, p.y + y));
  g.lineStyle(width + 2, OUTLINE, alpha * 0.6).strokePoints(pts, true);
  g.lineStyle(width, powerColor(), alpha).strokePoints(pts, true);
}
