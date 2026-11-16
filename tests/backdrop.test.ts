import { describe, expect, it } from 'vitest';
import { backdropLayers, earnedStars, hasShootingStars, veilleuseGlow } from '../src/core/backdrop';
import { emptySave } from '../src/core/save';

describe('fond de chapitre en jeu', () => {
  it('ch.1 : 4 couches sans motif ; ch.2-8 : 5 couches avec motif à 0.03', () => {
    expect(backdropLayers(1).map((l) => l.parallax)).toEqual([0, 0.02, 0.04, 0.08]);
    const ch2 = backdropLayers(2);
    expect(ch2.map((l) => l.parallax)).toEqual([0, 0.02, 0.03, 0.04, 0.08]);
    expect(ch2[2]?.file).toBe('da/decors/jeu/ch2-3-motif.svg');
    expect(ch2.map((l) => l.drift)).toEqual([0, 0, 0, 6, 12]);
    expect(backdropLayers(5)[2]?.drift).toBeGreaterThan(0); // brume
  });

  it('le prologue reprend le ciel du chapitre 1', () => {
    expect(backdropLayers(0)).toEqual(backdropLayers(1));
  });

  it('la Veilleuse grossit de 132 à 168 px, de 0.36 à 0.54', () => {
    expect(veilleuseGlow(2)).toMatchObject({ r: 132, alpha: 0.36 });
    expect(veilleuseGlow(8).r).toBeCloseTo(168, 6);
    expect(veilleuseGlow(8).alpha).toBeCloseTo(0.54, 6);
  });

  it('étoiles filantes aux ch.4 et ch.7 seulement', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].filter(hasShootingStars)).toEqual([4, 7]);
  });

  it('étoiles gagnées : niveaux finis du chapitre + celui gagné', () => {
    const save = emptySave();
    save.levels['ch2-01'] = { completed: true, bestScore: 1, stars: 1, plays: 1, fails: 0 };
    expect(earnedStars(save, 'ch2-03')).toEqual({ indices: [0, 2], complete: false });
    expect(earnedStars(save, 'pro-02').indices).toEqual([]);
    const last = earnedStars(save, 'ch2-12');
    expect(last.complete).toBe(true);
    expect(last.indices).toHaveLength(12);
  });
});
