/**
 * Catalogue des niveaux : index.json (aventure), challenges.json (défis), duel.json (duel)
 * + un fichier par niveau (public/levels/).
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
  /** Niveaux valides de l'aventure, dans l'ordre de l'index. */
  levels: LevelData[];
  /** Défis (challenges.json), dans l'ordre du fichier ; vide si le fichier manque. */
  challenges: LevelData[];
  /** Niveaux de duel (duel.json), dans l'ordre du fichier ; vide si le fichier manque. */
  duel: LevelData[];
  /** Messages d'erreur lisibles (niveau ignoré). */
  errors: string[];
}

/** Index secondaires, facultatifs : fichier et clé de la liste d'ids. */
export const EXTRA_INDEXES = {
  challenges: { file: 'challenges.json', key: 'challenges' },
  duel: { file: 'duel.json', key: 'duel' },
} as const;
export type ExtraIndexName = keyof typeof EXTRA_INDEXES;
export type ExtraIds = Partial<Record<ExtraIndexName, string[]>>;

/** Liste d'ids { format: 1, <key>: [...] } ; file sert aux messages d'erreur. */
export function parseIdList(
  raw: unknown,
  file: string,
  key: string,
): { ids?: string[]; error?: string } {
  if (typeof raw !== 'object' || raw === null) return { error: `${file} : objet attendu.` };
  const obj = raw as Record<string, unknown>;
  if (obj.format !== 1)
    return { error: `${file} : format ${String(obj.format)} non pris en charge.` };
  const ids = obj[key];
  if (!Array.isArray(ids) || !ids.every((l) => typeof l === 'string'))
    return { error: `${file} : ${key} doit être une liste d’ids.` };
  return { ids: ids as string[] };
}

export function parseIndex(raw: unknown): { index?: LevelIndex; error?: string } {
  const { ids, error } = parseIdList(raw, 'index.json', 'levels');
  return ids ? { index: { format: 1, levels: ids } } : { error };
}

/**
 * Lit challenges.json et duel.json s'ils sont là. Un fichier absent (undefined) est
 * normal tant que les défis ne sont pas livrés : liste vide, pas d'erreur.
 */
export function parseExtraIndexes(raws: Partial<Record<ExtraIndexName, unknown>>): {
  extras: ExtraIds;
  errors: string[];
} {
  const extras: ExtraIds = {};
  const errors: string[] = [];
  for (const name of Object.keys(EXTRA_INDEXES) as ExtraIndexName[]) {
    const raw = raws[name];
    if (raw === undefined) continue;
    const { file, key } = EXTRA_INDEXES[name];
    const { ids, error } = parseIdList(raw, file, key);
    if (ids) extras[name] = ids;
    else errors.push(error as string);
  }
  return { extras, errors };
}

/** Tous les ids à charger : aventure puis défis puis duel, sans doublon. */
export function allLevelIds(index: LevelIndex | undefined, extras: ExtraIds): string[] {
  return [
    ...new Set([...(index?.levels ?? []), ...(extras.challenges ?? []), ...(extras.duel ?? [])]),
  ];
}

/**
 * Valide chaque niveau listé (aventure, puis défis et duel s'ils sont fournis) ;
 * un niveau absent ou invalide est ignoré avec une erreur.
 */
export function buildCatalog(
  index: LevelIndex,
  files: Record<string, unknown>,
  extras: ExtraIds = {},
): LevelCatalog {
  const errors: string[] = [];
  const levels = buildList(index.levels, 'index.json', files, errors);
  const challenges = buildList(extras.challenges ?? [], 'challenges.json', files, errors);
  const duel = buildList(extras.duel ?? [], 'duel.json', files, errors);
  const adventure = new Set(index.levels);
  for (const [file, ids] of [
    ['challenges.json', extras.challenges],
    ['duel.json', extras.duel],
  ] as const)
    for (const id of ids ?? [])
      if (adventure.has(id)) errors.push(`${id} : listé dans index.json et dans ${file}.`);
  return { levels, challenges, duel, errors };
}

function buildList(
  ids: readonly string[],
  file: string,
  files: Record<string, unknown>,
  errors: string[],
): LevelData[] {
  const levels: LevelData[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      errors.push(`${id} : listé deux fois dans ${file}.`);
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
  return levels;
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

/** Étiquette courte d'un niveau : « P-2 » (prologue), « 1-7 » (chapitre 1). */
export function levelLabel(id: string): string {
  const m = /^(ch(\d+)|pro)-0*(\d+)$/.exec(id);
  if (!m) return '';
  return `${m[2] ?? 'P'}-${m[3]}`;
}
