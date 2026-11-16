import { describe, expect, it } from 'vitest';
import { Excitation, excitationLevel } from '../src/core/audio/excitation';
import { INITIAL_MUSIC_STATE, layersFor, nextMusicState } from '../src/core/audio/musicState';
import {
  CH1_TRACK,
  JINGLES,
  PHARE_TRACK,
  VEILLEUSE_MOTIF,
  jingleDuration,
} from '../src/core/audio/score';
import {
  CH1_ROOT,
  PENTATONIC,
  chainNote,
  midiToFreq,
  pentatonicDegree,
} from '../src/core/audio/theory';
import {
  CUE_PRIORITY,
  PIP_VOICE,
  phraseDuration,
  pickVariant,
  type VoiceCue,
} from '../src/core/audio/voice';
import { VoiceGate } from '../src/core/audio/voiceGate';

/** Classe de hauteur (0-11) relative à ré. */
const pc = (midi: number): number => (((midi - CH1_ROOT) % 12) + 12) % 12;
const D_MAJOR = new Set([0, 2, 4, 5, 7, 9, 11]);
const D_PENTA = new Set<number>(PENTATONIC);

describe('théorie', () => {
  it('convertit le la 440', () => {
    expect(midiToFreq(69)).toBeCloseTo(440);
    expect(midiToFreq(81)).toBeCloseTo(880);
  });

  it('monte la pentatonique degré par degré, octave comprise', () => {
    expect([0, 1, 2, 3, 4, 5].map((d) => pentatonicDegree(62, d))).toEqual([
      62, 64, 66, 69, 71, 74,
    ]);
  });

  it('chaque note de chaîne reste dans la pentatonique de ré, harmonies comprises', () => {
    for (let i = 0; i < 60; i++) {
      const n = chainNote(i);
      for (const m of [n.midi, ...n.harmony]) expect(D_PENTA.has(pc(m))).toBe(true);
    }
  });

  it('la chaîne monte strictement puis plafonne sans sortir de la tessiture', () => {
    for (let i = 1; i <= 15; i++) expect(chainNote(i).midi).toBeGreaterThan(chainNote(i - 1).midi);
    const top = chainNote(15).midi;
    for (let i = 16; i < 100; i++) expect(chainNote(i).midi).toBeLessThanOrEqual(top);
  });

  it("ajoute la tierce puis l'octave sur les longues chaînes", () => {
    expect(chainNote(3).harmony).toHaveLength(0);
    expect(chainNote(8).harmony).toHaveLength(1);
    expect(chainNote(13).harmony).toHaveLength(2);
  });
});

describe('voix de Pip', () => {
  const cues = Object.keys(CUE_PRIORITY) as VoiceCue[];

  it('a au moins une phrase pour chaque réplique, et des variantes pour les plus fréquentes', () => {
    for (const cue of cues) expect(PIP_VOICE.phrases[cue].length).toBeGreaterThan(0);
    for (const cue of [
      'tir_lance',
      'gros_coup',
      'rate',
      'orbe_recupere',
      'victoire',
      'echec',
      'presque',
    ] as VoiceCue[])
      expect(PIP_VOICE.phrases[cue].length).toBeGreaterThanOrEqual(2);
  });

  it('ses répliques restent courtes (lisibles en moins de 2,5 s, jamais bloquantes)', () => {
    for (const cue of cues)
      for (const p of PIP_VOICE.phrases[cue]) {
        const max = cue === 'sommeil' ? 3 : 2.5;
        expect(phraseDuration(p)).toBeLessThanOrEqual(max);
        expect(phraseDuration(p)).toBeGreaterThan(0);
      }
  });

  it('ne répète jamais deux fois de suite la même variante', () => {
    let last = -1;
    let seed = 0.1;
    const rng = (): number => (seed = (seed * 9301 + 0.4927) % 1);
    for (let i = 0; i < 200; i++) {
      const v = pickVariant(3, last, rng);
      expect(v).not.toBe(last);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(3);
      last = v;
    }
    expect(pickVariant(1, 0)).toBe(0);
  });
});

