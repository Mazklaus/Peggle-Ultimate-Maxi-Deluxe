/**
 * Constellation du jour (règles du Game Designer, regles-modes-jalon3.md, section 2) :
 * un niveau déterministe tiré de la date locale du joueur (AAAAMMJJ). Même date = même JSON,
 * sur toutes les machines : PRNG mulberry32, coordonnées entières, aucun Math.random. Sans Phaser.
 */
import {
  COMPANIONS,
  parseLevel,
  serializeLevel,
  type DecorItem,
  type LevelData,
  type LevelPeg,
} from './levelFormat';

export type Rng = () => number;

/** Clé du jour dans le fuseau du joueur : 20261116. Remise à zéro à minuit heure locale. */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** Hachage FNV-1a 32 bits (entier non signé). */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** PRNG mulberry32 : suite identique pour une même graine, valeurs dans [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)] as T;
const between = (rng: Rng, min: number, max: number): number => min + rng() * (max - min);

// ---------- composition (Game Designer) ----------

export const DAILY = {
  orbs: 12,
  hearts: 20,
  commons: 70,
  bonus: 1,
  power: 2,
  jitter: 12,
  /** Écart pris par le générateur (le format en exige 22). */
  minGap: 24,
  zone: { x0: 20, x1: 860, y0: 100, y1: 570 },
  maxAttempts: 64,
  /** Communs imposés le long des bords contre les angles morts (règle du Level Designer). */
  guards: [230, 330, 430, 530].flatMap((y) => [
    [30, y],
    [850, y],
  ]) as ReadonlyArray<readonly [number, number]>,
  /** Un cristal sur l'axe du canon. */
  axis: [440, 150] as const,
} as const;
const PEG_COUNT = DAILY.hearts + DAILY.commons + DAILY.bonus + DAILY.power;

// ---------- gabarits (motifs du Level Designer) ----------

type Pt = [number, number];
interface Wall {
  x: number;
  y: number;
  w: number;
  angle: number;
}
interface Layout {
  points: Pt[];
  walls: Wall[];
}

const rad = (deg: number): number => (deg * Math.PI) / 180;
function arc(cx: number, cy: number, r: number, a0: number, a1: number, n: number): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = rad(a0 + ((a1 - a0) * i) / Math.max(1, n - 1));
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Pt;
  });
}
function ring(cx: number, cy: number, r: number, n: number, phase = 0): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = rad(phase + (360 * i) / n);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Pt;
  });
}
function disc(cx: number, cy: number, r: number, step = 44): Pt[] {
  const out: Pt[] = [[cx, cy]];
  for (let k = 1; k * step <= r; k++)
    out.push(
      ...ring(cx, cy, k * step, Math.max(6, Math.floor((2 * Math.PI * k * step) / step)), 15 * k),
    );
  return out;
}
function grid(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  dx: number,
  dy: number,
  stagger: boolean,
): Pt[] {
  const out: Pt[] = [];
  for (let y = y0, row = 0; y <= y1; y += dy, row++)
    for (let x = x0 + (stagger && row % 2 ? dx / 2 : 0); x <= x1; x += dx) out.push([x, y]);
  return out;
}

