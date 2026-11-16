/**
 * Réglages de départ du prototype (Game Designer, boucle-et-regles.md, section 3).
 * Les valeurs non encore utilisées (pouvoir de compagnon) sont volontairement absentes.
 */

export const TUNING = {
  startingOrbs: 10,
  heartCrystals: 20,
  commonCrystals: 60,
  bonusCrystals: 1,
  points: { common: 10, heart: 100, bonus: 500, power: 50, wall: 0 },
  /** Bonus de fin par orbe restant (GD reglages-jalon1). */
  orbBonus: 1000,
  /**
   * Seuil de chaîne (GD) : rebonds de chaîne = contacts avec un cristal, allumé ou non (murs
   * et bords exclus). Sert à chaine_longue, au début du bonus de chaîne et aux défis chaine.
   * Provisoire : le Level Designer le cale au simulateur (~10 % des meilleurs tirs).
   */
  chainBounces: 10,
  /** Bonus de chaîne : +10 % du score du tir par rebond au-delà du seuil, au plus +100 %. */
  chainBonus: { perBounce: 0.1, max: 1 },
  /** Multiplicateurs, débloqués à 25 / 50 / 75 / 90 % de cœurs brisés. */
  multiplierSteps: [1, 2, 3, 5, 10],
  multiplierThresholds: [0.25, 0.5, 0.75, 0.9],
  freeOrbShotScore: 5000,
  /** Le réceptacle traverse l'écran en 4 s. */
  bucketCrossSeconds: 4,
  /** Anti-blocage : orbe quasi immobile plus de 2 s (règle GD, blocage QA ch1-10). */
  antiStuckSeconds: 2,
  /** Impulsions avant dissolution de l'orbe. */
  antiStuckNudges: 2,
};

export type Tuning = typeof TUNING;
