import { describe, expect, it } from 'vitest';
import { pegPoints } from '../src/core/score';

describe('pegPoints', () => {
  it('donne les points de base au premier peg', () => {
    expect(pegPoints('normal', 0)).toBe(10);
    expect(pegPoints('target', 1)).toBe(100);
  });

  it('multiplie par le nombre de pegs touchés', () => {
    expect(pegPoints('normal', 3)).toBe(30);
  });
});
