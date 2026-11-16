import { describe, expect, it } from 'vitest';
import { busGain } from '../src/audio/engine';
import { melodyLength } from '../src/core/audio/chapters';
import { HitDensity, MIX, sliderToGain } from '../src/core/audio/mix';
import {
  DEFI_SPEC,
  DUEL_SPEC,
  MODE_JINGLES,
  MODE_TRACKS,
  dailySpec,
  dailyTrack,
  daySeed,
} from '../src/core/audio/modes';

const pc = (m: number): number => (((m - 62) % 12) + 12) % 12;
const D_MAJOR = new Set([0, 2, 4, 5, 7, 9, 11]);

describe('mixage', () => {
  it('au réglage par défaut, chaque bus retrouve exactement son niveau de mixage', () => {
    for (const bus of ['music', 'sfx', 'voice'] as const)
      expect(busGain(bus, 0.8)).toBeCloseTo(MIX.bus[bus]);
    expect(busGain('music', 0)).toBe(0);
    expect(busGain('music', 1)).toBeGreaterThan(busGain('music', 0.8));
  });

  it('la voix reste sous les effets au réglage par défaut', () => {
    expect(MIX.bus.voice).toBeLessThan(MIX.bus.sfx);
  });

  it('les curseurs suivent une courbe douce', () => {
    expect(sliderToGain(0)).toBe(0);
    expect(sliderToGain(1)).toBe(1);
    expect(sliderToGain(0.5)).toBeCloseTo(0.25);
    expect(sliderToGain(2)).toBe(1);
  });

  it("la voix de l'Astre s'efface quand les rebonds s'enchaînent, puis revient", () => {
    const d = new HitDensity();
    expect(d.voiceFactor(0)).toBe(1);
    for (let i = 0; i < 5; i++) d.hit(i * 0.1);
    expect(d.voiceFactor(0.45)).toBeCloseTo(0.7);
    for (let i = 0; i < 30; i++) d.hit(0.5 + i * 0.01);
    expect(d.voiceFactor(0.8)).toBe(MIX.density.floor);
    expect(d.voiceFactor(5)).toBe(1);
  });
});

describe('musiques des modes', () => {
  it('Défi et Duel : 8 mesures, en ré, 3 couches', () => {
    for (const spec of [DEFI_SPEC, DUEL_SPEC]) {
      expect(melodyLength(spec.melody.notes), spec.id).toBe(128);
      const track = MODE_TRACKS[spec.id];
      const layers = new Set<number>();
      for (let step = 0; step < 128; step++)
        for (const e of track?.eventsAt(step) ?? []) {
          layers.add(e.layer);
          if (e.layer === 2 && e.instrument === spec.melody.instrument)
            expect(D_MAJOR.has(pc(e.midi))).toBe(true);
        }
      expect([...layers].sort()).toEqual([1, 2, 3]);
    }
  });

  it('Constellation du jour : même musique pour tous un jour donné, une autre le lendemain', () => {
    const a = new Date(2026, 10, 16);
    const b = new Date(2026, 10, 17);
    expect(daySeed(a)).toBe(20261116);
    expect(dailySpec(a)).toEqual(dailySpec(new Date(2026, 10, 16, 23, 59)));
    expect(dailyTrack(a).id).toBe('quotidien-2026-11-16');
    const days = Array.from({ length: 14 }, (_, i) => dailySpec(new Date(2026, 10, 1 + i)));
    const variants = new Set(days.map((s) => `${s.title}|${s.arp.instrument}|${s.bpm}`));
    expect(variants.size).toBeGreaterThan(7);
    for (const s of days) {
      expect(s.bpm).toBeGreaterThanOrEqual(56);
      expect(s.bpm).toBeLessThanOrEqual(140);
    }
    expect(dailySpec(b).id).not.toBe(dailySpec(a).id);
  });

  it('les tours du duel sont placés à gauche (joueur 1) et à droite (joueur 2)', () => {
    expect(MODE_JINGLES.duel_tour_j1?.pan).toBeLessThan(0);
    expect(MODE_JINGLES.duel_tour_j2?.pan).toBeGreaterThan(0);
    for (const j of Object.values(MODE_JINGLES)) {
      const end = Math.max(...j.events.map((e) => e.beat + e.beats));
      expect((end * 60) / j.bpm, j.id).toBeLessThan(4);
    }
  });
});
