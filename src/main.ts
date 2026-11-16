import Phaser from 'phaser';
import { audio } from './audio';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { gameEvents } from './core/events';
import { loadSave } from './core/save';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { MapScene } from './scenes/MapScene';
import { PauseScene } from './scenes/PauseScene';
import { ResultsScene } from './scenes/ResultsScene';
import { TitleScene } from './scenes/TitleScene';

// Son : tous les événements de jeu passent au directeur audio.
gameEvents.onAny((name, data) => audio.onGameEvent(name, data));
const { options } = loadSave();
audio.setVolume('music', options.musicVolume);
audio.setVolume('sfx', options.sfxVolume);
// Le navigateur n'autorise l'audio qu'après un geste du joueur.
const unlockAudio = () => audio.unlock();
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

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
