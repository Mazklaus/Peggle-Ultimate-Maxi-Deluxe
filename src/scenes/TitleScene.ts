import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { LevelCatalog } from '../core/levelCatalog';
import { localDateKey } from '../core/daily';
import { currentChapter, MAX_STARS, totalStars } from '../core/mapProgress';
import { MENU_ORDER, modeUnlocked } from '../core/modeMenu';
import type { ModeKind } from '../core/modes';
import { challengeMedals, currentStreak, markSeen, writeSave, type SaveData } from '../core/save';
import { CompanionView } from './CompanionView';
import { astreDef, chapter as chapterDef } from './mapData';
import { OPTIONS_CHANGED, REGISTRY, SCENES } from './keys';
import { currentOptions, updateOptions } from './OptionsScene';
import { PALETTE, textStyle, TEXT, bodyStyle } from './theme';
import { fadeIn, fadeTo, panel } from './ui';
import { iconButton, setIconButtonActive } from './widgets';

const BG_KEY = 'carte-fond';
const MODE_ICON: Record<ModeKind, string> = {
  aventure: 'mode-aventure',
  defi: 'mode-defis',
  quotidien: 'mode-jour',
  duel: 'mode-duel',
};
const MODE_NAME: Record<ModeKind, string> = {
  aventure: 'Aventure',
  defi: 'Défis',
  quotidien: 'Du jour',
  duel: 'Duel',
};
/** Cartes des modes (specs UI/UX jalon 3, 1) : centre x, taille. Rangée centrée en y=420. */
const CARDS: Record<ModeKind, { x: number; w: number; h: number }> = {
  aventure: { x: 320, w: 300, h: 300 },
  defi: { x: 600, w: 220, h: 260 },
  quotidien: { x: 840, w: 220, h: 260 },
  duel: { x: 1080, w: 220, h: 260 },
};
const CARD_Y = 420;
/** Modes dont l'écran est livré (les autres restent sous cadenas en attendant). */
const READY: ReadonlySet<ModeKind> = new Set(['aventure', 'quotidien', 'defi', 'duel']);
const iconKey = (n: string) => `icone-${n}`;

interface ModeCard {
  mode: ModeKind;
  open: boolean;
  root: Phaser.GameObjects.Container;
  ring: Phaser.GameObjects.Graphics;
}

