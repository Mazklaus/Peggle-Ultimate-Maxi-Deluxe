/**
 * Réglages physiques de l'orbe (logique pure, partagés par la scène et les prédictions).
 *
 * Retour joueur du jalon 1 : l'orbe allait trop vite. On ralentit tout d'un même facteur :
 * vitesse × k et gravité × k², ce qui garde exactement les mêmes trajectoires (niveaux et
 * simulateur du Level Designer inchangés) mais les parcourt plus lentement.
 */
const SLOWDOWN = 0.75;

export const ORB_PHYSICS = {
  /** Facteur de ralenti global (1 = vitesse du prototype). */
  slowdown: SLOWDOWN,
  /** Vitesse de lancement en px par pas de référence Matter (16,7 ms). */
  launchSpeed: 11 * SLOWDOWN,
  /** Échelle de gravité Matter (défaut 0,001). */
  gravityScale: 0.001 * SLOWDOWN * SLOWDOWN,
  /** Pas physiques par seconde : 120 au lieu de 60, l'orbe ne traverse plus les cristaux fins. */
  stepsPerSecond: 120,
  /** Restitution de l'orbe sur les cristaux. */
  orbRestitution: 0.75,
  /** Murs latéraux et plafond plus élastiques : les bords renvoient franchement l'orbe. */
  wallRestitution: 0.9,
  /**
   * Seuil Matter sous lequel un choc ne rebondit plus (défaut 2 px/pas). Mis à l'échelle du
   * ralenti pour que les petits rebonds ne soient pas « mangés ».
   */
  restingThreshold: 2 * SLOWDOWN,
};

/** Gravité effective en px par pas de référence au carré (prédictions de trajectoire). */
export const GRAVITY_PER_STEP = ORB_PHYSICS.gravityScale * (1000 / 60) ** 2;

/** Partie interne de Matter.js que l'on règle (seul point du code qui y touche). */
export interface MatterInternals {
  Resolver: { _restingThresh: number };
}

/**
 * Réglage global et interne à Matter (valable pour tout le jeu) : centralisé ici, appelé
 * par GameScene avec la bibliothèque Matter embarquée par Phaser.
 */
export function applyMatterInternals(matter: MatterInternals): void {
  matter.Resolver._restingThresh = ORB_PHYSICS.restingThreshold;
}
