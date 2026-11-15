/**
 * Logique pure (sans Phaser) : testable avec Vitest.
 * Placeholder : les vraies règles viendront du Game Designer.
 */
export type PegKind = 'normal' | 'target';

export const BASE_POINTS: Record<PegKind, number> = { normal: 10, target: 100 };

/** Points d'un peg touché, multipliés par le nombre de pegs déjà touchés pendant le tir. */
export function pegPoints(kind: PegKind, hitsThisShot: number): number {
  const multiplier = Math.max(1, hitsThisShot);
  return BASE_POINTS[kind] * multiplier;
}
