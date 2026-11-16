/** Lecture d'une réaction : interpolation des clés (logique pure). */
import type {
  Arms,
  BodyPose,
  Eyes,
  Keyframe,
  Mouth,
  Prop,
  ReactionDef,
  Symbol,
  Tuft,
} from './types';

export const NEUTRAL_BODY: BodyPose = { x: 0, y: 0, sx: 1, sy: 1, rot: 0 };

export interface Sample {
  body: BodyPose;
  eyes?: Eyes;
  mouth?: Mouth;
  tuft?: Tuft;
  arms?: Arms;
  look?: { x: number; y: number } | null;
  symbol?: Symbol | null;
  prop?: Prop;
  shake: number;
  glow?: number;
  flush?: number;
}

const easeInOut = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);

type NumField = keyof BodyPose | 'shake' | 'glow' | 'flush';

function readNum(k: Keyframe, field: NumField): number | undefined {
  if (field === 'shake' || field === 'glow' || field === 'flush') return k[field];
  return k.body?.[field];
}

/** Valeur numérique à l'instant p, interpolée entre les clés qui la définissent (départ neutre). */
function numField(keys: Keyframe[], field: NumField, p: number, neutral: number): number {
  let prevT = 0;
  let prevV = neutral;
  for (const k of keys) {
    const v = readNum(k, field);
    if (v === undefined) continue;
    if (k.t >= p) {
      if (k.t <= prevT) return v;
      const u = (p - prevT) / (k.t - prevT);
      return prevV + (v - prevV) * easeInOut(Math.min(1, Math.max(0, u)));
    }
    prevT = k.t;
    prevV = v;
  }
  return prevV;
}

const defines = (keys: Keyframe[], field: NumField) =>
  keys.some((k) => readNum(k, field) !== undefined);

/** Champ discret : la dernière clé passée qui le définit. */
function stepField<K extends 'eyes' | 'mouth' | 'tuft' | 'arms' | 'look' | 'symbol' | 'prop'>(
  keys: Keyframe[],
  field: K,
  p: number,
): Keyframe[K] | undefined {
  let out: Keyframe[K] | undefined;
  for (const k of keys) {
    if (k.t > p) break;
    if (field in k) out = k[field];
  }
  return out;
}

export function sampleReaction(def: ReactionDef, p: number): Sample {
  const keys = def.keys;
  return {
    body: {
      x: numField(keys, 'x', p, 0),
      y: numField(keys, 'y', p, 0),
      sx: numField(keys, 'sx', p, 1),
      sy: numField(keys, 'sy', p, 1),
      rot: numField(keys, 'rot', p, 0),
    },
    eyes: stepField(keys, 'eyes', p),
    mouth: stepField(keys, 'mouth', p),
    tuft: stepField(keys, 'tuft', p),
    arms: stepField(keys, 'arms', p),
    look: stepField(keys, 'look', p),
    symbol: stepField(keys, 'symbol', p),
    prop: stepField(keys, 'prop', p),
    shake: numField(keys, 'shake', p, 0),
    glow: defines(keys, 'glow') ? numField(keys, 'glow', p, 0) : undefined,
    flush: defines(keys, 'flush') ? numField(keys, 'flush', p, 0) : undefined,
  };
}

/** Clés franchies entre p0 (exclu) et p1 (inclus) ; p0 = -1 au démarrage. */
export function crossedKeys(def: ReactionDef, p0: number, p1: number): Keyframe[] {
  return def.keys.filter((k) => k.t > p0 && k.t <= p1);
}
