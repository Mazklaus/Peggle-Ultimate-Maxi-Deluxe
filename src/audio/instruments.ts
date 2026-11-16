/**
 * Instruments de synthèse (Web Audio pur, aucun fichier) : célesta, harpe, nappe, cordes,
 * cuivres doux, chœur, percussions légères. Chaque fonction programme une note à `time`.
 */
import { midiToFreq } from '../core/audio/theory';
import type { Instrument } from '../core/audio/score';
import type { AudioEngine } from './engine';

export interface NoteOptions {
  /** Sortie (bus). */
  out: AudioNode;
  /** Part envoyée à la réverbération (0-1). */
  wet?: number;
  /** Panoramique -1 (gauche) à 1 (droite). */
  pan?: number;
}

type Ctx = AudioContext;

/** Au-delà, un partiel est inaudible et sort de la plage des oscillateurs : on l'omet. */
const MAX_PARTIAL = 16000;

/** Enveloppe ADSR simple sur un gain ; renvoie l'instant de fin. */
function envelope(
  g: GainNode,
  time: number,
  peak: number,
  attack: number,
  hold: number,
  release: number,
): number {
  const p = g.gain;
  p.setValueAtTime(0.0001, time);
  p.linearRampToValueAtTime(peak, time + attack);
  p.setValueAtTime(peak, time + attack + hold);
  p.exponentialRampToValueAtTime(0.0001, time + attack + hold + release);
  return time + attack + hold + release + 0.05;
}

/** Gain de sortie avec panoramique et envoi réverbération. */
function output(eng: AudioEngine, opts: NoteOptions): GainNode {
  const ctx = eng.ctx as Ctx;
  const g = ctx.createGain();
  let node: AudioNode = g;
  if (opts.pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = opts.pan;
    g.connect(p);
    node = p;
  }
  node.connect(opts.out);
  if (opts.wet) {
    const send = ctx.createGain();
    send.gain.value = opts.wet;
    node.connect(send).connect(eng.reverb);
  }
  return g;
}

function osc(
  ctx: Ctx,
  type: OscillatorType,
  freq: number,
  time: number,
  end: number,
  dest: AudioNode,
  detune = 0,
): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, time);
  o.detune.value = detune;
  o.connect(dest);
  o.start(time);
  o.stop(end);
  return o;
}

function noise(
  eng: AudioEngine,
  time: number,
  end: number,
  dest: AudioNode,
): AudioBufferSourceNode {
  const ctx = eng.ctx as Ctx;
  const src = ctx.createBufferSource();
  src.buffer = eng.noiseBuffer();
  src.loop = true;
  src.connect(dest);
  src.start(time, Math.random());
  src.stop(end);
  return src;
}

