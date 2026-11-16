import Phaser from 'phaser';
import { audio } from '../audio';
import { GAME_HEIGHT, GAME_WIDTH, PLAYFIELD, toWorld } from '../config';
import { companionById } from '../companions';
import { DA_DEFS } from '../companions/astres';
import type { CompanionDef } from '../core/companion/types';
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
  chainBonus,
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
import {
  MOUSSE_POWER,
  NUAGE_LUNE_POWER,
  PIP_POWER,
  RevealCharges,
  ShotCharges,
  magnetPull,
  lowestHeart,
  secondChanceVelocity,
  type ChargeRule,
} from '../core/powers';
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
import { OPTIONS_CHANGED, REGISTRY, SCENES } from './keys';
import { wakeSequenceFor } from '../core/story';
import { CompanionView } from './CompanionView';
import type { ResultsData } from './ResultsScene';
import { CRYSTAL_COLORS, CRYSTAL_COLORS_CB, PALETTE, powerColor, textStyle } from './theme';
import { ChapterBackdrop, preloadBackdrop } from './ChapterBackdrop';
import { earnedStars } from '../core/backdrop';
import {
  applyChallengeConstraints,
  ChallengeTracker,
  type Challenge,
  type ChallengeSnapshot,
  type ChallengeState,
} from '../core/challenge';
import type { GameMode } from '../core/modes';
import {
  applyDuelRules,
  createDuel,
  endTurn,
  playerNumber,
  type DuelState,
  type PlayerIndex,
} from '../core/duel';
import { DuelHud } from './DuelHud';
import { ChallengeLine, preloadChallengeIcons } from './ChallengeLine';
import { DecorLayer } from './DecorLayer';
import {
  hexPoints,
  outlinedCircle,
  outlinedHex,
  outlinedLine,
  powerFlash,
  powerParticle,
} from './powerFx';
import { PORTAL } from '../core/decor';
import { LANTERN } from './gardienne';
import { GameHud, HUD_LAYOUT } from './Hud';
import { button } from './widgets';

export interface GameSceneData {
  level: LevelData;
  /** Lancé depuis l'éditeur : pas de sauvegarde, pas de carte. */
  test?: boolean;
  /** Astre choisi dans le sélecteur (sinon celui du niveau). */
  companion?: string;
  /** Constellation du jour : clé AAAAMMJJ (score à enregistrer avec recordDaily). */
  daily?: string;
  /** Mode de jeu du jalon 3 (défi, duel...) ; absent = aventure. */
  mode?: GameMode;
}

const ORB_RADIUS = 8;
/** Vitesse de lancement en px par pas de référence Matter (~16,7 ms), voir core/physics.ts. */
const LAUNCH_SPEED = ORB_PHYSICS.launchSpeed;
const CANNON = { x: PLAYFIELD.x + PLAYFIELD.w / 2, y: PLAYFIELD.y + 24 };
const BUCKET = { width: 100, height: 18, y: GAME_HEIGHT - 14 };
/** Duel : délai entre la fin du tir et l'entrée de l'Astre suivant (réaction du tireur). */
const DUEL_SWITCH_MS = 900;
const MIN_AIM = Phaser.Math.DegToRad(8);
const MAX_AIM = Phaser.Math.DegToRad(172);
const WALL_THICKNESS = 40;
/** Délai entre la fin du dernier tir et l'overlay de victoire (laisse l'Astre réagir). */
const RESULTS_DELAY_MS = 1400;
/** Échec : overlay « Encore » 400 ms après la sortie du dernier orbe (specs UI/UX 6). */
const FAIL_DELAY_MS = 400;
/**
 * Final au ralenti (GD) : tout le jeu à 0,25, ~1,5 s réelle. Le ralenti tient jusqu'au contact
 * du dernier cœur (prévu 0,25 s de jeu avant, ~1 s réelle), puis afterContactMs réelles.
 * safetyGameMs : filet en temps SIMULÉ si la prédiction se trompe (un délai réel finissait
 * avant l'impact quand la fréquence d'images baisse, QA ch.3-5).
 */
const SLOWMO = { scale: 0.25, afterContactMs: 500, safetyGameMs: 600 };
/** Gel d'image au contact du dernier cœur non anticipé (cas lent, demande GD), avant le ralenti. */
const FINAL_HIT_STOP_MS = 80;
/** Onde de choc de Bourdon : rayon (px) et durée de propagation (s). */
const SHOCKWAVE = { radius: 110, seconds: 0.3 };
/**
 * Orbe scindé de Twi & Nkl (GD reglages-jalon1) : au contact d'un cristal pouvoir, un 2e orbe
 * part du point d'impact, vitesse horizontale inversée, à 90 % de la vitesse. Le tir finit
 * quand les deux sont sortis ; chaque orbe attrapé rend +1 orbe, au plus 2 par tir.
 * minSideShare : part horizontale minimale du 2e orbe (une chute verticale se scinde en Y).
 */
const TWIN = { speed: 0.9, maxCatches: 2, minSideShare: 0.35 };
/**
 * Rebond fou de Volte (GD reglages-jalon1 et jalon2 §7) : au contact d'un cristal pouvoir,
 * restitution 1,10 pour le reste du tir, 10 s de jeu au plus ; vitesse plafonnée (900 px/s du
 * prototype, mise à l'échelle du ralenti global) pour rester lisible.
 */
const VOLTE = { restitution: 1.1, maxSpeed: 900 * ORB_PHYSICS.slowdown, seconds: 10 };
/**
 * Ralenti du temps d'Horloge (GD reglages-jalon1, version finale de reglages-jalon2 §7) : tout
 * le tir chargé à l'échelle 0,5, 10 s réelles au plus ; le réceptacle suit le pointeur, 2 fois
 * plus large.
 * follow : vitesse de rattrapage du pointeur (fraction de l'écart par seconde de jeu) ;
 * keySpeed : au clavier, vitesse de la cible en multiple de la vitesse normale du réceptacle.
 */
const HORLOGE = { scale: 0.5, realMs: 10000, bucketScale: 2, follow: 14, keySpeed: 3 };
/**
 * Orbe éclair de Grelot (GD reglages-jalon1, charges de reglages-jalon2 §4 bis) : tir chargé
 * en ligne droite sans gravité, à 1,15 fois la vitesse (reglages-jalon2 §7) ; perce 3 cristaux (allumés sans
 * rebond ; les cristaux déjà allumés sont traversés sans compter, décision GD), puis physique
 * normale. Les murs renvoient l'orbe normalement pendant l'éclair.
 * maxSeconds : filet de sécurité (temps de jeu) si l'orbe ne trouve pas 3 cristaux.
 */
const GRELOT = { speed: 1.15, pierce: 3, maxSeconds: 4 };
/** Catégorie de collision des cristaux cassables (l'orbe éclair les traverse). */
const CRYSTAL_CATEGORY = 0x0002;
/** Les orbes d'un même tir se traversent (groupe de collision négatif commun). */
const ORB_COLLISION_GROUP = -1;
/**
 * Anti-blocage garanti (règle GD) : orbe quasi immobile (moins de STUCK_RADIUS_PX en
 * TUNING.antiStuckSeconds) -> cristaux allumés voisins brisés, sinon impulsion
 * (TUNING.antiStuckNudges essais), sinon dissolution. Vitesse de l'impulsion :
 */
