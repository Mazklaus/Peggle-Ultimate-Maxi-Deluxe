import Phaser from 'phaser';
import { audio } from '../audio';
import { awakeAstres } from '../core/audio/storyMusic';
import { GAME_HEIGHT, GAME_WIDTH, PLAYFIELD } from '../config';
import { levelLabel, type LevelCatalog } from '../core/levelCatalog';
import type { LevelData } from '../core/levelFormat';
import {
  announceKey,
  CHAPTER_COUNT,
  chapterLevelIds,
  chapterStars,
  chapterState,
  chaptersDone,
  currentChapter,
  LEVELS_PER_CHAPTER,
  MAX_STARS,
  pendingUnlock,
  totalStars,
  type ChapterState,
} from '../core/mapProgress';
import { isUnlocked, writeSave, type SaveData } from '../core/save';
import { COMPANION_ROSTER, companionById } from '../companions';
import { companionChoice, type CompanionChoice } from '../core/companionChoice';
import { CompanionView } from './CompanionView';
import type { CompanionSelectData } from './CompanionSelectScene';
import { drawPortrait, drawPowerHex, drawPowerIcon } from './powerIcons';
import { OPTIONS_CHANGED, REGISTRY, SCENES } from './keys';
import { MapCompanion } from './MapCompanion';
import {
  astreDef,
  chapter as chapterDef,
  CHAPTERS,
  MAP_BACKGROUNDS,
  miniPoints,
  PROLOGUE_NODES,
  SKY,
  type ChapterDef,
  type Point,
} from './mapData';
import { currentOptions, updateOptions } from './OptionsScene';
import { CRYSTAL_COLORS, CRYSTAL_COLORS_CB, PALETTE, textStyle, TEXT, bodyStyle } from './theme';
import { fadeIn, fadeTo, panel, setEditorLinkVisible } from './ui';
import { iconButton, primaryButton, setIconButtonActive } from './widgets';

/** Carte de niveau : zone laissée libre par le décor (specs UI/UX 3), coin haut-gauche. */
const CARD = { x: 900, y: 450, w: 300, h: 230 };
/** Mini-silhouette du niveau dans la carte. */
const PREVIEW = { w: 120, h: 90 };
/** Zoom caméra entre la vue ciel et la vue chapitre (specs jalon 2, 1). */
const ZOOM = { factor: 2.4, ms: 500 };
/** Séquence de déblocage d'un chapitre (specs jalon 2, 1.3), en ms. */
const UNLOCK = { lightUp: 1200, path: 800, draw: 600, astre: 1200 };

type NodeState = 'locked' | 'open' | 'done';

interface MapNode {
  id: string;
  level?: LevelData;
  x: number;
  y: number;
  state: NodeState;
  stars: number;
}

export interface MapSceneData {
  view?: 'sky' | 'chapter';
  chapter?: number;
  /** Vue ciel ouverte depuis ce chapitre : dézoom depuis sa miniature. */
  from?: number;
  /** Séquence de déblocage en cours pour ce chapitre. */
  unlock?: number;
}

/**
 * Carte du ciel (specs UI/UX jalon 1 §3 et jalon 2 §1), deux vues :
 * - vue CHAPITRE : fond du chapitre, ses 12 étoiles-niveaux, la Gardienne et l'Astre du
 *   chapitre, carte de niveau (aperçu, étoiles, record, JOUER) ; le ch. 1 garde
 *   l'Observatoire et le prologue ;
 * - vue CIEL : l'Observatoire, la Grande Veilleuse et les 8 constellations en miniature.
 * On passe de l'une à l'autre par un zoom caméra ; la séquence de déblocage d'un chapitre
 * se joue une seule fois.
 */
export class MapScene extends Phaser.Scene {
  private card?: Phaser.GameObjects.Container;
  private nodes: MapNode[] = [];
  private companion?: MapCompanion;
  private astres: CompanionView[] = [];
  private view: 'sky' | 'chapter' = 'chapter';
  private chapterN = 1;
  private leaving = false;

  constructor() {
    super(SCENES.map);
  }

  preload(): void {
    // Normalement déjà chargés par le Boot (pas de noir prolongé à l'entrée de la carte).
    for (const { key, file } of MAP_BACKGROUNDS)
      if (!this.textures.exists(key)) this.load.svg(key, file, { width: 1280, height: 720 });
  }

