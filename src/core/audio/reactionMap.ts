/**
 * Relie les réactions animées des Astres (identifiants comme 'pip_toupie') à la réplique vocale
 * correspondante, à partir de la définition de l'Astre : la voix colle toujours à l'animation.
 */
import type { VoiceCue } from './voice';

interface ReactionLike {
  id: string;
}

/** Forme minimale d'une définition d'Astre (src/companions/*.ts). */
export interface CompanionLike {
  id: string;
  reactions: Partial<Record<string, readonly ReactionLike[]>>;
  idleShort: readonly ReactionLike[];
  idleLong: readonly ReactionLike[];
}

/** Déclencheurs d'animation dont le nom diffère de la réplique vocale. */
const TRIGGER_CUE: Record<string, VoiceCue> = { proche_coeur: 'orbe_proche_coeur' };

export interface ReactionCue {
  cue: VoiceCue;
  /** Position de la réaction dans sa liste (sert de variante vocale). */
  variant: number;
}

export function reactionIndex(
  def: CompanionLike,
  known: ReadonlySet<string>,
): Map<string, ReactionCue> {
  const map = new Map<string, ReactionCue>();
  const add = (list: readonly ReactionLike[] | undefined, cue: string): void => {
    if (!known.has(cue)) return;
    list?.forEach((r, variant) => map.set(r.id, { cue: cue as VoiceCue, variant }));
  };
  add(def.idleShort, 'idle_court');
  add(def.idleLong, 'idle_long');
  for (const [trigger, list] of Object.entries(def.reactions))
    add(list, TRIGGER_CUE[trigger] ?? trigger);
  return map;
}

/** Normalise un identifiant d'Astre (« Twi & Nkl », « nuage-lune »…) vers celui des voix. */
export function normalizeAstreId(raw: string): string {
  const k = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  const aliases: Record<string, string> = {
    twinkl: 'twi_nkl',
    jumelles: 'twi_nkl',
    lesjumelles: 'twi_nkl',
    twi: 'twi_nkl',
    nkl: 'twi_nkl',
    nuagelune: 'nuage_lune',
  };
  return aliases[k] ?? k;
}
