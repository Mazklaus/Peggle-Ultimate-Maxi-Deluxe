import Phaser from 'phaser';
import { PALETTE, PANEL_ALPHA, TEXT, UI, bodyStyle, textStyle } from './theme';

/**
 * Widgets d'UI (specs UI/UX, section 0) : boutons, icônes, bascule, curseur, focus clavier.
 * Tous les widgets sont des Containers centrés sur (x, y), cibles ≥ 48 px.
 */

export type IconName =
  | 'play'
  | 'replay'
  | 'next'
  | 'map'
  | 'pause'
  | 'options'
  | 'sound'
  | 'music'
  | 'colorblind'
  | 'back'
  | 'motion';

// ---------------------------------------------------------------------------
// Icônes : formes simples, traits arrondis
// ---------------------------------------------------------------------------

/**
 * Dessine une icône centrée sur (0, 0), dans un carré de `size` px.
 * Le daltonien garde le losange ambre des cœurs (doublage forme + couleur).
 */
export function icon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  name: IconName,
  size = 28,
  color: number = PALETTE.textMain,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  drawIcon(g, name, size, color);
  return g;
}

export function drawIcon(
  g: Phaser.GameObjects.Graphics,
  name: IconName,
  size: number,
  color: number,
): void {
  const s = size / 28; // les tracés sont pensés pour 28 px
  const lw = Math.max(2, 3.5 * s);
  g.lineStyle(lw, color, 1);
  g.fillStyle(color, 1);
  const P = (px: number, py: number) => new Phaser.Math.Vector2(px * s, py * s);

  switch (name) {
    case 'play':
      g.fillTriangle(-8 * s, -12 * s, -8 * s, 12 * s, 12 * s, 0);
      break;
    case 'next':
      g.strokePoints([P(-12, -10), P(-2, 0), P(-12, 10)]);
      g.strokePoints([P(0, -10), P(10, 0), P(0, 10)]);
      break;
    case 'back':
      g.strokePoints([P(4, -10), P(-6, 0), P(4, 10)]);
      break;
    case 'replay': {
      g.beginPath();
      g.arc(0, 0, 10 * s, Phaser.Math.DegToRad(-60), Phaser.Math.DegToRad(250), false);
      g.strokePath();
      // pointe de flèche au début de l'arc
      const a = Phaser.Math.DegToRad(-60);
      const tip = new Phaser.Math.Vector2(Math.cos(a) * 10 * s, Math.sin(a) * 10 * s);
      g.fillTriangle(
        tip.x + 6 * s,
        tip.y - 2 * s,
        tip.x - 2 * s,
        tip.y - 7 * s,
        tip.x - 1 * s,
        tip.y + 5 * s,
      );
      break;
    }
    case 'map': {
      const pts = [P(-10, 7), P(0, -9), P(10, 4)];
      g.lineStyle(Math.max(1.5, 2.5 * s), color, 1);
      g.strokePoints(pts);
      pts.forEach((p) => g.fillCircle(p.x, p.y, 3.5 * s));
      break;
    }
    case 'pause':
      g.fillRoundedRect(-8 * s, -10 * s, 5 * s, 20 * s, 2 * s);
      g.fillRoundedRect(3 * s, -10 * s, 5 * s, 20 * s, 2 * s);
      break;
    case 'options': {
      g.strokeCircle(0, 0, 6 * s);
      g.lineStyle(Math.max(2, 4 * s), color, 1);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        g.lineBetween(
          Math.cos(a) * 9 * s,
          Math.sin(a) * 9 * s,
          Math.cos(a) * 13 * s,
          Math.sin(a) * 13 * s,
        );
      }
      break;
    }
    case 'sound':
      g.fillPoints([P(-12, -4), P(-6, -4), P(1, -10), P(1, 10), P(-6, 4), P(-12, 4)], true);
      g.beginPath();
      g.arc(2 * s, 0, 8 * s, -0.8, 0.8, false);
      g.strokePath();
      g.beginPath();
      g.arc(2 * s, 0, 13 * s, -0.8, 0.8, false);
      g.strokePath();
      break;
    case 'music':
      g.fillEllipse(-5 * s, 8 * s, 10 * s, 8 * s);
      g.fillEllipse(8 * s, 5 * s, 10 * s, 8 * s);
      g.lineBetween(-1 * s, 8 * s, -1 * s, -10 * s);
      g.lineBetween(12 * s, 5 * s, 12 * s, -13 * s);
      g.lineStyle(Math.max(3, 5 * s), color, 1);
      g.lineBetween(-1 * s, -10 * s, 12 * s, -13 * s);
      break;
    case 'colorblind': {
      // œil + losange (rappel des cristaux-cœurs)
      g.beginPath();
      g.arc(0, 9 * s, 17 * s, Phaser.Math.DegToRad(-145), Phaser.Math.DegToRad(-35), false);
      g.strokePath();
      g.beginPath();
      g.arc(0, -9 * s, 17 * s, Phaser.Math.DegToRad(35), Phaser.Math.DegToRad(145), false);
      g.strokePath();
      g.fillStyle(0xffb23f, 1);
      g.fillPoints([P(0, -5), P(4, 0), P(0, 5), P(-4, 0)], true);
      break;
    }
    case 'motion':
      g.beginPath();
      g.moveTo(-13 * s, 0);
      for (let i = -13; i <= 13; i += 1) g.lineTo(i * s, Math.sin(i / 3) * 5 * s);
      g.strokePath();
      break;
  }
}

