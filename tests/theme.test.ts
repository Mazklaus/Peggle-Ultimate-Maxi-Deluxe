import { describe, expect, it } from 'vitest';
import { CRYSTAL_COLORS_CB, PALETTE, powerColor, setColorblindPower } from '../src/scenes/theme';

describe('couleur des pouvoirs', () => {
  it('menthe en mode normal, jaune Okabe-Ito du cristal pouvoir en mode daltonien', () => {
    setColorblindPower(false);
    expect(powerColor()).toBe(PALETTE.success);
    setColorblindPower(true);
    expect(powerColor()).toBe(CRYSTAL_COLORS_CB.power);
    setColorblindPower(false);
  });
});
