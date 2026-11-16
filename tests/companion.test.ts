import { describe, expect, it } from 'vitest';
import { PIP } from '../src/companions/pip';
import { BRAIN_TUNING, CompanionBrain } from '../src/core/companion/brain';
import { crossedKeys, sampleReaction } from '../src/core/companion/timeline';
import type { ReactionDef, ReactionTrigger } from '../src/core/companion/types';

function seeded(seed = 7): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Fait avancer le cerveau de `seconds` par pas de 1/60 s. */
function run(b: CompanionBrain, seconds: number, input = {}) {
  let last = b.update(0, input);
  for (let i = 0; i < Math.round(seconds * 60); i++) last = b.update(1 / 60, input);
  return last;
}

describe('timeline', () => {
  const def: ReactionDef = {
    id: 't',
    duration: 1,
    keys: [
      { t: 0, eyes: 'wide', body: { y: 0 } },
      { t: 0.5, body: { y: -20 }, mouth: 'open', burst: { kind: 'sparkle', count: 2 } },
      { t: 1, body: { y: 0 } },
    ],
  };

  it('interpole le corps et garde les champs discrets', () => {
    expect(sampleReaction(def, 0.5).body.y).toBeCloseTo(-20);
    expect(sampleReaction(def, 0.25).body.y).toBeCloseTo(-10);
    expect(sampleReaction(def, 0.25).mouth).toBeUndefined();
    expect(sampleReaction(def, 0.6).mouth).toBe('open');
    expect(sampleReaction(def, 0.6).eyes).toBe('wide');
    expect(sampleReaction(def, 0.3).body.sx).toBe(1);
  });

  it('liste les clés franchies une seule fois', () => {
    expect(crossedKeys(def, -1, 0.1).map((k) => k.t)).toEqual([0]);
    expect(crossedKeys(def, 0.1, 0.6).map((k) => k.t)).toEqual([0.5]);
    expect(crossedKeys(def, 0.6, 0.7)).toEqual([]);
  });
});

describe('Pip (données)', () => {
  const required: ReactionTrigger[] = [
    'tir_lance',
    'rate',
    'orbe_recupere',
    'gros_coup',
    'presque',
    'dernier_coeur',
    'victoire',
    'echec',
    'inactivite',
    'chaine_longue',
    'pouvoir_active',
    'dernier_orbe',
    'final_ralenti',
  ];

  it('a au moins une réaction pour chaque événement du plan', () => {
    for (const t of required) expect(PIP.reactions[t]?.length, t).toBeGreaterThan(0);
  });

  it('a des variantes pour les réactions fréquentes et au moins 3 idles longs', () => {
    for (const t of ['tir_lance', 'rate', 'gros_coup'] as const) {
      expect(PIP.reactions[t]?.length, t).toBeGreaterThanOrEqual(2);
    }
    expect(PIP.idleLong.length).toBeGreaterThanOrEqual(3);
  });

  it('chaque réaction est lisible (0,4 à 1,4 s) sauf fin de niveau et idles longs', () => {
    for (const [trigger, list] of Object.entries(PIP.reactions)) {
      for (const r of list ?? []) {
        const long = ['victoire', 'echec', 'inactivite'].includes(trigger);
        expect(r.duration, r.id).toBeGreaterThanOrEqual(0.4);
        expect(r.duration, r.id).toBeLessThanOrEqual(long ? 3 : 1.4);
        const ts = r.keys.map((k) => k.t);
        expect(
          [...ts].sort((a, b) => a - b),
          r.id,
        ).toEqual(ts);
      }
    }
  });
});

