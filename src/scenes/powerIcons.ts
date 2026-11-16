/**
 * Pictogrammes des pouvoirs des Astres (specs UI/UX jalon 2, 2.2) et petits portraits.
 * Dessin vectoriel centré en (x, y) dans un carré de côté `size` ; traits arrondis.
 * Partagé par la carte (pastille, sélecteur) et la loge de l'Astre en jeu.
 */
import Phaser from 'phaser';
import { PALETTE } from './theme';

/** Menthe des pouvoirs (tout ce qui vient d'un pouvoir reste menthe). */
export const POWER_MINT = PALETTE.success;
const INK = 0x0b1026;

type V = Phaser.Math.Vector2;
const v = (x: number, y: number): V => new Phaser.Math.Vector2(x, y);

/** Hexagone (pointe en haut) de diamètre d, rempli en menthe. */
export function drawPowerHex(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  d: number,
  alpha = 1,
): void {
  const r = d / 2;
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    return v(x + Math.cos(a) * r, y + Math.sin(a) * r);
  });
  g.fillStyle(POWER_MINT, alpha).fillPoints(pts, true);
}

/** Pictogramme du pouvoir de l'Astre `id`, en encre nuit, dans un carré de côté size. */
export function drawPowerIcon(
  g: Phaser.GameObjects.Graphics,
  id: string,
  x: number,
  y: number,
  size: number,
  color = INK,
): void {
  const s = size / 24; // dessin sur une grille de 24
  const w = Math.max(1.5, 3.5 * s * 0.6);
  g.lineStyle(w, color, 1);
  g.fillStyle(color, 1);
  const P = (px: number, py: number): V => v(x + px * s, y + py * s);
  const line = (pts: V[]) => g.strokePoints(pts, false);
  switch (id) {
    case 'pip': {
      // trajectoire révélée : arc en pointillés
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        const p = P(-9 + 18 * t, 6 - 16 * t + 14 * t * t);
        g.fillCircle(p.x, p.y, w * 0.6);
      }
      break;
    }
    case 'bourdon':
      // onde de choc : 2 cercles concentriques + point central
      g.strokeCircle(x, y, 9 * s);
      g.strokeCircle(x, y, 5 * s);
      g.fillCircle(x, y, 1.8 * s);
      break;
    case 'jumelles': {
      // orbe scindé : un rond qui se divise en Y vers deux ronds
      const a = P(0, 7);
      g.fillCircle(a.x, a.y, 2.6 * s);
      line([P(0, 4), P(0, 0)]);
      line([P(0, 0), P(-6, -5)]);
      line([P(0, 0), P(6, -5)]);
      const b = P(-7, -7);
      const c = P(7, -7);
      g.fillCircle(b.x, b.y, 2.6 * s);
      g.fillCircle(c.x, c.y, 2.6 * s);
      break;
    }
    case 'volte':
      // rebond fou : zigzag montant
      line([P(-9, 8), P(-4, -2), P(0, 5), P(4, -5), P(9, -9)]);
      break;
    case 'mousse': {
      // aimant en U + petit losange
      g.beginPath();
      g.arc(x, y + 1 * s, 6 * s, 0, Math.PI, false);
      g.strokePath();
      line([P(-6, 1), P(-6, -7)]);
      line([P(6, 1), P(6, -7)]);
      g.fillPoints([P(0, -10), P(3, -7), P(0, -4), P(-3, -7)], true);
      break;
    }
    case 'horloge':
      // ralenti du temps : cadran + 2 aiguilles
      g.strokeCircle(x, y, 9 * s);
      line([P(0, 0), P(0, -6)]);
      line([P(0, 0), P(4, 2)]);
      break;
    case 'grelot':
      // orbe éclair : éclair
      g.fillPoints([P(2, -11), P(-6, 2), P(-1, 2), P(-3, 11), P(6, -2), P(1, -2)], true);
      break;
    case 'nuage-lune': {
      // seconde chance : flèche courbe qui remonte depuis une ligne
      line([P(-10, 9), P(10, 9)]);
      g.beginPath();
      g.arc(x, y + 3 * s, 6 * s, Math.PI, Math.PI * 1.9, false);
      g.strokePath();
      line([P(5, -6), P(6, -1), P(1, -2)]);
      break;
    }
    default:
      g.fillCircle(x, y, 3 * s);
  }
}

/** Portrait simple d'un Astre (tête ronde de sa couleur, deux yeux) de rayon r. */
export function drawPortrait(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  color: number,
): void {
  g.fillStyle(color, 1).fillCircle(x, y, r);
  g.fillStyle(0xffffff, 0.35).fillCircle(x - r * 0.35, y - r * 0.4, r * 0.28);
  g.fillStyle(0x1b2350, 1);
  g.fillEllipse(x - r * 0.32, y - r * 0.02, r * 0.2, r * 0.32);
  g.fillEllipse(x + r * 0.32, y - r * 0.02, r * 0.2, r * 0.32);
  g.lineStyle(Math.max(1, r * 0.1), 0x1b2350, 1);
  g.beginPath();
  g.arc(x, y + r * 0.25, r * 0.25, 0.3, Math.PI - 0.3);
  g.strokePath();
}
