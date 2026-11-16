import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { staggeredGrid } from '../core/layout';
import {
  breakLitNow,
  canShoot,
  createLevel,
  endShot,
  heartsRemaining,
  hitCrystal,
  isFinalHeartLit,
  multiplier,
  startShot,
  type CrystalKind,
  type LevelState,
} from '../core/level';
import { aimGuide } from '../core/trajectory';
import { TUNING } from '../core/tuning';

/** Couleurs provisoires reprises de la direction visuelle (formes simples, aucun asset final). */
const COLORS: Record<CrystalKind, number> = {
  heart: 0xffb23f,
  common: 0x6fcbff,
  bonus: 0xff5fa2,
};
const LIT_COLOR = 0xfff6e0;
const ORB_COLOR = 0xfff6e0;
const BUCKET_COLOR = 0xb9a6ff;
const CANNON_COLOR = 0x8c93c9;

const CRYSTAL_RADIUS = 10;
const ORB_RADIUS = 8;
/** Vitesse de lancement en px par pas Matter (~16,7 ms). */
const LAUNCH_SPEED = 11;
/** Gravité effective de Matter (gravity.y = 1, scale 0.001) en px par pas². */
const GRAVITY_PER_STEP = 0.001 * (1000 / 60) ** 2;
const CANNON = { x: GAME_WIDTH / 2, y: 40 };
const BUCKET = { width: 100, height: 18, y: GAME_HEIGHT - 14 };
const MIN_AIM = Phaser.Math.DegToRad(8);
const MAX_AIM = Phaser.Math.DegToRad(172);

type CrystalView = Phaser.GameObjects.Arc | Phaser.GameObjects.Rectangle;

/** Prototype de la boucle : viser, tirer, rebondir, allumer puis briser les cristaux. */
export class GameScene extends Phaser.Scene {
  private level!: LevelState;
  private views = new Map<number, CrystalView>();
  private orb?: Phaser.GameObjects.Arc;
  private aimAngle = Math.PI / 2;
  private guide!: Phaser.GameObjects.Graphics;
  private cannon!: Phaser.GameObjects.Rectangle;
  private bucket!: Phaser.GameObjects.Rectangle;
  private bucketDir = 1;
  private hud!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private stuckRef = { x: 0, y: 0, t: 0 };

  constructor() {
    super('Game');
  }

  create(): void {
    this.views.clear();
    this.orb = undefined;
    this.setTimeScale(1);
    this.level = createLevel(staggeredGrid(9, 9, 80, 160, 80, 40));

    // Murs gauche, droit et haut ; le bas est ouvert.
    this.matter.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT, 64, true, true, true, false);

    for (const c of this.level.crystals)
      this.views.set(c.id, this.makeCrystal(c.id, c.x, c.y, c.kind));

