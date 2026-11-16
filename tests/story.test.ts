import { describe, expect, it } from 'vitest';
import { endSequenceFor, parseSequence, sequenceChapter, wakeSequenceFor } from '../src/core/story';

describe('vignettes de l’histoire', () => {
  it('réveil au niveau 1 de chaque chapitre', () => {
    expect(wakeSequenceFor('ch1-01')).toBe('reveil_pip');
    expect(wakeSequenceFor('ch2-01')).toBe('reveil_ch2');
    expect(wakeSequenceFor('ch8-01')).toBe('reveil_ch8');
    expect(wakeSequenceFor('ch2-02')).toBeNull();
    expect(wakeSequenceFor('pro-01')).toBeNull();
  });

  it('fin de chapitre au niveau 12', () => {
    expect(endSequenceFor('ch1-12')).toBe('fin_ch1');
    expect(endSequenceFor('ch5-12')).toBe('fin_ch5');
    expect(endSequenceFor('ch5-11')).toBeNull();
  });

  it('séquences de test par URL', () => {
    expect(parseSequence('fin_ch8')).toBe('fin_ch8');
    expect(parseSequence('reveil_ch3')).toBe('reveil_ch3');
    expect(parseSequence('intro')).toBe('intro');
    expect(parseSequence('fin_ch9')).toBeNull();
    expect(parseSequence(null)).toBeNull();
  });

  it('chapitre d’une séquence du jalon 2', () => {
    expect(sequenceChapter('reveil_ch4')).toBe(4);
    expect(sequenceChapter('fin_ch1')).toBeNull();
  });
});
