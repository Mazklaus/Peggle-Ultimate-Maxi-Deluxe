import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { GameScene } from './GameScene';
import { OPTIONS_CHANGED, SCENES } from './keys';
import { currentOptions, updateOptions } from './OptionsScene';
import { textStyle } from './theme';
import { panel, veil } from './ui';
import {
  enableKeyboardFocus,
  iconButton,
  label,
  primaryButton,
  setIconButtonActive,
} from './widgets';

const PANEL = { w: 480, h: 360 };
/** Volume rendu par les bascules rapides quand on rallume le son ou la musique. */
const DEFAULT_VOLUME = 0.8;

/**
 * Pause (specs UI/UX 4) par-dessus le jeu figé : bouton du coin, Échap, P ou perte de focus.
 * REPRENDRE, rejouer, carte, options ; bascules rapides son, musique, daltonien. L'Astre dort.
 */
export class PauseScene extends Phaser.Scene {
  constructor() {
    super(SCENES.pause);
  }

  create(data: { test?: boolean }): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const top = cy - PANEL.h / 2;
    const game = this.scene.get(SCENES.game) as GameScene;
    game.companionSleep(true);

    veil(this, 0.7);
    panel(this, cx, cy, PANEL.w, PANEL.h, 24);
    this.add.text(cx, top + 46, 'Pause', textStyle(34)).setOrigin(0.5);

    const resume = () => {
      if (!this.scene.isActive()) return;
      game.companionSleep(false);
      this.scene.stop();
      game.resumeFromPause();
    };
    const replay = () => {
      this.scene.stop();
      game.scene.restart();
    };
    const toMap = () => {
      this.scene.stop(SCENES.game);
      this.scene.start(SCENES.map);
    };
    const options = () => {
      this.scene.pause();
      this.scene.launch(SCENES.options, { from: SCENES.pause });
    };

    const play = primaryButton(this, cx, top + 126, 'Reprendre', resume, {
      icon: 'play',
      width: 260,
    });

    // Ligne des actions secondaires.
    const rowY = top + 224;
    const actions: Array<[Phaser.GameObjects.Container, string]> = [
      [iconButton(this, 0, rowY, 'replay', replay), 'Rejouer'],
    ];
    if (!data?.test) actions.push([iconButton(this, 0, rowY, 'map', toMap), 'Carte']);
    actions.push([iconButton(this, 0, rowY, 'options', options), 'Options']);
    actions.forEach(([btn, text], i) => {
      const x = cx + (i - (actions.length - 1) / 2) * 110;
      btn.setX(x);
      label(this, x, rowY + 46, text, 13);
    });

    // Bascules rapides (son, musique, daltonien).
    const quickY = top + PANEL.h - 44;
    const o = currentOptions(this);
    const sound = iconButton(
      this,
      cx - 70,
      quickY,
      'sound',
      () => {
        const v = currentOptions(this).sfxVolume > 0 ? 0 : DEFAULT_VOLUME;
        updateOptions(this, { sfxVolume: v });
      },
      { diameter: 48, active: o.sfxVolume > 0 },
    );
    const music = iconButton(
      this,
      cx,
      quickY,
      'music',
      () => {
        const v = currentOptions(this).musicVolume > 0 ? 0 : DEFAULT_VOLUME;
        updateOptions(this, { musicVolume: v });
      },
      { diameter: 48, active: o.musicVolume > 0 },
    );
    const colorblind = iconButton(
      this,
      cx + 70,
      quickY,
      'colorblind',
      () => updateOptions(this, { colorblind: !currentOptions(this).colorblind }),
      { diameter: 48, active: o.colorblind },
    );
    // Les bascules suivent aussi les changements faits dans l'écran Options.
    const sync = () => {
      const now = currentOptions(this);
      setIconButtonActive(sound, now.sfxVolume > 0);
      setIconButtonActive(music, now.musicVolume > 0);
      setIconButtonActive(colorblind, now.colorblind);
    };
    this.game.events.on(OPTIONS_CHANGED, sync);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.game.events.off(OPTIONS_CHANGED, sync),
    );

    enableKeyboardFocus(this, [play, ...actions.map(([b]) => b), sound, music, colorblind], 0);
    // Pas de once : la pause peut être suspendue par les options puis reprise.
    this.input.keyboard?.on('keydown-ESC', () => !this.scene.isPaused() && resume());
    this.input.keyboard?.on('keydown-P', () => !this.scene.isPaused() && resume());
  }
}
