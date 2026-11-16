/** Résolution logique du jeu (16:9, mise à l'échelle par Phaser.Scale.FIT). */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/**
 * Zone de jeu 4:3 (maquette UI/UX) : le HUD vit dans les marges autour.
 * Les coordonnées des niveaux JSON sont relatives à cette zone.
 */
export const PLAYFIELD = { x: 200, y: 64, w: 880, h: 656 } as const;

/** Passe d'une coordonnée de niveau (zone) à une coordonnée écran. */
export function toWorld(p: { x: number; y: number }): { x: number; y: number } {
  return { x: PLAYFIELD.x + p.x, y: PLAYFIELD.y + p.y };
}