const STUCK_NUDGE_SPEED = 3 * ORB_PHYSICS.slowdown;
/** orbe_coincee part 0,7 s avant l'impulsion : le souffle de l'Astre est déployé (DA). */
const STUCK_BLOW_LEAD_MS = 700;
/** Zone « sur place » de l'anti-blocage (px autour du point de référence). */
const STUCK_RADIUS_PX = 40;
/** En dessous (px/s), un contact n'est pas un rebond de chaîne mais un frottement. */
const BOUNCE_MIN_SPEED = 90 * ORB_PHYSICS.slowdown;
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
/** Lueur de la lanterne de la Gardienne (DA : or pâle, jamais l'ambre des cœurs). */
const LANTERN_COLOR = LANTERN.glow;

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
  /** 2e orbe de Twi & Nkl, vivant en même temps que `orb`. */
  private twin?: Phaser.GameObjects.Arc;
  private twinRef = { x: 0, y: 0, t: 0 };
  /** Orbes attrapés pendant ce tir (2 au plus comptent, orbe scindé). */
  private shotCatches = 0;
  /** Temps de jeu restant (s) du rebond fou de Volte ; 0 = inactif. */
  private crazyLeft = 0;
  private backdrop?: ChapterBackdrop;
  /** Défi en cours (mode défi), sa ligne d'objectif et le nombre de cristaux cassables. */
  private challenge?: ChallengeTracker;
  private challengeLine?: ChallengeLine;
  private breakableTotal = 0;
  /** Duel local : état des joueurs, HUD des cartouches, charges « tir suivant » de chacun. */
  private duel?: DuelState;
  private duelHud?: DuelHud;
  private duelCharges: Array<ShotCharges | undefined> = [];
  /** Changement de tour en cours (l'Astre suivant entre dans la loge) : pas de tir. */
  private turnSwitching = false;
  /** Seconde chance de Nuage-Lune déjà servie sur ce tir (une par tir, l'autre charge reste). */
  private secondChanceUsed = false;
  private bucketEdgeTween?: Phaser.Tweens.Tween;
  /** Fin (horloge réelle) du ralenti d'Horloge ; 0 = inactif. */
  private warpUntil = 0;
  /** Cible du réceptacle pendant Horloge (pointeur ou flèches), dernière position du pointeur. */
  private warpTargetX = 0;
  private warpPointerX = 0;
  /** Orbe éclair de Grelot : cristaux restant à percer (0 = inactif), déjà percés, durée. */
  private pierceLeft = 0;
  private pierced = new Set<number>();
  private boltLeft = 0;
  private boltPrev = { x: 0, y: 0 };
  /** Portails : bouche où se trouve chaque orbe, et temps de jeu où elle pourra repasser. */
  private portalState = new WeakMap<
    Phaser.GameObjects.Arc,
    { inside: string | null; readyAt: number }
  >();
  /** Temps de jeu cumulé (s), ralentis compris. */
  private gameTime = 0;
  /** Dernière lecture de l'horloge physique (ms simulées). */
  private lastPhys = 0;
  private aimAngle = Math.PI / 2;
  private guide!: Phaser.GameObjects.Graphics;
  /** Effets des pouvoirs en zone de jeu (menthe), redessinés chaque frame. */
  private powerGfx!: Phaser.GameObjects.Graphics;
  private cannon!: Phaser.GameObjects.Rectangle;
  private bucket!: Phaser.GameObjects.Rectangle;
  private bucketDir = 1;
  private hud!: GameHud;
  private hudDimmed = false;
  /** Pause : jeu figé, scène active (l'Astre continue de s'animer). */
  private paused = false;
  /** Instant (horloge réelle) de la mise en pause : les minuteries réelles sont décalées. */
  private pausedAt = 0;
  private stuckRef = { x: 0, y: 0, t: 0 };
  private decor!: DecorLayer;
  /** Astre en jeu (id de la liste), null sans Astre. */
  private companionId: string | null = null;
  /** Impulsions anti-blocage déjà données sur ce tir. */
  private stuckNudges = 0;
  /** orbe_coincee envoyé, en attente de orbe_debloquee. */
  private stuckAnnounced = false;
  private chain = 0;
  private ending = false;
  private tracker = new ShotTracker();
  /** Décompte du score par type de cristal, pour l'overlay de victoire. */
  private breakdown = new ScoreBreakdown();
  private companion?: CompanionView;
  private slowmoUntil = 0;
  /** Fin de secours du ralenti prévu, en horloge physique (0 = aucune). */
  private slowmoSafetyAt = 0;
  /** Fin (horloge réelle) du gel d'image du final ; 0 = pas de gel. */
  private hitStopUntil = 0;
  private gameScale = 1;
  /** Charges du pouvoir « tir suivant » de l'Astre (Pip, Mousse...). */
  private reveal: ShotCharges = new RevealCharges();
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

  preload(): void {
    // Fond du chapitre (couches SVG du DA), chargé à la demande puis gardé en cache.
    preloadBackdrop(this, this.sceneData.level.chapter || 1);
    const ch = this.activeChallenge();
    if (ch) preloadChallengeIcons(this, ch);
  }

  create(): void {
    // Une scène relancée depuis la pause garde ses champs et l'état de ses entrées.
    this.paused = false;
    this.input.enabled = true;
    if (this.input.keyboard) this.input.keyboard.enabled = true;
    // Réveil de l'Astre (vignette R0, B0 pour Pip) au tout premier lancement du niveau 1.
    const firstSave = this.registry.get(REGISTRY.save) as SaveData | undefined;
    const wake = wakeSequenceFor(this.sceneData.level.id);
    if (!this.sceneData.test && wake && firstSave && markSeen(firstSave, wake)) {
      writeSave(firstSave);
      this.redirecting = true;
      this.scene.start(SCENES.cutscene, {
        sequence: wake,
        next: { scene: SCENES.game, data: this.sceneData },
      });
      return;
    }
    this.redirecting = false;
    this.views.clear();
    this.orb = undefined;
    this.twin = undefined;
    this.ending = false;
    this.slowmoUntil = 0;
    this.slowmoSafetyAt = 0;
    this.hitStopUntil = 0;
    this.finalShot = false;
    this.finalZonesGfx = undefined;
    this.setTimeScale(1);
    this.setupPhysics();
    this.lastPhys = this.physClock();
    this.tracker = new ShotTracker();
    this.breakdown.reset();
    this.reveal = new RevealCharges();
    const save = this.registry.get(REGISTRY.save) as SaveData | undefined;
    this.colors = save?.options.colorblind ? CRYSTAL_COLORS_CB : CRYSTAL_COLORS;
    this.level = levelFromData(this.sceneData.level);
    const challenge = this.activeChallenge();
    this.challenge = challenge ? new ChallengeTracker(challenge) : undefined;
    this.challengeLine = undefined;
    if (challenge) applyChallengeConstraints(this.level, challenge);
    this.breakableTotal = this.level.crystals.filter((c) => c.kind !== 'wall').length;
    const mode = this.sceneData.mode;
    this.duel =
      mode?.kind === 'duel' ? createDuel(this.duelAstres(), mode.tiebreak === true) : undefined;
    this.duelHud = undefined;
    this.duelCharges = [];
    this.turnSwitching = false;
    if (this.duel) applyDuelRules(this.level, this.duel);

    this.backdrop = new ChapterBackdrop(this, this.sceneData.level.chapter);
    this.drawFrame();
    this.makeWalls();
    const decorGfx = this.add.graphics(); // supports du décor, sous les cristaux
    for (const c of this.level.crystals) this.views.set(c.id, this.makeCrystal(c));
    this.decor = new DecorLayer(
      this,
      this.sceneData.level.decor,
      this.level.crystals,
      (id) => (this.views.get(id) as { body?: MatterJS.BodyType } | undefined)?.body,
      decorGfx,
    );
    this.decor.setRegen(this.level);

    this.cannon = this.add.rectangle(CANNON.x, CANNON.y, 36, 14, PALETTE.cannon).setOrigin(0, 0.5);
    this.add.circle(CANNON.x, CANNON.y, 16, PALETTE.cannon);
    this.bucket = this.add.rectangle(
      GAME_WIDTH / 2,
      BUCKET.y,
      BUCKET.width,
      BUCKET.height,
      PALETTE.bucket,
    );
    // Défi sans réceptacle : il est retiré du terrain.
    this.bucket.setVisible(!this.hasConstraint('sans_receptacle'));
    this.guide = this.add.graphics();
    this.powerGfx = this.add.graphics().setDepth(5);
    this.makeHud();
    this.makeCompanion();
    button(this, 1236, 32, 'II', () => this.openPause(), { width: 48, size: 18 });
    if (this.duel) {
      this.duelHud = new DuelHud(this, this.colors.heart, CANNON);
      this.duelHud.setActive(0, true);
      gameEvents.emit('duel_tour', { joueur: 1 });
    }

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
          const by = other === pair.bodyA ? pair.bodyB : pair.bodyA;
          if (other.label.startsWith('crystal:'))
            this.onCrystalHit(Number(other.label.slice(8)), by);
          else if (other.label === 'wall') {
            gameEvents.emit('mur_touche', {});
            this.countBounce();
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
      this.hud.recolorPower();
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
    const kind = this.sceneData.daily ? 'quotidien' : this.sceneData.mode?.kind;
    gameEvents.emit('niveau_debut', {
      levelId: this.sceneData.level.id,
      chapter: this.sceneData.level.chapter,
      ...(kind && kind !== 'aventure' ? { mode: kind } : {}),
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
    if (this.hitStopUntil > 0) {
      // Gel d'image du final : tout est figé, l'Astre retient son souffle.
      this.companion?.update(realDelta / 1000, {});
      if (time < this.hitStopUntil) return;
      this.hitStopUntil = 0;
      this.matter.world.resume();
      this.tweens.resumeAll();
    }
    this.updateSlowmo(time);
    if (this.warpUntil > 0 && time >= this.warpUntil) this.endTimeWarp();
    this.decor.draw();
    this.updateChallenge(realDelta / 1000);
    const delta = realDelta * this.gameScale;
    // Horloge physique : temps réellement simulé par Matter (ralentis compris, pause et gel
    // exclus). Sous ~30 i/s, Matter plafonne ses pas et l'orbe avance moins vite que l'horloge
    // de la scène (QA ch.2) : blocage, portails et durées des pouvoirs comptent sur celle-ci.
    const now = this.physClock();
    const physDt = Math.max(0, now - this.lastPhys) / 1000;
    this.lastPhys = now;
    this.gameTime = now / 1000;
    this.moveBucket(delta);
    this.cannon.setRotation(this.aimAngle);
    this.backdrop?.update(realDelta / 1000, this.aimAngle);
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
    this.updateBolt(physDt);
    this.trackOrb(orb);
    this.updateCrazyBounce(physDt);
    this.updateMagnet(physDt);
    this.applyMagnets(physDt);
    this.applyPortals(now);
    this.updateTwin(now);
    this.hud.setPowerActivity(this.crazyLeft > 0 ? this.crazyLeft / VOLTE.seconds : 0, !!this.twin);
    const caught = this.inBucket(orb);
    if (caught || orb.y > GAME_HEIGHT + ORB_RADIUS * 2) {
      if (!caught && this.secondChance(orb)) return;
      this.orbGone(caught);
      return;
    }
    this.checkStuck(now);
  }

  private inBucket(orb: Phaser.GameObjects.Arc): boolean {
    return (
      !this.finalShot &&
      this.bucket.visible &&
      orb.y + ORB_RADIUS >= BUCKET.y - BUCKET.height / 2 &&
      orb.y < GAME_HEIGHT &&
      this.orbVelocity(orb).y > 0 && // une orbe qui remonte (seconde chance) ne tombe pas dedans
      Math.abs(orb.x - this.bucket.x) <= (BUCKET.width * this.bucket.scaleX) / 2
    );
  }

  /**
   * L'orbe principal sort (attrapé, tombé ou dissous). Si le 2e orbe de Twi & Nkl vit encore,
   * il devient l'orbe principal et le tir continue ; sinon le tir se termine.
   */
  private orbGone(caught: boolean, finalX = this.orb?.x): void {
    if (caught) this.catchFlash();
    const twin = this.twin;
    if (!twin) {
      this.finishShot(finalX);
      return;
    }
    // Tir final (GD) : chaque orbe marque sa propre zone de bonus, les deux s'additionnent.
    if (this.finalShot && finalX !== undefined) this.scoreFinalZone(finalX);
    this.orb?.destroy();
    this.orb = twin;
    this.twin = undefined;
    this.stuckRef = { ...this.twinRef };
    this.stuckNudges = 0;
    if (this.stuckAnnounced) {
      this.stuckAnnounced = false;
      gameEvents.emit('orbe_debloquee', {});
    }
  }

  private catchFlash(): void {
    this.shotCatches += 1;
    this.cameras.main.flash(120, 185, 166, 255);
  }

  /** Le 2e orbe : attrapé, tombé, ou dissous s'il reste coincé (pas d'impulsion pour lui). */
  /** time : horloge physique (ms simulées), comme stuckRef / twinRef. */
  private updateTwin(time: number): void {
    const t = this.twin;
    if (!t) return;
    const caught = this.inBucket(t);
    if (caught || t.y > GAME_HEIGHT + ORB_RADIUS * 2) {
      if (caught) this.catchFlash();
      if (this.finalShot) this.scoreFinalZone(t.x);
      t.destroy();
      this.twin = undefined;
      return;
    }
    if (Math.hypot(t.x - this.twinRef.x, t.y - this.twinRef.y) > STUCK_RADIUS_PX) {
      this.twinRef = { x: t.x, y: t.y, t: time };
    } else if (time - this.twinRef.t >= TUNING.antiStuckSeconds * 1000) {
      this.dissolveOrb(t.x, t.y);
      if (this.finalShot)
        this.scoreFinalZone(
          t.x < PLAYFIELD.x + PLAYFIELD.w / 2 ? PLAYFIELD.x : PLAYFIELD.x + PLAYFIELD.w - 1,
        );
      t.destroy();
      this.twin = undefined;
    }
  }

  private shotOrbs(): Phaser.GameObjects.Arc[] {
    return [this.orb, this.twin].filter((o): o is Phaser.GameObjects.Arc => !!o);
  }

  /** Pouvoir de Volte : les orbes du tir rebondissent plus fort qu'ils n'arrivent. */
  private startCrazyBounce(): void {
    if (this.crazyLeft <= 0) {
      for (const o of this.shotOrbs()) this.setCrazy(o, true);
    }
    this.crazyLeft = VOLTE.seconds;
  }

  private setCrazy(o: Phaser.GameObjects.Arc, on: boolean): void {
    const body = o.body as MatterJS.BodyType | null;
    if (body) body.restitution = on ? VOLTE.restitution : ORB_RESTITUTION;
    if (on) o.setStrokeStyle(3, powerColor(), 0.95);
    else if (o !== this.twin) o.setStrokeStyle();
    else o.setStrokeStyle(2, powerColor(), 0.9);
  }

  /** Durée et plafond de vitesse du rebond fou, plus une traînée menthe en zigzag. */
  private updateCrazyBounce(dt: number): void {
    if (this.crazyLeft <= 0) return;
    this.crazyLeft -= dt;
    const done = this.crazyLeft <= 0;
    for (const o of this.shotOrbs()) {
      if (done) {
        this.setCrazy(o, false);
        continue;
      }
      const v = this.orbVelocity(o);
      const speed = Math.hypot(v.x, v.y) * 60;
      if (speed > VOLTE.maxSpeed) {
        const k = VOLTE.maxSpeed / speed;
        (o as unknown as Phaser.Physics.Matter.Components.Velocity).setVelocity(v.x * k, v.y * k);
      }
      if (Math.random() < 0.5) {
        const spark = powerParticle(this, o.x, o.y, 2.5, 0.8).setDepth(o.depth - 1);
        this.tweens.add({
          targets: spark,
          alpha: 0,
          scale: 0.2,
          duration: 300,
          onComplete: () => spark.destroy(),
        });
      }
    }
    if (done) this.crazyLeft = 0;
  }

  /**
   * Pouvoir de Mousse (tir chargé) : l'orbe est attirée par le cœur non allumé le plus
   * proche ; un fil menthe la relie à sa cible, plus net quand elle approche.
   */
  private updateMagnet(dt: number): void {
    const g = this.powerGfx.clear();
    if (this.companionId !== 'mousse' || !this.reveal.shotIsPowered || dt <= 0) return;
    const hearts = this.level.crystals
      .filter((c) => c.kind === 'heart' && !c.lit)
      .map((c) => ({ id: c.id, ...toWorld(c) }));
    for (const o of this.shotOrbs()) {
      const pull = magnetPull(o, hearts);
      outlinedCircle(g, 1.5, 0.18, o.x, o.y, MOUSSE_POWER.range);
      if (!pull) continue;
      const v = this.orbVelocity(o);
      // px/s² -> px par pas de référence, sur dt secondes de jeu.
      const k = dt * 60 * (1 / 3600);
      (o as unknown as Phaser.Physics.Matter.Components.Velocity).setVelocity(
        v.x + pull.ax * k,
        v.y + pull.ay * k,
      );
      const t = hearts.find((h) => h.id === pull.targetId);
      if (!t) continue;
      outlinedLine(g, 2, 0.25 + 0.6 * pull.strength, o.x, o.y, t.x, t.y);
      g.strokeCircle(t.x, t.y, 14 + 4 * Math.sin(this.time.now / 90));
    }
  }

  /** Aimants du décor : chaque orbe du tir est attirée (même conversion que Mousse). */
  private applyMagnets(dt: number): void {
    const orbs = this.shotOrbs();
    this.decor.setOrbs(orbs);
    if (!this.decor.hasMagnets || dt <= 0 || this.pierceLeft > 0) return;
    const k = (dt * 60) / 3600;
    for (const o of orbs) {
      const a = this.decor.magnetAt(o.x, o.y);
      if (a.ax === 0 && a.ay === 0) continue;
      const v = this.orbVelocity(o);
      (o as unknown as Phaser.Physics.Matter.Components.Velocity).setVelocity(
        v.x + a.ax * k,
        v.y + a.ay * k,
      );
    }
  }

  /**
   * Portails : l'orbe qui entre dans une bouche ressort de l'autre, même vitesse. Une orbe
   * doit sortir de la bouche d'arrivée avant de repasser, et attend 0,3 s de jeu (GD).
   */
  /** time : horloge physique (ms simulées). */
  private applyPortals(time: number): void {
    if (!this.decor.hasPortals) return;
    for (const o of this.shotOrbs()) {
      const st = this.portalState.get(o) ?? { inside: null, readyAt: 0 };
      const ready = this.gameTime >= st.readyAt;
      const step = this.decor.portalStep(o.x, o.y, st.inside, ready);
      st.inside = step.inside;
      if (step.to) {
        o.setPosition(step.to.x, step.to.y); // Matter garde la vitesse
        st.readyAt = this.gameTime + PORTAL.reentrySeconds;
        this.decor.portalFlash(step.inside);
        if (o === this.orb) {
          this.boltPrev = { ...step.to }; // l'éclair de Grelot ne balaie pas l'écran entre les bouches
          this.stuckRef = { x: step.to.x, y: step.to.y, t: time };
        } else this.twinRef = { x: step.to.x, y: step.to.y, t: time };
      }
      this.portalState.set(o, st);
    }
  }

  /** Crée un orbe de tir (corps Matter compris), à la vitesse donnée (px par pas Matter). */
  private spawnOrb(x: number, y: number, vx: number, vy: number): Phaser.GameObjects.Arc {
    const orb = this.add.circle(x, y, ORB_RADIUS, PALETTE.orb);
    this.matter.add.gameObject(orb, {
      label: 'orb',
      shape: { type: 'circle', radius: ORB_RADIUS },
      restitution: ORB_RESTITUTION,
      friction: 0,
      frictionAir: 0,
      collisionFilter: { group: ORB_COLLISION_GROUP },
    });
    (orb as unknown as Phaser.Physics.Matter.Components.Velocity).setVelocity(vx, vy);
    return orb;
  }

  /**
   * Pouvoir de Twi & Nkl : le 2e orbe part du point d'impact de l'orbe qui a touché, vitesse
   * horizontale inversée à 90 %. Une seule paire à la fois.
   */
  private splitOrb(by?: MatterJS.BodyType): void {
    const src = this.orb;
    if (!src || this.twin || (by && by !== src.body)) return;
    const { x: vx, y: vy } = this.orbVelocity(src);
    const speed = Math.hypot(vx, vy) * TWIN.speed;
    if (speed <= 0) return;
    // Une orbe qui tombe tout droit se scinde quand même en Y : part horizontale minimale.
    const side = -(Math.sign(vx) || 1);
    const sx = Math.max(Math.abs(vx) * TWIN.speed, speed * TWIN.minSideShare);
    const sy = Math.sign(vy || 1) * Math.sqrt(Math.max(0, speed * speed - sx * sx));
    const twin = this.spawnOrb(src.x, src.y, side * sx, sy);
    twin.setStrokeStyle(2, powerColor(), 0.9);
    this.twin = twin;
    if (this.crazyLeft > 0) this.setCrazy(twin, true);
    this.twinRef = { x: src.x, y: src.y, t: this.physClock() };
    // Petit éclat menthe au point de scission.
    powerFlash(this, src.x, src.y, ORB_RADIUS, 6);
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
  /** Temps simulé par Matter depuis le début du niveau (ms de jeu). */
  private physClock(): number {
    return this.matter.world.engine.timing.timestamp;
  }

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
      this.matter.add.gameObject(view, { isStatic: true, label, ...crystalFilter(c) });
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
      ...crystalFilter(c),
    });
    return view;
  }

  private makeHud(): void {
    const level = this.sceneData.level;
    const astre = this.resolveCompanion();
    this.hud = new GameHud(this, {
      levelLabel: levelLabel(level.id),
      stars: level.stars,
      astreColor: astre.def?.color ?? null,
      heartColor: this.colors.heart,
      power: astre.def && astre.id ? { id: astre.id, kind: companionKind(astre.id) } : null,
      cannon: this.muzzle(),
      hideStars: !!this.challenge,
      duel: !!this.duel,
    });
    if (this.challenge) this.challengeLine = new ChallengeLine(this, this.challenge.challenge);
  }

  /** Astre du niveau : forcé (?astre=, tests QA), choisi au sélecteur, ou celui du niveau. */
  private resolveCompanion(): { id: string | null; def: CompanionDef | undefined } {
    const forced = new URLSearchParams(window.location.search).get('astre');
    const imposed = this.hasConstraint('astre_impose') ? this.activeChallenge()?.astre : undefined;
    const duelAstre = this.duel ? this.duel.players[this.duel.active].astre : undefined;
    // Astre verrouillé par le niveau (constellation du jour, découvertes) : le choix du
    // sélecteur ne le remplace pas.
    const level = this.sceneData.level;
    const locked = level.companionLocked && level.companion ? level.companion : undefined;
    const id =
      forced ?? imposed ?? duelAstre ?? locked ?? this.sceneData.companion ?? level.companion;
    const def =
      companionById(id)?.def ??
      (forced ? (DA_DEFS as Record<string, CompanionDef | undefined>)[forced] : undefined);
    return { id, def };
  }

  private makeCompanion(): void {
    // ?astre=pip force l'Astre sur n'importe quel niveau (tests QA).
    const { id, def } = this.resolveCompanion();
    // Aide après 3 échecs sur un niveau pas encore fini (règle LD, arbitrage GD).
    const save = this.registry.get(REGISTRY.save) as SaveData | undefined;
    const needsHelp =
      !this.sceneData.test &&
      !this.duel &&
      !!save &&
      failsBeforeFirstWin(save, this.sceneData.level.id) >= HELP_AFTER_FAILS;
    this.companionId = def && id ? id : null;
    this.reveal = chargesFor(this.companionId);
    // Duel : les charges « tir suivant » restent au joueur qui les a gagnées.
    const kept = this.duel ? this.duelCharges[this.duel.active] : undefined;
    if (kept) this.reveal = kept;
    if (!def) {
      // Sans Astre (prologue) : la lanterne de la Gardienne allonge le guide du 1er tir.
      if (needsHelp) this.lanternShots = 1;
      return;
    }
    this.companion = new CompanionView(this, def, COMPANION_ANCHOR);
    this.companion.attach();
    // Avec Pip : le 1er tir montre sa trajectoire révélée ; sinon la lanterne.
    if (needsHelp) {
      if (id === 'pip') this.reveal.grant(1);
      else this.lanternShots = 1;
    }
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
    // Orbe éclair de Grelot : ni gravité ni rebond, la prédiction ne s'applique pas.
    if (this.pierceLeft > 0) return null;
    // Cœur porté par le décor : cible mobile, seul le vrai contact déclenche le ralenti.
    if (this.decor.isMoving(heart.id)) return null;
    const steps = Math.ceil(EVENT_THRESHOLDS.finalSlowmoLeadSeconds * 60);
    const input = {
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
      field: this.decor.field,
      maxBounces: 99,
      maxSteps: steps,
      substeps: Math.round(ORB_PHYSICS.stepsPerSecond / 60),
      // Cible un peu réduite : on préfère rater un ralenti (le vrai contact le relance)
      // qu'en déclencher un faux.
      target: this.finalTarget(heart),
    };
    const contactStep = robustContactStep(input);
    if (contactStep === null) return null;
    const path = predictPath(input).points;
    // La prédiction suppose le décor immobile : un peg mobile près du trajet la rend douteuse.
    if (this.decor.active && this.decor.mayCross(path, contactStep / 60, heart.id, ORB_RADIUS))
      return null;
    // Un portail sur le trajet : la prédiction s'abstient (le vrai contact relance le ralenti).
    // Marge : rayon de l'orbe, plus autant pour les variantes de robustContactStep.
    if (this.decor.touchesPortal(path, ORB_RADIUS * 2)) return null;
    return contactStep / 60;
  }

  /** Relaie sur le bus les événements détectés par le ShotTracker. */
  private emitAll(events: DetectedEvent[]): void {
    for (const e of events) {
      if (e === 'final_ralenti') this.startSlowmo();
      if (e === 'pouvoir_active') this.challengeStep((t, snap) => t.powerActivated(snap));
      if (e === 'pouvoir_active' && companionById(this.companionId)?.power.kind !== 'immediate') {
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
          this.level.score += this.level.orbs * this.level.tuning.orbBonus;
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
    // Après un gel d'image, le ralenti dure tout son temps une fois le jeu reparti.
    if (isFinalHeartLit(this.level)) {
      this.slowmoUntil = Math.max(this.time.now, this.hitStopUntil) + SLOWMO.afterContactMs;
      this.slowmoSafetyAt = 0;
    } else {
      // Contact prévu : le ralenti tient jusqu'à l'impact (filet en temps simulé).
      this.slowmoUntil = Number.MAX_SAFE_INTEGER;
      this.slowmoSafetyAt = this.physClock() + SLOWMO.safetyGameMs;
    }
    this.applyGameScale(SLOWMO.scale);
  }

  private startHitStop(): void {
    this.hitStopUntil = this.time.now + FINAL_HIT_STOP_MS;
    this.matter.world.pause();
    this.tweens.pauseAll();
  }

  private updateSlowmo(now: number): void {
    const missed = this.slowmoSafetyAt > 0 && this.physClock() >= this.slowmoSafetyAt;
    if (this.slowmoUntil > 0 && (now >= this.slowmoUntil || missed)) {
      this.slowmoSafetyAt = 0;
      this.slowmoUntil = -1; // une seule fois par tir
      this.applyGameScale(this.warpUntil > 0 ? HORLOGE.scale : 1);
    }
  }

  /** Pouvoir d'Horloge : tout le jeu ralentit, le réceptacle s'élargit et suit le pointeur. */
  private startTimeWarp(): void {
    this.warpUntil = this.time.now + HORLOGE.realMs;
    this.warpTargetX = this.bucket.x;
    this.warpPointerX = this.input.activePointer.worldX;
    this.widenBucket(HORLOGE.bucketScale);
    if (this.slowmoUntil <= 0) this.applyGameScale(HORLOGE.scale);
  }

  /** Réceptacle élargi par un pouvoir : bord menthe pendant l'effet (specs UI/UX jalon 2 §3). */
  private widenBucket(scale: number): void {
    this.bucketEdgeTween?.stop();
    this.bucket.setScale(scale, 1).setStrokeStyle(2, powerColor(), 0.95);
  }

  /** Fin de l'effet : taille normale, le bord menthe revient au lavande en 200 ms puis s'efface. */
  private releaseBucket(): void {
    if (this.bucket.scaleX === 1) return;
    this.bucket.setScale(1);
    const from = Phaser.Display.Color.ValueToColor(powerColor());
    const to = Phaser.Display.Color.ValueToColor(PALETTE.bucketEdge);
    this.bucketEdgeTween?.stop();
    this.bucketEdgeTween = this.tweens.addCounter({
      from: 0,
      to: 100,
      duration: 200,
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, k);
        this.bucket.setStrokeStyle(2, Phaser.Display.Color.GetColor(c.r, c.g, c.b), 0.95);
      },
      onComplete: () => this.bucket.setStrokeStyle(),
    });
  }

  private endTimeWarp(): void {
    if (this.warpUntil <= 0) return;
    this.warpUntil = 0;
    this.releaseBucket();
    // Le ralenti du final, s'il joue, garde la main.
    if (this.slowmoUntil <= 0) this.applyGameScale(1);
  }

  /**
   * Pouvoir de Nuage-Lune : l'orbe qui sort par le bas sans être rattrapée remonte une fois
   * (charge en réserve). Pas au tir final : l'orbe y finit dans les zones de bonus.
   */
  private secondChance(orb: Phaser.GameObjects.Arc): boolean {
    if (this.companionId !== 'nuage-lune' || this.finalShot || this.secondChanceUsed) return false;
    if (!this.reveal.consume()) return false;
    this.secondChanceUsed = true;
    const v = this.orbVelocity(orb);
    const x = Phaser.Math.Clamp(
      orb.x,
      PLAYFIELD.x + ORB_RADIUS,
      PLAYFIELD.x + PLAYFIELD.w - ORB_RADIUS,
    );
    const y = GAME_HEIGHT - ORB_RADIUS;
    // Remontée balistique vers le cœur restant le plus bas (sommet à sa hauteur, à son aplomb).
    const target = lowestHeart(
      this.level.crystals.filter((c) => c.kind === 'heart' && !c.lit).map((c) => toWorld(c)),
    );
    const up = secondChanceVelocity({ x, y }, target, GRAVITY_PER_STEP * 3600, v.x * 60);
    orb.setPosition(x, y);
    (orb as unknown as Phaser.Physics.Matter.Components.Velocity).setVelocity(
      up.vx / 60,
      up.vy / 60,
    );
    this.stuckRef = { x, y, t: this.physClock() };
    // La pastille-bouclier se brise en paillettes menthe, l'orbe repart vers le haut.
    for (let i = 0; i < 14; i++) {
      const a = Math.PI + (i / 13) * Math.PI;
      const dot = powerParticle(this, x, y, 3, 0.9).setDepth(30);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(a) * 46,
        y: y + Math.sin(a) * 46,
        alpha: 0,
        scale: 0.3,
        duration: 480,
        ease: 'Cubic.Out',
        onComplete: () => dot.destroy(),
      });
    }
    const fc = Phaser.Display.Color.IntegerToColor(powerColor());
    this.cameras.main.flash(120, fc.red, fc.green, fc.blue);
    // Réceptacle 2 fois plus large pour le reste du tir.
    this.widenBucket(NUAGE_LUNE_POWER.bucketScale);
    this.refreshPower();
    return true;
  }

  /** Pouvoir de Grelot : l'orbe part en éclair, droit et rapide, à travers les cristaux. */
  private startBolt(): void {
    const orb = this.orb;
    if (!orb) return;
    const v = this.orbVelocity(orb);
    const mo = orb as unknown as Phaser.Physics.Matter.Components.Velocity &
      Phaser.Physics.Matter.Components.Gravity;
    mo.setIgnoreGravity(true);
    mo.setVelocity(v.x * GRELOT.speed, v.y * GRELOT.speed);
    const body = orb.body as MatterJS.BodyType;
    body.collisionFilter.mask = 0xffffffff & ~CRYSTAL_CATEGORY;
    orb.setStrokeStyle(3, powerColor(), 0.95);
    this.pierceLeft = GRELOT.pierce;
    this.pierced.clear();
    this.boltLeft = GRELOT.maxSeconds;
    this.boltPrev = { x: orb.x, y: orb.y };
  }

  /** Éclair : les cristaux balayés depuis la frame précédente s'allument, sans rebond. */
  private updateBolt(dt: number): void {
    const orb = this.orb;
    if (this.pierceLeft <= 0 || !orb) return;
    const from = this.boltPrev;
    const to = { x: orb.x, y: orb.y };
    this.boltPrev = to;
    const hits = this.level.crystals
      .filter((c) => c.kind !== 'wall' && !c.lit && !this.pierced.has(c.id))
      .map((c) => ({ c, t: sweepHit(from, to, c, ORB_RADIUS) }))
      .filter((h): h is { c: Crystal; t: number } => h.t !== null)
      .sort((a, b) => a.t - b.t);
    for (const { c } of hits) {
      if (this.pierceLeft <= 0) break;
      this.pierced.add(c.id);
      this.pierceLeft -= 1;
      this.onCrystalHit(c.id);
    }
    const spark = powerParticle(this, to.x, to.y, 4, 0.7).setDepth(orb.depth - 1);
    this.tweens.add({
      targets: spark,
      alpha: 0,
      scale: 0.3,
      duration: 260,
      onComplete: () => spark.destroy(),
    });
    this.boltLeft -= dt;
    if (this.pierceLeft <= 0 || this.boltLeft <= 0) this.endBolt();
  }

  /** Fin de l'éclair : gravité et collisions avec les cristaux reviennent. */
  private endBolt(): void {
    if (this.pierceLeft <= 0 && this.boltLeft <= 0) return;
    this.pierceLeft = 0;
    this.boltLeft = 0;
    const orb = this.orb;
    if (!orb?.body) return;
    (orb as unknown as Phaser.Physics.Matter.Components.Gravity).setIgnoreGravity(false);
    (orb.body as MatterJS.BodyType).collisionFilter.mask = 0xffffffff;
    orb.setStrokeStyle();
  }

  /** Échelle de temps de tout le jeu : physique, réceptacle, tweens, Astre. */
  private applyGameScale(scale: number): void {
    this.gameScale = scale;
    // Ralenti final : le HUD s'estompe (le spectacle prime), la loge reste visible.
    if (scale <= SLOWMO.scale !== this.hudDimmed) {
      this.hudDimmed = scale <= SLOWMO.scale;
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
    if (this.ending || this.turnSwitching) return;
    if (!canShoot(this.level) || !startShot(this.level)) return;
    const start = this.muzzle();
    this.orb = this.spawnOrb(
      start.x,
      start.y,
      Math.cos(this.aimAngle) * LAUNCH_SPEED,
      Math.sin(this.aimAngle) * LAUNCH_SPEED,
    );
    this.shotCatches = 0;
    this.challenge?.shotStarted();
    this.crazyLeft = 0;
    this.chain = 0;
    this.slowmoUntil = 0;
    this.slowmoSafetyAt = 0;
    this.stuckRef = { x: start.x, y: start.y, t: this.physClock() };
    this.stuckNudges = 0;
    this.stuckAnnounced = false;
    this.companion?.setPhase('flight');
    if (companionById(this.companionId)?.power.kind !== 'reserve') this.reveal.fire();
    if (this.companionId === 'horloge' && this.reveal.shotIsPowered) this.startTimeWarp();
    if (this.companionId === 'grelot' && this.reveal.shotIsPowered) this.startBolt();
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

  /**
   * Un rebond compte pour la chaîne, sauf les rebonds sur place d'une orbe coincée
   * (QA A19 : Pip fêtait une « chaîne longue » pendant un blocage).
   */
  private countBounce(): void {
    if (this.stuckAnnounced || !this.orb) return;
    const v = this.orbVelocity(this.orb);
    if (Math.hypot(v.x, v.y) * 60 < BOUNCE_MIN_SPEED) return;
    this.emitAll(this.tracker.bounced());
  }

  /** by : corps de l'orbe qui touche (absent pour une onde de choc). */
  private onCrystalHit(id: number, by?: MatterJS.BodyType): void {
    const crystal = this.level.crystals.find((c) => c.id === id);
    if (crystal?.kind === 'wall') {
      gameEvents.emit('mur_touche', {});
      this.countBounce();
      return;
    }
    const points = hitCrystal(this.level, id);
    if (!crystal) return;
    if (points === 0) {
      this.countBounce(); // rebond sur un cristal déjà allumé
      return;
    }
    this.chain += 1;
    this.views.get(id)?.setFillStyle(PALETTE.lit);
    this.breakdown.add(crystal.kind, points);
    gameEvents.emit('cristal_allume', { kind: crystal.kind, chain: this.chain, points });
    this.challengeStep((t, snap) => t.crystalLit(crystal.kind, snap));
    this.emitAll(this.tracker.crystalLit(crystal.kind, this.level.shotScore, crystal.id));
    if (crystal.kind === 'power' && this.companionId === 'bourdon') this.shockwave(crystal);
    if (crystal.kind === 'power' && this.companionId === 'jumelles' && by) this.splitOrb(by);
    if (crystal.kind === 'power' && this.companionId === 'volte') this.startCrazyBounce();
    // Seulement au contact du dernier cœur lui-même : les cristaux touchés ensuite (le niveau
    // reste « dernier cœur allumé » jusqu'à la fin du tir) ne relancent ni gel ni final (QA).
    if (crystal.kind === 'heart' && isFinalHeartLit(this.level)) {
      // Filet de sécurité : le dernier cœur touché sans prédiction préalable.
      // Pas encore de ralenti, ou un ralenti déjà terminé pendant ce tir : petit gel
      // d'image, l'Astre réagit, puis le ralenti part pour le vrai contact.
      if (this.slowmoUntil > 0) {
        // Ralenti prévu en cours : il tient encore un peu après l'impact, sans 2e final.
        this.slowmoUntil = this.time.now + SLOWMO.afterContactMs;
        this.slowmoSafetyAt = 0;
      } else {
        this.slowmoUntil = 0;
        this.startHitStop();
        this.emitAll(['final_ralenti']);
      }
      this.showFinalZones();
    }
    this.refreshHud();
  }

  /**
   * Pouvoir de Bourdon, onde de choc (GD reglages-jalon1, rayon ×1,1 en 880 × 656) :
   * tous les cristaux dans le rayon s'allument quand l'onde les atteint (0,3 s), sans
   * pousser l'orbe. Une onde peut en déclencher une autre sur un cristal pouvoir.
   */
  private shockwave(from: Crystal): void {
    const c = toWorld(from);
    // Onde hexagonale (forme des pouvoirs) au départ d'un éclat à cœur blanc chaud.
    const ring = this.add.graphics().setDepth(6);
    powerFlash(this, c.x, c.y, 10, 6.5, 2.5, 220);
    const wave = { r: 0 };
    this.tweens.add({
      targets: wave,
      r: SHOCKWAVE.radius,
      duration: SHOCKWAVE.seconds * 1000,
      ease: 'Quad.Out',
      onUpdate: () => {
        const a = 1 - (wave.r / SHOCKWAVE.radius) * 0.6;
        // Hexagone circonscrit au cercle de l'onde : tout cristal allumé est dedans.
        const hr = wave.r / Math.cos(Math.PI / 6);
        const pts = hexPoints(hr).map((p) => new Phaser.Math.Vector2(p.x + c.x, p.y + c.y));
        ring
          .clear()
          .fillStyle(powerColor(), 0.12 * a)
          .fillPoints(pts, true);
        outlinedHex(ring, 4, 0.9 * a, c.x, c.y, hr);
        for (const k of this.level.crystals) {
          if (k.lit || k.kind === 'wall' || k.id === from.id) continue;
          const w = toWorld(k);
          if (Math.hypot(w.x - c.x, w.y - c.y) <= wave.r) this.onCrystalHit(k.id);
        }
      },
      onComplete: () => ring.destroy(),
    });
  }

  /** finalX : abscisse retenue pour la zone finale (par défaut, celle de l'orbe). */
  private finishShot(finalX = this.orb?.x): void {
    const catches = Math.min(TWIN.maxCatches, this.shotCatches);
    const caught = catches > 0;
    if (this.finalShot && finalX !== undefined) this.scoreFinalZone(finalX);
    // Bonus de chaîne (GD) : +10 % du score du tir par rebond au-delà de 10, au plus +100 %.
    const chain = chainBonus(this.level.shotScore, this.tracker.shotBounces, this.level.tuning);
    if (chain > 0) {
      this.level.score += chain;
      this.breakdown.addChain(chain);
    }
    this.orb?.destroy();
    this.orb = undefined;
    this.twin?.destroy();
    this.twin = undefined;
    this.crazyLeft = 0;
    this.powerGfx.clear();
    this.endTimeWarp();
    this.endBolt();
    this.releaseBucket(); // réceptacle élargi de Nuage-Lune
    this.secondChanceUsed = false;
    this.hud.setPowerActivity(0, false);
    this.decor.setOrbs([]);
    this.hud.endShot();
    this.applyGameScale(1);
    const bounces = this.tracker.shotBounces;
    const result = endShot(this.level, catches);
    // Défi devenu impossible : le niveau se termine sur l'écran d'échec (specs UI/UX 2.4).
    this.challengeStep((t, snap) => t.shotEnded(bounces, snap));
    if (result.phase === 'aiming' && this.challenge?.state === 'failed') {
      this.level.phase = 'lost';
      result.phase = 'lost';
    }
    const shooter = this.duel?.active;
    const turn = this.duel ? endTurn(this.level, this.duel) : undefined;
    if (turn) result.phase = this.level.phase;
    this.removeViews(result.removedIds);
    // Régénération : les cristaux revenus réapparaissent avec un pop.
    for (const c of result.restored) {
      const view = this.makeCrystal(c);
      this.views.set(c.id, view);
      view.setScale(0.2);
      this.tweens.add({ targets: view, scale: 1, duration: 320, ease: 'Back.Out' });
    }
    if (result.removedIds.length > 0) {
      gameEvents.emit('cristaux_brises', { count: result.removedIds.length });
    }
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
    if (turn?.newLeader != null)
      gameEvents.emit('duel_avantage', { joueur: playerNumber(turn.newLeader) });
    if (result.phase === 'won') this.endLevel(true);
    else if (result.phase === 'lost') this.endLevel(false);
    else {
      if (turn?.switched && shooter !== undefined) this.beginTurnSwitch(shooter);
      this.emitAll(this.tracker.beginAiming(heartsRemaining(this.level), this.level.orbs));
    }
  }

  /** Astres du duel (J1, J2) : choisis à l'écran d'avant duel, sinon celui du niveau. */
  private duelAstres(): [string | null, string | null] {
    const a = this.sceneData.mode?.astres;
    const fallback = this.sceneData.companion ?? this.sceneData.level.companion ?? null;
    return [a?.[0] ?? fallback, a?.[1] ?? fallback];
  }

  /**
   * Duel : l'Astre du tireur finit sa réaction, puis celui du joueur suivant prend la loge
   * (avec son pouvoir et son HUD) ; la bannière annonce le tour.
   */
  private beginTurnSwitch(shooter: PlayerIndex): void {
    this.duelCharges[shooter] = this.reveal;
    this.turnSwitching = true;
    this.time.delayedCall(DUEL_SWITCH_MS, () => {
      const d = this.duel;
      if (!d || this.ending) return;
      this.companion?.destroy();
      this.companion = undefined;
      this.hud.destroy();
      this.makeHud();
      this.makeCompanion();
      (this.companion as CompanionView | undefined)?.setPhase('aiming');
      this.hudDimmed = false;
      this.refreshHud();
      this.refreshPower();
      this.duelHud?.setActive(d.active, true);
      gameEvents.emit('duel_tour', { joueur: playerNumber(d.active) });
      this.turnSwitching = false;
    });
  }

  private endLevel(won: boolean): void {
    this.ending = true;
    this.challengeStep((t, snap) => t.levelEnded(won, snap));
    const score = this.level.score;
    const orbBonus = won ? this.level.orbs * this.level.tuning.orbBonus : 0;
    const payload: ResultsData = {
      level: this.sceneData.level,
      score,
      won,
      orbsLeft: this.level.orbs,
      heartsLeft: heartsRemaining(this.level),
      breakdown: this.breakdown.finish(score, orbBonus),
      test: this.sceneData.test,
      mode: this.sceneData.mode,
      challenge: this.challenge
        ? { goal: this.challenge.challenge.goal, success: this.challenge.state === 'success' }
        : undefined,
      duel: this.duel ? this.duelSummary(this.duel) : undefined,
    };
    if (this.duel) {
      const w = payload.duel?.winner ?? null;
      gameEvents.emit('duel_fin', { gagnant: w === null ? null : playerNumber(w) });
    }
    // Overlay par-dessus le jeu, qui n'est PAS mis en pause : l'Astre continue de vivre.
    const delay = won ? RESULTS_DELAY_MS : FAIL_DELAY_MS;
    if (won && !this.duel) {
      // La constellation du chapitre s'allume : étoiles gagnées une à une (specs-decors).
      const save = this.registry.get(REGISTRY.save) as SaveData | undefined;
      const earned = earnedStars(save, this.sceneData.level.id);
      this.backdrop?.lightUp(earned.indices, earned.complete);
    }
    this.time.delayedCall(delay, () => this.scene.launch(SCENES.results, payload));
  }

  /**
   * Anti-blocage : orbe presque immobile depuis 3 s de jeu simulé (horloge physique `time`) ->
   * les cristaux allumés autour se brisent.
   */
  private checkStuck(time: number): void {
    const orb = this.orb;
    if (!orb) return;
    // Rayon large : une orbe qui rebondit dans une petite boîte de murs reste « sur place »
    // (QA T12), alors qu'une orbe libre (ou poussée) le quitte en un instant.
    if (Math.hypot(orb.x - this.stuckRef.x, orb.y - this.stuckRef.y) > STUCK_RADIUS_PX) {
      this.stuckRef = { x: orb.x, y: orb.y, t: time };
      if (this.stuckAnnounced) {
        this.stuckAnnounced = false;
        gameEvents.emit('orbe_debloquee', {});
      }
      return;
    }
    const still = time - this.stuckRef.t;
    const limit = TUNING.antiStuckSeconds * 1000;
    if (still < limit - STUCK_BLOW_LEAD_MS) return;
    const near = this.level.crystals.filter((c) => {
      const w = toWorld(c);
      const reach = c.shape?.type === 'brick' ? Math.max(c.shape.w, c.shape.h) / 2 : 10;
      return Math.hypot(w.x - orb.x, w.y - orb.y) < reach + ORB_RADIUS + 12;
    });
    // Rien de cassable autour : l'Astre prend la pose (il gonfle les joues) un peu avant
    // l'impulsion, pour que son souffle tombe au moment où l'orbe repart.
    if (!this.stuckAnnounced && !near.some((c) => c.lit)) {
      this.stuckAnnounced = true;
      gameEvents.emit('orbe_coincee', { attempt: this.stuckNudges + 1 });
    }
    if (still < limit) return;
    this.stuckRef.t = time;
    // 1. Le classique du genre : les cristaux allumés qui la retiennent se brisent.
    const broken = breakLitNow(
      this.level,
      near.map((c) => c.id),
    );
    if (broken.length > 0) {
      this.removeViews(broken);
      return;
    }
    // 2. Rien de cassable (mur incassable, cristal éteint) : petite impulsion, 2 essais.
    this.stuckNudges += 1;
    if (this.stuckNudges <= TUNING.antiStuckNudges) {
      // Vers l'extérieur du plus proche obstacle, ou vers le centre du terrain.
      const ref = near
        .map(toWorld)
        .sort((a, b) => Math.abs(a.x - orb.x) - Math.abs(b.x - orb.x))[0];
      const side = ref && Math.abs(orb.x - ref.x) > 1 ? orb.x - ref.x : 640 - orb.x;
      (orb as unknown as Phaser.Physics.Matter.Components.Velocity).setVelocity(
        Math.sign(side || 1) * STUCK_NUDGE_SPEED,
        -STUCK_NUDGE_SPEED,
      );
      return;
    }
    // 3. Toujours coincée : elle se dissout en particules, le tir se termine normalement.
    this.dissolveOrb(orb.x, orb.y);
    if (this.stuckAnnounced) {
      this.stuckAnnounced = false;
      gameEvents.emit('orbe_debloquee', {});
    }
    // Tir final : l'orbe n'est tombée dans aucune zone, elle vaut la plus faible (la plus proche).
    this.orbGone(
      false,
      orb.x < PLAYFIELD.x + PLAYFIELD.w / 2 ? PLAYFIELD.x : PLAYFIELD.x + PLAYFIELD.w - 1,
    );
  }

  private dissolveOrb(x: number, y: number): void {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const dot = this.add.circle(x, y, 3, PALETTE.orb).setDepth(30);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(a) * 34,
        y: y + Math.sin(a) * 34 - 12,
        alpha: 0,
        scale: 0.3,
        duration: 520,
        ease: 'Cubic.Out',
        onComplete: () => dot.destroy(),
      });
    }
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
    this.pausedAt = this.time.now;
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
    // Le ralenti d'Horloge et celui du final comptent en temps réel : la pause ne les use pas.
    const away = this.time.now - this.pausedAt;
    if (this.warpUntil > 0) this.warpUntil += away;
    if (this.slowmoUntil > 0) this.slowmoUntil += away;
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
    const half = (BUCKET.width * this.bucket.scaleX) / 2;
    const min = PLAYFIELD.x + half;
    const max = PLAYFIELD.x + PLAYFIELD.w - half;
    if (this.warpUntil > 0) {
      // Ralenti d'Horloge : le réceptacle rattrape le pointeur, ou suit les flèches (clavier).
      const px = this.input.activePointer.worldX;
      if (px !== this.warpPointerX) this.warpTargetX = this.warpPointerX = px;
      const keys = this.input.keyboard?.createCursorKeys();
      const dir = (keys?.right.isDown ? 1 : 0) - (keys?.left.isDown ? 1 : 0);
      this.warpTargetX += dir * speed * HORLOGE.keySpeed * (delta / 1000);
      this.warpTargetX = Phaser.Math.Clamp(this.warpTargetX, min, max);
      const target = this.warpTargetX;
      const k = Math.min(1, HORLOGE.follow * (delta / 1000));
      this.bucket.x += (target - this.bucket.x) * k;
      return;
    }
    this.bucket.x += this.bucketDir * speed * (delta / 1000);
    if (this.bucket.x > max) this.bucketDir = -1;
    if (this.bucket.x < min) this.bucketDir = 1;
    this.bucket.x = Phaser.Math.Clamp(this.bucket.x, min, max);
  }

  private drawGuide(): void {
    this.guide.clear();
    if (this.ending || !canShoot(this.level)) return;
    const start = this.muzzle();
    // Tir suivant armé : anneau menthe 40 % autour de la bouche du canon (specs UI/UX §3).
    if (this.reveal.armed && companionById(this.companionId)?.power.kind === 'next')
      outlinedCircle(this.guide, 3, 0.4, start.x, start.y, 13);
    // Défi sans guide : ni guide de visée, ni trajectoire révélée.
    if (this.hasConstraint('sans_guide')) return;
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
      field: this.decor.field,
      portal: this.decor.portal,
    };
    if (this.companionId === 'pip' && this.reveal.armed) {
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
    this.companion?.brain.setPowered(this.reveal.armed || this.reveal.shotIsPowered);
    if (!this.companion) return;
    this.hud.setPower(this.reveal.charges, this.reveal.rule.maxCharges, this.reveal.shotIsPowered);
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

  // --- Défis (regles-modes-jalon3 §1) ------------------------------------------

  /** Défi du niveau, en mode défi (ou ?defi pour les tests QA). */
  private activeChallenge(): Challenge | undefined {
    const level = this.sceneData.level;
    const asked =
      this.sceneData.mode?.kind === 'defi' ||
      new URLSearchParams(window.location.search).has('defi');
    return asked ? level.challenge : undefined;
  }

  private hasConstraint(c: Challenge['constraint']): boolean {
    return this.activeChallenge()?.constraint === c;
  }

  private challengeSnapshot(): ChallengeSnapshot {
    const s = this.level;
    return {
      score: s.score,
      breakableLeft: s.crystals.filter((c) => c.kind !== 'wall' && !c.lit).length,
      breakableTotal: this.breakableTotal,
      heartsLeft: heartsRemaining(s),
      orbs: s.orbs,
      canRegainOrbs: !this.hasConstraint('sans_receptacle'),
    };
  }

  /** Fait avancer le défi et réagit aux changements d'état (son, ligne, Astre). */
  private challengeStep(
    fn: (t: ChallengeTracker, snap: ChallengeSnapshot) => ChallengeState,
  ): void {
    const t = this.challenge;
    if (!t) return;
    const before = t.state;
    const after = fn(t, this.challengeSnapshot());
    if (after !== before) {
      if (after === 'reached' || (after === 'success' && before === 'pending')) {
        this.challengeLine?.celebrate();
        gameEvents.emit('defi_reussi', { goal: t.challenge.goal });
      } else if (after === 'failed') {
        gameEvents.emit('defi_rate', { goal: t.challenge.goal });
      }
    }
    this.challengeLine?.update(t.state, t.ratio, t.secondsLeft);
  }

  /** Chrono du défi (temps réel de jeu, pause exclue) ; raté en visée -> fin du niveau. */
  private updateChallenge(dt: number): void {
    const t = this.challenge;
    if (!t || this.ending) return;
    if (this.level.phase === 'shooting' || this.level.phase === 'aiming')
      this.challengeStep((tr) => tr.tick(dt));
    if (t.state === 'failed' && !this.orb && this.level.phase === 'aiming') {
      this.level.phase = 'lost';
      this.endLevel(false);
    }
  }

  private duelSummary(d: DuelState): NonNullable<ResultsData['duel']> {
    const scores: [number, number] = [d.players[0].score, d.players[1].score];
    const winner: PlayerIndex | null =
      scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1;
    const astres: [string, string] = [d.players[0].astre ?? '', d.players[1].astre ?? ''];
    return { scores, winner, astres, tiebreak: d.tiebreak };
  }

  private refreshHud(): void {
    const s = this.level;
    const hearts = heartsRemaining(s);
    const d = this.duel;
    if (d && this.duelHud) {
      // Le score du tireur monte en direct pendant son tir.
      const scores: [number, number] = [d.players[0].score, d.players[1].score];
      scores[d.active] = s.score;
      this.duelHud.setScores(scores);
      this.duelHud.setHearts(hearts);
    }
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

/** Charges « tir suivant » selon l'Astre (réglages GD) ; Pip garde son aperçu de visée. */
function chargesFor(id: string | null): ShotCharges {
  if (id === 'pip') return new RevealCharges();
  const rules: Record<string, ChargeRule> = {
    mousse: MOUSSE_POWER,
    'nuage-lune': NUAGE_LUNE_POWER,
  };
  const info = companionById(id);
  const rule = (id ? rules[id] : undefined) ?? {
    chargesPerActivation: 1,
    maxCharges: info?.power.kind === 'immediate' ? 0 : (info?.power.maxCharges ?? 0),
  };
  return new ShotCharges(rule);
}

/** Les cristaux cassables sont dans leur propre catégorie ; les murs restent solides. */
function crystalFilter(c: Crystal): { collisionFilter?: { category: number } } {
  return c.kind === 'wall' ? {} : { collisionFilter: { category: CRYSTAL_CATEGORY } };
}

/**
 * Premier instant (0..1) où un orbe de rayon `r` allant de `a` à `b` touche le cristal,
 * ou null. Cercles exacts ; briques échantillonnées tous les 3 px dans leur repère.
 */
function sweepHit(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: Crystal,
  r: number,
): number | null {
  const w = toWorld(c);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const shape = c.shape ?? { type: 'circle' as const, r: 10 };
  if (shape.type !== 'brick') {
    const reach = shape.r + r;
    if (len < 1e-6) return Math.hypot(a.x - w.x, a.y - w.y) <= reach ? 0 : null;
    const t = Phaser.Math.Clamp(((w.x - a.x) * dx + (w.y - a.y) * dy) / (len * len), 0, 1);
    return Math.hypot(a.x + dx * t - w.x, a.y + dy * t - w.y) <= reach ? t : null;
  }
  const ang = -Phaser.Math.DegToRad(shape.angle);
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const n = Math.max(1, Math.ceil(len / 3));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const px = a.x + dx * t - w.x;
    const py = a.y + dy * t - w.y;
    const lx = px * cos - py * sin;
    const ly = px * sin + py * cos;
    if (Math.abs(lx) <= shape.w / 2 + r && Math.abs(ly) <= shape.h / 2 + r) return t;
  }
  return null;
}

function companionKind(id: string): 'next' | 'immediate' | 'reserve' {
  return companionById(id)?.power.kind ?? 'immediate';
}
