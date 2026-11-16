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
