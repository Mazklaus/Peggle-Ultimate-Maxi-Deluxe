/**
 * Partitions pures (sans Web Audio) : musique en couches du chapitre 1, thème de la Grande Veilleuse,
 * jingles. Le séquenceur du moteur lit ces données pas à pas (double-croches).
 */

export type MusicLayer = 1 | 2 | 3;
export type Instrument =
  | 'pad'
  | 'harp'
  | 'bell'
  | 'bass'
  | 'kick'
  | 'shaker'
  | 'melody'
  | 'strings'
  | 'pulse'
  | 'brass'
  | 'choir'
  | 'cymbal'
  | 'musicbox'
  | 'piccolo'
  | 'clarinet'
  | 'tuba'
  | 'pluck'
  | 'vibes'
  | 'marimba'
  | 'organ'
  | 'tick';

export interface ScoreEvent {
  layer: MusicLayer;
  instrument: Instrument;
  midi: number;
  /** Durée en pas (double-croches). */
  steps: number;
  /** Vélocité 0-1. */
  velocity: number;
}

export interface Track {
  id: string;
  bpm: number;
  stepsPerBar: number;
  bars: number;
  /** Événements à jouer au pas `step` (bouclé sur la longueur du morceau). */
  eventsAt(step: number): ScoreEvent[];
}

/** Thème de la Grande Veilleuse : 4 notes (si, la, ré, si), fil rouge de toute l'aventure. */
export const VEILLEUSE_MOTIF: readonly number[] = [71, 69, 74, 71];

/** Accords du chapitre 1 (2 mesures chacun) : Rémaj9, Sim7, Solmaj7, Lasus2 -> La. */
const CH1_CHORDS: readonly (readonly number[])[] = [
  [50, 57, 61, 64, 66], // Ré maj9 : ré la do# mi fa#
  [47, 54, 57, 62, 66], // Si m7 : si fa# la ré fa#
  [43, 50, 54, 59, 62], // Sol maj7 : sol ré fa# si ré
  [45, 52, 57, 59, 64], // La sus2 : la mi la si mi
];

/** Mélodie de la couche « tir » : [mesure, pas dans la mesure, note, durée en pas]. */
const CH1_MELODY: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 78, 6],
  [0, 6, 81, 2],
  [0, 8, 83, 4],
  [0, 12, 81, 4],
  [1, 0, 78, 8],
  [1, 8, 76, 8],
  [2, 0, 74, 6],
  [2, 6, 78, 2],
  [2, 8, 81, 8],
  [3, 0, 78, 16],
  [4, 0, 83, 6],
  [4, 6, 81, 2],
  [4, 8, 78, 4],
  [4, 12, 76, 4],
  [5, 0, 74, 8],
  [5, 8, 71, 8],
  [6, 0, 76, 4],
  [6, 4, 78, 4],
  [6, 8, 81, 8],
  [7, 0, 76, 16],
];

function chordAt(bar: number): readonly number[] {
  return CH1_CHORDS[Math.floor(bar / 2) % CH1_CHORDS.length] ?? CH1_CHORDS[0] ?? [];
}

/** Arpège de harpe montant puis descendant sur 2 octaves (une note par croche). */
function harpNote(chord: readonly number[], eighth: number): number {
  const tones = [...chord.slice(1), ...chord.slice(1).map((m) => m + 12)];
  const cycle = [...tones, ...tones.slice(1, -1).reverse()];
  return (cycle[eighth % cycle.length] ?? 62) + 12;
}

