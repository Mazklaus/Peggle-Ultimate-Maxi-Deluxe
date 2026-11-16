/**
 * Mixage global (pur, testé) : niveaux par défaut des bus et règles de priorité.
 * Ordre de priorité (note d'intentions) : 1. rebonds et feedback de jeu, 2. moments forts,
 * 3. musique, 4. voix des Astres (jamais par-dessus une longue chaîne de rebonds).
 */

export const MIX = {
  /** Volumes par défaut des bus (0-1), avant les réglages du joueur. */
  bus: { music: 0.55, sfx: 0.8, voice: 0.62 },
  /** Baisse de la musique pendant une longue chaîne (à partir de `chainFrom` cristaux). */
  chainDuck: { amount: 0.3, chainFrom: 8, seconds: 0.9 },
  /** Baisse de la musique pendant une réplique de l'Astre. */
  voiceDuck: 0.15,
  /** La voix s'efface quand les rebonds s'enchaînent : -6 % par cristal dans la dernière seconde. */
  density: { perHit: 0.06, floor: 0.45, window: 1, recover: 0.6 },
} as const;

/** Compte les rebonds récents pour effacer la voix des Astres quand le jeu parle fort. */
export class HitDensity {
  private hits: number[] = [];

  hit(now: number): void {
    this.hits.push(now);
    this.prune(now);
  }

  count(now: number): number {
    this.prune(now);
    return this.hits.length;
  }

  /** Multiplicateur appliqué à la voix (1 = pleine voix, plancher MIX.density.floor). */
  voiceFactor(now: number): number {
    const { perHit, floor } = MIX.density;
    return Math.max(floor, 1 - perHit * this.count(now));
  }

  private prune(now: number): void {
    const limit = now - MIX.density.window;
    while (this.hits.length > 0 && (this.hits[0] ?? 0) < limit) this.hits.shift();
  }
}

/** Réglages audio du joueur (écran Options). */
export interface AudioSettings {
  music: number;
  sfx: number;
  voice: number;
  /** Mode doux : aigus adoucis, final moins intense. */
  soft: boolean;
  /** Son mono (une seule oreille, haut-parleur unique). */
  mono: boolean;
}

/** Convertit un curseur 0-1 en gain : courbe douce (perçue comme linéaire), 0 = silence. */
export function sliderToGain(v: number): number {
  const c = Math.min(1, Math.max(0, v));
  return c * c;
}
