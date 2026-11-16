/**
 * HUD final de l'écran de jeu (specs UI/UX, specs-ecrans-jalon1.md section 1).
 * Bandeau haut (score, étoiles, niveau), colonne gauche (loge de l'Astre, tube d'orbes),
 * colonne droite (multiplicateur, jauge, cœurs) et score flottant du tir.
 * La scène lui passe l'état du niveau ; il écoute le bus pour ses petites réactions.
 */
import Phaser from 'phaser';
import { gameEvents, type GameEventName } from '../core/events';
import { drawGardienne, LANTERN } from './gardienne';
import { PALETTE, TEXT, textStyle } from './theme';

/** Géométrie des specs (coordonnées écran 1280 × 720). */
export const HUD_LAYOUT = {
  loge: { x: 16, y: 80, w: 168, h: 236 },
  /** Pieds de l'Astre dans sa loge. */
  anchor: { x: 100, y: 270 },
  tube: { x: 72, y: 330, w: 56, h: 290, slots: 10, slot: 26, step: 28 },
  orbsNumberY: 660,
  labelY: 688,
  multY: 140,
  gauge: { x: 1160, y: 170, w: 40, h: 330 },
  heartIconY: 580,
  heartsNumberY: 656,
  rightX: 1180,
};

const LOGE_BG = 0x232a5c;
const CORAL = '#FF7A6B';
const MINT = 0x4ff0a8;
const LABEL = (s: number) => ({ ...textStyle(s, TEXT.dim), fontStyle: 'bold' });

export interface HudState {
  score: number;
  shotScore: number;
  orbs: number;
  heartsLeft: number;
  heartsTotal: number;
  mult: number;
  /** Fraction de cœurs brisés (0..1). */
  broken: number;
  thresholds: ReadonlyArray<number>;
  steps: ReadonlyArray<number>;
}

export interface HudOptions {
  levelLabel: string;
  /** Seuils de score 2 et 3 étoiles. */
  stars: [number, number];
  /** Couleur signature de l'Astre, ou null sans Astre (prologue : la Gardienne). */
  astreColor: number | null;
  /** Couleur des cœurs (palette normale ou daltonienne). */
  heartColor: number;
}

export class GameHud {
  private scene: Phaser.Scene;
  private opts: HudOptions;
  /** Tout sauf la loge : s'estompe pendant le ralenti final. */
  private main: Phaser.GameObjects.Container;
  private scoreText: Phaser.GameObjects.Text;
  private starsGfx: Phaser.GameObjects.Graphics;
  private tubeGfx: Phaser.GameObjects.Graphics;
  private orbsText: Phaser.GameObjects.Text;
  private multText: Phaser.GameObjects.Text;
  private gaugeGfx: Phaser.GameObjects.Graphics;
  private heartsText: Phaser.GameObjects.Text;
  private heartIcon: Phaser.GameObjects.Polygon;
  private powerGfx: Phaser.GameObjects.Graphics;
  private shotBadge: Phaser.GameObjects.Container;
  private shotText: Phaser.GameObjects.Text;
  private shown = 0;
  private scoreTween?: Phaser.Tweens.Tween;
  private last?: HudState;
  private pulse: { hearts: boolean; orbs: boolean } = { hearts: false, orbs: false };
  private unsubscribe: () => void;
  private shotHits = 0;

  constructor(scene: Phaser.Scene, opts: HudOptions) {
    this.scene = scene;
    this.opts = opts;
    const L = HUD_LAYOUT;
    this.drawLoge();
    this.powerGfx = scene.add.graphics();

    this.main = scene.add.container(0, 0);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.main.add(o);
      return o;
    };
    // Bandeau haut
    add(scene.add.text(24, 14, 'SCORE', LABEL(13)));
    this.scoreText = add(scene.add.text(24, 28, '0', textStyle(30)));
    this.starsGfx = add(scene.add.graphics());
    add(scene.add.text(640, 32, opts.levelLabel, textStyle(16, TEXT.dim)).setOrigin(0.5));
    // Colonne gauche : tube d'orbes
    this.tubeGfx = add(scene.add.graphics());
    this.orbsText = add(scene.add.text(100, L.orbsNumberY, '', textStyle(44)).setOrigin(0.5));
    add(scene.add.text(100, L.labelY, 'ORBES', LABEL(13)).setOrigin(0.5));
    // Colonne droite
    this.multText = add(scene.add.text(L.rightX, L.multY, '', textStyle(52)).setOrigin(0.5));
    this.gaugeGfx = add(scene.add.graphics());
    const d = 18;
    this.heartIcon = add(
      scene.add.polygon(L.rightX, L.heartIconY, [0, -d, d, 0, 0, d, -d, 0], opts.heartColor),
    );
    this.heartsText = add(
      scene.add
        .text(L.rightX, L.heartsNumberY, '', textStyle(44, colorHex(opts.heartColor)))
        .setOrigin(0.5),
    );
    add(scene.add.text(L.rightX, L.labelY, 'CŒURS', LABEL(13)).setOrigin(0.5));