/** Musique du chapitre 1, « Premier ciel » : ré majeur, 88 bpm, boucle de 8 mesures. */
export const CH1_TRACK: Track = {
  id: 'ch1',
  bpm: 88,
  stepsPerBar: 16,
  bars: 8,
  eventsAt(rawStep: number): ScoreEvent[] {
    const step = ((rawStep % 128) + 128) % 128;
    const bar = Math.floor(step / 16);
    const inBar = step % 16;
    const chord = chordAt(bar);
    const root = chord[0] ?? 50;
    const out: ScoreEvent[] = [];

    // Couche 1, visée : nappe, harpe, thème de la Veilleuse en mesure 7.
    if (step % 32 === 0) {
      for (const m of chord.slice(1))
        out.push({ layer: 1, instrument: 'pad', midi: m, steps: 32, velocity: 0.5 });
    }
    if (inBar % 2 === 0) {
      out.push({
        layer: 1,
        instrument: 'harp',
        midi: harpNote(chord, Math.floor(step / 2)),
        steps: 6,
        velocity: inBar % 8 === 0 ? 0.55 : 0.38,
      });
    }
    if (bar === 7 && inBar % 4 === 0) {
      const m = VEILLEUSE_MOTIF[inBar / 4];
      if (m !== undefined)
        out.push({ layer: 1, instrument: 'bell', midi: m + 12, steps: 4, velocity: 0.45 });
    }

    // Couche 2, tir : basse, percussions douces, mélodie.
    if (inBar === 0)
      out.push({ layer: 2, instrument: 'bass', midi: root - 12, steps: 7, velocity: 0.7 });
    if (inBar === 8)
      out.push({ layer: 2, instrument: 'bass', midi: root - 5, steps: 7, velocity: 0.55 });
    if (inBar === 0 || inBar === 8)
      out.push({ layer: 2, instrument: 'kick', midi: 36, steps: 2, velocity: 0.6 });
    if (inBar % 4 === 2)
      out.push({ layer: 2, instrument: 'shaker', midi: 0, steps: 1, velocity: 0.35 });
    for (const [b, s, m, d] of CH1_MELODY) {
      if (b === bar && s === inBar)
        out.push({ layer: 2, instrument: 'melody', midi: m, steps: d, velocity: 0.5 });
    }

    // Couche 3, tension (peu de cœurs) : cordes en croches, pulsation de timbales.
    if (inBar % 2 === 0) {
      const tones = chord.slice(1);
      const m = tones[(Math.floor(inBar / 2) * 2) % tones.length] ?? root;
      out.push({
        layer: 3,
        instrument: 'strings',
        midi: m + 12,
        steps: 2,
        velocity: inBar % 4 === 0 ? 0.5 : 0.35,
      });
    }
    if (inBar % 4 === 0)
      out.push({ layer: 3, instrument: 'pulse', midi: root - 12, steps: 2, velocity: 0.5 });

    return out;
  },
};

/**
 * Thème du phare (hub) : une boîte à musique seule au prologue (couche 1).
 * Chaque Astre réveillé y ajoute sa voix : au jalon 1, le piccolo de Pip (couche 2).
 * La mélodie reprend le thème de la Veilleuse, ralenti et tendre.
 */
const PHARE_BOX: readonly (readonly [number, number, number])[] = [
  // [pas, note, durée] sur 4 mesures (64 pas), en ré majeur
  [0, 83, 4],
  [4, 81, 4],
  [8, 86, 8],
  [16, 83, 4],
  [20, 78, 4],
  [24, 81, 8],
  [32, 83, 4],
  [36, 81, 4],
  [40, 86, 4],
  [44, 88, 4],
  [48, 90, 6],
  [54, 88, 2],
  [56, 86, 8],
];
const PHARE_BASS: readonly number[] = [62, 59, 55, 57];
const PHARE_PIP: readonly (readonly [number, number, number])[] = [
  [2, 90, 2],
  [6, 93, 2],
  [12, 95, 4],
  [26, 93, 2],
  [28, 90, 4],
  [42, 93, 2],
  [46, 95, 2],
  [50, 98, 2],
  [52, 95, 2],
  [60, 98, 4],
];

export const PHARE_TRACK: Track = {
  id: 'phare',
  bpm: 72,
  stepsPerBar: 16,
  bars: 4,
  eventsAt(rawStep: number): ScoreEvent[] {
    const step = ((rawStep % 64) + 64) % 64;
    const out: ScoreEvent[] = [];
    for (const [s, m, d] of PHARE_BOX) {
      if (s === step)
        out.push({ layer: 1, instrument: 'musicbox', midi: m, steps: d, velocity: 0.55 });
    }
    if (step % 16 === 0) {
      const b = PHARE_BASS[step / 16] ?? 62;
      out.push({ layer: 1, instrument: 'musicbox', midi: b, steps: 8, velocity: 0.35 });
      out.push({ layer: 1, instrument: 'musicbox', midi: b + 7, steps: 8, velocity: 0.25 });
    }
    for (const [s, m, d] of PHARE_PIP) {
      if (s === step)
        out.push({ layer: 2, instrument: 'piccolo', midi: m - 12, steps: d, velocity: 0.45 });
    }
    return out;
  },
};

export const TRACKS: Record<string, Track> = { ch1: CH1_TRACK, phare: PHARE_TRACK };

/** Jingle : événements placés en temps (noires) à partir du début. */
export interface JingleEvent {
  beat: number;
  instrument: Instrument;
  midi: number;
  beats: number;
  velocity: number;
}

export interface Jingle {
  id: string;
  bpm: number;
  events: readonly JingleEvent[];
}

const chordEvents = (
  beat: number,
  instrument: Instrument,
  notes: readonly number[],
  beats: number,
  velocity: number,
): JingleEvent[] => notes.map((midi) => ({ beat, instrument, midi, beats, velocity }));

