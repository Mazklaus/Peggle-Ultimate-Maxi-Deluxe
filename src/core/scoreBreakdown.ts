/**
 * Décompte du score d'un niveau pour l'écran de victoire, sans Phaser.
 * Alimenté par les événements du bus (cristal_allume) ; le reste du score
 * (orbes restants, zones du tir final) est déduit à la fin.
 */
import type { CrystalKind } from './level';

export interface Breakdown {
  hearts: number;
  others: number;
  bonus: number;
  orbs: number;
  finalZone: number;
  /** Bonus de chaîne cumulé sur le niveau. */
  chain: number;
  total: number;
}

export class ScoreBreakdown {
  private byKind: Record<CrystalKind, number> = {
    heart: 0,
    common: 0,
    bonus: 0,
    power: 0,
    wall: 0,
  };

  private chain = 0;

  reset(): void {
    this.chain = 0;
    for (const k of Object.keys(this.byKind) as CrystalKind[]) this.byKind[k] = 0;
  }

  add(kind: CrystalKind, points: number): void {
    this.byKind[kind] += points;
  }

  addChain(points: number): void {
    this.chain += points;
  }

  /** orbBonus = points d'orbes restants (orbes × points du bonus), total = score final. */
  finish(total: number, orbBonus: number): Breakdown {
    const hearts = this.byKind.heart;
    const others = this.byKind.common + this.byKind.power;
    const bonus = this.byKind.bonus;
    const chain = this.chain;
    const finalZone = Math.max(0, total - hearts - others - bonus - orbBonus - chain);
    return { hearts, others, bonus, orbs: orbBonus, finalZone, chain, total };
  }
}
