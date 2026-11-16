import Phaser from 'phaser';
import { audio } from '../audio';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { CrystalKind } from '../core/level';
import { GAME_SPEEDS, writeSave, type Options, type SaveData } from '../core/save';
import { OPTIONS_CHANGED, REGISTRY, SCENES } from './keys';
import { CRYSTAL_COLORS, CRYSTAL_COLORS_CB, setColorblindPower, textStyle } from './theme';
import { panel, veil } from './ui';
import {
  enableKeyboardFocus,
  icon,
  iconButton,
  label,
  segmented,
  slider,
  toggle,
  type IconName,
} from './widgets';

/** Applique les options qui agissent hors des scènes (volumes). */
export function applyAudioOptions(o: Options): void {
  audio.applySettings({
    music: o.musicVolume,
    sfx: o.sfxVolume,
    voice: o.voiceVolume,
    soft: o.softAudio,
    mono: o.monoAudio,
  });
}

/** Change une ou plusieurs options : sauvegarde immédiate, son, et signal aux scènes ouvertes. */
export function updateOptions(scene: Phaser.Scene, patch: Partial<Options>): Options {
  const save = scene.registry.get(REGISTRY.save) as SaveData;
  Object.assign(save.options, patch);
  writeSave(save);
  applyAudioOptions(save.options);
  setColorblindPower(save.options.colorblind);
  scene.game.events.emit(OPTIONS_CHANGED, save.options);
  return save.options;
}

export function currentOptions(scene: Phaser.Scene): Options {
  return (scene.registry.get(REGISTRY.save) as SaveData).options;
}

const PANEL = { w: 600, h: 580 };

/**
 * Écran Options (specs UI/UX 6 ter) : overlay par-dessus le titre, la carte ou la pause.
 * Son et musique en curseurs, daltonien et animations en bascules, sauvegarde à chaque changement.
 */
export class OptionsScene extends Phaser.Scene {
  private from: string = SCENES.title;

  constructor() {
    super(SCENES.options);
  }

  create(data: { from?: string }): void {
    this.from = data?.from ?? SCENES.title;
    const o = currentOptions(this);
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const left = cx - PANEL.w / 2;
    const top = cy - PANEL.h / 2;

    veil(this, 0.7).on('pointerup', () => this.close()); // clic hors panneau = fermer
    panel(this, cx, cy, PANEL.w, PANEL.h, 24);
    this.add.text(cx, top + 44, 'Options', textStyle(32)).setOrigin(0.5);
    const back = iconButton(this, left + 44, top + 44, 'back', () => this.close(), {
      diameter: 48,
    });

    const rowY = (i: number) => top + 112 + i * 58;
    const row = (i: number, name: IconName, text: string) => {
      icon(this, left + 60, rowY(i), name, 32);
      label(this, left + 150, rowY(i), text, 16).setOrigin(0, 0.5);
    };
    const ctrlX = left + PANEL.w - 170;

    const volume = (
      i: number,
      name: IconName,
      text: string,
      value: number,
      key: 'sfxVolume' | 'musicVolume' | 'voiceVolume',
    ) => {
      row(i, name, text);
      return slider(this, ctrlX, rowY(i), value, (v) => updateOptions(this, { [key]: v }), {
        width: 200,
      });
    };
    const music = volume(0, 'music', 'Musique', o.musicVolume, 'musicVolume');
    const sfx = volume(1, 'sound', 'Effets (rebonds)', o.sfxVolume, 'sfxVolume');
    const voice = volume(2, 'sound', 'Voix des Astres', o.voiceVolume, 'voiceVolume');
    row(3, 'sound', 'Son doux');
    const soft = toggle(this, ctrlX + 70, rowY(3), o.softAudio, (v) =>
      updateOptions(this, { softAudio: v }),
    );
    row(4, 'sound', 'Son mono');
    const mono = toggle(this, ctrlX + 70, rowY(4), o.monoAudio, (v) =>
      updateOptions(this, { monoAudio: v }),
    );
    row(5, 'colorblind', 'Daltonien');
    const preview = this.add.graphics();
    const drawPreview = (cb: boolean) => {
      const colors = cb ? CRYSTAL_COLORS_CB : CRYSTAL_COLORS;
      preview.clear();
      (['heart', 'common', 'bonus', 'power'] as CrystalKind[]).forEach((k, i) => {
        drawMiniCrystal(preview, ctrlX - 96 + i * 26, rowY(5), k, colors[k]);
      });
    };
    drawPreview(o.colorblind);
    const cb = toggle(this, ctrlX + 70, rowY(5), o.colorblind, (v) => {
      updateOptions(this, { colorblind: v });
      drawPreview(v);
    });
    row(6, 'motion', 'Réduire les animations');
    const motion = toggle(this, ctrlX + 70, rowY(6), o.reducedMotion, (v) =>
      updateOptions(this, { reducedMotion: v }),
    );

    row(7, 'next', 'Vitesse');
    const speedIndex = Math.max(0, GAME_SPEEDS.indexOf(o.speed));
    const speed = segmented(
      this,
      ctrlX + 10,
      rowY(7),
      ['Lent', 'Normal', 'Rapide'],
      speedIndex,
      (i) => updateOptions(this, { speed: GAME_SPEEDS[i] ?? 1 }),
    );

    enableKeyboardFocus(this, [music, sfx, voice, soft, mono, cb, motion, speed, back], 0);
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  private close(): void {
    if (!this.scene.isActive()) return;
    this.scene.stop();
    this.scene.resume(this.from);
  }
}

/** Mini-cristal (formes de la DA : cœur losange, standard rond, bonus étoile 4 branches, pouvoir hexagone). */
export function drawMiniCrystal(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  kind: CrystalKind,
  color: number,
  r = 8,
): void {
  g.fillStyle(color, 1);
  const ring = (n: number, radius: (i: number) => number, start = -Math.PI / 2) =>
    Array.from({ length: n }, (_, i) => {
      const a = start + (i * Math.PI * 2) / n;
      return new Phaser.Math.Vector2(x + Math.cos(a) * radius(i), y + Math.sin(a) * radius(i));
    });
  if (kind === 'heart')
    g.fillPoints(
      ring(4, () => r * 1.3),
      true,
    );
  else if (kind === 'bonus')
    g.fillPoints(
      ring(8, (i) => (i % 2 === 0 ? r * 1.45 : r * 0.5)),
      true,
    );
  else if (kind === 'power')
    g.fillPoints(
      ring(6, () => r * 1.1, 0),
      true,
    );
  else g.fillCircle(x, y, r);
}
