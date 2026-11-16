import { describe, expect, it } from 'vitest';
import { PIP } from '../src/companions/pip';
import { CHAPTER_ASTRE, VOICES, deriveVoice } from '../src/core/audio/astres';
import {
  CHAPTER_SPECS,
  CHAPTER_TRACKS,
  VEILLEUSE_THEME,
  melodyLength,
  noteToMidi,
  phareTrack,
  veilleuseFinale,
} from '../src/core/audio/chapters';
import { normalizeAstreId, reactionIndex } from '../src/core/audio/reactionMap';
import { CUE_PRIORITY, PIP_VOICE, phraseDuration, type VoiceCue } from '../src/core/audio/voice';

const CUES = Object.keys(CUE_PRIORITY) as VoiceCue[];
const pc = (m: number): number => (((m - 62) % 12) + 12) % 12;
const D_MAJOR = new Set([0, 2, 4, 5, 7, 9, 11]);

describe('voix des 8 Astres', () => {
  it('chaque Astre a une voix pour toutes les répliques, orbe_coincee comprise', () => {
    expect(Object.keys(VOICES).sort()).toEqual(
      ['bourdon', 'grelot', 'horloge', 'mousse', 'nuage_lune', 'pip', 'twi_nkl', 'volte'].sort(),
    );
    for (const voice of Object.values(VOICES))
      for (const cue of CUES) {
        expect(voice.phrases[cue].length, `${voice.astre} ${cue}`).toBeGreaterThan(0);
        for (const p of voice.phrases[cue]) {
          expect(phraseDuration(p), `${voice.astre} ${cue}`).toBeGreaterThan(0);
          expect(phraseDuration(p), `${voice.astre} ${cue}`).toBeLessThanOrEqual(3.2);
        }
      }
  });

  it("chaque voix a son propre instrument, et l'Astre de chaque chapitre a une voix", () => {
    const instruments = new Set(Object.values(VOICES).map((v) => v.instrument));
    expect(instruments.size).toBe(8);
    for (const id of CHAPTER_ASTRE) expect(VOICES[id]).toBeDefined();
  });

  it('dérive le tempo, la tessiture et la grille rythmique', () => {
    const slow = deriveVoice(PIP_VOICE.phrases, {
      rate: 0.5,
      range: [-5, 5],
      grid: 0.25,
      plain: true,
    });
    for (const cue of CUES)
      slow[cue].forEach((p, i) =>
        p.forEach((note, k) => {
          expect(note.s).toBeGreaterThanOrEqual(-5);
          expect(note.s).toBeLessThanOrEqual(5);
          expect(note.to).toBeUndefined();
          expect((note.d / 0.25) % 1).toBeCloseTo(0);
          const orig = PIP_VOICE.phrases[cue][i]?.[k];
          if (orig) expect(note.d).toBeGreaterThanOrEqual(orig.d);
        }),
      );
  });

  it('relie chaque réaction animée de Pip à une réplique vocale', () => {
    const idx = reactionIndex(PIP, new Set(CUES));
    const ids = [
      ...PIP.idleShort,
      ...PIP.idleLong,
      ...Object.values(PIP.reactions).flatMap((l) => l ?? []),
    ].map((r) => r.id);
    for (const id of ids) expect(idx.has(id), id).toBe(true);
    expect(idx.get('pip_toupie')?.cue).toBe('gros_coup');
    expect(idx.get('pip_oh')?.cue).toBe('orbe_proche_coeur');
  });

  it("reconnaît les noms d'Astres écrits autrement", () => {
    expect(normalizeAstreId('Twi & Nkl')).toBe('twi_nkl');
    expect(normalizeAstreId('nuage-lune')).toBe('nuage_lune');
    expect(normalizeAstreId('Nuage_Lune')).toBe('nuage_lune');
    expect(normalizeAstreId('Bourdon')).toBe('bourdon');
  });
});

describe('musiques des chapitres 2 à 8', () => {
  it('lit les notes', () => {
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('F#5')).toBe(78);
    expect(noteToMidi('C#6')).toBe(85);
  });

  it('7 chapitres, mélodies de 8 mesures exactement, tempos variés', () => {
    expect(CHAPTER_SPECS.map((c) => c.id)).toEqual([
      'ch2',
      'ch3',
      'ch4',
      'ch5',
      'ch6',
      'ch7',
      'ch8',
    ]);
    for (const spec of CHAPTER_SPECS) expect(melodyLength(spec.melody.notes), spec.id).toBe(128);
    expect(new Set(CHAPTER_SPECS.map((c) => c.bpm)).size).toBe(7);
  });

  it('restent en ré (mélodies dans la gamme, do bécarre toléré pour le mixolydien de Volte)', () => {
    for (const spec of CHAPTER_SPECS) {
      const track = CHAPTER_TRACKS[spec.id];
      expect(track).toBeDefined();
      const layers = new Set<number>();
      for (let step = 0; step < 128; step++)
        for (const e of track?.eventsAt(step) ?? []) {
          layers.add(e.layer);
          if (e.instrument === spec.melody.instrument && e.layer === 2) {
            const ok = D_MAJOR.has(pc(e.midi)) || (spec.id === 'ch4' && pc(e.midi) === 10);
            expect(ok, `${spec.id} ${e.midi}`).toBe(true);
          }
        }
      expect([...layers].sort()).toEqual([1, 2, 3]);
    }
  });
});

describe('thème du phare et final', () => {
  it("s'enrichit d'un instrument par Astre réveillé", () => {
    let previous = 0;
    for (let n = 0; n <= 8; n++) {
      const inst = new Set<string>();
      for (let step = 0; step < 64; step++)
        for (const e of phareTrack(n).eventsAt(step)) inst.add(e.instrument);
      expect(inst.size, `phare ${n}`).toBeGreaterThan(previous);
      previous = inst.size;
    }
    expect(phareTrack(0).id).toBe('phare-0');
    expect(phareTrack(99).id).toBe('phare-8');
  });

  it('le final commence par un silence total, dure moins d’une minute et finit sur la boîte à musique', () => {
    const j = veilleuseFinale();
    const first = Math.min(...j.events.map((e) => e.beat));
    expect(first).toBeGreaterThanOrEqual(2);
    const end = Math.max(...j.events.map((e) => e.beat + e.beats));
    expect((end * 60) / j.bpm).toBeLessThan(60);
    const last = j.events.filter((e) => e.beat === Math.max(...j.events.map((x) => x.beat)));
    expect(last.every((e) => e.instrument === 'musicbox')).toBe(true);
    expect(VEILLEUSE_THEME.reduce((t, [, d]) => t + d, 0)).toBe(32);
  });
});
