import Phaser from 'phaser';
import { audio } from '../audio';
import { GAME_HEIGHT, GAME_WIDTH, PLAYFIELD, toWorld } from '../config';
import { PIP } from '../companions/pip';
import { debugEnabled, mountDebugPanel } from '../debug/debugPanel';
import { gameEvents, type GameEventName } from '../core/events';
import {
  breakLitNow,
  canShoot,
  endShot,
  heartsRemaining,
  hitCrystal,
  isFinalHeartLit,
  multiplier,
  startShot,
  type Crystal,
  type LevelState,
} from '../core/level';
import type { LevelData } from '../core/levelFormat';
import { levelFromData } from '../core/levelSetup';
import { FINAL_ZONES, finalZoneAt } from '../core/finalZones';
import { PIP_POWER, RevealCharges } from '../core/powers';
import { markSeen, writeSave, type SaveData } from '../core/save';
import {
  ShotTracker,
  edgeDistance,
  type DetectedEvent,
  type HeartTarget,
} from '../core/shotEvents';
import { aimGuide, predictPath } from '../core/trajectory';
import { TUNING } from '../core/tuning';
import { REGISTRY, SCENES } from './keys';
import { CompanionView } from './CompanionView';
import type { ResultsData } from './ResultsScene';
import { CRYSTAL_COLORS, CRYSTAL_COLORS_CB, PALETTE, textStyle, TEXT } from './theme';
import { button } from './widgets';

export interface GameSceneData {
  level: LevelData;
  /** Lancé depuis l'éditeur : pas de sauvegarde, pas de carte. */
  test?: boolean;
}

const ORB_RADIUS = 8;
/** Vitesse de lancement en px par pas Matter (~16,7 ms). */
const LAUNCH_SPEED = 11;
/** Gravité effective de Matter (gravity.y = 1, scale 0.001) en px par pas². */
const GRAVITY_PER_STEP = 0.001 * (1000 / 60) ** 2;
const CANNON = { x: PLAYFIELD.x + PLAYFIELD.w / 2, y: PLAYFIELD.y + 24 };
const BUCKET = { width: 100, height: 18, y: GAME_HEIGHT - 14 };
const MIN_AIM = Phaser.Math.DegToRad(8);
const MAX_AIM = Phaser.Math.DegToRad(172);
const WALL_THICKNESS = 40;
/** Délai entre la fin du dernier tir et l'écran de résultats (laisse l'Astre réagir). */
const RESULTS_DELAY_MS = 1400;
/** Final au ralenti (GD) : tout le jeu à 0,25 pendant 1,5 s réelles au maximum. */
const SLOWMO = { scale: 0.25, maxRealMs: 1500 };
/** Loge de l'Astre : colonne gauche sous le compteur d'orbes (pieds de l'Astre). */
const COMPANION_ANCHOR = { x: 100, y: 400 };
/** L'orbe « frôle » un cœur (réaction « oh ! » de l'Astre). */
const NEAR_HEART_PX = 20;
const HEART_RADIUS = 10;
/** Restitution effective des rebonds (Matter : max orbe / obstacle). */
const ORB_RESTITUTION = 0.75;
const PIP_COLOR = 0xffe45c;

type CrystalView = Phaser.GameObjects.Arc | Phaser.GameObjects.Rectangle;

/**
 * Scène de jeu : un niveau JSON, la boucle viser / tirer / rebondir / briser.
 * Elle émet les événements de jeu sur `gameEvents` (Astres, UI, son).
 * HUD provisoire dans les marges ; le HUD final vient de l'UI/UX.
 */
export class GameScene extends Phaser.Scene {
  private sceneData!: GameSceneData;
  private level!: LevelState;
  private colors = CRYSTAL_COLORS;
  private views = new Map<number, CrystalView>();
  private orb?: Phaser.GameObjects.Arc;
  private aimAngle = Math.PI / 2;
  private guide!: Phaser.GameObjects.Graphics;
  private cannon!: Phaser.GameObjects.Rectangle;
  private bucket!: Phaser.GameObjects.Rectangle;
  private bucketDir = 1;
  private hud!: {
    orbs: Phaser.GameObjects.Text;
    hearts: Phaser.GameObjects.Text;
    mult: Phaser.GameObjects.Text;
    score: Phaser.GameObjects.Text;
  };
  private stuckRef = { x: 0, y: 0, t: 0 };
  private chain = 0;
  private ending = false;
  private tracker = new ShotTracker();
  private companion?: CompanionView;
  private slowmoUntil = 0;
  private gameScale = 1;
  private reveal = new RevealCharges();
  /** Le dernier cœur est touché : l'orbe finit sa course dans les zones de bonus. */
  private finalShot = false;
  private finalZonesGfx?: Phaser.GameObjects.Container;
  private debugForceFinal = false;
  /** create() a lancé une cinématique à la place du niveau. */
  private redirecting = false;
  private chargeDots?: Phaser.GameObjects.Graphics;

