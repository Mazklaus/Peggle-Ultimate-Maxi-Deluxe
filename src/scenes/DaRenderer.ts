/**
 * Rendu d'un Astre par le rig de la DA : l'acteur de la DA dessine dans un canvas, affiché
 * comme une image Phaser (texture rafraîchie chaque frame). La réaction jouée est celle que
 * notre cerveau a choisie (voir src/companions/da/index.ts).
 */
import Phaser from 'phaser';
import { DA_RIG, isDaReaction, type DaActor } from '../companions/da';
import type { ReactionDef } from '../core/companion/types';

/** Taille du canvas (px) et position du centre du corps dedans (place pour bras et particules). */
const CANVAS = 320;
const CENTER = { x: CANVAS / 2, y: CANVAS * 0.58 };

let textureSeq = 0;

export interface DaPlaying {
  def: ReactionDef;
  elapsed: number;
}

export class DaRenderer {
  private readonly actor: DaActor;
  private readonly key: string;
  private readonly texture: Phaser.Textures.CanvasTexture;
  private image: Phaser.GameObjects.Image;
  private now = 0;
  private lastDef: ReactionDef | null = null;
  private lastElapsed = 0;
  private sleeping = false;

  constructor(scene: Phaser.Scene, astreKey: string) {
    this.actor = new DA_RIG.AstreActor(astreKey);
    this.key = `da-astre-${astreKey}-${++textureSeq}`;
    const tex = scene.textures.createCanvas(this.key, CANVAS, CANVAS);
    if (!tex) throw new Error('Canvas de l’Astre indisponible');
    this.texture = tex;
    this.image = this.makeImage(scene);
  }

  private makeImage(scene: Phaser.Scene): Phaser.GameObjects.Image {
    return scene.add.image(0, 0, this.key).setOrigin(CENTER.x / CANVAS, CENTER.y / CANVAS);
  }

  /** Change de scène (calque au-dessus des overlays) : seule l'image est recréée. */
  reparent(scene: Phaser.Scene): void {
    const { depth, visible } = this.image;
    this.image.destroy();
    this.image = this.makeImage(scene).setDepth(depth).setVisible(visible);
  }

  setDepth(depth: number): void {
    this.image.setDepth(depth);
  }

  setVisible(on: boolean): void {
    this.image.setVisible(on);
  }

  /**
   * Aligne l'acteur de la DA sur la décision du cerveau : nouvelle réaction -> on la joue
   * depuis son début ; pas de réaction -> l'acteur finit la sienne (enchaînements « then »,
   * suivi en boucle) puis revient à son idle.
   */
  sync(playing: DaPlaying | null, phase: string, sleeping: boolean): void {
    const a = this.actor;
    if (sleeping !== this.sleeping) {
      this.sleeping = sleeping;
      if (sleeping) a.trigger('sommeil', this.now);
      else a.reaction = null;
    }
    if (playing && isDaReaction(playing.def)) {
      const restarted = playing.def !== this.lastDef || playing.elapsed < this.lastElapsed;
      if (restarted) {
        const r = playing.def.da;
        a.reaction = r;
        a.rStart = this.now - (playing.elapsed * 1000) / Math.max(0.01, a.d.tempo);
        a.rEv = playing.def.daEvent;
        a.firedFx = new Set();
        if (r.wake) a.awake = this.now;
      }
      this.lastElapsed = playing.elapsed;
    }
    this.lastDef = playing?.def ?? null;
    // En visée, plus de suivi d'orbe en boucle : retour à l'idle de l'Astre.
    if (!playing && phase === 'aiming' && a.reaction?.loop && a.rEv === 'suivi') a.reaction = null;
  }

  /**
   * Dessine l'Astre : (x, y) = centre du corps (monde), `look` = direction de l'orbe ou de la
   * visée (-1..1), `excitement` = jauge du cerveau (amplitude du vol).
   */
  render(
    dtSeconds: number,
    x: number,
    y: number,
    scale: number,
    look: { x: number; y: number } | null,
    excitement: number,
  ): void {
    const dt = dtSeconds * 1000;
    this.now += dt;
    const a = this.actor;
    a.target = look;
    a.exc = Math.max(a.exc ?? 0, excitement);
    a.update(this.now, dt);
    const ctx = this.texture.context;
    ctx.clearRect(0, 0, CANVAS, CANVAS);
    a.draw(ctx, CENTER.x, CENTER.y, 1);
    this.texture.refresh();
    this.image.setPosition(x, y).setScale(scale);
  }

  destroy(): void {
    this.image.destroy();
    this.texture.destroy();
  }
}
