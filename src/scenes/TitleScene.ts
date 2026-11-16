import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { LevelCatalog } from '../core/levelCatalog';
import { markSeen, writeSave, type SaveData } from '../core/save';
import { OPTIONS_CHANGED, REGISTRY, SCENES } from './keys';
import { currentOptions, updateOptions } from './OptionsScene';
import { PALETTE, textStyle, TEXT } from './theme';
import { fadeIn, fadeTo } from './ui';
import { iconButton, primaryButton, setIconButtonActive } from './widgets';

const BG_KEY = 'carte-fond';

/**
 * Écran titre (specs UI/UX 2) : ciel de la DA (plus il y a de niveaux finis, plus il y a
 * d'étoiles allumées), logo qui flotte, JOUER. Clic n'importe où ou Espace = JOUER.
 * 1re partie : intro en vignettes puis prologue 1 directement ; ensuite, la carte.
 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super(SCENES.title);
  }

  preload(): void {
    if (!this.textures.exists(BG_KEY))
      this.load.svg(BG_KEY, 'da/decors/carte-fond.svg', { width: 1280, height: 720 });
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

    const logo = this.add.container(GAME_WIDTH / 2, 230, [
      this.add.text(0, 0, 'Ricochet Céleste', textStyle(80)).setOrigin(0.5),
      this.add
        .text(0, 70, 'Rallume le ciel, un rebond à la fois', textStyle(22, TEXT.dim))
        .setOrigin(0.5),
    ]);
    if (!reduced) {
      this.tweens.add({
        targets: logo,
        y: 222,
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
    primaryButton(this, GAME_WIDTH / 2, 470, 'Jouer', start, { icon: 'play', width: 240 });

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

    // Clic n'importe où (hors boutons), Espace ou Entrée = JOUER. Le clic qui ferme les
    // options (sur leur voile) ne doit pas lancer la partie en passant au titre réveillé.
    let resumedAt = -1;
    this.events.on(Phaser.Scenes.Events.RESUME, () => (resumedAt = this.game.loop.frame));
    this.input.on(
      'pointerup',
      (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        if (over.length === 0 && this.game.loop.frame > resumedAt + 1) start();
      },
    );
    this.input.keyboard?.on('keydown-SPACE', start);
    this.input.keyboard?.on('keydown-ENTER', start);
  }
}
