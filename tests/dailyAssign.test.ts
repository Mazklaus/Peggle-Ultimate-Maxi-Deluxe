import { describe, expect, it } from 'vitest';
import { dailyAssignRng, generateDaily } from '../src/core/daily';
import { levelFromData } from '../src/core/levelSetup';

const kinds = (key: string) =>
  levelFromData(generateDaily(key).level, dailyAssignRng(key)).crystals.map((c) => c.kind);

describe('constellation du jour : tirage des cristaux', () => {
  it('donne les mêmes cœurs, pouvoirs et bonus à chaque chargement', () => {
    for (const key of ['20261116', '20261119', '20261205']) expect(kinds(key)).toEqual(kinds(key));
  });

  it('change d’un jour à l’autre', () => {
    expect(kinds('20261119')).not.toEqual(kinds('20261120'));
  });
});
