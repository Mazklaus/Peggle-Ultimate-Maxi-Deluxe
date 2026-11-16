import Phaser from 'phaser';
import { COMPANION_ROSTER } from '../companions';
import type { ReactionTrigger } from '../core/companion/types';
import { memoryCount, memoryRows, metAstres, type MemoryEntry } from '../core/memories';
import type { SaveData } from '../core/save';
import type { CutsceneData } from './CutsceneScene';
import { CompanionView } from './CompanionView';
import { REGISTRY, SCENES } from './keys';
import { CHAPTERS, SKY, chapter as chapterDef } from './mapData';
import type { MapSceneData } from './MapScene';
import { drawPortrait } from './powerIcons';
import { starPoints, starPoints8 } from './shapes';
import { PALETTE, TEXT, bodyStyle, textStyle } from './theme';
import { fadeIn, fadeTo, panel } from './ui';
import { iconButton } from './widgets';

/** Hublots (specs UI/UX jalon 3, 6) : 3 rangées, Ø 88, pas de 124 px. */
const HUBLOT = { r: 44, pitch: 124 };
const ROWS = { reveil: 200, fin: 350, astres: 535 };
/** Réactions jouées au clic sur la fiche d'un Astre (au hasard). */
const ASTRE_CLICK: ReactionTrigger[] = ['victoire', 'gros_coup', 'presque', 'pouvoir_active'];

/**
 * Galerie des souvenirs, dans l'Observatoire : les séquences de vignettes déjà vues, dans
 * l'ordre de l'histoire (cadre sombre « ? » sinon), et une fiche par Astre rencontré.
 * Clic = rejoue la séquence (CutsceneScene), retour à la galerie à la fin.
 */
export class MemoriesScene extends Phaser.Scene {
  private astres: CompanionView[] = [];

  constructor() {
    super(SCENES.memories);
  }

  create(): void {
    fadeIn(this);
    this.astres = [];
    const save = this.registry.get(REGISTRY.save) as SaveData;
    const seen = save?.seen ?? {};

    // Intérieur de l'Observatoire : le ciel par la coupole, un grand mur sombre.
    const sky = this.textures.exists('carte-ciel-fixe') ? 'carte-ciel-fixe' : SKY.bg.key;
    if (this.textures.exists(sky)) this.add.image(0, 0, sky).setOrigin(0).setAlpha(0.5);
    panel(this, 640, 384, 1220, 640, 32);

    this.add.text(640, 36, 'Souvenirs', textStyle(32)).setOrigin(0.5);
    const count = memoryCount(seen);
    this.add.text(1236, 36, `${count.seen}/${count.total}`, textStyle(20)).setOrigin(1, 0.5);
    iconButton(this, 40, 36, 'back', () => this.back(), { diameter: 48 });

    const [reveils, fins] = memoryRows(seen);
    const rowX = (n: number, i: number) => 640 + (i - (n - 1) / 2) * HUBLOT.pitch;
    const caption = this.add.text(640, 432, '', bodyStyle(15, TEXT.dim)).setOrigin(0.5);
    const place = (row: MemoryEntry[], y: number) =>
      row.forEach((e, i) => this.hublot(e, rowX(row.length, i), y, caption));
    place(reveils, ROWS.reveil);
    place(fins, ROWS.fin);

    // Rangée 3 : les Astres rencontrés, en attente ; un clic les fait réagir.
    const met = metAstres(seen);
    const roster = [...COMPANION_ROSTER].sort((a, b) => a.wakesAtChapter - b.wakesAtChapter);
    roster.forEach((c, i) => {
      const x = rowX(roster.length, i);
      const known = met[c.wakesAtChapter - 1] ?? false;
      const g = this.add.graphics();
      g.fillStyle(0x141b3d, 1).fillCircle(x, ROWS.astres, HUBLOT.r + 6);
      g.lineStyle(3, known ? c.color : PALETTE.starDim, known ? 0.9 : 0.4);
      g.strokeCircle(x, ROWS.astres, HUBLOT.r + 6);
      if (!known || !c.def) {
        this.question(x, ROWS.astres);
        return;
      }
      const view = new CompanionView(this, c.def, { x: 0, y: 0 });
      view.setDisplay(x, ROWS.astres + 24, 0.45);
      view.setDepth(5);
      this.astres.push(view);
      this.add.text(x, ROWS.astres + HUBLOT.r + 22, c.name, bodyStyle(14, TEXT.dim)).setOrigin(0.5);
      this.add
        .zone(x, ROWS.astres, HUBLOT.r * 2 + 12, HUBLOT.r * 2 + 12)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () =>
          view.brain.onEvent(ASTRE_CLICK[Math.floor(Math.random() * ASTRE_CLICK.length)]!),
        );
    });

