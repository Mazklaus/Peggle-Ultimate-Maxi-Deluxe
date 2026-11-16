/** Noms des scènes et clés partagées du registre Phaser. */
export const SCENES = {
  boot: 'Boot',
  title: 'Title',
  map: 'Map',
  game: 'Game',
  pause: 'Pause',
  results: 'Results',
  options: 'Options',
  cutscene: 'Cutscene',
  /** Galerie des souvenirs, dans l'Observatoire (jalon 3). */
  memories: 'Memories',
  /** Constellation du jour : panneau avant de jouer (jalon 3). */
  daily: 'Daily',
  /** Calque de l'Astre au-dessus des overlays de fin. */
  companionLayer: 'CompanionLayer',
  /** Sélecteur de compagnon, par-dessus la carte (jalon 2). */
  companionSelect: 'CompanionSelect',
} as const;

/** Niveaux qui déclenchent une cinématique (ids du format v1). */
export const REGISTRY = {
  catalog: 'catalog',
  save: 'save',
} as const;

/** Événement global (game.events) émis quand le joueur change une option. */
export const OPTIONS_CHANGED = 'options-changed';
