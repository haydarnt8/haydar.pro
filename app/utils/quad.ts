/**
 * `matrix3d` laying a `width` x `height` box onto four corners (square-to-quad homography, Heckbert 1989).
 * Corners in the parent's px, clockwise from top-left; needs `transform-origin: 0 0`.
 */
export function quadMatrix(width: number, height: number, corners: [number, number][]): string {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = corners as [[number, number], [number, number], [number, number], [number, number]]

  const sx = x0 - x1 + x2 - x3
  const sy = y0 - y1 + y2 - y3
  let g = 0
  let h = 0
  // A parallelogram needs no perspective terms; anything else does.
  if (Math.abs(sx) > 1e-9 || Math.abs(sy) > 1e-9) {
    const dx1 = x1 - x2
    const dy1 = y1 - y2
    const dx2 = x3 - x2
    const dy2 = y3 - y2
    const det = dx1 * dy2 - dx2 * dy1
    g = (sx * dy2 - dx2 * sy) / det
    h = (dx1 * sy - sx * dy1) / det
  }
  const a = x1 - x0 + g * x1
  const b = x3 - x0 + h * x3
  const d = y1 - y0 + g * y1
  const e = y3 - y0 + h * y3

  // Column-major; dividing by width/height maps the unit square onto the box.
  const m = [
    a / width, d / width, 0, g / width,
    b / height, e / height, 0, h / height,
    0, 0, 1, 0,
    x0, y0, 0, 1,
  ]
  return `matrix3d(${m.map(n => Number(n.toFixed(9))).join(', ')})`
}
