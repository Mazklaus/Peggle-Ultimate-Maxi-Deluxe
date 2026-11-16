import { describe, expect, it } from 'vitest';
import {
  levelFormatOf,
  orbitPosition,
  parseLevel,
  serializeLevel,
  type DecorOrbit,
  type LevelData,
} from '../src/core/levelFormat';

const base = {
  format: 2,
  id: 'ch2-01',
  chapter: 2,
  index: 1,
  companion: 'bourdon',
  orbs: 10,
  stars: [12000, 30000],
  assign: { hearts: 1, power: 0, bonus: 0 },
};

const sample = {
  ...base,
  pegs: [
    { x: 100, y: 200 },
    { x: 440, y: 260, kind: 'common', group: 'roue' },
    { x: 510, y: 330, group: 'roue' },
    { x: 280, y: 300, kind: 'common', group: 'lune' },
    { x: 700, y: 400, kind: 'power', group: 'regen1' },
  ],
  decor: [
    { id: 'roue', type: 'rotate', cx: 440, cy: 330, periodS: 8, dir: 1 },
    { id: 'lune', type: 'orbit', cx: 220, cy: 300, rx: 60, ry: 60, periodS: 4, dir: -1 },
    { id: 'aim1', type: 'magnet', x: 440, y: 380, radius: 110, strength: 1 },
    { id: 'p1', type: 'portal', a: { x: 120, y: 520 }, b: { x: 760, y: 160 } },
    { id: 'regen1', type: 'regen', shots: 2 },
  ],
};

function errorsOf(patch: Record<string, unknown>): string {
  return (parseLevel({ ...sample, ...patch }).errors ?? []).join(' | ');
}

