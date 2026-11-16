/**
 * Passe d'un niveau JSON validé (LevelData) à l'état de jeu (LevelState).
 * Les pegs sans kind imposé sont tirés au hasard selon `assign`.
 */
import { DEFAULT_PEG_R, type LevelData } from './levelFormat';
import { createLevel, type Crystal, type CrystalKind, type LevelState, type Rng } from './level';
import { TUNING, type Tuning } from './tuning';

export function levelFromData(
  data: LevelData,
  rng: Rng = Math.random,
  base: Tuning = TUNING,
): LevelState {
  const tuning: Tuning = {
    ...base,
    startingOrbs: data.orbs,
    heartCrystals: data.assign.hearts,
    bonusCrystals: data.assign.bonus,
  };
  const state = createLevel([], rng, tuning);

  // Tirage : mélange des pegs libres, puis cœurs, pouvoirs, bonus, le reste en communs.
  const free = data.pegs.map((p, i) => (p.kind === undefined ? i : -1)).filter((i) => i >= 0);
  for (let i = free.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [free[i], free[j]] = [free[j] as number, free[i] as number];
  }
  const drawn = new Map<number, CrystalKind>();
  const { hearts, power, bonus } = data.assign;
  free.forEach((pegIndex, rank) => {
    drawn.set(
      pegIndex,
      rank < hearts
        ? 'heart'
        : rank < hearts + power
          ? 'power'
          : rank < hearts + power + bonus
            ? 'bonus'
            : 'common',
    );
  });

  state.crystals = data.pegs.map((p, id): Crystal => ({
    id,
    x: p.x,
    y: p.y,
    kind: p.kind ?? drawn.get(id) ?? 'common',
    lit: false,
    ...(p.group ? { group: p.group } : {}),
    shape:
      p.shape === 'brick'
        ? { type: 'brick', w: p.w ?? 40, h: p.h ?? 12, angle: p.angle ?? 0 }
        : { type: 'circle', r: p.r ?? DEFAULT_PEG_R },
  }));
  state.heartsTotal = state.crystals.filter((c) => c.kind === 'heart').length;
  return state;
}
