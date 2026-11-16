/**
 * Guide de visée court : simule la chute de l'orbe pas à pas jusqu'au premier contact
 * (mur ou cristal). Approximation du pas Matter.js (vitesse en px par pas, gravité en px/pas²).
 */
export interface Circle {
  x: number;
  y: number;
  r: number;
  /**
   * Brique : capsule de rayon r autour du segment (ax, ay) - (bx, by) ; x, y = son centre.
   * Une seule normale le long de la brique, comme le rectangle de Matter.
   */
  seg?: { ax: number; ay: number; bx: number; by: number };
}

/** Point de l'obstacle le plus proche de (x, y) : son centre, ou la projection sur sa brique. */
export function closestPoint(o: Circle, x: number, y: number): { x: number; y: number } {
  const s = o.seg;
  if (!s) return { x: o.x, y: o.y };
  const dx = s.bx - s.ax;
  const dy = s.by - s.ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - s.ax) * dx + (y - s.ay) * dy) / len2));
  return { x: s.ax + dx * t, y: s.ay + dy * t };
}

/** Distance entre (x, y) et l'obstacle, rayon compris (négative si contact). */
function gapTo(o: Circle, x: number, y: number): number {
  const c = closestPoint(o, x, y);
  return Math.hypot(x - c.x, y - c.y) - o.r;
}

export interface TrajectoryInput {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  radius: number;
  minX: number;
  maxX: number;
  maxY: number;
  obstacles: ReadonlyArray<Circle>;
  maxSteps?: number;
}

export function aimGuide(input: TrajectoryInput): { x: number; y: number }[] {
  const { vx } = input;
  let { x, y, vy } = input;
  const points = [{ x, y }];
  const maxSteps = input.maxSteps ?? 300;
  for (let i = 0; i < maxSteps; i++) {
    vy += input.gravity;
    x += vx;
    y += vy;
    points.push({ x, y });
    if (x - input.radius <= input.minX || x + input.radius >= input.maxX || y >= input.maxY) break;
    const hit = input.obstacles.some((o) => gapTo(o, x, y) <= input.radius);
    if (hit) break;
  }
  return points;
}

export interface PredictInput extends TrajectoryInput {
  /** Restitution des rebonds (Matter prend le max des deux corps). */
  restitution: number;
  /** Restitution sur les murs (défaut : restitution). */
  wallRestitution?: number;
  maxBounces: number;
  /** Cible : la simulation s'arrête au premier contact avec elle (voir contactStep). */
  target?: Circle;
  /** Sous-pas par pas de référence (la physique du jeu tourne à 120 pas/s : 2). */
  substeps?: number;
  /** Champ de force du décor (aimants), en px par pas de référence au carré. */
  field?: (x: number, y: number) => { ax: number; ay: number };
}

/**
 * Trajectoire révélée (pouvoir de Pip) : simule les rebonds sur les murs et les cristaux,
 * jusqu'au n-ième rebond ou à maxSteps pas. Approximation de Matter, sans effet sur la physique.
 */
export function predictPath(input: PredictInput): {
  points: { x: number; y: number }[];
  bounces: { x: number; y: number }[];
  /** Pas de simulation au contact avec input.target, ou null s'il n'a pas lieu. */
  contactStep: number | null;
} {
  let { x, y, vx, vy } = input;
  const points = [{ x, y }];
  const bounces: { x: number; y: number }[] = [];
  const maxSteps = input.maxSteps ?? 90;
  const e = input.restitution;
  const ew = input.wallRestitution ?? e;
  const target = input.target;
  const n = Math.max(1, Math.round(input.substeps ?? 1));
  const g = input.gravity / n;
  let lastHit: Circle | null = null;
  for (let i = 0; i < maxSteps && bounces.length < input.maxBounces; i++) {
    for (let k = 0; k < n; k++) {
      // Sous-pas : vitesses en px par pas de référence, déplacement divisé par n.
      vy += g;
      if (input.field) {
        const f = input.field(x, y);
        vx += f.ax / n;
        vy += f.ay / n;
      }
      x += vx / n;
      y += vy / n;
      if (x - input.radius <= input.minX && vx < 0) {
        x = input.minX + input.radius;
        vx = -vx * ew;
        bounces.push({ x, y });
      } else if (x + input.radius >= input.maxX && vx > 0) {
        x = input.maxX - input.radius;
        vx = -vx * ew;
        bounces.push({ x, y });
      }
      if (y >= input.maxY) {
        points.push({ x, y });
        return { points, bounces, contactStep: null };
      }
      if (target && gapTo(target, x, y) <= input.radius) {
        points.push({ x, y });
        return { points, bounces, contactStep: i + (k + 1) / n };
      }
      for (const o of input.obstacles) {
        const c = closestPoint(o, x, y);
        const dx = x - c.x;
        const dy = y - c.y;
        const dist = Math.hypot(dx, dy);
        const min = o.r + input.radius;
        if (dist >= min || dist === 0) continue;
        const nx = dx / dist;
        const ny = dy / dist;
        const vn = vx * nx + vy * ny;
        // Repousse hors de l'obstacle, puis réfléchit la composante normale.
        x = c.x + nx * min;
        y = c.y + ny * min;
        if (vn < 0) {
          vx -= (1 + e) * vn * nx;
          vy -= (1 + e) * vn * ny;
          if (o !== lastHit) bounces.push({ x, y });
          lastHit = o;
        }
        break;
      }
    }
    points.push({ x, y });
  }
  return { points, bounces, contactStep: null };
}

/** Écarts testés par robustContactStep (Matter ne rebondit pas exactement comme le modèle). */
export const ROBUST_CONTACT = { restitutionSpread: 0.15, angleSpreadDeg: 2.5 };

/**
 * Contact sûr avec input.target : le pas de contact nominal, seulement si la cible est
 * encore touchée quand on varie un peu la restitution et l'angle de départ ; sinon null.
 * Sert au ralenti final : mieux vaut un ralenti manqué (le vrai contact le relance) qu'un
 * faux ralenti sur un tir qui rate.
 */
export function robustContactStep(input: PredictInput): number | null {
  const nominal = predictPath(input).contactStep;
  if (nominal === null) return null;
  const { restitutionSpread: de, angleSpreadDeg } = ROBUST_CONTACT;
  const da = (angleSpreadDeg * Math.PI) / 180;
  const rotate = (a: number) => ({
    vx: input.vx * Math.cos(a) - input.vy * Math.sin(a),
    vy: input.vx * Math.sin(a) + input.vy * Math.cos(a),
  });
  const variants: PredictInput[] = [
    { ...input, restitution: Math.max(0, input.restitution - de) },
    { ...input, restitution: Math.min(1, input.restitution + de) },
    { ...input, ...rotate(da) },
    { ...input, ...rotate(-da) },
  ];
  // Un peu de marge de pas : un rebond un brin différent arrive un peu plus tard.
  const extra = Math.ceil((input.maxSteps ?? 90) * 0.25);
  for (const v of variants) {
    if (predictPath({ ...v, maxSteps: (v.maxSteps ?? 90) + extra }).contactStep === null)
      return null;
  }
  return nominal;
}
