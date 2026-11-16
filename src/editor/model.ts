/**
 * Logique pure de l'éditeur de niveaux (sans DOM ni Phaser) : création de pegs,
 * sélection, magnétisme, compteurs. Le format lui-même vit dans src/core/levelFormat.ts.
 */
import {
  DEFAULT_PEG_R,
  LEVEL_FORMAT,
  MIN_CIRCLE_GAP,
  PEG_MAX_Y,
  PEG_MIN_Y,
  ZONE_W,
  type LevelData,
  type LevelPeg,
  type PegKind,
  type PegShape,
} from '../core/levelFormat';

export type ToolKind = PegKind | 'auto';
export const BRICK_W = 40;
export const BRICK_H = 12;

export function emptyLevel(): LevelData {
  return {
    format: LEVEL_FORMAT,
    id: 'ch1-01',
    chapter: 1,
    index: 1,
    companion: 'pip',
    companionLocked: false,
    orbs: 10,
    stars: [12000, 30000],
    assign: { hearts: 20, power: 2, bonus: 1 },
    pegs: [],
    decor: [],
  };
}

export function snap(v: number, grid: number): number {
  return grid > 0 ? Math.round(v / grid) * grid : Math.round(v);
}

/** Garde un point dans la zone où les pegs sont autorisés. */
export function clampToZone(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.min(ZONE_W, Math.max(0, x)),
    y: Math.min(PEG_MAX_Y, Math.max(PEG_MIN_Y, y)),
  };
}

/** Rayon de prise d'un peg pour le clic et le glisser. */
export function pegRadius(p: LevelPeg): number {
  if (p.shape === 'brick') return Math.max(p.w ?? BRICK_W, p.h ?? BRICK_H) / 2;
  return p.r ?? DEFAULT_PEG_R;
}

/** Index du peg sous le point (le plus récent d'abord), ou -1. */
export function pegAt(pegs: readonly LevelPeg[], x: number, y: number, tolerance = 3): number {
  for (let i = pegs.length - 1; i >= 0; i--) {
    const p = pegs[i] as LevelPeg;
    if (Math.hypot(p.x - x, p.y - y) <= pegRadius(p) + tolerance) return i;
  }
  return -1;
}

export function makePeg(
  x: number,
  y: number,
  shape: PegShape,
  kind: ToolKind,
  angle = 0,
): LevelPeg {
  const peg: LevelPeg = { x, y };
  if (shape === 'brick') Object.assign(peg, { shape, w: BRICK_W, h: BRICK_H, angle });
  if (kind !== 'auto') peg.kind = kind;
  return peg;
}

/** Change le kind d'un peg ('auto' = tiré au hasard via assign). */
export function setKind(peg: LevelPeg, kind: ToolKind): void {
  if (kind === 'auto') delete peg.kind;
  else peg.kind = kind;
}

export type Counts = Record<ToolKind | 'total', number>;

export function countPegs(pegs: readonly LevelPeg[]): Counts {
  const c: Counts = { total: pegs.length, heart: 0, common: 0, power: 0, wall: 0, auto: 0 };
  for (const p of pegs) c[p.kind ?? 'auto'] += 1;
  return c;
}

/** Index des cercles trop proches d'un autre (à surligner dans l'éditeur). */
export function crowdedPegs(pegs: readonly LevelPeg[]): Set<number> {
  const out = new Set<number>();
  pegs.forEach((a, i) => {
    if (a.shape === 'brick') return;
    for (let j = i + 1; j < pegs.length; j++) {
      const b = pegs[j] as LevelPeg;
      if (b.shape !== 'brick' && Math.hypot(a.x - b.x, a.y - b.y) < MIN_CIRCLE_GAP) {
        out.add(i);
        out.add(j);
      }
    }
  });
  return out;
}
