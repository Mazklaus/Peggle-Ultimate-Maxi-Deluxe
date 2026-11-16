/**
 * Règles d'un niveau, sans Phaser : stock d'orbes, cristaux allumés puis retirés en fin de tir,
 * score avec multiplicateur de progression, victoire / échec.
 */
import { TUNING, type Tuning } from './tuning';

export type CrystalKind = 'heart' | 'common' | 'bonus';
export type Phase = 'aiming' | 'shooting' | 'won' | 'lost';
export type Rng = () => number;

export interface Crystal {
  id: number;
  x: number;
  y: number;
  kind: CrystalKind;
  lit: boolean;
}

export interface LevelState {
  tuning: Tuning;
  crystals: Crystal[];
  heartsTotal: number;
  orbs: number;
  score: number;
  phase: Phase;
  shotScore: number;
  shotHits: number;
  freeOrbThisShot: boolean;
}

export interface ShotResult {
  removedIds: number[];
  caught: boolean;
  orbsGained: number;
  phase: Phase;
}

/** Mélange de Fisher-Yates (rng injecté pour des tests déterministes). */
function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

/** Crée un niveau à partir de positions ; les familles sont tirées au hasard. */
export function createLevel(
  positions: ReadonlyArray<{ x: number; y: number }>,
  rng: Rng = Math.random,
  tuning: Tuning = TUNING,
): LevelState {
  const order = shuffle(
    positions.map((_, i) => i),
    rng,
  );
  const kinds: CrystalKind[] = [];
  order.forEach((posIndex, rank) => {
    kinds[posIndex] =
      rank < tuning.heartCrystals
        ? 'heart'
        : rank < tuning.heartCrystals + tuning.bonusCrystals
          ? 'bonus'
          : 'common';
  });
  const crystals: Crystal[] = positions.map((p, id) => ({
    id,
    x: p.x,
    y: p.y,
    kind: kinds[id] ?? 'common',
    lit: false,
  }));
  return {
    tuning,
    crystals,
    heartsTotal: crystals.filter((c) => c.kind === 'heart').length,
    orbs: tuning.startingOrbs,
    score: 0,
    phase: 'aiming',
    shotScore: 0,
    shotHits: 0,
    freeOrbThisShot: false,
  };
}

/** Cœurs pas encore touchés (ni allumés, ni retirés). */
export function heartsRemaining(s: LevelState): number {
  return s.crystals.filter((c) => c.kind === 'heart' && !c.lit).length;
}

/** Multiplicateur selon la part de cœurs déjà touchés. */
export function multiplier(s: LevelState): number {
  const broken = s.heartsTotal === 0 ? 1 : 1 - heartsRemaining(s) / s.heartsTotal;
  const { multiplierSteps: steps, multiplierThresholds: thresholds } = s.tuning;
  let m = steps[0] ?? 1;
  thresholds.forEach((t, i) => {
    if (broken >= t) m = steps[i + 1] ?? m;
  });
  return m;
}

export function canShoot(s: LevelState): boolean {
  return s.phase === 'aiming' && s.orbs > 0;
}

/** Lance un tir : consomme un orbe. */
export function startShot(s: LevelState): boolean {
  if (!canShoot(s)) return false;
  s.orbs -= 1;
  s.phase = 'shooting';
  s.shotScore = 0;
  s.shotHits = 0;
  s.freeOrbThisShot = false;
  return true;
}

/** Un cristal est touché : il s'allume et rapporte des points. Renvoie les points (0 si déjà allumé). */
export function hitCrystal(s: LevelState, id: number): number {
  if (s.phase !== 'shooting') return 0;
  const c = s.crystals.find((k) => k.id === id);
  if (!c || c.lit) return 0;
  c.lit = true;
  const gained = s.tuning.points[c.kind] * multiplier(s);
  s.shotHits += 1;
  s.shotScore += gained;
  s.score += gained;
  if (!s.freeOrbThisShot && s.shotScore >= s.tuning.freeOrbShotScore) {
    s.freeOrbThisShot = true;
    s.orbs += 1;
  }
  return gained;
}

/** Le dernier cœur vient d'être touché (déclenche le ralenti côté scène). */
export function isFinalHeartLit(s: LevelState): boolean {
  return s.phase === 'shooting' && heartsRemaining(s) === 0;
}

/**
 * Anti-blocage : retire tout de suite les cristaux allumés donnés (ceux qui coincent l'orbe).
 * Renvoie les ids effectivement retirés.
 */
export function breakLitNow(s: LevelState, ids: number[]): number[] {
  const set = new Set(ids);
  const removed = s.crystals.filter((c) => c.lit && set.has(c.id)).map((c) => c.id);
  s.crystals = s.crystals.filter((c) => !removed.includes(c.id));
  return removed;
}

/** Déplace le cristal bonus sur un cristal commun au hasard (à chaque tir). */
function moveBonus(s: LevelState, rng: Rng): void {
  for (const c of s.crystals) if (c.kind === 'bonus') c.kind = 'common';
  const commons = s.crystals.filter((c) => c.kind === 'common');
  for (let i = 0; i < s.tuning.bonusCrystals && commons.length > 0; i++) {
    const pick = commons.splice(Math.floor(rng() * commons.length), 1)[0];
    if (pick) pick.kind = 'bonus';
  }
}

/** Fin de tir : retire les cristaux allumés, rend un orbe si attrapé, décide victoire / échec. */
export function endShot(s: LevelState, caught: boolean, rng: Rng = Math.random): ShotResult {
  if (s.phase !== 'shooting') {
    return { removedIds: [], caught: false, orbsGained: 0, phase: s.phase };
  }
  const removedIds = s.crystals.filter((c) => c.lit).map((c) => c.id);
  s.crystals = s.crystals.filter((c) => !c.lit);
  const orbsGained = caught ? 1 : 0;
  s.orbs += orbsGained;
  if (heartsRemaining(s) === 0) {
    s.score += s.orbs * s.tuning.points.bonus; // bonus de fin : orbes restants
    s.phase = 'won';
  } else if (s.orbs <= 0) {
    s.phase = 'lost';
  } else {
    s.phase = 'aiming';
    moveBonus(s, rng);
  }
  return { removedIds, caught, orbsGained, phase: s.phase };
}
