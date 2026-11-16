/**
 * Moteur Web Audio : contexte, bus (musique / effets / voix), réverbération générée,
 * compresseur de sécurité et « mode doux ». Créé paresseusement au premier geste du joueur.
 */
import { MIX, sliderToGain } from '../core/audio/mix';

export type BusName = 'music' | 'sfx' | 'voice';

/** Position par défaut des curseurs (celle de la sauvegarde neuve). */
const DEFAULT_SLIDER = 0.8;
const DEFAULT_VOLUMES: Record<BusName, number> = {
  music: DEFAULT_SLIDER,
  sfx: DEFAULT_SLIDER,
  voice: DEFAULT_SLIDER,
};

/** Gain d'un bus pour une position de curseur : au défaut, on retrouve exactement le niveau du mixage. */
export function busGain(bus: BusName, slider: number): number {
  return (MIX.bus[bus] * sliderToGain(slider)) / sliderToGain(DEFAULT_SLIDER);
}

export class AudioEngine {
  ctx: AudioContext | null = null;
  private masterGain!: GainNode;
  private soft!: BiquadFilterNode;
  readonly buses = {} as Record<BusName, GainNode>;
  /** Envoi vers la réverbération (nappe céleste). */
  reverb!: GainNode;
  private noise?: AudioBuffer;
  /** Effacement automatique de la voix quand les rebonds s'enchaînent (voir MIX.density). */
  private voiceAuto!: GainNode;
  private mono = false;
  private softOn = false;
  private volumes = { ...DEFAULT_VOLUMES };
  private muted = false;

  /** Crée le contexte (au premier clic : règle des navigateurs) et le relance s'il est suspendu. */
  unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) this.build();
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  setVolume(bus: BusName, value: number): void {
    this.volumes[bus] = Math.min(1, Math.max(0, value));
    if (this.ctx)
      this.buses[bus].gain.setTargetAtTime(this.volumes[bus], this.ctx.currentTime, 0.05);
  }

  getVolume(bus: BusName): number {
    return this.volumes[bus];
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx) this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Son mono (accessibilité) : tout est replié sur un seul canal. */
  setMono(on: boolean): void {
    this.mono = on;
    if (!this.ctx) return;
    this.masterGain.channelCount = on ? 1 : 2;
    this.masterGain.channelCountMode = on ? 'explicit' : 'max';
  }

  /** Efface la voix (facteur 0-1) puis la laisse revenir en `recover` secondes. */
  setVoiceAuto(factor: number, recover: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const g = this.voiceAuto.gain;
    const t = ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(factor, t, 0.03);
    g.setTargetAtTime(1, t + recover, 0.25);
  }

  /** Mode doux (accessibilité) : coupe les aigus agressifs. */
  setSoftMode(on: boolean): void {
    this.softOn = on;
    if (this.ctx) this.soft.frequency.setTargetAtTime(on ? 3200 : 20000, this.ctx.currentTime, 0.1);
  }

  get isSoft(): boolean {
    return this.softOn;
  }

  /** Baisse temporaire de la musique (ducking) pendant les longues chaînes ou une réplique. */
  duckMusic(amount: number, seconds: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const g = this.buses.music.gain;
    const t = ctx.currentTime;
    g.cancelScheduledValues(t);
    const level = busGain('music', this.volumes.music);
    g.setTargetAtTime(level * (1 - amount), t, 0.04);
    g.setTargetAtTime(level, t + seconds, 0.3);
  }

  /** Tampon de bruit blanc partagé (souffles, percussions, scintillements). */
  noiseBuffer(): AudioBuffer {
    const ctx = this.ctx as AudioContext;
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noise;
  }

  private build(): void {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.005;
    comp.release.value = 0.2;

    this.soft = ctx.createBiquadFilter();
    this.soft.type = 'lowpass';
    this.soft.frequency.value = 20000;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.9;
    this.masterGain.connect(this.soft).connect(comp).connect(ctx.destination);

    // Voix : effacement automatique + compresseur doux, pour ne jamais saturer le mix.
    this.voiceAuto = ctx.createGain();
    const voiceComp = ctx.createDynamicsCompressor();
    voiceComp.threshold.value = -22;
    voiceComp.knee.value = 10;
    voiceComp.ratio.value = 5;
    voiceComp.attack.value = 0.004;
    voiceComp.release.value = 0.15;
    this.voiceAuto.connect(voiceComp).connect(this.masterGain);

    for (const bus of ['music', 'sfx', 'voice'] as BusName[]) {
      const g = ctx.createGain();
      g.gain.value = busGain(bus, this.volumes[bus]);
      g.connect(bus === 'voice' ? this.voiceAuto : this.masterGain);
      this.buses[bus] = g;
    }
    if (this.mono) this.setMono(true);
    if (this.softOn) this.soft.frequency.value = 3200;

    const convolver = ctx.createConvolver();
    convolver.buffer = this.impulse(2.8);
    this.reverb = ctx.createGain();
    this.reverb.gain.value = 0.35;
    this.reverb.connect(convolver).connect(this.masterGain);
  }

  /** Réponse impulsionnelle stéréo synthétique : grand espace doux. */
  private impulse(seconds: number): AudioBuffer {
    const ctx = this.ctx as AudioContext;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    return buf;
  }
}
