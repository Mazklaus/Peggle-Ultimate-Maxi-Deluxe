/**
 * Décor animé en jeu (jalon 2) : déplace les pegs des groupes rotate / orbit dans Matter,
 * à chaque pas de physique, et dessine leurs supports visibles (DA elements-decor.js :
 * rail en pointillés, moyeu, chevrons de sens, pivot-étoile, traînée).
 *
 * Les positions des cristaux de LevelState sont tenues à jour : la prédiction du final,
 * l'anti-blocage et les guides voient le décor là où il est.
 * Règle DA : un cristal ne tourne jamais sur lui-même et garde couleur et forme.
 */
import Phaser from 'phaser';
import { toWorld } from '../config';
import { isMovingDecor, pegPoseAt, pegTravel, type MovingDecor } from '../core/decor';
import type { Crystal } from '../core/level';

const TRACK = 0xb9a6ff;
const WARM = 0xfff6e0;
const SLATE = 0x3a4170;
const SLATE_L = 0x5a63a0;

interface MovingPeg {
  crystal: Crystal;
  decor: MovingDecor;
  x0: number;
  y0: number;
}

interface MatterBodyApi {
  setPosition(body: MatterJS.BodyType, p: { x: number; y: number }, updateVelocity?: boolean): void;
}

export class DecorLayer {
  private readonly pegs: MovingPeg[] = [];
  private readonly decor: MovingDecor[];
  private readonly body: MatterBodyApi;
  /** Temps du décor (s) : temps de la physique, donc ralenti et pause compris. */
  private t = 0;
  private startStamp: number | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    decor: ReadonlyArray<{ id: string; type: string }>,
    crystals: Crystal[],
    private readonly bodyOf: (id: number) => MatterJS.BodyType | undefined,
    /** Calque des supports, créé sous les cristaux par la scène. */
    private readonly gfx: Phaser.GameObjects.Graphics,
  ) {
    this.decor = decor.filter(isMovingDecor);
    const byId = new Map(this.decor.map((d) => [d.id, d]));
    for (const c of crystals) {
      const d = c.group ? byId.get(c.group) : undefined;
      if (d) this.pegs.push({ crystal: c, decor: d, x0: c.x, y0: c.y });
    }
    this.body = (
      Phaser.Physics.Matter as unknown as { Matter: { Body: MatterBodyApi } }
    ).Matter.Body;
    if (this.pegs.length > 0) {
      scene.matter.world.on(Phaser.Physics.Matter.Events.BEFORE_UPDATE, this.step, this);
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    }
    this.step();
    this.draw();
  }

  get active(): boolean {
    return this.pegs.length > 0;
  }

  /** Le cristal bouge-t-il avec le décor ? */
  isMoving(id: number): boolean {
    return this.pegs.some((p) => p.crystal.id === id);
  }

  /**
   * Un peg mobile (autre que `exceptId`) peut-il croiser ce trajet dans les `seconds` à venir ?
   * Sert à la prédiction du final : la trajectoire prédite suppose un décor immobile.
   */
  mayCross(
    path: ReadonlyArray<{ x: number; y: number }>,
    seconds: number,
    exceptId: number,
    orbR: number,
  ): boolean {
    for (const p of this.pegs) {
      const c = p.crystal;
      if (c.id === exceptId || !this.bodyOf(c.id)) continue;
      const w = toWorld(c);
      const r = c.shape?.type === 'brick' ? Math.max(c.shape.w, c.shape.h) / 2 : (c.shape?.r ?? 10);
      const reach = r + orbR + pegTravel(p.decor, p.x0, p.y0, seconds) + 2;
      if (path.some((q) => Math.hypot(q.x - w.x, q.y - w.y) < reach)) return true;
    }
    return false;
  }

  /** Un pas de physique : nouvelles positions des pegs (corps Matter et état du niveau). */
  private step(): void {
    const stamp = this.scene.matter.world.engine.timing.timestamp;
    this.startStamp ??= stamp;
    this.t = (stamp - this.startStamp) / 1000;
    for (const p of this.pegs) {
      const pose = pegPoseAt(p.decor, p.x0, p.y0, this.t);
      p.crystal.x = pose.x;
      p.crystal.y = pose.y;
      const body = this.bodyOf(p.crystal.id);
      // Vitesse mise à jour : l'orbe rebondit sur un peg qui la pousse, pas sur un mur figé.
      if (body) this.body.setPosition(body, toWorld(pose), true);
    }
  }

  /** Supports visibles, redessinés chaque frame (les pegs brisés disparaissent des rayons). */
  draw(): void {
    const g = this.gfx.clear();
    for (const d of this.decor) {
      const c = toWorld({ x: d.cx, y: d.cy });
      if (d.type === 'rotate') this.drawRotate(g, d, c);
      else this.drawOrbit(g, d, c);
    }
  }

  private drawRotate(
    g: Phaser.GameObjects.Graphics,
    d: MovingDecor,
    c: { x: number; y: number },
  ): void {
    // Un rail par anneau du groupe (au moins 2 pegs au même rayon, à 8 px près), 3 au plus.
    const count = new Map<number, number>();
    for (const p of this.pegs) {
      if (p.decor !== d) continue;
      const r = Math.round(Math.hypot(p.x0 - d.cx, p.y0 - d.cy) / 8) * 8;
      if (r > 0) count.set(r, (count.get(r) ?? 0) + 1);
    }
    const radii = [...count]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([r]) => r);
    const turn = (d.dir * 2 * Math.PI * this.t) / d.periodS;
    for (const r of radii) dashedEllipse(g, c.x, c.y, r, r, 2, 0.22, 2, 7, turn * 0.5);
    const outer = Math.max(0, ...radii);
    if (outer > 0) {
      // Chevrons de sens, toujours lisibles (3, entraînés avec la roue).
      g.lineStyle(2.2, TRACK, 0.45);
      for (let i = 0; i < 3; i++) {
        const a = turn + Math.PI / 6 + (i * 2 * Math.PI) / 3;
        const px = c.x + Math.cos(a) * outer;
        const py = c.y + Math.sin(a) * outer;
        const tx = -Math.sin(a) * d.dir;
        const ty = Math.cos(a) * d.dir;
        const nx = Math.cos(a);
        const ny = Math.sin(a);
        g.beginPath();
        g.moveTo(px - tx * 4 + nx * 4, py - ty * 4 + ny * 4);
        g.lineTo(px + tx * 3, py + ty * 3);
        g.lineTo(px - tx * 4 - nx * 4, py - ty * 4 - ny * 4);
        g.strokePath();
      }
    }
    g.fillStyle(SLATE, 1).fillCircle(c.x, c.y, 9);
    g.fillStyle(SLATE_L, 1).fillCircle(c.x - 2, c.y - 2, 4);
  }

  private drawOrbit(
    g: Phaser.GameObjects.Graphics,
    d: MovingDecor,
    c: { x: number; y: number },
  ): void {
    if (d.type !== 'orbit') return;
    dashedEllipse(g, c.x, c.y, d.rx, d.ry, 1.6, 0.22, 3, 6, 0);
    // Pivot-étoile blanc chaud.
    g.fillStyle(WARM, 0.9);
    g.fillPoints(
      [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const r = i % 2 ? 2.2 : 7;
        const a = (i * Math.PI) / 4 - Math.PI / 2;
        return new Phaser.Math.Vector2(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r);
      }),
      true,
    );
    // Traînée courte derrière chaque satellite encore en place (lecture de la vitesse).
    for (const p of this.pegs) {
      if (p.decor !== d || !this.bodyOf(p.crystal.id)) continue;
      for (let i = 5; i >= 1; i--) {
        const back = pegPoseAt(d, p.x0, p.y0, this.t - (i * 0.09 * d.periodS) / (2 * Math.PI));
        const w = toWorld(back);
        g.fillStyle(TRACK, (0.12 * (6 - i)) / 5).fillCircle(w.x, w.y, 7 - i);
      }
    }
  }

  destroy(): void {
    this.scene.matter.world.off(Phaser.Physics.Matter.Events.BEFORE_UPDATE, this.step, this);
    this.gfx.destroy();
  }
}

/** Ellipse en pointillés (dash / gap en px le long du tour, décalage angulaire `phase`). */
function dashedEllipse(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  width: number,
  alpha: number,
  dash: number,
  gap: number,
  phase: number,
): void {
  const perim = Math.PI * (rx + ry);
  const n = Math.max(6, Math.floor(perim / (dash + gap)));
  const da = (2 * Math.PI) / n;
  const on = da * (dash / (dash + gap));
  g.lineStyle(width, TRACK, alpha);
  for (let i = 0; i < n; i++) {
    const a = phase + i * da;
    g.lineBetween(
      cx + Math.cos(a) * rx,
      cy + Math.sin(a) * ry,
      cx + Math.cos(a + on) * rx,
      cy + Math.sin(a + on) * ry,
    );
  }
}
