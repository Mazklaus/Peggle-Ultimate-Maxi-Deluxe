import { describe, expect, it } from 'vitest';
import { awakeAstres, cutsceneCue } from '../src/core/audio/storyMusic';

describe("musique de l'histoire", () => {
  it('compte un Astre réveillé par chapitre terminé', () => {
    expect(awakeAstres(() => false)).toBe(0);
    expect(awakeAstres((c) => c <= 3)).toBe(3);
    expect(awakeAstres(() => true)).toBe(8);
  });

  it('intro : boîte à musique seule ; fin de chapitre N : le phare avec N voix', () => {
    expect(cutsceneCue('intro', 'A1', 0)).toEqual({ kind: 'phare', astres: 0 });
    expect(cutsceneCue('fin_ch1', 'B2', 0)).toEqual({ kind: 'phare', astres: 1 });
    expect(cutsceneCue('fin_ch5', 'F1', 0)).toEqual({ kind: 'phare', astres: 5 });
    expect(cutsceneCue('fin_ch5', 'F2', 1)).toBeNull();
    expect(cutsceneCue('reveil_ch3', 'R0', 0)).toBeNull();
  });

  it('final : silence au plan V1, réveil de la Veilleuse au plan V3', () => {
    expect(cutsceneCue('fin_ch8', 'F1', 0)).toEqual({ kind: 'phare', astres: 8 });
    expect(cutsceneCue('fin_ch8', 'V1', 5)).toEqual({ kind: 'silence' });
    expect(cutsceneCue('fin_ch8', 'V2', 6)).toBeNull();
    expect(cutsceneCue('fin_ch8', 'V3', 7)).toEqual({ kind: 'finale' });
    expect(cutsceneCue('fin_ch7', 'V3', 7)).toBeNull();
  });
});
