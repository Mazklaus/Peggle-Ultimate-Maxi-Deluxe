/**
 * Guide de visée court : simule la chute de l'orbe pas à pas jusqu'au premier contact
 * (mur ou cristal). Approximation du pas Matter.js (vitesse en px par pas, gravité en px/pas²).
 */
export interface Circle {
  x: number;
  y: number;
  r: number;
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
    const hit = input.obstacles.some((o) => Math.hypot(o.x - x, o.y - y) <= o.r + input.radius);
    if (hit) break;
  }
  return points;
}

export interface PredictInput extends TrajectoryInput {
  /** Restitution des rebonds (Matter prend le max des deux corps). */
  restitution: number;
  maxBounces: number;
}

/**
 * Trajectoire révélée (pouvoir de Pip) : simule les rebonds sur les murs et les cristaux,
 * jusqu'au n-ième rebond ou à maxSteps pas. Approximation de Matter, sans effet sur la physique.
 */
export function predictPath(input: PredictInput): {
  points: { x: number; y: number }[];
  bounces: { x: number; y: number }[];
} {
  let { x, y, vx, vy } = input;
  const points = [{ x, y }];
  const bounces: { x: number; y: number }[] = [];
  const maxSteps = input.maxSteps ?? 90;
  const e = input.restitution;
  let lastHit: Circle | null = null;
  for (let i = 0; i < maxSteps && bounces.length < input.maxBounces; i++) {
    vy += input.gravity;
    x += vx;
    y += vy;
    if (x - input.radius <= input.minX && vx < 0) {
      x = input.minX + input.radius;
      vx = -vx * e;
      bounces.push({ x, y });
    } else if (x + input.radius >= input.maxX && vx > 0) {
      x = input.maxX - input.radius;
      vx = -vx * e;
      bounces.push({ x, y });
    }
    if (y >= input.maxY) {
      points.push({ x, y });
      break;
    }
    for (const o of input.obstacles) {
      const dx = x - o.x;
      const dy = y - o.y;
      const dist = Math.hypot(dx, dy);
      const min = o.r + input.radius;
      if (dist >= min || dist === 0) continue;
      const nx = dx / dist;
      const ny = dy / dist;
      const vn = vx * nx + vy * ny;
      // Repousse hors du cristal, puis réfléchit la composante normale.
      x = o.x + nx * min;
      y = o.y + ny * min;
      if (vn < 0) {
        vx -= (1 + e) * vn * nx;
        vy -= (1 + e) * vn * ny;
        if (o !== lastHit) bounces.push({ x, y });
        lastHit = o;
      }
      break;
    }
    points.push({ x, y });
  }
  return { points, bounces };
}
