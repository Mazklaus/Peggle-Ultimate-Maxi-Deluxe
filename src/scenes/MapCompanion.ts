/**
 * L'Astre et la Gardienne sur la carte (specs UI/UX 3, validé GD) : la Gardienne se tient
 * sur l'étoile du niveau courant, l'Astre l'accompagne en sautillant d'étoile en étoile,
 * réagit au survol d'un niveau et s'endort si on traîne (cerveau commun des Astres).
 */
import Phaser from 'phaser';
import type { CompanionDef } from '../core/companion/types';
import { CompanionView } from './CompanionView';

export type MapNodeState = 'locked' | 'open' | 'done';

/** Échelle de l'Astre sur la carte et placement autour de l'étoile. */
const MAP_ASTRE = { scale: 0.5, dx: 30, dy: 8 };
const GARDIENNE = { dx: -20, dy: 6, scale: 0.55 };
const HOP_MS = 280;
const AMBER = 0xffb23f;
const INK = 0x3a3f7a;

export class MapCompanion {
  readonly view: CompanionView | null;
  private scene: Phaser.Scene;
  private gardienne: Phaser.GameObjects.Graphics;
  private feet: { x: number; y: number };
  private star: { x: number; y: number };
  private travel?: Phaser.Tweens.Tween;

  /** def = null : pas encore d'Astre (prologue), la Gardienne est seule. */
  constructor(scene: Phaser.Scene, def: CompanionDef | null, star: { x: number; y: number }) {
    this.scene = scene;
    this.star = { ...star };
    this.gardienne = scene.add.graphics().setDepth(19);
    drawGardienne(this.gardienne);
    this.feet = { x: star.x + MAP_ASTRE.dx, y: star.y + MAP_ASTRE.dy };
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
    const to = { x: x + MAP_ASTRE.dx, y: y + MAP_ASTRE.dy };
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

/** Silhouette de la Gardienne (pieds en 0, 0) avec sa lanterne. */
function drawGardienne(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(INK, 1);
  g.fillTriangle(-30, 0, 30, 0, 0, -92);
  g.fillCircle(0, -92, 17);
  g.fillStyle(0x232a5c, 1).fillCircle(3, -90, 10);
  g.lineStyle(6, INK, 1).lineBetween(6, -62, 34, -52);
  g.lineStyle(2, INK, 1).lineBetween(34, -52, 34, -42);
  g.fillStyle(AMBER, 0.18).fillCircle(34, -32, 26);
  g.fillStyle(AMBER, 0.35).fillCircle(34, -32, 14);
  g.fillStyle(0xffe0a0, 1).fillRoundedRect(28, -40, 12, 16, 4);
}
