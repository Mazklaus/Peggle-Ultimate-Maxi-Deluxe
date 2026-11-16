/**
 * Musiques des chapitres 2 à 8, thème du phare qui s'enrichit, final de la Grande Veilleuse.
 * Tout reste en ré (même tonalité que les rebonds pentatoniques) ; chaque chapitre a sa couleur
 * (tempo, harmonie, texture) et confie sa mélodie à l'instrument-voix de son Astre.
 */
import type { Instrument, Jingle, JingleEvent, MusicLayer, ScoreEvent, Track } from './score';
import { VEILLEUSE_MOTIF } from './score';

const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** « F#5 » -> 78. */
export function noteToMidi(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`Note illisible : ${name}`);
  const [, letter = 'C', acc, oct = '4'] = m;
  return 12 * (Number(oct) + 1) + (NOTE[letter] ?? 0) + (acc === '#' ? 1 : acc === 'b' ? -1 : 0);
}

/** Mélodie notée « F#5:6 A5:2 r:4 » (durées en double-croches) -> [pas, note, durée]. */
export function parseMelody(src: string): [number, number, number][] {
  const out: [number, number, number][] = [];
  let step = 0;
  for (const tok of src.trim().split(/\s+/)) {
    const [name = 'r', dur = '1'] = tok.split(':');
    const d = Number(dur);
    if (name !== 'r') out.push([step, noteToMidi(name), d]);
    step += d;
  }
  return out;
}

/** Longueur totale (en double-croches, silences compris). */
export function melodyLength(src: string): number {
  return src
    .trim()
    .split(/\s+/)
    .reduce((t, tok) => t + Number(tok.split(':')[1] ?? 1), 0);
}

export interface ChapterSpec {
  id: string;
  title: string;
  bpm: number;
  /** 4 accords de 2 mesures (notes MIDI, la première = basse). */
  chords: readonly (readonly number[])[];
  arp: { instrument: Instrument; every: 1 | 2 | 4; pattern: 'updown' | 'up' | 'alberti' };
  melody: { instrument: Instrument; notes: string; velocity?: number };
  bass: Instrument;
  perc: 'soft' | 'drive' | 'tick' | 'none';
}

function arpNote(
  chord: readonly number[],
  i: number,
  pattern: ChapterSpec['arp']['pattern'],
): number {
  const tones = [...chord.slice(1), ...chord.slice(1).map((m) => m + 12)];
  if (pattern === 'alberti') {
    const idx = [0, 2, 1, 2][i % 4] ?? 0;
    return (tones[idx] ?? 62) + 12;
  }
  const cycle = pattern === 'up' ? tones : [...tones, ...tones.slice(1, -1).reverse()];
  return (cycle[i % cycle.length] ?? 62) + 12;
}

