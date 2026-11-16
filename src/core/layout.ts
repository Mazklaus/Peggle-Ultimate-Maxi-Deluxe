/** Disposition provisoire des cristaux : grille en quinconce (placeholder, pas un vrai niveau). */
export function staggeredGrid(
  rows: number,
  cols: number,
  originX: number,
  originY: number,
  spacingX: number,
  spacingY: number,
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : spacingX / 2;
    for (let c = 0; c < cols; c++) {
      out.push({ x: originX + offset + c * spacingX, y: originY + r * spacingY });
    }
  }
  return out;
}
