/**
 * Pouvoirs des Astres (chiffrage Game Designer, reglages-jalon1.md).
 * Jalon 1 : Pip, trajectoire révélée sur les tirs suivants.
 */
import { ORB_PHYSICS } from './physics';

export const PIP_POWER = {
  chargesPerActivation: 2,
  maxCharges: 4,
  previewBounces: 3,
  /** 1,5 s à la vitesse du prototype, allongé avec le ralenti de l'orbe (GD). */
  previewSeconds: 1.5 / ORB_PHYSICS.slowdown,
};

/** Réglage d'un pouvoir « tir suivant » : charges gagnées au cristal pouvoir, plafond. */
export interface ChargeRule {
  chargesPerActivation: number;
  maxCharges: number;
}

/**
 * Aimant à cœurs de Mousse (GD reglages-jalon1, reglages-jalon2 §4 bis) : sur le tir chargé,
 * l'orbe est attirée vers le cristal-cœur non allumé le plus proche dans la portée,
 * accélération proportionnelle à la proximité. Portée ×1,1 (terrain 880 × 656, comme
 * l'onde de Bourdon) ; accélération du prototype mise à l'échelle du ralenti global (×k²,
 * comme la gravité), pour garder la même courbe en plus lent.
 */
export const MOUSSE_POWER = {
  chargesPerActivation: 1,
  maxCharges: 2,
  range: 160 * 1.1,
  /** px/s² de temps de jeu. */
  accel: 400 * ORB_PHYSICS.slowdown * ORB_PHYSICS.slowdown,
};

/** Charges d'un pouvoir « tir suivant » : gagnées au cristal pouvoir, consommées au tir. */
export class ShotCharges {
  private n = 0;
  /** Le tir en cours bénéficie du pouvoir. */
  private activeShot = false;

  constructor(readonly rule: ChargeRule) {}

  get charges(): number {
    return this.n;
  }

  /** Une charge attend le prochain tir. */
  get armed(): boolean {
    return this.n > 0;
  }

  get shotIsPowered(): boolean {
    return this.activeShot;
  }

  /** Cristal pouvoir touché : effet au tir suivant. */
  gain(): void {
    this.n = Math.min(this.rule.maxCharges, this.n + this.rule.chargesPerActivation);
  }

  /** Aide anti-frustration : charges offertes sans dépasser le plafond. */
  grant(n: number): void {
    this.n = Math.min(this.rule.maxCharges, this.n + n);
  }

  /** Au tir : consomme une charge s'il y en a une. */
  fire(): boolean {
    this.activeShot = this.n > 0;
    if (this.activeShot) this.n -= 1;
    return this.activeShot;
  }

  endShot(): void {
    this.activeShot = false;
  }
}

/** Charges de « trajectoire révélée » (Pip) : l'aperçu est montré pendant la visée. */
export class RevealCharges extends ShotCharges {
  constructor() {
    super(PIP_POWER);
  }

  get previewing(): boolean {
    return this.armed;
  }
}

export interface MagnetPull {
  /** Accélération (px/s² de temps de jeu). */
  ax: number;
  ay: number;
  targetId: number;
  /** 0..1 : proximité de la cible (1 = au contact). */
  strength: number;
}

/**
 * Aimant de Mousse : attraction vers le cœur non allumé le plus proche dans la portée,
 * nulle au bord de la portée, maximale au contact. Les cristaux allumés sont ignorés.
 */
export function magnetPull(
  orb: { x: number; y: number },
  hearts: ReadonlyArray<{ id: number; x: number; y: number }>,
  range = MOUSSE_POWER.range,
  accel = MOUSSE_POWER.accel,
): MagnetPull | null {
  let best: { id: number; dx: number; dy: number; d: number } | null = null;
  for (const h of hearts) {
    const dx = h.x - orb.x;
    const dy = h.y - orb.y;
    const d = Math.hypot(dx, dy);
    if (d < range && (!best || d < best.d)) best = { id: h.id, dx, dy, d };
  }
  if (!best || best.d < 1e-6) return null;
  const strength = 1 - best.d / range;
  const a = accel * strength;
  return { ax: (best.dx / best.d) * a, ay: (best.dy / best.d) * a, targetId: best.id, strength };
}