    // Score du tir (flottant au-dessus de l'orbe)
    const bg = scene.add.rectangle(0, 0, 90, 32, PALETTE.panel, 0.85);
    this.shotText = scene.add.text(0, 0, '', textStyle(20)).setOrigin(0.5);
    this.shotBadge = scene.add.container(0, 0, [bg, this.shotText]).setAlpha(0).setDepth(5);

    this.unsubscribe = gameEvents.onAny((name) => this.onEvent(name));
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe());
  }

  /** Pastilles du pouvoir sous l'Astre : hexagone menthe + tirs restants. */
  setPower(charges: number, max: number, lit: boolean): void {
    const g = this.powerGfx;
    g.clear();
    if (this.opts.astreColor === null || max === 0) return;
    const y = HUD_LAYOUT.anchor.y + 26;
    const x0 = HUD_LAYOUT.anchor.x - ((max - 1) * 16) / 2 + 12;
    const hx = x0 - 26;
    g.fillStyle(MINT, lit || charges > 0 ? 1 : 0.3);
    g.fillPoints(ring(6, 9, hx, y), true);
    for (let i = 0; i < max; i++) {
      const x = x0 + i * 16;
      if (i < charges) g.fillStyle(MINT, 1).fillCircle(x, y, 5);
      else g.lineStyle(2, MINT, 0.35).strokeCircle(x, y, 5);
    }
  }

  update(s: HudState): void {
    const prev = this.last;
    this.last = s;
    if (!prev || s.score !== prev.score) this.countScoreTo(s.score);
    this.drawStars(s.score);
    this.drawTube(s.orbs);
    this.orbsText.setText(String(s.orbs)).setColor(s.orbs <= 1 ? CORAL : TEXT.main);
    this.multText.setText(`x${s.mult}`);
    if (prev && s.mult > prev.mult) this.pop(this.multText, 1.4, 250);
    this.drawGauge(s);
    this.heartsText.setText(String(s.heartsLeft));
    this.pulse.hearts = s.heartsLeft === 1;
    this.pulse.orbs = s.orbs === 1;
    if (s.shotScore > 0) this.shotText.setText(s.shotScore.toLocaleString('fr-FR'));
  }

  /** À chaque frame : suit l'orbe avec le score du tir, anime les pulsations. */
  tick(time: number, orb?: { x: number; y: number }): void {
    const s = this.last;
    if (orb && s && s.shotScore > 0) {
      this.shotBadge.setPosition(orb.x, Math.max(80, orb.y - 40));
      if (this.shotBadge.alpha < 1 && !this.scene.tweens.isTweening(this.shotBadge))
        this.shotBadge.setAlpha(1);
    }
    const beat = 1 + 0.25 * (0.5 + 0.5 * Math.sin((time / 1000) * Math.PI * 2));
    this.heartsText.setScale(this.pulse.hearts ? beat : 1);
    this.heartIcon.setScale(this.pulse.hearts ? beat : 1);
    const slow = 0.6 + 0.4 * Math.sin((time / 1000) * Math.PI);
    this.orbsText.setAlpha(this.pulse.orbs ? slow : 1);
  }

  /** L'orbe est sortie : le score du tir s'efface. */
  endShot(): void {
    this.shotHits = 0;
    if (this.shotBadge.alpha === 0) return;
    this.scene.tweens.add({ targets: this.shotBadge, alpha: 0, duration: 300 });
  }

  /** Ralenti final : le HUD s'estompe à 30 %, la loge reste à 100 %. */
  setDimmed(on: boolean): void {
    this.scene.tweens.add({ targets: this.main, alpha: on ? 0.3 : 1, duration: 200 });
  }

  // ---------- Interne ----------

  private onEvent(name: GameEventName): void {
    if (name === 'tir_lance') this.shotHits = 0;
    if (name === 'cristal_allume') this.shotHits += 1;
    if (name === 'gros_coup') this.pop(this.shotText, 1.3, 200);
    if (name === 'chaine_longue') {
      this.shotText.setFontSize(28);
      this.scene.tweens.add({
        targets: this.shotText,
        alpha: 0.6,
        yoyo: true,
        repeat: 3,
        duration: 90,
      });
    }
    if (name === 'tir_lance') this.shotText.setFontSize(20);
    if (name === 'orbe_recupere') this.pop(this.orbsText, 1.3, 300, MINT);
  }

  private countScoreTo(target: number): void {
    this.scoreTween?.stop();
    const from = { v: this.shown };
    this.scoreTween = this.scene.tweens.add({
      targets: from,
      v: target,
      duration: 500,
      onUpdate: () => {
        this.shown = Math.round(from.v);
        this.scoreText.setText(this.shown.toLocaleString('fr-FR'));
      },
    });
  }

  private pop(t: Phaser.GameObjects.Text, scale: number, ms: number, tint?: number): void {
    t.setScale(scale);
    if (tint !== undefined) t.setTint(tint);
    this.scene.tweens.add({
      targets: t,
      scale: 1,
      duration: ms,
      ease: 'Back.Out',
      onComplete: () => t.clearTint(),
    });
  }

  private drawLoge(): void {
    const { loge, anchor } = HUD_LAYOUT;
    const g = this.scene.add.graphics();
    g.fillStyle(LOGE_BG, 0.9).fillRoundedRect(loge.x, loge.y, loge.w, loge.h, 16);
    const glow = this.opts.astreColor ?? LANTERN.glow;
    // Sol en arc lumineux à la couleur signature (15 %).
    g.fillStyle(glow, 0.15).fillEllipse(anchor.x, anchor.y + 6, 132, 26);
    g.lineStyle(2, glow, 0.35).strokeEllipse(anchor.x, anchor.y + 6, 132, 26);
    if (this.opts.astreColor === null) drawGardienne(g, anchor.x, anchor.y, LOGE_BG);
  }

  private drawStars(score: number): void {
    const g = this.starsGfx;
    g.clear();
    const [two, three] = this.opts.stars;
    // 1re étoile : le niveau gagné (affichée creuse en jeu), puis les paliers de score.
    const lit = [false, score >= two, score >= three];
    lit.forEach((on, i) => {
      const pts = star5(206 + i * 30, 32, 11, 5);
      if (on) g.fillStyle(PALETTE.accent, 1).fillPoints(pts, true);
      else g.lineStyle(2, PALETTE.accent, 0.6).strokePoints(pts, true);
    });
  }

  private drawTube(orbs: number): void {
    const { tube } = HUD_LAYOUT;
    const g = this.tubeGfx;
    g.clear();
    g.fillStyle(PALETTE.panel, 0.85).fillRoundedRect(tube.x, tube.y, tube.w, tube.h, 20);
    const filled = Math.min(orbs, tube.slots);
    for (let i = 0; i < tube.slots; i++) {
      // Rempli par le bas : l'orbe du haut part au tir.
      const cy = tube.y + tube.h - 10 - tube.slot / 2 - i * tube.step;
      const cx = tube.x + tube.w / 2;
      if (i < filled) {
        const last = orbs === 1;
        g.fillStyle(last ? PALETTE.alert : PALETTE.orb, 1).fillCircle(cx, cy, tube.slot / 2 - 2);
      } else {
        g.lineStyle(2, PALETTE.border, 0.8).strokeCircle(cx, cy, tube.slot / 2 - 2);
      }
    }
  }

  private drawGauge(s: HudState): void {
    const { gauge } = HUD_LAYOUT;
    const g = this.gaugeGfx;
    g.clear();
    g.fillStyle(PALETTE.panel, 0.85).fillRoundedRect(
      gauge.x - gauge.w / 2,
      gauge.y,
      gauge.w,
      gauge.h,
      14,
    );
    const fillH = gauge.h * Phaser.Math.Clamp(s.broken, 0, 1);
    if (fillH > 0)
      g.fillStyle(this.opts.heartColor, 0.85).fillRoundedRect(
        gauge.x - gauge.w / 2 + 4,
        gauge.y + gauge.h - fillH,
        gauge.w - 8,
        Math.max(0, fillH - 4),
        Math.min(10, fillH / 2),
      );
    s.thresholds.forEach((t, i) => {
      const y = gauge.y + gauge.h * (1 - t);
      const passed = s.broken >= t;
      g.lineStyle(2, passed ? PALETTE.lit : PALETTE.border, 1);
      g.lineBetween(gauge.x - gauge.w / 2 - 6, y, gauge.x - gauge.w / 2, y);
      const label = this.markLabels[i];
      if (label) label.setColor(passed ? TEXT.main : TEXT.dim).setY(y);
    });
    if (this.markLabels.length === 0) {
      this.markLabels = s.thresholds.map((t, i) => {
        const txt = this.scene.add
          .text(
            gauge.x - gauge.w / 2 - 10,
            gauge.y + gauge.h * (1 - t),
            `x${s.steps[i + 1] ?? ''}`,
            textStyle(13, TEXT.dim),
          )
          .setOrigin(1, 0.5);
        this.main.add(txt);
        return txt;
      });
    }
  }

  private markLabels: Phaser.GameObjects.Text[] = [];
}

function ring(n: number, r: number, cx: number, cy: number): Phaser.Math.Vector2[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i * Math.PI * 2) / n;
    return new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  });
}

function star5(cx: number, cy: number, outer: number, inner: number): Phaser.Math.Vector2[] {
  return Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? outer : inner;
    return new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  });
}

function colorHex(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}
