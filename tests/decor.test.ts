import { describe, expect, it } from 'vitest';
import { isMovingDecor, pegPoseAt, pegTravel, type MovingDecor } from '../src/core/decor';

const roue: MovingDecor = { id: 'roue', type: 'rotate', cx: 440, cy: 330, periodS: 12, dir: 1 };
const lune: MovingDecor = {
  id: 'lune',
  type: 'orbit',
  cx: 220,
  cy: 300,
  rx: 60,
  ry: 40,
  periodS: 4,
  dir: -1,
};

describe('décor animé', () => {
  it('rotation : position de départ à t = 0, quart de tour horaire à periodS / 4', () => {
    expect(pegPoseAt(roue, 540, 330, 0)).toMatchObject({ x: 540, y: 330 });
    const p = pegPoseAt(roue, 540, 330, 3);
    expect(p.x).toBeCloseTo(440);
    expect(p.y).toBeCloseTo(430); // y vers le bas : horaire
    expect(p.angle).toBeCloseTo(Math.PI / 2);
    const back = pegPoseAt({ ...roue, dir: -1 }, 540, 330, 3);
    expect(back.y).toBeCloseTo(230);
  });

  it('orbite : reste sur l’ellipse, revient au départ après un tour', () => {
    const start = { x: 280, y: 300 };
    for (const t of [0.3, 1.1, 2.7]) {
      const p = pegPoseAt(lune, start.x, start.y, t);
      expect(((p.x - 220) / 60) ** 2 + ((p.y - 300) / 40) ** 2).toBeCloseTo(1);
      expect(p.angle).toBe(0);
    }
    const loop = pegPoseAt(lune, start.x, start.y, 4);
    expect(loop.x).toBeCloseTo(start.x);
    expect(loop.y).toBeCloseTo(start.y);
  });

  it('borne le déplacement d’un peg sur une durée', () => {
    expect(pegTravel(roue, 540, 330, 0)).toBe(0);
    // 3 s = quart de tour sur un rayon 100 : corde = 100 √2.
    expect(pegTravel(roue, 540, 330, 3)).toBeCloseTo(100 * Math.SQRT2);
    expect(pegTravel(roue, 540, 330, 60)).toBeCloseTo(200);
  });

  it('reconnaît les éléments qui déplacent leurs pegs', () => {
    expect(isMovingDecor(roue)).toBe(true);
    expect(isMovingDecor({ type: 'magnet' })).toBe(false);
  });
});
