import Phaser from 'phaser';
import { companionById } from '../companions';
import { goalTarget, type Challenge } from '../core/challenge';
import type { LevelCatalog } from '../core/levelCatalog';
import type { LevelData } from '../core/levelFormat';
import { chapterState } from '../core/mapProgress';
import { challengeMedals, type SaveData } from '../core/save';
import { CONSTRAINT_ICON, GOAL_ICON, goalLabel, iconKey } from './ChallengeLine';
import type { GameSceneData } from './GameScene';
import { REGISTRY, SCENES } from './keys';
import { drawLevelPreview } from './levelPreview';
import { currentOptions } from './OptionsScene';
import { drawPortrait } from './powerIcons';
import { starPoints } from './shapes';
import { CRYSTAL_COLORS, CRYSTAL_COLORS_CB, PALETTE, TEXT, bodyStyle, textStyle } from './theme';
import { fadeIn, fadeTo, panel } from './ui';
import { enableKeyboardFocus, iconButton, primaryButton } from './widgets';

/** Grille 6 × 4 de médaillons Ø 88 (specs UI/UX jalon 3, 2.1). */
const GRID = { cols: 6, x0: 130, y0: 170, pitch: 124, r: 44 };
/** Panneau du défi choisi : rectangle fixe (2.2). */
const SHEET = { x: 900, y: 250, w: 340, h: 440 };
const EXTRA_ICONS = ['cadenas', 'medaille-defi'];

/** Texte facultatif sous la ligne de pictogrammes (2.2). */
function goalText(c: Challenge): string {
  const v = goalTarget(c).toLocaleString('fr-FR');
  switch (c.goal) {
    case 'score':
      return `Atteins ${v} points`;
    case 'nettoyage':
      return 'Brise tous les cristaux';
    case 'tir_unique':
      return `${v} cœurs en un seul tir`;
    case 'economie':
      return `Finis avec ${v} orbes ou plus`;
    case 'pouvoir':
      return `Active le pouvoir ${v} fois`;
    case 'chaine':
      return `${v} rebonds en un tir`;
  }
}

/**
 * Liste des défis (specs UI/UX jalon 3, 2.1 et 2.2) : médaillons par chapitre (verrouillé
 * tant que le chapitre n'est pas fini, ouvert, réussi), panneau du défi choisi (aperçu, ligne
 * d'objectif en pictogrammes, Astre imposé, JOUER).
 */
export class ChallengesScene extends Phaser.Scene {
  private sheet?: Phaser.GameObjects.Container;
  private selected?: LevelData;

  constructor() {
    super(SCENES.challenges);
  }

  preload(): void {
    const names = [...Object.values(GOAL_ICON), ...Object.values(CONSTRAINT_ICON), ...EXTRA_ICONS];
    for (const n of names)
      if (!this.textures.exists(iconKey(n)))
        this.load.svg(iconKey(n), `da/icones/${n}.svg`, { width: 96, height: 96 });
  }

  create(): void {
    fadeIn(this);
    this.sheet = undefined;
    this.selected = undefined;
    const save = this.registry.get(REGISTRY.save) as SaveData;
    const catalog = this.registry.get(REGISTRY.catalog) as LevelCatalog | undefined;
    const list = (catalog?.challenges ?? []).filter((l) => l.challenge);

    const sky = this.textures.exists('carte-ciel-fixe') ? 'carte-ciel-fixe' : 'carte-fond';
    if (this.textures.exists(sky)) this.add.image(0, 0, sky).setOrigin(0).setAlpha(0.6);
    const back = iconButton(this, 40, 36, 'back', () => this.back(), { diameter: 48 });
    this.add.text(640, 36, 'Défis', textStyle(32)).setOrigin(0.5);
    const medals = challengeMedals(
      save,
      list.map((l) => l.id),
    );
    this.add.text(1236, 36, `${medals}/${list.length}`, textStyle(20)).setOrigin(1, 0.5);

    if (list.length === 0) {
      this.add
        .text(640, 360, 'Les défis arrivent bientôt.', bodyStyle(18, TEXT.dim))
        .setOrigin(0.5);
    }
    let first: LevelData | undefined;
    list.forEach((level, i) => {
      const x = GRID.x0 + (i % GRID.cols) * GRID.pitch;
      const y = GRID.y0 + Math.floor(i / GRID.cols) * GRID.pitch;
      const open = level.chapter <= 0 || chapterState(save, level.chapter) === 'done';
      const won = !!save.challenges?.[level.id];
      this.medallion(level, x, y, open, won);
      if (open && !won && !first) first = level;
    });
    const start =
      first ?? list.find((l) => l.chapter <= 0 || chapterState(save, l.chapter) === 'done');
    if (start) this.select(start);

    enableKeyboardFocus(this, [back], 0);
    this.input.keyboard?.on('keydown-ESC', () => this.back());
    this.input.keyboard?.on('keydown-ENTER', () => this.play());
  }

