/**
 * HUD final de l'écran de jeu (specs UI/UX, specs-ecrans-jalon1.md section 1).
 * Bandeau haut (score, étoiles, niveau), colonne gauche (loge de l'Astre, tube d'orbes),
 * colonne droite (multiplicateur, jauge, cœurs) et score flottant du tir.
 * La scène lui passe l'état du niveau ; il écoute le bus pour ses petites réactions.
 */
import Phaser from 'phaser';
import { gameEvents, type GameEventName } from '../core/events';
import { drawGardienne, LANTERN } from './gardienne';
import { drawPowerHex, drawPowerIcon } from './powerIcons';
import { powerParticle } from './powerFx';
import { PALETTE, powerColor, TEXT, textStyle } from './theme';

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
  /** Pouvoir de l'Astre (pictogramme et type d'indicateur), absent sans Astre. */
  power?: { id: string; kind: 'next' | 'immediate' | 'reserve' } | null;
  /** Bouche du canon (écran) : les charges consommées y volent. */
  cannon?: { x: number; y: number };
  /** Défi : la ligne d'objectif remplace les étoiles du bandeau (specs UI/UX jalon 3, 2.4). */
  hideStars?: boolean;
}

/** Loge : hexagone du pouvoir Ø 26 et indicateurs (specs UI/UX jalon 2, section 3). */
const POWER_HEX = 26;
/** Écart entre deux boucliers de réserve. */
const SHIELD_STEP = 22;

export class GameHud {
  private scene: Phaser.Scene;
  private opts: HudOptions;
  /** Tout sauf la loge : s'estompe pendant le ralenti final. */
  private main: Phaser.GameObjects.Container;
  private scoreText: Phaser.GameObjects.Text;
  private starsGfx: Phaser.GameObjects.Graphics;
  private tubeGfx: Phaser.GameObjects.Graphics;
  private orbsText: Phaser.GameObjects.Text;
  /** « +N » à côté du haut du tube : orbes au-delà des 10 cases (QA ch.2). */
  private extraOrbsText: Phaser.GameObjects.Text;
  /** -1 tant que le tube n'a pas été dessiné (pas de pop au premier affichage). */
  private prevExtraOrbs = -1;
  private multText: Phaser.GameObjects.Text;
  private gaugeGfx: Phaser.GameObjects.Graphics;
  private heartsText: Phaser.GameObjects.Text;
  private heartIcon: Phaser.GameObjects.Polygon;
  private powerGfx: Phaser.GameObjects.Graphics;
  /** Hexagone + pictogramme (conteneur : pulsation et flash). */
  private powerIcon?: Phaser.GameObjects.Container;
  private power = { charges: 0, max: 0, lit: false, ring: 0, twins: false };
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
    if (opts.power && opts.astreColor !== null) {
      const g = scene.add.graphics();
      drawPowerHex(g, 0, 0, POWER_HEX);
      drawPowerIcon(g, opts.power.id, 0, 0, POWER_HEX * 0.62);
      const p = this.powerPos();
      this.powerIcon = scene.add.container(p.x, p.y, [g]).setAlpha(0.6);
    }

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
    this.extraOrbsText = add(scene.add.text(0, 0, '', textStyle(18)).setOrigin(0.5));
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

  /** Mode daltonien changé en cours de niveau : hexagone et pastilles à la nouvelle couleur. */
  recolorPower(): void {
    const g = this.powerIcon?.list[0];
    if (g instanceof Phaser.GameObjects.Graphics && this.opts.power) {
      g.clear();
      drawPowerHex(g, 0, 0, POWER_HEX);
      drawPowerIcon(g, this.opts.power.id, 0, 0, POWER_HEX * 0.62);
    }
    this.drawPower();
  }

