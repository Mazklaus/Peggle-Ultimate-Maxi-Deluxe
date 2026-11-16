/** Couleurs et styles provisoires (direction visuelle de la DA), partagés par les scènes. */
import type { CrystalKind } from '../core/level';

export const PALETTE = {
  night: 0x0b1026,
  nightLight: 0x141b3d,
  panel: 0x1b2350,
  lit: 0xfff6e0,
  orb: 0xfff6e0,
  bucket: 0xb9a6ff,
  cannon: 0x8c93c9,
  accent: 0xb9a6ff,
  alert: 0xff7a6b,
  border: 0x2e3870,
};

export const CRYSTAL_COLORS: Record<CrystalKind, number> = {
  heart: 0xffb23f,
  common: 0x6fcbff,
  bonus: 0xff5fa2,
  power: 0x4ff0a8,
  wall: 0x6f78b8,
};

/** Mode daltonien (Okabe-Ito) : formes inchangées, couleurs remplacées. */
export const CRYSTAL_COLORS_CB: Record<CrystalKind, number> = {
  heart: 0xe69f00,
  common: 0x56b4e9,
  bonus: 0xcc79a7,
  power: 0xf0e442,
  wall: 0x6f78b8,
};

export const TEXT = {
  main: '#F4F1FF',
  dim: '#A9B0D6',
  font: 'Fredoka, Nunito, sans-serif',
};

export function textStyle(
  size: number,
  color = TEXT.main,
): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: TEXT.font, fontSize: `${size}px`, color };
}
