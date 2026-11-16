import Phaser from 'phaser';
import { audio } from '../audio';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { writeSave, type Options, type SaveData } from '../core/save';
import { OPTIONS_CHANGED, REGISTRY, SCENES } from './keys';
import { PALETTE, textStyle, TEXT } from './theme';
import { button } from './widgets';

const VOLUMES = [0, 0.4, 0.8, 1];

/** Applique les options qui agissent hors des scènes (volumes). */
export function applyAudioOptions(o: Options): void {
  audio.setVolume('music', o.musicVolume);
  audio.setVolume('sfx', o.sfxVolume);
  audio.setVolume('voice', o.sfxVolume);
}

/**
 * Options provisoires (le design final vient de l'UI/UX), ouvertes par-dessus le titre ou la pause.
 * Chaque changement est sauvegardé tout de suite et signalé via game.events (OPTIONS_CHANGED).
 */
export class OptionsScene extends Phaser.Scene {
  private from: string = SCENES.title;

  constructor() {
    super(SCENES.options);
  }

  create(data: { from?: string }): void {
    this.from = data?.from ?? SCENES.title;
    const save = this.registry.get(REGISTRY.save) as SaveData;
    const o = save.options;
    const cx = GAME_WIDTH / 2;

    this.add
      .rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, PALETTE.night, 0.85)
      .setInteractive();
    this.add.text(cx, 130, 'Options', textStyle(44)).setOrigin(0.5);

    const rows: Array<{ label: string; value: () => string; next: () => void }> = [
      {
        label: 'Mode daltonien',
        value: () => (o.colorblind ? 'Oui' : 'Non'),
        next: () => (o.colorblind = !o.colorblind),
      },
      {
        label: 'Musique',
        value: () => `${Math.round(o.musicVolume * 100)} %`,
        next: () => (o.musicVolume = cycle(o.musicVolume)),
      },
      {
        label: 'Effets et voix',
        value: () => `${Math.round(o.sfxVolume * 100)} %`,
        next: () => (o.sfxVolume = cycle(o.sfxVolume)),
      },
      {
        label: 'Réduire les animations',
        value: () => (o.reducedMotion ? 'Oui' : 'Non'),
        next: () => (o.reducedMotion = !o.reducedMotion),
      },
    ];

    rows.forEach((row, i) => {
      const y = 230 + i * 80;
      this.add.text(cx - 40, y, row.label, textStyle(24, TEXT.dim)).setOrigin(1, 0.5);
      const btn = button(
        this,
        cx + 110,
        y,
        row.value(),
        () => {
          row.next();
          (btn.list[1] as Phaser.GameObjects.Text).setText(row.value());
          writeSave(save);
          applyAudioOptions(o);
          this.game.events.emit(OPTIONS_CHANGED, o);
        },
        { width: 180, size: 22 },
      );
    });

    const close = () => this.close();
    button(this, cx, 590, 'Retour', close, { primary: true });
    this.input.keyboard?.once('keydown-ESC', close);
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume(this.from);
  }
}

function cycle(v: number): number {
  const i = VOLUMES.findIndex((x) => Math.abs(x - v) < 0.01);
  return VOLUMES[(i + 1) % VOLUMES.length] as number;
}