  constructor() {
    super(SCENES.game);
  }

  init(data: GameSceneData): void {
    this.sceneData = data;
  }

  create(): void {
    // Réveil de Pip (vignette B0) au tout premier lancement du 1-1.
    const firstSave = this.registry.get(REGISTRY.save) as SaveData | undefined;
    if (
      !this.sceneData.test &&
      this.sceneData.level.id === 'ch1-1' &&
      firstSave &&
      markSeen(firstSave, 'reveil_pip')
    ) {
      writeSave(firstSave);
      this.redirecting = true;
      this.scene.start(SCENES.cutscene, {
        sequence: 'reveil_pip',
        next: { scene: SCENES.game, data: this.sceneData },
      });
      return;
    }
    this.redirecting = false;
    this.views.clear();
    this.orb = undefined;
    this.ending = false;
    this.slowmoUntil = 0;
    this.finalShot = false;
    this.finalZonesGfx = undefined;
    this.setTimeScale(1);
    this.tracker = new ShotTracker();
    this.reveal = new RevealCharges();
    const save = this.registry.get(REGISTRY.save) as SaveData | undefined;
    this.colors = save?.options.colorblind ? CRYSTAL_COLORS_CB : CRYSTAL_COLORS;
    this.level = levelFromData(this.sceneData.level);

    this.drawFrame();
    this.makeWalls();
    for (const c of this.level.crystals) this.views.set(c.id, this.makeCrystal(c));

    this.cannon = this.add.rectangle(CANNON.x, CANNON.y, 36, 14, PALETTE.cannon).setOrigin(0, 0.5);
    this.add.circle(CANNON.x, CANNON.y, 16, PALETTE.cannon);
    this.bucket = this.add.rectangle(
      GAME_WIDTH / 2,
      BUCKET.y,
      BUCKET.width,
      BUCKET.height,
      PALETTE.bucket,
    );
    this.guide = this.add.graphics();
    this.makeHud();
    this.makeCompanion();

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.aimAt(p));
    // Souris : clic = tir. Tactile : on vise en glissant, le tir part au relâcher (règle GD).
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y < PLAYFIELD.y) return; // bandeau haut (bouton pause)
      this.aimAt(p);
      if (!p.wasTouch) this.shoot();
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch || p.downY < PLAYFIELD.y) return;
      this.aimAt(p);
      this.shoot();
    });
    const kb = this.input.keyboard;
    kb?.on('keydown-SPACE', () => this.shoot());
    kb?.on('keydown-ESC', () => this.openPause());
    kb?.on('keydown-P', () => this.openPause());

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
          if (!other) continue;
          if (other.label.startsWith('crystal:')) this.onCrystalHit(Number(other.label.slice(8)));
          else if (other.label === 'wall') {
            gameEvents.emit('mur_touche', {});
            this.emitAll(this.tracker.bounced());
          }
        }
      },
    );

    const unmountDebug = debugEnabled() ? this.mountDebug() : undefined;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.companion?.destroy();
      this.companion = undefined;
      unmountDebug?.();
      if (!this.ending) audio.music.stop(); // retour carte depuis la pause
    });
    gameEvents.emit('niveau_debut', {
      levelId: this.sceneData.level.id,
      chapter: this.sceneData.level.chapter,
    });

    this.refreshHud();
    this.refreshPower();
    this.emitAll(this.tracker.beginAiming(heartsRemaining(this.level), this.level.orbs));
  }

  update(time: number, realDelta: number): void {
    if (this.redirecting) return;
    this.updateSlowmo(time);
    const delta = realDelta * this.gameScale;
    this.moveBucket(delta);
    this.cannon.setRotation(this.aimAngle);
    this.handleKeyboardAim(delta);
    this.drawGuide();

    const orb = this.orb;
    this.updateCompanion(delta / 1000, orb);
    if (!orb) {
      if (!this.ending && canShoot(this.level))
        this.emitAll(this.tracker.updateAiming(realDelta / 1000));
      return;
    }
    audio.flight(Phaser.Math.Clamp((orb.y - PLAYFIELD.y) / PLAYFIELD.h, 0, 1));
    this.trackOrb(orb);
    const caught =
      !this.finalShot &&
      orb.y + ORB_RADIUS >= BUCKET.y - BUCKET.height / 2 &&
      orb.y < GAME_HEIGHT &&
      Math.abs(orb.x - this.bucket.x) <= BUCKET.width / 2;
    if (caught || orb.y > GAME_HEIGHT + ORB_RADIUS * 2) {
      this.finishShot(caught);
      return;
    }
    this.checkStuck(time);
  }

  // --- Construction -------------------------------------------------------

  private drawFrame(): void {
    const g = this.add.graphics();
    g.fillStyle(PALETTE.night, 0.35).fillRect(PLAYFIELD.x, PLAYFIELD.y, PLAYFIELD.w, PLAYFIELD.h);
    g.lineStyle(2, PALETTE.border).strokeLineShape(
      new Phaser.Geom.Line(PLAYFIELD.x, PLAYFIELD.y, PLAYFIELD.x, GAME_HEIGHT),
    );
    g.strokeLineShape(
      new Phaser.Geom.Line(
        PLAYFIELD.x + PLAYFIELD.w,
        PLAYFIELD.y,
        PLAYFIELD.x + PLAYFIELD.w,
        GAME_HEIGHT,
      ),
    );
  }

  /** Murs gauche, droit et haut de la zone de jeu ; le bas reste ouvert. */
  private makeWalls(): void {
    const t = WALL_THICKNESS;
    const { x, y, w, h } = PLAYFIELD;
    const opts = { isStatic: true, label: 'wall', restitution: 0.6 };
    this.matter.add.rectangle(x - t / 2, y + h / 2, t, h + t * 2, opts);
    this.matter.add.rectangle(x + w + t / 2, y + h / 2, t, h + t * 2, opts);
    this.matter.add.rectangle(x + w / 2, y - t / 2, w + t * 2, t, opts);
  }

  private makeCrystal(c: Crystal): CrystalView {
    const { x, y } = toWorld(c);
    const color = this.colors[c.kind];
    const shape = c.shape ?? { type: 'circle', r: 10 };
    const label = `crystal:${c.id}`;
    if (shape.type === 'brick') {
      const view = this.add.rectangle(x, y, shape.w, shape.h, color);
      this.matter.add.gameObject(view, { isStatic: true, label });
      view.setRotation(Phaser.Math.DegToRad(shape.angle));
      return view;
    }
    // Doublage forme / couleur : cœurs carrés, pouvoirs en losange, les autres ronds.
    const r = shape.r;
    let view: CrystalView;
    if (c.kind === 'heart') view = this.add.rectangle(x, y, r * 1.8, r * 1.8, color);
    else if (c.kind === 'power') view = this.add.rectangle(x, y, r * 1.6, r * 1.6, color);
    else view = this.add.circle(x, y, r, color);
    this.matter.add.gameObject(view, {
      isStatic: true,
      label,
      shape: { type: 'circle', radius: r },
    });
    // L'angle d'affichage suit celui du corps Matter : on tourne le corps (losange).
    if (c.kind === 'power')
      this.matter.body.setAngle(view.body as MatterJS.BodyType, Math.PI / 4, false);
    return view;
  }

  private makeHud(): void {
    const s = textStyle(26);
    const small = textStyle(16, TEXT.dim);
    this.add.text(100, 120, 'Orbes', small).setOrigin(0.5);
    this.add.text(GAME_WIDTH - 100, 120, 'Cœurs', small).setOrigin(0.5);
    this.add.text(GAME_WIDTH - 100, 260, 'Multiplicateur', small).setOrigin(0.5);
    this.hud = {
      orbs: this.add.text(100, 160, '', s).setOrigin(0.5),
      hearts: this.add.text(GAME_WIDTH - 100, 160, '', textStyle(26, '#FFB23F')).setOrigin(0.5),
      mult: this.add.text(GAME_WIDTH - 100, 300, '', s).setOrigin(0.5),
      score: this.add.text(PLAYFIELD.x, 32, '', s).setOrigin(0, 0.5),
    };
    button(this, GAME_WIDTH - 60, 32, 'II', () => this.openPause(), { width: 64, size: 20 });
  }

  private makeCompanion(): void {
    // ?astre=pip force l'Astre sur n'importe quel niveau (tests QA).
    const forced = new URLSearchParams(window.location.search).get('astre');
    const id = forced ?? this.sceneData.level.companion;
    if (id !== 'pip') return; // prologue sans Astre ; les autres Astres arrivent au jalon 2
    this.companion = new CompanionView(this, PIP, COMPANION_ANCHOR);
    this.companion.attach();
    this.chargeDots = this.add.graphics();
  }

  private updateCompanion(dt: number, orb?: Phaser.GameObjects.Arc): void {
    const c = this.companion;
    if (!c) return;
    if (orb) {
      const v = (orb.body as MatterJS.BodyType | null)?.velocity ?? { x: 0, y: 0 };
      c.update(dt, {
        orb: { x: orb.x, y: orb.y, vy: v.y * 60 },
        orbDepth: (orb.y - PLAYFIELD.y) / PLAYFIELD.h,
        orbNearHeart: this.unlitHearts().some(
          (h) =>
            edgeDistance({ x: orb.x, y: orb.y, vx: 0, vy: 0, r: ORB_RADIUS }, h) < NEAR_HEART_PX,
        ),
      });
    } else {
      const m = this.muzzle();
      c.update(dt, {
        aim: { x: m.x + Math.cos(this.aimAngle) * 300, y: m.y + Math.sin(this.aimAngle) * 300 },
      });
    }
  }

  /** Cœurs pas encore touchés, en coordonnées écran. */
  private unlitHearts(): HeartTarget[] {
    return this.level.crystals
      .filter((c) => c.kind === 'heart' && !c.lit)
      .map((c) => {
        const w = toWorld(c);
        const r = c.shape?.type === 'circle' ? c.shape.r : HEART_RADIUS;
        return { id: c.id, x: w.x, y: w.y, r };
      });
  }

  /** Suivi de l'orbe : presque, final au ralenti. */
  private trackOrb(orb: Phaser.GameObjects.Arc): void {
    const v = (orb.body as MatterJS.BodyType | null)?.velocity ?? { x: 0, y: 0 };
    // Vitesse Matter en px par pas (à l'échelle de temps courante) -> px/s réels de jeu.
    const perSecond = 60 * (this.gameScale === 1 ? 1 : 1 / this.gameScale);
    this.emitAll(
      this.tracker.orbMoved(
        { x: orb.x, y: orb.y, vx: v.x * perSecond, vy: v.y * perSecond, r: ORB_RADIUS },
        this.unlitHearts(),
      ),
    );
  }

  /** Relaie sur le bus les événements détectés par le ShotTracker. */
  private emitAll(events: DetectedEvent[]): void {
    for (const e of events) {
      if (e === 'final_ralenti') this.startSlowmo();
      if (e === 'pouvoir_active' && this.companion) {
        this.reveal.gain();
        this.refreshPower();
      }
      const data =
        e === 'gros_coup'
          ? { hits: this.tracker.shotHits }
          : e === 'chaine_longue'
            ? { bounces: this.tracker.shotBounces, shotScore: this.level.shotScore }
            : e === 'tir_lance'
              ? { angle: this.aimAngle }
              : e === 'pouvoir_active'
                ? { astre: this.sceneData.level.companion ?? 'aucun' }
                : e === 'victoire' || e === 'echec'
                  ? { score: this.level.score }
                  : {};
      gameEvents.emit(e as GameEventName, data as never);
    }
  }

  /** Tir final : le réceptacle laisse place aux zones 1 000 / 2 500 / 5 000. */
  private showFinalZones(): void {
    if (this.finalShot) return;
    this.finalShot = true;
    this.bucket.setVisible(false);
    const h = 34;
    const y = GAME_HEIGHT - h;
    const c = this.add.container(0, 0).setDepth(5).setAlpha(0);
    FINAL_ZONES.forEach((z, i) => {
      const x0 = PLAYFIELD.x + z.from * PLAYFIELD.w;
      const w = (z.to - z.from) * PLAYFIELD.w;
      const strength = z.points / 5000;
      const rect = this.add
        .rectangle(x0 + 1, y, w - 2, h, PALETTE.bucket, 0.25 + strength * 0.45)
        .setOrigin(0)
        .setName(`zone-${i}`);
      const label = this.add
        .text(x0 + w / 2, y + h / 2, z.points.toLocaleString('fr-FR'), textStyle(18))
        .setOrigin(0.5);
      c.add([rect, label]);
    });
    this.finalZonesGfx = c;
    this.tweens.add({ targets: c, alpha: 1, duration: 250 });
  }

  private scoreFinalZone(orbX: number): void {
    const { index, zone } = finalZoneAt((orbX - PLAYFIELD.x) / PLAYFIELD.w);
    this.level.score += zone.points; // hors multiplicateur
    const rect = this.finalZonesGfx?.getByName(
      `zone-${index}`,
    ) as Phaser.GameObjects.Rectangle | null;
    if (rect) {
      rect.setFillStyle(PALETTE.lit, 1);
      const pop = this.add
        .text(
          rect.x + rect.width / 2,
          rect.y - 24,
          `+${zone.points.toLocaleString('fr-FR')}`,
          textStyle(28, '#FFE45C'),
        )
        .setOrigin(0.5)
        .setDepth(6);
      this.tweens.add({
        targets: pop,
        y: pop.y - 50,
        alpha: 0,
        duration: 1200,
        ease: 'Cubic.easeOut',
      });
    }
    this.cameras.main.flash(160, 255, 228, 92);
  }

  /** ?debug=1 : panneau QA (événements, pouvoir, orbes, cœurs, état de l'Astre). */
  private mountDebug(): () => void {
    return mountDebugPanel({
      gainPower: () => this.emitAll(['pouvoir_active']),
      setOrbs: (n) => {
        this.level.orbs = n;
        this.refreshHud();
      },
      keepHearts: (n) => {
        const hearts = this.level.crystals.filter((c) => c.kind === 'heart' && !c.lit);
        const drop = hearts.slice(0, Math.max(0, hearts.length - n)).map((c) => c.id);
        this.level.crystals = this.level.crystals.filter((c) => !drop.includes(c.id));
        this.removeViews(drop);
        this.refreshHud();
      },
      forceFinal: () => {
        this.debugForceFinal = true;
      },
      status: () => {
        const s = this.companion?.brain.state;
        const astre = s
          ? `astre: phase=${s.phase} réaction=${s.reaction ?? '-'} tendu=${s.tense ?? '-'} dort=${s.sleeping} jauge=${s.excitement.toFixed(2)}`
          : 'astre: aucun (?astre=pip pour forcer)';
        return `${astre} · pouvoir=${this.reveal.charges} · orbes=${this.level.orbs} · cœurs=${heartsRemaining(this.level)} · échelle=${this.gameScale}`;
      },
    });
  }

  private startSlowmo(): void {
    if (this.slowmoUntil > 0) return;
    this.slowmoUntil = this.time.now + SLOWMO.maxRealMs;
    this.applyGameScale(SLOWMO.scale);
  }

  private updateSlowmo(now: number): void {
    if (this.slowmoUntil > 0 && now >= this.slowmoUntil) {
      this.slowmoUntil = -1; // une seule fois par tir
      this.applyGameScale(1);
    }
  }

  /** Échelle de temps de tout le jeu : physique, réceptacle, tweens, Astre. */
  private applyGameScale(scale: number): void {
    this.gameScale = scale;
    this.setTimeScale(scale);
    this.tweens.timeScale = scale;
  }

  // --- Tir ------------------------------------------------------------------

  private aimAt(p: Phaser.Input.Pointer): void {
    const angle = Math.atan2(p.worldY - CANNON.y, p.worldX - CANNON.x);
    this.aimAngle = Phaser.Math.Clamp(angle < -Math.PI / 2 ? Math.PI : angle, MIN_AIM, MAX_AIM);
  }

  /** Clavier en bonus (principe UI) : flèches gauche / droite pour viser. */
  private handleKeyboardAim(delta: number): void {
    const cursors = this.input.keyboard?.createCursorKeys();
    if (!cursors) return;
    const step = (delta / 1000) * 1.2;
    if (cursors.left.isDown) this.aimAngle = Math.min(MAX_AIM, this.aimAngle + step);
    if (cursors.right.isDown) this.aimAngle = Math.max(MIN_AIM, this.aimAngle - step);
  }

  private shoot(): void {
    if (this.ending || !canShoot(this.level) || !startShot(this.level)) return;
    const start = this.muzzle();
    const orb = this.add.circle(start.x, start.y, ORB_RADIUS, PALETTE.orb);
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
    this.chain = 0;
    this.slowmoUntil = 0;
    this.stuckRef = { x: start.x, y: start.y, t: this.time.now };
    this.companion?.setPhase('flight');
    this.reveal.fire();
    this.refreshPower();
    this.emitAll(this.tracker.shotFired());
    if (this.debugForceFinal) {
      this.debugForceFinal = false;
      for (const c of this.level.crystals)
        if (c.kind === 'heart' && !c.lit) this.onCrystalHit(c.id);
    }
    this.refreshHud();
  }

  private onCrystalHit(id: number): void {
    const crystal = this.level.crystals.find((c) => c.id === id);
    if (crystal?.kind === 'wall') {
      gameEvents.emit('mur_touche', {});
      this.emitAll(this.tracker.bounced());
      return;
    }
    const points = hitCrystal(this.level, id);
    if (!crystal) return;
    if (points === 0) {
      this.emitAll(this.tracker.bounced()); // rebond sur un cristal déjà allumé
      return;
    }
    this.chain += 1;
    this.views.get(id)?.setFillStyle(PALETTE.lit);
    gameEvents.emit('cristal_allume', { kind: crystal.kind, chain: this.chain, points });
    this.emitAll(this.tracker.crystalLit(crystal.kind, this.level.shotScore, crystal.id));
    if (isFinalHeartLit(this.level)) {
      // Filet de sécurité : le dernier cœur touché sans prédiction préalable.
      if (this.slowmoUntil === 0) this.emitAll(['final_ralenti']);
      this.showFinalZones();
    }
    this.refreshHud();
  }

  private finishShot(caught: boolean): void {
    if (this.finalShot && this.orb) this.scoreFinalZone(this.orb.x);
    this.orb?.destroy();
    this.orb = undefined;
    this.applyGameScale(1);
    const result = endShot(this.level, caught);
    this.removeViews(result.removedIds);
    if (result.removedIds.length > 0) {
      gameEvents.emit('cristaux_brises', { count: result.removedIds.length });
    }
    if (caught) this.cameras.main.flash(120, 185, 166, 255);
    // Le cristal bonus a pu changer de place.
    for (const c of this.level.crystals) {
      if (!c.lit) this.views.get(c.id)?.setFillStyle(this.colors[c.kind]);
    }
    this.refreshHud();
    this.reveal.endShot();
    this.refreshPower();
    const bilan = this.tracker.shotEnded(caught, result.phase);
    if (result.phase === 'aiming') this.companion?.setPhase('aiming');
    else this.companion?.setPhase('over');
    this.emitAll(bilan);
    if (bilan.length === 0) this.companion?.brain.onShotEndQuiet();
    if (result.phase === 'won') this.endLevel(true);
    else if (result.phase === 'lost') this.endLevel(false);
    else this.emitAll(this.tracker.beginAiming(heartsRemaining(this.level), this.level.orbs));
  }

  private endLevel(won: boolean): void {
    this.ending = true;
    const payload: ResultsData = {
      level: this.sceneData.level,
      score: this.level.score,
      won,
      orbsLeft: this.level.orbs,
      test: this.sceneData.test,
    };
    this.time.delayedCall(RESULTS_DELAY_MS, () => this.scene.start(SCENES.results, payload));
  }

  /** Anti-blocage : orbe presque immobile depuis 3 s -> les cristaux allumés autour se brisent. */
  private checkStuck(time: number): void {
    const orb = this.orb;
    if (!orb) return;
    if (Math.hypot(orb.x - this.stuckRef.x, orb.y - this.stuckRef.y) > 12) {
      this.stuckRef = { x: orb.x, y: orb.y, t: time };
      return;
    }
    if (time - this.stuckRef.t < TUNING.antiStuckSeconds * 1000) return;
    const near = this.level.crystals
      .filter((c) => {
        const w = toWorld(c);
        const reach = c.shape?.type === 'brick' ? Math.max(c.shape.w, c.shape.h) / 2 : 10;
        return Math.hypot(w.x - orb.x, w.y - orb.y) < reach + ORB_RADIUS + 12;
      })
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

  // --- Divers ---------------------------------------------------------------

  private openPause(): void {
    if (this.ending || this.scene.isPaused()) return;
    this.scene.pause();
    this.scene.launch(SCENES.pause, { test: this.sceneData.test });
  }

  private moveBucket(delta: number): void {
    const speed = PLAYFIELD.w / TUNING.bucketCrossSeconds; // px par seconde
    const half = BUCKET.width / 2;
    const min = PLAYFIELD.x + half;
    const max = PLAYFIELD.x + PLAYFIELD.w - half;
    this.bucket.x += this.bucketDir * speed * (delta / 1000);
    if (this.bucket.x > max) this.bucketDir = -1;
    if (this.bucket.x < min) this.bucketDir = 1;
    this.bucket.x = Phaser.Math.Clamp(this.bucket.x, min, max);
  }

  private drawGuide(): void {
    this.guide.clear();
    if (this.ending || !canShoot(this.level)) return;
    const start = this.muzzle();
    const input = {
      x: start.x,
      y: start.y,
      vx: Math.cos(this.aimAngle) * LAUNCH_SPEED,
      vy: Math.sin(this.aimAngle) * LAUNCH_SPEED,
      gravity: GRAVITY_PER_STEP,
      radius: ORB_RADIUS,
      minX: PLAYFIELD.x,
      maxX: PLAYFIELD.x + PLAYFIELD.w,
      maxY: GAME_HEIGHT,
      obstacles: this.level.crystals.map((c) => {
        const w = toWorld(c);
        const r = c.shape?.type === 'brick' ? Math.min(c.shape.w, c.shape.h) / 2 : 10;
        return { x: w.x, y: w.y, r };
      }),
    };
    if (this.reveal.previewing) {
      // Pouvoir de Pip : trajectoire révélée jusqu'au 3e rebond ou 1,5 s.
      const path = predictPath({
        ...input,
        restitution: ORB_RESTITUTION,
        maxBounces: PIP_POWER.previewBounces,
        maxSteps: Math.round(PIP_POWER.previewSeconds * 60),
      });
      const pulse = 0.55 + 0.25 * Math.sin(this.time.now / 150);
      this.guide.fillStyle(PIP_COLOR, pulse);
      path.points.forEach((pt, i) => {
        if (i % 3 === 0) this.guide.fillCircle(pt.x, pt.y, 3.5);
      });
      this.guide.lineStyle(2, PIP_COLOR, 0.8);
      for (const b of path.bounces) this.guide.strokeCircle(b.x, b.y, 7);
      return;
    }
    const points = aimGuide(input);
    this.guide.fillStyle(PALETTE.lit, 0.6);
    points.forEach((pt, i) => {
      if (i % 3 === 0) this.guide.fillCircle(pt.x, pt.y, 3);
    });
  }

  /** Charges du pouvoir sous l'Astre (pastilles) et mèche en antenne. */
  private refreshPower(): void {
    this.companion?.brain.setPowered(this.reveal.previewing || this.reveal.shotIsPowered);
    const g = this.chargeDots;
    if (!g) return;
    g.clear();
    const n = PIP_POWER.maxCharges;
    for (let i = 0; i < n; i++) {
      const x = COMPANION_ANCHOR.x - ((n - 1) * 18) / 2 + i * 18;
      const y = COMPANION_ANCHOR.y + 34;
      if (i < this.reveal.charges) g.fillStyle(PIP_COLOR, 1).fillCircle(x, y, 6);
      else g.lineStyle(2, PIP_COLOR, 0.35).strokeCircle(x, y, 6);
    }
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

  private refreshHud(): void {
    const s = this.level;
    this.hud.orbs.setText(String(s.orbs)).setColor(s.orbs <= 1 ? '#FF7A6B' : TEXT.main);
    this.hud.hearts.setText(`${heartsRemaining(s)}/${s.heartsTotal}`);
    this.hud.mult.setText(`×${multiplier(s)}`);
    this.hud.score.setText(`Score  ${s.score}`);
  }
}