describe('CompanionBrain', () => {
  it('joue une réaction sur événement et émet son cri une fois', () => {
    const b = new CompanionBrain(PIP, seeded());
    b.onEvent('gros_coup');
    const p = b.update(1 / 60);
    expect(b.state.reaction).toMatch(/^pip_/);
    expect(p.cry?.reaction).toBe(b.state.reaction);
    expect(b.update(1 / 60).cry).toBeNull();
  });

  it('ne répète pas la même variante deux fois de suite', () => {
    const b = new CompanionBrain(PIP, seeded(3));
    const seen: string[] = [];
    for (let i = 0; i < 8; i++) {
      b.onEvent('rate');
      seen.push(b.state.reaction ?? '');
      run(b, 2);
    }
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
  });

  it('une priorité plus haute interrompt, une plus basse attend son tour', () => {
    const b = new CompanionBrain(PIP, seeded());
    b.setPhase('flight');
    b.onEvent('orbe_recupere');
    const first = b.state.reaction;
    b.onEvent('presque');
    expect(b.state.reaction).not.toBe(first);
    expect(b.state.reaction).toMatch(/noooon|souffle/);
    b.onEvent('rate'); // plus basse : mise en attente
    expect(b.state.reaction).toMatch(/noooon|souffle/);
    run(b, 1.3);
    expect(b.state.reaction).toMatch(/meche|pas_moi|pas_grave/);
  });

  it('victoire passe devant tout et garde sa pose jusqu’à la visée suivante', () => {
    const b = new CompanionBrain(PIP, seeded());
    b.onEvent('rate');
    b.onEvent('victoire');
    expect(b.state.reaction).toMatch(/feu_artifice|calin/);
    run(b, 4);
    expect(b.state.reaction).toMatch(/feu_artifice|calin/);
    b.setPhase('flight');
    b.setPhase('aiming');
    expect(b.state.reaction).toBeNull();
  });

  it('garde-fou : au plus une réaction majeure par seconde pendant le vol', () => {
    const b = new CompanionBrain(PIP, seeded());
    b.setPhase('flight');
    b.onEvent('orbe_recupere');
    const first = b.state.reaction;
    b.onEvent('pouvoir_active'); // plus haute, mais < 1 s après la précédente
    expect(b.state.reaction).toBe(first);
  });

  it('tir_lance ne se joue qu’environ 1 tir sur 3', () => {
    const b = new CompanionBrain(PIP, seeded(11));
    let played = 0;
    for (let i = 0; i < 300; i++) {
      b.onEvent('tir_lance');
      if (b.state.reaction) played += 1;
      run(b, 1.2);
    }
    expect(played / 300).toBeGreaterThan(0.2);
    expect(played / 300).toBeLessThan(0.47);
  });

  it('dernier_coeur met Pip dans un état tendu jusqu’au tir suivant', () => {
    const b = new CompanionBrain(PIP, seeded());
    b.onEvent('dernier_coeur');
    expect(b.state.tense).toBe('dernier_coeur');
    b.setPhase('flight');
    const p = run(b, 2, { orb: { dx: 100, dy: 100, vy: 0, depth: 0.3, nearHeart: false } });
    expect(p.flush).toBeGreaterThan(0.3); // retient son souffle
    b.setPhase('aiming');
    expect(b.state.tense).toBeNull();
  });

  it('la jauge d’excitation monte à chaque cristal puis redescend', () => {
    const b = new CompanionBrain(PIP, seeded());
    b.setPhase('flight');
    for (let i = 0; i < 6; i++) b.onCrystalHit();
    expect(b.state.excitement).toBeCloseTo(6 * BRAIN_TUNING.excitementPerHit, 5);
    b.setPhase('aiming');
    run(b, 6);
    expect(b.state.excitement).toBe(0);
  });

  it('suit l’orbe du regard pendant le vol', () => {
    const b = new CompanionBrain(PIP, seeded());
    b.setPhase('flight');
    const p = run(b, 0.2, { orb: { dx: 400, dy: 0, vy: 0, depth: 0.2, nearHeart: false } });
    expect(p.look.x).toBeGreaterThan(0.9);
    expect(p.body.rot).toBeGreaterThan(0.1);
  });

  it('se crispe quand l’orbe descend dans le dernier tiers', () => {
    const b = new CompanionBrain(PIP, seeded());
    b.setPhase('flight');
    const p = run(b, 0.1, { orb: { dx: 300, dy: 300, vy: 200, depth: 0.8, nearHeart: false } });
    expect(p.mouth).toBe('zigzag');
    expect(p.arms).toBe('bite');
  });

  it('enchaîne des idles en visée, puis s’endort à 30 s et se réveille à la visée', () => {
    const b = new CompanionBrain(PIP, seeded());
    const ids = new Set<string>();
    for (let i = 0; i < 29 * 60; i++) {
      b.update(1 / 60, { aim: { dx: 300, dy: 200 } });
      if (b.state.reaction) ids.add(b.state.reaction);
    }
    expect(ids.size).toBeGreaterThanOrEqual(3);
    run(b, 2, { aim: { dx: 300, dy: 200 } });
    expect(b.state.sleeping).toBe(true);
    b.update(1 / 60, { aim: { dx: 100, dy: 250 } });
    expect(b.state.sleeping).toBe(false);
    expect(b.state.reaction).toBe('pip_sursaut');
  });

  it('un idle interrompu se termine en accéléré avant la réaction', () => {
    const b = new CompanionBrain(PIP, seeded());
    for (let i = 0; i < 25 * 60 && !b.state.reaction?.startsWith('pip_long'); i++) {
      b.update(1 / 60, { aim: { dx: 300, dy: 200 } });
    }
    expect(b.state.reaction).toMatch(/^pip_long/);
    b.onEvent('rate');
    expect(b.state.reaction).toMatch(/^pip_long/);
    run(b, 1.2, { aim: { dx: 300, dy: 200 } });
    expect(b.state.reaction).toMatch(/meche|pas_moi|pas_grave/);
  });

  it('une réaction en attente trop vieille est oubliée', () => {
    const b = new CompanionBrain(PIP, seeded());
    b.setPhase('flight');
    b.onEvent('victoire'); // pose gardée : rien ne se met en file derrière
    b.onEvent('echec');
    b.onEvent('rate');
    run(b, 4);
    b.setPhase('aiming');
    run(b, 0.1);
    expect(b.state.reaction ?? '').not.toMatch(/meche|pas_moi|pas_grave|echec/);

    const c = new CompanionBrain(PIP, seeded());
    c.setPhase('flight');
    c.onEvent('final_ralenti');
    const finalDur = PIP.reactions.final_ralenti!.find((r) => r.id === c.state.reaction)!.duration;
    c.onEvent('rate'); // en file
    c.onEvent('presque'); // en file, devant « rate »
    run(c, finalDur + 0.05);
    expect(c.state.reaction).toMatch(/noooon|souffle/);
    run(c, 1.3); // « rate » attend depuis plus de pendingMaxAgeSeconds : oublié
    expect(c.state.reaction ?? '').not.toMatch(/meche|pas_moi|pas_grave/);
  });

  it('« oh ! » complet une fois par tir avec 3 cœurs ou moins, muet au-delà', () => {
    const near = (nearHeart: boolean, heartsLeft: number) => ({
      orb: { dx: 300, dy: 100, vy: 0, depth: 0.3, nearHeart, heartsLeft },
    });
    const b = new CompanionBrain(PIP, seeded());
    b.setPhase('flight');
    const cries: string[] = [];
    for (let i = 0; i < 3; i++) {
      for (const n of [true, false]) {
        for (let f = 0; f < 30; f++) {
          const p = b.update(1 / 60, near(n, 2));
          if (p.cry) cries.push(p.cry.reaction);
        }
      }
    }
    expect(cries.filter((c) => c.includes('oh') || c.startsWith('pip_'))).toHaveLength(1);

    const m = new CompanionBrain(PIP, seeded());
    m.setPhase('flight');
    let p = m.update(1 / 60, near(true, 10));
    expect(p.cry).toBeNull();
    expect(p.eyes).toBe('wide');
    for (let f = 0; f < 60; f++) p = m.update(1 / 60, near(f % 20 < 10, 10));
    expect(m.state.reaction).toBeNull();
  });
});
