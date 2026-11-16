/**
 * Module audio de « Ricochet Céleste » : 100 % synthèse Web Audio, aucun fichier.
 *
 * Utilisation :
 *   import { audio } from './audio';
 *   audio.unlock();                 // au premier clic (règle des navigateurs)
 *   audio.onGameEvent('gros_coup'); // noms du bus d'événements du plan de production
 *   audio.crystalHit('heart');      // ou via l'événement 'cristal_allume' { kind }
 *   audio.music.start('ch1');
 */
import { Excitation, excitationLevel } from '../core/audio/excitation';
import {
  INITIAL_MUSIC_STATE,
  layersFor,
  nextMusicState,
  type MusicCue,
  type MusicState,
} from '../core/audio/musicState';
import { CHAPTER_ASTRE, VOICES } from '../core/audio/astres';
import { CHAPTER_TRACKS, phareTrack, veilleuseFinale } from '../core/audio/chapters';
import {
  normalizeAstreId,
  reactionIndex,
  type CompanionLike,
  type ReactionCue,
} from '../core/audio/reactionMap';
import { CH1_TRACK, JINGLES, type Jingle, type JingleName, type Track } from '../core/audio/score';
import { chainNote, midiToFreq, pentatonicDegree } from '../core/audio/theory';
import { COMPANION_ROSTER } from '../companions';
import { HitDensity, MIX, type AudioSettings } from '../core/audio/mix';
import { MODE_JINGLES, MODE_TRACKS, dailyTrack } from '../core/audio/modes';
import {
  CUE_PRIORITY,
  PIP_VOICE,
  phraseDuration,
  pickVariant,
  type VoiceCue,
  type VoiceProfile,
} from '../core/audio/voice';
import { VoiceGate } from '../core/audio/voiceGate';
import { AudioEngine, type BusName } from './engine';
import { bell, celesta, cymbal, playInstrument, woodTick } from './instruments';
import { MusicPlayer } from './music';
import { VoicePlayer } from './voicePlayer';

export type CrystalKind = 'heart' | 'common' | 'bonus' | 'power' | 'wall';

/** Données facultatives portées par les événements du bus. */
export interface GameEventData {
  kind?: CrystalKind;
  count?: number;
  reaction?: string;
  variant?: number;
  astre?: string;
}

const VOICE_CUES = new Set<string>(Object.keys(CUE_PRIORITY));
const isVoiceCue = (s: string): s is VoiceCue => VOICE_CUES.has(s);

/** Événements du plan qui déclenchent directement une réplique de l'Astre. */
const EVENT_VOICE: Record<string, VoiceCue> = {
  tir_lance: 'tir_lance',
  gros_coup: 'gros_coup',
  chaine_longue: 'chaine_longue',
  rate: 'rate',
  orbe_recupere: 'orbe_recupere',
  pouvoir_active: 'pouvoir_active',
  presque: 'presque',
  dernier_coeur: 'dernier_coeur',
  dernier_orbe: 'dernier_orbe',
  final_ralenti: 'final_ralenti',
  victoire: 'victoire',
  echec: 'echec',
  inactivite: 'inactivite',
  orbe_descend: 'orbe_descend',
  orbe_proche_coeur: 'orbe_proche_coeur',
  tir_moyen: 'tir_moyen',
  orbe_coincee: 'orbe_coincee',
  orbe_debloquee: 'orbe_debloquee',
};

/** Morceaux disponibles : 'ch1' à 'ch8' ; le phare se construit selon le nombre d'Astres réveillés. */
const TRACKS: Record<string, Track> = { ch1: CH1_TRACK, ...CHAPTER_TRACKS };

class MusicControl {
  constructor(
    private readonly dir: AudioDirector,
    private readonly player: MusicPlayer,
  ) {}

  /**
   * Lance un morceau : 'ch1' à 'ch8', ou 'phare' (hub) avec `astres` = nombre d'Astres réveillés
   * (0 = boîte à musique seule, 8 = thème complet). Le prologue reprend le chapitre 1.
   * Modes : 'defi', 'duel', 'quotidien' (variante du jour, `date` facultative).
   */
  start(id: string, options: { astres?: number; date?: Date } = {}): void {
    this.dir.engine.unlock();
    if (id === 'phare') {
      this.player.start(phareTrack(options.astres ?? 0), [1]);
      return;
    }
    const track =
      id === 'quotidien' ? dailyTrack(options.date) : (TRACKS[id] ?? MODE_TRACKS[id] ?? CH1_TRACK);
    this.player.start(track, layersFor(this.dir.musicState));
  }

