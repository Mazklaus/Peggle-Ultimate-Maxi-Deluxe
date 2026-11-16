/**
 * Vocabulaire d'animation commun à tous les Astres (Narrative, 00-regles-communes.md).
 * Tout est décrit en données : la vue Phaser ne fait que dessiner une Pose.
 */

export type Eyes =
  | 'open'
  | 'closed'
  | 'happy' // ^^
  | 'wide' // O O
  | 'stars' // ✦✦
  | 'spiral' // @@
  | 'squint' // > <
  | 'wink';

export type Mouth =
  | 'neutral'
  | 'smile'
  | 'grin'
  | 'open'
  | 'o'
  | 'pout'
  | 'zigzag'
  | 'tongue'
  | 'yawn'
  | 'puffed'
  | 'whistle';

/** Mèche / accessoire d'humeur (Pip : branche du haut). */
export type Tuft = 'calm' | 'up' | 'down' | 'curl' | 'antenna' | 'flame' | 'messy';

/** Pose des deux branches-bras. */
export type Arms =
  | 'rest'
  | 'up'
  | 'wave'
  | 'wide'
  | 'down'
  | 'point'
  | 'cover'
  | 'pray'
  | 'cross'
  | 'flail'
  | 'chest'
  | 'clap'
  | 'scratch'
  | 'bite'
  | 'pushup'
  | 'steer';

export type ParticleKind =
  'sparkle' | 'heart' | 'sweat' | 'zzz' | 'note' | 'confetti' | 'smoke' | 'dizzy';

/** Seuls symboles autorisés (règle « sans texte »). */
export type Symbol = '!' | '?' | '♪' | '♥' | 'zzz' | '✦' | '!!' | '?!';

/** Accessoire temporaire dessiné par la vue (ex. mini-orbe du jongleur). */
export type Prop = 'none' | 'juggle' | 'bonk' | 'beam' | 'fly';

export interface BodyPose {
  /** Décalage en px dans l'emplacement de marge. */
  x: number;
  y: number;
  /** Échelles (squash & stretch). */
  sx: number;
  sy: number;
  /** Rotation en radians. */
  rot: number;
}

export interface Burst {
  kind: ParticleKind;
  count: number;
}

export interface Keyframe {
  /** Instant normalisé 0..1 dans la réaction. */
  t: number;
  body?: Partial<BodyPose>;
  eyes?: Eyes;
  mouth?: Mouth;
  tuft?: Tuft;
  arms?: Arms;
  /** Regard imposé (-1..1), sinon le regard suit la visée ou l'orbe. */
  look?: { x: number; y: number } | null;
  symbol?: Symbol | null;
  prop?: Prop;
  burst?: Burst;
  /** Tremblement en px. */
  shake?: number;
  glow?: number;
  /** Rougeur 0..1 (retient son souffle). */
  flush?: number;
}

export interface ReactionDef {
  id: string;
  /** Durée en secondes. */
  duration: number;
  keys: Keyframe[];
  /** Garde la dernière pose à la fin (écran de victoire / échec). */
  hold?: boolean;
  /** Effet qui persiste après la réaction (ex. mèche de travers 5 s). */
  aftermath?: { tuft: Tuft; seconds: number };
}

/** Pose d'état gardée longtemps (dernier cœur, dernier orbe, sommeil). */
export interface StatePose {
  body?: Partial<BodyPose>;
  eyes?: Eyes;
  mouth?: Mouth;
  tuft?: Tuft;
  arms?: Arms;
  shake?: number;
  symbol?: Symbol | null;
  look?: { x: number; y: number } | null;
}

/** Déclencheurs de réactions : événements du plan + signaux de l'Astre. */
export type ReactionTrigger =
  | 'tir_lance'
  | 'gros_coup'
  | 'chaine_longue'
  | 'rate'
  | 'orbe_recupere'
  | 'pouvoir_active'
  | 'presque'
  | 'dernier_coeur'
  | 'dernier_orbe'
  | 'final_ralenti'
  | 'victoire'
  | 'echec'
  | 'inactivite'
  | 'tir_moyen'
  | 'proche_coeur'
  | 'orbe_coincee'
  | 'reveil';

export interface CompanionDef {
  id: string;
  /** Couleurs du corps (DA / Narrative). */
  color: number;
  colorLight: number;
  colorDark: number;
  reactions: Partial<Record<ReactionTrigger, ReactionDef[]>>;
  idleShort: ReactionDef[];
  idleLong: ReactionDef[];
  states: {
    dernier_coeur: StatePose;
    dernier_orbe: StatePose;
    sommeil: StatePose;
    crispation: StatePose;
  };
}

/** Ce que la vue dessine à chaque frame. */
export interface Pose {
  body: BodyPose;
  eyes: Eyes;
  mouth: Mouth;
  tuft: Tuft;
  arms: Arms;
  /** Direction du regard (-1..1). */
  look: { x: number; y: number };
  symbol: Symbol | null;
  prop: Prop;
  /** Avancement 0..1 de la réaction en cours (pour animer les accessoires). */
  propT: number;
  shake: number;
  glow: number;
  flush: number;
  excitement: number;
  /** Événements ponctuels de cette frame. */
  bursts: Burst[];
  cry: { reaction: string; variant: number } | null;
}