// ---------------------------------------------------------------------------
// Comportement commun : survol, appui, focus
// ---------------------------------------------------------------------------

interface Focusable extends Phaser.GameObjects.Container {
  /** Action déclenchée par clic, Entrée ou Espace. */
  activate?: () => void;
  /** Halo de focus clavier. */
  focusRing?: Phaser.GameObjects.Graphics;
}

function makeInteractive(
  scene: Phaser.Scene,
  box: Focusable,
  ring: Phaser.GameObjects.Graphics,
  onClick: () => void,
): void {
  box.activate = () => press(scene, box, onClick);
  box.focusRing = ring;
  ring.setVisible(false);
  box.setInteractive({ useHandCursor: true });
  box.on('pointerover', () => box.setScale(UI.hoverScale));
  box.on('pointerout', () => box.setScale(1));
  box.on('pointerup', () => box.activate?.());
}

/** Appui : échelle 0,94 pendant 80 ms puis action. */
function press(scene: Phaser.Scene, box: Phaser.GameObjects.Container, onClick: () => void): void {
  const back = box.scale > 1 ? UI.hoverScale : 1;
  box.setScale(UI.pressScale);
  scene.time.delayedCall(UI.pressMs, () => {
    if (box.active) box.setScale(back);
    onClick();
  });
}

function roundedRing(w: number, h: number, r: number, scene: Phaser.Scene) {
  const ring = scene.add.graphics();
  ring.lineStyle(4, PALETTE.lit, 0.4);
  ring.strokeRoundedRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12, r + 6);
  return ring;
}

// ---------------------------------------------------------------------------
// Boutons
// ---------------------------------------------------------------------------

export interface ButtonOpts {
  width?: number;
  size?: number;
  primary?: boolean;
  /** Icône affichée à gauche du libellé (les libellés restent facultatifs). */
  icon?: IconName;
}

/**
 * Bouton rectangulaire arrondi. Signature historique conservée.
 * primary : fond lavande, 72 px de haut, rayon 36 ; sinon panneau sombre, rayon = demi-hauteur.
 */
