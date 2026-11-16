import Phaser from 'phaser';
import { SCENES } from './keys';

/**
 * Calque vide au-dessus de tout : l'Astre y est dessiné quand il sort de sa loge pour les
 * overlays de fin (Victoire, Échec), qui sont des scènes lancées par-dessus Game.
 * Game continue de piloter l'Astre (update) ; ce calque ne fait qu'afficher.
 */
export class CompanionLayer extends Phaser.Scene {
  constructor() {
    super(SCENES.companionLayer);
  }
}
