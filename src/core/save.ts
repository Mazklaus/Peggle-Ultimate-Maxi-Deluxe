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
  /** Vitesse du jeu (specs UI/UX jalon 3, 5) : lent 0.8, normal 1, rapide 1.2. */
  speed: GameSpeed;
}

export const GAME_SPEEDS = [0.8, 1, 1.2] as const;
export type GameSpeed = (typeof GAME_SPEEDS)[number];

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
  /** Défis réussis (médailles), par id de niveau de défi. */
  challenges?: Record<string, boolean>;
  /** Constellation du jour : meilleur score du jour et série de jours joués d'affilée. */
  daily?: DailyRecord;
}

export interface DailyRecord {
  /** Dernier jour joué, AAAAMMJJ (date locale). */
  date: string;
  /** Meilleur score de ce jour-là. */
  best: number;
  /** Jours joués d'affilée jusqu'à `date` inclus. */
  streak: number;
  /** Jour joué précédent (avant `date`). */
  lastDate?: string;
  /** Meilleur score des derniers jours joués (AAAAMMJJ -> score), 7 au plus (classement local). */
  history?: Record<string, number>;
  /** Record personnel, tous jours confondus. */
  record?: number;
}

/** Jours gardés dans l'historique du jour (barres des 7 derniers jours). */
export const DAILY_HISTORY_DAYS = 7;

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
  speed: 1,
};

/** Valeurs hors liste (sauvegarde trafiquée ou ancienne) ramenées au défaut. */
function sanitizeOptions(o: Options): Options {
  return GAME_SPEEDS.includes(o.speed) ? o : { ...o, speed: DEFAULT_OPTIONS.speed };
}

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
      options: sanitizeOptions({ ...DEFAULT_OPTIONS, ...(data.options ?? {}) }),
      scoreLog: Array.isArray(data.scoreLog) ? data.scoreLog : [],
      // Champ ajouté après la v1 : absent des anciennes sauvegardes.
      seen: typeof data.seen === 'object' && data.seen ? data.seen : {},
      ...(typeof data.companion === 'string' ? { companion: data.companion } : {}),
      ...(typeof data.challenges === 'object' && data.challenges
        ? { challenges: data.challenges }
        : {}),
      ...(isDailyRecord(data.daily) ? { daily: data.daily } : {}),
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

function isDailyRecord(v: unknown): v is DailyRecord {
  if (typeof v !== 'object' || v === null) return false;
  const d = v as Record<string, unknown>;
  return (
    typeof d.date === 'string' &&
    /^\d{8}$/.test(d.date) &&
    typeof d.best === 'number' &&
    Number.isFinite(d.best) &&
    Number.isInteger(d.streak) &&
    (d.lastDate === undefined || typeof d.lastDate === 'string') &&
    (d.history === undefined ||
      (typeof d.history === 'object' &&
        d.history !== null &&
        Object.values(d.history).every((v) => typeof v === 'number')))
  );
}

/** Veille d'une clé AAAAMMJJ, dans le calendrier local. */
export function previousDayKey(key: string): string {
  const d = new Date(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6, 8)));
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Enregistre une partie de la Constellation du jour (gagnée ou non, essais illimités) :
 * garde le meilleur score du jour ; la série augmente si le jour précédent a été joué.
 */
export function recordDaily(save: SaveData, key: string, score: number): DailyRecord {
  const prev = save.daily;
  let rec: DailyRecord;
  if (prev && prev.date === key) {
    rec = { ...prev, best: Math.max(prev.best, score) };
  } else {
    const streak = prev && prev.date === previousDayKey(key) ? prev.streak + 1 : 1;
    rec = { date: key, best: score, streak, ...(prev ? { lastDate: prev.date } : {}) };
  }
  rec.record = Math.max(prev?.record ?? 0, rec.best);
  const history = { ...(prev?.history ?? {}), [key]: rec.best };
  const keep = Object.keys(history).sort().slice(-DAILY_HISTORY_DAYS);
  rec.history = Object.fromEntries(keep.map((k) => [k, history[k] ?? 0]));
  save.daily = rec;
  return rec;
}

/** Les `n` derniers jours jusqu'à `todayKey` inclus (le plus ancien d'abord), avec leur score. */
export function dailyBars(
  save: SaveData,
  todayKey: string,
  n = DAILY_HISTORY_DAYS,
): Array<{ key: string; best: number | null }> {
  const keys = [todayKey];
  while (keys.length < n) keys.unshift(previousDayKey(keys[0]!));
  const h = save.daily?.history ?? {};
  return keys.map((key) => ({ key, best: h[key] ?? null }));
}

/** Série affichable aujourd'hui : 0 si le dernier jour joué n'est ni aujourd'hui ni hier. */
export function currentStreak(save: SaveData, todayKey: string): number {
  const d = save.daily;
  if (!d) return 0;
  return d.date === todayKey || d.date === previousDayKey(todayKey) ? d.streak : 0;
}

/** Médaille d'un défi réussi ; true si elle est nouvelle. */
export function recordChallenge(save: SaveData, id: string, success: boolean): boolean {
  if (!success || save.challenges?.[id]) return false;
  save.challenges = { ...(save.challenges ?? {}), [id]: true };
  return true;
}

/** Nombre de médailles parmi ces défis. */
export function challengeMedals(save: SaveData, ids: readonly string[]): number {
  return ids.filter((id) => save.challenges?.[id]).length;
}