export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: ButtonOpts = {},
): Phaser.GameObjects.Container {
  const primary = !!opts.primary;
  const size = opts.size ?? 24;
  const width = opts.width ?? 220;
  const height = primary ? UI.primaryHeight : Math.max(UI.minTarget + 8, size * 2.2);
  const radius = primary ? UI.primaryRadius : height / 2;

  const bg = scene.add.graphics();
  bg.fillStyle(primary ? PALETTE.accent : PALETTE.panel, primary ? 1 : PANEL_ALPHA);
  bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
  if (!primary) {
    bg.lineStyle(2, PALETTE.border, 1);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
  }
  const color = primary ? TEXT.onAccent : TEXT.main;
  const text = scene.add.text(0, 0, label, textStyle(size, color)).setOrigin(0.5);
  const parts: Phaser.GameObjects.GameObject[] = [bg];

  if (opts.icon) {
    const iconSize = Math.round(size * 1.1);
    const gap = 12;
    const total = iconSize + (label ? gap + text.width : 0);
    const ic = icon(
      scene,
      -total / 2 + iconSize / 2,
      0,
      opts.icon,
      iconSize,
      primary ? PALETTE.night : PALETTE.textMain,
    );
    text.setX(-total / 2 + iconSize + gap + text.width / 2);
    parts.push(ic);
  }
  parts.push(text);

  const ring = roundedRing(width, height, radius, scene);
  const box = scene.add.container(x, y, [ring, ...parts]).setSize(width, height) as Focusable;
  makeInteractive(scene, box, ring, onClick);
  return box;
}

/** Bouton principal (lavande, 72 px) : raccourci de button(..., { primary: true }). */
export function primaryButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: Omit<ButtonOpts, 'primary'> = {},
): Phaser.GameObjects.Container {
  return button(scene, x, y, label, onClick, { width: 260, size: 26, ...opts, primary: true });
}

/** Bouton secondaire circulaire (Ø 64 par défaut) portant une icône. */
export function iconButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  name: IconName,
  onClick: () => void,
  opts: { diameter?: number; active?: boolean } = {},
): Phaser.GameObjects.Container {
  const d = Math.max(UI.minTarget, opts.diameter ?? UI.secondaryDiameter);
  const bg = scene.add.graphics();
  const ic = scene.add.graphics();
  const paint = (active: boolean) => {
    bg.clear();
    bg.fillStyle(active ? PALETTE.accent : PALETTE.panel, active ? 1 : PANEL_ALPHA);
    bg.fillCircle(0, 0, d / 2);
    if (!active) {
      bg.lineStyle(2, PALETTE.border, 1);
      bg.strokeCircle(0, 0, d / 2);
    }
    ic.clear();
    drawIcon(ic, name, d * 0.44, active ? PALETTE.night : PALETTE.textMain);
  };
  paint(!!opts.active);
  const ring = scene.add.graphics();
  ring.lineStyle(4, PALETTE.lit, 0.4);
  ring.strokeCircle(0, 0, d / 2 + 6);
  const box = scene.add.container(x, y, [ring, bg, ic]).setSize(d, d) as Focusable;
  box.setData('setActive', paint);
  makeInteractive(scene, box, ring, onClick);
  return box;
}

/** Change l'état actif (fond lavande) d'un iconButton, par ex. le bouton daltonien. */
export function setIconButtonActive(btn: Phaser.GameObjects.Container, active: boolean): void {
  (btn.getData('setActive') as ((a: boolean) => void) | undefined)?.(active);
}

// ---------------------------------------------------------------------------
// Bascule 52×28 et curseur
// ---------------------------------------------------------------------------

/** Bascule on/off 52×28 (lavande = actif). onChange reçoit la nouvelle valeur. */
export function toggle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: boolean,
  onChange: (value: boolean) => void,
): Phaser.GameObjects.Container {
  const { w, h } = UI.toggle;
  let on = value;
  const track = scene.add.graphics();
  const knob = scene.add.circle(0, 0, h / 2 - 4, PALETTE.textMain);
  const paint = (animate: boolean) => {
    track.clear();
    track.fillStyle(on ? PALETTE.accent : PALETTE.border, 1);
    track.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    const kx = on ? w / 2 - h / 2 : -w / 2 + h / 2;
    if (animate) scene.tweens.add({ targets: knob, x: kx, duration: 150, ease: 'Quad.out' });
    else knob.setX(kx);
  };
  paint(false);
  const ring = roundedRing(w, h, h / 2, scene);
  // zone cliquable ≥ 48 px de haut
  const box = scene.add
    .container(x, y, [ring, track, knob])
    .setSize(w + 12, UI.minTarget) as Focusable;
  makeInteractive(scene, box, ring, () => {
    on = !on;
    paint(true);
    onChange(on);
  });
  box.off('pointerover').off('pointerout'); // pas de zoom au survol pour une bascule
  return box;
}

