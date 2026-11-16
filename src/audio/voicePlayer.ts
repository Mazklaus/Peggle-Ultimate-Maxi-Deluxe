/**
 * Interprète les phrases de voix des Astres (langue « astrale » sans mots) sur leur instrument-voix :
 * piccolo (Pip), tuba (Bourdon), deux clarinettes (Twi & Nkl), banjo (Volte), vibraphone (Mousse),
 * marimba + tic-tac (Horloge), clochettes (Grelot), harpe + chœur (Nuage-Lune).
 */
import { midiToFreq, pentatonicDegree } from '../core/audio/theory';
import type { Phrase, VoiceInstrument, VoiceNote, VoiceProfile } from '../core/audio/voice';
import type { AudioEngine } from './engine';
import { bell, breath, choir, harp, marimba, pluck, tick, vibes, wind } from './instruments';

/** Pan de la loge de l'Astre (marge droite) ; la seconde jumelle est un peu plus à gauche. */
const PAN = 0.55;

export class VoicePlayer {
  private current: GainNode[] = [];

  constructor(private readonly eng: AudioEngine) {}

  /** Coupe net (≈ 50 ms) la réplique en cours. */
  cut(): void {
    const ctx = this.eng.ctx;
    if (!ctx) return;
    for (const g of this.current) g.gain.setTargetAtTime(0, ctx.currentTime, 0.015);
    this.current = [];
  }

  /**
   * Joue une phrase avec la voix de `profile`. `transpose` = décalage (jauge d'excitation),
   * `rate` > 1 accélère le débit, `gain` = volume relatif.
   */
  play(
    phrase: Phrase,
    profile: VoiceProfile,
    transpose = 0,
    rate = 1,
    gain = 1,
    withHalo = true,
  ): void {
    const ctx = this.eng.ctx;
    if (!ctx) return;
    this.current = [];
    const g = gain * (profile.gain ?? 1);
    const end = this.voice(phrase, profile.instrument, profile.root + transpose, rate, g, PAN, 0);
    if (profile.duet) {
      // L'autre jumelle répond (ou coupe la parole) une tierce au-dessus.
      this.voice(
        phrase,
        profile.instrument,
        profile.root + transpose + profile.duet.interval,
        rate,
        g * 0.8,
        0.15,
        profile.duet.delay,
      );
    }
    if (withHalo && profile.halo) this.halo(profile, end - ctx.currentTime);
  }

  /** Programme une voix ; renvoie l'instant de fin. */
  private voice(
    phrase: Phrase,
    inst: VoiceInstrument,
    root: number,
    rate: number,
    gain: number,
    pan: number,
    delay: number,
  ): number {
    const ctx = this.eng.ctx as AudioContext;
    const out = this.bus(gain, pan);
    let t = ctx.currentTime + 0.01 + delay;
    for (const note of phrase) {
      t += (note.gap ?? 0) / rate;
      const d = note.d / rate;
      this.note(inst, note, t, d, root, out);
      t += d;
    }
    const end = t + 0.3;
    setTimeout(() => out.disconnect(), (end - ctx.currentTime + 2) * 1000);
    return end;
  }

  private bus(gain: number, pan: number): GainNode {
    const ctx = this.eng.ctx as AudioContext;
    const out = ctx.createGain();
    out.gain.value = gain;
    const p = ctx.createStereoPanner?.();
    if (p) {
      p.pan.value = pan;
      out.connect(p).connect(this.eng.buses.voice);
    } else out.connect(this.eng.buses.voice);
    const send = ctx.createGain();
    send.gain.value = 0.25;
    out.connect(send).connect(this.eng.reverb);
    this.current.push(out);
    return out;
  }

