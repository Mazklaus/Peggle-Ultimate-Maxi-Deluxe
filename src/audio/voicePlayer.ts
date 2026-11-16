/**
 * Interprète les phrases de voix des Astres (langue « astrale » sans mots) sur l'instrument-voix.
 * Jalon 1 : piccolo / sifflet de Pip (triangle + sinus, vibrato, glissandos, trilles, souffles).
 */
import { midiToFreq } from '../core/audio/theory';
import type { Phrase } from '../core/audio/voice';
import type { AudioEngine } from './engine';
import { breath } from './instruments';

export class VoicePlayer {
  private current: GainNode | null = null;

  constructor(private readonly eng: AudioEngine) {}

  /** Coupe net (≈ 50 ms) la réplique en cours. */
  cut(): void {
    const ctx = this.eng.ctx;
    if (!ctx || !this.current) return;
    this.current.gain.setTargetAtTime(0, ctx.currentTime, 0.015);
    this.current = null;
  }

  /**
   * Joue une phrase. `root` = tonique MIDI de l'Astre, `transpose` = décalage (jauge d'excitation),
   * `rate` > 1 accélère le débit (Pip qui mitraille).
   */
  play(phrase: Phrase, root: number, transpose = 0, rate = 1, gain = 1): void {
    const ctx = this.eng.ctx;
    if (!ctx) return;
    const out = ctx.createGain();
    out.gain.value = gain;
    const pan = ctx.createStereoPanner?.();
    if (pan) {
      pan.pan.value = 0.55; // l'Astre vit dans la marge droite
      out.connect(pan).connect(this.eng.buses.voice);
    } else out.connect(this.eng.buses.voice);
    const send = ctx.createGain();
    send.gain.value = 0.25;
    out.connect(send).connect(this.eng.reverb);
    this.current = out;

    let t = ctx.currentTime + 0.01;
    for (const note of phrase) {
      t += (note.gap ?? 0) / rate;
      const d = note.d / rate;
      const vel = note.v ?? 0.8;
      const midi = root + transpose + note.s;
      if (note.breath) breath(this.eng, t, midiToFreq(midi) * 0.5, d, vel, out);
      else
        this.whistle(
          t,
          midi,
          d,
          vel,
          out,
          note.to !== undefined ? root + transpose + note.to : undefined,
          note.trill,
        );
      t += d;
    }
    const end = t + 0.3;
    setTimeout(() => out.disconnect(), (end - ctx.currentTime + 1) * 1000);
  }

  private whistle(
    t: number,
    midi: number,
    d: number,
    vel: number,
    out: AudioNode,
    toMidi?: number,
    trill?: number,
  ): void {
    const ctx = this.eng.ctx as AudioContext;
    const f = midiToFreq(midi);
    const g = ctx.createGain();
    g.connect(out);
    const peak = 0.26 * vel;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + Math.min(0.015, d / 3));
    g.gain.setValueAtTime(peak * 0.85, t + Math.max(0.02, d - 0.03));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.04);
    const end = t + d + 0.08;

    const main = ctx.createOscillator();
    main.type = 'triangle';
    const air = ctx.createOscillator();
    air.type = 'sine';
    const airGain = ctx.createGain();
    airGain.gain.value = 0.5;

    for (const o of [main, air]) {
      const mult = o === air ? 2 : 1;
      o.frequency.setValueAtTime(f * mult, t);
      if (toMidi !== undefined)
        o.frequency.exponentialRampToValueAtTime(midiToFreq(toMidi) * mult, t + d);
      if (trill) {
        const up = midiToFreq(midi + trill) * mult;
        for (let k = 0.06, i = 0; k < d; k += 0.06, i++)
          o.frequency.setValueAtTime(i % 2 === 0 ? up : f * mult, t + k);
      }
    }
    main.connect(g);
    air.connect(airGain).connect(g);

    // Vibrato de flûte qui s'installe après l'attaque.
    const vib = ctx.createOscillator();
    vib.frequency.value = 6.5;
    const vibAmt = ctx.createGain();
    vibAmt.gain.setValueAtTime(0, t);
    vibAmt.gain.linearRampToValueAtTime(d > 0.2 ? 18 : 4, t + Math.min(0.2, d));
    vib.connect(vibAmt);
    vibAmt.connect(main.detune);
    vibAmt.connect(air.detune);

    for (const o of [main, air, vib]) {
      o.start(t);
      o.stop(end);
    }
    // Petit souffle d'attaque, typique du sifflet.
    breath(this.eng, t, Math.min(9000, f * 2), Math.min(0.05, d), vel * 0.35, out);
  }
}
