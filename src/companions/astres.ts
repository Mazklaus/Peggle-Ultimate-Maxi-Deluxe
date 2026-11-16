/**
 * Les 7 Astres du jalon 2, dessinés et animés par le rig de la DA (fiches 02 à 08 du
 * Narrative). Les identifiants sont ceux des voix du Sound Designer.
 */
import { daCompanionDef } from './da';

export const BOURDON = daCompanionDef('bourdon', 'bourdon');
export const JUMELLES = daCompanionDef('jumelles', 'twi_nkl');
export const VOLTE = daCompanionDef('volte', 'volte');
export const MOUSSE = daCompanionDef('mousse', 'mousse');
export const HORLOGE = daCompanionDef('horloge', 'horloge');
export const GRELOT = daCompanionDef('grelot', 'grelot');
export const NUAGE_LUNE = daCompanionDef('nuagelune', 'nuage_lune');

/** Toutes les définitions du rig de la DA, par identifiant de la liste des Astres. */
export const DA_DEFS = {
  bourdon: BOURDON,
  jumelles: JUMELLES,
  volte: VOLTE,
  mousse: MOUSSE,
  horloge: HORLOGE,
  grelot: GRELOT,
  'nuage-lune': NUAGE_LUNE,
} as const;
