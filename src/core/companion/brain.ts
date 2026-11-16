/**
 * Cerveau d'un Astre : machine à états (visée / vol / fin) + file de réactions non bloquante.
 * Logique pure : la vue appelle update() à chaque frame et dessine la Pose renvoyée.
 *
 * Couches, de bas en haut :
 *  1. pose de base procédurale selon l'état (respiration, suivi de l'orbe, crispation…)
 *  2. pose d'état gardée (dernier cœur, dernier orbe, sommeil)
 *  3. micro-sauts d'excitation à chaque cristal
 *  4. réaction en cours (clés), avec fondu d'entrée / sortie
 */
import { crossedKeys, sampleReaction } from './timeline';
import type {
  BodyPose,
  Burst,
  CompanionDef,
  Pose,
  ReactionDef,
  ReactionTrigger,
  StatePose,
  Tuft,
} from './types';

export type CompanionPhase = 'aiming' | 'flight' | 'over';
export type Rng = () => number;

/** Priorités (00-regles-communes.md) : la plus haute interrompt les autres. */
export const PRIORITY: Record<ReactionTrigger | 'idle', number> = {
  victoire: 100,
  echec: 100,
  final_ralenti: 90,
  presque: 80,
  gros_coup: 70,
  chaine_longue: 65,
  pouvoir_active: 60,
  dernier_coeur: 55,
  dernier_orbe: 50,
  orbe_recupere: 45,
  rate: 40,
  tir_moyen: 35,
  proche_coeur: 32,
  reveil: 30,
  tir_lance: 25,
  inactivite: 20,
  idle: 0,
};

export const BRAIN_TUNING = {
  blendSeconds: 0.15,
  fadeSeconds: 0.12,
  /** Accélération d'un idle interrompu (il se termine en accéléré). */
  interruptSpeed: 5,
  tirLanceChance: 1 / 3,
  idleShortEvery: [4, 7],
  idleLongEvery: [12, 20],
  sleepAfterSeconds: 30,
  excitementPerHit: 0.12,
  excitementDecayPerSecond: 0.18,
  /** Garde-fou du Game Designer : au plus une réaction majeure par seconde pendant le vol. */
  majorMinGapSeconds: 1,
  maxPending: 2,
  hopSeconds: 0.28,
};

export interface OrbInput {
  /** Position relative à l'Astre en px (x > 0 : à droite de l'Astre). */
  dx: number;
  dy: number;
  /** Vitesse verticale (px/s, > 0 vers le bas). */
  vy: number;
  /** 0 en haut de la zone de jeu, 1 en bas. */
  depth: number;
  /** L'orbe frôle un cœur non allumé. */
  nearHeart: boolean;
}

export interface BrainInput {
  /** Direction de visée relative à l'Astre (px), en phase de visée. */
  aim?: { dx: number; dy: number };
  orb?: OrbInput;
}

