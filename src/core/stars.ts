/** Étoiles d'un niveau : 0 si perdu, 1 = fini, 2 et 3 = paliers de score du niveau. */
export function starsFor(
  score: number,
  thresholds: readonly [number, number],
  won: boolean,
): number {
  if (!won) return 0;
  if (score >= thresholds[1]) return 3;
  if (score >= thresholds[0]) return 2;
  return 1;
}
