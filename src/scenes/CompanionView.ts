import Phaser from 'phaser';
import { CompanionBrain, type BrainInput, type CompanionPhase } from '../core/companion/brain';
import type {
  Arms,
  CompanionDef,
  Eyes,
  Mouth,
  ParticleKind,
  Pose,
  ReactionTrigger,
  Tuft,
} from '../core/companion/types';
import { gameEvents, type GameEventName } from '../core/events';

/**
 * Vue d'un Astre dans sa loge de marge : tout est dessiné en code à chaque frame
 * (corps à branches molles, yeux, bouche, mèche, accessoires, particules).
 * Le cerveau (src/core/companion) décide de la pose ; cette classe ne fait que dessiner.
 */

const BODY_R = 38;
/** Encre DA (jamais de noir pur) et reflet d'œil. */
const INK = 0x1b2350;
const WHITE = 0xfff6e0;
const CHEEK = 0xff8fb1;
const FLUSH = 0xff6a3d;
/** Débordement autorisé dans la marge (UI/UX : x de 0 à 196). */
const MARGIN = { minX: 4, maxX: 192 };

const REACTION_EVENTS: ReactionTrigger[] = [
  'tir_lance',
  'gros_coup',
  'chaine_longue',
  'rate',
  'orbe_recupere',
  'pouvoir_active',
  'presque',
  'dernier_coeur',
  'dernier_orbe',
  'final_ralenti',
  'victoire',
  'echec',
  'inactivite',
];

interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  spin: number;
  color: number;
}

const CONFETTI = [0xffe45c, 0xff5fa2, 0x6fcbff, 0x4ff0a8, 0xffb23f, 0xb9a6ff];

export interface CompanionWorldInput {
  /** Point visé (coordonnées monde), en phase de visée. */
  aim?: { x: number; y: number };
  /** Orbe en vol (coordonnées monde, vitesse en px/s). */
  orb?: { x: number; y: number; vy: number };
  /** Profondeur de l'orbe dans la zone de jeu (0 haut, 1 bas). */
  orbDepth?: number;
  orbNearHeart?: boolean;
}

export class CompanionView {
  readonly brain: CompanionBrain;
  private def: CompanionDef;
  private anchor: { x: number; y: number };
  private gfx: Phaser.GameObjects.Graphics;
  private fx: Phaser.GameObjects.Graphics;
  private symbolText: Phaser.GameObjects.Text;
  private particles: Particle[] = [];
  private lastSymbol: string | null = null;
  private symbolPop = 1;
  private time = 0;
  private unsubscribe: Array<() => void> = [];
  private lastPose: Pose | null = null;

