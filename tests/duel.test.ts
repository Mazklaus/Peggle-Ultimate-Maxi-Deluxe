import { describe, expect, it } from 'vitest';
import { applyDuelRules, createDuel, DUEL_RULES, endTurn } from '../src/core/duel';
import { staggeredGrid } from '../src/core/layout';
import { createLevel, endShot, hitCrystal, startShot, type LevelState } from '../src/core/level';

function seeded(seed = 3): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function newLevel(): LevelState {
  return createLevel(staggeredGrid(9, 9, 80, 160, 80, 40), seeded());
}

/** Un tir complet : touche les cristaux donnés, attrape ou non l'orbe. */
function shot(s: LevelState, ids: number[], caught = false): void {
  startShot(s);
  for (const id of ids) hitCrystal(s, id);
  endShot(s, caught, seeded(7));
}

const heartIds = (s: LevelState) => s.crystals.filter((c) => c.kind === 'heart').map((c) => c.id);
const commonIds = (s: LevelState) => s.crystals.filter((c) => c.kind === 'common').map((c) => c.id);

describe('duel', () => {
  it('donne 10 orbes à chacun et alterne les tireurs', () => {
    const s = newLevel();
    const d = createDuel(['pip', 'volte']);
    applyDuelRules(s, d);
    expect(s.orbs).toBe(DUEL_RULES.orbsEach);
    shot(s, [commonIds(s)[0] as number]);
    const r = endTurn(s, d);
    expect(r).toMatchObject({ over: false, switched: true });
    expect(d.active).toBe(1);
    expect(d.players[0].orbs).toBe(9);
    expect(s.orbs).toBe(10);
    expect(s.score).toBe(0);
  });

  it('compte les points au tireur, multiplicateur commun', () => {
    const s = newLevel();
    const d = createDuel(['pip', 'pip']);
    applyDuelRules(s, d);
    const hearts = heartIds(s);
    shot(s, hearts.slice(0, 12));
    endTurn(s, d);
    const j1 = d.players[0].score;
    expect(j1).toBeGreaterThan(0);
    // J2 tire après : les cœurs déjà brisés font monter le multiplicateur pour lui aussi.
    const c = commonIds(s)[0] as number;
    shot(s, [c]);
    endTurn(s, d);
    expect(d.players[1].score).toBeGreaterThan(s.tuning.points.common);
    expect(d.players[0].score).toBe(j1);
  });

  it('rend +1 orbe au tireur qui rattrape son orbe', () => {
    const s = newLevel();
    const d = createDuel(['pip', 'pip']);
    applyDuelRules(s, d);
    shot(s, [], true);
    endTurn(s, d);
    expect(d.players[0].orbs).toBe(10);
  });

  it('fait rejouer le même joueur quand l’autre n’a plus d’orbe', () => {
    const s = newLevel();
    const d = createDuel(['pip', 'pip']);
    applyDuelRules(s, d);
    d.players[1].orbs = 0;
    shot(s, []);
    const r = endTurn(s, d);
    expect(r.switched).toBe(false);
    expect(d.active).toBe(0);
    expect(s.phase).toBe('aiming');
  });

  it('finit au dernier cœur, sans bonus d’orbes restants', () => {
    const s = newLevel();
    const d = createDuel(['pip', 'pip']);
    applyDuelRules(s, d);
    shot(s, heartIds(s));
    const scoreAvant = s.score;
    const r = endTurn(s, d);
    expect(r).toMatchObject({ over: true, winner: 0 });
    expect(d.players[0].score).toBe(scoreAvant);
    expect(s.phase).toBe('won');
  });

  it('finit quand les deux joueurs n’ont plus d’orbe, égalité possible', () => {
    const s = newLevel();
    const d = createDuel(['pip', 'pip']);
    applyDuelRules(s, d);
    d.players[0].orbs = 1;
    d.players[1].orbs = 1;
    s.orbs = 1;
    shot(s, []);
    expect(endTurn(s, d).over).toBe(false);
    shot(s, []);
    const r = endTurn(s, d);
    expect(r).toMatchObject({ over: true, winner: null });
  });

  it('signale le changement de joueur en tête', () => {
    const s = newLevel();
    const d = createDuel(['pip', 'pip']);
    applyDuelRules(s, d);
    const commons = commonIds(s);
    shot(s, [commons[0] as number]);
    expect(endTurn(s, d).newLeader).toBe(0);
    shot(s, commons.slice(1, 4));
    expect(endTurn(s, d).newLeader).toBe(1);
    shot(s, []);
    expect(endTurn(s, d).newLeader).toBeNull();
  });

  it('manche décisive : un tir chacun, même en rattrapant l’orbe', () => {
    const s = newLevel();
    const d = createDuel(['pip', 'pip'], true);
    applyDuelRules(s, d);
    expect(s.orbs).toBe(1);
    shot(s, [commonIds(s)[0] as number], true);
    expect(endTurn(s, d)).toMatchObject({ over: false, switched: true });
    shot(s, [], true);
    expect(endTurn(s, d)).toMatchObject({ over: true, winner: 0 });
  });
});