describe('arbitre de voix', () => {
  it('une réplique plus forte coupe la courante, une plus faible est ignorée', () => {
    const g = new VoiceGate();
    expect(g.request('rate', 0, 1)).toBe('play');
    expect(g.request('tir_moyen', 0.2, 0.5)).toBe('drop');
    expect(g.request('gros_coup', 0.3, 1)).toBe('interrupt');
    expect(g.request('rate', 2, 1)).toBe('play');
  });

  it('la victoire passe toujours, même après le cri du ralenti', () => {
    const g = new VoiceGate();
    g.request('final_ralenti', 0, 2.2);
    expect(g.request('victoire', 0.5, 1.5)).toBe('interrupt');
  });

  it('espace les « pip » de cristal et les tait pendant une vraie réplique', () => {
    const g = new VoiceGate();
    expect(g.request('cristal', 0, 0.05)).toBe('play');
    expect(g.request('cristal', 0.05, 0.05)).toBe('drop');
    expect(g.request('cristal', 0.2, 0.05)).toBe('play');
    g.request('presque', 0.3, 1);
    expect(g.request('cristal', 0.6, 0.05)).toBe('drop');
  });

  it("n'enchaîne pas les idles vocaux", () => {
    const g = new VoiceGate();
    expect(g.request('idle_court', 0, 0.5)).toBe('play');
    expect(g.request('idle_long', 1, 0.5)).toBe('drop');
    expect(g.request('idle_long', 5, 0.5)).toBe('play');
  });
});

describe("jauge d'excitation", () => {
  it('monte avec les cristaux, plafonne à 1 et redescend', () => {
    const e = new Excitation();
    for (let i = 0; i < 20; i++) e.hit(0);
    expect(e.get(0)).toBe(1);
    expect(e.get(2)).toBeCloseTo(0.5);
    expect(e.get(10)).toBe(0);
    expect(excitationLevel(0.1)).toBe(0);
    expect(excitationLevel(0.5)).toBe(1);
    expect(excitationLevel(0.9)).toBe(2);
  });
});

describe('musique adaptative', () => {
  it('passe visée -> tir -> tension -> final -> fin', () => {
    let s = INITIAL_MUSIC_STATE;
    expect(layersFor(s)).toEqual([1]);
    s = nextMusicState(s, 'tir_lance');
    expect(layersFor(s)).toEqual([1, 2]);
    s = nextMusicState(s, 'dernier_coeur');
    expect(layersFor(s)).toEqual([1, 2, 3]);
    s = nextMusicState(s, 'fin_tir');
    expect(layersFor(s)).toEqual([1, 3]);
    s = nextMusicState(s, 'final_ralenti');
    expect(layersFor(s)).toEqual([]);
    s = nextMusicState(s, 'victoire');
    expect(layersFor(nextMusicState(s, 'tir_lance'))).toEqual([]);
    expect(layersFor(nextMusicState(s, 'niveau_debut'))).toEqual([1]);
  });

  it('le chapitre 1 boucle sur 8 mesures et chaque couche joue', () => {
    const layers = new Set<number>();
    for (let step = 0; step < 128; step++) {
      expect(CH1_TRACK.eventsAt(step)).toEqual(CH1_TRACK.eventsAt(step + 128));
      for (const e of CH1_TRACK.eventsAt(step)) layers.add(e.layer);
    }
    expect([...layers].sort()).toEqual([1, 2, 3]);
  });

  it('la mélodie et le thème de la Veilleuse restent en ré majeur', () => {
    for (let step = 0; step < 128; step++)
      for (const e of CH1_TRACK.eventsAt(step))
        if (e.instrument === 'melody' || e.instrument === 'bell')
          expect(D_MAJOR.has(pc(e.midi))).toBe(true);
    for (const m of VEILLEUSE_MOTIF) expect(D_PENTA.has(pc(m))).toBe(true);
  });

  it('le thème du phare a une couche boîte à musique et une couche Pip', () => {
    const byLayer = new Map<number, Set<string>>();
    for (let step = 0; step < 64; step++)
      for (const e of PHARE_TRACK.eventsAt(step)) {
        const set = byLayer.get(e.layer) ?? new Set<string>();
        set.add(e.instrument);
        byLayer.set(e.layer, set);
      }
    expect([...(byLayer.get(1) ?? [])]).toEqual(['musicbox']);
    expect([...(byLayer.get(2) ?? [])]).toEqual(['piccolo']);
  });

  it('les jingles sont courts', () => {
    expect(jingleDuration(JINGLES.victoire)).toBeLessThanOrEqual(6);
    expect(jingleDuration(JINGLES.echec)).toBeLessThan(6);
    expect(jingleDuration(JINGLES.orbe_recupere)).toBeLessThan(2);
  });
});
