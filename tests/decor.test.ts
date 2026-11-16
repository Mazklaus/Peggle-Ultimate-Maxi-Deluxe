import { describe, expect, it } from 'vitest';
import {
  isMovingDecor,
  MAGNET,
  magnetAccel,
  pegPoseAt,
  pegTravel,
  PORTAL,
  portalStep,
  type MovingDecor,
} from '../src/core/decor';

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

describe('aimants', () => {
  const m = { id: 'a', type: 'magnet' as const, x: 0, y: 0, radius: 110, strength: 1 };
  it('attire vers le centre, plus fort de près', () => {
    const near = magnetAccel([m], 30, 0);
    const far = magnetAccel([m], 100, 0);
    expect(near.ax).toBeLessThan(0);
    expect(Math.abs(near.ax)).toBeGreaterThan(Math.abs(far.ax));
    expect(near.ay).toBeCloseTo(0, 6);
  });
  it('rien dans la zone morte ni hors du rayon', () => {
    expect(magnetAccel([m], 10, 0)).toEqual({ ax: 0, ay: 0 });
    expect(magnetAccel([m], 0, 120)).toEqual({ ax: 0, ay: 0 });
  });
  it('strength multiplie la force', () => {
    const a1 = magnetAccel([m], 50, 0).ax;
    const a2 = magnetAccel([{ ...m, strength: 2 }], 50, 0).ax;
    expect(a2).toBeCloseTo(2 * a1, 6);
    expect(Math.abs(a1)).toBeLessThanOrEqual(MAGNET.accel);
  });
});

describe('portails', () => {
  const p = { id: 'p1', type: 'portal' as const, a: { x: 100, y: 500 }, b: { x: 700, y: 200 } };
  it("l'orbe qui entre en A ressort en B, au même décalage", () => {
    const r = portalStep([p], 105, 497, null);
    expect(r.to).toEqual({ x: 705, y: 197 });
    expect(r.inside).toBe('p1:b');
  });
  it('pas de retour tant que l’orbe n’est pas sortie de la bouche d’arrivée', () => {
    expect(portalStep([p], 705, 197, 'p1:b').to).toBeNull();
    expect(portalStep([p], 760, 197, 'p1:b').inside).toBeNull();
    expect(portalStep([p], 701, 199, null).to).toEqual({ x: 101, y: 499 });
  });
  it('délai de réentrée : rien ne passe tant que ready est faux', () => {
    const r = portalStep([p], 100, 500, null, false);
    expect(r.to).toBeNull();
    expect(r.inside).toBe('p1:a');
  });
  it('hors des bouches, rien', () => {
    expect(portalStep([p], 300, 300, null)).toEqual({ to: null, inside: null });
    expect(PORTAL.r).toBe(18);
  });
});
