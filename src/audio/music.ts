/**
 * Séquenceur de musique adaptative : lit une partition pas à pas avec une anticipation
 * de ~0,15 s (horloge Web Audio, pas de dérive), chaque couche passe par son propre gain
 * pour entrer et sortir en fondu.
 */
import type { MusicLayer, Track } from '../core/audio/score';
import type { AudioEngine } from './engine';
import { playInstrument } from './instruments';

const LOOKAHEAD = 0.15;
const TICK_MS = 25;
const LAYER_FADE = 0.5;

export class MusicPlayer {
  private track: Track | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextTime = 0;
  private layerGains = new Map<MusicLayer, GainNode>();
  private active = new Set<MusicLayer>([1]);
  private out: GainNode | null = null;

  constructor(private readonly eng: AudioEngine) {}

  get playing(): string | null {
    return this.track?.id ?? null;
  }

  /** Lance un morceau (les couches actives sont conservées). */
  start(track: Track, layers: MusicLayer[] = [1]): void {
    const ctx = this.eng.ctx;
    if (!ctx) return;
    if (this.track?.id === track.id && this.timer) {
      this.setLayers(layers);
      return;
    }
    this.stop(0.3);
    this.track = track;
    this.out = ctx.createGain();
    this.out.connect(this.eng.buses.music);
    this.layerGains.clear();
    this.active = new Set(layers);
    for (const l of [1, 2, 3] as MusicLayer[]) {
      const g = ctx.createGain();
      g.gain.value = this.active.has(l) ? 1 : 0;
      g.connect(this.out);
      this.layerGains.set(l, g);
    }
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  /** Arrête en fondu. */
  stop(fade = 0.8): void {
    const ctx = this.eng.ctx;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.track = null;
    const out = this.out;
    if (ctx && out) {
      out.gain.setTargetAtTime(0, ctx.currentTime, Math.max(0.01, fade / 4));
      setTimeout(() => out.disconnect(), (fade + 2.5) * 1000);
    }
    this.out = null;
  }

  /** Fait entrer / sortir les couches en fondu. Une liste vide coupe tout sans arrêter l'horloge. */
  setLayers(layers: MusicLayer[]): void {
    const ctx = this.eng.ctx;
    this.active = new Set(layers);
    if (!ctx) return;
    for (const [l, g] of this.layerGains) {
      g.gain.setTargetAtTime(this.active.has(l) ? 1 : 0, ctx.currentTime, LAYER_FADE / 3);
    }
  }

  get layers(): MusicLayer[] {
    return [...this.active].sort();
  }

  private tick(): void {
    const ctx = this.eng.ctx;
    const track = this.track;
    if (!ctx || !track) return;
    const stepDur = 60 / track.bpm / 4;
    // Après une mise en veille de l'onglet, on repart de maintenant au lieu de tout rattraper.
    if (this.nextTime < ctx.currentTime - 0.5) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      for (const ev of track.eventsAt(this.step)) {
        const out = this.layerGains.get(ev.layer);
        if (!out) continue;
        const wet = ev.instrument === 'kick' || ev.instrument === 'bass' ? 0.05 : 0.4;
        const pan = ev.instrument === 'harp' ? -0.3 : ev.instrument === 'strings' ? 0.3 : 0;
        playInstrument(
          this.eng,
          ev.instrument,
          this.nextTime,
          ev.midi,
          ev.velocity,
          ev.steps * stepDur,
          {
            out,
            wet,
            pan,
          },
        );
      }
      this.step += 1;
      this.nextTime += stepDur;
    }
  }
}
