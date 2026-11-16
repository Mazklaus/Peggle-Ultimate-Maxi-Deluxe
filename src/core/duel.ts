import { heartsRemaining, type LevelState } from './level';

/**
 * Duel local (règles du Game Designer, regles-modes-jalon3 §3), sans Phaser : deux joueurs
 * tirent à tour de rôle sur le même niveau. Orbes et scores séparés, multiplicateur commun
 * (il dépend des cœurs du terrain partagé). La scène garde UN LevelState : avant chaque tir,
 * les orbes et le score du tireur y sont chargés, puis relus à la fin du tir.
 */

export type PlayerIndex = 0 | 1;
/** Numéro affiché et porté par les événements : J1 = 1, J2 = 2. */
export type PlayerNumber = 1 | 2;

export const DUEL_RULES = {
  orbsEach: 10,
  /** Manche décisive (égalité) : un tir chacun, le meilleur tir gagne. */
  tiebreakOrbs: 1,
  /** Couleurs et formes des joueurs (spec UI/UX 4.1). */
  colors: [0xb9a6ff, 0xff9e8f] as const,
  shapes: ['rond', 'carre'] as const,
};

export interface DuelPlayer {
  orbs: number;
  score: number;
  /** Id de l'Astre du joueur (null sans Astre). */
  astre: string | null;
}

export interface DuelState {
  players: [DuelPlayer, DuelPlayer];
  active: PlayerIndex;
  tiebreak: boolean;
  /** Joueur en tête après le dernier tir (null : égalité). */
  leader: PlayerIndex | null;
}

export interface TurnResult {
  /** Partie finie : dernier cœur brisé ou plus d'orbes pour personne. */
  over: boolean;
  /** Le tireur change (sinon l'autre n'a plus d'orbe et le même rejoue). */
  switched: boolean;
  /** Le joueur en tête vient de changer (événement duel_avantage). */
  newLeader: PlayerIndex | null;
  /** Gagnant si `over` (null : égalité, manche décisive). */
  winner: PlayerIndex | null;
}

export function createDuel(astres: [string | null, string | null], tiebreak = false): DuelState {
  const orbs = tiebreak ? DUEL_RULES.tiebreakOrbs : DUEL_RULES.orbsEach;
  return {
    players: [
      { orbs, score: 0, astre: astres[0] },
      { orbs, score: 0, astre: astres[1] },
    ],
    active: 0,
    tiebreak,
    leader: null,
  };
}

export function playerNumber(i: PlayerIndex): PlayerNumber {
  return i === 0 ? 1 : 2;
}

/**
 * Réglages du niveau en duel, appliqués une fois au départ : pas de bonus d'orbes restants
 * (évite de garder ses orbes) ; en manche décisive, ni réceptacle ni orbe gratuit (un seul tir).
 */
export function applyDuelRules(s: LevelState, d: DuelState): void {
  s.tuning = { ...s.tuning, orbBonus: 0 };
  if (d.tiebreak) s.tuning = { ...s.tuning, freeOrbShotScore: Number.POSITIVE_INFINITY };
  loadActive(s, d);
}

/** Charge les orbes et le score du tireur dans le niveau partagé. */
export function loadActive(s: LevelState, d: DuelState): void {
  const p = d.players[d.active];
  s.orbs = p.orbs;
  s.score = p.score;
}

function leaderOf(d: DuelState): PlayerIndex | null {
  const [a, b] = d.players;
  if (a.score === b.score) return null;
  return a.score > b.score ? 0 : 1;
}

export function duelWinner(d: DuelState): PlayerIndex | null {
  return leaderOf(d);
}

/**
 * Fin d'un tir, APRÈS endShot : relit orbes et score du tireur, décide de la suite et
 * remet le niveau en visée pour le joueur suivant si la partie continue.
 */
export function endTurn(s: LevelState, d: DuelState): TurnResult {
  const shooter = d.players[d.active];
  // Manche décisive : un tir chacun, un orbe rattrapé ne rejoue pas.
  shooter.orbs = d.tiebreak ? 0 : s.orbs;
  shooter.score = s.score;
  const before = d.leader;
  d.leader = leaderOf(d);
  const newLeader = d.leader !== null && d.leader !== before ? d.leader : null;
  const other: PlayerIndex = d.active === 0 ? 1 : 0;
  const heartsLeft = heartsRemaining(s);
  const nobodyCanShoot = shooter.orbs <= 0 && d.players[other].orbs <= 0;
  if (heartsLeft === 0 || nobodyCanShoot) {
    s.phase = heartsLeft === 0 ? 'won' : 'lost';
    return { over: true, switched: false, newLeader, winner: duelWinner(d) };
  }
  const switched = d.players[other].orbs > 0;
  if (switched) d.active = other;
  loadActive(s, d);
  s.phase = 'aiming';
  return { over: false, switched, newLeader, winner: null };
}
