import { describe, expect, it } from 'vitest';
import {
  announceKey,
  chapterLevelIds,
  chapterOf,
  chapterStars,
  chapterState,
  chaptersDone,
  currentChapter,
  MAX_STARS,
  pendingUnlock,
  totalStars,
} from '../src/core/mapProgress';
import { emptySave, type SaveData } from '../src/core/save';

function finish(save: SaveData, ids: string[], stars = 2): SaveData {
  for (const id of ids)
    save.levels[id] = { completed: true, bestScore: 1, stars, plays: 1, fails: 0 };
  return save;
}

describe('progression de la carte', () => {
  it('ids, chapitres et total maximal', () => {
    expect(chapterLevelIds(3)[0]).toBe('ch3-01');
    expect(chapterLevelIds(3)[11]).toBe('ch3-12');
    expect(chapterOf('pro-02')).toBe(0);
    expect(chapterOf('ch7-10')).toBe(7);
    expect(chapterOf('def-1')).toBeNull();
    expect(MAX_STARS).toBe(300);
  });

  it('états : le chapitre suivant s’ouvre quand le précédent est terminé', () => {
    const s = emptySave();
    expect(chapterState(s, 0)).toBe('open');
    expect(chapterState(s, 1)).toBe('locked');
    finish(s, chapterLevelIds(0));
    expect(chapterState(s, 0)).toBe('done');
    expect(chapterState(s, 1)).toBe('open');
    expect(chapterState(s, 2)).toBe('locked');
    finish(s, chapterLevelIds(1), 3);
    expect(chapterState(s, 1)).toBe('done');
    expect(chapterState(s, 2)).toBe('open');
    expect(chaptersDone(s)).toBe(1);
    expect(chapterStars(s, 1)).toBe(36);
    expect(totalStars(s)).toBe(8 + 36);
  });

  it('séquence de déblocage : une seule fois par chapitre', () => {
    const s = finish(emptySave(), [...chapterLevelIds(0), ...chapterLevelIds(1)]);
    expect(pendingUnlock(s)).toBe(2);
    s.seen[announceKey(2)] = true;
    expect(pendingUnlock(s)).toBeNull();
  });

  it('chapitre courant : premier niveau ouvert non fini', () => {
    const order = [...chapterLevelIds(0), ...chapterLevelIds(1)];
    const s = emptySave();
    expect(currentChapter(s, order)).toBe(0);
    finish(s, chapterLevelIds(0));
    expect(currentChapter(s, order)).toBe(1);
    finish(s, chapterLevelIds(1));
    // Plus aucun niveau à jouer dans le catalogue : dernier chapitre ouvert (le 2).
    expect(currentChapter(s, order)).toBe(2);
  });
});