    this.input.keyboard?.on('keydown-ESC', () => this.back());
    this.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, dt: number) => {
      for (const a of this.astres) a.update(dt / 1000, {});
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const a of this.astres) a.destroy();
      this.astres = [];
    });
  }

  /** Un hublot : contenu du souvenir s'il a été vu, sinon « ? ». */
  private hublot(e: MemoryEntry, x: number, y: number, caption: Phaser.GameObjects.Text): void {
    const ring = this.add.graphics();
    const paintRing = (hover: boolean) => {
      ring.clear();
      ring.fillStyle(0x141b3d, 1).fillCircle(x, y, HUBLOT.r);
      const color = e.seen ? (hover ? PALETTE.lit : PALETTE.accent) : PALETTE.starDim;
      ring.lineStyle(hover ? 4 : 3, color, e.seen ? 0.9 : 0.4).strokeCircle(x, y, HUBLOT.r);
    };
    paintRing(false);
    if (!e.seen) {
      this.question(x, y);
      return;
    }
    this.drawContent(e, x, y);
    const text = memoryTitle(e);
    this.add
      .zone(x, y, HUBLOT.r * 2, HUBLOT.r * 2)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        paintRing(true);
        caption.setText(text).setPosition(x, y + HUBLOT.r + 18);
      })
      .on('pointerout', () => {
        paintRing(false);
        caption.setText('');
      })
      .on('pointerup', () => this.play(e));
  }

  private question(x: number, y: number): void {
    this.add.text(x, y, '?', textStyle(30)).setOrigin(0.5).setAlpha(0.35);
  }

  private drawContent(e: MemoryEntry, x: number, y: number): void {
    const g = this.add.graphics();
    if (e.kind === 'intro') {
      // La Grande Veilleuse endormie.
      g.fillStyle(0xffe9c2, 0.25).fillCircle(x, y, 32);
      g.fillStyle(0xffe9c2, 0.95).fillPoints(starPoints8(x, y, 22, 13), true);
      g.lineStyle(2, 0x1b2350, 0.8);
      for (const dx of [-7, 7]) {
        g.beginPath();
        g.arc(x + dx, y - 1, 4, 0.2, Math.PI - 0.2);
        g.strokePath();
      }
      return;
    }
    const c = chapterDef(e.chapter);
    if (e.kind === 'reveil') {
      g.fillStyle(c.accent, 0.2).fillCircle(x, y, 36);
      drawPortrait(g, x, y, 24, c.accent);
      return;
    }
    // Fin de chapitre : sa constellation allumée, réduite dans le hublot.
    const xs = c.nodes.map((p) => p.x);
    const ys = c.nodes.map((p) => p.y);
    const w = Math.max(...xs) - Math.min(...xs) || 1;
    const h = Math.max(...ys) - Math.min(...ys) || 1;
    const k = 52 / Math.max(w, h);
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    const pts = c.nodes.map((p) => ({ x: x + (p.x - cx) * k, y: y + (p.y - cy) * k }));
    g.fillStyle(c.accent, 0.18).fillCircle(x, y, 38);
    g.lineStyle(1.5, PALETTE.lit, 0.6);
    for (const [i, j] of c.edges) {
      const a = pts[i];
      const b = pts[j];
      if (a && b) g.lineBetween(a.x, a.y, b.x, b.y);
    }
    g.fillStyle(PALETTE.lit, 1);
    for (const p of pts) g.fillPoints(starPoints(p.x, p.y, 3.2, 1.4), true);
    if (e.chapter === CHAPTERS.length) {
      // Le final : la Veilleuse s'éveille derrière la dernière figure.
      g.fillStyle(0xffe9c2, 0.35).fillPoints(starPoints8(x, y, 14, 8), true);
    }
  }

  private play(e: MemoryEntry): void {
    fadeTo(this, SCENES.cutscene, {
      sequence: e.sequence,
      next: { scene: SCENES.memories },
    } satisfies CutsceneData);
  }

  private back(): void {
    fadeTo(this, SCENES.map, { view: 'sky' } satisfies MapSceneData);
  }
}

/** Légende au survol (seulement pour un souvenir déjà vu : pas de divulgâchage). */
function memoryTitle(e: MemoryEntry): string {
  if (e.kind === 'intro') return 'La Grande Veilleuse s’endort';
  const c = chapterDef(e.chapter);
  const astre = COMPANION_ROSTER.find((a) => a.id === c.astre)?.name ?? c.astre;
  if (e.kind === 'reveil') return `Réveil de ${astre}`;
  if (e.chapter === CHAPTERS.length) return 'Le grand réveil';
  return `${c.name.charAt(0).toUpperCase()}${c.name.slice(1)} se rallume`;
}
