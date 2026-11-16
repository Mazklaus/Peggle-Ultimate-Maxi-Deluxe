import { describe, expect, it } from 'vitest';
import { memoryCount, memoryRows, metAstres } from '../src/core/memories';

describe('galerie des souvenirs', () => {
  it('ordre de l’histoire : intro, réveils, puis fins', () => {
    const [top, bottom] = memoryRows({});
    expect(top.map((e) => e.sequence)).toEqual([
      'intro',
      'reveil_pip',
      'reveil_ch2',
      'reveil_ch3',
      'reveil_ch4',
      'reveil_ch5',
      'reveil_ch6',
      'reveil_ch7',
      'reveil_ch8',
    ]);
    expect(bottom.map((e) => e.sequence)[0]).toBe('fin_ch1');
    expect(bottom.map((e) => e.sequence)[7]).toBe('fin_ch8');
    expect(top.every((e) => !e.seen)).toBe(true);
  });

  it('débloqués selon save.seen', () => {
    const seen = { intro: true, reveil_pip: true, fin_ch1: true, annonce_ch2: true };
    const [top, bottom] = memoryRows(seen);
    expect(top[0]?.seen).toBe(true);
    expect(top[1]?.seen).toBe(true);
    expect(top[2]?.seen).toBe(false);
    expect(bottom[0]?.seen).toBe(true);
    expect(memoryCount(seen)).toEqual({ seen: 3, total: 17 });
    expect(metAstres(seen)).toEqual([true, false, false, false, false, false, false, false]);
  });
});
