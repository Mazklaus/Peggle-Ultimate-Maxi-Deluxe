/**
 * Réglages de départ du prototype (Game Designer, boucle-et-regles.md, section 3).
 * Les valeurs non encore utilisées (pouvoir de compagnon) sont volontairement absentes.
 */
export const TUNING = {
  startingOrbs: 10,
  heartCrystals: 20,
  commonCrystals: 60,
  bonusCrystals: 1,
  points: { common: 10, heart: 100, bonus: 500 },
  /** Multiplicateurs, débloqués à 25 / 50 / 75 / 90 % de cœurs brisés. */
  multiplierSteps: [1, 2, 3, 5, 10],
  multiplierThresholds: [0.25, 0.5, 0.75, 0.9],
  freeOrbShotScore: 25000,
  /** Le réceptacle traverse l'écran en 4 s. */
  bucketCrossSeconds: 4,
  antiStuckSeconds: 3,
};

export type Tuning = typeof TUNING;