/**
 * Curseur horizontal 0..1 (rail 240 px, poignée Ø 28 lavande). Glisser ou cliquer sur le rail ;
 * au clavier (focus) : flèches gauche/droite par pas de `step`.
 */
export function slider(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: number,
  onChange: (value: number) => void,
  opts: { width?: number; step?: number } = {},
): Phaser.GameObjects.Container {
  const w = opts.width ?? UI.slider.w;
  const step = opts.step ?? 0.1;
  let v = Phaser.Math.Clamp(value, 0, 1);
  const rail = scene.add.graphics();
  const knob = scene.add
    .circle(0, 0, UI.slider.knob / 2, PALETTE.accent)
    .setStrokeStyle(3, PALETTE.textMain);
  const paint = () => {
    rail.clear();
    rail.fillStyle(PALETTE.border, 1);
    rail.fillRoundedRect(-w / 2, -4, w, 8, 4);
    rail.fillStyle(PALETTE.accent, 1);
    rail.fillRoundedRect(-w / 2, -4, Math.max(8, w * v), 8, 4);
    knob.setX(-w / 2 + w * v);
  };
  const set = (nv: number) => {
    nv = Phaser.Math.Clamp(Math.round(nv / step) * step, 0, 1);
    if (nv === v) return;
    v = nv;
    paint();
    onChange(v);
  };
  paint();
  const ring = roundedRing(w + UI.slider.knob, UI.slider.knob, UI.slider.knob / 2, scene);
  const box = scene.add
    .container(x, y, [ring, rail, knob])
    .setSize(w + UI.slider.knob, UI.minTarget) as Focusable;
  box.focusRing = ring;
  ring.setVisible(false);
  box.setInteractive({ useHandCursor: true, draggable: true });
  const fromPointer = (p: Phaser.Input.Pointer) => {
    const local = (p.x - box.x) / box.scaleX;
    set((local + w / 2) / w);
  };
  box.on('pointerdown', fromPointer);
  box.on('drag', fromPointer);
  box.setData('nudge', (dir: number) => set(v + dir * step));
  return box;
}

// ---------------------------------------------------------------------------
// Focus clavier
// ---------------------------------------------------------------------------

/**
 * Navigation clavier entre widgets : flèches haut/bas et Tab pour changer de focus,
 * Entrée/Espace pour activer, gauche/droite pour régler un curseur.
 * `initial` = index du widget qui a le focus au départ (souvent le bouton principal).
 * Le halo n'apparaît qu'après la première touche (pas de halo pour la souris).
 */
export function enableKeyboardFocus(
  scene: Phaser.Scene,
  items: Phaser.GameObjects.Container[],
  initial = 0,
): void {
  const kb = scene.input.keyboard;
  if (!kb || items.length === 0) return;
  let index = Phaser.Math.Clamp(initial, 0, items.length - 1);
  let shown = false;
  const show = () => {
    items.forEach((it, i) => (it as Focusable).focusRing?.setVisible(shown && i === index));
  };
  const move = (dir: number) => {
    if (shown) index = (index + dir + items.length) % items.length;
    shown = true;
    show();
  };
  const onKey = (e: KeyboardEvent) => {
    const it = items[index] as Focusable;
    switch (e.key) {
      case 'ArrowDown':
      case 'Tab':
        e.preventDefault?.();
        move(e.shiftKey ? -1 : 1);
        break;
      case 'ArrowUp':
        move(-1);
        break;
      case 'ArrowLeft':
      case 'ArrowRight': {
        const nudge = it.getData('nudge') as ((d: number) => void) | undefined;
        if (nudge) nudge(e.key === 'ArrowLeft' ? -1 : 1);
        else move(e.key === 'ArrowLeft' ? -1 : 1);
        break;
      }
      case 'Enter':
      case ' ':
        it.activate?.();
        break;
    }
  };
  kb.on('keydown', onKey);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.off('keydown', onKey));
}

/** Libellé court Nunito sous ou à côté d'un widget (texte toujours facultatif). */
export function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 13,
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, bodyStyle(size)).setOrigin(0.5);
}
