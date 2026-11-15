import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';

/** Scène de démarrage : vérifie que le moteur et la physique Matter tournent. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.add
      .text(GAME_WIDTH / 2, 40, 'Squelette OK : clic = lâcher une bille', {
        fontFamily: 'sans-serif',
        fontSize: '20px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.matter.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    for (let i = 0; i < 6; i++) {
      const peg = this.add.circle(150 + i * 100, 300, 10, 0x4fc3f7);
      this.matter.add.gameObject(peg, { isStatic: true, shape: { type: 'circle', radius: 10 } });
    }

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const ball = this.add.circle(p.x, 80, 8, 0xffffff);
      this.matter.add.gameObject(ball, {
        shape: { type: 'circle', radius: 8 },
        restitution: 0.8,
      });
    });
  }
}
