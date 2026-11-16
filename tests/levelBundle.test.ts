import { describe, expect, it } from 'vitest';
import { buildLevelBundle, isLevelBundle } from '../src/core/levelBundle';
import { buildCatalog, parseExtraIndexes, parseIndex } from '../src/core/levelCatalog';

const files = import.meta.glob('../public/levels/*.json', { eager: true, import: 'default' });
const read = (file: string): unknown => files[`../public/levels/${file}`];

describe('paquet de niveaux (build)', () => {
  it('contient tous les niveaux livrés et donne le même catalogue', () => {
    const bundle = buildLevelBundle(read);
    expect(isLevelBundle(bundle)).toBe(true);
    const index = parseIndex(bundle.index).index!;
    const extras = parseExtraIndexes(bundle.extras).extras;
    const cat = buildCatalog(index, bundle.levels, extras);
    expect(cat.errors).toEqual([]);
    expect(cat.levels.length).toBe(100);
    expect(cat.challenges.length).toBe(24);
    expect(cat.duel.length).toBe(6);
  });

  it('reconnaît un paquet', () => {
    expect(isLevelBundle({ format: 1, index: {}, extras: {}, levels: {} })).toBe(true);
    expect(isLevelBundle('<html>')).toBe(false);
  });
});
