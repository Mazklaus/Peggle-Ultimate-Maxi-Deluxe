/**
 * Regroupement des niveaux au build (perf jalon 3, chargement mobile) : index.json,
 * challenges.json, duel.json et tous les niveaux listés tiennent dans UN fichier
 * levels/bundle.json, au lieu d'environ 130 requêtes. Sans Phaser ni Node : la lecture des
 * fichiers est fournie par l'appelant (plugin Vite). Le jeu retombe sur les fichiers séparés
 * si le paquet manque (serveur de dev, éditeur).
 */
import { EXTRA_INDEXES, allLevelIds, parseExtraIndexes, parseIndex } from './levelCatalog';

export const BUNDLE_FILE = 'bundle.json';

export interface LevelBundle {
  format: 1;
  /** Contenu brut des index (les clés de EXTRA_INDEXES pour défis et duel). */
  index: unknown;
  extras: Record<string, unknown>;
  /** Niveaux bruts par id (validés au chargement, comme les fichiers séparés). */
  levels: Record<string, unknown>;
}

/** `read(nom)` renvoie le JSON déjà analysé d'un fichier de public/levels, ou undefined. */
export function buildLevelBundle(read: (file: string) => unknown): LevelBundle {
  const index = read('index.json');
  const extras: Record<string, unknown> = {};
  for (const [name, { file }] of Object.entries(EXTRA_INDEXES)) {
    const raw = read(file);
    if (raw !== undefined) extras[name] = raw;
  }
  const ids = allLevelIds(parseIndex(index).index, parseExtraIndexes(extras).extras);
  const levels: Record<string, unknown> = {};
  for (const id of ids) {
    const raw = read(`${id}.json`);
    if (raw !== undefined) levels[id] = raw;
  }
  return { format: 1, index, extras, levels };
}

export function isLevelBundle(v: unknown): v is LevelBundle {
  if (typeof v !== 'object' || v === null) return false;
  const b = v as Record<string, unknown>;
  return b.format === 1 && typeof b.levels === 'object' && b.levels !== null && 'index' in b;
}
