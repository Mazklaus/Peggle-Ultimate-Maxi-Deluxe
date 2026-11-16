/**
 * Progression de la carte du ciel (specs UI/UX jalon 2, section 1), sans Phaser.
 * Chapitre 0 = prologue (4 niveaux), chapitres 1 à 8 = 12 niveaux chacun.
 */
import type { SaveData } from './save';

export const CHAPTER_COUNT = 8;
export const LEVELS_PER_CHAPTER = 12;
export const PROLOGUE_IDS = ['pro-01', 'pro-02', 'pro-03', 'pro-04'] as const;
/** 3 étoiles × 100 niveaux, prologue compris. */
export const MAX_STARS = 3 * (PROLOGUE_IDS.length + CHAPTER_COUNT * LEVELS_PER_CHAPTER);

export type ChapterState = 'locked' | 'open' | 'done';

export function chapterLevelIds(chapter: number): string[] {
  if (chapter === 0) return [...PROLOGUE_IDS];
  return Array.from(
    { length: LEVELS_PER_CHAPTER },
    (_, i) => `ch${chapter}-${String(i + 1).padStart(2, '0')}`,
  );
}

/** Chapitre d'un id de niveau (« pro-02 » -> 0, « ch3-07 » -> 3), null si inconnu. */
export function chapterOf(id: string): number | null {
  if (id.startsWith('pro-')) return 0;
  const m = /^ch(\d+)-\d+$/.exec(id);
  return m ? Number(m[1]) : null;
}

const completed = (save: SaveData, id: string): boolean => save.levels[id]?.completed === true;

/**
 * Terminé : ses 12 niveaux sont finis. Ouvert : le chapitre précédent est terminé (le
 * prologue pour le ch. 1), ou l'un de ses niveaux est déjà fini. Sinon verrouillé.
 */
export function chapterState(save: SaveData, chapter: number): ChapterState {
  const ids = chapterLevelIds(chapter);
  if (ids.every((id) => completed(save, id))) return 'done';
  if (chapter === 0) return 'open';
  if (ids.some((id) => completed(save, id))) return 'open';
  return chapterState(save, chapter - 1) === 'done' ? 'open' : 'locked';
}

export function chapterStars(save: SaveData, chapter: number): number {
  return chapterLevelIds(chapter).reduce((n, id) => n + (save.levels[id]?.stars ?? 0), 0);
}

export function totalStars(save: SaveData): number {
  let n = 0;
  for (let c = 0; c <= CHAPTER_COUNT; c++) n += chapterStars(save, c);
  return n;
}

/** Nombre de chapitres terminés (1 à 8), pour la lueur de la Veilleuse. */
export function chaptersDone(save: SaveData): number {
  let n = 0;
  for (let c = 1; c <= CHAPTER_COUNT; c++) if (chapterState(save, c) === 'done') n++;
  return n;
}

export const announceKey = (chapter: number): string => `annonce_ch${chapter}`;

/**
 * Chapitre dont la séquence de déblocage n'a pas encore été jouée (chapitre précédent
 * terminé, drapeau absent), sinon null. Le ch. 1 s'ouvre sans séquence (fin du prologue).
 */
export function pendingUnlock(save: SaveData): number | null {
  for (let c = 2; c <= CHAPTER_COUNT; c++) {
    if (save.seen[announceKey(c)]) continue;
    if (chapterState(save, c - 1) === 'done') return c;
  }
  return null;
}

/**
 * Chapitre à montrer en arrivant sur la carte : celui du premier niveau ouvert non fini
 * (dans l'ordre du jeu), sinon le dernier chapitre ouvert.
 */
export function currentChapter(save: SaveData, order: readonly string[]): number {
  for (const id of order) {
    if (completed(save, id)) continue;
    const c = chapterOf(id);
    if (c !== null && chapterState(save, c) !== 'locked') return c;
  }
  for (let c = CHAPTER_COUNT; c >= 0; c--) if (chapterState(save, c) !== 'locked') return c;
  return 0;
}
