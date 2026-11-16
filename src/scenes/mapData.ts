/**
 * Données de la carte du ciel (DA + specs UI/UX jalon 2) : constellations des 8 chapitres,
 * teintes, Astres, miniatures de la vue ciel.
 */
import type { CompanionDef } from '../core/companion/types';
import { companionById } from '../companions';
import NODES from './carte-noeuds.json';
import CONSTELLATIONS from './constellations.json';

export interface Point {
  x: number;
  y: number;
}

export interface ChapterDef {
  n: number;
  name: string;
  /** Astre du chapitre (id du format de niveau). */
  astre: string;
  /** Couleur signature de l'Astre (halos, sol). */
  accent: number;
  /** Clé de texture et fichier du fond de la vue chapitre. */
  bg: { key: string; file: string };
  /** Positions des 12 niveaux dans la vue chapitre (1280 × 720), ordre de jeu. */
  nodes: Point[];
  /** Arêtes de la figure (indices dans nodes). */
  edges: Array<[number, number]>;
}

type RawConstellation = { nom: string; niveaux: Point[]; aretes: number[][] };
const RAW = CONSTELLATIONS as unknown as Record<string, RawConstellation>;

const ASTRES: Record<number, { astre: string; accent: number }> = {
  1: { astre: 'pip', accent: 0xffe45c },
  2: { astre: 'bourdon', accent: 0xffa98a },
  3: { astre: 'jumelles', accent: 0x8fe3ff },
  4: { astre: 'volte', accent: 0xff6b4a },
  5: { astre: 'mousse', accent: 0x7ee0c6 },
  6: { astre: 'horloge', accent: 0xe8d9b0 },
  7: { astre: 'grelot', accent: 0xa8f06a },
  8: { astre: 'nuage-lune', accent: 0xd6dcff },
};

function chapterDef(n: number): ChapterDef {
  const a = ASTRES[n] ?? { astre: 'pip', accent: 0xffe45c };
  if (n === 1) {
    const nodes = NODES.chapitre1;
    return {
      n,
      name: 'le Cerf-Volant',
      ...a,
      bg: { key: 'carte-fond', file: 'da/decors/carte-fond.svg' },
      nodes,
      edges: nodes.slice(1).map((_, i) => [i, i + 1] as [number, number]),
    };
  }
  const raw = RAW[`chapitre${n}`];
  return {
    n,
    name: raw?.nom ?? `Chapitre ${n}`,
    ...a,
    bg: { key: `fond-ch${n}`, file: `da/decors/fond-ch${n}.svg` },
    nodes: raw?.niveaux ?? [],
    edges: (raw?.aretes ?? []).map(([i, j]) => [i ?? 0, j ?? 0] as [number, number]),
  };
}

export const CHAPTERS: ChapterDef[] = [1, 2, 3, 4, 5, 6, 7, 8].map(chapterDef);
export const chapter = (n: number): ChapterDef => CHAPTERS[n - 1] ?? CHAPTERS[0]!;

export const PROLOGUE_NODES: Point[] = NODES.prologue;
export const OBSERVATORY: Point = NODES.observatoire;

/** Vue ciel (specs UI/UX jalon 2, 1.1). */
export const SKY = {
  bg: { key: 'fond-ciel', file: 'da/decors/fond-ciel.svg' },
  observatory: { key: 'observatoire', file: 'da/decors/observatoire.svg' },
  veilleuse: { x: 760, y: 340, r: [132, 168] as const, alpha: [0.36, 0.54] as const },
  miniScale: 0.45,
  /** Centres des miniatures, ordre de l'aventure (spirale autour de la Veilleuse). */
  minis: [
    { x: 420, y: 190 },
    { x: 640, y: 120 },
    { x: 880, y: 140 },
    { x: 1080, y: 250 },
    { x: 1090, y: 460 },
    { x: 880, y: 570 },
    { x: 620, y: 560 },
    { x: 470, y: 400 },
  ] as Point[],
};

/** Positions d'une constellation réduite et centrée sur sa miniature de la vue ciel. */
export function miniPoints(c: ChapterDef): { points: Point[]; box: { w: number; h: number } } {
  const xs = c.nodes.map((p) => p.x);
  const ys = c.nodes.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const at = SKY.minis[c.n - 1] ?? { x: 640, y: 360 };
  const s = SKY.miniScale;
  return {
    points: c.nodes.map((p) => ({ x: at.x + (p.x - cx) * s, y: at.y + (p.y - cy) * s })),
    box: { w: (Math.max(...xs) - Math.min(...xs)) * s, h: (Math.max(...ys) - Math.min(...ys)) * s },
  };
}

/** Définition animée d'un Astre, si elle est déjà portée en jeu (sinon null : Gardienne seule). */
export function astreDef(id: string): CompanionDef | null {
  return companionById(id)?.def ?? null;
}
