import { describe, expect, it } from 'vitest';
import { hitCrystal, startShot } from '../src/core/level';
import {
  allLevelIds,
  buildCatalog,
  byChapter,
  nextLevelId,
  parseExtraIndexes,
  parseIndex,
} from '../src/core/levelCatalog';
import { parseLevel, serializeLevel, type LevelData } from '../src/core/levelFormat';
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

describe('levelFromData : régénération', () => {
  const level = (parseLevel({ ...base, id: 't-02' }).level as LevelData)!;
  const withRegen: LevelData = {
    ...level,
    decor: [{ id: 'r1', type: 'regen', shots: 2 }],
    pegs: level.pegs.map((p, i) => (i < 4 ? { ...p, group: 'r1' } : p)),
  };

  it('les pegs d un groupe de régénération restent communs (jamais cœur ni pouvoir)', () => {
    for (let seed = 1; seed < 20; seed++) {
      const s = levelFromData(withRegen, seeded(seed));
      for (let i = 0; i < 4; i++) expect(s.crystals[i]?.kind).toBe('common');
      expect(s.regen.groups).toEqual({ r1: 2 });
    }
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

  it('les niveaux livrés dans public/levels sont valides (aventure, défis, duel)', () => {
    const all = import.meta.glob('../public/levels/*.json', { eager: true, import: 'default' });
    const read = (f: string) => all[`../public/levels/${f}.json`];
    const { index } = parseIndex(read('index'));
    expect(index).toBeDefined();
    // challenges.json et duel.json sont facultatifs tant qu'ils ne sont pas livrés.
    const extra = parseExtraIndexes({ challenges: read('challenges'), duel: read('duel') });
    expect(extra.errors).toEqual([]);
    const files = Object.fromEntries(allLevelIds(index, extra.extras).map((id) => [id, read(id)]));
    const cat = buildCatalog(index!, files, extra.extras);
    expect(cat.errors).toEqual([]);
    expect(cat.levels.length).toBe(index!.levels.length);
    expect(cat.challenges.length).toBe(extra.extras.challenges?.length ?? 0);
    expect(cat.duel.length).toBe(extra.extras.duel?.length ?? 0);
    for (const l of cat.challenges) expect(l.challenge).toBeDefined();
    for (const l of cat.duel) expect(l.rhythm).toBe('duel');
  });
});

describe('catalogue : défis et duel', () => {
  const def = (id: string, challenge: unknown) => ({ ...base, id, challenge });

  it('lit challenges.json et duel.json, absents = listes vides sans erreur', () => {
    expect(parseExtraIndexes({})).toEqual({ extras: {}, errors: [] });
    const ok = parseExtraIndexes({
      challenges: { format: 1, challenges: ['def-1-1'] },
      duel: { format: 1, duel: ['duel-01'] },
    });
    expect(ok).toEqual({ extras: { challenges: ['def-1-1'], duel: ['duel-01'] }, errors: [] });
    const bad = parseExtraIndexes({ challenges: { format: 2 }, duel: { format: 1, levels: [] } });
    expect(bad.errors).toHaveLength(2);
    expect(bad.errors[0]).toContain('challenges.json');
    expect(bad.errors[1]).toContain('duel.json');
  });

  it('construit les trois listes et signale les doublons entre index', () => {
    const { index } = parseIndex({ format: 1, levels: ['a-01'] });
    const extras = { challenges: ['def-1-1', 'a-01'], duel: ['duel-01', 'duel-01'] };
    expect(allLevelIds(index, extras)).toEqual(['a-01', 'def-1-1', 'duel-01']);
    const cat = buildCatalog(
      index!,
      {
        'a-01': { ...base, id: 'a-01' },
        'def-1-1': def('def-1-1', { goal: 'score', value: 5000 }),
        'duel-01': { ...base, id: 'duel-01', rhythm: 'duel', orbs: 10 },
      },
      extras,
    );
    expect(cat.levels.map((l) => l.id)).toEqual(['a-01']);
    expect(cat.challenges.map((l) => l.id)).toEqual(['def-1-1', 'a-01']);
    expect(cat.duel.map((l) => l.id)).toEqual(['duel-01']);
    expect(cat.errors).toEqual([
      'duel-01 : listé deux fois dans duel.json.',
      'a-01 : listé dans index.json et dans challenges.json.',
    ]);
  });

  it('challenge dans parseLevel : astre connu et seulement avec astre_impose', () => {
    const errs = (c: unknown) => parseLevel(def('d', c)).errors ?? [];
    expect(errs({ goal: 'nettoyage' })).toEqual([]);
    expect(errs({ goal: 'chaine', value: 18 })).toEqual([]);
    expect(errs({ goal: 'chaine' })).not.toEqual([]); // valeur obligatoire (GD)
    expect(errs({ goal: 'pouvoir', value: 3, constraint: 'astre_impose', astre: 'pip' })).toEqual(
      [],
    );
    expect(errs({ goal: 'score', value: 1, astre: 'pip' })[0]).toContain('astre_impose');
    expect(
      errs({ goal: 'score', value: 1, constraint: 'astre_impose', astre: 'zorg' })[0],
    ).toContain('inconnu');
  });

  it('défi : aller-retour canonique ; rythme duel', () => {
    const lvl = parseLevel(
      def('def-2-1', { goal: 'pouvoir', value: 4, constraint: 'astre_impose', astre: 'pip' }),
    ).level!;
    const text = serializeLevel(lvl);
    expect(serializeLevel(parseLevel(text).level!)).toBe(text);
    expect(parseLevel(text).level!.challenge).toEqual(lvl.challenge);
    expect(parseLevel({ ...base, id: 'duel-01', rhythm: 'duel' }).errors).toBeUndefined();
  });
});
