import { describe, expect, it } from 'vitest';
import { staggeredGrid } from '../src/core/layout';
import {
  breakLitNow,
  chainBonus,
  createLevel,
  endShot,
  heartsRemaining,
  hitCrystal,
  isFinalHeartLit,
  multiplier,
  startShot,
  type LevelState,
} from '../src/core/level';
import { TUNING } from '../src/core/tuning';

/** Générateur pseudo-aléatoire déterministe. */
function seeded(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function newLevel(): LevelState {
  return createLevel(staggeredGrid(9, 9, 80, 160, 80, 40), seeded());
}

const idsOf = (s: LevelState, kind: string) =>
  s.crystals.filter((c) => c.kind === kind).map((c) => c.id);

describe('createLevel', () => {
  it('répartit les familles selon les réglages', () => {
    const s = newLevel();
    expect(s.crystals).toHaveLength(81);
    expect(idsOf(s, 'heart')).toHaveLength(TUNING.heartCrystals);
    expect(idsOf(s, 'bonus')).toHaveLength(TUNING.bonusCrystals);
    expect(idsOf(s, 'common')).toHaveLength(TUNING.commonCrystals);
    expect(s.orbs).toBe(TUNING.startingOrbs);
    expect(s.phase).toBe('aiming');
  });
});

describe('tir', () => {
  it('consomme un orbe et refuse un second tir pendant le vol', () => {
    const s = newLevel();
    expect(startShot(s)).toBe(true);
    expect(s.orbs).toBe(9);
    expect(startShot(s)).toBe(false);
  });

  it('allume un cristal une seule fois et ne le retire qu’en fin de tir', () => {
    const s = newLevel();
    startShot(s);
    const id = idsOf(s, 'common')[0] as number;
    expect(hitCrystal(s, id)).toBe(10);
    expect(hitCrystal(s, id)).toBe(0);
    expect(s.crystals.some((c) => c.id === id)).toBe(true);
    const r = endShot(s, false, seeded());
    expect(r.removedIds).toEqual([id]);
    expect(s.crystals.some((c) => c.id === id)).toBe(false);
  });

  it('rend un orbe quand le réceptacle attrape l’orbe', () => {
    const s = newLevel();
    startShot(s);
    const r = endShot(s, true, seeded());
    expect(r.orbsGained).toBe(1);
    expect(s.orbs).toBe(10);
  });

  it('orbe scindé : chaque orbe attrapé rend un orbe', () => {
    const s = newLevel();
    startShot(s);
    const r = endShot(s, 2, seeded());
    expect(r.orbsGained).toBe(2);
    expect(r.caught).toBe(true);
    expect(s.orbs).toBe(11);
  });

  it('déplace le cristal bonus après chaque tir', () => {
    const s = newLevel();
    const before = idsOf(s, 'bonus');
    const seen = new Set<number>();
    for (let i = 0; i < 5; i++) {
      startShot(s);
      endShot(s, true, seeded(i + 2));
      expect(idsOf(s, 'bonus')).toHaveLength(1);
      seen.add(idsOf(s, 'bonus')[0] as number);
    }
    expect([...seen].some((id) => !before.includes(id))).toBe(true);
  });
});

describe('score', () => {
  it('monte le multiplicateur avec la part de cœurs touchés', () => {
    const s = newLevel();
    startShot(s);
    expect(multiplier(s)).toBe(1);
    const hearts = idsOf(s, 'heart');
    hearts.slice(0, 5).forEach((id) => hitCrystal(s, id)); // 25 %
    expect(multiplier(s)).toBe(2);
    hearts.slice(5, 18).forEach((id) => hitCrystal(s, id)); // 90 %
    expect(multiplier(s)).toBe(10);
  });

  it('donne au plus un orbe gratuit par tir au-delà du palier', () => {
    const s = createLevel(staggeredGrid(9, 9, 80, 160, 80, 40), seeded(), {
      ...TUNING,
      freeOrbShotScore: 15,
    });
    startShot(s);
    const [a, b, c] = idsOf(s, 'common') as [number, number, number];
    hitCrystal(s, a);
    hitCrystal(s, b);
    hitCrystal(s, c);
    expect(s.orbs).toBe(10);
  });
});

describe('victoire et échec', () => {
  it('gagne quand tous les cœurs sont brisés', () => {
    const s = newLevel();
    startShot(s);
    for (const id of idsOf(s, 'heart')) hitCrystal(s, id);
    expect(isFinalHeartLit(s)).toBe(true);
    expect(endShot(s, false, seeded()).phase).toBe('won');
    expect(heartsRemaining(s)).toBe(0);
  });

  it('perd quand le stock d’orbes est vide avec des cœurs restants', () => {
    const s = newLevel();
    for (let i = 0; i < TUNING.startingOrbs; i++) {
      startShot(s);
      endShot(s, false, seeded());
    }
    expect(s.phase).toBe('lost');
    expect(startShot(s)).toBe(false);
  });

  it('anti-blocage : brise tout de suite les cristaux allumés désignés', () => {
    const s = newLevel();
    startShot(s);
    const [lit, unlit] = idsOf(s, 'common') as [number, number];
    hitCrystal(s, lit);
    expect(breakLitNow(s, [lit, unlit])).toEqual([lit]);
    expect(s.crystals.some((c) => c.id === unlit)).toBe(true);
  });
});

describe('bonus de chaîne et réglages GD', () => {
  it('+10 % par rebond au-delà de 10, au plus +100 %', () => {
    expect(chainBonus(1000, 10)).toBe(0);
    expect(chainBonus(1000, 13)).toBe(300);
    expect(chainBonus(1000, 40)).toBe(1000);
  });

  it('orbe restant 1 000, pouvoir 50, orbe gratuit à 5 000', () => {
    expect(TUNING.orbBonus).toBe(1000);
    expect(TUNING.points.power).toBe(50);
    expect(TUNING.freeOrbShotScore).toBe(5000);
  });
});

describe('régénération (décor v2)', () => {
  function regenLevel(): LevelState {
    const s = newLevel();
    s.regen.groups.r1 = 2;
    const c = s.crystals.find((k) => k.kind === 'common')!;
    c.group = 'r1';
    return s;
  }

  it('un cristal du groupe brisé revient 2 tirs plus tard, commun et éteint', () => {
    const s = regenLevel();
    const c = s.crystals.find((k) => k.group === 'r1')!;
    startShot(s);
    hitCrystal(s, c.id);
    endShot(s, false, seeded());
    expect(s.crystals.some((k) => k.id === c.id)).toBe(false);
    expect(s.regen.pending[0]?.left).toBe(2);
    startShot(s);
    const r1 = endShot(s, false, seeded());
    expect(r1.restored).toHaveLength(0);
    expect(s.regen.pending[0]?.left).toBe(1); // clignote
    startShot(s);
    const r2 = endShot(s, false, seeded());
    expect(r2.restored.map((k) => k.id)).toEqual([c.id]);
    const back = s.crystals.find((k) => k.id === c.id)!;
    expect(back.lit).toBe(false);
    expect(back.kind).toBe('common');
  });

  it('le bonus ne se pose jamais sur un régénérant', () => {
    const s = regenLevel();
    const c = s.crystals.find((k) => k.group === 'r1')!;
    for (let i = 0; i < 30; i++) {
      startShot(s);
      endShot(s, true, seeded(i + 3));
      expect(c.kind).toBe('common');
    }
  });

  it('anti-blocage : un régénérant brisé sur place part aussi en attente', () => {
    const s = regenLevel();
    const c = s.crystals.find((k) => k.group === 'r1')!;
    startShot(s);
    hitCrystal(s, c.id);
    breakLitNow(s, [c.id]);
    expect(s.regen.pending).toHaveLength(1);
  });
});
