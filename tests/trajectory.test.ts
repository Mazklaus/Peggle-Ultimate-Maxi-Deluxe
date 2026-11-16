import { describe, expect, it } from 'vitest';
import { aimGuide, closestPoint, predictPath, robustContactStep } from '../src/core/trajectory';

const base = { x: 400, y: 40, gravity: 0.28, radius: 8, minX: 0, maxX: 800, maxY: 600 };

describe('aimGuide', () => {
  it('s’arrête au premier cristal rencontré', () => {
    const pts = aimGuide({ ...base, vx: 0, vy: 5, obstacles: [{ x: 400, y: 200, r: 10 }] });
    const last = pts[pts.length - 1]!;
    expect(Math.hypot(last.x - 400, last.y - 200)).toBeLessThanOrEqual(18);
  });

  it('s’arrête sur un mur', () => {
    const pts = aimGuide({ ...base, vx: 10, vy: 0, obstacles: [] });
    expect(pts[pts.length - 1]!.x).toBeGreaterThanOrEqual(792);
  });

  it('courbe la trajectoire sous la gravité', () => {
    const pts = aimGuide({ ...base, vx: 3, vy: 0, obstacles: [], maxSteps: 10 });
    expect(pts[10]!.y).toBeGreaterThan(pts[5]!.y);
  });
});

describe('predictPath : cible et murs', () => {
  const input = { ...base, restitution: 0.75, maxBounces: 9, maxSteps: 120 };

  it('donne le pas de contact avec la cible, ou null si elle est évitée', () => {
    const hit = predictPath({
      ...input,
      vx: 0,
      vy: 2,
      obstacles: [],
      target: { x: 400, y: 200, r: 10 },
    });
    expect(hit.contactStep).not.toBeNull();
    const miss = predictPath({
      ...input,
      vx: 0,
      vy: 2,
      obstacles: [],
      target: { x: 600, y: 200, r: 10 },
    });
    expect(miss.contactStep).toBeNull();
  });

  it('un cristal sur le chemin détourne l’orbe de la cible (plus de faux final)', () => {
    const r = predictPath({
      ...input,
      vx: 0,
      vy: 2,
      obstacles: [{ x: 402, y: 120, r: 10 }],
      target: { x: 400, y: 260, r: 10 },
    });
    expect(r.contactStep).toBeNull();
  });

  it('applique la restitution des murs', () => {
    const after = (wallRestitution: number) => {
      const r = predictPath({
        ...input,
        vx: 10,
        vy: 0,
        obstacles: [],
        wallRestitution,
        maxSteps: 60,
      });
      return r.points[r.points.length - 1]!.x;
    };
    // Plus élastique : l'orbe repart plus loin du mur droit.
    expect(after(0.9)).toBeLessThan(after(0.5));
  });
});

describe('briques, sous-pas et contact sûr', () => {
  const input = { ...base, restitution: 0.75, maxBounces: 9, maxSteps: 120 };
  const brick = { x: 400, y: 200, r: 6, seg: { ax: 320, ay: 200, bx: 480, by: 200 } };

  it('closestPoint projette sur la brique', () => {
    expect(closestPoint(brick, 350, 120)).toEqual({ x: 350, y: 200 });
    expect(closestPoint(brick, 600, 200)).toEqual({ x: 480, y: 200 });
  });

  it('une brique renvoie l’orbe avec une seule normale (rebond franc vers le haut)', () => {
    const r = predictPath({ ...input, x: 380, vx: 0, vy: 6, obstacles: [brick], maxBounces: 1 });
    expect(r.bounces).toHaveLength(1);
    const b = r.bounces[0]!;
    expect(b.y).toBeCloseTo(200 - 6 - 8, 0);
    expect(Math.abs(b.x - 380)).toBeLessThan(1);
  });

  it('les sous-pas empêchent de traverser une brique fine à grande vitesse', () => {
    const thin = { x: 400, y: 300, r: 2, seg: { ax: 300, ay: 300, bx: 500, by: 300 } };
    const fast = { ...input, vx: 0, vy: 19, obstacles: [thin], maxBounces: 1 };
    const one = predictPath({ ...fast, substeps: 1, y: 270 });
    const four = predictPath({ ...fast, substeps: 4, y: 270 });
    expect(one.bounces).toHaveLength(0); // 19 px par pas > 2 × (2 + 8) : traversée
    expect(four.bounces).toHaveLength(1);
  });

  it('robustContactStep refuse un contact qui dépend d’un rebond au pixel près', () => {
    const target = { x: 400, y: 400, r: 10 };
    const direct = { ...input, vx: 0, vy: 4, obstacles: [], target };
    expect(robustContactStep(direct)).not.toBeNull();
    // Rebond rasant sur un cristal qui envoie l'orbe juste sur la cible : trop fragile.
    const fragile = {
      ...input,
      x: 400,
      y: 40,
      vx: 0,
      vy: 4,
      obstacles: [{ x: 413, y: 200, r: 10 }],
      target: { x: 300, y: 244, r: 4 },
    };
    expect(predictPath(fragile).contactStep).not.toBeNull();
    expect(robustContactStep(fragile)).toBeNull();
  });
});
