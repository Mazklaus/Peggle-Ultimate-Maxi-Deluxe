/**
 * Format JSON des niveaux, v1 (voir docs/level-format.md) : types, validation et sérialisation.
 * Utilisé par le chargeur du jeu et par l'éditeur de niveaux. Sans Phaser.
 */

export const LEVEL_FORMAT = 1;
/** Zone de jeu, en px, origine en haut à gauche. */
export const ZONE_W = 880;
export const ZONE_H = 656;
export const PEG_MIN_Y = 80;
export const PEG_MAX_Y = 600;
export const DEFAULT_PEG_R = 10;
/** Écart minimal entre les centres de deux cercles. */
export const MIN_CIRCLE_GAP = 22;
export const DEFAULT_ORBS = 10;

export const PEG_KINDS = ['heart', 'common', 'power', 'wall'] as const;
export type PegKind = (typeof PEG_KINDS)[number];
export const PEG_SHAPES = ['circle', 'brick'] as const;
export type PegShape = (typeof PEG_SHAPES)[number];
export const COMPANIONS = [
  'pip',
  'bourdon',
  'jumelles',
  'volte',
  'mousse',
  'horloge',
  'grelot',
  'nuage-lune',
] as const;
export type Companion = (typeof COMPANIONS)[number];
export const RHYTHMS = [
  'tutoriel',
  'decouverte',
  'application',
  'respiration',
  'combinaison',
  'maitrise',
  'grande-constellation',
] as const;
export type Rhythm = (typeof RHYTHMS)[number];

export interface LevelPeg {
  x: number;
  y: number;
  /** Défaut : 'circle'. */
  shape?: PegShape;
  /** Rayon d'un cercle (défaut 10). */
  r?: number;
  /** Dimensions et angle (degrés) d'une brique. */
  w?: number;
  h?: number;
  angle?: number;
  /** Absent : tiré au hasard via `assign`. */
  kind?: PegKind;
}

export interface LevelAssign {
  hearts: number;
  power: number;
  bonus: number;
}

export interface LevelData {
  format: 1;
  id: string;
  chapter: number;
  index: number;
  companion: Companion | null;
  companionLocked: boolean;
  title?: string;
  rhythm?: Rhythm;
  orbs: number;
  stars: [number, number];
  assign: LevelAssign;
  pegs: LevelPeg[];
  decor: unknown[];
}

export type ParseResult =
  { level: LevelData; errors?: undefined } | { level?: undefined; errors: string[] };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown): v is number => Number.isInteger(v);
const isOneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && (list as readonly string[]).includes(v);

function parsePeg(raw: unknown, i: number, errors: string[]): LevelPeg | null {
  const where = `pegs[${i}]`;
  if (!isObj(raw)) {
    errors.push(`${where} : objet attendu.`);
    return null;
  }
  const { x, y } = raw;
  if (!isNum(x) || !isNum(y)) {
    errors.push(`${where} : x et y numériques obligatoires.`);
    return null;
  }
  if (x < 0 || x > ZONE_W || y < PEG_MIN_Y || y > PEG_MAX_Y)
    errors.push(`${where} hors zone (${x}, ${y}) : x 0..${ZONE_W}, y ${PEG_MIN_Y}..${PEG_MAX_Y}.`);
  const peg: LevelPeg = { x, y };

  if (raw.shape !== undefined) {
    if (!isOneOf(PEG_SHAPES, raw.shape)) errors.push(`${where} : shape inconnue.`);
    else if (raw.shape === 'brick') peg.shape = 'brick';
  }
  if (peg.shape === 'brick') {
    for (const key of ['w', 'h'] as const) {
      const v = raw[key];
      if (!isNum(v) || v <= 0) errors.push(`${where} : ${key} > 0 obligatoire pour une brique.`);
      else peg[key] = v;
    }
    if (raw.angle !== undefined) {
      if (!isNum(raw.angle)) errors.push(`${where} : angle numérique (degrés).`);
      else peg.angle = raw.angle;
    }
  } else if (raw.r !== undefined) {
    if (!isNum(raw.r) || raw.r <= 0) errors.push(`${where} : r > 0.`);
    else peg.r = raw.r;
  }
  if (raw.kind !== undefined) {
    if (!isOneOf(PEG_KINDS, raw.kind))
      errors.push(`${where} : kind inconnu « ${String(raw.kind)} ».`);
    else peg.kind = raw.kind;
  }
  return peg;
}

