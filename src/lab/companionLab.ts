/**
 * Labo des Astres (dev uniquement : npm run dev puis /lab.html).
 * Pip dans sa loge, une zone de jeu factice et un orbe simulé, plus des boutons pour émettre
 * chaque événement du bus. Sert à régler les réactions sans jouer une partie entière.
 */
import Phaser from 'phaser';
import { PIP } from '../companions/pip';
import { gameEvents, type GameEventName } from '../core/events';
import { CompanionView } from '../scenes/CompanionView';

const PLAY = { x: 200, y: 64, w: 880, h: 656 };
const CANNON = { x: PLAY.x + PLAY.w / 2, y: PLAY.y + 20 };

class CompanionLab extends Phaser.Scene {
  private pip!: CompanionView;
  private orb: { x: number; y: number; vx: number; vy: number; hits: number } | null = null;
  private orbDot!: Phaser.GameObjects.Arc;
  private aim = { x: CANNON.x, y: CANNON.y + 200 };
  private stateEl = document.getElementById('state');

  constructor() {
    super('CompanionLab');
  }

  create(): void {
    this.add.rectangle(PLAY.x, PLAY.y, PLAY.w, PLAY.h, 0x141b3d).setOrigin(0);
    this.add.rectangle(0, 0, 196, 720, 0x1b2350, 0.6).setOrigin(0);
    this.add.circle(CANNON.x, CANNON.y, 16, 0x8c93c9);
    for (let i = 0; i < 6; i++)
      this.add.circle(PLAY.x + 160 + i * 110, 420, 10, i === 2 ? 0xffb23f : 0x6fcbff);
    this.orbDot = this.add.circle(0, 0, 8, 0xfff6e0).setVisible(false);
    this.pip = new CompanionView(this, PIP);
    this.pip.attach();
    this.input.on(
      'pointermove',
      (p: Phaser.Input.Pointer) => (this.aim = { x: p.worldX, y: p.worldY }),
    );
    this.input.on('pointerdown', () => this.fire());
    this.buildPanel();
  }

  fire(): void {
    if (this.orb) return;
    const a = Math.atan2(this.aim.y - CANNON.y, this.aim.x - CANNON.x);
    this.orb = { x: CANNON.x, y: CANNON.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, hits: 0 };
    this.pip.setPhase('flight');
    gameEvents.emit('tir_lance', { angle: a });
  }

  update(_t: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const o = this.orb;
    if (o) {
      o.vy += 900 * dt;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (o.x < PLAY.x + 8 || o.x > PLAY.x + PLAY.w - 8) o.vx *= -1;
      // Rebond factice sur la rangée de cristaux.
      if (o.y > 410 && o.y < 430 && o.vy > 0 && Math.random() < 0.6) {
        o.vy *= -0.8;
        o.hits += 1;
        gameEvents.emit('cristal_allume', { kind: 'common', chain: o.hits, points: 10 });
      }
      this.orbDot.setPosition(o.x, o.y).setVisible(true);
      this.pip.update(dt, {
        orb: { x: o.x, y: o.y, vy: o.vy },
        orbDepth: (o.y - PLAY.y) / PLAY.h,
        orbNearHeart: Math.hypot(o.x - (PLAY.x + 380), o.y - 420) < 40,
      });
      if (o.y > PLAY.y + PLAY.h) {
        this.orb = null;
        this.orbDot.setVisible(false);
        this.pip.setPhase('aiming');
        if (o.hits >= 5) gameEvents.emit('gros_coup', { hits: o.hits });
        else if (o.hits === 0) gameEvents.emit('rate', {});
        else this.pip.brain.onShotEndQuiet();
      }
    } else {
      this.pip.update(dt, { aim: this.aim });
    }
    const s = this.pip.brain.state;
    if (this.stateEl) {
      this.stateEl.textContent = `phase=${s.phase} réaction=${s.reaction ?? '-'} tendu=${s.tense ?? '-'} dort=${s.sleeping} jauge=${s.excitement.toFixed(2)}`;
    }
  }

  private buildPanel(): void {
    const panel = document.getElementById('panel');
    if (!panel) return;
    const add = (label: string, fn: () => void) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.onclick = fn;
      panel.appendChild(b);
    };
    const events: GameEventName[] = [
      'tir_lance',
      'gros_coup',
      'chaine_longue',
      'rate',
      'orbe_recupere',
      'pouvoir_active',
      'presque',
      'dernier_coeur',
      'dernier_orbe',
      'final_ralenti',
      'victoire',
      'echec',
      'inactivite',
      'orbe_coincee',
    ];
    for (const e of events) {
      add(e, () =>
        gameEvents.emit(e, {
          hits: 5,
          bounces: 10,
          shotScore: 3000,
          astre: 'pip',
          score: 1000,
          angle: 0,
          attempt: 1,
        } as never),
      );
    }
    add('cristal ×1', () =>
      gameEvents.emit('cristal_allume', { kind: 'common', chain: 1, points: 10 }),
    );
    add('tirer', () => this.fire());
    add('visée', () => this.pip.setPhase('aiming'));
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#0B1026',
  scene: [CompanionLab],
});
