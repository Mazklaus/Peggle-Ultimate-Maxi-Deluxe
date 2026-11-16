/**
 * Jauge d'excitation de l'Astre (0 à 1), partagée par l'animation et la voix :
 * chaque cristal la fait monter, elle redescend doucement (règles communes des Astres).
 */
export const EXCITATION_PER_HIT = 0.12;
/** Décroissance par seconde. */
export const EXCITATION_DECAY = 0.25;

export class Excitation {
  private value = 0;
  private at = 0;

  /** Valeur courante à l'instant `now` (secondes). */
  get(now: number): number {
    const elapsed = Math.max(0, now - this.at);
    return Math.max(0, this.value - elapsed * EXCITATION_DECAY);
  }

  hit(now: number): number {
    this.value = Math.min(1, this.get(now) + EXCITATION_PER_HIT);
    this.at = now;
    return this.value;
  }

  reset(now: number): void {
    this.value = 0;
    this.at = now;
  }
}

/** Palier lisible de la jauge (fiche de Pip : basse / moyenne / haute). */
export function excitationLevel(value: number): 0 | 1 | 2 {
  if (value >= 0.66) return 2;
  if (value >= 0.33) return 1;
  return 0;
}
