// A pen's ring round a box, in the picture's own pixels. Deterministic: the wobble comes from `seed`,
// never Math.random(), or the server and the client would draw different rings (hydration mismatch).
export type InkBox = [x: number, y: number, w: number, h: number]
export type InkPoint = [x: number, y: number]

export interface InkRing {
  d: string
  /** The outermost point on each side, where words can sit clear of it. */
  reach: { top: InkPoint, right: InkPoint, bottom: InkPoint, left: InkPoint }
}

/** 0 to 1, the same for the same seed and key. */
function noise(seed: number, key: number) {
  const s = Math.sin(seed * 12.9898 + key * 78.233) * 43758.5453
  return s - Math.floor(s)
}

const round = (n: number) => Math.round(n * 10) / 10

function smooth(points: InkPoint[]) {
  const at = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))]!
  let d = `M${round(points[0]![0])} ${round(points[0]![1])}`
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    const c1: InkPoint = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2: InkPoint = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${round(c1[0])} ${round(c1[1])} ${round(c2[0])} ${round(c2[1])} ${round(p2[0])} ${round(p2[1])}`
  }
  return d
}

export function inkRing([x, y, w, h]: InkBox, seed = 0): InkRing {
  const cx = x + w / 2
  const cy = y + h / 2

  // A superellipse with the smallest exponent that keeps the box's corners inside, so a long box gets a long loop.
  const margin = 14 + Math.min(Math.min(w, h) * 0.12, 30)
  const rx = w / 2 + margin
  const ry = h / 2 + margin
  let n = 2
  while (n < 8 && (w / 2 / rx) ** n + (h / 2 / ry) ** n > 0.85) n += 0.1

  const start = -Math.PI * 0.62 + (noise(seed, 1) - 0.5) * 0.5
  const fine: InkPoint[] = []
  const steps = 720
  for (let i = 0; i <= steps; i++) {
    const t = start + (i / steps) * Math.PI * 2
    const [cos, sin] = [Math.cos(t), Math.sin(t)]
    fine.push([rx * Math.sign(cos) * Math.abs(cos) ** (2 / n), ry * Math.sign(sin) * Math.abs(sin) ** (2 / n)])
  }

  // Spaced by distance along the curve, not by angle: a squarish curve spends its angle in the corners.
  const run = [0]
  for (let i = 1; i <= steps; i++) {
    run.push(run[i - 1]! + Math.hypot(fine[i]![0] - fine[i - 1]![0], fine[i]![1] - fine[i - 1]![1]))
  }
  const perimeter = run[steps]!

  const laps = 1.08
  const tilt = (noise(seed, 4) - 0.5) * 0.05
  const [p2, p3] = [noise(seed, 2) * 6, noise(seed, 3) * 6]
  const TAU = Math.PI * 2
  const points: InkPoint[] = []
  const samples = 80
  let j = 0
  for (let i = 0; i < samples; i++) {
    const u = (i / (samples - 1)) * laps
    const along = (u % 1) * perimeter
    if (along < run[j]!) j = 0
    while (j < steps - 1 && run[j + 1]! < along) j++
    const f = (along - run[j]!) / (run[j + 1]! - run[j]! || 1)
    const bx = fine[j]![0] + (fine[j + 1]![0] - fine[j]![0]) * f
    const by = fine[j]![1] + (fine[j + 1]![1] - fine[j]![1]) * f
    const drift = margin * (0.5 * (u / laps - 0.45) + 0.14 * Math.sin(2 * TAU * u + p2) + 0.09 * Math.sin(3 * TAU * u + p3))
    const k = 1 + drift / Math.hypot(bx, by)
    const [px, py] = [bx * k, by * k]
    points.push([
      cx + px * Math.cos(tilt) - py * Math.sin(tilt),
      cy + px * Math.sin(tilt) + py * Math.cos(tilt),
    ])
  }

  // Searched across the ring's middle only: a tilted loop's extreme point can sit off one end.
  const outermost = (axis: 0 | 1, sign: 1 | -1) => {
    const across = axis === 0 ? 1 : 0
    const [centre, radius] = across === 0 ? [cx, rx] : [cy, ry]
    return points
      .filter(p => Math.abs(p[across] - centre) <= radius * 0.25)
      .reduce((best, p) => (p[axis] * sign > best[axis] * sign ? p : best))
  }
  const reach = {
    top: outermost(1, -1),
    right: outermost(0, 1),
    bottom: outermost(1, 1),
    left: outermost(0, -1),
  }

  return { d: smooth(points), reach }
}
