import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { SCENES } from './keys';
import { PALETTE, textStyle } from './theme';
import { button } from './widgets';

/** Pause par-dessus la scène Game (Échap, P ou bouton du coin). */
export class PauseScene extends Phaser.Scene {
  constructor() {
    super(SCENES.pause);
  }

  create(data: { test?: boolean }): void {
    this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      PALETTE.night,
      0.7,
    );
    this.add.text(GAME_WIDTH / 2, 220, 'Pause', textStyle(48)).setOrigin(0.5);
    const resume = () => {
      this.scene.stop();
      this.scene.resume(SCENES.game);
    };
    button(this, GAME_WIDTH / 2, 330, 'Reprendre', resume, { primary: true });
    button(this, GAME_WIDTH / 2, 410, 'Recommencer', () => {
      this.scene.stop();
      this.scene.get(SCENES.game).scene.restart();
    });
    const options = () => {
      this.scene.pause();
      this.scene.launch(SCENES.options, { from: SCENES.pause });
    };
    button(this, GAME_WIDTH / 2, 490, 'Options', options);
    if (!data?.test) {
      button(this, GAME_WIDTH / 2, 570, 'Carte', () => {
        this.scene.stop(SCENES.game);
        this.scene.start(SCENES.map);
      });
    }
    // Pas de once : la pause peut être suspendue par les options puis reprise.
    this.input.keyboard?.on('keydown-ESC', () => !this.scene.isPaused() && resume());
    this.input.keyboard?.on('keydown-P', () => !this.scene.isPaused() && resume());
  }
}
