/**
 * Fond de chapitre en jeu (specs-decors du DA), sans Phaser : couches de parallaxe, lueur de
 * la Grande Veilleuse, étoiles de la constellation gagnées.
 */
import { chapterLevelIds, chapterOf } from './mapProgress';
import type { SaveData } from './save';

export interface BackdropLayer {
  /** Clé de texture (unique par chapitre). */
  key: string;
  file: string;
  /** Décalage relatif au mouvement de visée (0 = fixe). */
  parallax: number;
  /** Dérive horizontale en boucle (px/s), 0 = aucune. */
  drift: number;
}

/** Couches du DA, dans l'ordre d'affichage. Le prologue reprend le ciel du chapitre 1. */
export function backdropLayers(chapter: number): BackdropLayer[] {
  const n = Math.min(8, Math.max(1, Math.round(chapter)));
  const layer = (name: string, parallax: number, drift = 0): BackdropLayer => ({
    key: `jeu-ch${n}-${name}`,
    file: `da/decors/jeu/ch${n}-${name}.svg`,
    parallax,
    drift,
  });
  if (n === 1) {
    return [
      layer('1-ciel', 0),
      layer('2-etoiles', 0.02),
      layer('3-nuages-loin', 0.04, 6),
      layer('4-nuages-pres', 0.08, 12),
    ];
  }
  return [
    layer('1-ciel', 0),
    layer('2-etoiles', 0.02),
    // Brume du chapitre 5 : le motif dérive lui aussi, très lentement.
    layer('3-motif', 0.03, n === 5 ? 4 : 0),
    layer('4-nuages-loin', 0.04, 6),
    layer('5-nuages-pres', 0.08, 12),
  ];
}

/** Lueur de la Grande Veilleuse : grossit d'un chapitre à l'autre (r 132 -> 168, 0.36 -> 0.54). */
export function veilleuseGlow(chapter: number): { x: number; y: number; r: number; alpha: number } {
  const n = Math.min(8, Math.max(1, Math.round(chapter)));
  const k = n === 1 ? 0 : (n - 2) / 6;
  return { x: 640, y: 90, r: n === 1 ? 130 : 132 + 36 * k, alpha: 0.36 + 0.18 * k };
}

/** Passage d'étoiles filantes / comètes (ch.4 comètes, ch.7 étoiles filantes). */
export function hasShootingStars(chapter: number): boolean {
  return chapter === 4 || chapter === 7;
}

/**
 * Étoiles de la constellation gagnées à la victoire de `levelId` : niveaux du chapitre déjà
 * terminés plus celui-ci (indices dans l'ordre de jeu). `complete` : toute la figure s'allume
 * (niveau 12 gagné, ou les 12 terminés).
 */
export function earnedStars(
  save: SaveData | undefined,
  levelId: string,
): { indices: number[]; complete: boolean } {
  const chapter = chapterOf(levelId);
  if (chapter === null || chapter === 0) return { indices: [], complete: false };
  const ids = chapterLevelIds(chapter);
  const indices = ids
    .map((id, i) => (id === levelId || save?.levels[id]?.completed ? i : -1))
    .filter((i) => i >= 0);
  const complete = indices.length === ids.length || ids.indexOf(levelId) === ids.length - 1;
  return { indices: complete ? ids.map((_, i) => i) : indices, complete };
}
