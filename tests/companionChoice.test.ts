import { describe, expect, it } from 'vitest';
import { companionChoice } from '../src/core/companionChoice';

const roster = [
  { id: 'pip', def: {}, wakesAtChapter: 1 },
  { id: 'bourdon', def: {}, wakesAtChapter: 2 },
  { id: 'jumelles', def: null, wakesAtChapter: 3 },
  { id: 'volte', def: {}, wakesAtChapter: 4 },
];
const lvl = (companion: string | null, companionLocked = false) => ({ companion, companionLocked });

describe('choix de l’Astre', () => {
  it('prologue : pas d’Astre', () => {
    expect(companionChoice(lvl(null), roster, 1).selected).toBeNull();
  });

  it('un seul Astre réveillé : pastille non cliquable', () => {
    const c = companionChoice(lvl('pip'), roster, 1);
    expect(c).toMatchObject({ selected: 'pip', choices: ['pip'], canChoose: false });
  });

  it('niveau de découverte : Astre du chapitre imposé', () => {
    const c = companionChoice(lvl('bourdon', true), roster, 4, 'pip');
    expect(c).toMatchObject({ selected: 'bourdon', locked: true, canChoose: false });
  });

  it('préselection : dernier choisi, sinon l’Astre du chapitre ; non portés exclus', () => {
    expect(companionChoice(lvl('bourdon'), roster, 4).selected).toBe('bourdon');
    expect(companionChoice(lvl('bourdon'), roster, 4, 'volte').selected).toBe('volte');
    const c = companionChoice(lvl('jumelles'), roster, 4, 'jumelles');
    expect(c.choices).toEqual(['pip', 'bourdon', 'volte']);
    expect(c.selected).toBe('pip');
    expect(c.canChoose).toBe(true);
  });
});
