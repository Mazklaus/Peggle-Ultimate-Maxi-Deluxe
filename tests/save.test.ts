import { describe, expect, it } from 'vitest';
import {
  challengeMedals,
  currentStreak,
  dailyBars,
  previousDayKey,
  recordChallenge,
  recordDaily,
  emptySave,
  failsBeforeFirstWin,
  isUnlocked,
  loadSave,
  markSeen,
  recordResult,
  SAVE_KEY,
  writeSave,
  type KeyValueStorage,
} from '../src/core/save';
import { starsFor } from '../src/core/stars';

function memory(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('save', () => {
  it('renvoie une sauvegarde vide si rien ou illisible', () => {
    const s = memory();
    expect(loadSave(s)).toEqual(emptySave());
    s.setItem(SAVE_KEY, '{pas du json');
    expect(loadSave(s)).toEqual(emptySave());
    expect(loadSave(null)).toEqual(emptySave());
  });

  it('écrit puis relit', () => {
    const s = memory();
    const save = emptySave();
    save.options.colorblind = true;
    recordResult(save, { id: 'pro-01', score: 1200, stars: 2, won: true, orbsLeft: 3 });
    writeSave(save, s);
    const back = loadSave(s);
    expect(back.options.colorblind).toBe(true);
    expect(back.levels['pro-01']?.completed).toBe(true);
    expect(back.scoreLog).toHaveLength(1);
  });

  it('ne casse pas si le stockage refuse', () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('interdit');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(() => writeSave(emptySave(), broken)).not.toThrow();
    expect(loadSave(broken)).toEqual(emptySave());
  });

  it('garde le meilleur score et les meilleures étoiles, compte les échecs', () => {
    const save = emptySave();
    recordResult(save, { id: 'a', score: 500, stars: 0, won: false, orbsLeft: 0 });
    recordResult(save, { id: 'a', score: 900, stars: 0, won: false, orbsLeft: 0 });
    expect(failsBeforeFirstWin(save, 'a')).toBe(2);
    recordResult(save, { id: 'a', score: 3000, stars: 3, won: true, orbsLeft: 2 });
    recordResult(save, { id: 'a', score: 2000, stars: 2, won: true, orbsLeft: 1 });
    expect(save.levels.a).toEqual({
      completed: true,
      bestScore: 3000,
      stars: 3,
      plays: 4,
      fails: 2,
    });
    expect(failsBeforeFirstWin(save, 'a')).toBe(0);
  });

  it('débloque un niveau quand le précédent est fini', () => {
    const order = ['pro-01', 'pro-02', 'pro-03'];
    const save = emptySave();
    expect(isUnlocked(order, 'pro-01', save)).toBe(true);
    expect(isUnlocked(order, 'pro-02', save)).toBe(false);
    recordResult(save, { id: 'pro-01', score: 1, stars: 1, won: true, orbsLeft: 0 });
    expect(isUnlocked(order, 'pro-02', save)).toBe(true);
    expect(isUnlocked(order, 'inconnu', save)).toBe(false);
  });
});

describe('starsFor', () => {
  it('0 si perdu, puis 1 à 3 selon les seuils', () => {
    expect(starsFor(99999, [100, 200], false)).toBe(0);
    expect(starsFor(50, [100, 200], true)).toBe(1);
    expect(starsFor(100, [100, 200], true)).toBe(2);
    expect(starsFor(200, [100, 200], true)).toBe(3);
  });
});

describe('cinématiques vues (seen)', () => {
  it('une sauvegarde sans champ seen se charge avec seen = {}', () => {
    const old = { version: 1, levels: {}, options: {}, scoreLog: [] };
    const storage = { getItem: () => JSON.stringify(old), setItem: () => undefined };
    expect(loadSave(storage).seen).toEqual({});
  });

  it('markSeen ne renvoie true que la première fois et survit à la sauvegarde', () => {
    const save = emptySave();
    expect(markSeen(save, 'intro')).toBe(true);
    expect(markSeen(save, 'intro')).toBe(false);
    let stored = '';
    writeSave(save, { getItem: () => null, setItem: (_k, v) => (stored = v) });
    expect(loadSave({ getItem: () => stored, setItem: () => undefined }).seen.intro).toBe(true);
  });
});

import { ScoreBreakdown } from '../src/core/scoreBreakdown';

