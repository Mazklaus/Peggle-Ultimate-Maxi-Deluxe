/**
 * Fond du chapitre derrière la zone de jeu (specs-decors du DA) : couches SVG en parallaxe
 * selon la visée, nuages qui dérivent, scintillements, lueur de la Grande Veilleuse qui
 * « ronfle », constellation devinée qui s'allume à la victoire. Tout reste lent et discret :
 * les cristaux gardent le contraste maximal.
 */
import Phaser from 'phaser';
import {
  backdropLayers,
  hasShootingStars,
  veilleuseGlow,
  type BackdropLayer,
} from '../core/backdrop';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { chapter as chapterDef } from './mapData';
import { PALETTE } from './theme';

const DEPTH = -100;
const GLOW_KEY = 'jeu-veilleuse-glow';
/** Amplitude de visée (px) qui pilote la parallaxe : la moitié de la largeur de jeu. */
const AIM_SPAN = 440;
const TWINKLES = 14;
/** Bande visible de chaque couche mobile (calculée une fois par session). */
const bandCache = new Map<string, { top: number; bottom: number } | null>();
const CONSTELLATION = { guessed: 0.12, lit: 0.8, line: 0.35, stagger: 120 };

/** Charge les couches du chapitre (à appeler dans preload). */
export function preloadBackdrop(scene: Phaser.Scene, chapter: number): void {
  for (const l of backdropLayers(chapter)) {
    if (!scene.textures.exists(l.key)) {
      scene.load.svg(l.key, l.file, { width: GAME_WIDTH, height: GAME_HEIGHT });
    }
  }
}

interface MovingLayer {
  def: BackdropLayer;
  /** Deux copies côte à côte : le défilement boucle sans TileSprite (shader coûteux). */
  sprites: [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
  drift: number;
}

export class ChapterBackdrop {
  private readonly layers: MovingLayer[] = [];
  private readonly twinkles: Array<{ dot: Phaser.GameObjects.Arc; x: number }> = [];
  private readonly starsParallax: number;
  private shift = 0;
  private readonly constellation?: {
    nodes: Array<{ x: number; y: number }>;
    edges: Array<[number, number]>;
    lines: Phaser.GameObjects.Graphics;
  };

  constructor(
    private readonly scene: Phaser.Scene,
    readonly chapter: number,
  ) {
    const defs = backdropLayers(chapter).filter((d) => scene.textures.exists(d.key));
    // Perf (jalon 3) : en rendu logiciel, chaque couche plein écran coûte ~40 % d'images/s.
    // Les couches sans dérive (ciel, étoiles, motif) sont fusionnées une fois pour toutes en
    // une seule texture fixe : leur parallaxe (≤ 0,03, soit ≤ 13 px) ne se voyait pas.
    const still = defs.filter((d) => d.drift === 0);
    const moving = defs.filter((d) => d.drift !== 0);
    this.starsParallax = 0;
    if (still.length > 0) {
      scene.add.image(0, 0, this.bakeStill(still)).setOrigin(0, 0).setDepth(DEPTH);
      this.makeVeilleuse(DEPTH + 0.5);
      if (still.some((d) => d.key.endsWith('etoiles'))) this.makeTwinkles(DEPTH + 0.6);
    }
    moving.forEach((def, i) => {
      // Seule la bande non transparente de la couche est dessinée (nuages : quelques
      // dizaines de px de haut au lieu de 720).
      const band = this.opaqueBand(def.key);
      if (!band) return;
      const make = () =>
        scene.add
          .image(0, 0, def.key)
          .setOrigin(0, 0)
          .setCrop(0, band.top, GAME_WIDTH, band.bottom - band.top)
          .setDepth(DEPTH + 1 + i);
      // Images simples plutôt que TileSprite : en rendu logiciel, 5 TileSprite plein écran
      // faisaient tomber le jeu de 30 à 8 i/s (mesure Lead, jalon 3).
      this.layers.push({ def, sprites: [make(), make()], drift: 0 });
    });
    if (hasShootingStars(chapter)) this.scheduleShootingStar();
    if (chapter >= 1) {
      const c = chapterDef(chapter);
      const g = scene.add.graphics().setDepth(DEPTH + 20);
      const lines = scene.add.graphics().setDepth(DEPTH + 19);
      // Figure devinée : étoiles et traits très pâles.
      g.lineStyle(1, PALETTE.lit, CONSTELLATION.guessed * 0.6);
      for (const [a, b] of c.edges) {
        const p = c.nodes[a];
        const q = c.nodes[b];
        if (p && q) g.lineBetween(p.x, p.y, q.x, q.y);
      }
      g.fillStyle(PALETTE.lit, CONSTELLATION.guessed);
      for (const p of c.nodes) g.fillCircle(p.x, p.y, 3);
      this.constellation = { nodes: c.nodes, edges: c.edges, lines };
    }
  }