/** Valide un niveau (texte JSON ou objet déjà lu). Champs inconnus ignorés. */
export function parseLevel(input: string | unknown): ParseResult {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch (e) {
      return { errors: [`JSON invalide : ${(e as Error).message}`] };
    }
  }
  if (!isObj(raw)) return { errors: ['Le niveau doit être un objet JSON.'] };
  const errors: string[] = [];

  if (raw.format !== LEVEL_FORMAT)
    return {
      errors: [`format ${String(raw.format)} non pris en charge (attendu : ${LEVEL_FORMAT}).`],
    };
  const id = raw.id;
  if (typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id))
    errors.push('id : texte obligatoire, minuscules, chiffres et tirets.');
  const chapter = raw.chapter ?? 0;
  if (!isInt(chapter) || chapter < 0 || chapter > 8) errors.push('chapter : entier 0..8.');
  const index = raw.index ?? 1;
  if (!isInt(index) || index < 1 || index > 12) errors.push('index : entier 1..12.');
  const companion = raw.companion ?? null;
  if (companion !== null && !isOneOf(COMPANIONS, companion))
    errors.push(`companion inconnu « ${String(companion)} ».`);
  const companionLocked = raw.companionLocked ?? false;
  if (typeof companionLocked !== 'boolean') errors.push('companionLocked : booléen.');
  if (raw.title !== undefined && typeof raw.title !== 'string') errors.push('title : texte.');
  if (raw.rhythm !== undefined && !isOneOf(RHYTHMS, raw.rhythm))
    errors.push(`rhythm inconnu « ${String(raw.rhythm)} ».`);
  const orbs = raw.orbs ?? DEFAULT_ORBS;
  if (!isInt(orbs) || orbs < 1) errors.push('orbs : entier >= 1.');

  const stars = raw.stars;
  if (!Array.isArray(stars) || stars.length !== 2 || !stars.every(isNum))
    errors.push('stars : [score 2 étoiles, score 3 étoiles].');
  else if (!((stars[0] as number) < (stars[1] as number)))
    errors.push('stars : seuils croissants attendus.');

  const assignRaw = isObj(raw.assign) ? raw.assign : {};
  const assign: LevelAssign = { hearts: 0, power: 0, bonus: 0 };
  for (const key of ['hearts', 'power', 'bonus'] as const) {
    const v = assignRaw[key] ?? 0;
    if (!isInt(v) || v < 0) errors.push(`assign.${key} : entier >= 0.`);
    else assign[key] = v;
  }

  if (!Array.isArray(raw.pegs)) errors.push('pegs : tableau obligatoire.');
  const pegs = (Array.isArray(raw.pegs) ? raw.pegs : [])
    .map((p, i) => parsePeg(p, i, errors))
    .filter((p): p is LevelPeg => p !== null);

  errors.push(...checkLayout(pegs, assign));

  if (errors.length) return { errors };
  const level: LevelData = {
    format: 1,
    id: id as string,
    chapter: chapter as number,
    index: index as number,
    companion: companion as Companion | null,
    companionLocked: companionLocked as boolean,
    orbs: orbs as number,
    stars: [(stars as number[])[0] as number, (stars as number[])[1] as number],
    assign,
    pegs,
    decor: Array.isArray(raw.decor) ? raw.decor : [],
  };
  if (raw.title !== undefined) level.title = raw.title as string;
  if (raw.rhythm !== undefined) level.rhythm = raw.rhythm as Rhythm;
  return { level };
}

/** Règles de disposition : écart entre cercles, assign réalisable, au moins un cœur. */
export function checkLayout(pegs: readonly LevelPeg[], assign: LevelAssign): string[] {
  const errors: string[] = [];
  const circles = pegs.map((p, i) => ({ p, i })).filter(({ p }) => p.shape !== 'brick');
  for (let a = 0; a < circles.length; a++) {
    for (let b = a + 1; b < circles.length; b++) {
      const A = circles[a] as { p: LevelPeg; i: number };
      const B = circles[b] as { p: LevelPeg; i: number };
      const d = Math.hypot(A.p.x - B.p.x, A.p.y - B.p.y);
      if (d < MIN_CIRCLE_GAP)
        errors.push(
          `pegs[${A.i}] et pegs[${B.i}] trop proches (${d.toFixed(1)} px < ${MIN_CIRCLE_GAP}).`,
        );
    }
  }
  const free = pegs.filter((p) => p.kind === undefined).length;
  const drawn = assign.hearts + assign.power + assign.bonus;
  if (drawn > free)
    errors.push(`assign demande ${drawn} pegs mais seuls ${free} n'ont pas de kind imposé.`);
  const hearts = pegs.filter((p) => p.kind === 'heart').length + assign.hearts;
  if (hearts < 1) errors.push('au moins 1 cristal-cœur (imposé ou tiré par assign).');
  return errors;
}

/** JSON stable et lisible : un peg par ligne, pour des diffs propres dans le dépôt. */
export function serializeLevel(level: LevelData): string {
  const { pegs, ...head } = level;
  const json = JSON.stringify({ ...head, pegs: [] }, null, 2);
  const body = pegs.length
    ? `[\n${pegs.map((p) => '    ' + JSON.stringify(p)).join(',\n')}\n  ]`
    : '[]';
  return json.replace('"pegs": []', () => `"pegs": ${body}`) + '\n';
}