/** Construit un morceau de 8 mesures en 3 couches (visée / tir / tension) à partir d'une fiche. */
export function chapterTrack(spec: ChapterSpec): Track {
  const melody = parseMelody(spec.melody.notes);
  return {
    id: spec.id,
    bpm: spec.bpm,
    stepsPerBar: 16,
    bars: 8,
    eventsAt(rawStep: number): ScoreEvent[] {
      const step = ((rawStep % 128) + 128) % 128;
      const bar = Math.floor(step / 16);
      const inBar = step % 16;
      const chord = spec.chords[Math.floor(bar / 2) % spec.chords.length] ?? [50, 62, 66, 69];
      const root = chord[0] ?? 50;
      const out: ScoreEvent[] = [];
      const ev = (
        layer: MusicLayer,
        instrument: Instrument,
        midi: number,
        steps: number,
        velocity: number,
      ): void => {
        out.push({ layer, instrument, midi, steps, velocity });
      };

      // Couche 1 : nappe + arpège de l'Astre + thème de la Veilleuse (fil rouge) en mesure 7.
      if (step % 32 === 0) for (const m of chord.slice(1)) ev(1, 'pad', m, 32, 0.45);
      if (inBar % spec.arp.every === 0) {
        const i = Math.floor(step / spec.arp.every);
        ev(
          1,
          spec.arp.instrument,
          arpNote(chord, i, spec.arp.pattern),
          spec.arp.every * 2,
          inBar % 8 === 0 ? 0.5 : 0.34,
        );
      }
      if (bar === 7 && inBar % 4 === 0) {
        const m = VEILLEUSE_MOTIF[inBar / 4];
        if (m !== undefined) ev(1, 'bell', m + 12, 4, 0.4);
      }

      // Couche 2 : basse, percussions, mélodie de l'Astre.
      if (inBar === 0) ev(2, spec.bass, root - 12, 7, 0.65);
      if (inBar === 8) ev(2, spec.bass, root - 5, 7, 0.5);
      if (spec.perc === 'soft' || spec.perc === 'drive') {
        if (inBar === 0 || inBar === 8) ev(2, 'kick', 36, 2, spec.perc === 'drive' ? 0.7 : 0.5);
        if (inBar % (spec.perc === 'drive' ? 2 : 4) === 2) ev(2, 'shaker', 0, 1, 0.32);
        if (spec.perc === 'drive' && (inBar === 4 || inBar === 12)) ev(2, 'kick', 38, 1, 0.35);
      }
      if (spec.perc === 'tick' && inBar % 4 === 0)
        ev(2, 'tick', inBar % 8 === 0 ? 60 : 61, 1, 0.45);
      for (const [s, m, d] of melody)
        if (s === step) ev(2, spec.melody.instrument, m, d, spec.melody.velocity ?? 0.5);

      // Couche 3 : tension, cordes en croches et timbales.
      if (inBar % 2 === 0) {
        const tones = chord.slice(1);
        ev(
          3,
          'strings',
          (tones[(inBar / 2) % tones.length] ?? root) + 12,
          2,
          inBar % 4 === 0 ? 0.48 : 0.33,
        );
      }
      if (inBar % 4 === 0) ev(3, 'pulse', root - 12, 2, 0.5);
      return out;
    },
  };
}

