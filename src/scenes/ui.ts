import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { PALETTE, PANEL_ALPHA } from './theme';

/** Durée des fondus d'écran (specs UI/UX : 250 ms sortie + 250 ms entrée). */
export const FADE_MS = 250;

/** Fondu nuit en entrée de scène. */
export function fadeIn(scene: Phaser.Scene): void {
  scene.data.set('leaving', false); // scene.data survit aux redémarrages de la scène
  scene.cameras.main.fadeIn(FADE_MS, 11, 16, 38);
}

/** Fondu nuit puis démarrage d'une autre scène (jamais bloquant : un seul départ). */
export function fadeTo(scene: Phaser.Scene, key: string, data?: object): void {
  const cam = scene.cameras.main;
  if (scene.data.get('leaving')) return;
  scene.data.set('leaving', true);
  cam.fadeOut(FADE_MS, 11, 16, 38);
  cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => scene.scene.start(key, data));
}

/** Voile plein écran qui bloque les clics vers la scène du dessous. */
export function veil(scene: Phaser.Scene, alpha: number): Phaser.GameObjects.Rectangle {
  return scene.add
    .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, PALETTE.night, alpha)
    .setInteractive();
}

/** Panneau arrondi centré sur (x, y). */
export function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 24,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  g.fillStyle(PALETTE.panel, PANEL_ALPHA + 0.1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
  g.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
  return g;
}

/** Lien DOM vers l'éditeur (specs 6 quater) : visible seulement sur la carte. */
export function setEditorLinkVisible(visible: boolean): void {
  const el = typeof document !== 'undefined' ? document.getElementById('editor-link') : null;
  if (el) el.style.display = visible ? '' : 'none';
}
