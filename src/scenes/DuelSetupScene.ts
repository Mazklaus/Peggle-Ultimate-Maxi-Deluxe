import Phaser from 'phaser';
import { COMPANION_ROSTER, type CompanionInfo } from '../companions';
import { DUEL_RULES, type PlayerIndex } from '../core/duel';
import type { LevelCatalog } from '../core/levelCatalog';
import type { LevelData } from '../core/levelFormat';
import { chapterState } from '../core/mapProgress';
import type { SaveData } from '../core/save';
import type { GameSceneData } from './GameScene';
import { REGISTRY, SCENES } from './keys';
import { drawLevelPreview } from './levelPreview';
import { currentOptions } from './OptionsScene';
import { drawPortrait } from './powerIcons';
import { CRYSTAL_COLORS, CRYSTAL_COLORS_CB, PALETTE, TEXT, bodyStyle, textStyle } from './theme';
import { fadeIn, fadeTo, panel } from './ui';
import { enableKeyboardFocus, iconButton, primaryButton } from './widgets';

export interface DuelSetupData {
  /** Choix précédents (revanche sur un autre niveau) : niveau et Astres. */
  levelId?: string;
  astres?: [string, string];
}

const LEVELS = { x0: 150, y0: 200, pitchX: 190, pitchY: 210, w: 160, h: 120 };
const PICK = { x0: 760, pitch: 64, rows: [250, 430] as const, r: 26 };

/** Forme du joueur (daltonisme) : J1 rond, J2 carré arrondi (specs UI/UX jalon 3, 4.1). */
function playerBadge(
  g: Phaser.GameObjects.Graphics,
  p: PlayerIndex,
  x: number,
  y: number,
  r: number,
): void {
  g.fillStyle(DUEL_RULES.colors[p], 1);
  if (p === 0) g.fillCircle(x, y, r);
  else g.fillRoundedRect(x - r, y - r, r * 2, r * 2, r * 0.45);
}

/**
 * Avant le duel (specs UI/UX jalon 3, 4.1) : 6 niveaux de duel en médaillons, puis chaque
 * joueur choisit son Astre (J1 lavande rond, J2 corail carré ; le même Astre reste
 * choisissable), JOUER. Deux joueurs, même écran, en alternance.
 */
export class DuelSetupScene extends Phaser.Scene {
  private level?: LevelData;
  private astres: [string, string] = ['pip', 'pip'];
  private levelRings = new Map<string, Phaser.GameObjects.Graphics>();
  private pickRings: Array<Map<string, Phaser.GameObjects.Graphics>> = [new Map(), new Map()];

  constructor() {
    super(SCENES.duelSetup);
  }

  create(data: DuelSetupData = {}): void {
    fadeIn(this);
    const save = this.registry.get(REGISTRY.save) as SaveData;
    const catalog = this.registry.get(REGISTRY.catalog) as LevelCatalog | undefined;
    const levels = catalog?.duel ?? [];
    this.levelRings.clear();
    this.pickRings = [new Map(), new Map()];

    const sky = this.textures.exists('carte-ciel-fixe') ? 'carte-ciel-fixe' : 'carte-fond';
    if (this.textures.exists(sky)) this.add.image(0, 0, sky).setOrigin(0).setAlpha(0.6);
    const back = iconButton(this, 40, 36, 'back', () => this.back(), { diameter: 48 });
    this.add.text(640, 36, 'Duel', textStyle(32)).setOrigin(0.5);
    panel(this, 335, 400, 610, 520, 24);
    panel(this, 980, 400, 560, 520, 24);

    // Niveaux de duel : aperçu + titre, 3 × 2.
    const colors = currentOptions(this).colorblind ? CRYSTAL_COLORS_CB : CRYSTAL_COLORS;
    levels.forEach((level, i) => {
      const x = LEVELS.x0 + (i % 3) * LEVELS.pitchX;
      const y = LEVELS.y0 + Math.floor(i / 3) * LEVELS.pitchY;
      const g = this.add.graphics();
      drawLevelPreview(
        g,
        level,
        x - LEVELS.w / 2,
        y - LEVELS.h / 2,
        LEVELS.w,
        LEVELS.h,
        colors,
        1.4,
      );
      const ring = this.add.graphics();
      this.levelRings.set(level.id, ring);
      this.add
        .text(x, y + LEVELS.h / 2 + 18, level.title ?? level.id, bodyStyle(14, TEXT.dim))
        .setOrigin(0.5);
      this.add
        .zone(x, y, LEVELS.w + 10, LEVELS.h + 10)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.pickLevel(level));
    });
    if (levels.length === 0)
      this.add
        .text(335, 400, 'Les duels arrivent bientôt.', bodyStyle(18, TEXT.dim))
        .setOrigin(0.5);