interface Playing {
  def: ReactionDef;
  trigger: ReactionTrigger | 'idle';
  variant: number;
  elapsed: number;
  speed: number;
  lastP: number;
}

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export class CompanionBrain {
  readonly def: CompanionDef;
  private rng: Rng;
  private time = 0;
  private phase: CompanionPhase = 'aiming';
  private playing: Playing | null = null;
  private pending: Playing[] = [];
  private lastVariant = new Map<string, number>();
  private excitement = 0;
  private hopT = 1;
  private hopPower = 0;
  private tense: 'dernier_coeur' | 'dernier_orbe' | null = null;
  private sleeping = false;
  private quietTime = 0;
  private lastAim = { dx: 0, dy: 0 };
  private aimStill = 0;
  private nextShortIdle: number;
  private nextLongIdle: number;
  private lastMajorAt = -10;
  private flushLevel = 0;
  private aftermath: { tuft: Tuft; until: number } | null = null;
  private wasNearHeart = false;
  private blink = { next: 3, until: 0, double: false };
  private smoothed: BodyPose = { x: 0, y: 0, sx: 1, sy: 1, rot: 0 };
  private bursts: Burst[] = [];
  private cry: Pose['cry'] = null;
  private nodT = 1;
  private shotHits = 0;

  constructor(def: CompanionDef, rng: Rng = Math.random) {
    this.def = def;
    this.rng = rng;
    this.nextShortIdle = this.between(BRAIN_TUNING.idleShortEvery);
    this.nextLongIdle = this.between(BRAIN_TUNING.idleLongEvery);
  }

  // ---------- Entrées ----------

  setPhase(phase: CompanionPhase): void {
    if (phase === this.phase) return;
    if (phase === 'flight') {
      this.shotHits = 0;
      this.wake();
    }
    if (phase === 'aiming') {
      // Nouvelle visée (ou niveau relancé) : on lâche une pose de fin gardée.
      if (this.playing?.def.hold) this.playing = null;
      // Les états tendus valent jusqu'au tir suivant ; ils seront ré-émis s'ils tiennent toujours.
      this.tense = null;
      this.quietTime = 0;
    }
    this.phase = phase;
  }

  /** Événement du bus (noms du plan). */
  onEvent(trigger: ReactionTrigger): void {
    if (trigger === 'dernier_coeur' || trigger === 'dernier_orbe') {
      this.tense = trigger;
    }
    if (trigger === 'tir_lance' && this.rng() > BRAIN_TUNING.tirLanceChance) return;
    if (trigger === 'inactivite' && this.sleeping) return;
    this.trigger(trigger);
  }

  /** Un cristal vient de s'allumer : la jauge d'excitation monte. */
  onCrystalHit(): void {
    this.shotHits += 1;
    this.excitement = clamp(this.excitement + BRAIN_TUNING.excitementPerHit, 0, 1);
    this.hopT = 0;
    this.hopPower = this.excitement;
    if (this.excitement > 0.35)
      this.bursts.push({ kind: 'sparkle', count: 1 + Math.round(this.excitement * 3) });
  }

  /** Fin de tir sans événement marquant : petit hochement satisfait. */
  onShotEndQuiet(): void {
    if (this.shotHits > 0) this.trigger('tir_moyen');
  }

  // ---------- Boucle ----------

  update(dt: number, input: BrainInput = {}): Pose {
    this.time += dt;
    this.bursts = this.bursts.filter(() => true);
    const frameBursts = this.bursts;
    this.bursts = [];
    const frameCry = this.cry;
    this.cry = null;

    this.excitement = Math.max(
      0,
      this.excitement -
        BRAIN_TUNING.excitementDecayPerSecond * dt * (this.phase === 'flight' ? 0.4 : 1),
    );
    this.hopT = Math.min(1, this.hopT + dt / BRAIN_TUNING.hopSeconds);
    this.nodT = Math.min(1, this.nodT + dt / 0.6);

    this.updateAiming(dt, input);
    this.updateFlight(input);
    this.advanceReaction(dt);

    const pose = this.compose(dt, input);
    pose.bursts.push(...frameBursts);
    if (frameCry && !pose.cry) pose.cry = frameCry;
    return pose;
  }

  get state(): {
    phase: CompanionPhase;
    sleeping: boolean;
    tense: string | null;
    reaction: string | null;
    excitement: number;
  } {
    return {
      phase: this.phase,
      sleeping: this.sleeping,
      tense: this.tense,
      reaction: this.playing?.def.id ?? null,
      excitement: this.excitement,
    };
  }

  // ---------- Interne ----------

  private between([a, b]: number[]): number {
    return this.time + (a ?? 0) + this.rng() * ((b ?? 0) - (a ?? 0));
  }

  private pick(list: ReactionDef[], key: string): { def: ReactionDef; variant: number } | null {
    if (list.length === 0) return null;
    const last = this.lastVariant.get(key);
    let i = Math.floor(this.rng() * list.length);
    if (list.length > 1 && i === last)
      i = (i + 1 + Math.floor(this.rng() * (list.length - 1))) % list.length;
    this.lastVariant.set(key, i);
    const def = list[i];
    return def ? { def, variant: i } : null;
  }

  private trigger(trigger: ReactionTrigger): void {
    const choice = this.pick(this.def.reactions[trigger] ?? [], trigger);
    if (!choice) return;
    this.start({
      def: choice.def,
      trigger,
      variant: choice.variant,
      elapsed: 0,
      speed: 1,
      lastP: -1,
    });
  }

  private start(next: Playing): void {
    const prio = PRIORITY[next.trigger];
    const cur = this.playing;
    if (prio >= PRIORITY.victoire) this.pending = [];
    if (!cur) {
      this.begin(next);
      return;
    }
    const curPrio = PRIORITY[cur.trigger];
    const rateLimited =
      this.phase === 'flight' &&
      prio < PRIORITY.presque &&
      this.time - this.lastMajorAt < BRAIN_TUNING.majorMinGapSeconds;
    if (prio > curPrio && !rateLimited) {
      if (cur.trigger === 'idle' || cur.trigger === 'inactivite') {
        // Un idle interrompu se termine en accéléré, puis la réaction démarre.
        cur.speed = BRAIN_TUNING.interruptSpeed;
        this.pending.unshift(next);
      } else {
        this.begin(next);
      }
    } else if (
      next.trigger !== 'tir_lance' &&
      next.trigger !== 'inactivite' &&
      next.trigger !== 'idle'
    ) {
      this.pending.push(next);
      this.pending.sort((a, b) => PRIORITY[b.trigger] - PRIORITY[a.trigger]);
      this.pending.length = Math.min(this.pending.length, BRAIN_TUNING.maxPending);
    }
  }

  private begin(p: Playing): void {
    this.playing = p;
    if (p.trigger !== 'idle') {
      this.cry = { reaction: p.def.id, variant: p.variant };
      if (PRIORITY[p.trigger] > PRIORITY.tir_lance) this.lastMajorAt = this.time;
    }
  }

  private advanceReaction(dt: number): void {
    const p = this.playing;
    if (!p) {
      const next = this.pending.shift();
      if (next) this.begin(next);
      return;
    }
    p.elapsed += dt * p.speed;
    const prog = Math.min(1, p.elapsed / p.def.duration);
    for (const k of crossedKeys(p.def, p.lastP, prog)) if (k.burst) this.bursts.push(k.burst);
    p.lastP = prog;
    if (prog >= 1 && !p.def.hold) {
      if (p.def.aftermath)
        this.aftermath = { tuft: p.def.aftermath.tuft, until: this.time + p.def.aftermath.seconds };
      this.playing = null;
      const next = this.pending.shift();
      if (next) this.begin(next);
    }
  }

  private wake(): void {
    if (!this.sleeping) return;
    this.sleeping = false;
    this.trigger('reveil');
  }

  private updateAiming(dt: number, input: BrainInput): void {
    if (this.phase !== 'aiming') return;
    this.quietTime += dt;
    if (input.aim) {
      const moved = Math.hypot(input.aim.dx - this.lastAim.dx, input.aim.dy - this.lastAim.dy) > 3;
      this.lastAim = input.aim;
      if (moved) {
        this.aimStill = 0;
        this.quietTime = 0;
        this.wake();
      } else {
        this.aimStill += dt;
        if (this.aimStill >= 2 && this.aimStill - dt < 2) this.nodT = 0; // hochement approbateur
      }
    }
    if (!this.sleeping && this.quietTime >= BRAIN_TUNING.sleepAfterSeconds) {
      this.sleeping = true;
      if (this.playing?.trigger === 'idle') this.playing.speed = BRAIN_TUNING.interruptSpeed;
    }
    if (this.sleeping || this.playing || this.pending.length > 0) return;
    if (this.time >= this.nextLongIdle) {
      const c = this.pick(this.def.idleLong, 'idleLong');
      if (c)
        this.begin({
          def: c.def,
          trigger: 'idle',
          variant: c.variant,
          elapsed: 0,
          speed: 1,
          lastP: -1,
        });
      this.nextLongIdle = this.between(BRAIN_TUNING.idleLongEvery);
      this.nextShortIdle = this.between(BRAIN_TUNING.idleShortEvery);
    } else if (this.time >= this.nextShortIdle) {
      const c = this.pick(this.def.idleShort, 'idleShort');
      if (c)
        this.begin({
          def: c.def,
          trigger: 'idle',
          variant: c.variant,
          elapsed: 0,
          speed: 1,
          lastP: -1,
        });
      this.nextShortIdle = this.between(BRAIN_TUNING.idleShortEvery);
    }
  }

  private updateFlight(input: BrainInput): void {
    if (this.phase !== 'flight' || !input.orb) {
      this.wasNearHeart = false;
      return;
    }
    if (input.orb.nearHeart && !this.wasNearHeart) this.trigger('proche_coeur');
    this.wasNearHeart = input.orb.nearHeart;
  }

  /** Assemble la pose de la frame. */
  private compose(dt: number, input: BrainInput): Pose {
    const t = this.time;
    const e = this.excitement;
    const body: BodyPose = { x: 0, y: 0, sx: 1, sy: 1, rot: 0 };
    const pose: Pose = {
      body,
      eyes: 'open',
      mouth: 'smile',
      tuft: 'calm',
      arms: 'rest',
      look: { x: 0, y: 0 },
      symbol: null,
      prop: 'none',
      propT: 0,
      shake: 0,
      glow: e * 0.8,
      flush: 0,
      excitement: e,
      bursts: [],
      cry: null,
    };

    // 1. Base : respiration et flottement.
    const breath = Math.sin((t * Math.PI * 2) / 1.5);
    body.y = Math.sin((t * Math.PI * 2) / 2) * 3;
    body.sx = 1 + breath * 0.03;
    body.sy = 1 - breath * 0.03;

    if (this.phase === 'aiming' && input.aim) {
      const len = Math.hypot(input.aim.dx, input.aim.dy) || 1;
      pose.look = { x: input.aim.dx / len, y: input.aim.dy / len };
      body.rot = clamp(input.aim.dx / 900, -1, 1) * 0.22;
    }
    if (this.phase === 'flight' && input.orb) {
      const o = input.orb;
      const len = Math.hypot(o.dx, o.dy) || 1;
      pose.look = { x: o.dx / len, y: o.dy / len };
      body.rot = clamp(o.dx / 700, -1, 1) * 0.35;
      // Monte avec l'orbe, se tasse quand il tombe vite.
      const fall = clamp(o.vy / 900, -1, 1);
      body.sy *= 1 - fall * 0.12;
      body.sx *= 1 + fall * 0.08;
      pose.arms = 'steer';
      pose.mouth = e > 0.5 ? 'grin' : 'o';
      if (o.depth > 0.66) this.applyState(pose, this.def.states.crispation);
    }
    // Excitation : rebonds continus quand la jauge est haute (aussi en résiduel après le tir).
    if (e > 0.3) {
      const freq = 4 + e * 8;
      body.y -= Math.abs(Math.sin(t * freq)) * (4 + e * 22);
      if (e > 0.7) pose.tuft = 'flame';
      if (e > 0.55 && this.rng() < e * 0.15) pose.bursts.push({ kind: 'sparkle', count: 1 });
    }
    if (this.sleeping) this.applyState(pose, this.def.states.sommeil);
    if (this.tense) this.applyState(pose, this.def.states[this.tense]);
    if (this.tense === 'dernier_coeur' && this.phase === 'flight') {
      this.flushLevel = Math.min(1, this.flushLevel + dt / 3);
      pose.mouth = 'puffed';
    } else {
      this.flushLevel = Math.max(0, this.flushLevel - dt * 2);
    }
    pose.flush = this.flushLevel;
    if (this.aftermath) {
      if (t < this.aftermath.until) pose.tuft = this.aftermath.tuft;
      else this.aftermath = null;
    }

    // Clignement des yeux (3 à 5 s, parfois double).
    if (t >= this.blink.next) {
      this.blink.until = t + 0.12;
      this.blink.next = t + (this.blink.double ? 0.25 : 3 + this.rng() * 2);
      this.blink.double = !this.blink.double && this.rng() < 0.3;
    }
    if (t < this.blink.until && pose.eyes === 'open') pose.eyes = 'closed';

    // Hochement approbateur.
    if (this.nodT < 1) body.y += Math.sin(this.nodT * Math.PI * 4) * 3 * (1 - this.nodT);

    // Transition douce de la pose de base (jamais de saut d'une pose à l'autre).
    const k = 1 - Math.exp(-dt / (BRAIN_TUNING.blendSeconds / 3));
    for (const f of ['x', 'y', 'sx', 'sy', 'rot'] as const)
      this.smoothed[f] = lerp(this.smoothed[f], body[f], k);
    Object.assign(body, this.smoothed);

    // 3. Micro-saut d'excitation à chaque cristal.
    if (this.hopT < 1) {
      const h = Math.sin(this.hopT * Math.PI);
      body.y -= h * (6 + this.hopPower * 20);
      body.sy *= 1 + h * 0.1;
      body.sx *= 1 - h * 0.06;
    }

    // 4. Réaction en cours.
    const p = this.playing;
    if (p) {
      const prog = Math.min(1, p.elapsed / p.def.duration);
      const s = sampleReaction(p.def, prog);
      const dur = p.def.duration / p.speed;
      const fade = BRAIN_TUNING.fadeSeconds;
      const w = p.def.hold
        ? Math.min(1, p.elapsed / fade)
        : Math.min(1, p.elapsed / fade, (dur - p.elapsed / p.speed) / fade + 0.0001);
      const wc = clamp(w, 0, 1);
      body.x += s.body.x * wc;
      body.y += s.body.y * wc;
      body.rot += s.body.rot * wc;
      body.sx *= lerp(1, s.body.sx, wc);
      body.sy *= lerp(1, s.body.sy, wc);
      if (s.eyes) pose.eyes = s.eyes;
      if (s.mouth) pose.mouth = s.mouth;
      if (s.tuft) pose.tuft = s.tuft;
      if (s.arms) pose.arms = s.arms;
      if (s.look) pose.look = s.look;
      if (s.symbol !== undefined) pose.symbol = s.symbol;
      if (s.prop) pose.prop = s.prop;
      pose.propT = prog;
      pose.shake += s.shake;
      if (s.glow !== undefined) pose.glow = Math.max(pose.glow, s.glow);
      if (s.flush !== undefined) pose.flush = Math.max(pose.flush, s.flush);
    }
    return pose;
  }

  private applyState(pose: Pose, s: StatePose): void {
    if (s.body) {
      pose.body.x += s.body.x ?? 0;
      pose.body.y += s.body.y ?? 0;
      pose.body.rot += s.body.rot ?? 0;
      pose.body.sx *= s.body.sx ?? 1;
      pose.body.sy *= s.body.sy ?? 1;
    }
    if (s.eyes) pose.eyes = s.eyes;
    if (s.mouth) pose.mouth = s.mouth;
    if (s.tuft) pose.tuft = s.tuft;
    if (s.arms) pose.arms = s.arms;
    if (s.shake) pose.shake += s.shake;
    if (s.symbol !== undefined) pose.symbol = s.symbol;
    if (s.look) pose.look = s.look;
  }
}