    this.cannon = this.add.rectangle(CANNON.x, CANNON.y, 36, 14, CANNON_COLOR).setOrigin(0, 0.5);
    this.add.circle(CANNON.x, CANNON.y, 16, CANNON_COLOR);
    this.bucket = this.add.rectangle(
      GAME_WIDTH / 2,
      BUCKET.y,
      BUCKET.width,
      BUCKET.height,
      BUCKET_COLOR,
    );
    this.guide = this.add.graphics();
    this.hud = this.add.text(12, 10, '', {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#F4F1FF',
    });
    this.banner = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', {
        fontFamily: 'sans-serif',
        fontSize: '32px',
        color: '#F4F1FF',
        align: 'center',
        backgroundColor: '#1B2350',
        padding: { x: 24, y: 16 },
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setVisible(false);

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.aimAt(p));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.level.phase === 'won' || this.level.phase === 'lost') {
        this.scene.restart();
        return;
      }
      this.aimAt(p);
      this.shoot();
    });

    this.matter.world.on(
      'collisionstart',
      (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
        for (const pair of event.pairs) {
          const other =
            pair.bodyA.label === 'orb'
              ? pair.bodyB
              : pair.bodyB.label === 'orb'
                ? pair.bodyA
                : null;
          if (other?.label.startsWith('crystal:')) this.onCrystalHit(Number(other.label.slice(8)));
        }
      },
    );

    this.refreshHud();
  }

  update(time: number, delta: number): void {
    this.moveBucket(delta);
    this.cannon.setRotation(this.aimAngle);
    this.drawGuide();

    const orb = this.orb;
    if (!orb) return;
    const caught =
      orb.y + ORB_RADIUS >= BUCKET.y - BUCKET.height / 2 &&
      orb.y < GAME_HEIGHT &&
      Math.abs(orb.x - this.bucket.x) <= BUCKET.width / 2;
    if (caught || orb.y > GAME_HEIGHT + ORB_RADIUS * 2) {
      this.finishShot(caught);
      return;
    }
    this.checkStuck(time);
  }

  private makeCrystal(id: number, x: number, y: number, kind: CrystalKind): CrystalView {
    // Doublage forme / couleur : les cœurs sont des carrés, les autres des ronds.
    const view: CrystalView =
      kind === 'heart'
        ? this.add.rectangle(x, y, CRYSTAL_RADIUS * 1.8, CRYSTAL_RADIUS * 1.8, COLORS.heart)
        : this.add.circle(x, y, CRYSTAL_RADIUS, COLORS[kind]);
    this.matter.add.gameObject(view, {
      isStatic: true,
      label: `crystal:${id}`,
      shape: { type: 'circle', radius: CRYSTAL_RADIUS },
    });
    return view;
  }

  private aimAt(p: Phaser.Input.Pointer): void {
    const angle = Math.atan2(p.worldY - CANNON.y, p.worldX - CANNON.x);
    this.aimAngle = Phaser.Math.Clamp(angle < -Math.PI / 2 ? Math.PI : angle, MIN_AIM, MAX_AIM);
  }

  private shoot(): void {
    if (!canShoot(this.level) || !startShot(this.level)) return;
    const start = this.muzzle();
    const orb = this.add.circle(start.x, start.y, ORB_RADIUS, ORB_COLOR);
    this.matter.add.gameObject(orb, {
      label: 'orb',
      shape: { type: 'circle', radius: ORB_RADIUS },
      restitution: 0.75,
      friction: 0,
      frictionAir: 0,
    });
    (orb as unknown as Phaser.Physics.Matter.Components.Velocity).setVelocity(
      Math.cos(this.aimAngle) * LAUNCH_SPEED,
      Math.sin(this.aimAngle) * LAUNCH_SPEED,
    );
    this.orb = orb;
    this.stuckRef = { x: start.x, y: start.y, t: this.time.now };
    this.refreshHud();
  }

  private onCrystalHit(id: number): void {
    if (hitCrystal(this.level, id) === 0) return;
    const view = this.views.get(id);
    view?.setFillStyle(LIT_COLOR);
    if (isFinalHeartLit(this.level)) this.setTimeScale(0.3); // ralenti sur le dernier cœur
    this.refreshHud();
  }

  private finishShot(caught: boolean): void {
    this.orb?.destroy();
    this.orb = undefined;
    this.setTimeScale(1);
    const result = endShot(this.level, caught);
    this.removeViews(result.removedIds);
    // Le cristal bonus a pu changer de place.
    for (const c of this.level.crystals) {
      this.views.get(c.id)?.setFillStyle(COLORS[c.kind]);
    }
    if (result.phase === 'won')
      this.showBanner(`Victoire !\nScore : ${this.level.score}\nCliquer pour rejouer`);
    if (result.phase === 'lost') this.showBanner('Plus d’orbes…\nEncore une fois ?');
    if (caught) this.cameras.main.flash(120, 185, 166, 255);
    this.refreshHud();
  }

  /** Anti-blocage : orbe presque immobile depuis 3 s → les cristaux allumés autour se brisent. */
  private checkStuck(time: number): void {
    const orb = this.orb;
    if (!orb) return;
    if (Math.hypot(orb.x - this.stuckRef.x, orb.y - this.stuckRef.y) > 12) {
      this.stuckRef = { x: orb.x, y: orb.y, t: time };
      return;
    }
    if (time - this.stuckRef.t < TUNING.antiStuckSeconds * 1000) return;
    const near = this.level.crystals
      .filter((c) => Math.hypot(c.x - orb.x, c.y - orb.y) < CRYSTAL_RADIUS + ORB_RADIUS + 12)
      .map((c) => c.id);
    this.removeViews(breakLitNow(this.level, near));
    this.stuckRef.t = time;
  }

  private removeViews(ids: number[]): void {
    for (const id of ids) {
      this.views.get(id)?.destroy();
      this.views.delete(id);
    }
  }

  private moveBucket(delta: number): void {
    const speed = GAME_WIDTH / TUNING.bucketCrossSeconds; // px par seconde
    const half = BUCKET.width / 2;
    this.bucket.x += this.bucketDir * speed * (delta / 1000);
    if (this.bucket.x > GAME_WIDTH - half) this.bucketDir = -1;
    if (this.bucket.x < half) this.bucketDir = 1;
    this.bucket.x = Phaser.Math.Clamp(this.bucket.x, half, GAME_WIDTH - half);
  }

  private drawGuide(): void {
    this.guide.clear();
    if (!canShoot(this.level)) return;
    const start = this.muzzle();
    const points = aimGuide({
      x: start.x,
      y: start.y,
      vx: Math.cos(this.aimAngle) * LAUNCH_SPEED,
      vy: Math.sin(this.aimAngle) * LAUNCH_SPEED,
      gravity: GRAVITY_PER_STEP,
      radius: ORB_RADIUS,
      minX: 0,
      maxX: GAME_WIDTH,
      maxY: GAME_HEIGHT,
      obstacles: this.level.crystals.map((c) => ({ x: c.x, y: c.y, r: CRYSTAL_RADIUS })),
    });
    this.guide.fillStyle(LIT_COLOR, 0.6);
    points.forEach((pt, i) => {
      if (i % 3 === 0) this.guide.fillCircle(pt.x, pt.y, 3);
    });
  }

  private muzzle(): { x: number; y: number } {
    return {
      x: CANNON.x + Math.cos(this.aimAngle) * 36,
      y: CANNON.y + Math.sin(this.aimAngle) * 36,
    };
  }

  private setTimeScale(scale: number): void {
    this.matter.world.engine.timing.timeScale = scale;
  }

  private showBanner(text: string): void {
    this.banner.setText(text).setVisible(true);
  }

  private refreshHud(): void {
    const s = this.level;
    this.hud.setText(
      `Orbes : ${s.orbs}   Cœurs restants : ${heartsRemaining(s)}/${s.heartsTotal}   ` +
        `Score : ${s.score}   ×${multiplier(s)}`,
    );
  }
}