/** Fiches des chapitres 2 à 8 (un Astre et une teinte de ciel chacun). */
export const CHAPTER_SPECS: readonly ChapterSpec[] = [
  {
    id: 'ch2',
    title: 'Nuages de sieste (Bourdon)',
    bpm: 66,
    chords: [
      [50, 62, 66, 69, 73],
      [43, 59, 62, 66, 69],
      [40, 59, 62, 64, 67],
      [45, 57, 62, 64, 67],
    ],
    arp: { instrument: 'harp', every: 4, pattern: 'up' },
    melody: {
      instrument: 'tuba',
      velocity: 0.55,
      notes:
        'D3:8 F#3:4 A3:4 B3:12 A3:4 G3:8 F#3:8 E3:16 D3:8 F#3:4 A3:4 D4:12 B3:4 A3:8 G3:4 E3:4 D3:16',
    },
    bass: 'bass',
    perc: 'none',
  },
  {
    id: 'ch3',
    title: 'Ciel jumeau (Twi & Nkl)',
    bpm: 100,
    chords: [
      [50, 62, 66, 69],
      [47, 59, 62, 66],
      [43, 59, 62, 67],
      [45, 57, 61, 64],
    ],
    arp: { instrument: 'harp', every: 2, pattern: 'alberti' },
    // question (mesure impaire) / réponse (mesure paire), comme les jumelles
    melody: {
      instrument: 'clarinet',
      notes:
        'F#5:2 A5:2 B5:4 r:8 A5:2 F#5:2 E5:4 r:8 D5:2 F#5:2 A5:4 r:8 B5:2 A5:2 F#5:4 r:8 G5:2 B5:2 D6:4 r:8 B5:2 A5:2 G5:4 r:8 E5:2 F#5:2 A5:4 r:8 C#6:2 B5:2 A5:4 r:8',
    },
    bass: 'bass',
    perc: 'soft',
  },
  {
    id: 'ch4',
    title: 'Course des comètes (Volte)',
    bpm: 116,
    chords: [
      [50, 62, 66, 69],
      [48, 60, 64, 67],
      [43, 59, 62, 67],
      [45, 57, 62, 64],
    ],
    arp: { instrument: 'pluck', every: 1, pattern: 'updown' },
    melody: {
      instrument: 'pluck',
      velocity: 0.6,
      notes:
        'D5:2 F#5:2 A5:4 B5:2 A5:2 F#5:4 E5:2 G5:2 C6:4 B5:2 G5:2 E5:4 D5:2 G5:2 B5:4 D6:2 B5:2 G5:4 A5:4 F#5:4 E5:4 D5:4 D5:2 F#5:2 A5:4 B5:2 A5:2 F#5:4 E5:2 G5:2 C6:4 B5:2 A5:2 G5:4 B5:2 D6:2 B5:4 G5:2 B5:2 D6:4 E6:8 r:8',
    },
    bass: 'bass',
    perc: 'drive',
  },
  {
    id: 'ch5',
    title: 'Brume timide (Mousse)',
    bpm: 72,
    chords: [
      [47, 59, 62, 66],
      [43, 59, 62, 66],
      [50, 57, 62, 66],
      [45, 57, 61, 64],
    ],
    arp: { instrument: 'vibes', every: 4, pattern: 'up' },
    melody: {
      instrument: 'vibes',
      velocity: 0.45,
      notes:
        'B4:6 D5:2 F#5:8 E5:4 D5:4 B4:8 D5:6 E5:2 F#5:8 A5:8 F#5:8 E5:12 r:4 B4:6 D5:2 F#5:8 E5:4 D5:4 B4:8 A4:4 B4:4 D5:8',
    },
    bass: 'bass',
    perc: 'none',
  },
  {
    id: 'ch6',
    title: 'Mécanique céleste (Horloge)',
    bpm: 96,
    chords: [
      [50, 62, 66, 69],
      [49, 57, 61, 64],
      [47, 59, 62, 66],
      [42, 57, 61, 66],
    ],
    arp: { instrument: 'marimba', every: 1, pattern: 'alberti' },
    melody: {
      instrument: 'marimba',
      velocity: 0.55,
      notes:
        'F#5:4 E5:4 D5:4 C#5:4 B4:4 A4:4 B4:4 C#5:4 D5:4 C#5:4 B4:4 A4:4 G4:4 F#4:4 G4:4 E4:4 D5:4 F#5:4 A5:4 G5:4 F#5:4 D5:4 F#5:4 E5:4 D5:4 B4:4 D5:4 A5:4 G5:4 B5:4 A5:4 G5:4',
    },
    bass: 'bass',
    perc: 'tick',
  },
  {
    id: 'ch7',
    title: 'Vent filant (Grelot)',
    bpm: 132,
    chords: [
      [50, 61, 64, 66, 69],
      [52, 62, 66, 67, 71],
      [54, 61, 64, 66, 69],
      [43, 59, 62, 64, 67],
    ],
    arp: { instrument: 'bell', every: 2, pattern: 'up' },
    melody: {
      instrument: 'bell',
      velocity: 0.45,
      notes:
        'A5:2 B5:2 D6:2 E6:2 F#6:4 E6:4 D6:2 B5:2 A5:4 B5:8 E5:2 F#5:2 A5:2 B5:2 D6:4 B5:4 A5:4 F#5:4 E5:8 A5:2 B5:2 D6:2 E6:2 F#6:4 A6:4 F#6:2 E6:2 D6:4 B5:8 D6:2 B5:2 A5:2 F#5:2 E5:4 F#5:4 D5:16',
    },
    bass: 'bass',
    perc: 'drive',
  },
  {
    id: 'ch8',
    title: 'Ciel des rêves (Nuage-Lune)',
    bpm: 60,
    chords: [
      [43, 59, 62, 66, 69],
      [42, 57, 62, 66, 69],
      [40, 59, 62, 64, 67],
      [45, 57, 62, 64, 66],
    ],
    arp: { instrument: 'harp', every: 1, pattern: 'updown' },
    melody: {
      instrument: 'choir',
      velocity: 0.45,
      notes:
        'B4:8 A4:4 D5:4 B4:16 B4:8 A4:4 F#4:4 A4:16 D5:8 E5:4 F#5:4 A5:8 F#5:8 E5:8 D5:4 B4:4 D5:16',
    },
    bass: 'bass',
    perc: 'none',
  },
];

