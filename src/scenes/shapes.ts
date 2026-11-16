import Phaser from 'phaser';

/** Étoile à 5 branches centrée en (x, y). */
export function starPoints(
  x: number,
  y: number,
  outer: number,
  inner: number,
): Phaser.Math.Vector2[] {
  return Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? outer : inner;
    return new Phaser.Math.Vector2(x + Math.cos(a) * r, y + Math.sin(a) * r);
  });
}

/** Étoile douce à 8 branches (la Grande Veilleuse). */
export function starPoints8(
  x: number,
  y: number,
  outer: number,
  inner: number,
): Phaser.Math.Vector2[] {
  return Array.from({ length: 16 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 8;
    const r = i % 2 === 0 ? outer : inner;
    return new Phaser.Math.Vector2(x + Math.cos(a) * r, y + Math.sin(a) * r);
  });
}
