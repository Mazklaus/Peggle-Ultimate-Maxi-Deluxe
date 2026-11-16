import { describe, expect, it } from 'vitest';
import { parseLevel } from '../src/core/levelFormat';
import {
  clampToZone,
  countPegs,
  crowdedPegs,
  designWarnings,
  emptyLevel,
  makePeg,
  pegAt,
  setKind,
  snap,
} from '../src/editor/model';

describe('éditeur de niveaux : modèle', () => {
  it('aimante sur la grille', () => {
    expect(snap(27, 20)).toBe(20);
    expect(snap(31, 20)).toBe(40);
    expect(snap(12.6, 0)).toBe(13);
  });

  it('garde les pegs entre le canon et le réceptacle', () => {
    expect(clampToZone(-5, 640)).toEqual({ x: 0, y: 600 });
    expect(clampToZone(900, 10)).toEqual({ x: 880, y: 80 });
  });

  it('trouve le peg cliqué, le plus récent en premier', () => {
    const pegs = [makePeg(100, 100, 'circle', 'auto'), makePeg(105, 100, 'circle', 'heart')];
    expect(pegAt(pegs, 104, 101)).toBe(1);
    expect(pegAt(pegs, 300, 300)).toBe(-1);
  });

  it('compte par kind et repère les cercles trop proches', () => {
    const pegs = [
      makePeg(100, 100, 'circle', 'auto'),
      makePeg(110, 100, 'circle', 'heart'),
      makePeg(300, 100, 'brick', 'wall', 30),
    ];
    expect(countPegs(pegs)).toEqual({ total: 3, auto: 1, heart: 1, common: 0, power: 0, wall: 1 });
    expect([...crowdedPegs(pegs)]).toEqual([0, 1]);
    setKind(pegs[1]!, 'auto');
    expect(pegs[1]).not.toHaveProperty('kind');
  });

  it('un niveau vide de base devient valide une fois rempli', () => {
    const level = emptyLevel();
    level.assign = { hearts: 1, power: 0, bonus: 0 };
    level.pegs.push(makePeg(100, 200, 'circle', 'auto'), makePeg(300, 300, 'brick', 'common', 15));
    expect(parseLevel(level).errors).toBeUndefined();
  });

  it('signale les murs presque horizontaux, sans bloquer', () => {
    const at = (angle: number, kind: 'wall' | 'common' = 'wall') =>
      designWarnings([makePeg(300, 300, 'brick', kind, angle)]).length;
    expect(at(0)).toBe(1);
    expect(at(-5)).toBe(1);
    expect(at(175)).toBe(1);
    expect(at(87)).toBe(1); // face courte horizontale
    expect(at(10)).toBe(0);
    expect(at(45)).toBe(0);
    expect(at(0, 'common')).toBe(0); // cassable : pas concerné
  });
});
