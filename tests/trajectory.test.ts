import { describe, expect, it } from 'vitest';
import { aimGuide } from '../src/core/trajectory';

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
