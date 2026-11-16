import { describe, expect, it } from 'vitest';
import { awakeCompanions, COMPANION_ROSTER, companionById } from '../src/companions';
import { COMPANIONS } from '../src/core/levelFormat';

describe('liste des Astres', () => {
  it('couvre exactement les identifiants du format de niveau, un par chapitre', () => {
    expect(COMPANION_ROSTER.map((c) => c.id)).toEqual([...COMPANIONS]);
    expect(COMPANION_ROSTER.map((c) => c.wakesAtChapter)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('charges des pouvoirs selon le Game Designer', () => {
    expect(companionById('pip')?.power.maxCharges).toBe(4);
    expect(companionById('nuage-lune')?.power).toMatchObject({ kind: 'reserve', maxCharges: 1 });
    for (const c of COMPANION_ROSTER)
      expect(c.power.maxCharges === 0).toBe(c.power.kind === 'immediate');
  });

  it('donne les Astres réveillés à un chapitre', () => {
    expect(awakeCompanions(1).map((c) => c.id)).toEqual(['pip']);
    expect(awakeCompanions(3)).toHaveLength(3);
    expect(companionById('inconnu')).toBeUndefined();
  });
});