function filter(ctx: Ctx, type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

/** Célesta / verre : sinus + partiel aigu qui s'éteint vite. Timbre des rebonds. */
export function celesta(
  eng: AudioEngine,
  time: number,
  midi: number,
  vel: number,
  opts: NoteOptions,
  decay = 1.1,
): void {
  const ctx = eng.ctx as Ctx;
  const f = midiToFreq(midi);
  const g = output(eng, opts);
  const end = envelope(g, time, 0.22 * vel, 0.003, 0, decay);
  osc(ctx, 'sine', f, time, end, g);
  if (f * 4 > MAX_PARTIAL) return;
  const hi = ctx.createGain();
  hi.connect(g);
  envelope(hi, time, 0.35, 0.002, 0, 0.18);
  osc(ctx, 'sine', f * 4, time, end, hi);
}

/** Cloche douce : partiels légèrement inharmoniques (2,76 ; 5,4). */
export function bell(
  eng: AudioEngine,
  time: number,
  midi: number,
  vel: number,
  opts: NoteOptions,
  decay = 1.8,
): void {
  const ctx = eng.ctx as Ctx;
  const f = midiToFreq(midi);
  const g = output(eng, opts);
  const end = envelope(g, time, 0.16 * vel, 0.004, 0, decay);
  osc(ctx, 'sine', f, time, end, g);
  for (const [ratio, amp, d] of [
    [2.76, 0.4, 0.6],
    [5.4, 0.18, 0.25],
  ] as const) {
    if (f * ratio > MAX_PARTIAL) continue;
    const pg = ctx.createGain();
    pg.connect(g);
    envelope(pg, time, amp, 0.003, 0, d);
    osc(ctx, 'sine', f * ratio, time, end, pg);
  }
}

/** Harpe : corde pincée (triangle filtré). */
export function harp(
  eng: AudioEngine,
  time: number,
  midi: number,
  vel: number,
  opts: NoteOptions,
): void {
  const ctx = eng.ctx as Ctx;
  const f = midiToFreq(midi);
  const g = output(eng, opts);
  const lp = filter(ctx, 'lowpass', Math.min(8000, f * 6));
  lp.connect(g);
  const end = envelope(g, time, 0.14 * vel, 0.004, 0, 1.4);
  osc(ctx, 'triangle', f, time, end, lp);
  osc(ctx, 'sine', f * 2, time, end, lp);
}

/** Nappe céleste : deux dents de scie désaccordées, filtre doux, attaque lente. */
export function pad(
  eng: AudioEngine,
  time: number,
  midi: number,
  vel: number,
  dur: number,
  opts: NoteOptions,
): void {
  const ctx = eng.ctx as Ctx;
  const f = midiToFreq(midi);
  const g = output(eng, opts);
  const lp = filter(ctx, 'lowpass', 1100);
  lp.connect(g);
  const end = envelope(g, time, 0.035 * vel, Math.min(1, dur * 0.4), Math.max(0, dur * 0.5), 1.2);
  osc(ctx, 'sawtooth', f, time, end, lp, -7);
  osc(ctx, 'sawtooth', f, time, end, lp, 7);
}

/** Cordes legato (couche de tension et final). */
export function strings(
  eng: AudioEngine,
  time: number,
  midi: number,
  vel: number,
  dur: number,
  opts: NoteOptions,
): void {
  const ctx = eng.ctx as Ctx;
  const f = midiToFreq(midi);
  const g = output(eng, opts);
  const lp = filter(ctx, 'lowpass', 2600);
  lp.connect(g);
  const end = envelope(g, time, 0.05 * vel, 0.04, Math.max(0, dur - 0.04), 0.25);
  const vib = ctx.createOscillator();
  const vibAmt = ctx.createGain();
  vib.frequency.value = 5.5;
  vibAmt.gain.value = 6;
  vib.connect(vibAmt);
  vib.start(time);
  vib.stop(end);
  for (const d of [-9, 0, 9]) vibAmt.connect(osc(ctx, 'sawtooth', f, time, end, lp, d).detune);
}

/** Cuivres doux : le filtre s'ouvre à l'attaque. */
export function brass(
  eng: AudioEngine,
  time: number,
  midi: number,
  vel: number,
  dur: number,
  opts: NoteOptions,
): void {
  const ctx = eng.ctx as Ctx;
  const f = midiToFreq(midi);
  const g = output(eng, opts);
  const lp = filter(ctx, 'lowpass', 600, 1.2);
  lp.frequency.setValueAtTime(500, time);
  lp.frequency.linearRampToValueAtTime(2400 * vel + 600, time + 0.08);
  lp.frequency.exponentialRampToValueAtTime(900, time + Math.max(0.2, dur));
  lp.connect(g);
  const end = envelope(g, time, 0.07 * vel, 0.05, Math.max(0, dur - 0.05), 0.35);
  osc(ctx, 'sawtooth', f, time, end, lp, -4);
  osc(ctx, 'sawtooth', f, time, end, lp, 4);
}

/** Chœur « ah » : dent de scie à travers deux formants, vibrato lent. */
export function choir(
  eng: AudioEngine,
  time: number,
  midi: number,
  vel: number,
  dur: number,
  opts: NoteOptions,
): void {
  const ctx = eng.ctx as Ctx;
  const f = midiToFreq(midi);
  const g = output(eng, opts);
  const end = envelope(g, time, 0.09 * vel, 0.35, Math.max(0, dur - 0.35), 0.9);
  const vib = ctx.createOscillator();
  const vibAmt = ctx.createGain();
  vib.frequency.value = 4.8;
  vibAmt.gain.value = 9;
  vib.connect(vibAmt);
  vib.start(time);
  vib.stop(end);
  for (const [freq, q, amp] of [
    [750, 6, 1],
    [1150, 7, 0.6],
    [2600, 9, 0.2],
  ] as const) {
    const bp = filter(ctx, 'bandpass', freq, q);
    const a = ctx.createGain();
    a.gain.value = amp;
    bp.connect(a).connect(g);
    for (const d of [-6, 6]) vibAmt.connect(osc(ctx, 'sawtooth', f, time, end, bp, d).detune);
  }
}

/** Basse ronde. */
export function bass(
  eng: AudioEngine,
  time: number,
  midi: number,
  vel: number,
  dur: number,
  opts: NoteOptions,
): void {
  const ctx = eng.ctx as Ctx;
  const f = midiToFreq(midi);
  const g = output(eng, opts);
  const end = envelope(g, time, 0.22 * vel, 0.01, dur * 0.3, dur * 0.8 + 0.1);
  osc(ctx, 'sine', f, time, end, g);
  const t = ctx.createGain();
  t.gain.value = 0.25;
  t.connect(g);
  osc(ctx, 'triangle', f * 2, time, end, t);
}

/** Grosse caisse feutrée. */
export function kick(eng: AudioEngine, time: number, vel: number, opts: NoteOptions): void {
  const ctx = eng.ctx as Ctx;
  const g = output(eng, opts);
  const end = envelope(g, time, 0.35 * vel, 0.003, 0, 0.28);
  const o = osc(ctx, 'sine', 110, time, end, g);
  o.frequency.exponentialRampToValueAtTime(42, time + 0.18);
}

/** Shaker léger (poussière d'étoile). */
export function shaker(eng: AudioEngine, time: number, vel: number, opts: NoteOptions): void {
  const ctx = eng.ctx as Ctx;
  const g = output(eng, opts);
  const hp = filter(ctx, 'highpass', 7000);
  hp.connect(g);
  const end = envelope(g, time, 0.06 * vel, 0.01, 0, 0.06);
  noise(eng, time, end, hp);
}

/** Timbale douce (pulsation de tension, final). */
export function pulse(
  eng: AudioEngine,
  time: number,
  midi: number,
  vel: number,
  opts: NoteOptions,
): void {
  const ctx = eng.ctx as Ctx;
  const f = midiToFreq(midi);
  const g = output(eng, opts);
  const end = envelope(g, time, 0.3 * vel, 0.005, 0, 0.9);
  const o = osc(ctx, 'sine', f * 1.15, time, end, g);
  o.frequency.exponentialRampToValueAtTime(f, time + 0.12);
  const ng = ctx.createGain();
  const lp = filter(ctx, 'lowpass', 400);
  lp.connect(ng).connect(g);
  envelope(ng, time, 0.5, 0.002, 0, 0.12);
  noise(eng, time, time + 0.2, lp);
}

/** Cymbale en crescendo puis chute (explosion du final). */
export function cymbal(
  eng: AudioEngine,
  time: number,
  vel: number,
  dur: number,
  opts: NoteOptions,
): void {
  const ctx = eng.ctx as Ctx;
  const g = output(eng, opts);
  const hp = filter(ctx, 'highpass', 5000);
  hp.connect(g);
  const end = envelope(g, time, 0.12 * vel, 0.01, 0.05, dur);
  noise(eng, time, end, hp);
}

/** Mélodie douce (flûte de verre) pour la couche « tir ». */
export function melody(
  eng: AudioEngine,
  time: number,
  midi: number,
  vel: number,
  dur: number,
  opts: NoteOptions,
): void {
  const ctx = eng.ctx as Ctx;
  const f = midiToFreq(midi);
  const g = output(eng, opts);
  const end = envelope(g, time, 0.07 * vel, 0.04, Math.max(0, dur * 0.7), 0.35);
  const vib = ctx.createOscillator();
  const vibAmt = ctx.createGain();
  vib.frequency.value = 5;
  vibAmt.gain.setValueAtTime(0, time);
  vibAmt.gain.linearRampToValueAtTime(8, time + 0.3);
  vib.connect(vibAmt);
  vib.start(time);
  vib.stop(end);
  vibAmt.connect(osc(ctx, 'triangle', f, time, end, g).detune);
  const s = ctx.createGain();
  s.gain.value = 0.4;
  s.connect(g);
  osc(ctx, 'sine', f * 2, time, end, s);
}

/** Joue n'importe quel instrument de partition (durée en secondes). */
export function playInstrument(
  eng: AudioEngine,
  instrument: Instrument,
  time: number,
  midi: number,
  vel: number,
  dur: number,
  opts: NoteOptions,
): void {
  switch (instrument) {
    case 'pad':
      return pad(eng, time, midi, vel, dur, opts);
    case 'harp':
      return harp(eng, time, midi, vel, opts);
    case 'bell':
      return bell(eng, time, midi, vel, opts);
    case 'bass':
      return bass(eng, time, midi, vel, dur, opts);
    case 'kick':
      return kick(eng, time, vel, opts);
    case 'shaker':
      return shaker(eng, time, vel, opts);
    case 'melody':
      return melody(eng, time, midi, vel, dur, opts);
    case 'strings':
      return strings(eng, time, midi, vel, dur, opts);
    case 'pulse':
      return pulse(eng, time, midi, vel, opts);
    case 'brass':
      return brass(eng, time, midi, vel, dur, opts);
    case 'choir':
      return choir(eng, time, midi, vel, dur, opts);
    case 'cymbal':
      return cymbal(eng, time, vel, dur, opts);
    case 'musicbox':
      return celesta(eng, time, midi, vel, opts, 1.6);
    case 'piccolo':
      return melody(eng, time, midi + 12, vel * 0.8, dur, opts);
  }
}

/** Petit « tic » de bois sans hauteur : rebond sur un mur (ne casse pas la mélodie). */
export function woodTick(eng: AudioEngine, time: number, vel: number, opts: NoteOptions): void {
  const ctx = eng.ctx as Ctx;
  const g = output(eng, opts);
  const bp = filter(ctx, 'bandpass', 1400 + Math.random() * 300, 4);
  bp.connect(g);
  const end = envelope(g, time, 0.25 * vel, 0.001, 0, 0.05);
  noise(eng, time, end, bp);
}

/** Souffle (rire, soupir, bâillement) pour les voix. */
export function breath(
  eng: AudioEngine,
  time: number,
  freq: number,
  dur: number,
  vel: number,
  out: AudioNode,
): void {
  const ctx = eng.ctx as Ctx;
  const g = ctx.createGain();
  g.connect(out);
  const bp = filter(ctx, 'bandpass', freq, 2.5);
  bp.connect(g);
  const end = envelope(g, time, 0.18 * vel, dur * 0.3, dur * 0.2, dur * 0.5);
  noise(eng, time, end, bp);
}