  create(data: MapSceneData = {}): void {
    fadeIn(this);
    this.card = undefined;
    this.companion = undefined;
    this.astres = [];
    this.leaving = false;
    this.cameras.main.setBackgroundColor(PALETTE.night);
    const save = this.save();
    const order = this.catalog().levels.map((l) => l.id);

    // Aiguillage : séquence de déblocage en attente, sinon la vue demandée, sinon le
    // chapitre en cours (un clic de moins depuis le titre).
    let view = data.view;
    let n = data.chapter;
    let unlock = data.unlock;
    if (!view) {
      const pending = pendingUnlock(save);
      if (pending) {
        view = 'chapter';
        n = pending - 1;
        unlock = pending;
      } else {
        view = 'chapter';
        n = Math.max(1, currentChapter(save, order));
      }
    }
    this.view = view;
    this.chapterN = Phaser.Math.Clamp(n ?? 1, 1, CHAPTER_COUNT);

    if (this.view === 'chapter') this.buildChapter(chapterDef(this.chapterN), unlock);
    else this.buildSky(data.from, unlock);
    this.buildTopBar();

    setEditorLinkVisible(true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      setEditorLinkVisible(false);
      for (const a of this.astres) a.destroy();
      this.astres = [];
    });
    this.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, dt: number) => {
      for (const a of this.astres) a.update(dt / 1000, {});
    });
  }

  private save(): SaveData {
    return this.registry.get(REGISTRY.save) as SaveData;
  }

  private catalog(): LevelCatalog {
    return this.registry.get(REGISTRY.catalog) as LevelCatalog;
  }

  // --- Barre du haut ----------------------------------------------------------

  private buildTopBar(): void {
    const back = () => this.goBack();
    iconButton(this, 40, 36, 'back', back, { diameter: 48 });
    const cb = iconButton(
      this,
      1180,
      36,
      'colorblind',
      () => updateOptions(this, { colorblind: !currentOptions(this).colorblind }),
      { diameter: 48, active: currentOptions(this).colorblind },
    );
    iconButton(
      this,
      1240,
      36,
      'options',
      () => {
        this.scene.pause();
        this.scene.launch(SCENES.options, { from: SCENES.map });
      },
      { diameter: 48 },
    );
    const onOptions = () => {
      setIconButtonActive(cb, currentOptions(this).colorblind);
      // L'aperçu de la carte de niveau suit les couleurs daltoniennes.
      const shown = this.card?.getData('level') as LevelData | undefined;
      if (shown) this.openCard(shown);
    };
    this.game.events.on(OPTIONS_CHANGED, onOptions);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.game.events.off(OPTIONS_CHANGED, onOptions),
    );

    // Échap : ferme la carte de niveau, sinon recule d'une vue.
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.scene.isPaused()) return;
      if (this.card) this.closeCard();
      else back();
    });
  }

  private goBack(): void {
    if (this.leaving) return;
    if (this.view === 'chapter') this.toSky(this.chapterN);
    else fadeTo(this, SCENES.title);
  }

  // --- Vue chapitre ------------------------------------------------------------

  private buildChapter(c: ChapterDef, unlock?: number): void {
    if (this.textures.exists(c.bg.key)) this.add.image(0, 0, c.bg.key).setOrigin(0);
    const save = this.save();
    const catalog = this.catalog();
    const order = catalog.levels.map((l) => l.id);
    const byId = new Map(catalog.levels.map((l) => [l.id, l]));
    const stateOf = (id: string): NodeState => {
      const level = byId.get(id);
      if (save.levels[id]?.completed) return 'done';
      return level && isUnlocked(order, id, save) ? 'open' : 'locked';
    };
    const make = (id: string, p: Point): MapNode => ({
      id,
      level: byId.get(id),
      ...p,
      state: stateOf(id),
      stars: save.levels[id]?.stars ?? 0,
    });

    const prologue =
      c.n === 1
        ? chapterLevelIds(0).map((id, i) => make(id, PROLOGUE_NODES[i] ?? { x: 0, y: 0 }))
        : [];
    const own = chapterLevelIds(c.n)
      .slice(0, c.nodes.length)
      .map((id, i) => make(id, c.nodes[i] ?? { x: 0, y: 0 }));
    this.nodes = [...prologue, ...own];

    const g = this.add.graphics();
    const link = (a: MapNode, b: MapNode) => {
      if (a.state === 'done' && b.state === 'done') {
        g.lineStyle(6, PALETTE.lit, 0.18).lineBetween(a.x, a.y, b.x, b.y);
        g.lineStyle(2, PALETTE.lit, 0.85).lineBetween(a.x, a.y, b.x, b.y);
      } else dotted(g, a.x, a.y, b.x, b.y, PALETTE.starDim, 0.45);
    };
    for (let i = 1; i < prologue.length; i++) link(prologue[i - 1]!, prologue[i]!);
    for (const [i, j] of c.edges) if (own[i] && own[j]) link(own[i], own[j]);
    for (const node of this.nodes) this.drawNode(node, c.accent);

    this.add.text(84, 36, `Chapitre ${c.n} · ${c.name}`, textStyle(22)).setOrigin(0, 0.5);
    this.buildChapterNav(c.n);

    // Clic dans le vide (hors étoile, hors carte) = fermer la carte de niveau.
    this.input.on(
      'pointerup',
      (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        if (over.length === 0) this.closeCard();
      },
    );

    const current =
      this.nodes.find((n) => n.state === 'open' && n.level) ??
      [...this.nodes].reverse().find((n) => n.state === 'done' && n.level);
    // La Gardienne sur l'étoile courante, l'Astre du chapitre avec elle s'il est réveillé.
    const start = current ?? own[0] ?? this.nodes[0];
    if (start) {
      const awake =
        c.n > 1 || this.nodes.some((n) => n.id.startsWith('ch1-') && n.state !== 'locked');
      const def = awake ? astreDef(c.astre) : null;
      this.companion = new MapCompanion(this, def, start, this.nodes);
    }
    // Thème du phare : une voix de plus par Astre réveillé (chapitre terminé).
    const progress = this.save();
    audio.music.start('phare', {
      astres: awakeAstres((n) => chapterState(progress, n) === 'done'),
    });
    if (unlock) this.playChapterLightUp(c, unlock);
    else if (current?.level) this.openCard(current.level);
    else if (!own.some((n) => n.level)) {
      // Chapitre ouvert dont les niveaux ne sont pas encore livrés.
      panel(this, CARD.x + CARD.w / 2, CARD.y + CARD.h / 2, CARD.w, 120, 16);
      this.add
        .text(
          CARD.x + CARD.w / 2,
          CARD.y + CARD.h / 2,
          'Bientôt : niveaux en préparation',
          bodyStyle(15, TEXT.main),
        )
        .setOrigin(0.5);
    }
  }

  /** Chapitres voisins : cercles Ø 56 à gauche et à droite, et flèches du clavier. */
  private buildChapterNav(n: number): void {
    const save = this.save();
    const go = (to: number) => {
      if (to < 1 || to > CHAPTER_COUNT || chapterState(save, to) === 'locked') return;
      if (this.leaving) return;
      fadeTo(this, SCENES.map, { view: 'chapter', chapter: to } satisfies MapSceneData);
    };
    const prevOpen = n > 1 && chapterState(save, n - 1) !== 'locked';
    const nextOpen = n < CHAPTER_COUNT && chapterState(save, n + 1) !== 'locked';
    if (prevOpen) iconButton(this, 40, 360, 'back', () => go(n - 1), { diameter: 56 });
    if (nextOpen) {
      const next = iconButton(this, 1240, 360, 'back', () => go(n + 1), { diameter: 56 });
      next.setScale(-1, 1); // chevron vers la droite
    }
    this.input.keyboard?.on('keydown-LEFT', () => !this.scene.isPaused() && go(n - 1));
    this.input.keyboard?.on('keydown-RIGHT', () => !this.scene.isPaused() && go(n + 1));
  }

  private drawNode(node: MapNode, accent: number): void {
    const { x, y, state } = node;
    if (state === 'locked') {
      this.add.circle(x, y, 5, PALETTE.starDim, 0.4);
      return;
    }
    const g = this.add.graphics({ x, y });
    if (state === 'done') {
      g.fillStyle(accent, 0.22).fillCircle(0, 0, 20);
      g.fillStyle(PALETTE.lit, 1).fillPoints(starPoints(0, 0, 13, 5.5), true);
      for (let i = 0; i < node.stars; i++) {
        g.fillStyle(PALETTE.accent, 1).fillPoints(
          starPoints((i - (node.stars - 1) / 2) * 11, 22, 4.5, 2),
          true,
        );
      }
    } else {
      // Disponible : étoile qui pulse à 1 Hz.
      g.fillStyle(PALETTE.lit, 0.25).fillCircle(0, 0, 22);
      g.fillStyle(PALETTE.lit, 1).fillPoints(starPoints(0, 0, 14, 6), true);
      if (!currentOptions(this).reducedMotion) {
        this.tweens.add({
          targets: g,
          scale: 1.18,
          duration: 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut',
        });
      }
    }
    const level = node.level;
    if (!level) return;
    // Cible tactile de 48 px.
    const hit = this.add.zone(x, y, 48, 48).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => {
      g.setAlpha(0.8);
      this.companion?.onHover(state);
    });
    hit.on('pointerout', () => g.setAlpha(1));
    hit.on('pointerup', () => this.openCard(level));
  }

  // --- Vue ciel ---------------------------------------------------------------

  private buildSky(from?: number, unlock?: number): void {
    const save = this.save();
    const reduced = currentOptions(this).reducedMotion;
    // Perf (jalon 3) : fond et Observatoire fusionnés en une texture (un seul plein écran) ;
    // la Veilleuse, entre les deux, passe donc devant l'Observatoire (elle ne le chevauche pas).
    const bg = bakeLayers(this, 'carte-ciel-fixe', [SKY.bg.key, SKY.observatory.key]);
    if (bg) this.add.image(0, 0, bg).setOrigin(0);
    this.drawVeilleuse(chaptersDone(save), reduced);

    // Prologue en arc autour de l'Observatoire (clic = vue du chapitre 1).
    const pro = chapterLevelIds(0);
    PROLOGUE_NODES.forEach((p, i) => {
      const done = save.levels[pro[i] ?? '']?.completed;
      const g = this.add.graphics({ x: p.x, y: p.y });
      g.fillStyle(PALETTE.lit, done ? 1 : 0.5).fillPoints(starPoints(0, 0, 9, 4), true);
    });
    this.add
      .zone(330, 420, 360, 200)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.toChapter(1));

    // Chemin entre les miniatures, dans l'ordre de l'aventure.
    const states = CHAPTERS.map((c) => chapterState(save, c.n));
    // Pendant le déblocage, le nouveau chapitre se dessine : on part de son état d'avant.
    if (unlock) states[unlock - 1] = 'locked';
    const path = this.add.graphics();
    // progress : segment en train de se tracer (déblocage), toujours lumineux.
    const pathTo = (i: number, progress?: number) => {
      const a = SKY.minis[i - 1]!;
      const b = SKY.minis[i]!;
      const lit = progress !== undefined || (states[i - 1] === 'done' && states[i] === 'done');
      const k = progress ?? 1;
      const end = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      if (lit) path.lineStyle(3, PALETTE.lit, 0.7).lineBetween(a.x, a.y, end.x, end.y);
      else dotted(path, a.x, a.y, b.x, b.y, PALETTE.accent, 0.45);
    };
    for (let i = 1; i < CHAPTERS.length; i++) if (!(unlock && i === unlock - 1)) pathTo(i);

    const minis = CHAPTERS.map((c, i) => this.drawMini(c, states[i] ?? 'locked', save));

    // Total des étoiles, à gauche des boutons du haut.
    const total = this.add.container(1100, 36);
    const star = this.add.graphics();
    star.fillStyle(PALETTE.accent, 1).fillPoints(starPoints(-52, 0, 11, 4.6), true);
    total.add([
      star,
      this.add.text(-36, 0, `${totalStars(save)}/${MAX_STARS}`, textStyle(20)).setOrigin(0, 0.5),
    ]);

    if (from) this.zoomOutFrom(from);
    if (unlock) this.playSkyUnlock(unlock, minis, (p) => pathTo(unlock - 1, p));
  }

  /** La Grande Veilleuse endormie : lueur qui grossit avec les chapitres terminés, respiration. */
  private drawVeilleuse(done: number, reduced: boolean): void {
    const v = SKY.veilleuse;
    const k = done / CHAPTER_COUNT;
    const r = v.r[0] + (v.r[1] - v.r[0]) * k;
    const a = v.alpha[0] + (v.alpha[1] - v.alpha[0]) * k;
    // Dégradé radial en texture (un seul quad) : les 40 cercles superposés d'avant
    // coûtaient 40 remplissages par image en rendu logiciel.
    const glow = this.add
      .image(v.x, v.y, veilleuseGlowTexture(this))
      .setDisplaySize(r * 2, r * 2)
      .setAlpha(1 - Math.pow(1 - (a * 1.4) / 40, 40));
    const body = this.add.graphics({ x: v.x, y: v.y });
    body.fillStyle(0xffe9c2, 0.95).fillPoints(starPoints8(0, 0, 30, 18), true);
    // Yeux fermés.
    body.lineStyle(2.5, 0x1b2350, 0.8);
    body.beginPath();
    body.arc(-9, -2, 5, 0.2, Math.PI - 0.2);
    body.strokePath();
    body.beginPath();
    body.arc(9, -2, 5, 0.2, Math.PI - 0.2);
    body.strokePath();
    if (reduced) return;
    this.tweens.add({
      targets: glow,
      scale: glow.scale * 1.08,
      alpha: glow.alpha * 0.8,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    this.tweens.add({
      targets: body,
      scale: 1.04,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  /** Miniature d'une constellation (états verrouillée / ouverte / terminée). */
  private drawMini(
    c: ChapterDef,
    state: ChapterState,
    save: SaveData,
  ): Phaser.GameObjects.Container {
    const { points, box } = miniPoints(c);
    const center = SKY.minis[c.n - 1]!;
    const root = this.add.container(0, 0);
    const g = this.add.graphics();
    root.add(g);
    const ids = chapterLevelIds(c.n);
    if (state === 'locked') {
      for (const [i, j] of c.edges) {
        const a = points[i];
        const b = points[j];
        if (a && b) dotted(g, a.x, a.y, b.x, b.y, PALETTE.starDim, 0.3);
      }
      g.fillStyle(PALETTE.starDim, 0.4);
      for (const p of points) g.fillCircle(p.x, p.y, 3);
    } else {
      const halo = this.add.graphics({ x: center.x, y: center.y });
      halo.fillStyle(state === 'done' ? c.accent : PALETTE.accent, state === 'done' ? 0.25 : 0.12);
      halo.fillEllipse(0, 0, box.w + 70, box.h + 60);
      root.addAt(halo, 0);
      if (state === 'open' && !currentOptions(this).reducedMotion)
        this.tweens.add({
          targets: halo,
          alpha: 0.4,
          duration: 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut',
        });
      g.lineStyle(
        2,
        state === 'done' ? PALETTE.lit : PALETTE.accent,
        state === 'done' ? 0.8 : 0.45,
      );
      for (const [i, j] of c.edges) {
        const a = points[i];
        const b = points[j];
        if (a && b) g.lineBetween(a.x, a.y, b.x, b.y);
      }
      points.forEach((p, i) => {
        const won = state === 'done' || save.levels[ids[i] ?? '']?.completed;
        if (won) g.fillStyle(PALETTE.lit, 1).fillPoints(starPoints(p.x, p.y, 6, 2.6), true);
        else g.fillStyle(PALETTE.starDim, 0.7).fillCircle(p.x, p.y, 3);
      });
      // Compteur sous la figure : étoile + « 17/36 ».
      const y = center.y + box.h / 2 + 26;
      const counter = this.add
        .text(
          center.x + 6,
          y,
          `${chapterStars(save, c.n)}/${LEVELS_PER_CHAPTER * 3}`,
          bodyStyle(13, TEXT.dim),
        )
        .setOrigin(0, 0.5);
      g.fillStyle(PALETTE.accent, 1).fillPoints(starPoints(center.x - 6, y, 6, 2.6), true);
      root.add(counter);
      // L'Astre du chapitre à côté (attente), endormi si le chapitre est fini.
      const def = astreDef(c.astre);
      if (def) {
        const view = new CompanionView(this, def, { x: 0, y: 0 });
        view.setDisplay(center.x + box.w / 2 + 26, center.y + box.h / 2, 0.4);
        if (state === 'done') view.setSleeping(true);
        this.astres.push(view);
      }
    }
    // Cible : toute la figure.
    const hit = this.add
      .zone(center.x, center.y, Math.max(120, box.w + 40), Math.max(90, box.h + 40))
      .setInteractive({ useHandCursor: state !== 'locked' });
    if (state === 'locked') {
      hit.on('pointerover', () => this.lockedShake(root, center));
    } else hit.on('pointerup', () => this.toChapter(c.n));
    root.setData('hit', hit);
    return root;
  }

  /** Survol d'un chapitre verrouillé : petite secousse et cadenas (« pas encore »). */
  private lockedShake(root: Phaser.GameObjects.Container, at: Point): void {
    if (root.getData('shaking')) return;
    root.setData('shaking', true);
    const lock = this.add.graphics({ x: at.x, y: at.y });
    lock.fillStyle(PALETTE.starDim, 0.9).fillRoundedRect(-9, -4, 18, 14, 3);
    lock.lineStyle(3, PALETTE.starDim, 0.9);
    lock.beginPath();
    lock.arc(0, -4, 6, Math.PI, 0);
    lock.strokePath();
    this.tweens.add({
      targets: root,
      x: { from: -4, to: 4 },
      duration: 60,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        root.setX(0);
        this.time.delayedCall(500, () => {
          lock.destroy();
          root.setData('shaking', false);
        });
      },
    });
  }

  // --- Transitions ------------------------------------------------------------

  /** Vue ciel -> vue chapitre : zoom vers la miniature, puis la vue chapitre. */
  private toChapter(n: number): void {
    if (this.leaving) return;
    this.leaving = true;
    const at = SKY.minis[n - 1]!;
    const cam = this.cameras.main;
    const go = (): void => {
      this.scene.restart({ view: 'chapter', chapter: n } satisfies MapSceneData);
    };
    if (currentOptions(this).reducedMotion) {
      go();
      return;
    }
    // force : un dézoom d'arrivée encore en cours (clic pendant le déblocage) ne doit pas
    // avaler ce zoom, sinon son rappel ne vient jamais et la carte reste figée (QA, P1).
    cam.pan(at.x, at.y, ZOOM.ms, 'Sine.easeInOut', true);
    cam.zoomTo(ZOOM.factor, ZOOM.ms, 'Sine.easeInOut', true, (_c, p) => {
      if (p === 1) go();
    });
  }

  /** Vue chapitre -> vue ciel. */
  private toSky(from: number): void {
    if (this.leaving) return;
    this.leaving = true;
    fadeTo(this, SCENES.map, { view: 'sky', from } satisfies MapSceneData);
  }

  /** Arrivée dans la vue ciel : dézoom depuis la miniature du chapitre quitté. */
  private zoomOutFrom(n: number): void {
    if (currentOptions(this).reducedMotion) return;
    const at = SKY.minis[n - 1];
    if (!at) return;
    const cam = this.cameras.main;
    cam.setZoom(ZOOM.factor).centerOn(at.x, at.y);
    cam.pan(640, 360, ZOOM.ms, 'Sine.easeInOut');
    cam.zoomTo(1, ZOOM.ms, 'Sine.easeInOut');
  }

  // --- Séquence de déblocage (specs jalon 2, 1.3) ------------------------------

  /** Étape 1, vue du chapitre terminé : toute la constellation s'allume, étincelles. */
  private playChapterLightUp(c: ChapterDef, unlock: number): void {
    const sparks = this.add.graphics().setDepth(30);
    const pts = c.nodes;
    const reduced = currentOptions(this).reducedMotion;
    const glow = this.add.graphics().setDepth(29);
    glow.lineStyle(3, PALETTE.lit, 0.9);
    for (const [i, j] of c.edges) {
      const a = pts[i];
      const b = pts[j];
      if (a && b) glow.lineBetween(a.x, a.y, b.x, b.y);
    }
    glow.setAlpha(0);
    this.tweens.add({ targets: glow, alpha: 1, duration: 500 });
    if (!reduced) {
      const drops = Array.from({ length: 40 }, () => ({
        x: Phaser.Math.Between(760, 1160),
        y: Phaser.Math.Between(-40, 200),
        v: Phaser.Math.FloatBetween(80, 180),
      }));
      this.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, dt: number) => {
        sparks.clear();
        for (const d of drops) {
          d.y += (d.v * dt) / 1000;
          sparks.fillStyle(PALETTE.lit, 0.8).fillPoints(starPoints(d.x, d.y, 4, 1.6), true);
        }
      });
    }
    const next = () => {
      if (this.leaving) return;
      this.leaving = true;
      this.scene.restart({ view: 'sky', from: c.n, unlock } satisfies MapSceneData);
    };
    this.time.delayedCall(UNLOCK.lightUp, next);
    this.skipCatcher(() => this.finishUnlock(unlock));
  }

  /** Étape 2, vue ciel : le chemin se trace, la miniature se dessine, l'Astre arrive. */
  private playSkyUnlock(
    unlock: number,
    minis: Phaser.GameObjects.Container[],
    drawPath: (progress: number) => void,
  ): void {
    // Le drapeau est posé tout de suite : la séquence ne se rejoue jamais.
    const save = this.save();
    save.seen[announceKey(unlock)] = true;
    writeSave(save);

    const fresh = minis[unlock - 1];
    const c = chapterDef(unlock);
    fresh?.setAlpha(0);
    const t0 = ZOOM.ms + 300;
    const p = { v: 0 };
    this.tweens.add({
      targets: p,
      v: 1,
      delay: t0,
      duration: UNLOCK.path,
      onUpdate: () => drawPath(p.v),
    });
    this.time.delayedCall(t0 + UNLOCK.path, () => {
      if (!fresh) return;
      (fresh.getData('hit') as Phaser.GameObjects.Zone | undefined)?.destroy();
      fresh.destroy();
      const open = this.drawMini(c, 'open', save);
      open.setAlpha(0);
      this.tweens.add({ targets: open, alpha: 1, duration: UNLOCK.draw });
      this.dropAstre(c);
    });
    this.time.delayedCall(t0 + UNLOCK.path + UNLOCK.draw + UNLOCK.astre, () =>
      this.finishUnlock(unlock),
    );
    this.skipCatcher(() => this.finishUnlock(unlock));
  }

  /**
   * Pendant la séquence, un clic n'importe où la passe : un capteur plein écran au-dessus de
   * tout empêche le clic d'ouvrir aussi un niveau ou un autre chapitre.
   */
  private skipCatcher(skip: () => void): void {
    const z = this.add.zone(640, 360, 1280, 720).setScrollFactor(0).setDepth(1000);
    z.setInteractive();
    z.once('pointerup', skip);
  }

  /** Le nouvel Astre tombe du ciel près de sa miniature, avec un « ! ». */
  private dropAstre(c: ChapterDef): void {
    const at = SKY.minis[c.n - 1]!;
    const bang = this.add
      .text(at.x, at.y - 90, '!', textStyle(40, '#FFF6E0'))
      .setOrigin(0.5)
      .setScale(0);
    this.tweens.add({ targets: bang, scale: 1, duration: 300, ease: 'Back.Out', delay: 300 });
    const def = astreDef(c.astre);
    if (!def) return;
    const view = new CompanionView(this, def, { x: 0, y: 0 });
    const pos = { y: at.y - 260 };
    this.astres.push(view);
    this.tweens.add({
      targets: pos,
      y: at.y + 40,
      duration: 600,
      ease: 'Bounce.Out',
      onUpdate: () => view.setDisplay(at.x + 90, pos.y, 0.4),
      onComplete: () => view.brain.onEvent('victoire'),
    });
  }

  /** Fin (ou saut) de la séquence : drapeau posé, zoom sur le nouveau chapitre. */
  private finishUnlock(unlock: number): void {
    const save = this.save();
    if (!save.seen[announceKey(unlock)]) {
      save.seen[announceKey(unlock)] = true;
      writeSave(save);
    }
    if (this.leaving) return;
    if (this.view === 'sky') this.toChapter(unlock);
    else {
      this.leaving = true;
      this.scene.restart({ view: 'chapter', chapter: unlock } satisfies MapSceneData);
    }
  }

  // --- Carte de niveau ----------------------------------------------------------

  private openCard(level: LevelData): void {
    this.card?.destroy();
    const node = this.nodes.find((n) => n.id === level.id);
    if (node) this.companion?.followTo(node.x, node.y);
    const save = this.save();
    const rec = save.levels[level.id];
    const c = this.add.container(CARD.x, CARD.y).setData('level', level);
    c.add(panel(this, CARD.w / 2, CARD.h / 2, CARD.w, CARD.h, 16));

    const name = level.title ? `${levelLabel(level.id)} · ${level.title}` : levelLabel(level.id);
    const choice = this.choiceFor(level);
    const title = this.add.text(choice.selected ? 16 : CARD.w / 2, 24, name, textStyle(20));
    title.setOrigin(choice.selected ? 0 : 0.5, 0.5);
    // Avec la pastille de l'Astre à droite, le titre se resserre pour ne pas la toucher.
    if (choice.selected && title.width > 200) title.setScale(200 / title.width);
    c.add(title);
    // La touche C ne doit jamais rouvrir le sélecteur d'une fiche précédente (QA, P2).
    this.input.keyboard?.off('keydown-C');
    if (choice.selected) c.add(this.companionBadge(level, choice));

    // Aperçu : positions des cristaux en points.
    const px = 16;
    const py = 46;
    const preview = this.add.graphics();
    preview.fillStyle(PALETTE.night, 0.6).fillRoundedRect(px, py, PREVIEW.w, PREVIEW.h, 8);
    const colors = currentOptions(this).colorblind ? CRYSTAL_COLORS_CB : CRYSTAL_COLORS;
    const sx = PREVIEW.w / PLAYFIELD.w;
    const sy = PREVIEW.h / PLAYFIELD.h;
    for (const peg of level.pegs) {
      const color = peg.kind ? colors[peg.kind] : PALETTE.starDim;
      preview.fillStyle(color, 1);
      preview.fillCircle(px + peg.x * sx, py + peg.y * sy, 1.6);
    }
    c.add(preview);

    // Étoiles et meilleur score.
    const right = px + PREVIEW.w + (CARD.w - px - PREVIEW.w) / 2;
    const got = rec?.stars ?? 0;
    // La pastille occupe le coin haut droit : étoiles et score descendent d'un cran.
    const dy = choice.selected ? 14 : 0;
    for (let i = 0; i < 3; i++) {
      c.add(
        this.add
          .text(right + (i - 1) * 34, 70 + dy, '★', textStyle(30, i < got ? '#B9A6FF' : '#2E3870'))
          .setOrigin(0.5),
      );
    }
    const best = rec?.bestScore ? rec.bestScore.toLocaleString('fr-FR') : '—';
    c.add(
      this.add
        .text(right, 112 + dy, best, textStyle(22, rec?.bestScore ? TEXT.main : TEXT.dim))
        .setOrigin(0.5),
    );

    const play = () =>
      fadeTo(this, SCENES.game, {
        level,
        ...(choice.selected ? { companion: choice.selected } : {}),
      });
    c.add(
      primaryButton(this, CARD.w / 2, CARD.h - 46, 'Jouer', play, { icon: 'play', width: 200 }),
    );
    this.card = c;

    this.input.keyboard?.off('keydown-SPACE');
    this.input.keyboard?.off('keydown-ENTER');
    this.input.keyboard?.once('keydown-SPACE', play);
    this.input.keyboard?.once('keydown-ENTER', play);
  }

  /** Chapitre le plus avancé atteint (pour les Astres réveillés). */
  private reachedChapter(): number {
    const save = this.save();
    let n = 1;
    for (let c = 1; c <= CHAPTER_COUNT; c++) if (chapterState(save, c) !== 'locked') n = c;
    return n;
  }

  private choiceFor(level: LevelData): CompanionChoice {
    return companionChoice(level, COMPANION_ROSTER, this.reachedChapter(), this.save().companion);
  }

  /**
   * Pastille compagnon (specs jalon 2, 2.1) : portrait de l'Astre préselectionné + picto de
   * son pouvoir ; cadenas si l'Astre est imposé ; cliquable (et touche C) s'il y a un choix.
   */
  private companionBadge(level: LevelData, choice: CompanionChoice): Phaser.GameObjects.Container {
    const info = companionById(choice.selected);
    const color = info?.color ?? PALETTE.accent;
    const b = this.add.container(CARD.w - 50, 40);
    const g = this.add.graphics();
    g.fillStyle(color, 0.25).fillCircle(0, 0, 28);
    g.lineStyle(2, color, 0.6).strokeCircle(0, 0, 28);
    drawPortrait(g, 0, -2, 15, color);
    drawPowerHex(g, 18, 18, 22);
    drawPowerIcon(g, choice.selected ?? '', 18, 18, 13);
    if (choice.locked) {
      g.fillStyle(PALETTE.accent, 1).fillRoundedRect(-26, 12, 14, 11, 3);
      g.lineStyle(2.5, PALETTE.accent, 1);
      g.beginPath();
      g.arc(-19, 12, 4.5, Math.PI, 0);
      g.strokePath();
    }
    b.add(g);
    if (!choice.canChoose) return b;
    const open = () => {
      if (this.scene.isPaused()) return;
      const advised = level.companion;
      const data: CompanionSelectData = {
        level,
        choices: choice.choices,
        selected: choice.selected ?? choice.choices[0] ?? 'pip',
        advised,
        reachedChapter: this.reachedChapter(),
      };
      this.scene.pause();
      this.scene.launch(SCENES.companionSelect, data);
    };
    b.setSize(56, 56).setInteractive({ useHandCursor: true });
    b.on('pointerup', open);
    b.on('pointerover', () => b.setScale(1.06));
    b.on('pointerout', () => b.setScale(1));
    this.input.keyboard?.off('keydown-C');
    this.input.keyboard?.on('keydown-C', open);
    return b;
  }

  private closeCard(): void {
    if (!this.card) return;
    this.card.destroy();
    this.card = undefined;
    this.input.keyboard?.off('keydown-SPACE');
    this.input.keyboard?.off('keydown-ENTER');
  }
}

/** Étoile à 5 branches centrée en (x, y). */
function starPoints(x: number, y: number, outer: number, inner: number): Phaser.Math.Vector2[] {
  return Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? outer : inner;
    return new Phaser.Math.Vector2(x + Math.cos(a) * r, y + Math.sin(a) * r);
  });
}

