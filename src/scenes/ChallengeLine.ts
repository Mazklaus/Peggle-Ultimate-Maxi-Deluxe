/**
 * Ligne d'objectif du défi dans le bandeau haut, à la place des étoiles (specs UI/UX jalon 3,
 * 2.4) : pictogramme du type + chiffre + contrainte, jauge de progression quand c'est
 * mesurable, compte à rebours du chrono. Menthe quand l'objectif est atteint, corail s'il
 * devient impossible.
 */
import Phaser from 'phaser';
import type {
  Challenge,
  ChallengeConstraint,
  ChallengeGoal,
  ChallengeState,
} from '../core/challenge';
import { goalTarget } from '../core/challenge';
import { PALETTE, TEXT, textStyle } from './theme';

export const GOAL_ICON: Record<ChallengeGoal, string> = {
  score: 'defi-score',
  nettoyage: 'defi-nettoyage',
  tir_unique: 'defi-tir-parfait',
  economie: 'defi-economie',
  pouvoir: 'defi-pouvoir',
  chaine: 'defi-chaine',
};
export const CONSTRAINT_ICON: Record<ChallengeConstraint, string> = {
  sans_receptacle: 'defi-sans-receptacle',
  orbes_reduits: 'defi-orbes-reduits',
  astre_impose: 'cadenas',
  sans_guide: 'defi-sans-guide',
  chrono: 'defi-chrono',
  sans_pouvoir: 'defi-sans-pouvoir',
};
const ICON_PX = 22;
const MINT = '#4FF0A8';
const CORAL = '#FF7A6B';
const LINE = { x: 196, y: 30, gaugeW: 130 };

export const iconKey = (name: string): string => `icone-${name}`;

/** Icônes SVG de la DA dont le défi a besoin (à charger dans preload). */
export function preloadChallengeIcons(scene: Phaser.Scene, c: Challenge): void {
  const names = [GOAL_ICON[c.goal], c.constraint ? CONSTRAINT_ICON[c.constraint] : null];
  for (const n of names) {
    if (n && !scene.textures.exists(iconKey(n)))
      scene.load.svg(iconKey(n), `da/icones/${n}.svg`, { width: ICON_PX * 2, height: ICON_PX * 2 });
  }
}

/** Libellé du chiffre de l'objectif (« 50 000 », « ×6 », « 100 % »). */
export function goalLabel(c: Challenge): string {
  const v = goalTarget(c);
  if (c.goal === 'nettoyage') return '100 %';
  if (c.goal === 'tir_unique' || c.goal === 'chaine' || c.goal === 'pouvoir') return `×${v}`;
  return v.toLocaleString('fr-FR');
}

export class ChallengeLine {
  private readonly value: Phaser.GameObjects.Text;
  private readonly chrono?: Phaser.GameObjects.Text;
  private readonly gauge: Phaser.GameObjects.Graphics;
  private readonly measurable: boolean;

  constructor(
    private readonly scene: Phaser.Scene,
    challenge: Challenge,
    depth = 10,
  ) {
    let x = LINE.x;
    const icon = (name: string) => {
      const k = iconKey(name);
      if (scene.textures.exists(k)) {
        scene.add
          .image(x + ICON_PX / 2, LINE.y, k)
          .setDisplaySize(ICON_PX, ICON_PX)
          .setDepth(depth);
      }
      x += ICON_PX + 6;
    };
    icon(GOAL_ICON[challenge.goal]);
    this.value = scene.add
      .text(x, LINE.y, goalLabel(challenge), textStyle(18))
      .setOrigin(0, 0.5)
      .setDepth(depth);
    x += this.value.width + 10;
    if (challenge.constraint) {
      icon(CONSTRAINT_ICON[challenge.constraint]);
      if (challenge.constraint === 'chrono') {
        this.chrono = scene.add
          .text(x, LINE.y, '90 s', textStyle(16, TEXT.dim))
          .setOrigin(0, 0.5)
          .setDepth(depth);
      }
    }
    this.measurable = challenge.goal === 'score' || challenge.goal === 'chaine';
    this.gauge = scene.add.graphics().setDepth(depth);
  }

  /** État et progression (0..1), secondes restantes du chrono. */
  update(state: ChallengeState, ratio: number, secondsLeft: number | null): void {
    const reached = state === 'reached' || state === 'success';
    const color = reached ? MINT : state === 'failed' ? CORAL : TEXT.main;
    this.value.setColor(color);
    if (this.chrono && secondsLeft !== null) {
      this.chrono.setText(`${Math.ceil(secondsLeft)} s`);
      this.chrono.setColor(secondsLeft <= 10 ? CORAL : TEXT.dim);
    }
    const g = this.gauge.clear();
    if (!this.measurable) return;
    const y = LINE.y + 16;
    g.fillStyle(PALETTE.border, 0.8).fillRoundedRect(LINE.x, y, LINE.gaugeW, 5, 2.5);
    const fill = reached ? PALETTE.success : state === 'failed' ? PALETTE.alert : PALETTE.accent;
    const w = Math.max(0, Math.min(1, ratio)) * LINE.gaugeW;
    if (w > 0) g.fillStyle(fill, 1).fillRoundedRect(LINE.x, y, w, 5, 2.5);
  }

  /** Petit pop quand l'objectif est atteint. */
  celebrate(): void {
    this.scene.tweens.add({
      targets: this.value,
      scale: { from: 1.35, to: 1 },
      duration: 320,
      ease: 'Back.Out',
    });
  }
}
