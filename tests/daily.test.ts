import { describe, expect, it } from 'vitest';
import {
  DAILY,
  generateDaily,
  hashSeed,
  localDateKey,
  mulberry32,
  TEMPLATE_NAMES,
} from '../src/core/daily';
import { parseLevel } from '../src/core/levelFormat';

function keys(n: number): string[] {
  const d = new Date(2026, 10, 16);
  return Array.from({ length: n }, () => {
    const k = localDateKey(d);
    d.setDate(d.getDate() + 1);
    return k;
  });
}

describe('Constellation du jour', () => {
  it('clé = date locale AAAAMMJJ', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('20260105');
    expect(localDateKey(new Date(2026, 0, 6, 0, 0))).toBe('20260106');
  });

  it('PRNG et hachage déterministes', () => {
    expect(hashSeed('20261116')).toBe(hashSeed('20261116'));
    expect(hashSeed('20261116')).not.toBe(hashSeed('20261117'));
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('même date = exactement le même JSON (empreinte figée)', () => {
    const one = generateDaily('20261116');
    const two = generateDaily('20261116');
    expect(two.json).toBe(one.json);
    // Empreinte de référence : si elle change, tous les joueurs du jour changent de niveau.
    expect({ seed: one.seed, hash: hashSeed(one.json) }).toMatchSnapshot();
  });

  it('un an de niveaux, tous valides et conformes à la composition', () => {
    const templates = new Set<string>();
    for (const key of keys(366)) {
      const { level, json } = generateDaily(key);
      expect(parseLevel(json).errors, key).toBeUndefined();
      const pegs = level.pegs.filter((p) => p.kind !== 'wall');
      expect(pegs, key).toHaveLength(DAILY.hearts + DAILY.commons + DAILY.bonus + DAILY.power);
      expect(level.assign).toEqual({ hearts: 20, power: 2, bonus: 1 });
      expect(level.orbs).toBe(12);
      expect(level.companionLocked).toBe(true);
      expect(level.decor.length).toBeLessThanOrEqual(1);
      for (const [x, y] of DAILY.guards)
        expect(
          level.pegs.some((p) => p.x === x && p.y === y && p.kind === 'common'),
          key,
        ).toBe(true);
      expect(
        level.pegs.some((p) => p.x === 440 && p.y === 150),
        key,
      ).toBe(true);
      for (const p of level.pegs) {
        expect(p.x >= 20 && p.x <= 860 && p.y >= 100 && p.y <= 570, `${key} ${p.x},${p.y}`).toBe(
          true,
        );
        if (p.shape === 'brick') {
          const a = (((p.angle ?? 0) % 90) + 90) % 90;
          expect(Math.min(a, 90 - a)).toBeGreaterThanOrEqual(8);
        }
      }
      templates.add((level.title ?? '').replace(/.*\((.*)\)/, '$1'));
    }
    expect([...templates].sort()).toEqual([...TEMPLATE_NAMES].sort());
  });

  it('refuse une clé mal formée', () => {
    expect(() => generateDaily('2026-11-16')).toThrow();
  });
});
