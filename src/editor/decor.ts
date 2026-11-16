/**
 * Éléments de décor (format v2) dans l'éditeur, sans DOM : création, poignées,
 * déplacement d'un élément avec ses pegs, aperçu animé.
 */
import {
  orbitPosition,
  type DecorItem,
  type DecorOrbit,
  type DecorType,
  type LevelPeg,
  type Point,
} from '../core/levelFormat';

/** Identifiant libre : rotate-1, rotate-2… */
export function nextDecorId(decor: readonly DecorItem[], type: DecorType): string {
  const used = new Set(decor.map((d) => d.id));
  let n = 1;
  while (used.has(`${type}-${n}`)) n++;
  return `${type}-${n}`;
}

/** Élément avec des réglages par défaut dans les bornes du format. */
export function newDecor(type: DecorType, id: string, at: Point): DecorItem {
  const { x, y } = at;
  switch (type) {
    case 'rotate':
      return { id, type, cx: x, cy: y, periodS: 12, dir: 1 };
    case 'orbit':
      return { id, type, cx: x, cy: y, rx: 60, ry: 60, periodS: 6, dir: 1 };
    case 'magnet':
      return { id, type, x, y, radius: 110, strength: 1 };
    case 'portal':
      return { id, type, a: { x: x - 120, y }, b: { x: x + 120, y } };
    case 'regen':
      return { id, type, shots: 2 };
  }
}

export interface Handle {
  key: 'c' | 'a' | 'b';
  x: number;
  y: number;
}

/** Points déplaçables à la souris (centre, ou entrées A et B d'un portail). */
export function decorHandles(d: DecorItem): Handle[] {
  switch (d.type) {
    case 'rotate':
    case 'orbit':
      return [{ key: 'c', x: d.cx, y: d.cy }];
    case 'magnet':
      return [{ key: 'c', x: d.x, y: d.y }];
    case 'portal':
      return [
        { key: 'a', x: d.a.x, y: d.a.y },
        { key: 'b', x: d.b.x, y: d.b.y },
      ];
    case 'regen':
      return [];
  }
}

export function handleAt(
  decor: readonly DecorItem[],
  x: number,
  y: number,
  tolerance = 12,
): { index: number; key: Handle['key'] } | null {
  for (let i = decor.length - 1; i >= 0; i--)
    for (const h of decorHandles(decor[i] as DecorItem))
      if (Math.hypot(h.x - x, h.y - y) <= tolerance) return { index: i, key: h.key };
  return null;
}

/** Déplace une poignée ; un centre de rotation ou d'orbite emmène les pegs de son groupe. */
export function moveHandle(d: DecorItem, key: Handle['key'], to: Point, pegs: LevelPeg[]): void {
  if (d.type === 'rotate' || d.type === 'orbit') {
    const dx = to.x - d.cx;
    const dy = to.y - d.cy;
    d.cx = to.x;
    d.cy = to.y;
    for (const p of pegs)
      if (p.group === d.id) {
        p.x = Math.round(p.x + dx);
        p.y = Math.round(p.y + dy);
      }
  } else if (d.type === 'magnet') {
    d.x = to.x;
    d.y = to.y;
  } else if (d.type === 'portal') {
    d[key === 'b' ? 'b' : 'a'] = { x: to.x, y: to.y };
  }
}

/** Point de l'anneau d'une orbite le plus proche (même angle paramétrique). */
export function snapToOrbit(o: DecorOrbit, x: number, y: number): Point {
  const a = Math.atan2((y - o.cy) / o.ry, (x - o.cx) / o.rx);
  return { x: Math.round(o.cx + o.rx * Math.cos(a)), y: Math.round(o.cy + o.ry * Math.sin(a)) };
}

/** Recolle sur l'anneau les pegs d'une orbite (après un changement de rx / ry). */
export function snapOrbitMembers(o: DecorOrbit, pegs: LevelPeg[]): void {
  for (const p of pegs) if (p.group === o.id) Object.assign(p, snapToOrbit(o, p.x, p.y));
}

/** Renomme un élément et met à jour les pegs qui s'y rattachent. */
export function renameDecor(d: DecorItem, id: string, pegs: LevelPeg[]): void {
  for (const p of pegs) if (p.group === d.id) p.group = id;
  d.id = id;
}

/** Supprime un élément ; ses pegs redeviennent fixes. */
export function removeDecor(decor: DecorItem[], index: number, pegs: LevelPeg[]): void {
  const [d] = decor.splice(index, 1);
  if (d) for (const p of pegs) if (p.group === d.id) delete p.group;
}

/** Position d'un peg à l'instant `seconds` (aperçu animé de l'éditeur). */
export function animatedPosition(p: LevelPeg, d: DecorItem | undefined, seconds: number): Point {
  if (d?.type === 'rotate') {
    const a = (d.dir * 2 * Math.PI * seconds) / d.periodS;
    const dx = p.x - d.cx;
    const dy = p.y - d.cy;
    return {
      x: d.cx + dx * Math.cos(a) - dy * Math.sin(a),
      y: d.cy + dx * Math.sin(a) + dy * Math.cos(a),
    };
  }
  if (d?.type === 'orbit') return orbitPosition(d, p, seconds / d.periodS);
  return { x: p.x, y: p.y };
}
