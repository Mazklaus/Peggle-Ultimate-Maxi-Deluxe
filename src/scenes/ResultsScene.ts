import Phaser from 'phaser';
import { audio } from '../audio';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { nextLevelId, type LevelCatalog } from '../core/levelCatalog';
import type { LevelData } from '../core/levelFormat';
import { markSeen, recordResult, writeSave, type SaveData } from '../core/save';
import type { Breakdown } from '../core/scoreBreakdown';
import { starsFor } from '../core/stars';
import type { GameScene } from './GameScene';
import { REGISTRY, SCENES } from './keys';
import { endSequenceFor } from '../core/story';
import { currentOptions, drawMiniCrystal } from './OptionsScene';
import { CRYSTAL_COLORS, CRYSTAL_COLORS_CB, PALETTE, textStyle, TEXT } from './theme';
import { panel, veil } from './ui';
import { enableKeyboardFocus, iconButton, primaryButton } from './widgets';

export interface ResultsData {
  level: LevelData;
  score: number;
  won: boolean;
  orbsLeft: number;
  /** Cœurs restants (rappel de l'écran d'échec). */
  heartsLeft?: number;
  /** Décompte du score (écran de victoire). */
  breakdown?: Breakdown;
  test?: boolean;
}

/** Où l'Astre vient se poser hors de sa loge (pieds, coordonnées écran). */
export const ASTRE_SPOTS = {
  victoire: { x: 300, y: 420 },
  consolation: { x: 380, y: 400 },
};

const FAIL_PANEL = { w: 360, h: 240 };
const WIN_PANEL = { w: 560, h: 420 };
/** Repères de la séquence de victoire, en ms (specs UI/UX 5). */
const WIN_TIMES = {
  panel: 300,
  lines: 500,
  lineStep: 110,
  stars: 1800,
  starStep: 300,
  buttons: 2700,
};
const TOTAL_COUNT_MS = 800;
/** 1er clic pendant la séquence : accélère d'autant ; 2e clic : la saute. */
const SPEED_UP = 4;

interface Step {
  at: number;
  run: (instant: boolean) => void;
  done: boolean;
}

/**
 * Fin de niveau, en overlay par-dessus le jeu (qui continue de tourner pour que l'Astre vive).
 * Échec (specs 6) : voile 50 %, panneau compact, ENCORE. Victoire (specs 5) : décompte animé,
 * étoiles une par une, SUIVANT. L'Astre sort de sa loge et vient se poser à gauche du panneau.
 */
export class ResultsScene extends Phaser.Scene {
  private steps: Step[] = [];
  private clicks = 0;
  private finished = false;

  constructor() {
    super(SCENES.results);
  }

  create(data: ResultsData): void {
    this.steps = [];
    this.clicks = 0;
    this.finished = false;
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;

    const save = this.registry.get(REGISTRY.save) as SaveData;
    const stars = starsFor(data.score, data.level.stars, data.won);
    let newRecord = false;
    if (!data.test) {
      const before = save.levels[data.level.id];
      recordResult(save, {
        id: data.level.id,
        score: data.score,
        stars,
        won: data.won,
        orbsLeft: data.orbsLeft,
      });
      writeSave(save);
      newRecord = data.won && !!before?.completed && data.score > before.bestScore;
    }

    if (data.won) this.showVictory(data, stars, newRecord);
    else this.showDefeat(data);

    // L'Astre sort APRÈS le lancement de l'overlay (son calque passe alors au premier plan).
    const game = this.gameScene();
    const spot = data.won ? ASTRE_SPOTS.victoire : ASTRE_SPOTS.consolation;
    game?.companionExit(data.won ? 'victoire' : 'consolation', spot.x, spot.y);
  }

  private gameScene(): GameScene | undefined {
    return this.scene.get(SCENES.game) as GameScene | undefined;
  }

  // --- Navigation -----------------------------------------------------------

  private replay(data: ResultsData): void {
    this.scene.start(SCENES.game, { level: data.level, test: data.test });
  }