  /** Charges du pouvoir sous l'Astre (pastilles « tir suivant », bouclier « réserve »). */
  setPower(charges: number, max: number, lit: boolean): void {
    const prev = this.power.charges;
    this.power = { ...this.power, charges, max, lit };
    const kind = this.opts.power?.kind;
    if (charges < prev && kind === 'next') this.flyCharge(charges);
    if (charges < prev && kind === 'reserve') this.shatterShield(charges);
    this.drawPower();
  }

  /**
   * Pouvoirs immédiats pendant le tir : `ring` = part restante de l'effet (anneau de Volte,
   * 0 = rien), `twins` = les deux orbes de Twi & Nkl sont en vol.
   */
  setPowerActivity(ring: number, twins: boolean): void {
    const r = Math.round(ring * 60) / 60;
    if (r === this.power.ring && twins === this.power.twins) return;
    this.power = { ...this.power, ring: r, twins };
    this.drawPower();
  }

  private powerPos(): { x: number; y: number } {
    const kind = this.opts.power?.kind;
    const max = kind === 'immediate' ? 1 : Math.max(1, this.power.max);
    const step = kind === 'reserve' ? SHIELD_STEP : 16;
    const x = HUD_LAYOUT.anchor.x - (max * step + POWER_HEX) / 2 + POWER_HEX / 2 - 4;
    return { x: kind === 'immediate' ? HUD_LAYOUT.anchor.x - 12 : x, y: HUD_LAYOUT.anchor.y + 28 };
  }

  private drawPower(): void {
    const g = this.powerGfx.clear();
    const kind = this.opts.power?.kind;
    if (this.opts.astreColor === null || !kind || !this.powerIcon) return;
    const { charges, max, lit, ring, twins } = this.power;
    const p = this.powerPos();
    this.powerIcon.setPosition(p.x, p.y);
    const active = kind === 'immediate' ? lit || ring > 0 || twins : charges > 0 || lit;
    this.powerIcon.setAlpha(active ? 1 : 0.6);
    const x0 = p.x + POWER_HEX / 2 + 12;
    if (kind === 'next') {
      for (let i = 0; i < max; i++) {
        const x = x0 + i * 16;
        if (i < charges) g.fillStyle(powerColor(), 1).fillCircle(x, p.y, 5);
        else g.lineStyle(2, powerColor(), 0.35).strokeCircle(x, p.y, 5);
      }
    } else if (kind === 'reserve') {
      // Un bouclier par charge en réserve (Nuage-Lune : 2 au plus).
      for (let i = 0; i < Math.max(1, max); i++) {
        const pts = shield(x0 + 4 + i * SHIELD_STEP, p.y, 9);
        if (i < charges) g.fillStyle(powerColor(), 1).fillPoints(pts, true);
        else g.lineStyle(2, powerColor(), 0.35).strokePoints(pts, true);
      }
    } else {
      if (ring > 0) {
        // Volte : anneau qui se vide sur la durée de l'effet.
        g.lineStyle(3, powerColor(), 0.9).beginPath();
        g.arc(p.x, p.y, POWER_HEX / 2 + 5, -Math.PI / 2, -Math.PI / 2 + ring * Math.PI * 2);
        g.strokePath();
      }
      if (twins) {
        g.fillStyle(powerColor(), 1).fillCircle(x0, p.y - 5, 4);
        g.fillCircle(x0, p.y + 5, 4);
      }
    }
  }

  /** Une charge consommée au tir : la pastille se vide et vole vers le canon. */
  private flyCharge(index: number): void {
    const to = this.opts.cannon;
    if (!to) return;
    const p = this.powerPos();
    const dot = this.scene.add.circle(p.x + POWER_HEX / 2 + 12 + index * 16, p.y, 5, powerColor());
    dot.setDepth(20);
    this.scene.tweens.add({
      targets: dot,
      x: to.x,
      y: to.y,
      scale: 0.5,
      alpha: 0.4,
      duration: 380,
      ease: 'Cubic.In',
      onComplete: () => dot.destroy(),
    });
  }

