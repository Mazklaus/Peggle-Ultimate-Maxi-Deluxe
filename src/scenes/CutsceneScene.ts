import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
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

export type CutsceneSequence = 'intro' | 'reveil_pip' | 'fin_ch1';

export interface CutsceneData {
  sequence: CutsceneSequence;
  /** Scène à lancer à la fin (ou au passage). */
  next: { scene: string; data?: object };
}

const FADE_MS = 300;
/** Scripts du DA, dans l'ordre (vignettes.js, le dernier, définit window.Vignettes). */
const SCRIPTS = ['astres-rig', 'astres-reactions-j2', 'gardienne', 'vignettes'] as const;

export class CutsceneScene extends Phaser.Scene {
  private shots: Shot[] = [];
  private index = 0;
  private start = 0;
  private ctx?: CanvasRenderingContext2D;
  private texture?: Phaser.Textures.CanvasTexture;
  private payload!: CutsceneData;
  private leaving = false;

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
    if ((window as unknown as { Vignettes?: unknown }).Vignettes) return;
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
    const { A, B } = api.create(this.ctx);
    const seq = this.payload.sequence;
    this.shots = seq === 'intro' ? A : seq === 'reveil_pip' ? B.slice(0, 1) : B.slice(1);
    this.add.image(0, 0, key).setOrigin(0);
    this.start = this.time.now;

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

  /** Clic sur l'image : plan suivant. */
  private nextShot(): void {
    if (this.index < this.shots.length - 1) {
      this.index += 1;
      this.start = this.time.now;
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
