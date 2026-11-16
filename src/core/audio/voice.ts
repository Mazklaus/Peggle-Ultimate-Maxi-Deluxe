/**
 * Voix des Astres : phrases en « langue astrale » jouées par l'instrument-voix.
 * Données pures (pas de Web Audio) : le moteur audio les interprète.
 * Fiche de référence pour Pip : /narrative/astres/01-pip.md (piccolo / sifflet vif).
 */
import type { Rng } from '../level';

/** Toutes les répliques possibles d'un Astre, dans les 3 phases (avant, pendant, après le tir). */
export type VoiceCue =
  // AVANT le tir : idles
  | 'idle_court'
  | 'idle_long'
  | 'inactivite'
  | 'sommeil'
  | 'reveil'
  // PENDANT le vol
  | 'tir_lance'
  | 'cristal'
  | 'orbe_descend'
  | 'orbe_proche_coeur'
  | 'presque'
  | 'dernier_coeur'
  | 'dernier_orbe'
  | 'pouvoir_active'
  | 'orbe_coincee'
  | 'orbe_debloquee'
  | 'final_ralenti'
  // APRÈS le tir : bilan
  | 'tir_moyen'
  | 'gros_coup'
  | 'chaine_longue'
  | 'rate'
  | 'orbe_recupere'
  | 'victoire'
  | 'echec';

/**
 * Une note de la phrase.
 * s : demi-tons par rapport à la tonique de l'Astre ; d : durée (s) ;
 * to : glissando vers ce demi-ton ; v : volume relatif (0-1, défaut 0.8) ;
 * gap : silence avant la note (s) ; trill : trille vers s + trill demi-tons ;
 * breath : souffle bruité au lieu d'une note tenue (rire, soupir, bâillement).
 */
export interface VoiceNote {
  s: number;
  d: number;
  to?: number;
  v?: number;
  gap?: number;
  trill?: number;
  breath?: boolean;
  /** Tic-tac de pendule (Horloge) au lieu d'une note. */
  tick?: boolean;
}

export type Phrase = readonly VoiceNote[];

/** 1 = idle, 2 = réaction courante, 3 = moment fort, 4 = fin de niveau (coupe tout). */
export type VoicePriority = 1 | 2 | 3 | 4;

export const CUE_PRIORITY: Record<VoiceCue, VoicePriority> = {
  idle_court: 1,
  idle_long: 1,
  inactivite: 1,
  sommeil: 1,
  reveil: 2,
  cristal: 1,
  tir_lance: 2,
  orbe_descend: 2,
  orbe_proche_coeur: 2,
  tir_moyen: 2,
  rate: 2,
  orbe_recupere: 2,
  presque: 3,
  dernier_coeur: 3,
  dernier_orbe: 3,
  pouvoir_active: 3,
  orbe_coincee: 2,
  orbe_debloquee: 2,
  gros_coup: 3,
  chaine_longue: 3,
  final_ralenti: 4,
  victoire: 4,
  echec: 4,
};

/** Instruments-voix des Astres (note d'intentions sonores, validée par le Game Director). */
export type VoiceInstrument =
  'piccolo' | 'tuba' | 'clarinet' | 'banjo' | 'vibraphone' | 'marimba' | 'bells' | 'harp';

/** Profil vocal d'un Astre (le moteur choisit le timbre selon `instrument`). */
export interface VoiceProfile {
  astre: string;
  instrument: VoiceInstrument;
  /** Tonique MIDI de la voix. */
  root: number;
  /** Volume relatif de la voix (Mousse parle tout bas). */
  gain?: number;
  /** Deux voix (Twi et Nkl) : la seconde répond décalée, transposée de `interval` demi-tons. */
  duet?: { interval: number; delay: number };
  /** Couleur ajoutée sous chaque réplique (tic-tac d'Horloge, chœur lointain de Nuage-Lune…). */
  halo?: 'ticktock' | 'choir' | 'jingle';
  /** Plusieurs variantes par réplique, pour ne pas lasser. */
  phrases: Record<VoiceCue, readonly Phrase[]>;
}

const n = (s: number, d: number, extra: Partial<VoiceNote> = {}): VoiceNote => ({ s, d, ...extra });

/**
 * Pip : petite étoile surexcitée, mitraille de sifflets. Tonique ré6 (MIDI 86),
 * phrases calées sur la pentatonique de ré pour rester en accord avec la musique du chapitre 1.
 */
