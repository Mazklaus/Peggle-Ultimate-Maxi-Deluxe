/**
 * Zones de bonus du tir final (GD, reglages-jalon1.md : « 3 zones sous le réceptacle au tir
 * final : 1 000 / 2 500 / 5 000 »). Disposition symétrique : la plus rentable au centre.
 */
export interface FinalZone {
  /** Bornes en fraction de la largeur de la zone de jeu (0..1). */
  from: number;
  to: number;
  points: number;
}

const LAYOUT: Array<[number, number]> = [
  [0.26, 1000],
  [0.17, 2500],
  [0.14, 5000],
  [0.17, 2500],
  [0.26, 1000],
];

export const FINAL_ZONES: FinalZone[] = (() => {
  let x = 0;
  return LAYOUT.map(([w, points]) => {
    const z = { from: x, to: x + w, points };
    x += w;
    return z;
  });
})();

/** Bonus de la zone où sort l'orbe final (xRatio = position / largeur de la zone de jeu). */
export function finalZoneAt(xRatio: number): { index: number; zone: FinalZone } {
  const r = Math.min(0.9999, Math.max(0, xRatio));
  const index = FINAL_ZONES.findIndex((z) => r >= z.from && r < z.to);
  const i = index < 0 ? FINAL_ZONES.length - 1 : index;
  return { index: i, zone: FINAL_ZONES[i] as FinalZone };
}