  /** Seconde chance utilisée : le bouclier se brise en paillettes. */
  private shatterShield(index: number): void {
    const p = this.powerPos();
    const cx = p.x + POWER_HEX / 2 + 16 + index * SHIELD_STEP;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const bit = powerParticle(this.scene, cx, p.y, 2.5, 1).setDepth(20);
      this.scene.tweens.add({
        targets: bit,
        x: cx + Math.cos(a) * 18,
        y: p.y + Math.sin(a) * 18,
        alpha: 0,
        duration: 420,
        onComplete: () => bit.destroy(),
      });
    }
  }

  /** pouvoir_active : flash de l'hexagone et pictogramme qui jaillit au-dessus de la loge. */
  private powerPop(): void {
    const icon = this.powerIcon;
    const power = this.opts.power;
    if (!icon || !power) return;
    icon.setAlpha(1).setScale(1.25);
    this.scene.tweens.add({ targets: icon, scale: 1, duration: 220, ease: 'Back.Out' });
    const g = this.scene.add.graphics();
    drawPowerHex(g, 0, 0, POWER_HEX);
    drawPowerIcon(g, power.id, 0, 0, POWER_HEX * 0.62);
    const { anchor, loge } = HUD_LAYOUT;
    const pop = this.scene.add.container(anchor.x, loge.y + 18, [g]).setDepth(20);
    this.scene.tweens.add({
      targets: pop,
      scale: { from: 1.6, to: 0 },
      y: loge.y - 6,
      duration: 500,
      ease: 'Quad.In',
      onComplete: () => pop.destroy(),
    });
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
    // Tir suivant armé : l'hexagone pulse à 1 Hz.
    const armed = this.opts.power?.kind === 'next' && this.power.charges > 0;
    if (this.powerIcon && !this.scene.tweens.isTweening(this.powerIcon))
      this.powerIcon.setScale(armed ? 1 + 0.08 * Math.sin((time / 1000) * Math.PI * 2) : 1);
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
    if (name === 'orbe_recupere') this.pop(this.orbsText, 1.3, 300, PALETTE.success);
    if (name === 'pouvoir_active') this.powerPop();
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
    if (this.opts.hideStars) return;
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
    // Plus d'orbes que de cases : pastille « +N » à droite de la case du haut.
    const extra = orbs - tube.slots;
    const topY = tube.y + tube.h - 10 - tube.slot / 2 - (tube.slots - 1) * tube.step;
    const px = tube.x + tube.w + 22;
    // Orbe gagné au-delà des 10 cases : petit pop de la pastille (specs UI/UX jalon 1, §1).
    if (extra > 0 && this.prevExtraOrbs >= 0 && extra > this.prevExtraOrbs) {
      this.scene.tweens.add({
        targets: this.extraOrbsText,
        scale: { from: 1.2, to: 1 },
        duration: 150,
        ease: 'Quad.Out',
      });
    }
    this.prevExtraOrbs = extra;
    this.extraOrbsText
      .setVisible(extra > 0)
      .setText(`+${extra}`)
      .setPosition(px, topY);
    if (extra > 0) {
      const w = Math.max(34, this.extraOrbsText.width + 14);
      g.fillStyle(PALETTE.panel, 0.95).fillRoundedRect(px - w / 2, topY - 13, w, 26, 13);
      g.lineStyle(2, PALETTE.accent, 0.9).strokeRoundedRect(px - w / 2, topY - 13, w, 26, 13);
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

/** Écusson (bouclier) de hauteur 2h, pointe en bas. */
function shield(cx: number, cy: number, h: number): Phaser.Math.Vector2[] {
  const V = (x: number, y: number) => new Phaser.Math.Vector2(cx + x, cy + y);
  return [V(-h * 0.8, -h), V(h * 0.8, -h), V(h * 0.8, 0), V(0, h), V(-h * 0.8, 0)];
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