    // Astres réveillés et jouables ; J1 en haut, J2 en bas.
    const roster = COMPANION_ROSTER.filter(
      (c) => c.def && (c.wakesAtChapter <= 1 || chapterState(save, c.wakesAtChapter) !== 'locked'),
    );
    ([0, 1] as PlayerIndex[]).forEach((p) => {
      const y = PICK.rows[p];
      const g = this.add.graphics();
      playerBadge(g, p, PICK.x0 - 20, y - 70, 14);
      this.add
        .text(PICK.x0 + 4, y - 70, `J${p + 1}`, textStyle(24, p === 0 ? '#B9A6FF' : '#FF9E8F'))
        .setOrigin(0, 0.5);
      roster.forEach((c, i) => this.astreButton(c, p, PICK.x0 + i * PICK.pitch, y));
    });

    const fallback = roster[0]?.id ?? 'pip';
    const keep = (id?: string) => (id && roster.some((c) => c.id === id) ? id : fallback);
    this.astres = [keep(data.astres?.[0] ?? save.companion), keep(data.astres?.[1])];
    this.paintPicks();
    const start = levels.find((l) => l.id === data.levelId) ?? levels[0];
    if (start) this.pickLevel(start);

    const play = primaryButton(this, 980, 600, 'Jouer', () => this.play(), {
      icon: 'play',
      width: 240,
    });
    enableKeyboardFocus(this, [play, back], 0);
    this.input.keyboard?.on('keydown-ESC', () => this.back());
  }

  private astreButton(c: CompanionInfo, p: PlayerIndex, x: number, y: number): void {
    const g = this.add.graphics();
    g.fillStyle(PALETTE.night, 0.8).fillCircle(x, y, PICK.r);
    drawPortrait(g, x, y, PICK.r * 0.62, c.color);
    const ring = this.add.graphics();
    this.pickRings[p]!.set(c.id, ring);
    this.add
      .zone(x, y, PICK.r * 2 + 8, PICK.r * 2 + 8)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        this.astres[p] = c.id;
        this.paintPicks();
      });
  }

  private paintPicks(): void {
    ([0, 1] as PlayerIndex[]).forEach((p) => {
      for (const [id, ring] of this.pickRings[p]!) {
        ring.clear();
        if (id !== this.astres[p]) continue;
        const [x, y] = this.pickPos(p, id);
        ring.lineStyle(4, DUEL_RULES.colors[p], 1);
        if (p === 0) ring.strokeCircle(x, y, PICK.r + 5);
        else
          ring.strokeRoundedRect(
            x - PICK.r - 5,
            y - PICK.r - 5,
            PICK.r * 2 + 10,
            PICK.r * 2 + 10,
            12,
          );
      }
    });
  }

  private pickPos(p: PlayerIndex, id: string): [number, number] {
    const ids = [...this.pickRings[p]!.keys()];
    return [PICK.x0 + ids.indexOf(id) * PICK.pitch, PICK.rows[p]];
  }

  private pickLevel(level: LevelData): void {
    this.level = level;
    const catalog = this.registry.get(REGISTRY.catalog) as LevelCatalog | undefined;
    (catalog?.duel ?? []).forEach((l, i) => {
      const ring = this.levelRings.get(l.id);
      if (!ring) return;
      ring.clear();
      if (l.id !== level.id) return;
      const x = LEVELS.x0 + (i % 3) * LEVELS.pitchX;
      const y = LEVELS.y0 + Math.floor(i / 3) * LEVELS.pitchY;
      ring.lineStyle(4, PALETTE.accent, 1);
      ring.strokeRoundedRect(
        x - LEVELS.w / 2 - 5,
        y - LEVELS.h / 2 - 5,
        LEVELS.w + 10,
        LEVELS.h + 10,
        10,
      );
    });
  }

  private play(): void {
    if (!this.level) return;
    fadeTo(this, SCENES.game, {
      level: this.level,
      mode: { kind: 'duel', id: this.level.id, players: 2, astres: [...this.astres] },
    } satisfies GameSceneData);
  }

  private back(): void {
    fadeTo(this, SCENES.title);
  }
}
