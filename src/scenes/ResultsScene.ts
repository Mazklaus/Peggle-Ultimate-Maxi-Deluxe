import type { GameMode } from '../core/modes';
import Phaser from 'phaser';
import { audio } from '../audio';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { nextLevelId, type LevelCatalog } from '../core/levelCatalog';
import type { LevelData } from '../core/levelFormat';
import {
  markSeen,
  recordChallenge,
  recordDaily,
  recordResult,
  writeSave,
  type SaveData,
} from '../core/save';
import type { Breakdown } from '../core/scoreBreakdown';
import { starsFor } from '../core/stars';
import { companionById } from '../companions';
import { DUEL_RULES } from '../core/duel';
import { CompanionView } from './CompanionView';
import type { DuelSetupData } from './DuelSetupScene';
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
  /** Mode de jeu (jalon 3) : ResultsScene choisit ses boutons. */
  mode?: GameMode;
  /** Constellation du jour : clé AAAAMMJJ (meilleur score et série enregistrés ici). */
  daily?: string;
  /** Défi : objectif et médaille (succès = objectif atteint et niveau gagné). */
  challenge?: { goal: string; success: boolean };
  /** Duel : scores J1/J2, gagnant (0 = J1, 1 = J2, null = égalité -> manche décisive). */
  duel?: {
    scores: [number, number];
    winner: 0 | 1 | null;
    astres: [string, string];
    tiebreak: boolean;
  };
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
    let streak: number | null = null;
    if (!data.test && data.daily) {
      // Constellation du jour : meilleur score du jour et série, hors progression de l'aventure.
      const before = save.daily?.date === data.daily ? save.daily.best : null;
      const rec = recordDaily(save, data.daily, data.score);
      writeSave(save);
      streak = rec.streak;
      newRecord = before !== null && data.score > before;
    } else if (!data.test && data.mode?.kind === 'defi') {
      // Défi : médaille si l'objectif est atteint et le niveau gagné, hors aventure.
      if (recordChallenge(save, data.level.id, !!data.challenge?.success)) writeSave(save);
    } else if (!data.test && data.mode?.kind !== 'duel') {
      // Un duel ne touche pas à la progression de l'aventure.
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

    if (data.duel) return this.showDuel(data, data.duel);
    if (data.won) this.showVictory(data, stars, newRecord, streak);
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
    this.scene.start(SCENES.game, {
      level: data.level,
      test: data.test,
      mode: data.mode,
      daily: data.daily,
    });
  }

  /** Mode hors aventure : le bouton « carte » ramène à l'écran du mode. */
  private toHub(data: ResultsData): void {
    const hub = data.daily ? SCENES.daily : data.mode?.kind === 'defi' ? SCENES.challenges : null;
    if (!hub) return this.toMap();
    this.scene.stop(SCENES.game);
    this.scene.start(hub);
  }

  private play(level: LevelData): void {
    this.scene.start(SCENES.game, { level });
  }

  private toMap(): void {
    this.scene.stop(SCENES.game);
    this.scene.start(SCENES.map);
  }

  // --- Fin du duel (specs UI/UX jalon 3, 4.3) ---------------------------------

  /**
   * Les deux scores côte à côte ; le gagnant grossit (×1,2) avec une couronne, son Astre
   * danse et l'autre applaudit ; égalité : les deux dansent. Égalité hors manche décisive :
   * on propose la manche décisive (un tir chacun). Boutons : REVANCHE, autre niveau, menu.
   */
  private showDuel(data: ResultsData, duel: NonNullable<ResultsData['duel']>): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const root = this.add.container(0, 0).setAlpha(0);
    root.add(veil(this, 0.6));
    root.add(panel(this, cx, cy, 680, 460, 24));
    const tie = duel.winner === null;
    root.add(
      this.add
        .text(cx, cy - 190, tie ? 'Égalité !' : `J${duel.winner! + 1} gagne !`, textStyle(30))
        .setOrigin(0.5),
    );
    const views: CompanionView[] = [];
    ([0, 1] as const).forEach((p) => {
      const x = cx + (p === 0 ? -160 : 160);
      const won = duel.winner === p;
      const col = this.add.container(x, cy - 40).setScale(won ? 1.2 : 1);
      const color = DUEL_RULES.colors[p];
      const g = this.add.graphics();
      g.fillStyle(color, 1);
      if (p === 0) g.fillCircle(-26, 50, 11);
      else g.fillRoundedRect(-37, 39, 22, 22, 6);
      col.add(g);
      col.add(
        this.add
          .text(-8, 50, `J${p + 1}`, textStyle(22, p === 0 ? '#B9A6FF' : '#FF9E8F'))
          .setOrigin(0, 0.5),
      );
      col.add(
        this.add.text(0, 92, duel.scores[p].toLocaleString('fr-FR'), textStyle(40)).setOrigin(0.5),
      );
      if (won) {
        // Couronne lavande au-dessus de l'Astre du gagnant.
        const crown = this.add.graphics();
        crown.fillStyle(PALETTE.accent, 1);
        crown.fillPoints(
          [
            new Phaser.Math.Vector2(-24, -86),
            new Phaser.Math.Vector2(-24, -110),
            new Phaser.Math.Vector2(-12, -96),
            new Phaser.Math.Vector2(0, -116),
            new Phaser.Math.Vector2(12, -96),
            new Phaser.Math.Vector2(24, -110),
            new Phaser.Math.Vector2(24, -86),
          ],
          true,
        );
        col.add(crown);
      }
      root.add(col);
      const def = companionById(duel.astres[p])?.def;
      if (def) {
        const view = new CompanionView(this, def, { x: 0, y: 0 });
        view.setDisplay(x, cy - 70, won ? 0.62 : 0.52);
        view.setDepth(10);
        views.push(view);
        // Gagnant (ou égalité) : il danse ; l'autre applaudit.
        const cheer = () => view.brain.onEvent(won || tie ? 'victoire' : 'gros_coup');
        cheer();
        this.time.addEvent({ delay: 2600, loop: true, callback: cheer });
      }
    });
    this.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, dt: number) => {
      for (const v of views) v.update(dt / 1000, {});
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const v of views) v.destroy();
    });

    const mode = data.mode ?? { kind: 'duel' as const };
    const decider = tie && !duel.tiebreak;
    const replay = (tiebreak: boolean) =>
      this.scene.start(SCENES.game, { level: data.level, mode: { ...mode, tiebreak } });
    const main = decider
      ? primaryButton(this, cx, cy + 170, 'Manche décisive', () => replay(true), {
          icon: 'play',
          width: 300,
        })
      : primaryButton(this, cx, cy + 170, 'Revanche', () => replay(false), {
          icon: 'replay',
          width: 260,
        });
    const other = iconButton(this, cx - 230, cy + 170, 'map', () => {
      this.scene.stop(SCENES.game);
      this.scene.start(SCENES.duelSetup, {
        levelId: data.level.id,
        astres: duel.astres,
      } satisfies DuelSetupData);
    });
    const menu = iconButton(this, cx + 230, cy + 170, 'back', () => {
      this.scene.stop(SCENES.game);
      this.scene.start(SCENES.title);
    });
    root.add([main, other, menu]);
    this.time.delayedCall(50, () => enableKeyboardFocus(this, [main, other, menu], 0));
    this.tweens.add({ targets: root, alpha: 1, duration: 220 });
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
      const map = iconButton(this, cx, top + 200, 'map', () => this.toHub(data), {
        diameter: 48,
      });
      root.add(map);
      focus.push(map);
    }
    // ENCORE a le focus par défaut : Espace / Entrée le déclenchent sans halo préalable.
    enableKeyboardFocus(this, focus, 0);

    root.setAlpha(0);
    this.tweens.add({ targets: root, alpha: 1, duration: 160 });
  }

  // --- Victoire ---------------------------------------------------------------

  private showVictory(
    data: ResultsData,
    stars: number,
    newRecord: boolean,
    streak: number | null,
  ): void {
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
    // Défi : une ligne « défi » (médaille pleine ou creuse) à la place des étoiles.
    const medal = data.mode?.kind === 'defi' ? !!data.challenge?.success : null;
    if (medal !== null) {
      const m = this.add.container(0, starY).setScale(0);
      const g = this.add.graphics();
      if (medal) g.fillStyle(PALETTE.accent, 1).fillCircle(0, 0, 26);
      else g.lineStyle(3, PALETTE.starDim, 0.8).strokeCircle(0, 0, 26);
      m.add(g);
      if (this.textures.exists('icone-medaille-defi'))
        m.add(
          this.add
            .image(0, 0, 'icone-medaille-defi')
            .setDisplaySize(34, 34)
            .setAlpha(medal ? 1 : 0.35),
        );
      box.add(m);
      this.step(WIN_TIMES.stars, (instant) => {
        this.pop(m, instant);
        if (medal && !instant) audio.crystalHit('bonus');
      });
    }
    for (let i = 0; medal === null && i < 3; i++) {
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

    // Constellation du jour : ligne « série » (flamme + jours d'affilée) à côté des étoiles.
    if (streak !== null) {
      const line = this.add.container(-196, starY).setAlpha(0);
      if (this.textures.exists('icone-flamme'))
        line.add(this.add.image(-14, 0, 'icone-flamme').setDisplaySize(30, 30));
      line.add(this.add.text(6, 0, String(streak), textStyle(26)).setOrigin(0, 0.5));
      box.add(line);
      this.step(WIN_TIMES.stars + 3 * WIN_TIMES.starStep, (instant) => this.pop(line, instant));
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
    } else if (!data.test && !data.daily && (data.mode?.kind ?? 'aventure') === 'aventure') {
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
    if (!data.test) out.push(iconButton(this, 210, y, 'map', () => this.toHub(data)));

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
