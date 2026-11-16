/**
 * Galerie des souvenirs (specs UI/UX jalon 3, 6), sans Phaser : les séquences de vignettes
 * dans l'ordre de l'histoire, et les Astres rencontrés. Un souvenir est débloqué quand sa
 * séquence a été vue (drapeau du même nom dans save.seen).
 */
import type { CutsceneSequence } from './story';

export interface MemoryEntry {
  sequence: CutsceneSequence;
  /** 0 pour l'intro, sinon le chapitre de la séquence. */
  chapter: number;
  kind: 'intro' | 'reveil' | 'fin';
  seen: boolean;
}

export const CHAPTER_COUNT = 8;

const reveil = (n: number): CutsceneSequence =>
  n === 1 ? 'reveil_pip' : (`reveil_ch${n}` as CutsceneSequence);
const fin = (n: number): CutsceneSequence => `fin_ch${n}` as CutsceneSequence;

/** Rangée 1 : intro puis les 8 réveils ; rangée 2 : les 8 fins de chapitre (ch. 8 = final). */
export function memoryRows(seen: Record<string, boolean>): [MemoryEntry[], MemoryEntry[]] {
  const entry = (sequence: CutsceneSequence, chapter: number, kind: MemoryEntry['kind']) => ({
    sequence,
    chapter,
    kind,
    seen: !!seen[sequence],
  });
  const chapters = Array.from({ length: CHAPTER_COUNT }, (_, i) => i + 1);
  return [
    [entry('intro', 0, 'intro'), ...chapters.map((n) => entry(reveil(n), n, 'reveil'))],
    chapters.map((n) => entry(fin(n), n, 'fin')),
  ];
}

/** Astres rencontrés : leur séquence de réveil a été vue (rangée 3, une fiche par Astre). */
export function metAstres(seen: Record<string, boolean>): boolean[] {
  return Array.from({ length: CHAPTER_COUNT }, (_, i) => !!seen[reveil(i + 1)]);
}

/** Souvenirs débloqués / total (séquences seulement). */
export function memoryCount(seen: Record<string, boolean>): { seen: number; total: number } {
  const all = memoryRows(seen).flat();
  return { seen: all.filter((e) => e.seen).length, total: all.length };
}