  /** À chaque image : parallaxe selon la visée (angle du canon), dérive des nuages. */
  update(dtSeconds: number, aimAngle: number): void {
    const aim = Math.cos(aimAngle) * AIM_SPAN;
    // Lissage : le fond suit la visée sans à-coups.
    this.shift += (aim - this.shift) * Math.min(1, dtSeconds * 4);
    for (const l of this.layers) {
      l.drift += l.def.drift * dtSeconds;
      // Équivalent de tilePositionX : décalage modulo la largeur, deux copies jointives.
      const pos = this.shift * l.def.parallax - l.drift;
      const o = ((pos % GAME_WIDTH) + GAME_WIDTH) % GAME_WIDTH;
      const [a, b] = l.sprites;
      a.x = -o;
      b.x = GAME_WIDTH - o;
      b.setVisible(o > 0.5);
    }
    const dx = -this.shift * this.starsParallax;
    for (const t of this.twinkles) t.dot.x = t.x + dx;
  }

  /**
   * Victoire : les étoiles gagnées s'allument une à une (Back.out, 120 ms d'écart), traits à
   * 0.35 entre étoiles allumées ; figure complète -> pluie d'étincelles.
   */
  lightUp(indices: number[], complete: boolean): void {
    const c = this.constellation;
    if (!c) return;
    const lit = new Set<number>();
    indices.forEach((i, rank) => {
      const p = c.nodes[i];
      if (!p) return;
      this.scene.time.delayedCall(rank * CONSTELLATION.stagger, () => {
        lit.add(i);
        const star = this.scene.add
          .star(p.x, p.y, 4, 2, 5, PALETTE.lit, CONSTELLATION.lit)
          .setDepth(DEPTH + 21)
          .setScale(0);
        this.scene.tweens.add({ targets: star, scale: 1, duration: 320, ease: 'Back.Out' });
        c.lines.clear().lineStyle(1.5, PALETTE.lit, CONSTELLATION.line);
        for (const [a, b] of c.edges) {
          const q = c.nodes[a];
          const r = c.nodes[b];
          if (q && r && lit.has(a) && lit.has(b)) c.lines.lineBetween(q.x, q.y, r.x, r.y);
        }
      });
    });
    if (complete) {
      this.scene.time.delayedCall(indices.length * CONSTELLATION.stagger + 200, () =>
        this.sparkles(c.nodes),
      );
    }
  }

