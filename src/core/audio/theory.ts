/**
 * Théorie musicale pure (sans Web Audio) : gamme pentatonique des rebonds,
 * conversion MIDI -> fréquence. Voir la note d'intentions sonores (Sound Designer).
 */

/** Pentatonique majeure : 5 degrés, aucune dissonance possible quel que soit l'ordre. */
export const PENTATONIC = [0, 2, 4, 7, 9] as const;

/** Tonique du chapitre 1 : ré (D4 = MIDI 62). Les rebonds partent une octave au-dessus. */
export const CH1_ROOT = 62;

/** Nombre de notes avant d'ajouter une harmonie (une octave et demie environ). */
export const CHAIN_HARMONY_THIRD = 8;
/** Au-delà, on double aussi à l'octave. */
export const CHAIN_HARMONY_OCTAVE = 13;
/** Plafond de montée : ensuite la chaîne tourne sur les 3 notes du sommet. */
export const CHAIN_CEILING = 15;

export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Note MIDI du n-ième degré (0, 1, 2…) de la pentatonique, au-dessus de `root`. */
export function pentatonicDegree(root: number, degree: number): number {
  const len = PENTATONIC.length;
  const octave = Math.floor(degree / len);
  const step = ((degree % len) + len) % len;
  return root + 12 * octave + (PENTATONIC[step] ?? 0);
}

export interface ChainNote {
  /** Note principale. */
  midi: number;
  /** Notes ajoutées par-dessus quand la chaîne devient longue. */
  harmony: number[];
}

/**
 * Note jouée par le i-ème cristal touché d'un tir (i commence à 0).
 * Monte d'un degré par cristal, ajoute une tierce puis une octave, plafonne sans jamais sonner faux.
 */
export function chainNote(index: number, root = CH1_ROOT + 12): ChainNote {
  const i = Math.max(0, Math.floor(index));
  const degree = i <= CHAIN_CEILING ? i : CHAIN_CEILING - 2 + ((i - CHAIN_CEILING) % 3);
  const midi = pentatonicDegree(root, degree);
  const harmony: number[] = [];
  if (i >= CHAIN_HARMONY_THIRD) harmony.push(pentatonicDegree(root, degree - 2));
  if (i >= CHAIN_HARMONY_OCTAVE) harmony.push(midi - 12);
  return { midi, harmony };
}
