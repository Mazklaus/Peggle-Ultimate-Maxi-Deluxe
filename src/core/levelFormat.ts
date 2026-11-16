/**
 * Format JSON des niveaux, v1 et v2 (voir docs/level-format.md) : types, validation et sérialisation.
 * Utilisé par le chargeur du jeu et par l'éditeur de niveaux. Sans Phaser.
 */
import { challengeErrors, type Challenge } from './challenge';

/** Format écrit par défaut (niveau sans décor). */
export const LEVEL_FORMAT = 1;
/** Format requis dès qu'un niveau a du décor ou des pegs rattachés à un groupe. */
export const LEVEL_FORMAT_DECOR = 2;
export type LevelFormatVersion = 1 | 2;
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
  'duel',
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
  /** v2 : id de l'élément de décor qui anime ce peg ; x, y = position à t = 0. */
  group?: string;
}

// ---------- décor (v2) ----------

export const DECOR_TYPES = ['rotate', 'orbit', 'magnet', 'portal', 'regen'] as const;
export type DecorType = (typeof DECOR_TYPES)[number];
export type Spin = 1 | -1;

/** Les pegs du groupe tournent autour de (cx, cy). */
export interface DecorRotate {
  id: string;
  type: 'rotate';
  cx: number;
  cy: number;
  periodS: number;
  dir: Spin;
}
/** 1 à 4 pegs parcourent l'ellipse (cx, cy, rx, ry). */
export interface DecorOrbit {
  id: string;
  type: 'orbit';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  periodS: number;
  dir: Spin;
}
/** Attire l'orbe ; aucun peg dans le groupe. */
export interface DecorMagnet {
  id: string;
  type: 'magnet';
  x: number;
  y: number;
  radius: number;
  strength: number;
}
export interface Point {
  x: number;
  y: number;
}
/** L'orbe entre en a et ressort en b avec la même vitesse (et inversement). */
export interface DecorPortal {
  id: string;
  type: 'portal';
  a: Point;
  b: Point;
}
/** Un cristal brisé du groupe réapparaît après `shots` tirs (jamais un cœur). */
export interface DecorRegen {
  id: string;
  type: 'regen';
  shots: number;
}
export type DecorItem = DecorRotate | DecorOrbit | DecorMagnet | DecorPortal | DecorRegen;
/** Alias utilisé par la simulation (src/core/decor.ts). */
export type DecorDef = DecorItem;

/** Bornes (format-decor-v2 du Level Designer ; periodS fixées par le Game Director). */
export const DECOR_LIMITS = {
  rotatePeriodS: [8, 18],
  orbitPeriodS: [4, 8],
  orbitRadius: [40, 90],
  magnetRadius: [20, 300],
  magnetStrength: [0.1, 3],
  regenShots: [1, 10],
  orbitPegs: [1, 4],
  portalR: 18,
} as const;
export const DECOR_KEYS: Record<DecorType, readonly string[]> = {
  rotate: ['id', 'type', 'cx', 'cy', 'periodS', 'dir'],
  orbit: ['id', 'type', 'cx', 'cy', 'rx', 'ry', 'periodS', 'dir'],
  magnet: ['id', 'type', 'x', 'y', 'radius', 'strength'],
  portal: ['id', 'type', 'a', 'b'],
  regen: ['id', 'type', 'shots'],
};

export interface LevelAssign {
  hearts: number;
  power: number;
  bonus: number;
}

export interface LevelData {
  /** Format lu ; à l'écriture, serializeLevel recalcule 1 ou 2 (voir levelFormatOf). */
  format: LevelFormatVersion;
  id: string;
  chapter: number;
  index: number;
  companion: Companion | null;
  companionLocked: boolean;
  title?: string;
  rhythm?: Rhythm;
  orbs: number;
  /** Guide de visée : 0 (défaut) = court, jusqu'au premier contact ; n = jusqu'au n-ième rebond. */
  guideBounces?: number;
  stars: [number, number];
  assign: LevelAssign;
  pegs: LevelPeg[];
  decor: DecorItem[];
  /** Défi posé sur le niveau (regles-modes-jalon3 §1). */
  challenge?: Challenge;
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
  if (raw.group !== undefined) {
    if (typeof raw.group !== 'string' || !raw.group) errors.push(`${where} : group = id de décor.`);
    else peg.group = raw.group;
  }
  return peg;
}

