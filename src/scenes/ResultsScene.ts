import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { nextLevelId, type LevelCatalog } from '../core/levelCatalog';
import type { LevelData } from '../core/levelFormat';
import { recordResult, writeSave, type SaveData } from '../core/save';
import { starsFor } from '../core/stars';
import { REGISTRY, SCENES } from './keys';
import { PALETTE, textStyle, TEXT } from './theme';
import { button } from './widgets';

export interface ResultsData {
  level: LevelData;
  score: number;
  won: boolean;
  orbsLeft: number;
  test?: boolean;
}

/**
 * Fin de niveau. Victoire : étoiles + Suivant / Rejouer / Carte.
 * Échec : un seul gros bouton « Encore » (Espace ou clic), sans pénalité (principe UI n° 6).
 */
export class ResultsScene extends Phaser.Scene {
  constructor() {
    super(SCENES.results);
  }

  create(data: ResultsData): void {
    this.cameras.main.setBackgroundColor(PALETTE.night);
    const { level, score, won } = data;
    const stars = starsFor(score, level.stars, won);
    const catalog = this.registry.get(REGISTRY.catalog) as LevelCatalog;
    const save = this.registry.get(REGISTRY.save) as SaveData;

    if (!data.test) {
      const rec = recordResult(save, { id: level.id, score, stars, won, orbsLeft: data.orbsLeft });
      writeSave(save);
      if (won && score >= rec.bestScore && rec.plays > 1) {
        this.add
          .text(GAME_WIDTH / 2, 330, 'Nouveau record !', textStyle(22, '#4FF0A8'))
          .setOrigin(0.5);
      }
    }

    const replay = () => this.scene.start(SCENES.game, { level, test: data.test });
    const toMap = () => this.scene.start(SCENES.map);
    const cx = GAME_WIDTH / 2;

    if (!won) {
      this.add.text(cx, 220, 'Encore une fois ?', textStyle(48)).setOrigin(0.5);
      this.add.text(cx, 290, `Score : ${score}`, textStyle(24, TEXT.dim)).setOrigin(0.5);
      button(this, cx, 420, 'Encore', replay, { primary: true, size: 36, width: 300 });
      if (!data.test) button(this, cx, 530, 'Carte', toMap, { width: 180, size: 20 });
      this.input.keyboard?.once('keydown-SPACE', replay);
      return;
    }

    this.add.text(cx, 160, 'Constellation rallumée !', textStyle(44)).setOrigin(0.5);
    for (let i = 0; i < 3; i++) {
      const star = this.add
        .text(cx + (i - 1) * 90, 250, '★', textStyle(80, i < stars ? '#FFB23F' : '#2E3870'))
        .setOrigin(0.5)
        .setScale(0);
      this.tweens.add({
        targets: star,
        scale: 1,
        duration: 250,
        delay: 200 + i * 180,
        ease: 'Back.Out',
      });
    }
    this.add.text(cx, 370, `Score : ${score}`, textStyle(30)).setOrigin(0.5);

    const next = data.test ? null : nextLevelId(catalog.levels, level.id);
    const nextLevel = next ? catalog.levels.find((l) => l.id === next) : undefined;
    if (nextLevel) {
      const goNext = () => this.scene.start(SCENES.game, { level: nextLevel });
      button(this, cx, 470, 'Suivant', goNext, { primary: true, size: 30, width: 280 });
      this.input.keyboard?.once('keydown-SPACE', goNext);
    }
    button(this, data.test ? cx : cx - 130, 570, 'Rejouer', replay, { width: 200, size: 20 });
    if (!data.test) button(this, cx + 130, 570, 'Carte', toMap, { width: 200, size: 20 });
    else this.input.keyboard?.once('keydown-SPACE', replay);
  }
}