/** Étoile douce à 8 branches (la Grande Veilleuse). */
function starPoints8(x: number, y: number, outer: number, inner: number): Phaser.Math.Vector2[] {
  return Array.from({ length: 16 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 8;
    const r = i % 2 === 0 ? outer : inner;
    return new Phaser.Math.Vector2(x + Math.cos(a) * r, y + Math.sin(a) * r);
  });
}

function dotted(
  g: Phaser.GameObjects.Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: number,
  alpha: number,
): void {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(1, Math.floor(len / 10));
  g.fillStyle(color, alpha);
  for (let i = 1; i < n; i++) g.fillCircle(x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n, 1.5);
}

/** Texture de lueur de la Veilleuse : opacité 1 au centre, pente linéaire jusqu'au bord. */
function veilleuseGlowTexture(scene: Phaser.Scene): string {
  const key = 'carte-veilleuse-lueur';
  if (scene.textures.exists(key)) return key;
  const size = 256;
  const tex = scene.textures.createCanvas(key, size, size);
  const ctx = tex?.getContext();
  if (!tex || !ctx) return key;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  // Profil de l'ancien empilement de couches très légères : presque linéaire (pic par setAlpha).
  for (let i = 0; i <= 10; i++) grad.addColorStop(i / 10, `rgba(255,233,194,${1 - i / 10})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
  return key;
}

/** Fusionne des textures plein écran (déjà chargées) en une seule, une fois par session. */
function bakeLayers(scene: Phaser.Scene, key: string, sources: string[]): string | null {
  if (scene.textures.exists(key)) return key;
  const present = sources.filter((s) => scene.textures.exists(s));
  if (present.length === 0) return null;
  const tex = scene.textures.createCanvas(key, GAME_WIDTH, GAME_HEIGHT);
  const ctx = tex?.getContext();
  if (!tex || !ctx) return present[0] ?? null;
  for (const s of present)
    ctx.drawImage(
      scene.textures.get(s).getSourceImage() as CanvasImageSource,
      0,
      0,
      GAME_WIDTH,
      GAME_HEIGHT,
    );
  tex.refresh();
  return key;
}