  private play(level: LevelData): void {
    this.scene.start(SCENES.game, { level });
  }

  private toMap(): void {
    this.scene.stop(SCENES.game);
    this.scene.start(SCENES.map);
  }

  // --- Échec « Encore » -------------------------------------------------------

  private showDefeat(data: ResultsData): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const top = cy - FAIL_PANEL.h / 2;
    const root = this.add.container(0, 0);
    root.add(veil(this, 0.5));
    root.add(panel(this, cx, cy, FAIL_PANEL.w, FAIL_PANEL.h, 24));

    // Rappel : losange ambre + cœurs restants (« il en restait 3 »).
    const hearts = data.heartsLeft ?? 0;
    if (hearts > 0) {
      const g = this.add.graphics();
      const color = (currentOptions(this).colorblind ? CRYSTAL_COLORS_CB : CRYSTAL_COLORS).heart;
      drawMiniCrystal(g, cx - 34, top + 44, 'heart', color, 11);
      root.add(g);
      root.add(this.add.text(cx - 14, top + 44, `× ${hearts}`, textStyle(26)).setOrigin(0, 0.5));
    }

    const again = primaryButton(this, cx, top + 124, 'Encore', () => this.replay(data), {
      icon: 'replay',
      width: 260,
      size: 30,
    });
    root.add(again);
    const focus = [again];
    if (!data.test) {
      const map = iconButton(this, cx, top + 200, 'map', () => this.toMap(), { diameter: 48 });
      root.add(map);
      focus.push(map);
    }
    // ENCORE a le focus par défaut : Espace / Entrée le déclenchent sans halo préalable.
    enableKeyboardFocus(this, focus, 0);