function parseDecor(raw: unknown, i: number, errors: string[]): DecorItem | null {
  const where = `decor[${i}]`;
  if (!isObj(raw)) {
    errors.push(`${where} : objet attendu.`);
    return null;
  }
  const id = raw.id;
  if (typeof id !== 'string' || !/^[a-z0-9-]+$/i.test(id)) {
    errors.push(`${where} : id obligatoire (lettres, chiffres, tirets).`);
    return null;
  }
  const at = `decor « ${id} »`;
  const before = errors.length;
  const num = (key: string, range?: readonly [number, number]): number => {
    const v = raw[key];
    if (!isNum(v)) errors.push(`${at} : ${key} numérique obligatoire.`);
    else if (range && (v < range[0] || v > range[1]))
      errors.push(`${at} : ${key} entre ${range[0]} et ${range[1]} (${v}).`);
    return v as number;
  };
  const spin = (): Spin => {
    const v = raw.dir ?? 1;
    if (v !== 1 && v !== -1) errors.push(`${at} : dir = 1 (horaire) ou -1.`);
    return v as Spin;
  };
  const point = (key: string): Point => {
    const v = raw[key];
    if (!isObj(v) || !isNum(v.x) || !isNum(v.y)) {
      errors.push(`${at} : ${key} = { x, y } obligatoire.`);
      return { x: 0, y: 0 };
    }
    const r = DECOR_LIMITS.portalR;
    if (v.x < r || v.x > ZONE_W - r || v.y < r || v.y > ZONE_H - r)
      errors.push(`${at} : ${key} hors zone (${v.x}, ${v.y}).`);
    return { x: v.x, y: v.y };
  };
  const L = DECOR_LIMITS;
  let item: DecorItem;
  switch (raw.type) {
    case 'rotate':
      item = {
        id,
        type: 'rotate',
        cx: num('cx'),
        cy: num('cy'),
        periodS: num('periodS', L.rotatePeriodS),
        dir: spin(),
      };
      break;
    case 'orbit':
      item = {
        id,
        type: 'orbit',
        cx: num('cx'),
        cy: num('cy'),
        rx: num('rx', L.orbitRadius),
        ry: num('ry', L.orbitRadius),
        periodS: num('periodS', L.orbitPeriodS),
        dir: spin(),
      };
      break;
    case 'magnet':
      item = {
        id,
        type: 'magnet',
        x: num('x', [0, ZONE_W]),
        y: num('y', [0, ZONE_H]),
        radius: num('radius', L.magnetRadius),
        strength: num('strength', L.magnetStrength),
      };
      break;
    case 'portal':
      item = { id, type: 'portal', a: point('a'), b: point('b') };
      break;
    case 'regen': {
      const shots = raw.shots;
      if (!isInt(shots) || shots < L.regenShots[0] || shots > L.regenShots[1])
        errors.push(`${at} : shots entier ${L.regenShots[0]}..${L.regenShots[1]}.`);
      item = { id, type: 'regen', shots: shots as number };
      break;
    }
    default:
      errors.push(`${at} : type inconnu « ${String(raw.type)} » (${DECOR_TYPES.join(', ')}).`);
      return null;
  }
  return errors.length === before ? item : null;
}

/** Position d'un peg d'orbite après une fraction `t` de tour (0..1). */
export function orbitPosition(o: DecorOrbit, start: Point, t: number): Point {
  const a0 = Math.atan2((start.y - o.cy) / o.ry, (start.x - o.cx) / o.rx);
  const a = a0 + o.dir * t * Math.PI * 2;
  return { x: o.cx + o.rx * Math.cos(a), y: o.cy + o.ry * Math.sin(a) };
}

