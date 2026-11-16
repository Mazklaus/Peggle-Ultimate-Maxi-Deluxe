import { describe, expect, it } from 'vitest';
import { parseLevel, serializeLevel, type LevelData } from '../src/core/levelFormat';

const sample = {
  format: 1,
  id: 'ch1-03',
  chapter: 1,
  index: 3,
  companion: 'pip',
  companionLocked: true,
  title: 'Premiers rebonds',
  rhythm: 'decouverte',
  orbs: 10,
  stars: [12000, 30000],
  assign: { hearts: 1, power: 0, bonus: 1 },
  pegs: [
    { x: 120, y: 200 },
    { x: 160, y: 200, kind: 'heart' },
    { x: 300, y: 320, shape: 'brick', w: 40, h: 12, angle: 30 },
    { x: 400, y: 400, kind: 'wall' },
  ],
  decor: [],
};

function errorsOf(patch: Record<string, unknown>): string[] {
  const r = parseLevel({ ...sample, ...patch });
  return r.errors ?? [];
}

describe('format de niveau v1', () => {
  it("accepte l'exemple du document", () => {
    const r = parseLevel(JSON.stringify(sample));
    expect(r.errors).toBeUndefined();
    expect(r.level?.pegs).toHaveLength(4);
    expect(r.level?.pegs[2]).toEqual({ x: 300, y: 320, shape: 'brick', w: 40, h: 12, angle: 30 });
  });

  it('applique les valeurs par défaut et ignore les champs inconnus', () => {
    const r = parseLevel({
      format: 1,
      id: 'pro-01',
      stars: [1, 2],
      assign: { hearts: 1 },
      pegs: [{ x: 10, y: 100 }],
      foo: 1,
    });
    expect(r.level).toMatchObject({
      chapter: 0,
      index: 1,
      companion: null,
      companionLocked: false,
      orbs: 10,
    });
    expect(r.level).not.toHaveProperty('foo');
  });

  it('refuse un JSON cassé ou un autre format', () => {
    expect(parseLevel('{').errors?.[0]).toContain('JSON invalide');
    expect(parseLevel({ ...sample, format: 2 }).errors?.[0]).toContain('format');
  });

  it('refuse les pegs hors zone', () => {
    expect(errorsOf({ pegs: [{ x: 100, y: 50, kind: 'heart' }] }).join()).toContain('hors zone');
    expect(errorsOf({ pegs: [{ x: 900, y: 300, kind: 'heart' }] }).join()).toContain('hors zone');
    expect(errorsOf({ pegs: [{ x: 100, y: 610, kind: 'heart' }] }).join()).toContain('hors zone');
  });

  it('impose 22 px entre deux cercles, pas entre briques', () => {
    expect(
      errorsOf({
        assign: {},
        pegs: [
          { x: 100, y: 100, kind: 'heart' },
          { x: 120, y: 100 },
        ],
      }).join(),
    ).toContain('trop proches');
    expect(
      errorsOf({
        assign: {},
        pegs: [
          { x: 100, y: 100, kind: 'heart' },
          { x: 122, y: 100 },
        ],
      }),
    ).toEqual([]);
    const bricks = [
      { x: 100, y: 100, shape: 'brick', w: 40, h: 12, kind: 'heart' },
      { x: 110, y: 100, shape: 'brick', w: 40, h: 12 },
    ];
    expect(errorsOf({ assign: {}, pegs: bricks })).toEqual([]);
  });

  it('vérifie assign, le cœur obligatoire et les étoiles', () => {
    expect(errorsOf({ assign: { hearts: 5 } }).join()).toContain('assign demande');
    expect(errorsOf({ assign: {}, pegs: [{ x: 100, y: 100 }] }).join()).toContain('cœur');
    expect(errorsOf({ stars: [30000, 12000] }).join()).toContain('croissants');
  });

  it('refuse les valeurs inconnues', () => {
    expect(errorsOf({ companion: 'zorg' }).join()).toContain('companion');
    expect(errorsOf({ rhythm: 'vite' }).join()).toContain('rhythm');
    expect(errorsOf({ pegs: [{ x: 100, y: 100, kind: 'gold' }] }).join()).toContain('kind');
    expect(
      errorsOf({ pegs: [{ x: 100, y: 100, shape: 'brick', kind: 'heart' }] }).join(),
    ).toContain('brique');
  });

  it('sérialise puis relit sans perte, un peg par ligne', () => {
    const level = parseLevel(sample).level as LevelData;
    const text = serializeLevel(level);
    expect(text).toContain('\n    {"x": 120, "y": 200},\n');
    expect(parseLevel(text).level).toEqual(level);
  });

  it('réécrit les niveaux du dépôt à l’identique', () => {
    const files = import.meta.glob<string>('../public/levels/*.json', {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    expect(Object.keys(files).length).toBeGreaterThan(1);
    for (const [name, text] of Object.entries(files)) {
      if (name.endsWith('index.json')) continue;
      const level = parseLevel(text).level as LevelData;
      expect(serializeLevel(level), name).toBe(text);
    }
  });
});
