/**
 * Catalogue des niveaux : index.json + un fichier par niveau (public/levels/).
 * Sans Phaser : la BootScene charge les fichiers, ce module les valide et les ordonne.
 */
import { parseLevel, type LevelData } from './levelFormat';

export const LEVELS_DIR = 'levels';
/** Clé localStorage écrite par l'éditeur avant d'ouvrir ./?test. */
export const TEST_LEVEL_KEY = 'ricochet:test-level';

export interface LevelIndex {
  format: 1;
  levels: string[];
}

export interface LevelCatalog {
  /** Niveaux valides, dans l'ordre de l'index. */
  levels: LevelData[];
  /** Messages d'erreur lisibles (niveau ignoré). */
  errors: string[];
}

export function parseIndex(raw: unknown): { index?: LevelIndex; error?: string } {
  if (typeof raw !== 'object' || raw === null) return { error: 'index.json : objet attendu.' };
  const { format, levels } = raw as Record<string, unknown>;
  if (format !== 1) return { error: `index.json : format ${String(format)} non pris en charge.` };
  if (!Array.isArray(levels) || !levels.every((l) => typeof l === 'string'))
    return { error: 'index.json : levels doit être une liste d’ids.' };
  return { index: { format: 1, levels: levels as string[] } };
}

/** Valide chaque niveau listé ; un niveau absent ou invalide est ignoré avec une erreur. */
export function buildCatalog(index: LevelIndex, files: Record<string, unknown>): LevelCatalog {
  const levels: LevelData[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const id of index.levels) {
    if (seen.has(id)) {
      errors.push(`${id} : listé deux fois dans index.json.`);
      continue;
    }
    seen.add(id);
    const raw = files[id];
    if (raw === undefined) {
      errors.push(`${id} : fichier ${LEVELS_DIR}/${id}.json introuvable.`);
      continue;
    }
    const res = parseLevel(raw);
    if (res.errors) {
      errors.push(...res.errors.map((e) => `${id} : ${e}`));
      continue;
    }
    if (res.level.id !== id) {
      errors.push(`${id} : l'id du fichier (« ${res.level.id} ») ne correspond pas.`);
      continue;
    }
    levels.push(res.level);
  }
  return { levels, errors };
}

/** Niveaux regroupés par chapitre (0 = prologue), dans l'ordre de l'index. */
export function byChapter(levels: readonly LevelData[]): Map<number, LevelData[]> {
  const out = new Map<number, LevelData[]>();
  for (const l of levels) {
    const list = out.get(l.chapter) ?? [];
    list.push(l);
    out.set(l.chapter, list);
  }
  return out;
}

/** Niveau suivant dans l'ordre de l'aventure, ou null à la fin. */
export function nextLevelId(levels: readonly LevelData[], id: string): string | null {
  const i = levels.findIndex((l) => l.id === id);
  return i >= 0 && i + 1 < levels.length ? (levels[i + 1] as LevelData).id : null;
}