  /** Fusionne les couches fixes dans une texture canvas (une seule fois par chapitre). */
  private bakeStill(defs: BackdropLayer[]): string {
    const key = `${defs[0]?.key ?? 'jeu'}-fixe`;
    if (this.scene.textures.exists(key)) return key;
    const tex = this.scene.textures.createCanvas(key, GAME_WIDTH, GAME_HEIGHT);
    const ctx = tex?.getContext();
    if (!tex || !ctx) return defs[0]?.key ?? key;
    for (const d of defs) {
      const src = this.scene.textures.get(d.key).getSourceImage() as CanvasImageSource;
      ctx.drawImage(src, 0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
    tex.refresh();
    return key;
  }

  /** Lignes extrêmes (haut, bas) contenant des pixels visibles, mises en cache par texture. */
  private opaqueBand(key: string): { top: number; bottom: number } | null {
    const cached = bandCache.get(key);
    if (cached !== undefined) return cached;
    const src = this.scene.textures.get(key).getSourceImage() as CanvasImageSource;
    const canvas = document.createElement('canvas');
    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let band: { top: number; bottom: number } | null = { top: 0, bottom: GAME_HEIGHT };
    if (ctx) {
      ctx.drawImage(src, 0, 0, GAME_WIDTH, GAME_HEIGHT);
      const data = ctx.getImageData(0, 0, GAME_WIDTH, GAME_HEIGHT).data;
      const rowVisible = (y: number) => {
        for (let x = 0, i = y * GAME_WIDTH * 4 + 3; x < GAME_WIDTH; x++, i += 4) {
          if ((data[i] ?? 0) > 2) return true;
        }
        return false;
      };
      let top = 0;
      while (top < GAME_HEIGHT && !rowVisible(top)) top++;
      let bottom = GAME_HEIGHT;
      while (bottom > top && !rowVisible(bottom - 1)) bottom--;
      band = bottom > top ? { top, bottom } : null;
    }
    bandCache.set(key, band);
    return band;
  }

  private makeVeilleuse(depth: number): void {
    if (!this.scene.textures.exists(GLOW_KEY)) {
      const tex = this.scene.textures.createCanvas(GLOW_KEY, 128, 128);
      const ctx = tex?.getContext();
      if (!tex || !ctx) return;
      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,233,194,1)');
      grad.addColorStop(0.3, 'rgba(255,233,194,0.33)');
      grad.addColorStop(1, 'rgba(255,233,194,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      tex.refresh();
    }
    const v = veilleuseGlow(this.chapter);
    // La lueur peinte dans le ciel reste ; celle-ci « ronfle » par-dessus (4 s, Sine.inOut).
    const glow = this.scene.add
      .image(v.x, v.y, GLOW_KEY)
      .setDisplaySize(v.r * 2, v.r * 2)
      .setDepth(depth)
      .setAlpha(0.25 * v.alpha);
    const base = glow.scale;
    this.scene.tweens.add({
      targets: glow,
      scale: base * 1.08,
      alpha: 0.4 * v.alpha,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  /** Scintillements : alpha 0.35 -> 0.9, 1,5 à 4 s, quelques étoiles à la fois (≤ 1,6 px). */
  private makeTwinkles(depth: number): void {
    const rng = new Phaser.Math.RandomDataGenerator([`ch${this.chapter}`]);
    for (let i = 0; i < TWINKLES; i++) {
      const x = rng.between(10, GAME_WIDTH - 10);
      const y = rng.between(10, GAME_HEIGHT - 120);
      const dot = this.scene.add
        .circle(x, y, rng.realInRange(1, 1.6), PALETTE.lit, 0.35)
        .setDepth(depth);
      this.twinkles.push({ dot, x });
      this.scene.tweens.add({
        targets: dot,
        alpha: 0.9,
        duration: rng.between(1500, 4000) / 2,
        delay: rng.between(0, 6000),
        repeatDelay: rng.between(2000, 8000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }
  }

  /** Comète (ch.4) ou étoile filante (ch.7) toutes les 6 à 10 s, dans le bandeau du haut. */
  private scheduleShootingStar(): void {
    this.scene.time.delayedCall(Phaser.Math.Between(6000, 10000), () => {
      const fromLeft = Math.random() < 0.5;
      const y = Phaser.Math.Between(14, 54);
      const x0 = fromLeft ? -40 : GAME_WIDTH + 40;
      const len = this.chapter === 4 ? 70 : 40;
      const trail = this.scene.add
        .rectangle(x0, y, len, this.chapter === 4 ? 2.5 : 1.5, PALETTE.lit, 0.3)
        .setOrigin(fromLeft ? 1 : 0, 0.5)
        .setRotation(fromLeft ? 0.06 : -0.06)
        .setDepth(DEPTH + 10);
      this.scene.tweens.add({
        targets: trail,
        x: fromLeft ? GAME_WIDTH + 80 : -80,
        y: y + 40,
        duration: 2200,
        ease: 'Sine.In',
        onComplete: () => trail.destroy(),
      });
      this.scheduleShootingStar();
    });
  }

  private sparkles(nodes: Array<{ x: number; y: number }>): void {
    for (const p of nodes) {
      for (let i = 0; i < 4; i++) {
        const dot = this.scene.add.circle(p.x, p.y, 1.8, PALETTE.lit, 0.9).setDepth(DEPTH + 22);
        this.scene.tweens.add({
          targets: dot,
          x: p.x + Phaser.Math.Between(-30, 30),
          y: p.y + Phaser.Math.Between(20, 70),
          alpha: 0,
          duration: Phaser.Math.Between(700, 1300),
          ease: 'Quad.Out',
          onComplete: () => dot.destroy(),
        });
      }
    }
  }
}