  stop(fade = 0.8): void {
    this.player.stop(fade);
  }

  get playing(): string | null {
    return this.player.playing;
  }
}

export class AudioDirector {
  readonly engine = new AudioEngine();
  private readonly player = new MusicPlayer(this.engine);
  private readonly voice = new VoicePlayer(this.engine);
  readonly music = new MusicControl(this, this.player);
  private readonly gate = new VoiceGate();
  private readonly excitation = new Excitation();
  private profile: VoiceProfile = PIP_VOICE;
  /** Réactions animées connues (id -> réplique), alimentées par registerCompanion. */
  private reactions = new Map<string, ReactionCue>();
  private lastVariant = new Map<VoiceCue, number>();
  musicState: MusicState = { ...INITIAL_MUSIC_STATE };
  private chain = 0;
  private descendPlayed = false;
  /** Dès que l'animation émet 'astre_cri', la voix suit l'animation et plus les événements bruts. */
  private followAnimation = false;
  private riser: GainNode | null = null;

  private readonly density = new HitDensity();

  constructor() {
    // Les cris animés de tous les Astres jouables sont reconnus d'office.
    for (const c of COMPANION_ROSTER) if (c.def) this.registerCompanion(c.def);
  }

  /** Applique les réglages de l'écran Options (volumes 0-1, mode doux, mono). */
  applySettings(s: Partial<AudioSettings>): void {
    if (s.music !== undefined) this.engine.setVolume('music', s.music);
    if (s.sfx !== undefined) this.engine.setVolume('sfx', s.sfx);
    if (s.voice !== undefined) this.engine.setVolume('voice', s.voice);
    if (s.soft !== undefined) this.engine.setSoftMode(s.soft);
    if (s.mono !== undefined) this.engine.setMono(s.mono);
  }

  unlock(): void {
    this.engine.unlock();
  }

  /**
   * Fait connaître les réactions animées d'un Astre (src/companions/*.ts) : ses cris 'astre_cri'
   * jouent alors la bonne réplique, avec la variante qui correspond à l'animation.
   */
  registerCompanion(def: CompanionLike): void {
    for (const [id, cue] of reactionIndex(def, VOICE_CUES)) this.reactions.set(id, cue);
  }

  /** Choisit la voix de l'Astre actif ('pip', 'bourdon', 'twi_nkl', 'volte', 'mousse', 'horloge', 'grelot', 'nuage_lune'). */
  setAstre(id: string): void {
    const voice = VOICES[normalizeAstreId(id)];
    if (voice && voice !== this.profile) {
      this.profile = voice;
      this.lastVariant.clear();
    }
  }

  get astre(): string {
    return this.profile.astre;
  }

  setVolume(bus: BusName, value: number): void {
    this.engine.setVolume(bus, value);
  }

  setMuted(muted: boolean): void {
    this.engine.setMuted(muted);
  }

  setSoftMode(on: boolean): void {
    this.engine.setSoftMode(on);
  }