describe('ScoreBreakdown', () => {
  it('répartit le score et déduit la zone finale', () => {
    const b = new ScoreBreakdown();
    b.add('heart', 100);
    b.add('common', 10);
    b.add('power', 10);
    b.add('bonus', 500);
    b.addChain(200);
    expect(b.finish(2320, 1000)).toEqual({
      hearts: 100,
      others: 20,
      bonus: 500,
      orbs: 1000,
      finalZone: 500,
      chain: 200,
      total: 2320,
    });
    b.reset();
    expect(b.finish(0, 0)).toMatchObject({ total: 0, chain: 0 });
  });
});

describe('Constellation du jour (save.daily)', () => {
  const mem = () => {
    let stored: string | null = null;
    return { getItem: () => stored, setItem: (_: string, v: string) => void (stored = v) };
  };

  it('garde le meilleur score du jour, essais illimités', () => {
    const save = emptySave();
    recordDaily(save, '20261116', 30000);
    recordDaily(save, '20261116', 12000);
    expect(recordDaily(save, '20261116', 41000)).toMatchObject({
      date: '20261116',
      best: 41000,
      streak: 1,
    });
  });

  it('série : +1 si la veille a été jouée, sinon on repart à 1', () => {
    const save = emptySave();
    recordDaily(save, '20261130', 100);
    expect(recordDaily(save, '20261201', 50)).toMatchObject({
      date: '20261201',
      best: 50,
      streak: 2,
      lastDate: '20261130',
    });
    expect(recordDaily(save, '20261203', 10).streak).toBe(1);
    expect(currentStreak(save, '20261203')).toBe(1);
    expect(currentStreak(save, '20261204')).toBe(1);
    expect(currentStreak(save, '20261205')).toBe(0);
  });

  it('veille dans le calendrier local (fin de mois, d’année, bissextile)', () => {
    expect(previousDayKey('20270101')).toBe('20261231');
    expect(previousDayKey('20280301')).toBe('20280229');
  });

  it('préservé par loadSave, ignoré s’il est mal formé', () => {
    const storage = mem();
    const save = emptySave();
    recordDaily(save, '20261116', 999);
    writeSave(save, storage);
    expect(loadSave(storage).daily).toMatchObject({ date: '20261116', best: 999, streak: 1 });
    storage.setItem(
      'k',
      JSON.stringify({ ...emptySave(), daily: { date: 'hier', best: 1, streak: 1 } }),
    );
    expect(loadSave(storage)).not.toHaveProperty('daily');
  });
});

describe('vitesse du jeu (jalon 3)', () => {
  it('défaut normal, valeur inconnue ramenée à 1', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    expect(loadSave(storage).options.speed).toBe(1);
    const s = loadSave(storage);
    store.set('ricochet:save', JSON.stringify({ ...s, options: { ...s.options, speed: 3 } }));
    expect(loadSave(storage).options.speed).toBe(1);
    store.set('ricochet:save', JSON.stringify({ ...s, options: { ...s.options, speed: 0.8 } }));
    expect(loadSave(storage).options.speed).toBe(0.8);
  });
});

describe('historique du jour (classement local)', () => {
  it('garde le meilleur score des 7 derniers jours joués', () => {
    const save = emptySave();
    for (let d = 10; d <= 19; d++) recordDaily(save, `202611${d}`, d * 100);
    recordDaily(save, '20261119', 500); // moins bon : le meilleur reste
    expect(Object.keys(save.daily?.history ?? {})).toHaveLength(7);
    expect(save.daily?.history?.['20261119']).toBe(1900);
    expect(save.daily?.history?.['20261112']).toBeUndefined();
    const bars = dailyBars(save, '20261121');
    expect(bars.map((b) => b.key)).toEqual([
      '20261115',
      '20261116',
      '20261117',
      '20261118',
      '20261119',
      '20261120',
      '20261121',
    ]);
    expect(bars.map((b) => b.best)).toEqual([1500, 1600, 1700, 1800, 1900, null, null]);
  });
});

describe('médailles des défis', () => {
  it('une médaille par défi réussi, gardée par loadSave', () => {
    const save = emptySave();
    expect(recordChallenge(save, 'def-1-1', false)).toBe(false);
    expect(recordChallenge(save, 'def-1-1', true)).toBe(true);
    expect(recordChallenge(save, 'def-1-1', true)).toBe(false);
    expect(challengeMedals(save, ['def-1-1', 'def-1-2'])).toBe(1);
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    writeSave(save, storage);
    expect(loadSave(storage).challenges).toEqual({ 'def-1-1': true });
  });
});