/**
 * Écran titre (specs UI/UX 2) : ciel de la DA (plus il y a de niveaux finis, plus il y a
 * d'étoiles allumées), logo qui flotte, JOUER. Clic n'importe où ou Espace = JOUER.
 * 1re partie : intro en vignettes puis prologue 1 directement ; ensuite, la carte.
 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super(SCENES.title);
  }

  private cards: ModeCard[] = [];
  private focus = 0;
  private astre?: CompanionView;

  preload(): void {
    if (!this.textures.exists(BG_KEY))
      this.load.svg(BG_KEY, 'da/decors/carte-fond.svg', { width: 1280, height: 720 });
    for (const n of [...Object.values(MODE_ICON), 'cadenas', 'flamme'])
      if (!this.textures.exists(iconKey(n)))
        this.load.svg(iconKey(n), `da/icones/${n}.svg`, { width: 144, height: 144 });
  }

  create(): void {
    fadeIn(this);
    this.cameras.main.setBackgroundColor(PALETTE.night);
    const save = this.registry.get(REGISTRY.save) as SaveData | undefined;
    const catalog = this.registry.get(REGISTRY.catalog) as LevelCatalog | undefined;
    const reduced = currentOptions(this).reducedMotion;

    if (this.textures.exists(BG_KEY)) this.add.image(0, 0, BG_KEY).setOrigin(0);
    this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      PALETTE.night,
      0.45,
    );

    // Le ciel se rallume avec la progression : 3 étoiles vives par niveau terminé.
    const done = save ? Object.values(save.levels).filter((r) => r.completed).length : 0;
    const bright = Math.min(120, 12 + done * 3);
    for (let i = 0; i < bright; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(0, 380),
        Phaser.Math.FloatBetween(0.8, 2.2),
        PALETTE.lit,
        Phaser.Math.FloatBetween(0.4, 0.9),
      );
      if (reduced) continue;
      this.tweens.add({
        targets: star,
        alpha: 0.15,
        duration: Phaser.Math.Between(1200, 3000),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 2000),
      });
    }

    // Le titre devient le menu (specs UI/UX jalon 3, 1) : logo réduit en haut, 4 cartes.
    const logo = this.add.container(GAME_WIDTH / 2, 130, [
      this.add.text(0, 0, 'Ricochet Céleste', textStyle(64)).setOrigin(0.5),
      this.add
        .text(0, 54, 'Rallume le ciel, un rebond à la fois', textStyle(20, TEXT.dim))
        .setOrigin(0.5),
    ]);
    if (!reduced) {
      this.tweens.add({
        targets: logo,
        y: 124,
        duration: 2200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }

    const start = () => {
      if (this.scene.isPaused()) return;
      const firstGame = !!save && !Object.values(save.levels).some((r) => r.completed);
      const first = catalog?.levels[0];
      const next =
        firstGame && first ? { scene: SCENES.game, data: { level: first } } : { scene: SCENES.map };
      // Intro en vignettes au premier « Jouer » seulement.
      if (save && markSeen(save, 'intro')) {
        writeSave(save);
        fadeTo(this, SCENES.cutscene, { sequence: 'intro', next });
      } else fadeTo(this, next.scene, 'data' in next ? next.data : undefined);
    };
    this.cards = [];
    this.astre = undefined;
    if (save) for (const mode of MENU_ORDER) this.buildCard(mode, save, catalog, start);
    this.focus = 0;
    this.paintFocus(false);

    const cb = iconButton(
      this,
      1230,
      660,
      'colorblind',
      () => updateOptions(this, { colorblind: !currentOptions(this).colorblind }),
      { diameter: 48, active: currentOptions(this).colorblind },
    );
    iconButton(
      this,
      1160,
      660,
      'options',
      () => {
        this.scene.pause();
        this.scene.launch(SCENES.options, { from: SCENES.title });
      },
      { diameter: 48 },
    );
    const onOptions = () => setIconButtonActive(cb, currentOptions(this).colorblind);
    this.game.events.on(OPTIONS_CHANGED, onOptions);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.game.events.off(OPTIONS_CHANGED, onOptions),
    );

    // Gauche / droite entre les cartes ; Entrée / Espace ouvre (Aventure par défaut).
    const kb = this.input.keyboard;
    kb?.on('keydown-LEFT', () => this.moveFocus(-1));
    kb?.on('keydown-RIGHT', () => this.moveFocus(1));
    const openFocused = () => {
      if (this.scene.isPaused()) return;
      this.openMode(this.cards[this.focus], start);
    };
    kb?.on('keydown-SPACE', openFocused);
    kb?.on('keydown-ENTER', openFocused);
    if (!save) kb?.on('keydown-SPACE', start);

    this.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, dt: number) =>
      this.astre?.update(dt / 1000, {}),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.astre?.destroy();
      this.astre = undefined;
    });
  }

  /** Une carte de mode : fond panneau, icône 72 px, nom, info ; verrouillée = voile + cadenas. */
  private buildCard(
    mode: ModeKind,
    save: SaveData,
    catalog: LevelCatalog | undefined,
    start: () => void,
  ): void {
    const c = CARDS[mode];
    const open = READY.has(mode) && modeUnlocked(save, mode);
    const root = this.add.container(c.x, CARD_Y);
    const bg = panel(this, 0, 0, c.w, c.h, 24);
    const ring = this.add.graphics();
    root.add([bg, ring]);
    const big = mode === 'aventure';
    const iconY = -c.h / 2 + (big ? 70 : 64);
    if (this.textures.exists(iconKey(MODE_ICON[mode])))
      root.add(this.add.image(0, iconY, iconKey(MODE_ICON[mode])).setDisplaySize(72, 72));
    root.add(this.add.text(0, iconY + 66, MODE_NAME[mode], textStyle(24)).setOrigin(0.5));
    const infoY = iconY + 104;

    if (mode === 'aventure') {
      // Barre de progression (étoiles x/300) et l'Astre du chapitre en cours, vivant.
      const stars = totalStars(save);
      const bar = this.add.graphics();
      const w = 200;
      bar.fillStyle(PALETTE.border, 1).fillRoundedRect(-w / 2, infoY, w, 10, 5);
      bar.fillStyle(PALETTE.accent, 1);
      bar.fillRoundedRect(-w / 2, infoY, Math.max(10, (w * stars) / MAX_STARS), 10, 5);
      root.add(bar);
      root.add(
        this.add
          .text(0, infoY + 30, `★ ${stars}/${MAX_STARS}`, bodyStyle(14, TEXT.dim))
          .setOrigin(0.5),
      );
      const order = catalog?.levels.map((l) => l.id) ?? [];
      const n = currentChapter(save, order);
      const def = n >= 1 ? astreDef(chapterDef(n).astre) : null;
      if (def) {
        this.astre = new CompanionView(this, def, { x: 0, y: 0 });
        this.astre.setDisplay(c.x + c.w / 2 - 44, CARD_Y - c.h / 2 + 64, 0.42);
        this.astre.setDepth(5);
      }
    } else if (mode === 'defi') {
      const ids = (catalog?.challenges ?? []).map((l) => l.id);
      root.add(
        this.add
          .text(0, infoY, `${challengeMedals(save, ids)}/${ids.length}`, textStyle(20))
          .setOrigin(0.5),
      );
    } else if (mode === 'quotidien') {
      const today = localDateKey();
      const streak = currentStreak(save, today);
      if (this.textures.exists(iconKey('flamme')))
        root.add(
          this.add
            .image(-16, infoY, iconKey('flamme'))
            .setDisplaySize(26, 26)
            .setAlpha(streak > 0 ? 1 : 0.4),
        );
      root.add(this.add.text(2, infoY, String(streak), textStyle(20)).setOrigin(0, 0.5));
      if (open && save.daily?.date !== today) {
        const pill = this.add
          .text(c.w / 2 - 16, -c.h / 2 + 18, 'nouveau', bodyStyle(13, TEXT.onAccent))
          .setOrigin(1, 0.5)
          .setBackgroundColor('#B9A6FF')
          .setPadding(8, 3, 8, 3);
        root.add(pill);
      }
    }

    if (!open) {
      const shade = this.add.graphics();
      shade.fillStyle(PALETTE.night, 0.6).fillRoundedRect(-c.w / 2, -c.h / 2, c.w, c.h, 24);
      root.add(shade);
      if (this.textures.exists(iconKey('cadenas'))) {
        const lock = this.add.image(0, infoY, iconKey('cadenas')).setDisplaySize(48, 48);
        root.add(lock);
        bg.on('pointerover', () =>
          this.tweens.add({
            targets: lock,
            angle: { from: -12, to: 12 },
            duration: 70,
            yoyo: true,
            repeat: 2,
            onComplete: () => lock.setAngle(0),
          }),
        );
      }
    }
    const card: ModeCard = { mode, open, root, ring };
    this.cards.push(card);
    bg.setInteractive({ useHandCursor: open });
    bg.on('pointerover', () => {
      this.focus = this.cards.indexOf(card);
      this.paintFocus(true);
    });
    bg.on('pointerup', () => this.openMode(card, start));
  }

  private moveFocus(dir: number): void {
    if (this.cards.length === 0) return;
    this.focus = (this.focus + dir + this.cards.length) % this.cards.length;
    this.paintFocus(true);
  }

  /** Contour lavande sur la carte qui a le focus (et léger grossissement). */
  private paintFocus(animate: boolean): void {
    this.cards.forEach((card, i) => {
      const c = CARDS[card.mode];
      const on = i === this.focus;
      card.ring.clear();
      if (on) card.ring.lineStyle(4, PALETTE.accent, card.open ? 1 : 0.4);
      if (on) card.ring.strokeRoundedRect(-c.w / 2, -c.h / 2, c.w, c.h, 24);
      const scale = on && card.open ? 1.03 : 1;
      if (animate) this.tweens.add({ targets: card.root, scale, duration: 120 });
      else card.root.setScale(scale);
    });
  }

  private openMode(card: ModeCard | undefined, start: () => void): void {
    if (!card || !card.open || this.scene.isPaused()) return;
    if (card.mode === 'aventure') start();
    else if (card.mode === 'quotidien') fadeTo(this, SCENES.daily);
    else if (card.mode === 'defi') fadeTo(this, SCENES.challenges);
    else if (card.mode === 'duel') fadeTo(this, SCENES.duelSetup);
  }
}