  private note(
    inst: VoiceInstrument,
    note: VoiceNote,
    t: number,
    d: number,
    root: number,
    out: GainNode,
  ): void {
    const vel = note.v ?? 0.8;
    const midi = root + note.s;
    const to = note.to !== undefined ? root + note.to : undefined;
    const opts = { out };
    if (note.tick) return tick(this.eng, t, vel, note.s >= 0, opts);
    if (note.breath)
      return breath(
        this.eng,
        t,
        Math.min(4000, midiToFreq(midi) * (inst === 'tuba' ? 4 : 0.5)),
        d,
        vel,
        out,
      );
    switch (inst) {
      case 'piccolo':
        return this.whistle(t, midi, d, vel, out, to, note.trill);
      case 'tuba':
      case 'clarinet':
        return wind(this.eng, inst, t, midi, vel, d, opts, { toMidi: to, trill: note.trill });
      case 'banjo':
        if (note.trill)
          return this.strikes(
            t,
            d,
            midi,
            vel,
            (tt, m, v) => pluck(this.eng, tt, m, v, opts, 0.08),
            note.trill,
          );
        return pluck(this.eng, t, midi, vel, opts, d, to);
      default: {
        const strike = this.striker(inst, opts);
        if (to !== undefined) return this.arpeggio(t, d, midi, to, vel, strike);
        if (note.trill) return this.strikes(t, d, midi, vel, strike, note.trill);
        return strike(t, midi, vel);
      }
    }
  }

  /** Instrument frappé : une note = un coup. */
  private striker(
    inst: VoiceInstrument,
    opts: { out: GainNode },
  ): (t: number, midi: number, vel: number) => void {
    switch (inst) {
      case 'marimba':
        return (t, m, v) => marimba(this.eng, t, m, v * 0.9, opts);
      case 'vibraphone':
        return (t, m, v) => vibes(this.eng, t, m, v, opts, 1.1);
      case 'bells':
        return (t, m, v) => bell(this.eng, t, m, v * 1.3, opts, 0.7);
      default:
        return (t, m, v) => harp(this.eng, t, m, v * 1.4, opts);
    }
  }

  /** Un glissando sur un instrument frappé devient un arpège pentatonique rapide. */
  private arpeggio(
    t: number,
    d: number,
    from: number,
    to: number,
    vel: number,
    strike: (t: number, m: number, v: number) => void,
  ): void {
    const steps = Math.max(2, Math.min(7, Math.round(Math.abs(to - from) / 2.4)));
    for (let i = 0; i <= steps; i++) {
      const target = from + ((to - from) * i) / steps;
      // on se cale sur la pentatonique de ré la plus proche
      const deg = Math.round(((target - 62) / 12) * 5);
      strike(t + (d * i) / (steps + 1), pentatonicDegree(62, deg), vel * (0.8 + (0.2 * i) / steps));
    }
  }

  /** Une trille sur un instrument frappé devient un trémolo entre deux notes. */
  private strikes(
    t: number,
    d: number,
    midi: number,
    vel: number,
    strike: (t: number, m: number, v: number) => void,
    trill: number,
  ): void {
    for (let k = 0, i = 0; k < d; k += 0.075, i++)
      strike(t + k, i % 2 === 0 ? midi : midi + trill, vel * 0.8);
  }

  /** Couleur sous la réplique : tic-tac, chœur lointain ou frisson de grelots. */
  private halo(profile: VoiceProfile, seconds: number): void {
    const ctx = this.eng.ctx as AudioContext;
    const out = this.bus(0.6, PAN);
    const t0 = ctx.currentTime + 0.01;
    if (profile.halo === 'ticktock') {
      for (let k = 0, i = 0; k < seconds; k += 0.5, i++)
        tick(this.eng, t0 + k, 0.35, i % 2 === 0, { out });
    } else if (profile.halo === 'choir') {
      choir(this.eng, t0, profile.root, 0.35, Math.max(0.8, seconds), { out, wet: 0.6 });
    } else if (profile.halo === 'jingle') {
      // Grelot tinte toujours un poil avant de parler
      for (let i = 0; i < 5; i++)
        bell(this.eng, t0 + i * 0.025, profile.root + 12 + (i % 2) * 4, 0.25, { out }, 0.25);
    }
    setTimeout(() => out.disconnect(), (seconds + 3) * 1000);
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
