import { describe, expect, it } from 'vitest';
import {
  emptySave,
  failsBeforeFirstWin,
  isUnlocked,
  loadSave,
  markSeen,
  recordResult,
  SAVE_KEY,
  writeSave,
  type KeyValueStorage,
} from '../src/core/save';
import { starsFor } from '../src/core/stars';

function memory(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('save', () => {
  it('renvoie une sauvegarde vide si rien ou illisible', () => {
    const s = memory();
    expect(loadSave(s)).toEqual(emptySave());
    s.setItem(SAVE_KEY, '{pas du json');
    expect(loadSave(s)).toEqual(emptySave());
    expect(loadSave(null)).toEqual(emptySave());
  });

  it('écrit puis relit', () => {
    const s = memory();
    const save = emptySave();
    save.options.colorblind = true;
    recordResult(save, { id: 'pro-01', score: 1200, stars: 2, won: true, orbsLeft: 3 });
    writeSave(save, s);
    const back = loadSave(s);
    expect(back.options.colorblind).toBe(true);
    expect(back.levels['pro-01']?.completed).toBe(true);
    expect(back.scoreLog).toHaveLength(1);
  });

  it('ne casse pas si le stockage refuse', () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('interdit');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(() => writeSave(emptySave(), broken)).not.toThrow();
    expect(loadSave(broken)).toEqual(emptySave());
  });

  it('garde le meilleur score et les meilleures étoiles, compte les échecs', () => {
    const save = emptySave();
    recordResult(save, { id: 'a', score: 500, stars: 0, won: false, orbsLeft: 0 });
    recordResult(save, { id: 'a', score: 900, stars: 0, won: false, orbsLeft: 0 });
    expect(failsBeforeFirstWin(save, 'a')).toBe(2);
    recordResult(save, { id: 'a', score: 3000, stars: 3, won: true, orbsLeft: 2 });
    recordResult(save, { id: 'a', score: 2000, stars: 2, won: true, orbsLeft: 1 });
    expect(save.levels.a).toEqual({
      completed: true,
      bestScore: 3000,
      stars: 3,
      plays: 4,
      fails: 2,
    });
    expect(failsBeforeFirstWin(save, 'a')).toBe(0);
  });

  it('débloque un niveau quand le précédent est fini', () => {
    const order = ['pro-01', 'pro-02', 'pro-03'];
    const save = emptySave();
    expect(isUnlocked(order, 'pro-01', save)).toBe(true);
    expect(isUnlocked(order, 'pro-02', save)).toBe(false);
    recordResult(save, { id: 'pro-01', score: 1, stars: 1, won: true, orbsLeft: 0 });
    expect(isUnlocked(order, 'pro-02', save)).toBe(true);
    expect(isUnlocked(order, 'inconnu', save)).toBe(false);
  });
});

describe('starsFor', () => {
  it('0 si perdu, puis 1 à 3 selon les seuils', () => {
    expect(starsFor(99999, [100, 200], false)).toBe(0);
    expect(starsFor(50, [100, 200], true)).toBe(1);
    expect(starsFor(100, [100, 200], true)).toBe(2);
    expect(starsFor(200, [100, 200], true)).toBe(3);
  });
});

describe('cinématiques vues (seen)', () => {
  it('une sauvegarde sans champ seen se charge avec seen = {}', () => {
    const old = { version: 1, levels: {}, options: {}, scoreLog: [] };
    const storage = { getItem: () => JSON.stringify(old), setItem: () => undefined };
    expect(loadSave(storage).seen).toEqual({});
  });

  it('markSeen ne renvoie true que la première fois et survit à la sauvegarde', () => {
    const save = emptySave();
    expect(markSeen(save, 'intro')).toBe(true);
    expect(markSeen(save, 'intro')).toBe(false);
    let stored = '';
    writeSave(save, { getItem: () => null, setItem: (_k, v) => (stored = v) });
    expect(loadSave({ getItem: () => stored, setItem: () => undefined }).seen.intro).toBe(true);
  });
});
