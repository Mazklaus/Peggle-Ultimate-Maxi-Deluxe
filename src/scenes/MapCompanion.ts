/**
 * L'Astre et la Gardienne sur la carte (specs UI/UX 3, validé GD) : la Gardienne se tient
 * sur l'étoile du niveau courant, l'Astre l'accompagne en sautillant d'étoile en étoile,
 * réagit au survol d'un niveau et s'endort si on traîne (cerveau commun des Astres).
 */
import Phaser from 'phaser';
import type { CompanionDef } from '../core/companion/types';
import { CompanionView } from './CompanionView';
import { drawGardienne } from './gardienne';

export type MapNodeState = 'locked' | 'open' | 'done';

/** Échelle de l'Astre sur la carte et placement autour de l'étoile. */
const MAP_ASTRE = { scale: 0.5 };
/** Places possibles de l'Astre autour de l'étoile : on garde la plus loin des autres étoiles. */
const ASTRE_SPOTS = [
  { dx: 30, dy: 8 },
  { dx: 30, dy: 34 },
  { dx: -58, dy: 10 },
  { dx: 6, dy: 40 },
  { dx: 30, dy: -24 },
];
const GARDIENNE = { dx: -20, dy: 6, scale: 0.55 };
const HOP_MS = 280;

export class MapCompanion {
  readonly view: CompanionView | null;
  private scene: Phaser.Scene;
  private gardienne: Phaser.GameObjects.Graphics;
  private feet: { x: number; y: number };
  private star: { x: number; y: number };
  private travel?: Phaser.Tweens.Tween;

  /** def = null : pas encore d'Astre (prologue), la Gardienne est seule. */
  private avoid: ReadonlyArray<{ x: number; y: number }>;

  /** avoid = les autres étoiles de la carte, que l'Astre ne doit pas recouvrir. */
  constructor(
    scene: Phaser.Scene,
    def: CompanionDef | null,
    star: { x: number; y: number },
    avoid: ReadonlyArray<{ x: number; y: number }> = [],
  ) {
    this.scene = scene;
    this.avoid = avoid;
    this.star = { ...star };
    this.gardienne = scene.add.graphics().setDepth(19);
    drawGardienne(this.gardienne);
    this.feet = this.spotFor(star.x, star.y);
    this.view = def ? new CompanionView(scene, def, { x: 0, y: 0 }) : null;
    this.place(0);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** Rejoint l'étoile d'un niveau : la Gardienne glisse, l'Astre la suit en sautillant. */
  followTo(x: number, y: number): void {
    if (x === this.star.x && y === this.star.y) return;
    this.travel?.stop();
    const from = { ...this.star };
    const fromFeet = { ...this.feet };
    const to = this.spotFor(x, y);
    const dist = Math.hypot(to.x - fromFeet.x, to.y - fromFeet.y);
    const hops = Math.max(1, Math.min(6, Math.round(dist / 70)));
    const t = { u: 0 };
    this.travel = this.scene.tweens.add({
      targets: t,
      u: 1,
      duration: HOP_MS * hops,
      onUpdate: () => {
        // La Gardienne glisse en douceur, l'Astre rebondit derrière elle.
        const g = Phaser.Math.Easing.Sine.InOut(t.u);
        this.star.x = from.x + (x - from.x) * g;
        this.star.y = from.y + (y - from.y) * g;
        const lag = Math.max(0, t.u * 1.1 - 0.1);
        const arc = Math.abs(Math.sin(lag * Math.PI * hops)) * 22;
        this.feet.x = fromFeet.x + (to.x - fromFeet.x) * lag;
        this.feet.y = fromFeet.y + (to.y - fromFeet.y) * lag - arc;
        this.place(arc);
      },
      onComplete: () => {
        this.star = { x, y };
        this.feet = to;
        this.place(0);
      },
    });
  }

  /** Survol d'une étoile : l'Astre la regarde et réagit selon son état. */
  onHover(state: MapNodeState): void {
    const b = this.view?.brain;
    if (!b) return;
    if (state === 'open') b.onEvent('proche_coeur');
    else if (state === 'done') b.onEvent('tir_moyen');
  }

  /** Pieds de l'Astre près de l'étoile (x, y), là où il ne cache aucune autre étoile. */
  private spotFor(x: number, y: number): { x: number; y: number } {
    const others = this.avoid.filter((o) => o.x !== x || o.y !== y);
    let best = { x: x + (ASTRE_SPOTS[0]?.dx ?? 30), y: y + (ASTRE_SPOTS[0]?.dy ?? 8) };
    let bestGap = -1;
    for (const s of ASTRE_SPOTS) {
      // Centre du corps de l'Astre (pieds - ~19 px à l'échelle 0,5).
      const cx = x + s.dx;
      const cy = y + s.dy - 19;
      const gap = Math.min(Infinity, ...others.map((o) => Math.hypot(o.x - cx, o.y - cy)));
      if (gap > bestGap + 8) {
        bestGap = gap;
        best = { x: x + s.dx, y: y + s.dy };
      }
    }
    return best;
  }

  private place(arc: number): void {
    this.gardienne.setPosition(this.star.x + GARDIENNE.dx, this.star.y + GARDIENNE.dy);
    this.gardienne.setScale(GARDIENNE.scale);
    // Ombre de saut : l'Astre est un peu plus petit en l'air (lisibilité du bond).
    this.view?.setDisplay(this.feet.x, this.feet.y, MAP_ASTRE.scale * (1 - arc / 400));
  }

  private tick(_time: number, delta: number): void {
    const v = this.view;
    if (!v) return;
    const p = this.scene.input.activePointer;
    // Regarde le pointeur ; bouger la souris le garde éveillé.
    v.update(delta / 1000, { aim: { x: p.worldX, y: p.worldY } });
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this);
    this.travel?.stop();
    this.view?.destroy();
    this.gardienne.destroy();
  }
}
