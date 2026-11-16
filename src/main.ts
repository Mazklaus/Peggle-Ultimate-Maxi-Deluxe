import Phaser from 'phaser';
import { audio } from './audio';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { gameEvents } from './core/events';
import { ORB_PHYSICS } from './core/physics';
import { loadSave } from './core/save';
import { BootScene } from './scenes/BootScene';
import { CompanionLayer } from './scenes/CompanionLayer';
import { CompanionSelectScene } from './scenes/CompanionSelectScene';
import { CutsceneScene } from './scenes/CutsceneScene';
import { GameScene } from './scenes/GameScene';
import { MapScene } from './scenes/MapScene';
import { applyAudioOptions, OptionsScene } from './scenes/OptionsScene';
import { PauseScene } from './scenes/PauseScene';
import { ResultsScene } from './scenes/ResultsScene';
import { loadFonts, setColorblindPower } from './scenes/theme';
import { TitleScene } from './scenes/TitleScene';
import { setEditorLinkVisible } from './scenes/ui';

// Son : tous les événements de jeu passent au directeur audio.
gameEvents.onAny((name, data) => audio.onGameEvent(name, data));
const { options } = loadSave();
applyAudioOptions(options);
setColorblindPower(options.colorblind);
// Le navigateur n'autorise l'audio qu'après un geste du joueur.
const unlockAudio = () => audio.unlock();
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

// Lien vers l'éditeur : visible seulement sur la carte (specs UI/UX 6 quater).
setEditorLinkVisible(false);

// Polices Fredoka / Nunito prêtes avant le premier texte (2 s au plus).
void loadFonts().then(startGame);

function startGame(): void {
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#0B1026',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: {
      default: 'matter',
      matter: {
        // Échelle de gravité réglée par GameScene (ORB_PHYSICS.gravityScale).
        gravity: { x: 0, y: 1 },
        runner: { fps: ORB_PHYSICS.stepsPerSecond },
      },
    },
    // Boot en premier : il charge sauvegarde et niveaux puis aiguille.
    scene: [
      BootScene,
      TitleScene,
      MapScene,
      GameScene,
      PauseScene,
      ResultsScene,
      CutsceneScene,
      OptionsScene,
      CompanionLayer,
      CompanionSelectScene,
    ],
  });
}
