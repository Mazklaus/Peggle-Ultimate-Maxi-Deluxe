/** Noms des scènes et clés partagées du registre Phaser. */
export const SCENES = {
  boot: 'Boot',
  title: 'Title',
  map: 'Map',
  game: 'Game',
  pause: 'Pause',
  results: 'Results',
} as const;

export const REGISTRY = {
  catalog: 'catalog',
  save: 'save',
} as const;