  /** anchor = position des « pieds » de l'Astre dans sa loge (UI/UX : 100, 270). */
  constructor(
    scene: Phaser.Scene,
    def: CompanionDef,
    anchor = { x: 100, y: 270 },
    rng?: () => number,
  ) {
    this.def = def;
    this.anchor = anchor;
    this.brain = new CompanionBrain(def, rng);
    this.fx = scene.add.graphics().setDepth(20);
    this.gfx = scene.add.graphics().setDepth(21);
    this.symbolText = scene.add
      .text(anchor.x, anchor.y - 100, '', {
        fontFamily: 'sans-serif',
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#FFF6E0',
        stroke: '#1A1433',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(22);
  }

  /** Écoute le bus de jeu (à appeler une fois ; detach() au shutdown de la scène). */
  attach(): void {
    for (const name of REACTION_EVENTS) {
      this.unsubscribe.push(gameEvents.on(name as GameEventName, () => this.brain.onEvent(name)));
    }
    this.unsubscribe.push(gameEvents.on('cristal_allume', () => this.brain.onCrystalHit()));
  }

  detach(): void {
    this.unsubscribe.forEach((u) => u());
    this.unsubscribe = [];
  }

  setPhase(phase: CompanionPhase): void {
    this.brain.setPhase(phase);
  }

  get pose(): Pose | null {
    return this.lastPose;
  }

  update(dtSeconds: number, input: CompanionWorldInput = {}): void {
    this.time += dtSeconds;
    const center = { x: this.anchor.x, y: this.anchor.y - BODY_R };
    const brainInput: BrainInput = {};
    if (input.aim) brainInput.aim = { dx: input.aim.x - center.x, dy: input.aim.y - center.y };
    if (input.orb) {
      brainInput.orb = {
        dx: input.orb.x - center.x,
        dy: input.orb.y - center.y,
        vy: input.orb.vy,
        depth: input.orbDepth ?? 0,
        nearHeart: input.orbNearHeart ?? false,
      };
    }
    const pose = this.brain.update(dtSeconds, brainInput);
    this.lastPose = pose;
    if (pose.cry) {
      gameEvents.emit('astre_cri', {
        astre: this.def.id,
        reaction: pose.cry.reaction,
        variant: pose.cry.variant,
      });
    }
    this.draw(pose);
    for (const b of pose.bursts) this.spawn(b.kind, b.count, pose);
    this.updateParticles(dtSeconds);
  }

  destroy(): void {
    this.detach();
    this.gfx.destroy();
    this.fx.destroy();
    this.symbolText.destroy();
  }

  // ---------- Dessin ----------

  private bodyCenter(pose: Pose): { x: number; y: number } {
    const shakeX = pose.shake ? (Math.random() * 2 - 1) * pose.shake : 0;
    const shakeY = pose.shake ? (Math.random() * 2 - 1) * pose.shake : 0;
    const x = Phaser.Math.Clamp(
      this.anchor.x + pose.body.x,
      MARGIN.minX + BODY_R,
      MARGIN.maxX - BODY_R,
    );
    // Squash ancré aux pieds : le centre descend quand le corps s'écrase.
    const y = this.anchor.y - BODY_R * pose.body.sy + pose.body.y;
    return { x: x + shakeX, y: y + shakeY };
  }

  private draw(pose: Pose): void {
    const g = this.gfx;
    g.clear();
    const c = this.bodyCenter(pose);
    const { sx, sy, rot } = pose.body;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    /** Point local (unités du corps) -> monde, avec squash/stretch et rotation. */
    const P = (lx: number, ly: number) => {
      const x = lx * sx;
      const y = ly * sy;
      return { x: c.x + x * cos - y * sin, y: c.y + x * sin + y * cos };
    };
    const color = blend(this.def.color, FLUSH, pose.flush * 0.7);
    const dark = blend(this.def.colorDark, 0xc0391b, pose.flush * 0.6);

    // Ombre au sol : rétrécit quand l'Astre saute (lecture des sauts).
    const lift = Math.max(0, -pose.body.y);
    const shadowW = BODY_R * 1.6 * Math.max(0.35, 1 - lift / 120);
    g.fillStyle(0x0b1026, 0.45);
    g.fillEllipse(
      Phaser.Math.Clamp(this.anchor.x + pose.body.x, MARGIN.minX + BODY_R, MARGIN.maxX - BODY_R),
      this.anchor.y + 4,
      shadowW,
      shadowW * 0.22,
    );

    // Halo
    if (pose.glow > 0.02) {
      g.fillStyle(this.def.color, 0.12 + pose.glow * 0.25);
      g.fillCircle(c.x, c.y, BODY_R * (1.5 + pose.glow * 0.5) * Math.max(sx, sy));
    }

    // Branches (jambes + bras), derrière le corps sauf les gestes « devant ».
    const arms = armAngles(pose.arms, this.time, pose.look);
    const front = ['cover', 'pray', 'cross', 'chest', 'bite', 'clap'].includes(pose.arms);
    const branch = (angleDeg: number, len: number, width: number, col: number) => {
      const a = Phaser.Math.DegToRad(angleDeg - 90);
      const base = P(Math.cos(a) * BODY_R * 0.6, Math.sin(a) * BODY_R * 0.6);
      const tip = P(Math.cos(a) * BODY_R * len, Math.sin(a) * BODY_R * len);
      g.lineStyle(width * Math.min(sx, sy), col, 1);
      g.lineBetween(base.x, base.y, tip.x, tip.y);
      g.fillStyle(col, 1);
      g.fillCircle(tip.x, tip.y, (width / 2) * Math.min(sx, sy));
    };
    branch(150, 1.3, 16, dark);
    branch(210, 1.3, 16, dark);
    branch(150, 1.27, 12, color);
    branch(210, 1.27, 12, color);
    if (!front) {
      branch(arms.right, arms.lenR, 14, color);
      branch(arms.left, arms.lenL, 14, color);
    }

    // Mèche (branche du haut)
    this.drawTuft(g, pose.tuft, P, color);

    // Corps
    // Corps : ombre propre décalée (+2, +3), base, reflet (DA, pas de contour).
    g.fillStyle(dark, 1);
    fillEllipse(g, P, 2, 3, BODY_R, BODY_R, rot);
    g.fillStyle(color, 1);
    fillEllipse(g, P, 0, 0, BODY_R, BODY_R, rot);
    g.fillStyle(this.def.colorLight, 0.9);
    fillEllipse(g, P, -11, -14, 10, 7, rot);

    // Joues
    if (['happy', 'stars'].includes(pose.eyes) || ['grin', 'puffed'].includes(pose.mouth)) {
      g.fillStyle(CHEEK, 0.45 + pose.excitement * 0.3);
      const l = P(-17, 8);
      const rr = P(17, 8);
      g.fillCircle(l.x, l.y, pose.mouth === 'puffed' ? 8 : 5);
      g.fillCircle(rr.x, rr.y, pose.mouth === 'puffed' ? 8 : 5);
    }

    this.drawEyes(g, pose.eyes, pose.look, P);
    this.drawMouth(g, pose.mouth, P);

    if (front) {
      branch(arms.right, arms.lenR, 14, color);
      branch(arms.left, arms.lenL, 14, color);
    }

    this.drawProp(pose, c);
    this.drawSymbol(pose, c);
  }

  private drawEyes(
    g: Phaser.GameObjects.Graphics,
    eyes: Eyes,
    look: { x: number; y: number },
    P: (x: number, y: number) => { x: number; y: number },
  ): void {
    const lx = Phaser.Math.Clamp(look.x, -1, 1) * 4;
    const ly = Phaser.Math.Clamp(look.y, -1, 1) * 3;
    for (const side of [-1, 1]) {
      const e = P(side * 11 + lx, -5 + ly);
      switch (eyes) {
        case 'closed':
          g.lineStyle(3, INK, 1);
          arc(g, e.x, e.y + 1, 5, 0.15, Math.PI - 0.15);
          break;
        case 'happy':
          g.lineStyle(3, INK, 1);
          arc(g, e.x, e.y + 3, 5, Math.PI + 0.3, Math.PI * 2 - 0.3);
          break;
        case 'squint':
          g.lineStyle(3, INK, 1);
          g.lineBetween(e.x - 5, e.y - 3 * side * -1, e.x + 5, e.y);
          g.lineBetween(e.x - 5, e.y + 3 * side * -1, e.x + 5, e.y);
          break;
        case 'wide':
          g.fillStyle(WHITE, 1);
          g.fillCircle(e.x, e.y, 8);
          g.fillStyle(INK, 1);
          g.fillCircle(e.x + lx * 0.6, e.y + ly * 0.6, 3);
          break;
        case 'stars':
          g.fillStyle(WHITE, 1);
          star(g, e.x, e.y, 8, 3, 4, this.time * 4);
          break;
        case 'spiral': {
          g.lineStyle(2, INK, 1);
          const pts: Phaser.Math.Vector2[] = [];
          for (let i = 0; i < 24; i++) {
            const a = i * 0.55 + this.time * 8 * side;
            const rad = 1 + i * 0.3;
            pts.push(new Phaser.Math.Vector2(e.x + Math.cos(a) * rad, e.y + Math.sin(a) * rad));
          }
          g.strokePoints(pts);
          break;
        }
        case 'wink':
          if (side < 0) {
            g.lineStyle(3, INK, 1);
            g.lineBetween(e.x - 5, e.y, e.x + 5, e.y);
          } else {
            drawOpenEye(g, e, lx, ly);
          }
          break;
        default:
          drawOpenEye(g, e, lx, ly);
      }
    }
  }

  private drawMouth(
    g: Phaser.GameObjects.Graphics,
    mouth: Mouth,
    P: (x: number, y: number) => { x: number; y: number },
  ): void {
    const m = P(0, 11);
    g.lineStyle(3, INK, 1);
    switch (mouth) {
      case 'neutral':
        g.lineBetween(m.x - 4, m.y, m.x + 4, m.y);
        break;
      case 'smile':
        arc(g, m.x, m.y - 4, 6, 0.4, Math.PI - 0.4);
        break;
      case 'grin':
        g.fillStyle(INK, 1);
        g.slice(m.x, m.y - 1, 8, 0, Math.PI, false);
        g.fillPath();
        g.fillStyle(CHEEK, 1);
        g.fillEllipse(m.x, m.y + 4, 7, 3);
        break;
      case 'open':
        g.fillStyle(INK, 1);
        g.fillEllipse(m.x, m.y + 2, 12, 10);
        break;
      case 'o':
        g.fillStyle(INK, 1);
        g.fillCircle(m.x, m.y + 1, 3.5);
        break;
      case 'pout':
        arc(g, m.x, m.y + 5, 5, Math.PI + 0.5, Math.PI * 2 - 0.5);
        break;
      case 'zigzag': {
        const pts = [-7, -3.5, 0, 3.5, 7].map(
          (dx, i) => new Phaser.Math.Vector2(m.x + dx, m.y + (i % 2 ? -2 : 2)),
        );
        g.strokePoints(pts);
        break;
      }
      case 'tongue':
        arc(g, m.x, m.y - 4, 6, 0.4, Math.PI - 0.4);
        g.fillStyle(CHEEK, 1);
        g.fillEllipse(m.x + 2, m.y + 3, 5, 6);
        break;
      case 'yawn':
        g.fillStyle(INK, 1);
        g.fillEllipse(m.x, m.y + 3, 9, 15);
        break;
      case 'puffed':
        g.fillStyle(INK, 1);
        g.fillCircle(m.x, m.y + 1, 2);
        break;
      case 'whistle':
        g.lineStyle(2.5, INK, 1);
        g.strokeCircle(m.x + 3, m.y + 1, 2.5);
        break;
    }
  }

  private drawTuft(
    g: Phaser.GameObjects.Graphics,
    tuft: Tuft,
    P: (x: number, y: number) => { x: number; y: number },
    color: number,
  ): void {
    const t = this.time;
    const pts: { x: number; y: number }[] = [];
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      let x = 0;
      let y = -BODY_R * 0.7 - u * BODY_R * 0.9;
      switch (tuft) {
        case 'calm':
          x = Math.sin(t * 3 + u * 3) * 4 * u;
          break;
        case 'up':
          y -= u * 8;
          x = Math.sin(t * 10 + u * 4) * 1.5 * u;
          break;
        case 'down':
          x = u * u * 22;
          y = -BODY_R * 0.7 - u * 10 + u * u * 22;
          break;
        case 'curl': {
          const a = u * Math.PI * 3;
          x = Math.sin(a) * 7 * u;
          y = -BODY_R * 0.7 - u * BODY_R * 0.8 + Math.cos(a) * 4;
          break;
        }
        case 'antenna':
          y -= u * 6;
          break;
        case 'flame':
          x = Math.sin(t * 18 + u * 6) * 5 * u;
          y -= u * 10;
          break;
        case 'messy':
          x = (i % 2 ? 6 : -6) * u + 6 * u;
          y = -BODY_R * 0.7 - u * BODY_R * 0.7;
          break;
      }
      pts.push(P(x, y));
    }
    const width = tuft === 'antenna' ? 4 : 11;
    g.lineStyle(width, color, 1);
    g.strokePoints(pts.map((p) => new Phaser.Math.Vector2(p.x, p.y)));
    const tip = pts[pts.length - 1];
    if (!tip) return;
    g.fillStyle(color, 1);
    g.fillCircle(tip.x, tip.y, tuft === 'antenna' ? 5 : width / 2);
    if (tuft === 'antenna' && Math.floor(t * 4) % 2 === 0) {
      g.fillStyle(WHITE, 0.9);
      g.fillCircle(tip.x, tip.y, 7);
    }
    if (tuft === 'flame' && Math.random() < 0.5) this.spawnAt('sparkle', tip.x, tip.y, 1);
  }

  private drawProp(pose: Pose, c: { x: number; y: number }): void {
    const g = this.gfx;
    const t = this.time;
    switch (pose.prop) {
      case 'juggle': {
        const speed = 4 + pose.propT * 14;
        const h = 26 + Math.abs(Math.sin(t * speed)) * 30;
        g.fillStyle(0xfff6e0, 1);
        g.fillCircle(c.x + Math.cos(t * speed) * 14, c.y - BODY_R - h * 0.6, 6);
        break;
      }
      case 'bonk': {
        const fall = Math.min(1, (pose.propT - 0.62) / 0.08);
        g.fillStyle(0xfff6e0, 1);
        g.fillCircle(c.x, c.y - BODY_R - 60 + Math.max(0, fall) * 46, 6);
        break;
      }
      case 'fly': {
        const fx = c.x + Math.sin(t * 5.3) * 45 + Math.sin(t * 13) * 8;
        const fy = c.y - 50 + Math.cos(t * 4.1) * 22;
        g.fillStyle(0xfff6e0, 0.9);
        g.fillCircle(fx, fy, 2.5);
        g.fillStyle(0xfff6e0, 0.3);
        g.fillCircle(fx, fy, 6);
        break;
      }
      case 'beam': {
        g.fillStyle(0xfff6e0, 0.25);
        g.fillTriangle(c.x, c.y - 4, MARGIN.maxX, c.y - 40, MARGIN.maxX, c.y + 40);
        break;
      }
    }
  }

  private drawSymbol(pose: Pose, c: { x: number; y: number }): void {
    if (pose.symbol !== this.lastSymbol) {
      this.lastSymbol = pose.symbol;
      this.symbolPop = 0;
      this.symbolText.setText(pose.symbol ?? '');
    }
    this.symbolPop = Math.min(1, this.symbolPop + 0.12);
    const s = pose.symbol ? 0.4 + 0.6 * easeOutBack(this.symbolPop) : 0;
    const bob = pose.symbol === 'zzz' ? Math.sin(this.time * 2) * 4 : 0;
    this.symbolText
      .setPosition(Phaser.Math.Clamp(c.x + 26, 20, MARGIN.maxX - 14), c.y - BODY_R - 34 + bob)
      .setScale(s)
      .setVisible(Boolean(pose.symbol));
  }

  // ---------- Particules ----------

  private spawn(kind: ParticleKind, count: number, pose: Pose): void {
    const c = this.bodyCenter(pose);
    this.spawnAt(kind, c.x, c.y, count);
  }

  private spawnAt(kind: ParticleKind, x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      const p: Particle = {
        kind,
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 60,
        life: 0,
        max: 0.6 + Math.random() * 0.6,
        spin: (Math.random() * 2 - 1) * 8,
        color: kind === 'confetti' ? (CONFETTI[i % CONFETTI.length] ?? WHITE) : this.def.color,
      };
      if (kind === 'zzz' || kind === 'note' || kind === 'heart') {
        p.vx = 10 + Math.random() * 25;
        p.vy = -40 - Math.random() * 30;
        p.max = 1.2;
      }
      if (kind === 'sweat') {
        p.x += 22;
        p.y -= 18;
        p.vx = 40 + Math.random() * 30;
        p.vy = -80;
      }
      if (kind === 'smoke') {
        p.y += BODY_R;
        p.vy = -20 - Math.random() * 20;
        p.vx = (Math.random() * 2 - 1) * 50;
      }
      if (kind === 'dizzy') {
        p.max = 1.4;
        p.spin = i * ((Math.PI * 2) / Math.max(1, count));
      }
      this.particles.push(p);
    }
    if (this.particles.length > 160) this.particles.splice(0, this.particles.length - 160);
  }