export const PIP_VOICE: VoiceProfile = {
  astre: 'pip',
  instrument: 'piccolo',
  root: 86,
  phrases: {
    // « hiii » (étirement), petit hop, et il sifflote la mélodie de la Veilleuse sans le savoir
    idle_court: [
      [
        n(0, 0.35, { to: 4, v: 0.5 }),
        n(4, 0.4, { to: -3, v: 0.4 }),
        n(0, 0.25, { breath: true, v: 0.3 }),
      ],
      [
        n(7, 0.08, { v: 0.5 }),
        n(9, 0.08, { v: 0.5, gap: 0.04 }),
        n(7, 0.12, { v: 0.5, gap: 0.04 }),
      ],
      [
        n(-3, 0.22, { v: 0.4 }),
        n(-5, 0.22, { v: 0.4 }),
        n(0, 0.22, { v: 0.4 }),
        n(-3, 0.45, { v: 0.4 }),
      ],
    ],
    // la mouche (gobe une poussière, tousse), le jongleur raté (« bonk »), les pompes, la course
    idle_long: [
      [
        n(7, 0.1, { v: 0.5 }),
        n(9, 0.1, { v: 0.5, gap: 0.2 }),
        n(12, 0.06, { v: 0.6, gap: 0.3 }),
        n(0, 0.08, { breath: true, v: 0.6, gap: 0.1 }),
        n(0, 0.08, { breath: true, v: 0.5, gap: 0.08 }),
      ],
      [
        n(0, 0.07, { v: 0.5 }),
        n(4, 0.07, { v: 0.5, gap: 0.05 }),
        n(7, 0.07, { v: 0.5, gap: 0.05 }),
        n(-12, 0.12, { to: -17, v: 0.7, gap: 0.15 }),
        n(4, 0.5, { trill: 3, v: 0.35, gap: 0.05 }),
      ],
      [
        n(0, 0.08, { v: 0.4 }),
        n(2, 0.07, { v: 0.4 }),
        n(4, 0.06, { v: 0.45 }),
        n(7, 0.05, { v: 0.5 }),
        n(-5, 0.5, { breath: true, v: 0.5, gap: 0.1 }),
      ],
      [
        n(4, 0.15, { v: 0.4 }),
        n(2, 0.15, { v: 0.4 }),
        n(4, 0.15, { v: 0.4 }),
        n(7, 0.3, { v: 0.4, to: 9 }),
      ],
    ],
    // « tut tut ? » : il tapote la vitre
    inactivite: [
      [n(4, 0.08), n(4, 0.08, { gap: 0.06 }), n(7, 0.2, { to: 11, gap: 0.12 })],
      [n(-5, 0.6, { breath: true, v: 0.4 }), n(0, 0.25, { to: -5, v: 0.4 })],
      [
        n(0, 0.06),
        n(0, 0.06, { gap: 0.05 }),
        n(0, 0.06, { gap: 0.05 }),
        n(9, 0.18, { to: 12, gap: 0.1 }),
      ],
    ],
    // ronflement en sifflet : inspiration montante, expiration descendante
    sommeil: [
      [n(-7, 0.9, { to: -2, v: 0.25 }), n(-2, 1.1, { to: -9, v: 0.2, breath: true, gap: 0.15 })],
    ],
    // réveil en sursaut
    reveil: [[n(12, 0.06, { v: 0.9 }), n(16, 0.18, { to: 7, v: 0.7, gap: 0.02 })]],

    // « Go ! » : sifflet court ascendant
    tir_lance: [
      [n(0, 0.16, { to: 12 })],
      [n(7, 0.07), n(12, 0.12, { gap: 0.02 })],
      [n(2, 0.25, { v: 0.45, trill: 2 })],
    ],
    // « pip ! » : la hauteur est décalée par le moteur selon la jauge d'excitation
    cristal: [[n(0, 0.05, { v: 0.55 })], [n(0, 0.04, { v: 0.5, to: 2 })]],
    // crispation : petit trémolo nerveux
    orbe_descend: [[n(-2, 0.45, { trill: 1, v: 0.4 })], [n(0, 0.3, { to: -3, v: 0.45 })]],
    // « oh ! »
    orbe_proche_coeur: [[n(9, 0.14, { to: 4, v: 0.75 })]],
    // « Noooon » : glissando descendant
    presque: [[n(12, 0.7, { to: -5 })], [n(7, 0.12), n(7, 0.6, { to: -10, gap: 0.05 })]],
    // trille nerveux très doux
    dernier_coeur: [[n(4, 0.9, { trill: 1, v: 0.35 })]],
    // prière : petite plainte suppliante
    dernier_orbe: [[n(4, 0.3, { to: 7, v: 0.5 }), n(7, 0.5, { to: 4, v: 0.45, gap: 0.05 })]],
    // joues gonflées : il souffle de toutes ses forces sur l'orbe coincée
    orbe_coincee: [
      [n(0, 0.6, { breath: true, v: 0.7 }), n(-2, 0.3, { to: 5, v: 0.5, gap: 0.05 })],
      [n(4, 0.25, { trill: 1, v: 0.5 }), n(0, 0.5, { breath: true, v: 0.6, gap: 0.05 })],
    ],
    // ça repart : petit « youpi »
    orbe_debloquee: [[n(7, 0.06), n(12, 0.12, { gap: 0.02, to: 14 })]],
    // « ta-da » en 3 notes
    pouvoir_active: [[n(0, 0.1), n(4, 0.1, { gap: 0.03 }), n(12, 0.35, { gap: 0.03, trill: 2 })]],
    // immense « O » au ralenti
    final_ralenti: [[n(-5, 2.2, { to: 12, v: 0.6 })]],

    // « pip-pip »
    tir_moyen: [
      [n(4, 0.06), n(7, 0.08, { gap: 0.05 })],
      [n(7, 0.06), n(4, 0.06, { gap: 0.04 }), n(7, 0.08, { gap: 0.04 })],
    ],
    // toupie (trille) / sifflet de stade / fierté
    gros_coup: [
      [n(7, 0.7, { trill: 2 })],
      [n(12, 0.18), n(12, 0.12, { gap: 0.08 }), n(12, 0.5, { gap: 0.08, to: 14 })],
      [n(0, 0.1), n(4, 0.1, { gap: 0.02 }), n(7, 0.1, { gap: 0.02 }), n(12, 0.4, { gap: 0.02 })],
    ],
    // hystérie : cascade de trilles / effondré de joie
    chaine_longue: [
      [n(7, 0.25, { trill: 2 }), n(12, 0.25, { trill: 2 }), n(16, 0.5, { trill: 3 })],
      [n(19, 0.6, { to: 0 }), n(0, 0.4, { breath: true, v: 0.6, gap: 0.05 })],
    ],
    // mèche tombante puis « allez ! » / sifflote (mauvaise foi) / pas grave
    rate: [
      [n(7, 0.45, { to: -2, v: 0.6 }), n(4, 0.08, { gap: 0.35 }), n(9, 0.14, { gap: 0.02 })],
      [
        n(4, 0.15, { v: 0.45 }),
        n(2, 0.15, { v: 0.45 }),
        n(4, 0.15, { v: 0.45 }),
        n(-1, 0.3, { v: 0.45 }),
      ],
      [n(4, 0.12, { v: 0.6 }), n(7, 0.25, { to: 9, v: 0.6, gap: 0.04 })],
    ],
    // « ouf » + petit rire / applaudit
    orbe_recupere: [
      [
        n(0, 0.4, { breath: true, v: 0.5 }),
        n(7, 0.05, { gap: 0.05 }),
        n(4, 0.05, { gap: 0.03 }),
        n(7, 0.05, { gap: 0.03 }),
      ],
      [
        n(4, 0.07),
        n(7, 0.07, { gap: 0.03 }),
        n(9, 0.07, { gap: 0.03 }),
        n(12, 0.16, { gap: 0.03 }),
      ],
    ],
    // mélodie de victoire au piccolo
    victoire: [
      [
        n(0, 0.12),
        n(4, 0.12),
        n(7, 0.12),
        n(12, 0.3),
        n(9, 0.12, { gap: 0.05 }),
        n(12, 0.12),
        n(16, 0.6, { trill: 2 }),
      ],
      [n(7, 0.1), n(9, 0.1), n(12, 0.1), n(14, 0.1), n(16, 0.1), n(19, 0.7, { trill: 2 })],
    ],
    // fond en flaque puis se reforme d'un coup
    echec: [
      [n(7, 1.0, { to: -12, v: 0.55 }), n(0, 0.08, { gap: 0.3 }), n(7, 0.15, { to: 12 })],
      [
        n(4, 0.3, { v: 0.6 }),
        n(2, 0.3, { v: 0.55 }),
        n(-1, 0.7, { to: -3, v: 0.5 }),
        n(7, 0.12, { gap: 0.2 }),
      ],
    ],
  },
};

/** Durée totale d'une phrase en secondes (silences compris). */
export function phraseDuration(phrase: Phrase): number {
  return phrase.reduce((sum, note) => sum + (note.gap ?? 0) + note.d, 0);
}

/**
 * Choisit une variante au hasard sans répéter la précédente quand c'est possible.
 * `last` est l'indice choisi la fois d'avant (ou -1).
 */
export function pickVariant(count: number, last: number, rng: Rng = Math.random): number {
  if (count <= 1) return 0;
  const pick = Math.floor(rng() * (count - 1));
  return pick >= last && last >= 0 ? pick + 1 : pick;
}
