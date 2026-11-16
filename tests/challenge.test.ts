import { describe, expect, it } from 'vitest';
import {
  CHALLENGE_RULES,
  ChallengeTracker,
  challengeErrors,
  type ChallengeSnapshot,
} from '../src/core/challenge';

const snap = (p: Partial<ChallengeSnapshot> = {}): ChallengeSnapshot => ({
  score: 0,
  breakableLeft: 50,
  breakableTotal: 100,
  heartsLeft: 20,
  orbs: 10,
  canRegainOrbs: true,
  ...p,
});

describe('format du champ challenge', () => {
  it('accepte les exemples du Game Designer', () => {
    expect(
      challengeErrors({ goal: 'tir_unique', value: 6, constraint: 'sans_receptacle' }),
    ).toEqual([]);
    expect(challengeErrors({ goal: 'nettoyage' })).toEqual([]);
    expect(challengeErrors({ goal: 'chaine' })).toEqual([]);
    expect(
      challengeErrors({ goal: 'score', value: 50000, constraint: 'astre_impose', astre: 'volte' }),
    ).toEqual([]);
  });
  it('refuse les champs invalides', () => {
    expect(challengeErrors({ goal: 'vol' })).toHaveLength(2);
    expect(challengeErrors({ goal: 'score' })).toHaveLength(1);
    expect(challengeErrors({ goal: 'score', value: 10, constraint: 'astre_impose' })).toHaveLength(
      1,
    );
    expect(challengeErrors({ goal: 'score', value: -1 })).toHaveLength(1);
  });
});

describe('suivi des défis', () => {
  it('score : atteint dès le palier, médaille seulement si le niveau est gagné', () => {
    const t = new ChallengeTracker({ goal: 'score', value: 1000 });
    expect(t.crystalLit('common', snap({ score: 500 }))).toBe('pending');
    expect(t.ratio).toBe(0.5);
    expect(t.crystalLit('common', snap({ score: 1200 }))).toBe('reached');
    expect(t.levelEnded(false, snap({ score: 1200 }))).toBe('failed');
    const u = new ChallengeTracker({ goal: 'score', value: 1000 });
    u.crystalLit('common', snap({ score: 1200 }));
    expect(u.levelEnded(true, snap({ score: 1200 }))).toBe('success');
  });

  it('tir_unique : N cœurs dans le même tir, raté s’il reste moins de N cœurs', () => {
    const t = new ChallengeTracker({ goal: 'tir_unique', value: 3 });
    t.shotStarted();
    t.crystalLit('heart', snap());
    t.crystalLit('heart', snap());
    expect(t.shotEnded(2, snap({ heartsLeft: 5 }))).toBe('pending');
    t.shotStarted();
    t.crystalLit('heart', snap());
    expect(t.progress).toBe(2); // meilleur tir
    expect(t.shotEnded(2, snap({ heartsLeft: 2 }))).toBe('failed');
  });

  it('chaine : un tir d’au moins 15 rebonds par défaut', () => {
    const t = new ChallengeTracker({ goal: 'chaine' });
    expect(t.target).toBe(15);
    expect(t.shotEnded(12, snap())).toBe('pending');
    expect(t.shotEnded(16, snap())).toBe('reached');
  });

  it('pouvoir : P activations', () => {
    const t = new ChallengeTracker({ goal: 'pouvoir', value: 2 });
    t.powerActivated(snap());
    expect(t.powerActivated(snap())).toBe('reached');
  });

  it('nettoyage : tous les cristaux cassables', () => {
    const t = new ChallengeTracker({ goal: 'nettoyage' });
    t.crystalLit('common', snap({ breakableLeft: 1 }));
    expect(t.state).toBe('pending');
    expect(t.levelEnded(true, snap({ breakableLeft: 1, heartsLeft: 0 }))).toBe('failed');
    const u = new ChallengeTracker({ goal: 'nettoyage' });
    expect(u.crystalLit('heart', snap({ breakableLeft: 0 }))).toBe('reached');
    expect(u.levelEnded(true, snap({ breakableLeft: 0 }))).toBe('success');
  });

  it('economie : jugé à la fin, sauf sans réceptacle où il peut devenir impossible', () => {
    const t = new ChallengeTracker({ goal: 'economie', value: 4 });
    expect(t.shotEnded(3, snap({ orbs: 2 }))).toBe('pending'); // le réceptacle peut en rendre
    expect(t.levelEnded(true, snap({ orbs: 5 }))).toBe('success');
    const u = new ChallengeTracker({ goal: 'economie', value: 4, constraint: 'sans_receptacle' });
    expect(u.shotEnded(3, snap({ orbs: 3, canRegainOrbs: false }))).toBe('failed');
  });

  it('chrono : raté au-delà de 90 s de jeu', () => {
    const t = new ChallengeTracker({ goal: 'score', value: 10, constraint: 'chrono' });
    expect(t.tick(60)).toBe('pending');
    expect(t.secondsLeft).toBe(CHALLENGE_RULES.chronoSeconds - 60);
    expect(t.tick(31)).toBe('failed');
  });
});

describe('champ challenge dans le format de niveau', () => {
  it('se lit, se valide et se réécrit', async () => {
    const { parseLevel, serializeLevel } = await import('../src/core/levelFormat');
    const all = import.meta.glob('../public/levels/ch1-05.json', {
      eager: true,
      import: 'default',
    });
    const raw = all['../public/levels/ch1-05.json'] as Record<string, unknown>;
    const ok = parseLevel({
      ...raw,
      challenge: { goal: 'tir_unique', value: 6, constraint: 'sans_receptacle' },
    });
    expect(ok.errors).toBeUndefined();
    expect(ok.level?.challenge).toEqual({
      goal: 'tir_unique',
      value: 6,
      constraint: 'sans_receptacle',
    });
    const again = parseLevel(JSON.parse(serializeLevel(ok.level!)));
    expect(again.level?.challenge).toEqual(ok.level?.challenge);
    expect(parseLevel({ ...raw, challenge: { goal: 'vol' } }).errors?.length).toBeGreaterThan(0);
  });
});

describe('contraintes appliquées au niveau', () => {
  it('orbes réduits, sans réceptacle, sans pouvoir', async () => {
    const { createLevel } = await import('../src/core/level');
    const { applyChallengeConstraints } = await import('../src/core/challenge');
    const pos = Array.from({ length: 40 }, (_, i) => ({ x: i * 20, y: 100 }));
    const a = createLevel(pos);
    applyChallengeConstraints(a, { goal: 'score', value: 1, constraint: 'orbes_reduits' });
    expect(a.orbs).toBe(7);
    const b = createLevel(pos);
    applyChallengeConstraints(b, { goal: 'score', value: 1, constraint: 'sans_receptacle' });
    expect(b.tuning.freeOrbShotScore).toBe(Number.POSITIVE_INFINITY);
    const c = createLevel(pos);
    c.crystals[0]!.kind = 'power';
    applyChallengeConstraints(c, { goal: 'score', value: 1, constraint: 'sans_pouvoir' });
    expect(c.crystals.some((k) => k.kind === 'power')).toBe(false);
  });
});
