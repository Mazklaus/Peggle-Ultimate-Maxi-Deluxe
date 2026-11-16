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
  /** Calque de l'Astre au-dessus des overlays de fin. */
  companionLayer: 'CompanionLayer',
  /** Sélecteur de compagnon, par-dessus la carte (jalon 2). */
  companionSelect: 'CompanionSelect',
} as const;

/** Niveaux qui déclenchent une cinématique (ids du format v1). */
export const STORY_LEVELS = {
  /** Réveil de Pip (vignette B0) au premier lancement. */
  ch1First: 'ch1-01',
  /** Fin du chapitre 1 (vignettes B1-B6) après la victoire. */
  ch1Last: 'ch1-12',
} as const;

export const REGISTRY = {
  catalog: 'catalog',
  save: 'save',
} as const;

/** Événement global (game.events) émis quand le joueur change une option. */
export const OPTIONS_CHANGED = 'options-changed';
