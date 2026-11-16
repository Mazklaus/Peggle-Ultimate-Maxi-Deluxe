import Phaser from 'phaser';
import { PLAYFIELD } from '../config';
import { levelLabel, type LevelCatalog } from '../core/levelCatalog';
import type { LevelData } from '../core/levelFormat';
import { isUnlocked, type SaveData } from '../core/save';
import { PIP } from '../companions/pip';
import NODES from './carte-noeuds.json';
import { OPTIONS_CHANGED, REGISTRY, SCENES } from './keys';
import { MapCompanion } from './MapCompanion';
import { currentOptions, updateOptions } from './OptionsScene';
import { CRYSTAL_COLORS, CRYSTAL_COLORS_CB, PALETTE, textStyle, TEXT } from './theme';
import { fadeIn, fadeTo, panel, setEditorLinkVisible } from './ui';
import { iconButton, primaryButton, setIconButtonActive } from './widgets';

const BG_KEY = 'carte-fond';
/** Carte de niveau : zone laissée libre par le décor (specs UI/UX 3), coin haut-gauche. */
const CARD = { x: 900, y: 450, w: 300, h: 230 };
/** Mini-silhouette du niveau dans la carte. */
const PREVIEW = { w: 120, h: 90 };

type NodeState = 'locked' | 'open' | 'done';

interface MapNode {
  level: LevelData;
  x: number;
  y: number;
  state: NodeState;
  stars: number;
}

/** Position d'un niveau sur la carte de la DA (carte-noeuds.json, 1280 × 720). */
function nodePosition(level: LevelData): { x: number; y: number } | undefined {
  const list = level.chapter === 0 ? NODES.prologue : level.chapter === 1 ? NODES.chapitre1 : [];
  return list[level.index - 1];
}

/**
 * Carte (specs UI/UX 3) : ciel de la DA, l'Observatoire en bas à gauche, les 4 étoiles du
 * prologue en arc puis la constellation de Pip (12 étoiles). Clic sur une étoile ouverte =
 * carte de niveau (aperçu, étoiles, meilleur score, JOUER). La carte du niveau courant est
 * ouverte d'office : Espace lance la partie.
 */
export class MapScene extends Phaser.Scene {
  private card?: Phaser.GameObjects.Container;
  private nodes: MapNode[] = [];
  private companion?: MapCompanion;

  constructor() {
    super(SCENES.map);
  }

  preload(): void {
    if (!this.textures.exists(BG_KEY))
      this.load.svg(BG_KEY, 'da/decors/carte-fond.svg', { width: 1280, height: 720 });
  }

  create(): void {
    fadeIn(this);
    this.card = undefined;
    this.cameras.main.setBackgroundColor(PALETTE.night);
    if (this.textures.exists(BG_KEY)) this.add.image(0, 0, BG_KEY).setOrigin(0);

    const catalog = this.registry.get(REGISTRY.catalog) as LevelCatalog;
    const save = this.registry.get(REGISTRY.save) as SaveData;
    const order = catalog.levels.map((l) => l.id);
    this.nodes = [];
    for (const level of catalog.levels) {
      const pos = nodePosition(level);
      if (!pos) continue;
      const rec = save.levels[level.id];
      const state: NodeState = rec?.completed
        ? 'done'
        : isUnlocked(order, level.id, save)
          ? 'open'
          : 'locked';
      this.nodes.push({ level, ...pos, state, stars: rec?.stars ?? 0 });
    }

    this.drawLinks();
    for (const node of this.nodes) this.drawNode(node);

    // Barre du haut : retour au titre, daltonien, options.
    iconButton(this, 40, 36, 'back', () => fadeTo(this, SCENES.title), { diameter: 48 });
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

    setEditorLinkVisible(true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      setEditorLinkVisible(false);
      this.game.events.off(OPTIONS_CHANGED, onOptions);
    });

