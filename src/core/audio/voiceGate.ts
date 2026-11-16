/**
 * Arbitre de la voix d'un Astre : il ne parle jamais par-dessus lui-même et ne sature pas le mix.
 * Règles : une réplique plus importante coupe la courante ; une réplique moins importante
 * ou égale est ignorée tant que la courante joue ; les « pip » de cristal sont espacés.
 */
import { CUE_PRIORITY, type VoiceCue } from './voice';

export type GateDecision = 'play' | 'interrupt' | 'drop';

/** Écart minimal entre deux « pip ! » de cristal (s). */
export const CRISTAL_MIN_GAP = 0.11;
/** Écart minimal entre deux idles vocaux (s), pour que l'Astre ne bavarde pas sans arrêt. */
export const IDLE_MIN_GAP = 3.5;

export class VoiceGate {
  private busyUntil = 0;
  private currentPriority = 0;
  private lastCristal = -Infinity;
  private lastIdle = -Infinity;

  /** Demande à jouer `cue` à l'instant `now` pour `duration` secondes. */
  request(cue: VoiceCue, now: number, duration: number): GateDecision {
    const priority = CUE_PRIORITY[cue];
    const busy = now < this.busyUntil;

    if (cue === 'cristal') {
      // Les pips ne coupent rien et se taisent pendant une vraie réplique.
      if (busy && this.currentPriority >= 2) return 'drop';
      if (now - this.lastCristal < CRISTAL_MIN_GAP) return 'drop';
      this.lastCristal = now;
      return 'play';
    }

    if (priority === 1) {
      if (busy || now - this.lastIdle < IDLE_MIN_GAP) return 'drop';
      this.lastIdle = now;
    }

    let decision: GateDecision = 'play';
    if (busy) {
      // Les fins de niveau (priorité 4) passent toujours, même après le cri du ralenti.
      if (priority <= this.currentPriority && priority < 4) return 'drop';
      decision = 'interrupt';
    }
    this.busyUntil = now + duration;
    this.currentPriority = priority;
    return decision;
  }

  /** Oublie la réplique en cours (changement de niveau, pause). */
  reset(): void {
    this.busyUntil = 0;
    this.currentPriority = 0;
  }
}
