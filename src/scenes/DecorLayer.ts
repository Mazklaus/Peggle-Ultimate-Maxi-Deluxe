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
import {
  isMagnet,
  isPortal,
  PORTAL,
  portalMouthAt,
  portalStep,
  isMovingDecor,
  magnetAccel,
  magnetWeight,
  pegPoseAt,
  pegTravel,
  type MovingDecor,
} from '../core/decor';
import type { DecorMagnet, DecorPortal } from '../core/levelFormat';
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
  private readonly magnets: DecorMagnet[];
  private readonly portals: DecorPortal[];
  /** Flash de passage par bouche (`${id}:a|b`), 1 -> 0. */
  private readonly flash = new Map<string, number>();
  /** Orbes en vol (monde) : l'aimant qui les tient pulse. */
  private orbs: ReadonlyArray<{ x: number; y: number }> = [];
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
    this.magnets = decor.filter(isMagnet);
    this.portals = decor.filter(isPortal);
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

  get hasMagnets(): boolean {
    return this.magnets.length > 0;
  }

  /** Accélération des aimants sur l'orbe en (x, y) monde, en px/s² de temps de jeu. */
  magnetAt(x: number, y: number): { ax: number; ay: number } {
    const o = toWorld({ x: 0, y: 0 });
    return magnetAccel(this.magnets, x - o.x, y - o.y);
  }

  /** Champ des aimants pour les prédictions (px par pas de référence au carré), ou undefined. */
  get field(): ((x: number, y: number) => { ax: number; ay: number }) | undefined {
    if (this.magnets.length === 0) return undefined;
    return (x, y) => {
      const a = this.magnetAt(x, y);
      return { ax: a.ax / 3600, ay: a.ay / 3600 };
    };
  }

  get hasPortals(): boolean {
    return this.portals.length > 0;
  }

  /** Pas de portail en coordonnées monde (voir core/decor.ts portalStep). */
  portalStep(
    x: number,
    y: number,
    inside: string | null,
    ready = true,
  ): { to: { x: number; y: number } | null; inside: string | null } {
    const o = toWorld({ x: 0, y: 0 });
    const r = portalStep(this.portals, x - o.x, y - o.y, inside, ready);
    return { to: r.to ? toWorld(r.to) : null, inside: r.inside };
  }

  /** Pour les prédictions (aperçu de Pip), ou undefined sans portail. */
  get portal():
    | ((
        x: number,
        y: number,
        inside: string | null,
      ) => { to: { x: number; y: number } | null; inside: string | null })
    | undefined {
    return this.portals.length > 0 ? (x, y, inside) => this.portalStep(x, y, inside) : undefined;
  }

  /** Le trajet passe-t-il par une bouche de portail ? (la prédiction du final s'abstient) */
  touchesPortal(path: ReadonlyArray<{ x: number; y: number }>): boolean {
    if (this.portals.length === 0) return false;
    const o = toWorld({ x: 0, y: 0 });
    return path.some((q) => portalMouthAt(this.portals, q.x - o.x, q.y - o.y) !== null);
  }

  /** Une orbe vient de passer : les deux bouches flashent. */
  portalFlash(inside: string | null): void {
    if (!inside) return;
    const [id] = inside.split(':');
    this.flash.set(`${id}:a`, 1);
    this.flash.set(`${id}:b`, 1);
  }

  setOrbs(orbs: ReadonlyArray<{ x: number; y: number }>): void {
    this.orbs = orbs;
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
    for (const m of this.magnets) this.drawMagnet(g, m);
    this.portals.forEach((p, i) => {
      this.drawPortal(g, p, 'a', i + 1);
      this.drawPortal(g, p, 'b', i + 1);
    });
  }

  /**
   * Portail (DA elements-decor.js) : disque nuit, tourbillon lavande qui aspire, anneau
   * blanc chaud ; les paires se distinguent par le NOMBRE d'étoiles (1, 2, 3), jamais par
   * la couleur. Flash au passage de l'orbe.
   */
  private drawPortal(
    g: Phaser.GameObjects.Graphics,
    p: DecorPortal,
    side: 'a' | 'b',
    pair: number,
  ): void {
    const c = toWorld(side === 'a' ? p.a : p.b);
    const r = PORTAL.r;
    const now = this.scene.time.now;
    const key = `${p.id}:${side}`;
    const flash = this.flash.get(key) ?? 0;
    if (flash > 0) this.flash.set(key, Math.max(0, flash - 0.05));
    g.fillStyle(0x3b2e6e, 0.9).fillCircle(c.x, c.y, r);
    g.fillStyle(0x0b1026, 1).fillCircle(c.x, c.y, r * 0.55);
    for (let i = 0; i < 3; i++) {
      const s = (now / 900 + i / 3) % 1;
      const a0 = now / 300 + i * 2;
      g.lineStyle(1.4, TRACK, 0.45 * s).beginPath();
      g.arc(c.x, c.y, r * (1 - s) * 0.95, a0, a0 + 2.4);
      g.strokePath();
    }
    g.lineStyle(3 + flash * 3, WARM, 1).strokeCircle(c.x, c.y, r);
    if (flash > 0) g.fillStyle(WARM, 0.45 * flash).fillCircle(c.x, c.y, r * (1 + flash));
    g.fillStyle(WARM, 1);
    for (let i = 0; i < pair; i++) {
      const a = -Math.PI / 2 + (i - (pair - 1) / 2) * 0.5;
      const sx = c.x + Math.cos(a) * (r + 8);
      const sy = c.y + Math.sin(a) * (r + 8);
      g.fillPoints(
        [0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
          const rr = k % 2 ? 1.4 : 4;
          const b = (k * Math.PI) / 4;
          return new Phaser.Math.Vector2(sx + Math.cos(b) * rr, sy + Math.sin(b) * rr);
        }),
        true,
      );
    }
  }

  /**
   * Aimant (DA elements-decor.js, « lentille d'attraction ») : rayon d'effet en pointillé,
   * ondes qui se resserrent vers le centre, lentille ardoise au cœur chaud. Elle pulse
   * quand elle tient l'orbe.
   */
  private drawMagnet(g: Phaser.GameObjects.Graphics, m: DecorMagnet): void {
    const c = toWorld(m);
    const now = this.scene.time.now;
    let pulse = 0;
    for (const o of this.orbs)
      pulse = Math.max(pulse, magnetWeight(m, Math.hypot(o.x - c.x, o.y - c.y)));
    dashedEllipse(g, c.x, c.y, m.radius, m.radius, 1.4, 0.22, 2, 8, 0);
    for (let i = 0; i < 3; i++) {
      const s = 1 - ((now / 1400 + i / 3) % 1);
      g.lineStyle(1.6, WARM, 0.35 * (1 - s) + 0.05).strokeCircle(
        c.x,
        c.y,
        14 + s * (m.radius - 14),
      );
    }
    g.fillStyle(SLATE, 1).fillCircle(c.x, c.y, 13 + pulse * 3);
    g.fillStyle(WARM, 1).fillCircle(c.x, c.y, 6 + pulse * 2);
    g.lineStyle(2, SLATE_L, 1).strokeCircle(c.x, c.y, 13 + pulse * 3);
  }

  private drawRotate(
    g: Phaser.GameObjects.Graphics,
    d: MovingDecor,
    c: { x: number; y: number },
  ): void {
    // Un rail par anneau du groupe (rayon à 8 px près), 3 au plus : les anneaux les plus
    // peuplés d'abord ; un peg seul sur son anneau a aussi son rail s'il reste de la place
    // (demande Level Designer, lisibilité).
    const count = new Map<number, number>();
    for (const p of this.pegs) {
      if (p.decor !== d) continue;
      const r = Math.round(Math.hypot(p.x0 - d.cx, p.y0 - d.cy) / 8) * 8;
      if (r > 0) count.set(r, (count.get(r) ?? 0) + 1);
    }
    const radii = [...count]
      .sort((a, b) => b[1] - a[1] || b[0] - a[0])
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
