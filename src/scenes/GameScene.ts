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
import {
  GRAVITY_PER_STEP,
  ORB_PHYSICS,
  applyMatterInternals,
  type MatterInternals,
} from '../core/physics';
import { PIP_POWER, RevealCharges } from '../core/powers';
import { failsBeforeFirstWin, markSeen, writeSave, type SaveData } from '../core/save';
import {
  EVENT_THRESHOLDS,
  ShotTracker,
  edgeDistance,
  type DetectedEvent,
  type HeartTarget,
} from '../core/shotEvents';
import { aimGuide, predictPath, robustContactStep, type Circle } from '../core/trajectory';
import { levelLabel } from '../core/levelCatalog';
import { ScoreBreakdown } from '../core/scoreBreakdown';
import { TUNING } from '../core/tuning';
import { OPTIONS_CHANGED, REGISTRY, SCENES, STORY_LEVELS } from './keys';
import { CompanionView } from './CompanionView';
import type { ResultsData } from './ResultsScene';
import { CRYSTAL_COLORS, CRYSTAL_COLORS_CB, PALETTE, textStyle } from './theme';
import { GameHud, HUD_LAYOUT } from './Hud';
import { button } from './widgets';

export interface GameSceneData {
  level: LevelData;
  /** Lancé depuis l'éditeur : pas de sauvegarde, pas de carte. */
  test?: boolean;
}

const ORB_RADIUS = 8;
/** Vitesse de lancement en px par pas de référence Matter (~16,7 ms), voir core/physics.ts. */
const LAUNCH_SPEED = ORB_PHYSICS.launchSpeed;
const CANNON = { x: PLAYFIELD.x + PLAYFIELD.w / 2, y: PLAYFIELD.y + 24 };
const BUCKET = { width: 100, height: 18, y: GAME_HEIGHT - 14 };
const MIN_AIM = Phaser.Math.DegToRad(8);
const MAX_AIM = Phaser.Math.DegToRad(172);
const WALL_THICKNESS = 40;
/** Délai entre la fin du dernier tir et l'overlay de victoire (laisse l'Astre réagir). */
const RESULTS_DELAY_MS = 1400;
/** Échec : overlay « Encore » 400 ms après la sortie du dernier orbe (specs UI/UX 6). */
const FAIL_DELAY_MS = 400;
/** Final au ralenti (GD) : tout le jeu à 0,25 pendant 1,5 s réelles au maximum. */
const SLOWMO = { scale: 0.25, maxRealMs: 1500 };
/** Marge de prudence de la prédiction du final (px retirés au rayon du dernier cœur). */
const FINAL_PREDICT_MARGIN_PX = 3;
/** Vitesse minimale (px/s) pour anticiper le final ; en dessous, seul le contact compte. */
const FINAL_MIN_SPEED = 200 * ORB_PHYSICS.slowdown;
/** Loge de l'Astre : colonne gauche sous le compteur d'orbes (pieds de l'Astre). */
/** Loge de l'Astre (specs UI/UX) : pieds de l'Astre en haut de la colonne gauche. */
const COMPANION_ANCHOR = HUD_LAYOUT.anchor;
/** L'orbe « frôle » un cœur (réaction « oh ! » de l'Astre). */
const NEAR_HEART_PX = 20;
const HEART_RADIUS = 10;
/** Restitution effective des rebonds (Matter : max orbe / obstacle). */
const ORB_RESTITUTION = ORB_PHYSICS.orbRestitution;
const PIP_COLOR = 0xffe45c;
/** Aide : nombre d'échecs avant le coup de pouce, rebonds du guide de la lanterne. */
const HELP_AFTER_FAILS = 3;
const LANTERN_GUIDE_BOUNCES = 2;
/** Lueur de la lanterne de la Gardienne (ambre chaud). */
const LANTERN_COLOR = 0xffc870;

type CrystalView =
  Phaser.GameObjects.Arc | Phaser.GameObjects.Rectangle | Phaser.GameObjects.Polygon;

