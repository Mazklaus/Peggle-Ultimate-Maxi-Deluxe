import { describe, expect, it } from 'vitest';
import { FINAL_ZONES, finalZoneAt } from '../src/core/finalZones';

describe('zones du tir final', () => {
  it('couvrent toute la largeur, sans trou', () => {
    expect(FINAL_ZONES[0]!.from).toBe(0);
    expect(FINAL_ZONES[FINAL_ZONES.length - 1]!.to).toBeCloseTo(1);
    for (let i = 1; i < FINAL_ZONES.length; i++) {
      expect(FINAL_ZONES[i]!.from).toBeCloseTo(FINAL_ZONES[i - 1]!.to);
    }
  });

  it('valent 1 000 / 2 500 / 5 000, le plus gros au centre', () => {
    expect(new Set(FINAL_ZONES.map((z) => z.points))).toEqual(new Set([1000, 2500, 5000]));
    expect(finalZoneAt(0.5).zone.points).toBe(5000);
    expect(finalZoneAt(0.01).zone.points).toBe(1000);
    expect(finalZoneAt(0.99).zone.points).toBe(1000);
    expect(finalZoneAt(0.35).zone.points).toBe(2500);
  });

  it('borne les positions hors zone', () => {
    expect(finalZoneAt(-1).index).toBe(0);
    expect(finalZoneAt(2).index).toBe(FINAL_ZONES.length - 1);
  });
});
