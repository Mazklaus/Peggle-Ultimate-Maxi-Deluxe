import { describe, expect, it } from 'vitest';
import { aimGuide, predictPath } from '../src/core/trajectory';

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
