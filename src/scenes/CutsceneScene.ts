import Phaser from 'phaser';
import { audio } from '../audio';
import { cutsceneCue } from '../core/audio/storyMusic';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { sequenceChapter, type CutsceneSequence } from '../core/story';
import { SCENES } from './keys';

/**
 * Vignettes sans texte (DA, vignettes-jalon1) : chaque plan est une fonction draw(t, dt)
 * en canvas 2D, rejouée telle quelle dans une CanvasTexture. Fondus de 300 ms entre plans,
 * « passer » au clic, à la touche Échap / Espace / Entrée.
 */

interface Shot {
  id: string;
  dur: number;
  draw(t: number, dt: number): void;
}

interface VignettesApi {
  create(ctx: CanvasRenderingContext2D): { A: Shot[]; B: Shot[] };
}

/** Vignettes du jalon 2 : CH2..CH8 = [R0 réveil, F1..F6 fin], FINAL = V1..V8. */
interface VignettesJ2Api {
  create(ctx: CanvasRenderingContext2D): Record<string, Shot[]> & { resetActors(): void };
}

export type { CutsceneSequence };

export interface CutsceneData {
  sequence: CutsceneSequence;
  /** Scène à lancer à la fin (ou au passage). */
  next: { scene: string; data?: object };
}

const FADE_MS = 300;
/** Scripts du DA, dans l'ordre (vignettes.js, le dernier, définit window.Vignettes). */
const SCRIPTS = [
  'astres-rig',
  'astres-reactions-j2',
  'gardienne',
  'veilleuse',
  'elements-decor',
  'vignettes',
  'vignettes-j2',
] as const;

/**
 * Plans de la séquence. Fin des ch. 2 à 7 : le plan F6 (retour carte) est laissé à la vraie
 * carte, dont la séquence de déblocage trace déjà le chemin (pas de doublon). Fin du ch. 8 :
 * suivie du final V1-V8.
 */
export function pickShots(
  seq: CutsceneSequence,
  j1: { A: Shot[]; B: Shot[] },
  j2: Record<string, Shot[]> | null,
): Shot[] {
  if (seq === 'intro') return j1.A;
  if (seq === 'reveil_pip') return j1.B.slice(0, 1);
  if (seq === 'fin_ch1') return j1.B.slice(1);
  const n = sequenceChapter(seq);
  const all = (n && j2?.[`CH${n}`]) || [];
  if (seq.startsWith('reveil_')) return all.slice(0, 1);
  const end = all.slice(1).filter((s) => s.id !== 'F6');
  return n === 8 ? [...end, ...(j2?.FINAL ?? [])] : end;
}

export class CutsceneScene extends Phaser.Scene {
  private shots: Shot[] = [];
  private index = 0;
  private start = 0;
  private ctx?: CanvasRenderingContext2D;
  private texture?: Phaser.Textures.CanvasTexture;
  private payload!: CutsceneData;
  private leaving = false;
  /** Remise à zéro des acteurs du DA entre deux plans (comme le lecteur du DA). */
  private resetActors: () => void = () => {};

  constructor() {
    super(SCENES.cutscene);
  }

  init(data: CutsceneData): void {
    this.payload = data;
    this.index = 0;
    this.leaving = false;
  }

  preload(): void {
    // Scripts classiques du DA (globals AstresRig, Gardienne, Vignettes), chargés une fois.
    // Déjà exécutés lors d'une cinématique précédente : on ne les recharge pas.
    if ((window as unknown as { VignettesJ2?: unknown }).VignettesJ2) return;
    // load.scripts (et non load.script en boucle) : exécution dans l'ordre de la liste,
    // les scripts dépendent les uns des autres (AstresRig d'abord).
    this.load.scripts(
      'da-scripts',
      SCRIPTS.map((name) => `da/${name}.js`),
    );
  }

  create(): void {
    const api = (window as unknown as { Vignettes?: VignettesApi }).Vignettes;
    if (!api) return this.finish();
    const key = 'cutscene-canvas';
    if (this.textures.exists(key)) this.textures.remove(key);
    const tex = this.textures.createCanvas(key, GAME_WIDTH, GAME_HEIGHT);
    if (!tex) return this.finish();
    this.texture = tex;
    this.ctx = tex.getContext();
    const seq = this.payload.sequence;
    const j2api = (window as unknown as { VignettesJ2?: VignettesJ2Api }).VignettesJ2;
    const j2 = sequenceChapter(seq) && j2api ? j2api.create(this.ctx) : null;
    this.resetActors = j2 ? () => j2.resetActors() : () => {};
    this.shots = pickShots(seq, sequenceChapter(seq) ? { A: [], B: [] } : api.create(this.ctx), j2);
    if (this.shots.length === 0) return this.finish();
    this.add.image(0, 0, key).setOrigin(0);
    this.start = this.time.now;
    this.onShotStart();

    const skip = this.add
      .text(GAME_WIDTH - 24, GAME_HEIGHT - 24, '▶▶', {
        fontFamily: 'sans-serif',
        fontSize: '26px',
        color: '#F4F1FF',
        backgroundColor: '#1B2350',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(1)
      .setAlpha(0.8)
      .setInteractive({ useHandCursor: true });
    skip.on('pointerup', () => this.finish());
    this.input.on(
      'pointerup',
      (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        if (over.length === 0) this.nextShot();
      },
    );
    const kb = this.input.keyboard;
    kb?.on('keydown-ESC', () => this.finish());
    kb?.on('keydown-ENTER', () => this.finish());
    kb?.on('keydown-SPACE', () => this.nextShot());
  }

  update(time: number, delta: number): void {
    const ctx = this.ctx;
    const shot = this.shots[this.index];
    if (!ctx || !shot || this.leaving) return;
    let t = time - this.start;
    if (t > shot.dur) {
      if (this.index < this.shots.length - 1) {
        this.index += 1;
        this.start = time;
        t = 0;
        this.resetActors();
        this.onShotStart();
      } else {
        this.finish();
        return;
      }
    }
    const current = this.shots[this.index] as Shot;
    ctx.save();
    current.draw(t, Math.min(50, delta));
    ctx.restore();
    const fadeIn = this.index > 0 ? Phaser.Math.Clamp(1 - t / FADE_MS, 0, 1) : 0;
    const fadeOut = Phaser.Math.Clamp((t - current.dur + FADE_MS) / FADE_MS, 0, 1);
    const f = Math.max(fadeIn, fadeOut);
    if (f > 0) {
      ctx.fillStyle = `rgba(5,8,20,${f})`;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
    this.texture?.refresh();
  }

  /** Musique du plan qui commence (thème du phare, silence, final de la Veilleuse). */
  private onShotStart(): void {
    const shot = this.shots[this.index];
    if (!shot) return;
    const cue = cutsceneCue(this.payload.sequence, shot.id, this.index);
    if (cue?.kind === 'phare') audio.music.start('phare', { astres: cue.astres });
    else if (cue?.kind === 'silence') audio.music.stop(1.2);
    else if (cue?.kind === 'finale') audio.finale();
  }

  /** Clic sur l'image : plan suivant. */
  private nextShot(): void {
    if (this.index < this.shots.length - 1) {
      this.index += 1;
      this.start = this.time.now;
      this.resetActors();
      this.onShotStart();
    } else this.finish();
  }

  private finish(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(FADE_MS, 5, 8, 20);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(this.payload.next.scene, this.payload.next.data);
    });
    if (!this.ctx) this.scene.start(this.payload.next.scene, this.payload.next.data);
  }
}
