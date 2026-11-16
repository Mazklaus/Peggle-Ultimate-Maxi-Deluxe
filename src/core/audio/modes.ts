/**
 * Musiques et jingles des modes hors aventure (jalon 3) : Défis, Constellation du jour, Duel.
 * Toujours en ré, pour que les rebonds pentatoniques restent justes.
 */
import { CHAPTER_SPECS, chapterTrack, type ChapterSpec } from './chapters';
import type { Instrument, Jingle, Track } from './score';

/** Défis : concentration, pulsation régulière, marimba et cuivres piqués. */
export const DEFI_SPEC: ChapterSpec = {
  id: 'defi',
  title: 'Défi (concentration)',
  bpm: 108,
  chords: [
    [47, 59, 62, 66],
    [43, 59, 62, 67],
    [50, 57, 62, 66],
    [45, 57, 61, 64],
  ],
  arp: { instrument: 'marimba', every: 1, pattern: 'alberti' },
  melody: {
    instrument: 'brass',
    velocity: 0.45,
    notes:
      'B4:2 r:2 B4:2 D5:2 F#5:4 E5:4 D5:2 r:2 D5:2 B4:2 A4:8 G4:2 r:2 B4:2 D5:2 G5:4 F#5:4 E5:8 D5:4 C#5:4 D5:2 r:2 F#5:2 A5:2 B5:8 A5:4 F#5:4 E5:2 r:2 E5:2 F#5:2 A5:4 G5:4 F#5:4 E5:4 C#5:8 r:8',
  },
  bass: 'bass',
  perc: 'tick',
};

/** Duel local : héroïque et joueur, cuivres et clarinette. */
export const DUEL_SPEC: ChapterSpec = {
  id: 'duel',
  title: 'Duel (deux Gardiennes)',
  bpm: 124,
  chords: [
    [50, 62, 66, 69],
    [42, 57, 61, 66],
    [43, 59, 62, 67],
    [45, 57, 61, 64],
  ],
  arp: { instrument: 'pluck', every: 2, pattern: 'updown' },
  melody: {
    instrument: 'brass',
    velocity: 0.5,
    notes:
      'D5:4 F#5:2 A5:2 D6:8 C#6:4 A5:2 F#5:2 E5:8 B5:4 G5:2 B5:2 D6:6 B5:2 A5:4 E5:2 A5:2 C#6:8 D6:4 A5:2 F#5:2 D5:8 F#5:4 A5:2 C#6:2 B5:8 G5:4 B5:2 D6:2 E6:6 D6:2 C#6:4 A5:4 E5:4 C#5:4',
  },
  bass: 'bass',
  perc: 'drive',
};

const DAILY_ARPS: readonly Instrument[] = ['harp', 'vibes', 'marimba', 'bell', 'pluck', 'musicbox'];

/** Graine du jour (AAAAMMJJ), identique pour tous les joueurs ce jour-là. */
export function daySeed(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Constellation du jour : chaque jour, une variante unique tirée d'un ciel de l'aventure
 * (harmonie et mélodie du chapitre), avec un autre instrument d'arpège et un tempo un peu décalé.
 */
export function dailySpec(date: Date): ChapterSpec {
  const rnd = mulberry(daySeed(date));
  const base = CHAPTER_SPECS[Math.floor(rnd() * CHAPTER_SPECS.length)] ?? CHAPTER_SPECS[0];
  if (!base) throw new Error('aucun chapitre');
  const arp = DAILY_ARPS[Math.floor(rnd() * DAILY_ARPS.length)] ?? 'harp';
  const delta = Math.round((rnd() - 0.5) * 16);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return {
    ...base,
    id: `quotidien-${y}-${m}-${d}`,
    title: `Constellation du jour (d'après ${base.title})`,
    bpm: Math.max(56, Math.min(140, base.bpm + delta)),
    arp: { ...base.arp, instrument: arp },
  };
}

export const MODE_TRACKS: Record<string, Track> = {
  defi: chapterTrack(DEFI_SPEC),
  duel: chapterTrack(DUEL_SPEC),
};

export function dailyTrack(date: Date = new Date()): Track {
  return chapterTrack(dailySpec(date));
}

/** Jingles des modes. `pan` : -1 gauche (joueur 1), 1 droite (joueur 2). */
export const MODE_JINGLES: Record<string, Jingle & { pan?: number }> = {
  // Duel : à toi ! (joueur 1 à gauche, en cloches ; joueur 2 à droite, en marimba)
  duel_tour_j1: {
    id: 'duel_tour_j1',
    bpm: 150,
    pan: -0.6,
    events: [74, 78, 81].map((midi, i) => ({
      beat: i * 0.5,
      instrument: 'bell' as const,
      midi,
      beats: 1,
      velocity: 0.5,
    })),
  },
  duel_tour_j2: {
    id: 'duel_tour_j2',
    bpm: 150,
    pan: 0.6,
    events: [81, 78, 86].map((midi, i) => ({
      beat: i * 0.5,
      instrument: 'marimba' as const,
      midi,
      beats: 1,
      velocity: 0.6,
    })),
  },
  duel_victoire: {
    id: 'duel_victoire',
    bpm: 112,
    events: [
      { beat: 0, instrument: 'cymbal', midi: 0, beats: 3, velocity: 0.5 },
      { beat: 0, instrument: 'brass', midi: 62, beats: 0.5, velocity: 0.7 },
      { beat: 0.5, instrument: 'brass', midi: 66, beats: 0.5, velocity: 0.7 },
      { beat: 1, instrument: 'brass', midi: 69, beats: 0.5, velocity: 0.75 },
      ...[50, 62, 66, 69, 74].map((midi) => ({
        beat: 1.5,
        instrument: 'brass' as const,
        midi,
        beats: 2.5,
        velocity: 0.75,
      })),
      ...[78, 81, 86, 90].map((midi, i) => ({
        beat: 1.5 + i * 0.25,
        instrument: 'bell' as const,
        midi,
        beats: 2,
        velocity: 0.45,
      })),
    ],
  },
  // Défis : réussi (étoile qui monte) / raté (retombée tendre, jamais punitive)
  defi_reussi: {
    id: 'defi_reussi',
    bpm: 132,
    events: [
      ...[74, 78, 81, 86].map((midi, i) => ({
        beat: i * 0.5,
        instrument: 'bell' as const,
        midi,
        beats: 1.5,
        velocity: 0.5,
      })),
      ...[62, 66, 69].map((midi) => ({
        beat: 1.5,
        instrument: 'pad' as const,
        midi,
        beats: 3,
        velocity: 0.5,
      })),
    ],
  },
  defi_rate: {
    id: 'defi_rate',
    bpm: 90,
    events: [
      { beat: 0, instrument: 'vibes', midi: 81, beats: 1, velocity: 0.4 },
      { beat: 1, instrument: 'vibes', midi: 78, beats: 1, velocity: 0.38 },
      { beat: 2, instrument: 'vibes', midi: 74, beats: 2, velocity: 0.36 },
    ],
  },
  // Constellation du jour : petite signature d'ouverture (l'étoile du jour s'allume)
  quotidien_ouverture: {
    id: 'quotidien_ouverture',
    bpm: 100,
    events: [
      ...[71, 69, 74, 71].map((midi, i) => ({
        beat: i * 0.5,
        instrument: 'musicbox' as const,
        midi: midi + 12,
        beats: 1,
        velocity: 0.5,
      })),
      { beat: 2, instrument: 'bell', midi: 98, beats: 3, velocity: 0.4 },
    ],
  },
};