/** Six gabarits ; chacun propose un peu plus de points que nécessaire, l'excédent est retiré. */
export const TEMPLATES: Record<string, (rng: Rng) => Layout> = {
  nuee: (rng) => {
    const n = 3 + Math.floor(rng() * 2);
    const points: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const cx = 140 + (600 * (i + 0.5)) / n + between(rng, -30, 30);
      points.push(...disc(cx, between(rng, 260, 420), 140));
    }
    return { points, walls: [] };
  },
  bols: (rng) => {
    // Arcs concentriques (comme thick() de levels.py) : l'orbe roule dans le bol.
    // 3 bols en haut, 2 en quinconce dessous ; 2 à 3 arcs de 10 à 170°, espacés de 40 px.
    const points: Pt[] = [];
    const bowls: Pt[] = [
      [160, between(rng, 170, 200)],
      [440, between(rng, 170, 200)],
      [720, between(rng, 170, 200)],
      [300, between(rng, 340, 370)],
      [580, between(rng, 340, 370)],
    ];
    for (const [cx, cy] of bowls) {
      const outer = between(rng, 100, 130);
      const arcs = rng() < 0.3 ? 2 : 3;
      for (let k = 0; k < arcs; k++) {
        const r = outer - 40 * k;
        points.push(...arc(cx, cy, r, 10, 170, Math.max(3, Math.round((rad(160) * r) / 29) + 1)));
      }
    }
    const tilt = between(rng, 20, 35);
    return {
      points,
      walls: [
        { x: 300, y: 535, w: 90, angle: Math.round(tilt) },
        { x: 580, y: 535, w: 90, angle: -Math.round(tilt) },
      ],
    };
  },
  colonnes: (rng) => {
    // 15 colonnes fines (57 px) à phase verticale tirée par colonne, pas de 56 px.
    // Au simulateur, des colonnes plus espacées (7 à 9) restaient à ~0,2 de victoire :
    // l'orbe filait entre sans rien toucher. Nombre impair : une colonne sous le canon.
    const cols = 15;
    const step = 56;
    const sp = 800 / (cols - 1);
    const points: Pt[] = [];
    for (let c = 0; c < cols; c++) {
      const x = 40 + sp * c;
      for (let y = between(rng, 120, 120 + step); y <= 565; y += step) points.push([x, y]);
    }
    return { points, walls: [] };
  },
  arches: (rng) => {
    const points: Pt[] = [];
    const cy = between(rng, 540, 580);
    for (let k = 0; k < 7; k++) {
      const r = 130 + 56 * k;
      points.push(...arc(440, cy, r, 200, 340, Math.round(r / 17)));
    }
    return { points, walls: [] };
  },
  spirale: (rng) => {
    const twin = rng() < 0.5;
    const phase = between(rng, 0, 360);
    const centers: Pt[] = twin
      ? [
          [235, 340],
          [645, 340],
        ]
      : [[440, 340]];
    const shape = twin
      ? { r0: 25, r1: 200, sx: 1, turns: 2.4 }
      : { r0: 30, r1: 225, sx: 1.75, turns: 2.8 };
    const points: Pt[] = [];
    for (const [cx, cy] of centers) {
      // Écart entre spires (r1 - r0) / turns >= 65 px : >= 50 px même avec le jitter.
      // Points espacés de ~31 px le long de la courbe, échantillonnée finement.
      let last: Pt | null = null;
      for (let i = 0; i <= 4000; i++) {
        const t = i / 4000;
        const r = shape.r0 + (shape.r1 - shape.r0) * t;
        const a = rad(phase + 360 * shape.turns * t);
        const p: Pt = [cx + shape.sx * r * Math.cos(a), cy + r * Math.sin(a)];
        if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= 31) {
          points.push(p);
          last = p;
        }
      }
    }
    return { points, walls: [] };
  },
  damier: (rng) => {
    // Diagonales à ~55 px (hypot(25, 50)) au lieu de 45 : l'orbe passe entre les cases.
    const cell = 3 + Math.floor(rng() * 2);
    const points = grid(60, 820, 130, 560, 50, 50, true).filter(([x, y]) => {
      const cx = Math.floor((x - 60) / (50 * cell));
      const cy = Math.floor((y - 130) / (50 * cell));
      return (cx + cy) % 2 === 0 || rng() < 0.45;
    });
    return { points, walls: [] };
  },
};
export const TEMPLATE_NAMES = Object.keys(TEMPLATES);

// ---------- décor ----------

/** 0 ou 1 élément connu : rotation (petite roue), orbite (deux lunes) ou aimant. */
function addDecor(
  rng: Rng,
  kind: 'none' | 'rotate' | 'orbit' | 'magnet',
): { decor: DecorItem[]; group: Pt[]; clear: (p: Pt) => boolean } {
  const cx = Math.round(between(rng, 260, 620));
  const cy = Math.round(between(rng, 260, 420));
  if (kind === 'rotate') {
    const r = 56;
    return {
      decor: [{ id: 'roue', type: 'rotate', cx, cy, periodS: 14, dir: rng() < 0.5 ? 1 : -1 }],
      group: ring(cx, cy, r, 7, between(rng, 0, 360)),
      clear: ([x, y]) => Math.abs(Math.hypot(x - cx, y - cy) - r) < DAILY.minGap + 2,
    };
  }
  if (kind === 'orbit') {
    const r = 70;
    return {
      decor: [
        { id: 'lunes', type: 'orbit', cx, cy, rx: r, ry: r, periodS: 6, dir: rng() < 0.5 ? 1 : -1 },
      ],
      group: ring(cx, cy, r, 2, between(rng, 0, 360)),
      clear: ([x, y]) => Math.abs(Math.hypot(x - cx, y - cy) - r) < DAILY.minGap + 2,
    };
  }
  if (kind === 'magnet')
    return {
      decor: [{ id: 'aimant', type: 'magnet', x: cx, y: cy, radius: 110, strength: 1 }],
      group: [],
      clear: ([x, y]) => Math.hypot(x - cx, y - cy) < 34,
    };
  return { decor: [], group: [], clear: () => false };
}

