import Phaser from 'phaser';
import { companionById } from '../companions';
import { generateDaily, localDateKey, type DailyLevel } from '../core/daily';
import { currentStreak, dailyBars, type SaveData } from '../core/save';
import type { GameSceneData } from './GameScene';
import { REGISTRY, SCENES } from './keys';
import { drawLevelPreview } from './levelPreview';
import { currentOptions } from './OptionsScene';
import { drawPortrait } from './powerIcons';
import { CRYSTAL_COLORS, CRYSTAL_COLORS_CB, PALETTE, TEXT, bodyStyle, textStyle } from './theme';
import { fadeIn, fadeTo, panel } from './ui';
import { enableKeyboardFocus, iconButton, primaryButton } from './widgets';

const ICONS = ['mode-jour', 'flamme', 'cadenas'] as const;
const iconKey = (n: string) => `icone-${n}`;
const PANEL = { w: 760, h: 560 };
const BARS = { x: 0, y: 0, w: 300, h: 90 };
const WEEKDAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

/**
 * Constellation du jour (specs UI/UX jalon 3, 3) : date en pictogramme, aperçu du niveau,
 * Astre du jour imposé, meilleur score du jour, série (flamme), 7 derniers jours en barres
 * (classement local), JOUER. Remise à zéro à minuit heure locale.
 */
export class DailyScene extends Phaser.Scene {
  private daily?: DailyLevel;

  constructor() {
    super(SCENES.daily);
  }

  preload(): void {
    for (const n of ICONS)
      if (!this.textures.exists(iconKey(n)))
        this.load.svg(iconKey(n), `da/icones/${n}.svg`, { width: 144, height: 144 });
  }

  create(): void {
    fadeIn(this);
    const save = this.registry.get(REGISTRY.save) as SaveData;
    const today = localDateKey();
    try {
      this.daily = generateDaily(today);
    } catch {
      this.daily = undefined;
    }
    const cx = 640;
    const cy = 380;
    const left = cx - PANEL.w / 2;
    const top = cy - PANEL.h / 2;

    const sky = this.textures.exists('carte-ciel-fixe') ? 'carte-ciel-fixe' : 'carte-fond';
    if (this.textures.exists(sky)) this.add.image(0, 0, sky).setOrigin(0).setAlpha(0.6);
    panel(this, cx, cy, PANEL.w, PANEL.h, 24);
    const back = iconButton(this, 40, 36, 'back', () => this.back(), { diameter: 48 });
    this.add.text(cx, top + 44, 'Constellation du jour', textStyle(30)).setOrigin(0.5);

    // Date : calendrier + numéro du jour.
    const cal = { x: left + 80, y: top + 130 };
    this.icon('mode-jour', cal.x, cal.y, 72);
    this.add
      .text(cal.x, cal.y + 58, String(Number(today.slice(6, 8))), textStyle(30))
      .setOrigin(0.5);

    // Aperçu du niveau.
    const colors = currentOptions(this).colorblind ? CRYSTAL_COLORS_CB : CRYSTAL_COLORS;
    const prev = { x: left + 150, y: top + 86, w: 280, h: 210 };
    const g = this.add.graphics();
    if (this.daily)
      drawLevelPreview(g, this.daily.level, prev.x, prev.y, prev.w, prev.h, colors, 2.4);

    // Astre du jour, imposé : pastille + cadenas.
    const right = left + 560;
    const astreId = this.daily?.level.companion ?? null;
    const astre = astreId ? companionById(astreId) : undefined;
    if (astre) {
      const p = this.add.graphics();
      p.fillStyle(PALETTE.night, 0.8).fillCircle(right, top + 120, 34);
      p.lineStyle(3, astre.color, 0.9).strokeCircle(right, top + 120, 34);
      drawPortrait(p, right, top + 120, 22, astre.color);
      this.icon('cadenas', right + 28, top + 146, 26);
      this.add.text(right, top + 172, astre.name, bodyStyle(14, TEXT.dim)).setOrigin(0.5);
    }

    // Meilleur score du jour, série, record.
    const best = save.daily?.date === today ? save.daily.best : null;
    this.add.text(right, top + 214, 'Meilleur du jour', bodyStyle(14, TEXT.dim)).setOrigin(0.5);
    this.add
      .text(right, top + 246, best === null ? '—' : best.toLocaleString('fr-FR'), textStyle(32))
      .setOrigin(0.5);
    const streak = currentStreak(save, today);
    this.icon('flamme', right - 28, top + 296, 34).setAlpha(streak > 0 ? 1 : 0.35);
    this.add.text(right - 6, top + 296, String(streak), textStyle(28)).setOrigin(0, 0.5);
    if (best === null)
      this.add
        .text(left + PANEL.w - 24, top + 44, 'nouveau', bodyStyle(13, TEXT.onAccent))
        .setOrigin(1, 0.5)
        .setBackgroundColor('#B9A6FF')
        .setPadding(8, 3, 8, 3);

    // Les 7 derniers jours, aujourd'hui en lavande ; record = meilleur jour.
    const bars = dailyBars(save, today);
    const record = Math.max(0, ...bars.map((b) => b.best ?? 0), save.daily?.record ?? 0);
    const bx = left + 150;
    const by = top + 330;
    const max = Math.max(1, ...bars.map((b) => b.best ?? 0));
    const bw = BARS.w / bars.length;
    const bg = this.add.graphics();
    bars.forEach((b, i) => {
      const h = b.best ? Math.max(4, (b.best / max) * BARS.h) : 3;
      const isToday = i === bars.length - 1;
      bg.fillStyle(isToday ? PALETTE.accent : PALETTE.starDim, b.best ? 1 : 0.35);
      bg.fillRoundedRect(bx + i * bw + 8, by + BARS.h - h, bw - 16, h, 4);
      const d = new Date(
        Number(b.key.slice(0, 4)),
        Number(b.key.slice(4, 6)) - 1,
        Number(b.key.slice(6, 8)),
      );
      this.add
        .text(
          bx + i * bw + bw / 2,
          by + BARS.h + 14,
          WEEKDAYS[d.getDay()] ?? '',
          bodyStyle(13, TEXT.dim),
        )
        .setOrigin(0.5);
    });
    if (record > 0)
      this.add
        .text(right, top + 380, `record ${record.toLocaleString('fr-FR')}`, bodyStyle(14, TEXT.dim))
        .setOrigin(0.5);

    const play = primaryButton(this, cx, top + PANEL.h - 50, 'Jouer', () => this.play(), {
      icon: 'play',
      width: 240,
    });
    if (!this.daily) play.setAlpha(0.4).disableInteractive();
    enableKeyboardFocus(this, [play, back], 0);
    this.input.keyboard?.on('keydown-ESC', () => this.back());
    this.input.keyboard?.on('keydown-SPACE', () => this.play());
  }

  private icon(name: string, x: number, y: number, size: number): Phaser.GameObjects.Image {
    return this.add.image(x, y, iconKey(name)).setDisplaySize(size, size);
  }

  private play(): void {
    if (!this.daily) return;
    fadeTo(this, SCENES.game, {
      level: this.daily.level,
      daily: this.daily.key,
      mode: { kind: 'quotidien', seed: this.daily.seed },
    } satisfies GameSceneData);
  }

  private back(): void {
    fadeTo(this, SCENES.title);
  }
}
