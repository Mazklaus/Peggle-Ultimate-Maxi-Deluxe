import { describe, expect, it } from 'vitest';
import { PIP_POWER, RevealCharges } from '../src/core/powers';
import { predictPath } from '../src/core/trajectory';

describe('RevealCharges (pouvoir de Pip)', () => {
  it('donne 2 tirs par activation, plafonnés à 4', () => {
    const c = new RevealCharges();
    expect(c.previewing).toBe(false);
    c.gain();
    expect(c.charges).toBe(PIP_POWER.chargesPerActivation);
    c.gain();
    c.gain();
    expect(c.charges).toBe(PIP_POWER.maxCharges);
  });

  it('consomme une charge par tir et marque le tir comme aidé', () => {
    const c = new RevealCharges();
    c.gain();
    expect(c.fire()).toBe(true);
    expect(c.shotIsPowered).toBe(true);
    c.endShot();
    expect(c.fire()).toBe(true);
    c.endShot();
    expect(c.fire()).toBe(false);
    expect(c.charges).toBe(0);
  });

  it('un cristal pouvoir touché pendant le tir vaut pour les tirs suivants', () => {
    const c = new RevealCharges();
    c.fire();
    c.gain();
    expect(c.shotIsPowered).toBe(false);
    c.endShot();
    expect(c.previewing).toBe(true);
  });
});

const base = { gravity: 0.28, radius: 8, minX: 0, maxX: 800, maxY: 700, restitution: 0.75 };

describe('predictPath', () => {
  it('rebondit sur un cristal et repart vers le haut', () => {
    const r = predictPath({
      ...base,
      x: 400,
      y: 40,
      vx: 0,
      vy: 6,
      obstacles: [{ x: 400, y: 300, r: 10 }],
      maxBounces: 1,
    });
    expect(r.bounces).toHaveLength(1);
    const last = r.points[r.points.length - 1]!;
    expect(last.y).toBeLessThan(300);
  });

  it('rebondit sur les murs et s’arrête au n-ième rebond', () => {
    const r = predictPath({
      ...base,
      x: 400,
      y: 40,
      vx: 20,
      vy: 0,
      obstacles: [],
      maxBounces: 3,
      maxY: 1e6,
      maxSteps: 500,
    });
    expect(r.bounces.length).toBeLessThanOrEqual(3);
    expect(r.bounces.length).toBeGreaterThanOrEqual(2);
    expect(r.bounces[0]!.x).toBeCloseTo(792);
  });

  it('respecte la limite de durée', () => {
    const r = predictPath({
      ...base,
      x: 400,
      y: 40,
      vx: 1,
      vy: 0,
      obstacles: [],
      maxBounces: 3,
      maxSteps: 90,
    });
    expect(r.points.length).toBeLessThanOrEqual(91);
  });
});

describe('aide après 3 échecs', () => {
  it('grant offre des charges sans dépasser le plafond', () => {
    const c = new RevealCharges();
    c.grant(1);
    expect(c.charges).toBe(1);
    expect(c.fire()).toBe(true);
    c.endShot();
    expect(c.previewing).toBe(false);
    c.grant(9);
    expect(c.charges).toBe(PIP_POWER.maxCharges);
  });
});
