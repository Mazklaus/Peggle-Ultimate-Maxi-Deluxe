/**
 * Pont vers le rig des Astres de la DA (astres-rig.js + astres-reactions-j2.js, copiés tels
 * quels) : les 7 Astres du jalon 2 sont dessinés et animés exactement comme dans les planches.
 *
 * Partage des rôles : notre cerveau (CompanionBrain) garde les règles du Game Designer
 * (priorités, délai entre réactions, « oh ! », poses tenues, sommeil) et CHOISIT la réaction ;
 * l'acteur de la DA la JOUE (pistes avec easing, visage, particules, suivi de l'orbe, idle).
 */
import './astres-rig.js';
import './astres-reactions-j2.js';
import type {
  CompanionDef,
  ReactionDef,
  ReactionTrigger,
  StatePose,
} from '../../core/companion/types';

/** Clé de piste : [instant ms, valeur, easing Phaser]. */
export type DaKey = [number, number, string?];

export interface DaReaction {
  dur: number;
  tracks: Record<string, DaKey[]>;
  face: Array<[number, Record<string, unknown>]>;
  fx?: Array<[number, string, number?]>;
  hold?: boolean;
  loop?: boolean;
  then?: string;
  track?: boolean;
  micro?: boolean;
  wake?: boolean;
}

export interface DaAstre {
  nom: string;
  /** Absentes pour un duo (Twi & Nkl) : couleurs dans duo[]. */
  color?: string;
  light?: string;
  shade?: string;
  duo?: Array<{ color: string; light: string; shade: string }>;
  size: number;
  tempo: number;
  reach?: string;
}

export interface DaActor {
  key: string;
  d: DaAstre;
  reaction: DaReaction | null;
  rStart: number;
  rEv?: string;
  firedFx: Set<string>;
  target: { x: number; y: number } | null;
  awake?: number;
  exc?: number;
  update(now: number, dt: number): unknown;
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, px: number): void;
  trigger(ev: string, now: number): void;
}

interface AstresRigApi {
  ASTRES: Record<string, DaAstre>;
  REACTIONS: Record<string, DaReaction[]>;
  OVERRIDES: Record<string, Record<string, DaReaction[]>>;
  AstreActor: new (key: string) => DaActor;
}

export const DA_RIG = (globalThis as unknown as { AstresRig: AstresRigApi }).AstresRig;

/** Événements de la DA -> déclencheurs de notre cerveau. */
const DA_TO_TRIGGER: Partial<Record<string, ReactionTrigger>> = {
  tir_lance: 'tir_lance',
  gros_coup: 'gros_coup',
  chaine_longue: 'chaine_longue',
  rate: 'rate',
  orbe_recupere: 'orbe_recupere',
  pouvoir_active: 'pouvoir_active',
  presque: 'presque',
  dernier_coeur: 'dernier_coeur',
  dernier_orbe: 'dernier_orbe',
  final_ralenti: 'final_ralenti',
  victoire: 'victoire',
  echec: 'echec',
  inactivite: 'inactivite',
  orbe_proche_coeur: 'proche_coeur',
  orbe_coincee: 'orbe_coincee',
  orbe_debloquee: 'orbe_debloquee',
};

/** Réaction de notre format qui porte une variante de la DA (le cerveau n'en lit que la durée). */
export interface DaReactionDef extends ReactionDef {
  da: DaReaction;
  daEvent: string;
}

export function isDaReaction(def: ReactionDef): def is DaReactionDef {
  return 'da' in def;
}

function wrap(key: string, ev: string, r: DaReaction, i: number, tempo: number): DaReactionDef {
  return {
    id: `${key}_${ev}_${i + 1}`,
    // L'acteur de la DA avance de (temps réel × tempo) : durée réelle = dur / tempo.
    duration: r.dur / 1000 / tempo,
    keys: [],
    ...(r.hold ? { hold: true } : {}),
    da: r,
    daEvent: ev,
  };
}

const EMPTY_STATE: StatePose = {};

/**
 * Définition d'Astre (notre format) bâtie sur le rig de la DA.
 * `id` : identifiant du son (Sound Designer : bourdon, twi_nkl, nuage_lune...).
 */
export function daCompanionDef(key: string, id: string): CompanionDef {
  const d = DA_RIG.ASTRES[key];
  if (!d) throw new Error(`Astre inconnu dans le rig de la DA : ${key}`);
  const own = DA_RIG.OVERRIDES[key] ?? {};
  const list = (ev: string) => own[ev] ?? DA_RIG.REACTIONS[ev] ?? [];
  const reactions: CompanionDef['reactions'] = {};
  for (const [ev, trigger] of Object.entries(DA_TO_TRIGGER)) {
    if (!trigger) continue;
    const variants = list(ev);
    if (variants.length > 0)
      reactions[trigger] = variants.map((r, i) => wrap(key, ev, r, i, d.tempo));
  }
  const hex = (s: string) => parseInt(s.slice(1), 16);
  const look = d.duo?.[0] ?? {
    color: d.color ?? '#FFFFFF',
    light: d.light ?? '#FFFFFF',
    shade: d.shade ?? '#CCCCCC',
  };
  return {
    id,
    color: hex(look.color),
    colorLight: hex(look.light),
    colorDark: hex(look.shade),
    da: { key },
    reactions,
    idleShort: [],
    idleLong: list('idle_long').map((r, i) => wrap(key, 'idle_long', r, i, d.tempo)),
    states: {
      dernier_coeur: EMPTY_STATE,
      dernier_orbe: EMPTY_STATE,
      sommeil: EMPTY_STATE,
      crispation: EMPTY_STATE,
    },
  };
}