    // Fermer la carte de niveau : Échap ; sans carte, Échap revient au titre.
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.scene.isPaused()) return;
      if (this.card) this.closeCard();
      else fadeTo(this, SCENES.title);
    });
    // Clic dans le vide (hors étoile, hors carte) = fermer la carte.
    this.input.on(
      'pointerup',
      (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        if (over.length === 0) this.closeCard();
      },
    );

    const current =
      this.nodes.find((n) => n.state === 'open') ??
      [...this.nodes].reverse().find((n) => n.state === 'done');
    // La Gardienne sur l'étoile courante, Pip avec elle dès qu'il est réveillé (chapitre 1).
    this.companion = undefined;
    if (current) {
      const pipAwake = this.nodes.some((n) => n.level.chapter >= 1 && n.state !== 'locked');
      this.companion = new MapCompanion(this, pipAwake ? PIP : null, current);
      this.openCard(current.level);
    }
  }

  // --- Étoiles et traits ------------------------------------------------------

  /** Traits entre niveaux consécutifs : lumineux si les deux sont terminés, pointillé sinon. */
  private drawLinks(): void {
    const g = this.add.graphics();
    for (let i = 1; i < this.nodes.length; i++) {
      const a = this.nodes[i - 1];
      const b = this.nodes[i];
      if (!a || !b) continue;
      if (a.level.chapter !== b.level.chapter) continue; // la route vers le ch.1 est dans le décor
      if (a.state === 'done' && b.state === 'done') {
        g.lineStyle(6, PALETTE.lit, 0.18).lineBetween(a.x, a.y, b.x, b.y);
        g.lineStyle(2, PALETTE.lit, 0.85).lineBetween(a.x, a.y, b.x, b.y);
      } else {
        dotted(g, a.x, a.y, b.x, b.y, PALETTE.starDim, 0.45);
      }
    }
  }

  private drawNode(node: MapNode): void {
    const { x, y, state } = node;
    if (state === 'locked') {
      this.add.circle(x, y, 5, PALETTE.starDim, 0.4);
      return;
    }
    const g = this.add.graphics({ x, y });
    if (state === 'done') {
      g.fillStyle(PALETTE.lit, 0.18).fillCircle(0, 0, 20);
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
    // Cible tactile de 48 px.
    const hit = this.add.zone(x, y, 48, 48).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => {
      g.setAlpha(0.8);
      this.companion?.onHover(state);
    });
    hit.on('pointerout', () => g.setAlpha(1));
    hit.on('pointerup', () => this.openCard(node.level));
  }

  // --- Carte de niveau ----------------------------------------------------------

  private openCard(level: LevelData): void {
    this.card?.destroy();
    const node = this.nodes.find((n) => n.level.id === level.id);
    if (node) this.companion?.followTo(node.x, node.y);
    const save = this.registry.get(REGISTRY.save) as SaveData;
    const rec = save.levels[level.id];
    const c = this.add.container(CARD.x, CARD.y).setData('level', level);
    c.add(panel(this, CARD.w / 2, CARD.h / 2, CARD.w, CARD.h, 16));

    const name = level.title ? `${levelLabel(level.id)} · ${level.title}` : levelLabel(level.id);
    c.add(this.add.text(CARD.w / 2, 24, name, textStyle(20)).setOrigin(0.5));

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
    for (let i = 0; i < 3; i++) {
      c.add(
        this.add
          .text(right + (i - 1) * 34, 70, '★', textStyle(30, i < got ? '#B9A6FF' : '#2E3870'))
          .setOrigin(0.5),
      );
    }
    const best = rec?.bestScore ? rec.bestScore.toLocaleString('fr-FR') : '—';
    c.add(
      this.add
        .text(right, 112, best, textStyle(22, rec?.bestScore ? TEXT.main : TEXT.dim))
        .setOrigin(0.5),
    );

    const play = () => fadeTo(this, SCENES.game, { level });
    c.add(
      primaryButton(this, CARD.w / 2, CARD.h - 46, 'Jouer', play, { icon: 'play', width: 200 }),
    );
    this.card = c;

    this.input.keyboard?.off('keydown-SPACE');
    this.input.keyboard?.off('keydown-ENTER');
    this.input.keyboard?.once('keydown-SPACE', play);
    this.input.keyboard?.once('keydown-ENTER', play);
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
