import { describe, expect, it } from 'vitest';
import { modeUnlocked } from '../src/core/modeMenu';
import { emptySave } from '../src/core/save';

const done = (ids: string[]) => {
  const save = emptySave();
  for (const id of ids)
    save.levels[id] = { completed: true, bestScore: 1, stars: 1, plays: 1, fails: 0 };
  return save;
};
const ch1 = Array.from({ length: 12 }, (_, i) => `ch1-${String(i + 1).padStart(2, '0')}`);

describe('menu des modes : déblocages', () => {
  it('1re partie : seule l’Aventure', () => {
    const s = emptySave();
    expect(modeUnlocked(s, 'aventure')).toBe(true);
    expect(modeUnlocked(s, 'duel')).toBe(false);
    expect(modeUnlocked(s, 'quotidien')).toBe(false);
    expect(modeUnlocked(s, 'defi')).toBe(false);
  });
  it('prologue fini : Du jour et Duel', () => {
    const s = done(['pro-01', 'pro-02', 'pro-03', 'pro-04']);
    expect(modeUnlocked(s, 'quotidien')).toBe(true);
    expect(modeUnlocked(s, 'duel')).toBe(true);
    expect(modeUnlocked(s, 'defi')).toBe(false);
  });
  it('chapitre 1 fini : Défis', () => {
    expect(modeUnlocked(done(['pro-01', 'pro-02', 'pro-03', 'pro-04', ...ch1]), 'defi')).toBe(true);
  });
});
