/**
 * Sauvegarde locale (localStorage), sans Phaser.
 * Le stockage est injecté pour les tests ; une erreur de stockage ne casse jamais le jeu.
 */
export const SAVE_KEY = 'ricochet:save';
export const SAVE_VERSION = 1;
export const SCORE_LOG_MAX = 500;

export interface LevelRecord {
  completed: boolean;
  bestScore: number;
  stars: number;
  plays: number;
  fails: number;
}

export interface Options {
  colorblind: boolean;
  reducedMotion: boolean;
  musicVolume: number;
  sfxVolume: number;
  /** Voix des Astres, séparée des effets (Sound Designer, jalon 3). */
  voiceVolume: number;
  /** Mode doux : aigus adoucis, explosions moins fortes. */
  softAudio: boolean;
  /** Son mono. */
  monoAudio: boolean;
}

/** Une ligne par niveau joué jusqu'au bout : sert au Game Designer pour recaler les étoiles. */
export interface ScoreLogEntry {
  id: string;
  score: number;
  stars: number;
  won: boolean;
  orbsLeft: number;
  at: string;
}

export interface SaveData {
  version: number;
  levels: Record<string, LevelRecord>;
  options: Options;
  scoreLog: ScoreLogEntry[];
  /** Cinématiques déjà vues (intro, reveil_pip, fin_ch1…). */
  seen: Record<string, boolean>;
  /** Dernier Astre choisi dans le sélecteur (préselection des niveaux suivants). */
  companion?: string;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DEFAULT_OPTIONS: Options = {
  colorblind: false,
  reducedMotion: false,
  musicVolume: 0.8,
  sfxVolume: 0.8,
  voiceVolume: 0.8,
  softAudio: false,
  monoAudio: false,
};

export function emptySave(): SaveData {
  return {
    version: SAVE_VERSION,
    levels: {},
    options: { ...DEFAULT_OPTIONS },
    scoreLog: [],
    seen: {},
  };
}

/** Stockage du navigateur s'il est utilisable (navigation privée, iframe…), sinon null. */
export function browserStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadSave(storage: KeyValueStorage | null = browserStorage()): SaveData {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    if (!raw) return emptySave();
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (typeof data !== 'object' || data === null || data.version !== SAVE_VERSION) {
      return emptySave();
    }
    return {
      version: SAVE_VERSION,
      levels: typeof data.levels === 'object' && data.levels ? data.levels : {},
      options: { ...DEFAULT_OPTIONS, ...(data.options ?? {}) },
      scoreLog: Array.isArray(data.scoreLog) ? data.scoreLog : [],
      // Champ ajouté après la v1 : absent des anciennes sauvegardes.
      seen: typeof data.seen === 'object' && data.seen ? data.seen : {},
      ...(typeof data.companion === 'string' ? { companion: data.companion } : {}),
    };
  } catch {
    return emptySave();
  }
}

export function writeSave(
  save: SaveData,
  storage: KeyValueStorage | null = browserStorage(),
): void {
  try {
    storage?.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Quota plein ou stockage interdit : on continue sans sauvegarder.
  }
}

/** Enregistre la fin d'un niveau (victoire ou échec) et met à jour les records. */
export function recordResult(
  save: SaveData,
  result: { id: string; score: number; stars: number; won: boolean; orbsLeft: number },
  now: Date = new Date(),
): LevelRecord {
  const prev = save.levels[result.id] ?? {
    completed: false,
    bestScore: 0,
    stars: 0,
    plays: 0,
    fails: 0,
  };
  const rec: LevelRecord = {
    completed: prev.completed || result.won,
    bestScore: result.won ? Math.max(prev.bestScore, result.score) : prev.bestScore,
    stars: Math.max(prev.stars, result.stars),
    plays: prev.plays + 1,
    fails: prev.fails + (result.won ? 0 : 1),
  };
  save.levels[result.id] = rec;
  save.scoreLog.push({ ...result, at: now.toISOString() });
  if (save.scoreLog.length > SCORE_LOG_MAX)
    save.scoreLog.splice(0, save.scoreLog.length - SCORE_LOG_MAX);
  return rec;
}

/** Marque une cinématique comme vue ; renvoie true si c'était la première fois. */
export function markSeen(save: SaveData, id: string): boolean {
  if (save.seen[id]) return false;
  save.seen[id] = true;
  return true;
}

/** Un niveau est débloqué si c'est le premier de la liste ou si le précédent est fini. */
export function isUnlocked(order: readonly string[], id: string, save: SaveData): boolean {
  const i = order.indexOf(id);
  if (i <= 0) return i === 0;
  const prevId = order[i - 1] as string;
  return save.levels[prevId]?.completed === true;
}

/** Échecs consécutifs sur un niveau pas encore fini (aide anti-frustration après 3). */
export function failsBeforeFirstWin(save: SaveData, id: string): number {
  const rec = save.levels[id];
  return rec && !rec.completed ? rec.fails : 0;
}