export const CHAPTER_TRACKS: Record<string, Track> = Object.fromEntries(
  CHAPTER_SPECS.map((spec) => [spec.id, chapterTrack(spec)]),
);

// ---------- Thème du phare ----------

/** Boîte à musique du phare (4 mesures, 64 pas) : [pas, note, durée]. */
const BOX: readonly (readonly [number, number, number])[] = [
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
const BOX_BASS: readonly number[] = [62, 59, 55, 57];
const PIP_LINE = parseMelody(
  'r:2 F#5:2 r:2 A5:2 r:4 B5:4 r:12 A5:2 F#5:4 r:12 A5:2 r:2 B5:2 r:2 D6:2 B5:2 r:6 D6:4',
);

/**
 * Ligne de chaque Astre dans le thème du phare, dans l'ordre où ils sont réveillés.
 * Au chapitre 8, les 8 voix + l'orgue de la Veilleuse jouent le thème au complet.
 */
const PHARE_LINES: readonly ((step: number) => ScoreEvent[])[] = [
  // 1 Pip : contre-chant de piccolo
  (step) =>
    PIP_LINE.filter(([s]) => s === step).map(([, m, d]) => ({
      layer: 1,
      instrument: 'piccolo',
      midi: m - 12,
      steps: d,
      velocity: 0.42,
    })),
  // 2 Bourdon : basse de tuba aux temps forts
  (step) =>
    step % 8 === 0
      ? [
          {
            layer: 1,
            instrument: 'tuba',
            midi: (BOX_BASS[Math.floor(step / 16)] ?? 62) - 24 + (step % 16 ? 7 : 0),
            steps: 6,
            velocity: 0.5,
          },
        ]
      : [],
  // 3 Twi & Nkl : deux clarinettes en tierces sous la mélodie
  (step) =>
    BOX.filter(([s]) => s === step && s % 8 === 0).flatMap(([, m, d]) => [
      {
        layer: 1 as MusicLayer,
        instrument: 'clarinet' as Instrument,
        midi: m - 12 - 3,
        steps: d,
        velocity: 0.35,
      },
      {
        layer: 1 as MusicLayer,
        instrument: 'clarinet' as Instrument,
        midi: m - 12 - 8,
        steps: d,
        velocity: 0.3,
      },
    ]),
  // 4 Volte : banjo en arpèges
  (step) =>
    step % 2 === 0
      ? [
          {
            layer: 1,
            instrument: 'pluck',
            midi: (BOX_BASS[Math.floor(step / 16)] ?? 62) + [0, 7, 12, 16][(step / 2) % 4]!,
            steps: 2,
            velocity: 0.28,
          },
        ]
      : [],
  // 5 Mousse : accords tenus au vibraphone
  (step) =>
    step % 16 === 4
      ? [0, 4, 7].map((i) => ({
          layer: 1 as MusicLayer,
          instrument: 'vibes' as Instrument,
          midi: (BOX_BASS[Math.floor(step / 16)] ?? 62) + 12 + i,
          steps: 8,
          velocity: 0.28,
        }))
      : [],
  // 6 Horloge : tic-tac et marimba en croches
  (step) => [
    ...(step % 4 === 0
      ? [
          {
            layer: 1 as MusicLayer,
            instrument: 'tick' as Instrument,
            midi: step % 8 === 0 ? 60 : 61,
            steps: 1,
            velocity: 0.35,
          },
        ]
      : []),
    ...(step % 4 === 2
      ? [
          {
            layer: 1 as MusicLayer,
            instrument: 'marimba' as Instrument,
            midi: (BOX_BASS[Math.floor(step / 16)] ?? 62) + 12,
            steps: 2,
            velocity: 0.3,
          },
        ]
      : []),
  ],
  // 7 Grelot : scintillements de clochettes en fin de phrase
  (step) =>
    step % 16 === 14
      ? [
          {
            layer: 1,
            instrument: 'bell',
            midi: 93 + (step % 32 === 14 ? 0 : 2),
            steps: 2,
            velocity: 0.3,
          },
        ]
      : [],
  // 8 Nuage-Lune : chœur lointain et harpe
  (step) =>
    step % 16 === 0
      ? [
          {
            layer: 1,
            instrument: 'choir',
            midi: (BOX_BASS[Math.floor(step / 16)] ?? 62) + 7,
            steps: 16,
            velocity: 0.35,
          },
          {
            layer: 1,
            instrument: 'harp',
            midi: (BOX_BASS[Math.floor(step / 16)] ?? 62) + 19,
            steps: 4,
            velocity: 0.3,
          },
        ]
      : [],
];

/** Thème du phare avec `astres` voix réveillées (0 = boîte à musique seule, 8 = thème complet + orgue). */
export function phareTrack(astres: number): Track {
  const n = Math.max(0, Math.min(PHARE_LINES.length, Math.floor(astres)));
  return {
    id: `phare-${n}`,
    bpm: 72,
    stepsPerBar: 16,
    bars: 4,
    eventsAt(rawStep: number): ScoreEvent[] {
      const step = ((rawStep % 64) + 64) % 64;
      const out: ScoreEvent[] = [];
      for (const [s, m, d] of BOX)
        if (s === step)
          out.push({ layer: 1, instrument: 'musicbox', midi: m, steps: d, velocity: 0.55 });
      if (step % 16 === 0) {
        const b = BOX_BASS[step / 16] ?? 62;
        out.push({ layer: 1, instrument: 'musicbox', midi: b, steps: 8, velocity: 0.35 });
        out.push({ layer: 1, instrument: 'musicbox', midi: b + 7, steps: 8, velocity: 0.25 });
      }
      for (let i = 0; i < n; i++) out.push(...(PHARE_LINES[i]?.(step) ?? []));
      if (n === PHARE_LINES.length && step % 32 === 0) {
        const b = BOX_BASS[step / 16] ?? 62;
        for (const m of [b - 12, b, b + 4, b + 7])
          out.push({ layer: 1, instrument: 'organ', midi: m, steps: 32, velocity: 0.4 });
      }
      return out;
    },
  };
}

// ---------- Final de l'aventure : la Grande Veilleuse se réveille ----------

/** Thème complet de la Veilleuse (8 mesures en noires), né du motif de 4 notes. */
export const VEILLEUSE_THEME: readonly (readonly [number, number])[] = [
  [71, 2],
  [69, 1],
  [74, 1],
  [71, 4],
  [71, 2],
  [69, 1],
  [66, 1],
  [69, 4],
  [74, 2],
  [76, 1],
  [78, 1],
  [81, 2],
  [78, 2],
  [76, 2],
  [74, 1],
  [71, 1],
  [74, 4],
];

const VEILLEUSE_CHORDS: readonly (readonly number[])[] = [
  [43, 55, 59, 62], // Sol
  [47, 54, 59, 62], // Si m
  [38, 54, 57, 62], // Ré
  [45, 52, 57, 61], // La
  [47, 54, 59, 62], // Si m
  [42, 54, 57, 61], // Fa# m
  [43, 55, 59, 64], // Mi m / Sol
  [38, 54, 57, 62], // Ré
];

/**
 * Final de l'aventure (storyboard ch.8, F3) : silence total, explosion orchestrale,
 * berceuse à plusieurs voix (les Astres entrent un par un), puis la boîte à musique seule
 * avec le piccolo de Pip, en écho à l'intro.
 */
export function veilleuseFinale(): Jingle {
  const ev: JingleEvent[] = [];
  const add = (
    beat: number,
    instrument: Instrument,
    midi: number,
    beats: number,
    velocity: number,
  ): void => {
    ev.push({ beat, instrument, midi, beats, velocity });
  };
  // 0-2 : silence total. 2 : explosion orchestrale.
  const B = 2;
  add(B, 'cymbal', 0, 6, 0.8);
  add(B, 'pulse', 38, 3, 1);
  for (const m of [38, 50, 57, 62, 66, 69, 74]) add(B, 'organ', m, 6, 0.8);
  for (const m of [50, 57, 62, 66]) add(B, 'brass', m, 3, 0.85);
  for (const m of [62, 66, 69, 74, 78]) add(B, 'choir', m, 6, 0.6);
  [74, 78, 81, 86, 90, 93, 98].forEach((m, i) => add(B + 0.25 + i * 0.25, 'bell', m, 2, 0.5));

  // 8 : berceuse, thème complet au chœur, les Astres entrent un à un (une mesure chacun).
  const S = 8;
  let beat = S;
  for (const [m, d] of VEILLEUSE_THEME) {
    add(beat, 'choir', m, d, 0.55);
    add(beat, 'musicbox', m + 12, d, 0.35);
    beat += d;
  }
  VEILLEUSE_CHORDS.forEach((chord, bar) => {
    const b0 = S + bar * 4;
    for (const m of chord.slice(1)) add(b0, 'pad', m, 4, 0.5);
    add(b0, 'organ', chord[0] ?? 38, 4, 0.5);
    // harpe en croches (Nuage-Lune, dès le début : le plus proche de la Veilleuse)
    for (let k = 0; k < 8; k++) add(b0 + k * 0.5, 'harp', (chord[1 + (k % 3)] ?? 62) + 12, 1, 0.3);
    if (bar >= 1) add(b0, 'tuba', (chord[0] ?? 38) - 12 + 12, 3.5, 0.45); // Bourdon
    if (bar >= 2) [0, 2].forEach((k) => add(b0 + k, 'clarinet', (chord[2] ?? 62) + 12, 2, 0.3)); // Jumelles
    if (bar >= 3) add(b0 + 1, 'vibes', (chord[3] ?? 66) + 12, 3, 0.3); // Mousse
    if (bar >= 4)
      for (let k = 0; k < 4; k++) add(b0 + k + 0.5, 'marimba', (chord[1] ?? 62) + 12, 0.5, 0.25); // Horloge
    if (bar >= 5) add(b0 + 3.5, 'bell', (chord[3] ?? 66) + 24, 0.5, 0.3); // Grelot
    if (bar >= 6) add(b0 + 2, 'pluck', (chord[1] ?? 62) + 12, 1, 0.3); // Volte
  });
  // Pip, toujours un peu en avance, double la fin de la berceuse au piccolo
  for (let i = 12; i < VEILLEUSE_THEME.length; i++) {
    const at = S + VEILLEUSE_THEME.slice(0, i).reduce((t, [, d]) => t + d, 0);
    const note = VEILLEUSE_THEME[i];
    if (note) add(at, 'piccolo', note[0], note[1], 0.35);
  }

  // 42 : la boîte à musique seule rejoue le motif, le piccolo de Pip lui répond (écho à l'intro).
  const E = S + 32 + 2;
  VEILLEUSE_MOTIF.forEach((m, i) => add(E + i, 'musicbox', m + 12, 1, 0.5));
  [78, 81, 83].forEach((m, i) => add(E + 4.5 + i * 0.5, 'piccolo', m, 0.5, 0.35));
  add(E + 6, 'musicbox', 86, 3, 0.45);
  add(E + 6, 'musicbox', 74, 3, 0.3);
  return { id: 'final_veilleuse', bpm: 72, events: ev };
}