// ---------- assemblage ----------

function inZone([x, y]: Pt): boolean {
  const z = DAILY.zone;
  return x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1;
}

function segDistance([px, py]: Pt, w: Wall): number {
  const c = Math.cos(rad(w.angle));
  const s = Math.sin(rad(w.angle));
  const t = Math.max(-w.w / 2, Math.min(w.w / 2, (px - w.x) * c + (py - w.y) * s));
  return Math.hypot(px - (w.x + t * c), py - (w.y + t * s));
}

/** Une tentative pour une graine donnée ; null si la composition est impossible. */
function attempt(seed: number, key: string): LevelData | null {
  const rng = mulberry32(seed);
  const template = pick(rng, TEMPLATE_NAMES);
  const layout = (TEMPLATES[template] as (r: Rng) => Layout)(rng);
  const decorKind = pick(rng, ['none', 'none', 'rotate', 'orbit', 'magnet'] as const);
  const companion = pick(rng, COMPANIONS);
  const deco = addDecor(rng, decorKind);

  const pegs: LevelPeg[] = [];
  const far = (p: Pt): boolean =>
    pegs.every((q) => Math.hypot(q.x - p[0], q.y - p[1]) >= DAILY.minGap);
  for (const [x, y] of DAILY.guards) pegs.push({ x, y, kind: 'common' });
  if (far([DAILY.axis[0], DAILY.axis[1]])) pegs.push({ x: DAILY.axis[0], y: DAILY.axis[1] });
  const group = deco.decor[0]?.id;
  for (const g of deco.group) {
    const p: Pt = [Math.round(g[0]), Math.round(g[1])];
    if (inZone(p) && far(p)) pegs.push({ x: p[0], y: p[1], group });
  }
  const free: LevelPeg[] = [];
  for (const raw of layout.points) {
    const j = DAILY.jitter;
    const p: Pt = [
      Math.round(raw[0] + between(rng, -j, j)),
      Math.round(raw[1] + between(rng, -j, j)),
    ];
    if (!inZone(p) || deco.clear(p) || !far(p)) continue;
    if (layout.walls.some((w) => segDistance(p, w) < 26)) continue;
    const peg = { x: p[0], y: p[1] };
    pegs.push(peg);
    free.push(peg);
  }
  const extra = pegs.length - PEG_COUNT;
  if (extra < 0) return null;
  // Retrait régulier de l'excédent (garde la silhouette), jamais un peg de groupe.
  const drop = new Set<LevelPeg>();
  for (let i = 0; i < extra; i++) drop.add(free[Math.floor((i * free.length) / extra)] as LevelPeg);
  const kept = pegs.filter((p) => !drop.has(p));
  for (const w of layout.walls)
    kept.push({ x: w.x, y: w.y, shape: 'brick', w: w.w, h: 12, angle: w.angle, kind: 'wall' });

  const level: LevelData = {
    format: deco.decor.length ? 2 : 1,
    id: `jour-${key}`,
    chapter: 0,
    index: 1,
    companion,
    companionLocked: true,
    title: `Constellation du jour (${template})`,
    orbs: DAILY.orbs,
    stars: [700 * DAILY.hearts, 1200 * DAILY.hearts],
    assign: { hearts: DAILY.hearts, power: DAILY.power, bonus: DAILY.bonus },
    pegs: kept,
    decor: deco.decor,
  };
  return parseLevel(level).level ?? null;
}

export interface DailyLevel {
  key: string;
  /** Graine retenue (graine de la date + n tentatives). */
  seed: number;
  level: LevelData;
  json: string;
}

/** Niveau du jour pour une clé AAAAMMJJ ; si un essai est invalide, graine + 1. */
export function generateDaily(key: string = localDateKey()): DailyLevel {
  if (!/^\d{8}$/.test(key)) throw new Error(`clé de date invalide « ${key} » (AAAAMMJJ attendu)`);
  const base = hashSeed(key);
  for (let n = 0; n < DAILY.maxAttempts; n++) {
    const seed = (base + n) >>> 0;
    const level = attempt(seed, key);
    if (level) return { key, seed, level, json: serializeLevel(level) };
  }
  throw new Error(`aucun niveau valide pour ${key}`);
}