  /** Point d'entrée unique : à brancher sur le bus d'événements (`gameEvents.onAny`). */
  onGameEvent(name: string, payload: unknown = {}): void {
    if (!this.engine.ctx) return;
    const data = (payload ?? {}) as GameEventData;
    switch (name) {
      case 'niveau_debut': {
        const p = payload as { chapter?: number; mode?: string };
        const chapter = p.chapter ?? 1;
        const astre = CHAPTER_ASTRE[chapter];
        if (astre) this.setAstre(astre);
        if (p.mode === 'defi' || p.mode === 'duel' || p.mode === 'quotidien') {
          if (p.mode === 'quotidien') this.modeJingle('quotidien_ouverture');
          return this.levelStart(p.mode);
        }
        return this.levelStart(`ch${Math.max(1, chapter)}`);
      }
      case 'duel_tour':
        return this.modeJingle(
          (payload as { joueur?: number }).joueur === 2 ? 'duel_tour_j2' : 'duel_tour_j1',
        );
      case 'duel_fin':
        this.player.stop(0.4);
        return this.modeJingle('duel_victoire');
      case 'defi_reussi':
      case 'defi_rate':
        return this.modeJingle(name);
      case 'tir_lance':
        this.chain = 0;
        this.descendPlayed = false;
        this.launch();
        this.updateMusic('tir_lance');
        // Fiche de Pip : il ne commente le départ qu'environ 1 tir sur 3.
        if (Math.random() < 0.34) this.say('tir_lance');
        return;
      case 'cristal_allume':
        return this.crystalHit(data.kind ?? 'common');
      case 'mur_touche':
        return this.wallHit();
      case 'cristaux_brises':
        this.shatter(data.count ?? 0);
        return this.updateMusic('fin_tir');
      case 'orbe_recupere':
        this.jingle('orbe_recupere');
        this.say('orbe_recupere');
        return this.updateMusic('fin_tir');
      case 'dernier_coeur':
        this.updateMusic('dernier_coeur');
        return this.say('dernier_coeur');
      case 'final_ralenti':
        this.updateMusic('final_ralenti');
        this.startRiser();
        return this.say('final_ralenti');
      case 'victoire':
        this.updateMusic('victoire');
        this.stopRiser(true);
        this.jingle('victoire');
        this.player.stop(0.2);
        return this.say('victoire', 0.6);
      case 'echec':
        this.updateMusic('echec');
        this.stopRiser(false);
        this.jingle('echec');
        this.player.stop(1.2);
        return this.say('echec', 0.3);
      case 'astre_cri': {
        this.followAnimation = true;
        if (data.astre) this.setAstre(data.astre);
        const reaction = data.reaction ?? '';
        const known = this.reactions.get(reaction);
        if (known) this.say(known.cue, 0, known.variant, true);
        else if (isVoiceCue(reaction)) this.say(reaction, 0, data.variant, true);
        return;
      }
      case 'pouvoir_active':
        if (data.astre) this.setAstre(data.astre);
        return this.say('pouvoir_active');
      case 'chaine_longue':
        this.engine.duckMusic(MIX.chainDuck.amount, 1.5);
        return this.say('chaine_longue');
      default: {
        const cue = EVENT_VOICE[name] ?? (isVoiceCue(name) ? name : undefined);
        if (cue) this.say(cue);
      }
    }
  }

  /** Début de niveau : remet la musique en couche 1 et la chaîne à zéro ('ch1' à 'ch8'). */
  levelStart(trackId = 'ch1'): void {
    this.musicState = nextMusicState(this.musicState, 'niveau_debut');
    this.chain = 0;
    this.gate.reset();
    this.excitation.reset(this.engine.now());
    this.stopRiser(false);
    this.music.start(trackId);
  }

  /** Cristal allumé : note pentatonique suivante de la chaîne du tir + « pip ! » de l'Astre. */
  crystalHit(kind: CrystalKind): void {
    const eng = this.engine;
    if (!eng.ctx) return;
    // Cristal-mur indestructible : simple tic, il ne fait pas monter la mélodie.
    if (kind === 'wall') return this.wallHit();
    const t = eng.now() + 0.005;
    const note = chainNote(this.chain);
    this.chain += 1;
    const out = { out: eng.buses.sfx, wet: 0.3, pan: (Math.random() - 0.5) * 0.6 };
    switch (kind) {
      case 'heart':
        // plus chaud et rond + petit souffle de chœur : le « battement » de la constellation
        celesta(eng, t, note.midi, 0.9, out, 1.4);
        playInstrument(eng, 'choir', t, note.midi - 12, 0.35, 0.25, {
          out: eng.buses.sfx,
          wet: 0.5,
        });
        break;
      case 'bonus':
        [0, 4, 7].forEach((s, i) => bell(eng, t + i * 0.035, note.midi + s, 0.8, out, 1.2));
        break;
      case 'power':
        celesta(eng, t, note.midi, 0.8, out);
        this.say('pouvoir_active');
        break;
      default:
        celesta(eng, t, note.midi, 0.75, out);
    }
    for (const h of note.harmony) celesta(eng, t, h, 0.4, out);
    if (this.chain >= MIX.chainDuck.chainFrom)
      eng.duckMusic(MIX.chainDuck.amount, MIX.chainDuck.seconds);
    // Les rebonds passent avant la voix : plus ils s'enchaînent, plus l'Astre s'efface.
    this.density.hit(eng.now());
    eng.setVoiceAuto(this.density.voiceFactor(eng.now()), MIX.density.recover);

    // L'Astre s'excite : ses « pip » montent et s'accélèrent avec la jauge.
    const level = excitationLevel(this.excitation.hit(eng.now()));
    const everyHit = level > 0 || this.chain % 2 === 1;
    if (everyHit) this.pip(level);
  }

