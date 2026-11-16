/**
 * HUD du duel local (specs UI/UX jalon 3, 4.2) : deux cartouches de score face à face, cœurs
 * partagés au centre, anneau du canon et bannière de changement de tour. Le tour de qui est
 * toujours dit par 3 signaux : cartouche plein, anneau du canon, bannière + Astre dans la loge.
 */
import Phaser from 'phaser';
import { DUEL_RULES, type PlayerIndex } from '../core/duel';
import { PALETTE, TEXT, textStyle } from './theme';

// J2 s'arrête avant le bouton pause (x 1212) : 840 -> 1200 au lieu de 880 -> 1264.
const CART = { y: 8, h: 50, xs: [16, 840] as const, w: 360 };
/** Cartouche du joueur qui attend : sa couleur à 35 %. */
const IDLE_ALPHA = 0.35;
/** Cœurs partagés : centrés entre les deux cartouches (376 et 840), validé UI/UX. */
const HEARTS_X = 608;
const HEART_D = 13;
const BANNER_MS = 600;

/** Forme du joueur (daltonisme) : J1 rond, J2 carré arrondi. */
export function drawPlayerShape(
  g: Phaser.GameObjects.Graphics,
  player: PlayerIndex,
  x: number,
  y: number,
  size: number,
  color: number,
  alpha = 1,
): void {
  g.fillStyle(color, alpha);
  if (player === 0) g.fillCircle(x, y, size / 2);
  else g.fillRoundedRect(x - size / 2, y - size / 2, size, size, size * 0.28);
}

export class DuelHud {
  private scene: Phaser.Scene;
  private cartGfx: Phaser.GameObjects.Graphics;
  private ringGfx: Phaser.GameObjects.Graphics;
  private scoreTexts: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  private labels: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  private heartsText: Phaser.GameObjects.Text;
  private heartIcon: Phaser.GameObjects.Polygon;
  private active: PlayerIndex = 0;
  private scores: [number, number] = [0, 0];

  constructor(
    scene: Phaser.Scene,
    heartColor: number,
    private cannon: { x: number; y: number },
  ) {
    this.scene = scene;
    this.cartGfx = scene.add.graphics().setDepth(4);
    this.ringGfx = scene.add.graphics().setDepth(3);
    const mk = (i: PlayerIndex) => {
      const x0 = CART.xs[i];
      const label = scene.add
        .text(i === 0 ? x0 + 52 : x0 + CART.w - 52, CART.y + CART.h / 2, `J${i + 1}`, textStyle(20))
        .setOrigin(i === 0 ? 0 : 1, 0.5)
        .setDepth(5);
      const score = scene.add
        .text(i === 0 ? x0 + CART.w - 18 : x0 + 18, CART.y + CART.h / 2, '0', textStyle(30))
        .setOrigin(i === 0 ? 1 : 0, 0.5)
        .setDepth(5);
      return { label, score };
    };
    const a = mk(0);
    const b = mk(1);
    this.scoreTexts = [a.score, b.score];
    this.labels = [a.label, b.label];
    // Au centre : cœurs restants du niveau, partagés.
    const d = HEART_D;
    this.heartIcon = scene.add
      .polygon(HEARTS_X, 33, [d, 0, 2 * d, d, d, 2 * d, 0, d], heartColor)
      .setDepth(5);
    this.heartsText = scene.add
      .text(HEARTS_X, 33, '', textStyle(30, colorHex(heartColor)))
      .setOrigin(0, 0.5)
      .setDepth(5);
    this.draw();
  }

  setScores(scores: [number, number]): void {
    scores.forEach((v, i) => {
      if (v !== this.scores[i]) {
        const t = this.scoreTexts[i as PlayerIndex];
        t.setScale(1.2);
        this.scene.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.Out' });
      }
    });
    this.scores = [...scores];
    this.scoreTexts[0].setText(scores[0].toLocaleString('fr-FR'));
    this.scoreTexts[1].setText(scores[1].toLocaleString('fr-FR'));
  }

  setHearts(n: number): void {
    this.heartsText.setText(String(n));
    // Losange + chiffre centrés ensemble sur HEARTS_X.
    const gap = 8;
    const w = HEART_D * 2 + gap + this.heartsText.width;
    const x0 = HEARTS_X - w / 2;
    this.heartIcon.setX(x0 + HEART_D);
    this.heartsText.setX(x0 + HEART_D * 2 + gap);
  }

  /** Change le tireur ; `announce` montre la bannière centrale (600 ms). */
  setActive(p: PlayerIndex, announce: boolean): void {
    this.active = p;
    this.draw();
    if (announce) this.banner(p);
  }

  /** Anneau du canon à la couleur (et à la forme) du joueur actif ; suit l'angle du canon. */
  drawRing(): void {
    const g = this.ringGfx.clear();
    const color = DUEL_RULES.colors[this.active];
    g.lineStyle(4, color, 1);
    const { x, y } = this.cannon;
    if (this.active === 0) g.strokeCircle(x, y, 21);
    else g.strokeRoundedRect(x - 21, y - 21, 42, 42, 12);
  }

  private draw(): void {
    const g = this.cartGfx.clear();
    for (const i of [0, 1] as const) {
      const on = i === this.active;
      const color = DUEL_RULES.colors[i];
      const x0 = CART.xs[i];
      g.fillStyle(PALETTE.panel, 0.85).fillRoundedRect(x0, CART.y, CART.w, CART.h, 16);
      g.fillStyle(color, on ? 1 : IDLE_ALPHA).fillRoundedRect(x0, CART.y, CART.w, CART.h, 16);
      // Pastille du joueur, toujours à pleine couleur sur un rond sombre.
      const px = i === 0 ? x0 + 28 : x0 + CART.w - 28;
      g.fillStyle(PALETTE.night, 0.9).fillCircle(px, CART.y + CART.h / 2, 17);
      drawPlayerShape(g, i, px, CART.y + CART.h / 2, 22, color);
      const ink = on ? TEXT.onAccent : TEXT.main;
      this.labels[i].setColor(ink);
      this.scoreTexts[i].setColor(ink);
    }
    this.drawRing();
  }

  private banner(p: PlayerIndex): void {
    const color = DUEL_RULES.colors[p];
    const g = this.scene.add.graphics();
    g.fillStyle(PALETTE.panel, 0.92).fillRoundedRect(-150, -42, 300, 84, 42);
    g.lineStyle(4, color, 1).strokeRoundedRect(-150, -42, 300, 84, 42);
    drawPlayerShape(g, p, -84, 0, 44, color);
    const t = this.scene.add.text(-40, 0, `J${p + 1}`, textStyle(44)).setOrigin(0, 0.5);
    const box = this.scene.add.container(640, 330, [g, t]).setDepth(30).setScale(0.6).setAlpha(0);
    this.scene.tweens.add({
      targets: box,
      scale: 1,
      alpha: 1,
      duration: 160,
      ease: 'Back.Out',
      onComplete: () =>
        this.scene.tweens.add({
          targets: box,
          alpha: 0,
          delay: BANNER_MS - 320,
          duration: 160,
          onComplete: () => box.destroy(),
        }),
    });
  }
}

function colorHex(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}
