import { describe, expect, it } from 'vitest';
import { ShotTracker, timeToContact } from '../src/core/shotEvents';

const orb = (x: number, y: number, vx = 0, vy = 0) => ({ x, y, vx, vy, r: 8 });
const heart = (id: number, x: number, y: number) => ({ id, x, y, r: 10 });

describe('ShotTracker', () => {
  it('émet tir_lance puis gros_coup au 5e cristal, une seule fois', () => {
    const t = new ShotTracker();
    expect(t.shotFired()).toEqual(['tir_lance']);
    const events = [1, 2, 3, 4, 5, 6].flatMap((i) => t.crystalLit('common', i * 10));
    expect(events).toEqual(['gros_coup']);
  });

  it('émet chaine_longue à 10 rebonds ou 3 000 points, une seule fois', () => {
    const a = new ShotTracker();
    a.shotFired();
    const ev = Array.from({ length: 12 }, () => a.bounced()).flat();
    expect(ev).toEqual(['chaine_longue']);
    const b = new ShotTracker();
    b.shotFired();
    expect(b.crystalLit('heart', 3000)).toContain('chaine_longue');
    expect(b.bounced()).toEqual([]);
  });

  it('pouvoir_active quand un cristal pouvoir s’allume', () => {
    const t = new ShotTracker();
    t.shotFired();
    expect(t.crystalLit('power', 10)).toEqual(['pouvoir_active']);
  });

  it('bilan : rate sans cœur touché, orbe_recupere si attrapé', () => {
    const t = new ShotTracker();
    t.shotFired();
    t.crystalLit('common', 10);
    expect(t.shotEnded(true, 'aiming')).toEqual(['orbe_recupere', 'rate']);
    t.shotFired();
    t.crystalLit('heart', 100);
    expect(t.shotEnded(false, 'aiming')).toEqual([]);
    expect(t.shotEnded(false, 'won')).toEqual(['victoire']);
    expect(t.shotEnded(false, 'lost')).toEqual(['echec']);
  });

  it('états tendus en début de visée', () => {
    const t = new ShotTracker();
    expect(t.beginAiming(1, 1)).toEqual(['dernier_coeur', 'dernier_orbe']);
    expect(t.beginAiming(4, 5)).toEqual([]);
  });

  it('inactivité à 8 s puis toutes les 12 s', () => {
    const t = new ShotTracker();
    t.beginAiming(10, 10);
    const ev: string[] = [];
    for (let i = 0; i < 300; i++) ev.push(...t.updateAiming(0.1)); // 30 s
    expect(ev).toEqual(['inactivite', 'inactivite']); // 8 s et 20 s
  });

  it('presque : cœur frôlé puis quitté sans contact (≤ 3 cœurs)', () => {
    const t = new ShotTracker();
    t.shotFired();
    const hearts = [heart(1, 100, 100), heart(2, 300, 300)];
    expect(t.orbMoved(orb(100, 125), hearts)).toEqual([]); // bord à 7 px
    expect(t.orbMoved(orb(100, 160), hearts)).toEqual(['presque']);
    expect(t.orbMoved(orb(100, 125), hearts)).toEqual([]); // max 1 par tir
  });

  it('presque n’est pas émis si le cœur frôlé est finalement touché', () => {
    const t = new ShotTracker();
    t.shotFired();
    const hearts = [heart(1, 100, 100)];
    t.orbMoved(orb(100, 125), hearts);
    t.crystalLit('heart', 100, 1);
    expect(t.orbMoved(orb(100, 160), [])).toEqual([]);
  });

  it('presque ignoré quand il reste plus de 3 cœurs', () => {
    const t = new ShotTracker();
    t.shotFired();
    const hearts = [1, 2, 3, 4].map((i) => heart(i, i * 100, 100));
    t.orbMoved(orb(100, 125), hearts);
    expect(t.orbMoved(orb(100, 200), hearts)).toEqual([]);
  });

  it('final_ralenti quand le contact avec le dernier cœur est prévu sous 0,4 s', () => {
    const t = new ShotTracker();
    t.shotFired();
    const last = [heart(1, 100, 300)];
    expect(t.orbMoved(orb(100, 100, 0, 300), last)).toEqual([]); // ~0,6 s
    expect(t.orbMoved(orb(100, 180, 0, 300), last)).toEqual(['final_ralenti']); // ~0,34 s
    expect(t.orbMoved(orb(100, 200, 0, 300), last)).toEqual([]);
  });
});

describe('timeToContact', () => {
  it('null si l’orbe s’éloigne, 0 si déjà au contact', () => {
    expect(timeToContact(orb(0, 0, 0, -100), heart(1, 0, 100))).toBeNull();
    expect(timeToContact(orb(0, 95, 0, 0), heart(1, 0, 100))).toBe(0);
    expect(timeToContact(orb(0, 0, 0, 82), heart(1, 0, 100))).toBeCloseTo(1, 5);
  });
});