    root.setAlpha(0);
    this.tweens.add({ targets: root, alpha: 1, duration: 160 });
  }

  // --- Victoire ---------------------------------------------------------------

  private showVictory(data: ResultsData, stars: number, newRecord: boolean): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const shade = veil(this, 0.6).setAlpha(0);
    shade.on('pointerup', () => this.onSequenceClick());

    const box = this.add.container(cx, cy + 24).setAlpha(0);
    const bg = panel(this, 0, 0, WIN_PANEL.w, WIN_PANEL.h, 24);
    bg.on('pointerup', () => this.onSequenceClick());
    box.add(bg);
    box.add(this.add.text(0, -172, 'Constellation rallumée !', textStyle(30)).setOrigin(0.5));

    this.step(0, (instant) => this.fade(shade, 1, 250, instant));
    this.step(WIN_TIMES.panel, (instant) => {
      if (instant) box.setAlpha(1).setY(cy);
      else this.tweens.add({ targets: box, alpha: 1, y: cy, duration: 260, ease: 'Cubic.Out' });
    });

    // Lignes du décompte : icône + chiffre (aucun texte obligatoire).
    const b = data.breakdown;
    const colors = currentOptions(this).colorblind ? CRYSTAL_COLORS_CB : CRYSTAL_COLORS;
    const lines: Array<{ draw: (g: Phaser.GameObjects.Graphics) => void; value: number }> = [];
    if (b) {
      lines.push({
        draw: (g) => drawMiniCrystal(g, 0, 0, 'heart', colors.heart, 9),
        value: b.hearts,
      });
      lines.push({
        draw: (g) => drawMiniCrystal(g, 0, 0, 'common', colors.common, 9),
        value: b.others,
      });
      lines.push({
        draw: (g) => drawMiniCrystal(g, 0, 0, 'bonus', colors.bonus, 9),
        value: b.bonus,
      });
      lines.push({ draw: drawOrbIcon, value: b.orbs });
      if (b.chain > 0) lines.push({ draw: drawChainIcon, value: b.chain });
      if (b.finalZone > 0) lines.push({ draw: drawZoneIcon, value: b.finalZone });
    }
    // Jusqu'à 6 lignes (bonus de chaîne, zones du final) : on resserre pour garder
    // TOTAL, étoiles et boutons à leur place dans le panneau de 420 px.
    const lineTop = -132;
    const lineGap = lines.length > 4 ? Math.min(30, 150 / (lines.length - 1)) : 34;
    lines.forEach((line, i) => {
      const y = lineTop + i * lineGap;
      const g = this.add.graphics({ x: -120, y });
      line.draw(g);
      const value = this.add
        .text(130, y, line.value.toLocaleString('fr-FR'), textStyle(24))
        .setOrigin(1, 0.5);
      const row = this.add.container(0, 0, [g, value]).setAlpha(0);
      box.add(row);
      this.step(WIN_TIMES.lines + i * WIN_TIMES.lineStep, (instant) =>
        this.fade(row, 1, 160, instant),
      );
    });

    // TOTAL qui compte en 800 ms.
    const totalY = Math.min(lineTop + (lines.length - 1) * lineGap + 56, 60);
    const total = this.add.text(0, totalY, '0', textStyle(52)).setOrigin(0.5).setAlpha(0);
    box.add(total);
    const totalAt = WIN_TIMES.lines + lines.length * WIN_TIMES.lineStep + 80;
    this.step(totalAt, (instant) => {
      total.setAlpha(1);
      const show = (v: number) => total.setText(Math.round(v).toLocaleString('fr-FR'));
      if (instant) return void show(data.score);
      this.tweens.addCounter({
        from: 0,
        to: data.score,
        duration: TOTAL_COUNT_MS,
        ease: 'Cubic.Out',
        onUpdate: (tw) => show(tw.getValue() ?? 0),
        onComplete: () => show(data.score),
      });
    });

    // Pastille « nouveau record ».
    if (newRecord) {
      const badge = this.add.container(196, totalY).setAlpha(0);
      const pill = this.add.graphics();
      pill.fillStyle(PALETTE.accent, 1).fillRoundedRect(-62, -18, 124, 36, 18);
      const star = this.add.text(-38, 0, '★', textStyle(20, TEXT.onAccent)).setOrigin(0.5);
      const txt = this.add.text(10, 0, 'record', textStyle(16, TEXT.onAccent)).setOrigin(0.5);
      badge.add([pill, star, txt]);
      box.add(badge);
      this.step(totalAt + TOTAL_COUNT_MS, (instant) => this.pop(badge, instant));
    }

    // Étoiles une par une (300 ms chacune, note montante).
    const starY = 112;
    for (let i = 0; i < 3; i++) {
      const lit = i < stars;
      const s = this.add
        .text((i - 1) * 64, starY, '★', textStyle(44, lit ? '#B9A6FF' : '#2E3870'))
        .setOrigin(0.5)
        .setScale(0);
      box.add(s);
      this.step(WIN_TIMES.stars + i * WIN_TIMES.starStep, (instant) => {
        this.pop(s, instant);
        if (lit && !instant) audio.crystalHit('bonus');
      });
    }

    // Boutons : SUIVANT (Espace), rejouer, carte.
    this.step(WIN_TIMES.buttons, (instant) => {
      this.finished = true;
      const buttons = this.victoryButtons(data, box);
      for (const btn of buttons) this.fade(btn, 1, 200, instant);
    });

    this.input.keyboard?.on('keydown-SPACE', () => {
      if (!this.finished) this.skip();
    });
    this.startSteps();
  }

  private victoryButtons(
    data: ResultsData,
    box: Phaser.GameObjects.Container,
  ): Phaser.GameObjects.Container[] {
    const y = 172;
    const save = this.registry.get(REGISTRY.save) as SaveData;
    const catalog = this.registry.get(REGISTRY.catalog) as LevelCatalog;
    const out: Phaser.GameObjects.Container[] = [];
    let main = false;

    const ending = endSequenceFor(data.level.id);
    if (!data.test && ending && markSeen(save, ending)) {
      // Fin de chapitre : vignettes (une fois), puis retour à la carte.
      writeSave(save);
      const toEnding = () => {
        this.scene.stop(SCENES.game);
        this.scene.start(SCENES.cutscene, { sequence: ending, next: { scene: SCENES.map } });
      };
      out.push(primaryButton(this, 0, y, 'Suite', toEnding, { icon: 'next', width: 240 }));
      main = true;
    } else if (!data.test) {
      const next = nextLevelId(catalog.levels, data.level.id);
      const nextLevel = next ? catalog.levels.find((l) => l.id === next) : undefined;
      if (nextLevel) {
        const goNext = () => this.play(nextLevel);
        out.push(primaryButton(this, 0, y, 'Suivant', goNext, { icon: 'next', width: 240 }));
        main = true;
      }
    }
    // Sans niveau suivant (éditeur, dernier niveau), rejouer devient l'action principale.
    if (!main)
      out.push(
        primaryButton(this, 0, y, 'Rejouer', () => this.replay(data), {
          icon: 'replay',
          width: 240,
        }),
      );
    else out.push(iconButton(this, -210, y, 'replay', () => this.replay(data)));
    if (!data.test) out.push(iconButton(this, 210, y, 'map', () => this.toMap()));

    for (const btn of out) btn.setAlpha(0);
    box.add(out);
    // Le bouton principal a le focus (Espace / Entrée). Branché au tour suivant pour que
    // l'appui sur Espace qui vient de sauter la séquence ne le déclenche pas aussitôt.
    this.time.delayedCall(50, () => enableKeyboardFocus(this, out, 0));
    return out;
  }

  // --- Séquence accélérable / sautable -----------------------------------------

  private step(at: number, run: (instant: boolean) => void): void {
    this.steps.push({ at, run, done: false });
  }

  private startSteps(): void {
    for (const s of this.steps) {
      this.time.delayedCall(s.at, () => {
        if (s.done) return;
        s.done = true;
        s.run(false);
      });
    }
  }

  private onSequenceClick(): void {
    if (this.finished) return;
    this.clicks += 1;
    if (this.clicks === 1) {
      this.time.timeScale = SPEED_UP;
      this.tweens.timeScale = SPEED_UP;
    } else this.skip();
  }

  /** Saute la séquence : chaque étape restante prend directement son état final. */
  private skip(): void {
    this.time.removeAllEvents();
    this.tweens.killAll();
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    for (const s of this.steps) {
      s.done = true;
      s.run(true);
    }
  }

  private fade(
    target: Phaser.GameObjects.Container | Phaser.GameObjects.Rectangle,
    alpha: number,
    ms: number,
    instant: boolean,
  ): void {
    if (instant) target.setAlpha(alpha);
    else this.tweens.add({ targets: target, alpha, duration: ms });
  }

  private pop(
    target: Phaser.GameObjects.Container | Phaser.GameObjects.Text,
    instant: boolean,
  ): void {
    target.setAlpha(1);
    if (instant) target.setScale(1);
    else
      this.tweens.add({
        targets: target,
        scale: { from: 0, to: 1 },
        duration: 260,
        ease: 'Back.Out',
      });
  }
}

function drawOrbIcon(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(PALETTE.orbHalo, 0.35).fillCircle(0, 0, 13);
  g.fillStyle(PALETTE.orb, 1).fillCircle(0, 0, 8);
}

/** Bonus de chaîne : trois maillons d'orbe reliés. */
function drawChainIcon(g: Phaser.GameObjects.Graphics): void {
  g.lineStyle(2, PALETTE.orbHalo, 0.8).lineBetween(-10, 4, 10, -4);
  for (const [x, y] of [
    [-10, 4],
    [0, 0],
    [10, -4],
  ] as const)
    g.fillStyle(PALETTE.orb, 1).fillCircle(x, y, 4);
}

/** Zone de bonus du tir final : petite coupe lavande. */
function drawZoneIcon(g: Phaser.GameObjects.Graphics): void {
  g.lineStyle(4, PALETTE.accent, 1);
  g.beginPath();
  g.arc(0, -4, 11, 0, Math.PI, false);
  g.strokePath();
  g.lineBetween(-14, -4, 14, -4);
}