/** Règles du décor : groupes existants, contenus valides, zone et écarts sur tout le tour. */
export function checkDecor(pegs: readonly LevelPeg[], decor: readonly DecorItem[]): string[] {
  const errors: string[] = [];
  const byId = new Map<string, DecorItem>();
  for (const d of decor) {
    if (byId.has(d.id)) errors.push(`decor : id « ${d.id} » en double.`);
    byId.set(d.id, d);
  }
  const members = new Map<string, number[]>();
  pegs.forEach((p, i) => {
    if (p.group === undefined) return;
    if (!byId.has(p.group)) errors.push(`pegs[${i}] : group « ${p.group} » inconnu.`);
    else members.set(p.group, [...(members.get(p.group) ?? []), i]);
  });
  // Mêmes bornes que les pegs fixes (canon au-dessus, réceptacle en dessous), sur tout le tour.
  const inZone = (x: number, y: number): boolean =>
    x >= 0 && x <= ZONE_W && y >= PEG_MIN_Y && y <= PEG_MAX_Y;
  for (const d of decor) {
    const ids = members.get(d.id) ?? [];
    const list = ids.map((i) => ({ i, p: pegs[i] as LevelPeg }));
    if ((d.type === 'magnet' || d.type === 'portal') && ids.length)
      errors.push(`decor « ${d.id} » (${d.type}) ne prend pas de peg (pegs ${ids.join(', ')}).`);
    if (d.type === 'regen')
      for (const { i, p } of list)
        if (p.kind === 'heart')
          errors.push(`pegs[${i}] : un cœur ne peut pas être dans regen « ${d.id} ».`);
    if (d.type === 'rotate')
      for (const { i, p } of list) {
        const r = Math.hypot(p.x - d.cx, p.y - d.cy);
        if (!inZone(d.cx - r, d.cy - r) || !inZone(d.cx + r, d.cy + r))
          errors.push(`pegs[${i}] sort de la zone en tournant autour de « ${d.id} ».`);
      }
    if (d.type === 'orbit') {
      const [min, max] = DECOR_LIMITS.orbitPegs;
      if (ids.length < min || ids.length > max)
        errors.push(`orbit « ${d.id} » : ${min} à ${max} pegs (${ids.length}).`);
      if (!inZone(d.cx - d.rx, d.cy - d.ry) || !inZone(d.cx + d.rx, d.cy + d.ry))
        errors.push(`orbit « ${d.id} » sort de la zone.`);
      for (const { i, p } of list) {
        const e = ((p.x - d.cx) / d.rx) ** 2 + ((p.y - d.cy) / d.ry) ** 2;
        if (Math.abs(Math.sqrt(e) - 1) > 0.05)
          errors.push(`pegs[${i}] n'est pas sur l'anneau de « ${d.id} ».`);
      }
      // Sur une ellipse, l'écart entre deux pegs varie pendant le tour : on échantillonne.
      const circles = list.filter(({ p }) => p.shape !== 'brick');
      for (let a = 0; a < circles.length; a++)
        for (let b = a + 1; b < circles.length; b++) {
          const A = circles[a] as { i: number; p: LevelPeg };
          const B = circles[b] as { i: number; p: LevelPeg };
          let minD = Infinity;
          for (let k = 0; k < 72; k++) {
            const pa = orbitPosition(d, A.p, k / 72);
            const pb = orbitPosition(d, B.p, k / 72);
            minD = Math.min(minD, Math.hypot(pa.x - pb.x, pa.y - pb.y));
          }
          if (minD < MIN_CIRCLE_GAP)
            errors.push(
              `pegs[${A.i}] et pegs[${B.i}] se rapprochent à ${minD.toFixed(1)} px sur l'orbite « ${d.id} ».`,
            );
        }
    }
  }
  errors.push(...checkSweep(pegs, byId));
  return errors;
}

/** Position d'un peg en rotation après une fraction `t` de tour (0..1). */
export function rotatePosition(r: DecorRotate, start: Point, t: number): Point {
  const a = r.dir * t * Math.PI * 2;
  const dx = start.x - r.cx;
  const dy = start.y - r.cy;
  return {
    x: r.cx + dx * Math.cos(a) - dy * Math.sin(a),
    y: r.cy + dx * Math.sin(a) + dy * Math.cos(a),
  };
}

/** Distance d'un point au segment central d'une brique. */
function brickDistance(p: Point, b: LevelPeg): number {
  const a = ((b.angle ?? 0) * Math.PI) / 180;
  const half = (b.w ?? 0) / 2;
  const t = Math.max(-half, Math.min(half, (p.x - b.x) * Math.cos(a) + (p.y - b.y) * Math.sin(a)));
  return Math.hypot(p.x - (b.x + t * Math.cos(a)), p.y - (b.y + t * Math.sin(a)));
}

/**
 * Trajectoires : un cercle en rotation ou en orbite ne doit croiser aucun peg fixe
 * (22 px avec un cercle, contact avec une brique). Les briques mobiles ne sont pas vérifiées.
 */
function checkSweep(pegs: readonly LevelPeg[], byId: ReadonlyMap<string, DecorItem>): string[] {
  const errors: string[] = [];
  const isMoving = (p: LevelPeg): DecorRotate | DecorOrbit | null => {
    const d = p.group === undefined ? undefined : byId.get(p.group);
    return d && (d.type === 'rotate' || d.type === 'orbit') ? d : null;
  };
  const fixed = pegs.map((p, i) => ({ p, i })).filter(({ p }) => !isMoving(p));
  const STEPS = 120;
  pegs.forEach((p, i) => {
    const d = isMoving(p);
    if (!d || p.shape === 'brick') return;
    const r = p.r ?? DEFAULT_PEG_R;
    for (const { p: f, i: j } of fixed) {
      let hit = false;
      for (let k = 0; k < STEPS && !hit; k++) {
        const pos =
          d.type === 'rotate' ? rotatePosition(d, p, k / STEPS) : orbitPosition(d, p, k / STEPS);
        hit =
          f.shape === 'brick'
            ? brickDistance(pos, f) < r + (f.h ?? 0) / 2
            : Math.hypot(pos.x - f.x, pos.y - f.y) < MIN_CIRCLE_GAP;
      }
      if (hit) errors.push(`pegs[${i}] (« ${d.id} ») passe sur le peg fixe pegs[${j}].`);
    }
  });
  return errors;
}

