/**
 * Détection des événements de jeu (seuils : Game Designer, reglages-jalon1.md section 5).
 * Logique pure : la scène appelle ces méthodes et relaie les noms renvoyés sur le bus.
 */
import type { CrystalKind } from './level';

export const EVENT_THRESHOLDS = {
  bigHitCrystals: 5,
  longChainBounces: 10,
  longChainShotScore: 3000,
  nearMissMaxHearts: 3,
  nearMissEdgePx: 12,
  finalSlowmoLeadSeconds: 0.4,
  idleFirstSeconds: 8,
  idleRepeatSeconds: 12,
};

export type DetectedEvent =
  | 'tir_lance'
  | 'gros_coup'
  | 'chaine_longue'
  | 'rate'
  | 'orbe_recupere'
  | 'pouvoir_active'
  | 'presque'
  | 'dernier_coeur'
  | 'dernier_orbe'
  | 'final_ralenti'
  | 'victoire'
  | 'echec'
  | 'inactivite';

export interface Vec {
  x: number;
  y: number;
}

/** Cœur encore à toucher (centre et rayon de collision). */
export interface HeartTarget extends Vec {
  id: number;
  r: number;
}

export interface OrbSample extends Vec {
  /** Vitesse en px/s. */
  vx: number;
  vy: number;
  r: number;
}

export type CrystalKindOrPower = CrystalKind | 'power';

export class ShotTracker {
  private t = EVENT_THRESHOLDS;
  private idleTime = 0;
  private nextIdleAt = this.t.idleFirstSeconds;
  private hits = 0;
  private heartsHit = 0;
  private bounces = 0;
  private bigHitSent = false;
  private chainSent = false;
  private nearMissSent = false;
  private finalSent = false;
  /** Cœur actuellement frôlé (candidat « presque »). */
  private grazing: number | null = null;

  /** Début de visée : états tendus. */
  beginAiming(heartsLeft: number, orbsLeft: number): DetectedEvent[] {
    this.idleTime = 0;
    this.nextIdleAt = this.t.idleFirstSeconds;
    const out: DetectedEvent[] = [];
    if (heartsLeft === 1) out.push('dernier_coeur');
    if (orbsLeft === 1) out.push('dernier_orbe');
    return out;
  }

  /** Temps passé en visée sans tirer (bouger la visée ne remet pas à zéro). */
  updateAiming(dtSeconds: number): DetectedEvent[] {
    this.idleTime += dtSeconds;
    if (this.idleTime < this.nextIdleAt) return [];
    this.nextIdleAt += this.t.idleRepeatSeconds;
    return ['inactivite'];
  }

  shotFired(): DetectedEvent[] {
    this.hits = 0;
    this.heartsHit = 0;
    this.bounces = 0;
    this.bigHitSent = false;
    this.chainSent = false;
    this.nearMissSent = false;
    this.finalSent = false;
    this.grazing = null;
    return ['tir_lance'];
  }

  /** Un cristal vient de s'allumer. shotScore = score cumulé du tir. */
  crystalLit(kind: CrystalKindOrPower, shotScore: number, heartId?: number): DetectedEvent[] {
    const out: DetectedEvent[] = [];
    this.hits += 1;
    if (kind === 'heart') this.heartsHit += 1;
    if (heartId !== undefined && heartId === this.grazing) this.grazing = null;
    if (kind === 'power') out.push('pouvoir_active');
    if (!this.bigHitSent && this.hits >= this.t.bigHitCrystals) {
      this.bigHitSent = true;
      out.push('gros_coup');
    }
    if (!this.chainSent && shotScore >= this.t.longChainShotScore) {
      this.chainSent = true;
      out.push('chaine_longue');
    }
    return out;
  }

  /** Rebond (cristal déjà allumé ou mur) : compte pour chaine_longue. */
  bounced(): DetectedEvent[] {
    this.bounces += 1;
    if (!this.chainSent && this.bounces >= this.t.longChainBounces) {
      this.chainSent = true;
      return ['chaine_longue'];
    }
    return [];
  }

  /** À chaque frame du vol : presque et final_ralenti. hearts = cœurs non allumés. */
  orbMoved(orb: OrbSample, hearts: ReadonlyArray<HeartTarget>): DetectedEvent[] {
    const out: DetectedEvent[] = [];
    if (!this.nearMissSent && hearts.length > 0 && hearts.length <= this.t.nearMissMaxHearts) {
      const near = hearts.find((h) => edgeDistance(orb, h) < this.t.nearMissEdgePx);
      if (near) {
        this.grazing = near.id;
      } else if (this.grazing !== null) {
        // L'orbe s'éloigne d'un cœur frôlé qui n'a pas été touché.
        if (hearts.some((h) => h.id === this.grazing)) {
          this.nearMissSent = true;
          out.push('presque');
        }
        this.grazing = null;
      }
    }
    const last = hearts.length === 1 ? hearts[0] : undefined;
    if (!this.finalSent && last) {
      const ttc = timeToContact(orb, last);
      if (ttc !== null && ttc < this.t.finalSlowmoLeadSeconds) {
        this.finalSent = true;
        out.push('final_ralenti');
      }
    }
    return out;
  }

  /** Fin de tir : bilan. phase = phase du niveau après résolution. */
  shotEnded(caught: boolean, phase: 'aiming' | 'won' | 'lost' | 'shooting'): DetectedEvent[] {
    if (phase === 'won') return ['victoire'];
    if (phase === 'lost') return ['echec'];
    const out: DetectedEvent[] = [];
    if (caught) out.push('orbe_recupere');
    if (this.heartsHit === 0) out.push('rate');
    return out;
  }

  get shotHits(): number {
    return this.hits;
  }

  get shotBounces(): number {
    return this.bounces;
  }
}

/** Distance entre les bords de l'orbe et du cœur (négative si contact). */
export function edgeDistance(orb: OrbSample, h: HeartTarget): number {
  return Math.hypot(h.x - orb.x, h.y - orb.y) - orb.r - h.r;
}

/**
 * Temps avant contact en ligne droite (approximation suffisante sur 0,4 s), ou null si
 * l'orbe ne se dirige pas vers le cœur.
 */
export function timeToContact(orb: OrbSample, h: HeartTarget): number | null {
  const rx = h.x - orb.x;
  const ry = h.y - orb.y;
  const rr = orb.r + h.r;
  // Résout |r - v t| = rr  ->  (v·v) t² - 2 (r·v) t + (r·r - rr²) = 0
  const a = orb.vx * orb.vx + orb.vy * orb.vy;
  const b = -2 * (rx * orb.vx + ry * orb.vy);
  const c = rx * rx + ry * ry - rr * rr;
  if (c <= 0) return 0;
  if (a === 0) return null;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 ? t : null;
}
