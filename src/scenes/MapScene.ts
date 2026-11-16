import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { byChapter, type LevelCatalog } from '../core/levelCatalog';
import { isUnlocked, type SaveData } from '../core/save';
import { REGISTRY, SCENES } from './keys';
import { PALETTE, textStyle, TEXT } from './theme';
import { button } from './widgets';

const CHAPTER_NAMES: Record<number, string> = { 0: 'Observatoire' };

/**
 * Carte provisoire : une rangée d'étoiles par chapitre, chaque étoile = un niveau.
 * Le design final (carte du ciel, constellations) viendra de l'UI/UX et de la DA.
 */
export class MapScene extends Phaser.Scene {
  constructor() {
    super(SCENES.map);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.night);
    const catalog = this.registry.get(REGISTRY.catalog) as LevelCatalog;
    const save = this.registry.get(REGISTRY.save) as SaveData;
    const order = catalog.levels.map((l) => l.id);

    this.add.text(GAME_WIDTH / 2, 50, 'Carte du ciel', textStyle(40)).setOrigin(0.5);
    button(this, 110, 50, '‹ Titre', () => this.scene.start(SCENES.title), {
      width: 160,
      size: 20,
    });

    let y = 150;
    for (const [chapter, levels] of byChapter(catalog.levels)) {
      const name = CHAPTER_NAMES[chapter] ?? `Chapitre ${chapter}`;
      this.add.text(80, y, name, textStyle(24, TEXT.dim)).setOrigin(0, 0.5);
      const spacing = Math.min(80, (GAME_WIDTH - 360) / Math.max(1, levels.length - 1));
      levels.forEach((level, i) => {
        const x = 320 + i * spacing;
        const rec = save.levels[level.id];
        const open = isUnlocked(order, level.id, save);
        const done = rec?.completed === true;
        const node = this.add
          .circle(x, y, 22, done ? PALETTE.lit : open ? PALETTE.accent : PALETTE.border)
          .setStrokeStyle(3, PALETTE.lit, open ? 0.8 : 0.2);
        this.add
          .text(x, y, String(level.index), textStyle(20, done || open ? '#1B2350' : TEXT.dim))
          .setOrigin(0.5);
        if (rec?.stars) {
          this.add
            .text(
              x,
              y + 34,
              '★'.repeat(rec.stars) + '☆'.repeat(3 - rec.stars),
              textStyle(14, '#FFB23F'),
            )
            .setOrigin(0.5);
        }
        if (open) {
          node.setInteractive({ useHandCursor: true });
          node.on('pointerover', () => node.setScale(1.12));
          node.on('pointerout', () => node.setScale(1));
          node.on('pointerup', () => this.scene.start(SCENES.game, { level }));
        }
      });
      y += 110;
    }
  }
}