/** Format à écrire : 2 si le niveau utilise du décor ou des groupes, sinon 1. */
export function levelFormatOf(level: Pick<LevelData, 'pegs' | 'decor'>): LevelFormatVersion {
  return level.decor.length > 0 || level.pegs.some((p) => p.group !== undefined)
    ? LEVEL_FORMAT_DECOR
    : LEVEL_FORMAT;
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

  const format = raw.format;
  if (format !== LEVEL_FORMAT && format !== LEVEL_FORMAT_DECOR)
    return {
      errors: [
        `format ${String(format)} non pris en charge (attendu : ${LEVEL_FORMAT} ou ${LEVEL_FORMAT_DECOR}).`,
      ],
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
  if (
    raw.guideBounces !== undefined &&
    (!isInt(raw.guideBounces) || raw.guideBounces < 0 || raw.guideBounces > 5)
  )
    errors.push('guideBounces : entier 0..5.');
  if (raw.challenge !== undefined) errors.push(...challengeErrors(raw.challenge, COMPANIONS));
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

  // Décor : réservé et ignoré en v1, typé et validé en v2.
  let decor: DecorItem[] = [];
  if (raw.decor !== undefined && !Array.isArray(raw.decor)) errors.push('decor : tableau.');
  const rawDecor = Array.isArray(raw.decor) ? raw.decor : [];
  if (format === LEVEL_FORMAT) {
    if (pegs.some((p) => p.group !== undefined) || rawDecor.length)
      errors.push(`décor et « group » demandent "format": ${LEVEL_FORMAT_DECOR}.`);
  } else {
    decor = rawDecor
      .map((d, i) => parseDecor(d, i, errors))
      .filter((d): d is DecorItem => d !== null);
    if (decor.length === rawDecor.length) errors.push(...checkDecor(pegs, decor));
  }

  if (errors.length) return { errors };
  const level: LevelData = {
    format,
    id: id as string,
    chapter: chapter as number,
    index: index as number,
    companion: companion as Companion | null,
    companionLocked: companionLocked as boolean,
    orbs: orbs as number,
    stars: [(stars as number[])[0] as number, (stars as number[])[1] as number],
    assign,
    pegs,
    decor,
  };
  if (raw.title !== undefined) level.title = raw.title as string;
  if (raw.rhythm !== undefined) level.rhythm = raw.rhythm as Rhythm;
  if (raw.guideBounces !== undefined) level.guideBounces = raw.guideBounces as number;
  if (raw.challenge !== undefined) level.challenge = raw.challenge as Challenge;
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

const LEVEL_KEYS = [
  'format',
  'id',
  'chapter',
  'index',
  'companion',
  'companionLocked',
  'title',
  'rhythm',
  'orbs',
  'guideBounces',
  'challenge',
  'stars',
  'assign',
] as const;
const PEG_KEYS = ['x', 'y', 'shape', 'r', 'w', 'h', 'angle', 'kind', 'group'] as const;

/** Objet ou tableau court sur une ligne : {"x": 60, "y": 120}. */
function inline(value: unknown): string {
  return JSON.stringify(value).replace(/([:,])(?=["\d[{tfn-])/g, '$1 ');
}

/**
 * Forme canonique des fichiers du dépôt (public/levels) : clés dans un ordre fixe,
 * un peg par ligne. Relire puis réécrire un fichier canonique le laisse identique.
 */
export function serializeLevel(level: LevelData): string {
  const out: LevelData = { ...level, format: levelFormatOf(level) };
  const head = LEVEL_KEYS.filter((k) => out[k] !== undefined).map((k) => {
    const v = out[k];
    const text =
      k === 'stars'
        ? `[\n    ${(v as number[]).join(',\n    ')}\n  ]`
        : k === 'assign'
          ? JSON.stringify(v, null, 2).replace(/\n/g, '\n  ')
          : JSON.stringify(v);
    return `  "${k}": ${text}`;
  });
  const pegs = level.pegs.map((p) => {
    const ordered: Record<string, unknown> = {};
    for (const k of PEG_KEYS) if (p[k] !== undefined) ordered[k] = p[k];
    return '    ' + inline(ordered);
  });
  const pegsText = pegs.length ? `[\n${pegs.join(',\n')}\n  ]` : '[]';
  const decor = level.decor.map((d) => {
    const ordered: Record<string, unknown> = {};
    for (const k of DECOR_KEYS[d.type]) ordered[k] = (d as unknown as Record<string, unknown>)[k];
    return '    ' + inline(ordered);
  });
  const decorText = decor.length ? `[\n${decor.join(',\n')}\n  ]` : '[]';
  return `{\n${[...head, `  "pegs": ${pegsText}`, `  "decor": ${decorText}`].join(',\n')}\n}\n`;
}
