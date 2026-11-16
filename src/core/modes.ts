/**
 * Modes de jeu du jalon 3 (interface convenue avec le Lead Programmer) : l'écran de mode
 * lance GameScene avec `mode`, ResultsScene le relit pour ses boutons.
 */
export type ModeKind = 'aventure' | 'defi' | 'quotidien' | 'duel';

export interface GameMode {
  kind: ModeKind;
  /** Id du défi ou du niveau de duel. */
  id?: string;
  seed?: number;
  players?: 2;
  /** Duel : Astre de chaque joueur (J1, J2). */
  astres?: [string, string];
  /** Duel : manche décisive après une égalité (un tir chacun, le meilleur tir gagne). */
  tiebreak?: boolean;
}
