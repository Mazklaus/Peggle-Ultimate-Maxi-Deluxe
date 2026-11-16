import { describe, expect, it } from 'vitest';
import { parseLevel, type DecorItem, type LevelPeg } from '../src/core/levelFormat';
import {
  animatedPosition,
  handleAt,
  moveHandle,
  newDecor,
  nextDecorId,
  removeDecor,
  renameDecor,
  snapOrbitMembers,
  snapToOrbit,
} from '../src/editor/decor';
import { emptyLevel } from '../src/editor/model';

describe('éditeur : décor', () => {
  it('crée des éléments valides avec des id libres', () => {
    const decor: DecorItem[] = [];
    for (const type of ['rotate', 'orbit', 'magnet', 'portal', 'regen'] as const)
      decor.push(newDecor(type, nextDecorId(decor, type), { x: 440, y: 330 }));
    expect(nextDecorId(decor, 'rotate')).toBe('rotate-2');
    const level = { ...emptyLevel(), format: 2 as const, decor };
    level.assign = { hearts: 1, power: 0, bonus: 0 };
    level.pegs = [
      { x: 100, y: 200 },
      { x: 440, y: 270, group: 'rotate-1' },
      { x: 500, y: 330, group: 'orbit-1' },
    ];
    expect(parseLevel(level).errors).toBeUndefined();
  });

  it('déplace un centre avec les pegs de son groupe', () => {
    const d = newDecor('rotate', 'r', { x: 100, y: 100 });
    const pegs: LevelPeg[] = [
      { x: 120, y: 100, group: 'r' },
      { x: 300, y: 300 },
    ];
    expect(handleAt([d], 105, 98)).toEqual({ index: 0, key: 'c' });
    moveHandle(d, 'c', { x: 150, y: 120 }, pegs);
    expect(pegs).toEqual([
      { x: 170, y: 120, group: 'r' },
      { x: 300, y: 300 },
    ]);
  });

  it('recolle les pegs sur l’anneau d’une orbite', () => {
    const o = newDecor('orbit', 'o', { x: 0, y: 0 });
    if (o.type !== 'orbit') throw new Error();
    expect(snapToOrbit(o, 200, 0)).toEqual({ x: 60, y: 0 });
    const pegs: LevelPeg[] = [{ x: 0, y: 60, group: 'o' }];
    o.ry = 40;
    snapOrbitMembers(o, pegs);
    expect(pegs[0]).toMatchObject({ x: 0, y: 40 });
  });

  it('renomme et supprime en gardant les pegs cohérents', () => {
    const decor = [newDecor('regen', 'g', { x: 0, y: 0 })];
    const pegs: LevelPeg[] = [{ x: 1, y: 1, group: 'g' }];
    renameDecor(decor[0]!, 'regen-a', pegs);
    expect(pegs[0]?.group).toBe('regen-a');
    removeDecor(decor, 0, pegs);
    expect(decor).toHaveLength(0);
    expect(pegs[0]).not.toHaveProperty('group');
  });

  it('anime rotation et orbite pour l’aperçu', () => {
    const r = newDecor('rotate', 'r', { x: 0, y: 0 });
    if (r.type !== 'rotate') throw new Error();
    const p = animatedPosition({ x: 10, y: 0 }, r, r.periodS / 4);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(10);
    expect(animatedPosition({ x: 5, y: 5 }, undefined, 3)).toEqual({ x: 5, y: 5 });
  });
});