/** Explosion orchestrale de victoire (après le ralenti du dernier cœur). */
export const VICTORY_JINGLE: Jingle = {
  id: 'victoire',
  bpm: 100,
  events: [
    { beat: 0, instrument: 'cymbal', midi: 0, beats: 6, velocity: 0.7 },
    { beat: 0, instrument: 'pulse', midi: 38, beats: 2, velocity: 1 },
    ...chordEvents(0, 'brass', [50, 57, 62, 66], 2, 0.8),
    ...chordEvents(0, 'choir', [62, 66, 69, 74], 6, 0.6),
    ...chordEvents(0, 'strings', [74, 78, 81, 86], 2, 0.6),
    // arpège de cloches : le ciel se rallume
    ...[74, 78, 81, 86, 90, 93, 98].map((midi, i) => ({
      beat: 0.25 + i * 0.25,
      instrument: 'bell' as const,
      midi,
      beats: 2,
      velocity: 0.55,
    })),
    // fanfare : thème de la Veilleuse en majeur triomphant
    { beat: 2, instrument: 'brass', midi: 71, beats: 0.75, velocity: 0.75 },
    { beat: 2.75, instrument: 'brass', midi: 69, beats: 0.25, velocity: 0.7 },
    { beat: 3, instrument: 'brass', midi: 74, beats: 0.75, velocity: 0.8 },
    { beat: 3.75, instrument: 'brass', midi: 71, beats: 0.25, velocity: 0.7 },
    { beat: 4, instrument: 'pulse', midi: 38, beats: 2, velocity: 0.9 },
    ...chordEvents(4, 'brass', [50, 57, 62, 66, 69], 4, 0.85),
    ...chordEvents(4, 'strings', [74, 78, 81, 86], 4, 0.7),
    ...chordEvents(4, 'pad', [62, 66, 69, 74], 6, 0.6),
    { beat: 4, instrument: 'bell', midi: 86, beats: 4, velocity: 0.6 },
  ],
};

/** Échec : petit motif tendre et descendant, jamais de « game over ». */
export const DEFEAT_JINGLE: Jingle = {
  id: 'echec',
  bpm: 76,
  events: [
    ...chordEvents(0, 'pad', [59, 62, 66], 4, 0.45),
    { beat: 0, instrument: 'bell', midi: 83, beats: 1, velocity: 0.4 },
    { beat: 1, instrument: 'bell', midi: 81, beats: 1, velocity: 0.38 },
    { beat: 2, instrument: 'bell', midi: 78, beats: 1, velocity: 0.36 },
    { beat: 3, instrument: 'bell', midi: 76, beats: 2, velocity: 0.34 },
    ...chordEvents(3, 'pad', [55, 59, 62, 66], 3, 0.4),
    // remontée finale : « encore une fois ? »
    { beat: 5, instrument: 'harp', midi: 74, beats: 0.5, velocity: 0.4 },
    { beat: 5.5, instrument: 'harp', midi: 78, beats: 1.5, velocity: 0.42 },
  ],
};

/** Petit jingle « orbe rendu » quand le réceptacle attrape l'orbe. */
export const CATCH_JINGLE: Jingle = {
  id: 'orbe_recupere',
  bpm: 140,
  events: [
    { beat: 0, instrument: 'bell', midi: 74, beats: 0.5, velocity: 0.5 },
    { beat: 0.5, instrument: 'bell', midi: 78, beats: 0.5, velocity: 0.5 },
    { beat: 1, instrument: 'bell', midi: 81, beats: 1.5, velocity: 0.55 },
    { beat: 0, instrument: 'bass', midi: 50, beats: 1.5, velocity: 0.45 },
  ],
};

/** Jingle de déblocage (nouvel Astre, nouvelle constellation). */
export const UNLOCK_JINGLE: Jingle = {
  id: 'deblocage',
  bpm: 120,
  events: [
    ...[74, 78, 81, 83, 86].map((midi, i) => ({
      beat: i * 0.25,
      instrument: 'musicbox' as const,
      midi,
      beats: 1,
      velocity: 0.5,
    })),
    ...chordEvents(1.25, 'bell', [86, 90, 93], 3, 0.45),
    ...chordEvents(1.25, 'pad', [62, 66, 69], 3, 0.5),
  ],
};

export const JINGLES = {
  victoire: VICTORY_JINGLE,
  echec: DEFEAT_JINGLE,
  orbe_recupere: CATCH_JINGLE,
  deblocage: UNLOCK_JINGLE,
} as const;
export type JingleName = keyof typeof JINGLES;

/** Durée d'un jingle en secondes. */
export function jingleDuration(jingle: Jingle): number {
  const lastBeat = Math.max(...jingle.events.map((e) => e.beat + e.beats));
  return (lastBeat * 60) / jingle.bpm;
}