  /** Rebond sur un mur : tic de bois sans hauteur. */
  wallHit(): void {
    if (!this.engine.ctx) return;
    woodTick(this.engine, this.engine.now(), 0.6, { out: this.engine.buses.sfx, wet: 0.1 });
  }

  /** Fin de tir : les cristaux allumés se brisent en paillettes de verre (jamais de casse). */
  shatter(count: number): void {
    const eng = this.engine;
    if (!eng.ctx || count <= 0) return;
    const n = Math.min(count, 18);
    const t0 = eng.now();
    for (let i = 0; i < n; i++) {
      const midi = pentatonicDegree(86, Math.floor(Math.random() * 8));
      bell(
        eng,
        t0 + (i / n) * 0.45 + Math.random() * 0.03,
        midi,
        0.25 + 0.2 * Math.random(),
        {
          out: eng.buses.sfx,
          wet: 0.45,
          pan: Math.random() * 1.2 - 0.6,
        },
        0.5,
      );
    }
  }

  /** Suivi du vol : `yRatio` = hauteur de l'orbe (0 en haut, 1 en bas). Déclenche la crispation une fois par tir. */
  flight(yRatio: number): void {
    if (this.descendPlayed || yRatio < 0.7) return;
    this.descendPlayed = true;
    // La crispation est une pose continue de l'Astre (pas un cri animé) : la voix la joue toujours.
    this.say('orbe_descend', 0, undefined, true);
  }

  /** Joue un jingle par son nom. */
  jingle(name: JingleName): void {
    this.playJingle(JINGLES[name], 'sfx');
  }

  /**
   * Final de l'aventure (réveil de la Grande Veilleuse) : silence, explosion orchestrale,
   * berceuse à plusieurs voix, puis boîte à musique et piccolo. Renvoie sa durée en secondes.
   */
  finale(): number {
    this.player.stop(0.5);
    this.stopRiser(false);
    const j = veilleuseFinale();
    this.playJingle(j, 'music');
    return Math.max(...j.events.map((e) => e.beat + e.beats)) * (60 / j.bpm);
  }

  /** Jingle des modes : 'duel_tour_j1', 'duel_tour_j2', 'duel_victoire', 'defi_reussi', 'defi_rate', 'quotidien_ouverture'. */
  modeJingle(name: string): void {
    const j = MODE_JINGLES[name];
    if (j) this.playJingle(j, 'sfx', j.pan);
  }

  private playJingle(j: Jingle, bus: 'sfx' | 'music', pan = 0): void {
    const eng = this.engine;
    if (!eng.ctx) return;
    const beat = 60 / j.bpm;
    const t0 = eng.now() + 0.02;
    // Mode doux : les explosions orchestrales sont jouées moins fort.
    const soft = eng.isSoft ? 0.6 : 1;
    for (const ev of j.events) {
      playInstrument(
        eng,
        ev.instrument,
        t0 + ev.beat * beat,
        ev.midi,
        ev.velocity * soft,
        ev.beats * beat,
        {
          out: eng.buses[bus],
          wet: 0.45,
          pan,
        },
      );
    }
  }

  /** Réplique de l'Astre (passe par l'arbitre pour ne jamais saturer). */
  say(cue: VoiceCue, delay = 0, variant?: number, fromAnimation = false): void {
    if (this.followAnimation && !fromAnimation && cue !== 'cristal') return;
    const eng = this.engine;
    if (!eng.ctx) return;
    const variants = this.profile.phrases[cue];
    if (variants.length === 0) return;
    const idx =
      variant !== undefined && variant >= 0
        ? variant % variants.length
        : pickVariant(variants.length, this.lastVariant.get(cue) ?? -1);
    const phrase = variants[idx];
    if (!phrase) return;
    const decision = this.gate.request(cue, eng.now() + delay, phraseDuration(phrase) + delay);
    if (decision === 'drop') return;
    if (decision === 'interrupt') this.voice.cut();
    this.lastVariant.set(cue, idx);
    const profile = this.profile;
    const run = (): void => this.voice.play(phrase, profile);
    if (delay > 0) setTimeout(run, delay * 1000);
    else run();
    if (cue !== 'cristal' && cue !== 'final_ralenti')
      eng.duckMusic(MIX.voiceDuck, phraseDuration(phrase));
  }