describe('format de niveau v2 : décor', () => {
  it("accepte l'exemple du Level Designer et garde les groupes", () => {
    const r = parseLevel(sample);
    expect(r.errors).toBeUndefined();
    expect(r.level?.format).toBe(2);
    expect(r.level?.decor).toHaveLength(5);
    expect(r.level?.pegs[1]?.group).toBe('roue');
  });

  it('aller-retour sans perte, en format 2, un élément par ligne', () => {
    const level = parseLevel(sample).level as LevelData;
    const text = serializeLevel(level);
    expect(text).toContain('"format": 2');
    expect(text).toContain('\n    {"x": 440, "y": 260, "kind": "common", "group": "roue"},\n');
    expect(text).toContain(
      '\n    {"id": "roue", "type": "rotate", "cx": 440, "cy": 330, "periodS": 8, "dir": 1},\n',
    );
    expect(parseLevel(text).level).toEqual(level);
    expect(serializeLevel(parseLevel(text).level as LevelData)).toBe(text);
  });

  it("n'écrit format 2 que si nécessaire", () => {
    const plain = parseLevel({ ...base, pegs: [{ x: 100, y: 200 }], decor: [] }).level as LevelData;
    expect(plain.format).toBe(2);
    expect(levelFormatOf(plain)).toBe(1);
    expect(serializeLevel(plain)).toContain('"format": 1');
    const grouped = { pegs: [{ x: 1, y: 1, group: 'g' }], decor: [] };
    expect(levelFormatOf(grouped)).toBe(2);
  });

  it('refuse le décor ou les groupes en format 1', () => {
    expect(errorsOf({ format: 1 })).toContain('"format": 2');
    expect(
      errorsOf({ format: 1, decor: [], pegs: [{ x: 100, y: 200, kind: 'heart', group: 'x' }] }),
    ).toContain('"format": 2');
  });

  it('refuse un format inconnu', () => {
    expect(errorsOf({ format: 3 })).toContain('format 3');
  });

  it('vérifie les groupes', () => {
    expect(errorsOf({ pegs: [...sample.pegs, { x: 800, y: 500, group: 'zz' }] })).toContain(
      'group « zz » inconnu',
    );
    expect(errorsOf({ decor: [...sample.decor, sample.decor[0]] })).toContain('en double');
    expect(errorsOf({ pegs: [...sample.pegs, { x: 800, y: 500, group: 'aim1' }] })).toContain(
      'ne prend pas de peg',
    );
    expect(
      errorsOf({ pegs: [...sample.pegs, { x: 800, y: 500, kind: 'heart', group: 'regen1' }] }),
    ).toContain('cœur');
  });

  it('valide les champs et les bornes de chaque type', () => {
    const with1 = (d: Record<string, unknown>) =>
      errorsOf({ decor: [...sample.decor.slice(0, 2), d, sample.decor[4]], pegs: sample.pegs });
    expect(with1({ id: 'm', type: 'magnet', x: 1, y: 1, radius: 110 })).toContain('strength');
    expect(with1({ id: 'r2', type: 'rotate', cx: 1, cy: 1, periodS: 30 })).toContain('periodS');
    expect(with1({ id: 'r4', type: 'rotate', cx: 1, cy: 1, periodS: 6 })).toContain('8 et 18');
    expect(with1({ id: 'r3', type: 'rotate', cx: 1, cy: 1, periodS: 8, dir: 2 })).toContain('dir');
    expect(with1({ id: 'p', type: 'portal', a: { x: 0, y: 0 }, b: { x: 400, y: 300 } })).toContain(
      'hors zone',
    );
    expect(with1({ id: 'z', type: 'spin' })).toContain('type inconnu');
    expect(with1({ id: 'g', type: 'regen', shots: 0 })).toContain('shots');
  });

  it('garde les pegs d’un rotate dans la zone sur tout le tour', () => {
    const decor = [{ id: 'roue', type: 'rotate', cx: 440, cy: 330, periodS: 8, dir: 1 }];
    const ok = {
      decor,
      pegs: [
        { x: 100, y: 200 },
        { x: 440, y: 100, group: 'roue' },
      ],
    };
    expect(errorsOf(ok)).toBe('');
    const out = {
      decor,
      pegs: [
        { x: 100, y: 200 },
        { x: 440, y: 90, group: 'roue' },
      ],
    };
    expect(errorsOf({ ...out, decor: [{ ...decor[0], cx: 100 }] })).toContain('sort de la zone');
  });

  it('orbit : 1 à 4 pegs, sur l’anneau, écartés sur tout le tour', () => {
    const orbit = { id: 'o', type: 'orbit', cx: 440, cy: 300, rx: 90, ry: 40, periodS: 4, dir: 1 };
    const on = (deg: number, extra = {}) => ({
      x: Math.round(440 + 90 * Math.cos((deg * Math.PI) / 180)),
      y: Math.round(300 + 40 * Math.sin((deg * Math.PI) / 180)),
      kind: 'common',
      group: 'o',
      ...extra,
    });
    const level = (pegs: unknown[]) =>
      errorsOf({ decor: [orbit], pegs: [{ x: 100, y: 200 }, ...pegs] });
    expect(level([on(0), on(180)])).toBe('');
    expect(level([])).toContain('1 à 4 pegs');
    expect(level([on(0), on(72), on(144), on(216), on(288)])).toContain('1 à 4 pegs');
    expect(level([{ x: 440, y: 300, group: 'o' }])).toContain("pas sur l'anneau");
    // 35° d'écart : jamais sous 22 px. 30° d'écart : loin au départ (65°/95°), mais ~21 px
    // quand les deux pegs passent au bout du grand axe.
    expect(level([on(0), on(35)])).toBe('');
    expect(level([on(65), on(95)])).toContain('se rapprochent');
  });

  it('calcule la position sur l’orbite', () => {
    const o: DecorOrbit = {
      id: 'o',
      type: 'orbit',
      cx: 0,
      cy: 0,
      rx: 50,
      ry: 50,
      periodS: 4,
      dir: 1,
    };
    const p = orbitPosition(o, { x: 50, y: 0 }, 0.25);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(50);
  });
});
