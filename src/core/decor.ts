/**
 * Éléments de décor animés (jalon 2, format de niveau v2) : mouvement des pegs d'un groupe,
 * logique pure, sans Phaser. Coordonnées : zone de jeu 880 × 656 (comme les pegs).
 *
 * Un peg rejoint un élément par "group" ; ses x, y sont sa position à t = 0.
 * Le temps est celui du jeu (ralenti et pause compris), en secondes.
 */
import type { DecorMagnet, DecorOrbit, DecorRotate } from './levelFormat';
import { ORB_PHYSICS } from './physics';

export type RotateDecor = DecorRotate;
export type OrbitDecor = DecorOrbit;

/** Éléments qui déplacent leurs pegs (les autres agissent sur l'orbe ou les cristaux). */
export type MovingDecor = RotateDecor | OrbitDecor;

export interface PegPose {
  x: number;
  y: number;
  /** Angle parcouru par le groupe (rad). Info seulement : un cristal ne tourne pas sur lui-même (DA). */
  angle: number;
}

export function isMovingDecor(d: { type?: unknown }): d is MovingDecor {
  return d.type === 'rotate' || d.type === 'orbit';
}

/** Angle parcouru par l'élément à l'instant t (rad). */
export function decorAngle(d: MovingDecor, t: number): number {
  return (d.dir * 2 * Math.PI * t) / d.periodS;
}

/** Position d'un peg du groupe à l'instant t, depuis sa position de départ (x0, y0). */
export function pegPoseAt(d: MovingDecor, x0: number, y0: number, t: number): PegPose {
  const a = decorAngle(d, t);
  if (d.type === 'rotate') {
    const dx = x0 - d.cx;
    const dy = y0 - d.cy;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { x: d.cx + dx * c - dy * s, y: d.cy + dx * s + dy * c, angle: a };
  }
  // Orbite : le peg glisse sur l'ellipse depuis son angle de départ, sans tourner sur lui-même.
  const a0 = Math.atan2((y0 - d.cy) / d.ry, (x0 - d.cx) / d.rx);
  return { x: d.cx + d.rx * Math.cos(a0 + a), y: d.cy + d.ry * Math.sin(a0 + a), angle: 0 };
}

/** Distance maximale parcourue par un peg (départ x0, y0) pendant `seconds` (borne haute). */
export function pegTravel(d: MovingDecor, x0: number, y0: number, seconds: number): number {
  const sweep = Math.min(Math.PI, (2 * Math.PI * seconds) / d.periodS);
  const r = d.type === 'rotate' ? Math.hypot(x0 - d.cx, y0 - d.cy) : Math.max(d.rx, d.ry);
  // Corde de l'arc balayé (au plus un demi-tour : au-delà la distance redescend).
  return 2 * r * Math.sin(sweep / 2);
}

/**
 * Aimant (GD reglages-jalon2 §2) : champ radial qui attire l'orbe, maximal juste hors de la
 * zone morte (20 px, anti-collage), nul au bord du rayon. strength 1 = 300 px/s² du
 * prototype (milieu de 250-400), mis à l'échelle du ralenti global (×k², comme la gravité).
 */
export const MAGNET = {
  accel: 300 * ORB_PHYSICS.slowdown * ORB_PHYSICS.slowdown,
  deadZone: 20,
};

export function isMagnet(d: { type?: unknown }): d is DecorMagnet {
  return d.type === 'magnet';
}

/** Accélération (px/s² de temps de jeu) des aimants sur l'orbe en (x, y), coordonnées du niveau. */
export function magnetAccel(
  magnets: ReadonlyArray<DecorMagnet>,
  x: number,
  y: number,
): { ax: number; ay: number } {
  let ax = 0;
  let ay = 0;
  for (const m of magnets) {
    const dx = m.x - x;
    const dy = m.y - y;
    const d = Math.hypot(dx, dy);
    const w = magnetWeight(m, d);
    if (w <= 0) continue;
    const a = MAGNET.accel * m.strength * w;
    ax += (dx / d) * a;
    ay += (dy / d) * a;
  }
  return { ax, ay };
}

/** Force relative (0..1) d'un aimant à la distance d de son centre. */
export function magnetWeight(m: DecorMagnet, d: number): number {
  if (d <= MAGNET.deadZone || d >= m.radius) return 0;
  return 1 - (d - MAGNET.deadZone) / Math.max(1, m.radius - MAGNET.deadZone);
}