  /** Écoute directe d'une réplique (banc d'écoute) : sans arbitre ni changement de mode. */
  preview(cue: VoiceCue, variant = 0): void {
    const phrase = this.profile.phrases[cue][variant];
    if (!phrase || !this.engine.ctx) return;
    this.voice.cut();
    this.gate.reset();
    if (cue === 'cristal') this.voice.play(phrase, this.profile, 0, 1, 0.8, false);
    else this.voice.play(phrase, this.profile);
  }

  /** Change d'Astre actif (les profils des autres Astres arrivent au jalon 2). */
  setVoice(profile: VoiceProfile): void {
    this.profile = profile;
  }

  private pip(level: 0 | 1 | 2): void {
    const variants = this.profile.phrases.cristal;
    const phrase = variants[Math.floor(Math.random() * variants.length)];
    if (
      !phrase ||
      this.gate.request('cristal', this.engine.now(), phraseDuration(phrase)) === 'drop'
    )
      return;
    // basse : ré ; moyenne : une note plus haut et plus vite ; haute : trilles très aiguës
    const transpose = [0, 4, 7][level] ?? 0;
    const p = this.profile;
    // Twi et Nkl : « tu ! » / « ti ! », chacune son tour, sans écho.
    const solo = p.duet ? { ...p, duet: undefined } : p;
    const turn = p.duet && this.chain % 2 === 0 ? p.duet.interval : 0;
    this.voice.play(
      phrase,
      solo,
      transpose + turn + (this.chain % 3) * 2,
      1 + level * 0.4,
      0.55,
      false,
    );
  }

  private updateMusic(cue: MusicCue): void {
    this.musicState = nextMusicState(this.musicState, cue);
    const playing = this.player.playing;
    if (playing && !playing.startsWith('phare')) this.player.setLayers(layersFor(this.musicState));
  }

  /** Départ de l'orbe : « fwoosh » doux. */
  private launch(): void {
    const eng = this.engine;
    const ctx = eng.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.5;
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(2400, t + 0.18);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    const src = ctx.createBufferSource();
    src.buffer = eng.noiseBuffer();
    src.connect(bp).connect(g).connect(eng.buses.sfx);
    src.start(t, Math.random());
    src.stop(t + 0.35);
    celesta(eng, t + 0.02, 74, 0.5, { out: eng.buses.sfx, wet: 0.3 }, 0.6);
  }

  /**
   * Montée du final au ralenti : la musique se suspend sur une note tenue (chœur + cordes)
   * qui enfle et s'ouvre jusqu'à l'impact, puis l'explosion orchestrale de la victoire.
   */
  private startRiser(): void {
    const eng = this.engine;
    const ctx = eng.ctx;
    if (!ctx || this.riser) return;
    const t = ctx.currentTime;
    const dur = 6;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(eng.isSoft ? 0.55 : 1, t + 3.5);
    out.connect(eng.buses.sfx);
    this.riser = out;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.exponentialRampToValueAtTime(5000, t + 3.5);
    lp.connect(out);
    // note tenue (la, dominante de ré) qui appelle la résolution
    for (const m of [57, 69, 76, 81])
      playInstrument(eng, 'strings', t, m, 0.9, dur, { out: lp, wet: 0.5 });
    playInstrument(eng, 'choir', t, 69, 0.8, dur, { out: lp, wet: 0.6 });
    cymbal(eng, t + 0.5, 0.6, 4, { out, wet: 0.3 });
    // battement de cœur qui accélère : cristal-cœur, dernier battement
    let beat = t + 0.2;
    let gap = 0.7;
    while (beat < t + dur) {
      playInstrument(eng, 'pulse', beat, 45, 0.7, 0.3, { out, wet: 0.2 });
      beat += gap;
      gap = Math.max(0.18, gap * 0.85);
    }
  }

  private stopRiser(resolve: boolean): void {
    const ctx = this.engine.ctx;
    const r = this.riser;
    this.riser = null;
    if (!ctx || !r) return;
    r.gain.cancelScheduledValues(ctx.currentTime);
    r.gain.setTargetAtTime(0, ctx.currentTime, resolve ? 0.02 : 0.3);
    setTimeout(() => r.disconnect(), 3000);
  }

  /** Utile pour la page d'écoute : fréquence de la n-ième note de chaîne. */
  static chainFrequency(i: number): number {
    return midiToFreq(chainNote(i).midi);
  }
}

/** Instance unique partagée par tout le jeu. */
export const audio = new AudioDirector();
