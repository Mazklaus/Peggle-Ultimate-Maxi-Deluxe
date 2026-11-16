/**
 * Moteur Web Audio : contexte, bus (musique / effets / voix), réverbération générée,
 * compresseur de sécurité et « mode doux ». Créé paresseusement au premier geste du joueur.
 */
export type BusName = 'music' | 'sfx' | 'voice';

const DEFAULT_VOLUMES: Record<BusName, number> = { music: 0.55, sfx: 0.8, voice: 0.7 };

export class AudioEngine {
  ctx: AudioContext | null = null;
  private masterGain!: GainNode;
  private soft!: BiquadFilterNode;
  readonly buses = {} as Record<BusName, GainNode>;
  /** Envoi vers la réverbération (nappe céleste). */
  reverb!: GainNode;
  private noise?: AudioBuffer;
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

  /** Mode doux (accessibilité) : coupe les aigus agressifs. */
  setSoftMode(on: boolean): void {
    if (this.ctx) this.soft.frequency.setTargetAtTime(on ? 3200 : 20000, this.ctx.currentTime, 0.1);
  }

  /** Baisse temporaire de la musique (ducking) pendant les longues chaînes ou une réplique. */
  duckMusic(amount: number, seconds: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const g = this.buses.music.gain;
    const t = ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(this.volumes.music * (1 - amount), t, 0.04);
    g.setTargetAtTime(this.volumes.music, t + seconds, 0.3);
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

    for (const bus of ['music', 'sfx', 'voice'] as BusName[]) {
      const g = ctx.createGain();
      g.gain.value = this.volumes[bus];
      g.connect(this.masterGain);
      this.buses[bus] = g;
    }

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
