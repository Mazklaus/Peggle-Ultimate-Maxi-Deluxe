import Phaser from 'phaser';
import { COMPANION_ROSTER, type CompanionInfo } from '../companions';
import { writeSave, type SaveData } from '../core/save';
import type { LevelData } from '../core/levelFormat';
import { CompanionView } from './CompanionView';
import { REGISTRY, SCENES } from './keys';
import { drawPowerHex, drawPowerIcon, POWER_MINT } from './powerIcons';
import { PALETTE, textStyle, bodyStyle, TEXT } from './theme';
import { fadeTo, panel, veil } from './ui';
import { iconButton, primaryButton } from './widgets';

export interface CompanionSelectData {
  level: LevelData;
  /** Astres choisissables (réveillés et portés en jeu). */
  choices: string[];
  /** Astre préselectionné. */
  selected: string;
  /** Astre du chapitre (« conseillé ici »). */
  advised: string | null;
  /** Chapitre le plus avancé atteint (loges des Astres pas encore réveillés : « ? »). */
  reachedChapter: number;
}

const PANEL = { w: 960, h: 520 };
const LOGE = { w: 100, h: 140, pitch: 112, y: 255, raise: 12 };
const SHEET_Y = 390;
const DEMO = { w: 260, h: 110, loopMs: 2500 };

/**
 * Sélecteur de compagnon (specs UI/UX jalon 2, 2.2), par-dessus la carte figée :
 * 8 loges dans l'ordre de l'aventure, fiche du pouvoir de l'Astre choisi, JOUER.
 * Gauche / droite pour changer, Entrée / Espace pour jouer, Échap pour fermer.
 */
export class CompanionSelectScene extends Phaser.Scene {
  private data0!: CompanionSelectData;
  private selected = '';
  private loges = new Map<
    string,
    {
      root: Phaser.GameObjects.Container;
      floor: Phaser.GameObjects.Graphics;
      frame: Phaser.GameObjects.Graphics;
      view?: CompanionView;
      color: number;
    }
  >();
  private sheet?: Phaser.GameObjects.Container;
  private demoT = 0;
  private demoGfx?: Phaser.GameObjects.Graphics;

  constructor() {
    super(SCENES.companionSelect);
  }

