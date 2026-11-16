import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { MapScene } from './scenes/MapScene';
import { PauseScene } from './scenes/PauseScene';
import { ResultsScene } from './scenes/ResultsScene';
import { TitleScene } from './scenes/TitleScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0B1026',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'matter', matter: { gravity: { x: 0, y: 1 } } },
  // Boot en premier : il charge sauvegarde et niveaux puis aiguille.
  scene: [BootScene, TitleScene, MapScene, GameScene, PauseScene, ResultsScene],
});