/** Contour d'un cristal rond selon son type (null : cercle simple). */
function crystalOutline(kind: Crystal['kind'], r: number): { x: number; y: number }[] | null {
  const ring = (n: number, radius: (i: number) => number, start = -Math.PI / 2) =>
    Array.from({ length: n }, (_, i) => {
      const a = start + (i * Math.PI * 2) / n;
      return { x: Math.cos(a) * radius(i), y: Math.sin(a) * radius(i) };
    });
  if (kind === 'heart') return ring(4, () => r * 1.3);
  if (kind === 'bonus') return ring(8, (i) => (i % 2 === 0 ? r * 1.45 : r * 0.5));
  if (kind === 'power') return ring(6, () => r * 1.1, 0);
  return null;
}

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
  /** Type de cristal dessiné par chaque vue (la forme dépend du type). */
  private viewKinds = new Map<number, Crystal['kind']>();
  private orb?: Phaser.GameObjects.Arc;
  private aimAngle = Math.PI / 2;
  private guide!: Phaser.GameObjects.Graphics;
  private cannon!: Phaser.GameObjects.Rectangle;
  private bucket!: Phaser.GameObjects.Rectangle;
  private bucketDir = 1;
  private hud!: GameHud;
  private hudDimmed = false;
  /** Pause : jeu figé, scène active (l'Astre continue de s'animer). */
  private paused = false;
  private stuckRef = { x: 0, y: 0, t: 0 };
  private chain = 0;
  private ending = false;
  private tracker = new ShotTracker();
  /** Décompte du score par type de cristal, pour l'overlay de victoire. */
  private breakdown = new ScoreBreakdown();
  private companion?: CompanionView;
  private slowmoUntil = 0;
  private gameScale = 1;
  private reveal = new RevealCharges();
  /** Tirs restants avec le guide allongé de la lanterne (aide sans Astre). */
  private lanternShots = 0;
  /** Le dernier cœur est touché : l'orbe finit sa course dans les zones de bonus. */
  private finalShot = false;
  private finalZonesGfx?: Phaser.GameObjects.Container;
  private debugForceFinal = false;
  /** create() a lancé une cinématique à la place du niveau. */
  private redirecting = false;

  constructor() {
    super(SCENES.game);
  }

  init(data: GameSceneData): void {
    this.sceneData = data;
  }

  create(): void {
    // Une scène relancée depuis la pause garde ses champs et l'état de ses entrées.
    this.paused = false;
    this.input.enabled = true;
    if (this.input.keyboard) this.input.keyboard.enabled = true;
    // Réveil de Pip (vignette B0) au tout premier lancement du 1-1.
    const firstSave = this.registry.get(REGISTRY.save) as SaveData | undefined;
    if (
      !this.sceneData.test &&
      this.sceneData.level.id === STORY_LEVELS.ch1First &&
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
    this.setupPhysics();
    this.tracker = new ShotTracker();
    this.breakdown.reset();
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
    // Options changées depuis la pause : on recolore les cristaux tout de suite.
    const onOptions = (o: SaveData['options']) => {
      this.colors = o.colorblind ? CRYSTAL_COLORS_CB : CRYSTAL_COLORS;
      for (const c of this.level.crystals) {
        if (!c.lit) this.views.get(c.id)?.setFillStyle(this.colors[c.kind]);
      }
    };
    this.game.events.on(OPTIONS_CHANGED, onOptions);
    // Perte de focus de la fenêtre : pause automatique (specs UI/UX 4).
    const onBlur = () => this.openPause();
    this.game.events.on(Phaser.Core.Events.BLUR, onBlur);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(OPTIONS_CHANGED, onOptions);
      this.game.events.off(Phaser.Core.Events.BLUR, onBlur);
      this.companion?.destroy();
      this.companion = undefined;
      this.scene.stop(SCENES.companionLayer);
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
    if (this.paused) {
      // Jeu figé : seul l'Astre vit (il dort).
      this.companion?.update(realDelta / 1000, {});
      return;
    }
    this.updateSlowmo(time);
    const delta = realDelta * this.gameScale;
    this.moveBucket(delta);
    this.cannon.setRotation(this.aimAngle);
    this.handleKeyboardAim(delta);
    this.drawGuide();

    const orb = this.orb;
    this.updateCompanion(delta / 1000, orb);
    this.hud.tick(time, orb);
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

  // --- Astre hors de sa loge (API des overlays du Lead) ---------------------

  /**
   * Overlay de fin (Victoire, Échec) : l'Astre sort de sa loge et rejoint (x, y), pieds,
   * en coordonnées écran 1280 × 720, puis danse ou console. Il est dessiné sur un calque
   * au-dessus de toutes les scènes. Game ne doit pas être mis en pause.
   */
  companionExit(mode: 'victoire' | 'consolation', x: number, y: number): void {
    const c = this.companion;
    if (!c) return;
    this.withCompanionLayer((layer) => {
      c.reparent(layer);
      void c.exitTo(x, y, mode);
    });
  }

  /** Retour de l'Astre dans sa loge (rejouer), puis le calque est fermé. */
  companionHome(): void {
    const c = this.companion;
    if (!c) return;
    void c.returnHome().then(() => {
      if (!this.companion) return;
      c.reparent(this);
      this.scene.stop(SCENES.companionLayer);
    });
  }

  /** Pause : l'Astre s'endort (et se réveille en sursaut à la reprise). */
  companionSleep(on: boolean): void {
    this.companion?.setSleeping(on);
  }

  private withCompanionLayer(run: (layer: Phaser.Scene) => void): void {
    const key = SCENES.companionLayer;
    const layer = this.scene.get(key);
    if (this.scene.isActive(key)) {
      this.scene.bringToTop(key);
      run(layer);
      return;
    }
    layer.events.once(Phaser.Scenes.Events.CREATE, () => run(layer));
    this.scene.launch(key);
    this.scene.bringToTop(key);
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

  /** Orbe ralentie (même trajectoire, parcourue plus lentement) et petits rebonds conservés. */
  private setupPhysics(): void {
    this.matter.world.setGravity(0, 1, ORB_PHYSICS.gravityScale);
    applyMatterInternals((Phaser.Physics.Matter as unknown as { Matter: MatterInternals }).Matter);
  }

  /** Murs gauche, droit et haut de la zone de jeu ; le bas reste ouvert. */
  private makeWalls(): void {
    const t = WALL_THICKNESS;
    const { x, y, w, h } = PLAYFIELD;
    const opts = { isStatic: true, label: 'wall' };
    const walls = [
      this.matter.add.rectangle(x - t / 2, y + h / 2, t, h + t * 2, opts),
      this.matter.add.rectangle(x + w + t / 2, y + h / 2, t, h + t * 2, opts),
      this.matter.add.rectangle(x + w / 2, y - t / 2, w + t * 2, t, opts),
    ];
    // Matter remet la restitution d'un corps statique à 0 : on la fixe après coup
    // (une paire prend la restitution la plus haute des deux corps).
    for (const wall of walls) wall.restitution = ORB_PHYSICS.wallRestitution;
  }

  private makeCrystal(c: Crystal): CrystalView {
    this.viewKinds.set(c.id, c.kind);
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
    // Doublage forme / couleur (DA, obligatoire dans les deux palettes) : cœur en losange,
    // standard rond, bonus en étoile à 4 branches, pouvoir en hexagone.
    const r = shape.r;
    const points = crystalOutline(c.kind, r);
    const view: CrystalView = points
      ? this.add.polygon(x, y, points, color)
      : this.add.circle(x, y, r, color);
    this.matter.add.gameObject(view, {
      isStatic: true,
      label,
      shape: { type: 'circle', radius: r },
    });
    return view;
  }

  private makeHud(): void {
    const level = this.sceneData.level;
    const forced = new URLSearchParams(window.location.search).get('astre');
    const hasAstre = (forced ?? level.companion) === 'pip';
    this.hud = new GameHud(this, {
      levelLabel: levelLabel(level.id),
      stars: level.stars,
      astreColor: hasAstre ? PIP.color : null,
      heartColor: this.colors.heart,
    });
    button(this, 1236, 32, 'II', () => this.openPause(), { width: 48, size: 18 });
  }

  private makeCompanion(): void {
    // ?astre=pip force l'Astre sur n'importe quel niveau (tests QA).
    const forced = new URLSearchParams(window.location.search).get('astre');
    const id = forced ?? this.sceneData.level.companion;
    // Aide après 3 échecs sur un niveau pas encore fini (règle LD, arbitrage GD).
    const save = this.registry.get(REGISTRY.save) as SaveData | undefined;
    const needsHelp =
      !this.sceneData.test &&
      !!save &&
      failsBeforeFirstWin(save, this.sceneData.level.id) >= HELP_AFTER_FAILS;
    if (id !== 'pip') {
      // Sans Astre (prologue) : la lanterne de la Gardienne allonge le guide du 1er tir.
      if (needsHelp) this.lanternShots = 1;
      return;
    }
    this.companion = new CompanionView(this, PIP, COMPANION_ANCHOR);
    this.companion.attach();
    // Avec Pip : le 1er tir montre sa trajectoire révélée.
    if (needsHelp) this.reveal.grant(1);
  }

  /**
   * Vitesse de l'orbe en px par pas de référence (16,7 ms) de temps de jeu, quels que soient
   * la fréquence physique et le ralenti (Matter stocke un déplacement par pas réel).
   */
  private orbVelocity(orb: Phaser.GameObjects.Arc): { x: number; y: number } {
    const b = orb.body as
      (MatterJS.BodyType & { positionPrev: MatterJS.Vector; deltaTime?: number }) | null;
    if (!b) return { x: 0, y: 0 };
    const k = 1000 / 60 / (b.deltaTime || 1000 / 60);
    return { x: (b.position.x - b.positionPrev.x) * k, y: (b.position.y - b.positionPrev.y) * k };
  }

  private updateCompanion(dt: number, orb?: Phaser.GameObjects.Arc): void {
    const c = this.companion;
    if (!c) return;
    if (orb) {
      const v = this.orbVelocity(orb);
      c.update(dt, {
        orb: { x: orb.x, y: orb.y, vy: v.y * 60 },
        heartsLeft: heartsRemaining(this.level),
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
    const v = this.orbVelocity(orb);
    // px par pas de référence -> px/s de temps de jeu.
    this.emitAll(
      this.tracker.orbMoved(
        { x: orb.x, y: orb.y, vx: v.x * 60, vy: v.y * 60, r: ORB_RADIUS },
        this.unlitHearts(),
        (o, heart) => this.predictHeartContact(o, heart),
      ),
    );
  }

  /** Obstacles des prédictions de trajectoire (rayons approchés des cristaux). */
  private obstacles(exceptId?: number): Circle[] {
    return this.level.crystals.filter((c) => c.id !== exceptId).map((c) => obstacleOf(c));
  }

  /** Forme du dernier cœur pour la prédiction, un peu réduite par prudence. */
  private finalTarget(heart: HeartTarget): Circle {
    const crystal = this.level.crystals.find((c) => c.id === heart.id);
    const shape = crystal ? obstacleOf(crystal) : { x: heart.x, y: heart.y, r: heart.r };
    return { ...shape, r: Math.max(2, shape.r - FINAL_PREDICT_MARGIN_PX) };
  }

  /**
   * Temps (s) avant que l'orbe touche ce cœur, en simulant gravité, murs et cristaux sur la
   * fenêtre du final ; null s'il ne sera pas touché. Évite les faux finals (rapport QA P1).
   */
  private predictHeartContact(
    o: { x: number; y: number; vx: number; vy: number },
    heart: HeartTarget,
  ): number | null {
    // Orbe lente (roule ou tressaute sur un cristal) : Matter n'est plus prévisible ici,
    // on laisse le vrai contact déclencher le ralenti.
    if (Math.hypot(o.vx, o.vy) < FINAL_MIN_SPEED) return null;
    const steps = Math.ceil(EVENT_THRESHOLDS.finalSlowmoLeadSeconds * 60);
    const contactStep = robustContactStep({
      x: o.x,
      y: o.y,
      vx: o.vx / 60,
      vy: o.vy / 60,
      gravity: GRAVITY_PER_STEP,
      radius: ORB_RADIUS,
      minX: PLAYFIELD.x,
      maxX: PLAYFIELD.x + PLAYFIELD.w,
      maxY: GAME_HEIGHT,
      obstacles: this.obstacles(heart.id),
      restitution: ORB_RESTITUTION,
      wallRestitution: ORB_PHYSICS.wallRestitution,
      maxBounces: 99,
      maxSteps: steps,
      substeps: Math.round(ORB_PHYSICS.stepsPerSecond / 60),
      // Cible un peu réduite : on préfère rater un ralenti (le vrai contact le relance)
      // qu'en déclencher un faux.
      target: this.finalTarget(heart),
    });
    return contactStep === null ? null : contactStep / 60;
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
      endNow: (won) => {
        if (this.ending || this.orb) return;
        if (won) {
          this.level.score += this.level.orbs * this.level.tuning.points.bonus;
          gameEvents.emit('victoire', { score: this.level.score });
        } else gameEvents.emit('echec', { score: this.level.score });
        this.endLevel(won);
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
    // Ralenti final : le HUD s'estompe (le spectacle prime), la loge reste visible.
    if (scale < 1 !== this.hudDimmed) {
      this.hudDimmed = scale < 1;
      this.hud?.setDimmed(this.hudDimmed);
    }
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
      restitution: ORB_RESTITUTION,
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
    this.lanternShots = Math.max(0, this.lanternShots - 1);
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
    this.breakdown.add(crystal.kind, points);
    gameEvents.emit('cristal_allume', { kind: crystal.kind, chain: this.chain, points });
    this.emitAll(this.tracker.crystalLit(crystal.kind, this.level.shotScore, crystal.id));
    if (isFinalHeartLit(this.level)) {
      // Filet de sécurité : le dernier cœur touché sans prédiction préalable.
      if (this.slowmoUntil === 0) this.emitAll(['final_ralenti']);
      else if (this.slowmoUntil < 0) {
        // Un ralenti a déjà eu lieu pendant ce tir : on le relance pour le vrai contact.
        this.slowmoUntil = 0;
        this.startSlowmo();
      }
      this.showFinalZones();
    }
    this.refreshHud();
  }

  private finishShot(caught: boolean): void {
    if (this.finalShot && this.orb) this.scoreFinalZone(this.orb.x);
    this.orb?.destroy();
    this.orb = undefined;
    this.hud.endShot();
    this.applyGameScale(1);
    const result = endShot(this.level, caught);
    this.removeViews(result.removedIds);
    if (result.removedIds.length > 0) {
      gameEvents.emit('cristaux_brises', { count: result.removedIds.length });
    }
    if (caught) this.cameras.main.flash(120, 185, 166, 255);
    // Le cristal bonus a pu changer de place : la forme suit le type (un bonus rond est un bug).
    for (const c of this.level.crystals) {
      if (c.lit) continue;
      if (this.viewKinds.get(c.id) !== c.kind) {
        this.views.get(c.id)?.destroy();
        this.views.set(c.id, this.makeCrystal(c));
      } else this.views.get(c.id)?.setFillStyle(this.colors[c.kind]);
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
    const score = this.level.score;
    const orbBonus = won ? this.level.orbs * this.level.tuning.points.bonus : 0;
    const payload: ResultsData = {
      level: this.sceneData.level,
      score,
      won,
      orbsLeft: this.level.orbs,
      heartsLeft: heartsRemaining(this.level),
      breakdown: this.breakdown.finish(score, orbBonus),
      test: this.sceneData.test,
    };
    // Overlay par-dessus le jeu, qui n'est PAS mis en pause : l'Astre continue de vivre.
    const delay = won ? RESULTS_DELAY_MS : FAIL_DELAY_MS;
    this.time.delayedCall(delay, () => this.scene.launch(SCENES.results, payload));
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

  /**
   * Pause : on fige le jeu (physique, réceptacle, tweens, entrées) mais pas la scène, pour
   * que l'Astre continue de vivre : il s'endort, bien visible au-dessus du voile.
   */
  private openPause(): void {
    if (this.ending || this.paused) return;
    this.paused = true;
    this.matter.world.pause();
    this.tweens.pauseAll();
    this.input.enabled = false;
    if (this.input.keyboard) this.input.keyboard.enabled = false;
    this.scene.launch(SCENES.pause, { test: this.sceneData.test });
    const c = this.companion;
    if (c) this.withCompanionLayer((layer) => c.reparent(layer));
  }

  /** Reprise après la pause (appelée par PauseScene). */
  resumeFromPause(): void {
    if (!this.paused) return;
    this.paused = false;
    this.matter.world.resume();
    this.tweens.resumeAll();
    this.input.enabled = true;
    if (this.input.keyboard) this.input.keyboard.enabled = true;
    this.companion?.reparent(this);
    this.scene.stop(SCENES.companionLayer);
  }

  get isGamePaused(): boolean {
    return this.paused;
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
      obstacles: this.obstacles(),
      wallRestitution: ORB_PHYSICS.wallRestitution,
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
    const lantern = this.lanternShots > 0;
    const guideBounces = Math.max(
      this.sceneData.level.guideBounces ?? 0,
      lantern ? LANTERN_GUIDE_BOUNCES : 0,
    );
    const points =
      guideBounces > 0
        ? predictPath({
            ...input,
            restitution: ORB_RESTITUTION,
            maxBounces: guideBounces,
            maxSteps: 240,
          }).points
        : aimGuide(input);
    if (lantern) {
      // Lanterne : points chauds qui pulsent doucement.
      this.guide.fillStyle(LANTERN_COLOR, 0.55 + 0.2 * Math.sin(this.time.now / 220));
      points.forEach((pt, i) => {
        if (i % 3 === 0) this.guide.fillCircle(pt.x, pt.y, 3.5);
      });
      return;
    }
    this.guide.fillStyle(PALETTE.lit, 0.6);
    points.forEach((pt, i) => {
      if (i % 3 === 0) this.guide.fillCircle(pt.x, pt.y, 3);
    });
  }

  /** Charges du pouvoir sous l'Astre (pastilles) et mèche en antenne. */
  private refreshPower(): void {
    this.companion?.brain.setPowered(this.reveal.previewing || this.reveal.shotIsPowered);
    if (!this.companion) return;
    this.hud.setPower(this.reveal.charges, PIP_POWER.maxCharges, this.reveal.shotIsPowered);
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
    const hearts = heartsRemaining(s);
    this.hud.update({
      score: s.score,
      shotScore: s.shotScore,
      orbs: s.orbs,
      heartsLeft: hearts,
      heartsTotal: s.heartsTotal,
      mult: multiplier(s),
      broken: s.heartsTotal === 0 ? 1 : 1 - hearts / s.heartsTotal,
      thresholds: s.tuning.multiplierThresholds,
      steps: s.tuning.multiplierSteps,
    });
  }
}

/** « ch1-04 » -> « 1-4 », « pro-02 » -> « P-2 » (numéro de niveau du bandeau). */

/**
 * Forme d'un cristal pour les prédictions de trajectoire : cercle de son rayon, ou capsule
 * le long d'une brique (une seule normale, comme le rectangle de Matter).
 */
function obstacleOf(c: Crystal): Circle {
  const w = toWorld(c);
  const shape = c.shape;
  if (shape?.type !== 'brick') return { x: w.x, y: w.y, r: shape?.r ?? 10 };
  const half = Math.max(shape.w, shape.h) / 2;
  const r = Math.min(shape.w, shape.h) / 2;
  const a = Phaser.Math.DegToRad(shape.angle) + (shape.h > shape.w ? Math.PI / 2 : 0);
  const ux = Math.cos(a) * (half - r);
  const uy = Math.sin(a) * (half - r);
  return { x: w.x, y: w.y, r, seg: { ax: w.x - ux, ay: w.y - uy, bx: w.x + ux, by: w.y + uy } };
}