  private medallion(level: LevelData, x: number, y: number, open: boolean, won: boolean): void {
    const c = level.challenge!;
    const g = this.add.graphics();
    if (won) {
      g.fillStyle(PALETTE.accent, 1).fillCircle(x, y, GRID.r);
    } else {
      g.fillStyle(0x141b3d, 1).fillCircle(x, y, GRID.r);
      g.lineStyle(3, open ? PALETTE.accent : PALETTE.starDim, open ? 1 : 0.4);
      g.strokeCircle(x, y, GRID.r);
    }
    const icon = this.add
      .image(x, y - 6, iconKey(GOAL_ICON[c.goal]))
      .setDisplaySize(40, 40)
      .setAlpha(open ? 1 : 0.25);
    if (won) icon.setTint(0x0b1026);
    this.add
      .text(
        x,
        y + 26,
        `${level.chapter}-${level.index}`,
        bodyStyle(12, won ? TEXT.onAccent : TEXT.dim),
      )
      .setOrigin(0.5)
      .setAlpha(open ? 1 : 0.5);
    if (won) g.fillStyle(PALETTE.lit, 1).fillPoints(starPoints(x + 30, y - 30, 10, 4.2), true);
    if (!open) {
      if (this.textures.exists(iconKey('cadenas')))
        this.add.image(x + 26, y + 28, iconKey('cadenas')).setDisplaySize(26, 26);
      return;
    }
    this.add
      .zone(x, y, GRID.r * 2, GRID.r * 2)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.select(level));
  }

  /** Panneau du défi : aperçu, objectif en pictogrammes (+ texte facultatif), Astre, JOUER. */
  private select(level: LevelData): void {
    this.selected = level;
    this.sheet?.destroy();
    const c = level.challenge!;
    const { x, y, w, h } = SHEET;
    const root = this.add.container(x, y);
    this.sheet = root;
    const bg = panel(this, w / 2, h / 2, w, h, 20);
    root.add(bg);
    const colors = currentOptions(this).colorblind ? CRYSTAL_COLORS_CB : CRYSTAL_COLORS;
    const prev = this.add.graphics();
    drawLevelPreview(prev, level, 20, 18, w - 40, (w - 40) * 0.75, colors, 2);
    root.add(prev);

    // Ligne d'objectif lue comme une phrase : [picto] [chiffre] [contrainte].
    const lineY = 18 + (w - 40) * 0.75 + 40;
    const parts: Phaser.GameObjects.GameObject[] = [];
    let cx = 0;
    const goalIcon = this.add.image(0, 0, iconKey(GOAL_ICON[c.goal])).setDisplaySize(40, 40);
    goalIcon.setX(cx + 20);
    cx += 48;
    const value = this.add.text(cx, 0, goalLabel(c), textStyle(32)).setOrigin(0, 0.5);
    cx += value.width + 12;
    parts.push(goalIcon, value);
    if (c.constraint) {
      const k = iconKey(CONSTRAINT_ICON[c.constraint]);
      const ci = this.add.image(cx + 16, 0, k).setDisplaySize(32, 32);
      parts.push(ci);
      cx += 36;
      if (c.constraint === 'chrono') {
        const t = this.add.text(cx + 4, 0, '90 s', textStyle(18, TEXT.dim)).setOrigin(0, 0.5);
        parts.push(t);
        cx += t.width + 8;
      }
    }
    const line = this.add.container(w / 2 - cx / 2, lineY, parts);
    root.add(line);
    root.add(this.add.text(w / 2, lineY + 34, goalText(c), bodyStyle(14, TEXT.dim)).setOrigin(0.5));

    // Astre imposé : pastille compagnon + cadenas.
    const astreId = c.constraint === 'astre_impose' ? (c.astre ?? level.companion) : null;
    const astre = astreId ? companionById(astreId) : undefined;
    if (astre) {
      const p = this.add.graphics();
      p.fillStyle(PALETTE.night, 0.8).fillCircle(w - 40, 40, 24);
      p.lineStyle(3, astre.color, 0.9).strokeCircle(w - 40, 40, 24);
      drawPortrait(p, w - 40, 40, 15, astre.color);
      root.add(p);
      if (this.textures.exists(iconKey('cadenas')))
        root.add(this.add.image(w - 22, 58, iconKey('cadenas')).setDisplaySize(20, 20));
    }

    const play = primaryButton(this, w / 2, h - 44, 'Jouer', () => this.play(), {
      icon: 'play',
      width: 200,
    });
    root.add(play);
  }

  private play(): void {
    const level = this.selected;
    if (!level) return;
    fadeTo(this, SCENES.game, {
      level,
      mode: { kind: 'defi', id: level.id },
    } satisfies GameSceneData);
  }

  private back(): void {
    fadeTo(this, SCENES.title);
  }
}