  private updateParticles(dt: number): void {
    const g = this.fx;
    g.clear();
    const c = this.lastPose ? this.bodyCenter(this.lastPose) : this.anchor;
    this.particles = this.particles.filter((p) => (p.life += dt) < p.max);
    for (const p of this.particles) {
      const a = 1 - p.life / p.max;
      if (p.kind === 'dizzy') {
        const ang = p.spin + p.life * 6;
        g.fillStyle(0xffe45c, a);
        star(g, c.x + Math.cos(ang) * 26, c.y - BODY_R - 6 + Math.sin(ang) * 7, 5, 2, 5, 0);
        continue;
      }
      const gravity =
        p.kind === 'confetti' || p.kind === 'sweat' ? 260 : p.kind === 'sparkle' ? 120 : 0;
      p.vy += gravity * dt;
      p.x = Phaser.Math.Clamp(p.x + p.vx * dt, MARGIN.minX, MARGIN.maxX);
      p.y += p.vy * dt;
      switch (p.kind) {
        case 'sparkle':
          g.fillStyle(0xfff6e0, a);
          star(g, p.x, p.y, 5, 1.6, 4, p.spin * p.life);
          break;
        case 'confetti':
          g.fillStyle(p.color, a);
          g.fillRect(p.x - 3, p.y - 2, 6 * Math.abs(Math.cos(p.spin * p.life)), 4);
          break;
        case 'heart':
          g.fillStyle(0xff5fa2, a);
          g.fillCircle(p.x - 3, p.y, 4);
          g.fillCircle(p.x + 3, p.y, 4);
          g.fillTriangle(p.x - 7, p.y + 1, p.x + 7, p.y + 1, p.x, p.y + 9);
          break;
        case 'sweat':
          g.fillStyle(0x6fcbff, a);
          g.fillCircle(p.x, p.y, 4);
          g.fillTriangle(p.x - 4, p.y - 1, p.x + 4, p.y - 1, p.x, p.y - 9);
          break;
        case 'note':
          g.fillStyle(0xfff6e0, a);
          g.fillEllipse(p.x, p.y, 8, 6);
          g.fillRect(p.x + 3, p.y - 14, 2, 14);
          break;
        case 'zzz':
          g.lineStyle(2, 0xfff6e0, a);
          g.lineBetween(p.x - 4, p.y - 4, p.x + 4, p.y - 4);
          g.lineBetween(p.x + 4, p.y - 4, p.x - 4, p.y + 4);
          g.lineBetween(p.x - 4, p.y + 4, p.x + 4, p.y + 4);
          break;
        case 'smoke':
          g.fillStyle(0xa9b0d6, a * 0.5);
          g.fillCircle(p.x, p.y, 5 + p.life * 14);
          break;
      }
    }
  }
}

