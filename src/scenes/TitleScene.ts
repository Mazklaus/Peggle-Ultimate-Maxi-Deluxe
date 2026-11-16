import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { markSeen, writeSave, type SaveData } from '../core/save';
import { REGISTRY, SCENES } from './keys';
import { PALETTE, textStyle, TEXT } from './theme';
import { button } from './widgets';

/** Écran titre provisoire : le design final vient de l'UI/UX et de la DA. */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super(SCENES.title);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.night);
    for (let i = 0; i < 80; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(0, GAME_HEIGHT),
        Phaser.Math.FloatBetween(0.8, 2.2),
        0xfff6e0,
        Phaser.Math.FloatBetween(0.2, 0.8),
      );
      this.tweens.add({
        targets: star,
        alpha: 0.1,
        duration: Phaser.Math.Between(1200, 3000),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 2000),
      });
    }
    this.add.text(GAME_WIDTH / 2, 230, 'Ricochet Céleste', textStyle(72)).setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 300, 'Rallume le ciel, un rebond à la fois', textStyle(22, TEXT.dim))
      .setOrigin(0.5);
    const start = () => {
      // Intro en vignettes au premier « Jouer » seulement.
      const save = this.registry.get(REGISTRY.save) as SaveData | undefined;
      if (save && markSeen(save, 'intro')) {
        writeSave(save);
        this.scene.start(SCENES.cutscene, { sequence: 'intro', next: { scene: SCENES.map } });
      } else this.scene.start(SCENES.map);
    };
    button(this, GAME_WIDTH / 2, 450, 'Jouer', start, { primary: true, size: 30, width: 260 });
    button(
      this,
      GAME_WIDTH / 2,
      540,
      'Options',
      () => {
        this.scene.pause();
        this.scene.launch(SCENES.options, { from: SCENES.title });
      },
      { width: 200, size: 22 },
    );
    this.input.keyboard?.once('keydown-SPACE', start);
    this.input.keyboard?.once('keydown-ENTER', start);
  }
}
