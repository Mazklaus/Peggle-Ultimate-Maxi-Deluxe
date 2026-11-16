import { describe, expect, it } from 'vitest';
import { hitCrystal, startShot } from '../src/core/level';
import { buildCatalog, byChapter, nextLevelId, parseIndex } from '../src/core/levelCatalog';
import { parseLevel, type LevelData } from '../src/core/levelFormat';
import { levelFromData } from '../src/core/levelSetup';

function seeded(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const base = {
  format: 1,
  chapter: 0,
  index: 1,
  companion: null,
  orbs: 7,
  stars: [100, 200],
  assign: { hearts: 2, power: 1, bonus: 1 },
  pegs: [
    { x: 100, y: 100 },
    { x: 140, y: 100 },
    { x: 180, y: 100 },
    { x: 220, y: 100 },
    { x: 260, y: 100 },
    { x: 300, y: 100, kind: 'wall' },
    { x: 400, y: 300, shape: 'brick', w: 40, h: 12, angle: 30, kind: 'heart' },
  ],
};

describe('levelFromData', () => {
  const level = (parseLevel({ ...base, id: 't-01' }).level as LevelData)!;

  it('respecte assign et les kinds imposés', () => {
    const s = levelFromData(level, seeded());
    const count = (k: string) => s.crystals.filter((c) => c.kind === k).length;
    expect(count('heart')).toBe(3); // 2 tirés + 1 imposé
    expect(count('power')).toBe(1);
    expect(count('bonus')).toBe(1);
    expect(count('wall')).toBe(1);
    expect(count('common')).toBe(1);
    expect(s.heartsTotal).toBe(3);
    expect(s.orbs).toBe(7);
    expect(s.crystals[6]?.shape).toEqual({ type: 'brick', w: 40, h: 12, angle: 30 });
  });

  it('un mur ne s allume jamais', () => {
    const s = levelFromData(level, seeded());
    startShot(s);
    expect(hitCrystal(s, 5)).toBe(0);
    expect(s.crystals[5]?.lit).toBe(false);
  });
});

describe('catalogue', () => {
  it('valide, ordonne et signale les erreurs', () => {
    const { index } = parseIndex({ format: 1, levels: ['a-01', 'b-01', 'c-01', 'a-01'] });
    const cat = buildCatalog(index!, {
      'a-01': { ...base, id: 'a-01' },
      'b-01': { ...base, id: 'b-01', chapter: 1, stars: [5, 1] },
    });
    expect(cat.levels.map((l) => l.id)).toEqual(['a-01']);
    expect(cat.errors.some((e) => e.startsWith('b-01'))).toBe(true);
    expect(cat.errors.some((e) => e.startsWith('c-01'))).toBe(true);
    expect(cat.errors.some((e) => e.includes('deux fois'))).toBe(true);
  });

  it('refuse un index invalide', () => {
    expect(parseIndex({ format: 2, levels: [] }).error).toBeDefined();
    expect(parseIndex({ format: 1, levels: [3] }).error).toBeDefined();
  });

  it('regroupe par chapitre et donne le niveau suivant', () => {
    const mk = (id: string, chapter: number) => ({
      ...(parseLevel({ ...base, id }).level as LevelData),
      chapter,
    });
    const levels = [mk('p-1', 0), mk('p-2', 0), mk('c-1', 1)];
    expect([...byChapter(levels).keys()]).toEqual([0, 1]);
    expect(nextLevelId(levels, 'p-2')).toBe('c-1');
    expect(nextLevelId(levels, 'c-1')).toBeNull();
  });

  it('les niveaux livrés dans public/levels sont valides', () => {
    const all = import.meta.glob('../public/levels/*.json', { eager: true, import: 'default' });
    const read = (f: string) => all[`../public/levels/${f}.json`];
    const { index } = parseIndex(read('index'));
    expect(index).toBeDefined();
    const files = Object.fromEntries(index!.levels.map((id) => [id, read(id)]));
    const cat = buildCatalog(index!, files);
    expect(cat.errors).toEqual([]);
    expect(cat.levels.length).toBe(index!.levels.length);
  });
});
