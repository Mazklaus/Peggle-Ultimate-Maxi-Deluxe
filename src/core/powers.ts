/**
 * Pouvoirs des Astres (chiffrage Game Designer, reglages-jalon1.md).
 * Jalon 1 : Pip, trajectoire révélée sur les tirs suivants.
 */
export const PIP_POWER = {
  chargesPerActivation: 2,
  maxCharges: 4,
  previewBounces: 3,
  previewSeconds: 1.5,
};

/** Charges de « trajectoire révélée » : gagnées au cristal pouvoir, consommées au tir. */
export class RevealCharges {
  private n = 0;
  /** Le tir en cours bénéficie du pouvoir (aperçu montré pendant sa visée). */
  private activeShot = false;

  get charges(): number {
    return this.n;
  }

  /** Aperçu à montrer pendant la visée. */
  get previewing(): boolean {
    return this.n > 0;
  }

  get shotIsPowered(): boolean {
    return this.activeShot;
  }

  /** Cristal pouvoir touché : effet au tir suivant. */
  gain(): void {
    this.n = Math.min(PIP_POWER.maxCharges, this.n + PIP_POWER.chargesPerActivation);
  }

  /** Au tir : consomme une charge si l'aperçu était actif. */
  fire(): boolean {
    this.activeShot = this.n > 0;
    if (this.activeShot) this.n -= 1;
    return this.activeShot;
  }

  endShot(): void {
    this.activeShot = false;
  }
}