  create(data: CompanionSelectData): void {
    this.data0 = data;
    this.selected = data.selected;
    this.loges.clear();
    this.demoT = 0;
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const left = cx - PANEL.w / 2;
    const top = cy - PANEL.h / 2;

    veil(this, 0.7).on('pointerup', () => this.close());
    panel(this, cx, cy, PANEL.w, PANEL.h, 24);
    iconButton(this, left + 44, top + 44, 'back', () => this.close(), { diameter: 48 });
    this.add.text(cx, top + 44, 'Compagnon', textStyle(26)).setOrigin(0.5);

    COMPANION_ROSTER.forEach((c, i) => this.buildLoge(c, cx + (i - 3.5) * LOGE.pitch));
    this.select(this.selected, false);

    primaryButton(this, cx, 490, 'Jouer', () => this.play(), { icon: 'play', width: 240 });

    const kb = this.input.keyboard;
    kb?.on('keydown-LEFT', () => this.step(-1));
    kb?.on('keydown-RIGHT', () => this.step(1));
    kb?.on('keydown-ENTER', () => this.play());
    kb?.on('keydown-SPACE', () => this.play());
    kb?.on('keydown-ESC', () => this.close());

    this.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, dt: number) => {
      for (const l of this.loges.values()) l.view?.update(dt / 1000, {});
      this.demoT = (this.demoT + dt) % DEMO.loopMs;
      this.drawDemo();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const l of this.loges.values()) l.view?.destroy();
      this.loges.clear();
    });
  }

  private buildLoge(c: CompanionInfo, x: number): void {
    const awake = c.wakesAtChapter <= this.data0.reachedChapter;
    const selectable = this.data0.choices.includes(c.id);
    const root = this.add.container(x, LOGE.y);
    const frame = this.add.graphics();
    const floor = this.add.graphics();
    root.add([frame, floor]);
    if (!awake) {
      frame
        .fillStyle(PALETTE.nightLight, 1)
        .fillRoundedRect(-LOGE.w / 2, -LOGE.h / 2, LOGE.w, LOGE.h, 14);
      root.add(this.add.text(0, 0, '?', textStyle(40, TEXT.dim)).setOrigin(0.5));
    } else {
      frame
        .fillStyle(0x232a5c, selectable ? 1 : 0.5)
        .fillRoundedRect(-LOGE.w / 2, -LOGE.h / 2, LOGE.w, LOGE.h, 14);
      root.add(
        this.add
          .text(0, LOGE.h / 2 - 14, c.name, bodyStyle(12, selectable ? TEXT.main : TEXT.dim))
          .setOrigin(0.5),
      );
      if (!selectable) root.setAlpha(0.55);
    }
    if (this.data0.advised === c.id) {
      const star = this.add.graphics();
      star.fillStyle(PALETTE.accent, 1).fillPoints(starPts(0, -LOGE.h / 2 - 14, 8, 3.4), true);
      root.add(star);
    }
    const entry: {
      root: Phaser.GameObjects.Container;
      floor: Phaser.GameObjects.Graphics;
      frame: Phaser.GameObjects.Graphics;
      view?: CompanionView;
      color: number;
    } = { root, floor, frame, color: c.color };
    if (awake && c.def) {
      const view = new CompanionView(this, c.def, { x: 0, y: 0 });
      view.setDisplay(x, LOGE.y + 36, 0.55);
      entry.view = view;
    }
    this.loges.set(c.id, entry);
    this.paintLoge(c.id, false);
    if (selectable) {
      const hit = this.add.zone(x, LOGE.y, LOGE.w, LOGE.h).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => this.select(c.id, true));
    }
  }

  private paintLoge(id: string, chosen: boolean): void {
    const l = this.loges.get(id);
    if (!l) return;
    l.floor.clear();
    l.floor.fillStyle(l.color, chosen ? 0.35 : 0.15).fillEllipse(0, 36 + 4, 76, 16);
    l.root.setY(LOGE.y - (chosen ? LOGE.raise : 0));
    l.frame.lineStyle(3, PALETTE.accent, chosen ? 1 : 0);
    if (chosen) l.frame.strokeRoundedRect(-LOGE.w / 2, -LOGE.h / 2, LOGE.w, LOGE.h, 14);
    else {
      // Redessine sans contour.
      const awake =
        COMPANION_ROSTER.find((c) => c.id === id)!.wakesAtChapter <= this.data0.reachedChapter;
      const selectable = this.data0.choices.includes(id);
      l.frame.clear();
      l.frame
        .fillStyle(awake ? 0x232a5c : PALETTE.nightLight, awake && selectable ? 1 : awake ? 0.5 : 1)
        .fillRoundedRect(-LOGE.w / 2, -LOGE.h / 2, LOGE.w, LOGE.h, 14);
    }
    const x = l.root.x;
    l.view?.setDisplay(x, l.root.y + 36, 0.55);
  }

  private select(id: string, react: boolean): void {
    if (!this.data0.choices.includes(id)) return;
    const prev = this.selected;
    this.selected = id;
    if (prev && prev !== id) this.paintLoge(prev, false);
    this.paintLoge(id, true);
    if (react) this.loges.get(id)?.view?.brain.onEvent('victoire');
    this.buildSheet();
  }

  private step(dir: number): void {
    const list = this.data0.choices;
    const i = list.indexOf(this.selected);
    const next = list[(i + dir + list.length) % list.length];
    if (next && next !== this.selected) this.select(next, true);
  }

  /** Fiche du pouvoir : hexagone + picto, mini-démo, type et charges. */
  private buildSheet(): void {
    this.sheet?.destroy();
    const c = COMPANION_ROSTER.find((r) => r.id === this.selected);
    if (!c) return;
    const cx = this.scale.width / 2;
    const s = this.add.container(0, 0);
    const g = this.add.graphics();
    drawPowerHex(g, cx - 330, SHEET_Y - 8, 72);
    drawPowerIcon(g, c.id, cx - 330, SHEET_Y - 8, 40);
    s.add(g);
    s.add(
      this.add.text(cx - 330, SHEET_Y + 44, c.power.name, bodyStyle(16, TEXT.main)).setOrigin(0.5),
    );

    // Type du pouvoir (icône) et charges max.
    const t = this.add.graphics();
    const tx = cx + 300;
    t.lineStyle(3.5, POWER_MINT, 1).fillStyle(POWER_MINT, 1);
    if (c.power.kind === 'immediate') {
      t.fillPoints(starLightning(tx, SHEET_Y - 22), true);
    } else if (c.power.kind === 'next') {
      t.beginPath();
      t.arc(tx, SHEET_Y - 22, 12, -Math.PI * 0.2, Math.PI * 1.3, false);
      t.strokePath();
      t.fillTriangle(tx + 10, SHEET_Y - 34, tx + 16, SHEET_Y - 22, tx + 4, SHEET_Y - 24);
    } else {
      t.fillPoints(shield(tx, SHEET_Y - 22), true);
    }
    if (c.power.kind !== 'immediate') {
      for (let i = 0; i < c.power.maxCharges; i++) {
        const px = tx + (i - (c.power.maxCharges - 1) / 2) * 20;
        t.fillStyle(POWER_MINT, 1).fillCircle(px, SHEET_Y + 16, 6);
      }
    }
    s.add(t);
    const label =
      c.power.kind === 'immediate'
        ? 'immédiat'
        : c.power.kind === 'next'
          ? 'tir suivant'
          : 'en réserve';
    s.add(this.add.text(tx, SHEET_Y + 44, label, bodyStyle(13)).setOrigin(0.5));

    // Cadre de la mini-démo.
    const frame = this.add.graphics();
    frame
      .fillStyle(PALETTE.night, 0.7)
      .fillRoundedRect(cx - DEMO.w / 2, SHEET_Y - DEMO.h / 2, DEMO.w, DEMO.h, 10);
    s.add(frame);
    this.demoGfx = this.add.graphics();
    s.add(this.demoGfx);
    this.sheet = s;
  }

  /**
   * Mini-démo en boucle (rendu simplifié) : un orbe descend parmi 6 cristaux ; le pouvoir
   * de l'Astre agit en menthe (trajectoire, onde, orbe scindé, etc.).
   */
  private drawDemo(): void {
    const g = this.demoGfx;
    if (!g) return;
    g.clear();
    const cx = this.scale.width / 2;
    const x0 = cx - DEMO.w / 2;
    const y0 = SHEET_Y - DEMO.h / 2;
    const u = this.demoT / DEMO.loopMs;
    const crystals = [
      [0.2, 0.45],
      [0.4, 0.62],
      [0.6, 0.45],
      [0.8, 0.62],
      [0.3, 0.8],
      [0.7, 0.8],
    ] as const;
    const orbX = (t: number) => x0 + DEMO.w * (0.5 + 0.28 * Math.sin(t * Math.PI * 1.6));
    const orbY = (t: number) => y0 + 10 + (DEMO.h - 20) * t;
    const id = this.selected;
    // Pouvoir en menthe.
    g.lineStyle(2, POWER_MINT, 0.6).fillStyle(POWER_MINT, 0.6);
    if (id === 'pip') {
      for (let k = 0; k < 14; k++) {
        const t = k / 13;
        g.fillCircle(orbX(t), orbY(t), 1.6);
      }
    } else if (id === 'bourdon' && u > 0.45) {
      g.strokeCircle(orbX(0.45), orbY(0.45), 10 + (u - 0.45) * 120);
    } else if (id === 'mousse') {
      g.strokeCircle(x0 + DEMO.w * 0.3, y0 + DEMO.h * 0.8, 22);
    } else if (id === 'horloge') {
      g.strokeCircle(cx, y0 + DEMO.h / 2, 46);
    }
    // Cristaux : allumés au passage de l'orbe.
    crystals.forEach(([px, py]) => {
      const x = x0 + DEMO.w * px;
      const y = y0 + DEMO.h * py;
      const passed = orbY(u) > y && Math.abs(orbX((y - y0 - 10) / (DEMO.h - 20)) - x) < 50;
      g.fillStyle(passed ? PALETTE.lit : 0x6fcbff, 1).fillCircle(x, y, 6);
    });
    // Orbe (ou deux orbes pour Twi & Nkl, après la scission).
    const slow = id === 'horloge' ? 0.6 : 1;
    const t = Math.min(1, u * slow * 1.1);
    if (id === 'jumelles' && t > 0.4) {
      const d = (t - 0.4) * 80;
      g.fillStyle(PALETTE.orb, 1)
        .fillCircle(orbX(t) - d, orbY(t), 5)
        .fillCircle(orbX(t) + d, orbY(t), 5);
    } else {
      const zig = id === 'volte' ? Math.sin(t * 30) * 10 : 0;
      g.fillStyle(PALETTE.orb, 1).fillCircle(orbX(t) + zig, orbY(t), 5);
      if (id === 'grelot')
        g.lineStyle(2, POWER_MINT, 0.7).lineBetween(
          orbX(t),
          orbY(t),
          orbX(Math.max(0, t - 0.12)),
          orbY(Math.max(0, t - 0.12)),
        );
    }
    if (id === 'nuage-lune' && t > 0.9) {
      g.lineStyle(2, POWER_MINT, 0.7).lineBetween(orbX(t), orbY(t), orbX(t), y0 + 10);
    }
  }

  private play(): void {
    const save = this.registry.get(REGISTRY.save) as SaveData;
    save.companion = this.selected;
    writeSave(save);
    const map = this.scene.get(SCENES.map);
    this.scene.stop();
    this.scene.resume(SCENES.map);
    fadeTo(map, SCENES.game, { level: this.data0.level, companion: this.selected });
  }

  private close(): void {
    if (!this.scene.isActive()) return;
    this.scene.stop();
    this.scene.resume(SCENES.map);
  }
}

function starPts(x: number, y: number, outer: number, inner: number): Phaser.Math.Vector2[] {
  return Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? outer : inner;
    return new Phaser.Math.Vector2(x + Math.cos(a) * r, y + Math.sin(a) * r);
  });
}

function starLightning(x: number, y: number): Phaser.Math.Vector2[] {
  return [
    [2, -14],
    [-8, 2],
    [-1, 2],
    [-4, 14],
    [8, -3],
    [1, -3],
  ].map(([dx, dy]) => new Phaser.Math.Vector2(x + (dx ?? 0), y + (dy ?? 0)));
}

function shield(x: number, y: number): Phaser.Math.Vector2[] {
  return [
    [0, -14],
    [12, -9],
    [10, 4],
    [0, 14],
    [-10, 4],
    [-12, -9],
  ].map(([dx, dy]) => new Phaser.Math.Vector2(x + (dx ?? 0), y + (dy ?? 0)));
}
