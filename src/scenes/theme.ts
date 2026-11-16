/**
 * Tokens visuels (direction visuelle de la DA + specs UI/UX), partagés par les scènes.
 * Réf. : /mnt/project-files/da/direction-visuelle.md et ui-ux/specs-ecrans-jalon1.md (section 0).
 */
import type { CrystalKind } from '../core/level';

export const PALETTE = {
  // fond (ciel)
  night: 0x0b1026,
  nightLight: 0x141b3d,
  horizon: 0x232a5c,
  nebula: 0x3b2e6e,
  starDim: 0x6f78b8,
  // éléments de jeu
  lit: 0xfff6e0,
  orb: 0xfff6e0,
  orbHalo: 0xffe6a8,
  bucket: 0xb9a6ff,
  bucketEdge: 0xe3daff,
  cannon: 0x8c93c9,
  // UI
  panel: 0x1b2350,
  accent: 0xb9a6ff,
  success: 0x4ff0a8,
  alert: 0xff7a6b,
  border: 0x2e3870,
  textMain: 0xf4f1ff,
  textDim: 0xa9b0d6,
};

/** Opacité standard des panneaux d'UI. */
export const PANEL_ALPHA = 0.85;

export const CRYSTAL_COLORS: Record<CrystalKind, number> = {
  heart: 0xffb23f,
  common: 0x6fcbff,
  bonus: 0xff5fa2,
  power: 0x4ff0a8,
  wall: 0x6f78b8,
};

/** Mode daltonien (Okabe-Ito) : formes inchangées, couleurs remplacées. */
export const CRYSTAL_COLORS_CB: Record<CrystalKind, number> = {
  heart: 0xe69f00,
  common: 0x56b4e9,
  bonus: 0xcc79a7,
  power: 0xf0e442,
  wall: 0x6f78b8,
};

export const TEXT = {
  main: '#F4F1FF',
  dim: '#A9B0D6',
  /** Texte posé sur un fond lavande (bouton principal). */
  onAccent: '#0B1026',
  alert: '#FF7A6B',
  /** Titres, chiffres, scores. */
  font: 'Fredoka, Nunito, sans-serif',
  /** Libellés courts et texte courant. */
  body: 'Nunito, sans-serif',
};

/** Cotes communes des widgets (specs UI/UX, section 0). */
export const UI = {
  primaryHeight: 72,
  primaryRadius: 36,
  secondaryDiameter: 64,
  minTarget: 48,
  panelRadius: 16,
  toggle: { w: 52, h: 28 },
  slider: { w: 240, knob: 28 },
  hoverScale: 1.06,
  pressScale: 0.94,
  pressMs: 80,
};

export function textStyle(
  size: number,
  color = TEXT.main,
): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: TEXT.font, fontSize: `${size}px`, color, fontStyle: '600' };
}

/** Style Nunito (libellés courts). */
export function bodyStyle(
  size: number,
  color = TEXT.dim,
  bold = true,
): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: TEXT.body, fontSize: `${size}px`, color, fontStyle: bold ? '700' : '400' };
}

/**
 * Attend que Fredoka et Nunito soient chargées (liens Google Fonts dans index.html),
 * pour éviter que Phaser dessine les textes avec la police de secours. Ne bloque jamais plus de 2 s.
 */
export function loadFonts(timeoutMs = 2000): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  const loads = Promise.all([
    document.fonts.load('600 24px Fredoka'),
    document.fonts.load('400 16px Nunito'),
    document.fonts.load('700 16px Nunito'),
  ]).then(() => undefined);
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  return Promise.race([loads, timeout]).catch(() => undefined);
}
