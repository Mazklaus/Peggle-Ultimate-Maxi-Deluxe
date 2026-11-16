/**
 * Machine d'états de la musique adaptative (pure) : quelles couches jouent selon le jeu.
 * Visée = couche 1 ; tir = 1 + 2 ; peu de cœurs = tension (couche 3 ajoutée) ;
 * final au ralenti = musique suspendue ; fin de niveau = jingles seuls.
 */
import type { MusicLayer } from './score';

export interface MusicState {
  shooting: boolean;
  tension: boolean;
  final: boolean;
  ended: boolean;
}

export type MusicCue =
  | 'niveau_debut'
  | 'tir_lance'
  | 'fin_tir'
  | 'dernier_coeur'
  | 'final_ralenti'
  | 'victoire'
  | 'echec';

export const INITIAL_MUSIC_STATE: MusicState = {
  shooting: false,
  tension: false,
  final: false,
  ended: false,
};

/** Nombre de cœurs restants à partir duquel la couche de tension entre. */
export const TENSION_HEARTS = 3;

export function nextMusicState(state: MusicState, cue: MusicCue): MusicState {
  switch (cue) {
    case 'niveau_debut':
      return { ...INITIAL_MUSIC_STATE };
    case 'tir_lance':
      return state.ended ? state : { ...state, shooting: true };
    case 'fin_tir':
      return { ...state, shooting: false };
    case 'dernier_coeur':
      return { ...state, tension: true };
    case 'final_ralenti':
      return { ...state, final: true };
    case 'victoire':
    case 'echec':
      return { ...state, shooting: false, final: false, ended: true };
  }
}

/** Couches audibles pour un état donné. */
export function layersFor(state: MusicState): MusicLayer[] {
  if (state.ended || state.final) return [];
  const layers: MusicLayer[] = [1];
  if (state.shooting) layers.push(2);
  if (state.tension) layers.push(3);
  return layers;
}
