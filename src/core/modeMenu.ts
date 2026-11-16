/**
 * Menu des modes au titre (specs UI/UX jalon 3, 1), sans Phaser : quels modes sont ouverts.
 *   Aventure : toujours · Du jour : après le prologue · Défis : après le chapitre 1 ·
 *   Duel : toujours, sauf à la toute 1re partie (seule l'Aventure est ouverte).
 */
import { PROLOGUE_IDS, chapterState } from './mapProgress';
import type { ModeKind } from './modes';
import type { SaveData } from './save';

export const MENU_ORDER: readonly ModeKind[] = ['aventure', 'defi', 'quotidien', 'duel'];

export function modeUnlocked(save: SaveData, mode: ModeKind): boolean {
  const firstGame = !Object.values(save.levels).some((r) => r.completed);
  switch (mode) {
    case 'aventure':
      return true;
    case 'quotidien':
      return PROLOGUE_IDS.every((id) => save.levels[id]?.completed);
    case 'defi':
      return chapterState(save, 1) === 'done';
    case 'duel':
      return !firstGame;
  }
}