// ---------- Utilitaires de dessin ----------

function drawOpenEye(
  g: Phaser.GameObjects.Graphics,
  e: { x: number; y: number },
  lx: number,
  ly: number,
): void {
  g.fillStyle(INK, 1);
  g.fillEllipse(e.x, e.y, 9, 12);
  g.fillStyle(WHITE, 1);
  g.fillCircle(e.x - 1.5 + lx * 0.3, e.y - 2.5 + ly * 0.3, 2.2);
}

/** Angles (degrés depuis le haut, sens horaire) et longueurs des bras selon le geste. */
function armAngles(
  arms: Arms,
  t: number,
  look: { x: number; y: number },
): { left: number; right: number; lenL: number; lenR: number } {
  const L = 1.35;
  switch (arms) {
    case 'up':
      return { right: 30, left: -30, lenL: L * 1.1, lenR: L * 1.1 };
    case 'wave':
      return {
        right: 25 + Math.sin(t * 18) * 25,
        left: -25 - Math.sin(t * 18 + 1) * 25,
        lenL: L,
        lenR: L,
      };
    case 'wide':
      return { right: 90, left: -90, lenL: L * 1.1, lenR: L * 1.1 };
    case 'down':
      return { right: 125, left: -125, lenL: L * 0.95, lenR: L * 0.95 };
    case 'point': {
      const a = Phaser.Math.RadToDeg(Math.atan2(look.x, -look.y));
      return { right: Phaser.Math.Clamp(a, 20, 160), left: -110, lenL: L, lenR: L * 1.35 };
    }
    case 'cover':
      return { right: 200, left: 160, lenL: 0.75, lenR: 0.75 };
    case 'pray':
      return { right: 185, left: 175, lenL: 0.95, lenR: 0.95 };
    case 'cross':
      return { right: 230, left: 130, lenL: 0.9, lenR: 0.9 };
    case 'flail':
      return {
        right: 60 + Math.sin(t * 22) * 50,
        left: -60 - Math.sin(t * 19) * 50,
        lenL: L,
        lenR: L,
      };
    case 'chest':
      return { right: 215, left: -100, lenL: L, lenR: 0.85 };
    case 'clap': {
      const k = (Math.sin(t * 20) + 1) / 2;
      return { right: 180 + 50 * k, left: 180 - 50 * k, lenL: 1, lenR: 1 };
    }
    case 'scratch':
      return { right: 15 + Math.sin(t * 25) * 8, left: -100, lenL: L, lenR: L * 1.15 };
    case 'bite':
      return { right: 200, left: -110, lenL: L, lenR: 0.8 };
    case 'pushup':
      return { right: 160, left: -160, lenL: L * 1.1, lenR: L * 1.1 };
    case 'steer': {
      const lean = Phaser.Math.Clamp(look.x, -1, 1) * 30;
      return {
        right: 80 + lean + Math.sin(t * 9) * 8,
        left: -80 + lean - Math.sin(t * 9) * 8,
        lenL: L,
        lenR: L,
      };
    }
    default:
      return { right: 72, left: -72, lenL: L, lenR: L };
  }
}

function fillEllipse(
  g: Phaser.GameObjects.Graphics,
  P: (x: number, y: number) => { x: number; y: number },
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  _rot: number,
): void {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const p = P(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
    pts.push(new Phaser.Math.Vector2(p.x, p.y));
  }
  g.fillPoints(pts, true);
}

function arc(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  a0: number,
  a1: number,
): void {
  g.beginPath();
  g.arc(x, y, r, a0, a1, false);
  g.strokePath();
}

function star(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  outer: number,
  inner: number,
  points: number,
  rot: number,
): void {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i * Math.PI) / points - Math.PI / 2;
    pts.push(new Phaser.Math.Vector2(x + Math.cos(a) * r, y + Math.sin(a) * r));
  }
  g.fillPoints(pts, true);
}

function blend(a: number, b: number, u: number): number {
  const k = Phaser.Math.Clamp(u, 0, 1);
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * k) << 16) |
    (Math.round(ag + (bg - ag) * k) << 8) |
    Math.round(ab + (bb - ab) * k)
  );
}

function easeOutBack(u: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (u - 1) ** 3 + c1 * (u - 1) ** 2;
}
