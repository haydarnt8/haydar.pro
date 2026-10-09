import { media, snake as S } from '~/config/motion'

// One rope of ink riding the borders of a group of cards: its body is the path the head has travelled, trimmed to a fixed length.
// Never write inline styles here: tests read `style` to detect leftover motion, so geometry is the `d` attribute and the fade a class.
// No scroll listener needed: cards are cached in page coordinates and the pointer is read as pageX/pageY, so a scroll cancels out.

interface CardBox {
  x: number
  y: number
  w: number
  h: number
  r: number
}

/** Normalised units for one lap of a card's outline. */
const TURN = 1000

// Blink draws rounded-rect corners as cubics ~0.65% shorter than pi*r/2; our arcs use the same factor
// so a computed bearing stays on the rendered path. Scale-invariant, so one probe serves every card.
let CORNER = 1

function measureCorner(svg: SVGSVGElement) {
  try {
    const probe = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    for (const [k, v] of Object.entries({ x: 0, y: 0, width: 240, height: 120, rx: 24, ry: 24 })) {
      probe.setAttribute(k, String(v))
    }
    svg.append(probe)
    const measured = probe.getTotalLength()
    probe.remove()
    const k = (measured - 2 * 192 - 2 * 72) / (2 * Math.PI * 24)
    if (k > 0.9 && k < 1.1) CORNER = k
  }
  catch {
    CORNER = 1
  }
}

const clamp = (n: number, lo: number, hi: number) => (n < lo ? lo : n > hi ? hi : n)

function metrics(c: CardBox) {
  const lx = c.w - 2 * c.r
  const ly = c.h - 2 * c.r
  const arc = CORNER * (Math.PI / 2) * c.r
  return { lx, ly, arc, perimeter: 2 * lx + 2 * ly + 4 * arc }
}

function distanceTo(c: CardBox, px: number, py: number) {
  const dx = Math.max(c.x - px, 0, px - (c.x + c.w))
  const dy = Math.max(c.y - py, 0, py - (c.y + c.h))
  return Math.hypot(dx, dy)
}

const TOP = 0
const RIGHT = 1
const BOTTOM = 2
const LEFT = 3

function delta(from: number, to: number) {
  const d = ((to - (((from % TURN) + TURN) % TURN)) % TURN + TURN) % TURN
  return d > TURN / 2 ? d - TURN : d
}

/**
 * The pointer's nearest point on the outline as a bearing (0-1000), clockwise from `(x + r, y)`, where SVG starts a rounded rect.
 * `hold` keeps the chosen side until another is nearer by `snake.edge`: inside a card the sides tie on the diagonals and would flip half a lap.
 */
function project(c: CardBox, px: number, py: number, hold?: { side: number }) {
  const { lx, ly, arc, perimeter } = metrics(c)
  if (perimeter <= 0) return 0

  const x0 = c.x + c.r
  const x1 = c.x + c.w - c.r
  const y0 = c.y + c.r
  const y1 = c.y + c.h - c.r

  const qx = px < x0 ? -1 : px > x1 ? 1 : 0
  const qy = py < y0 ? -1 : py > y1 ? 1 : 0

  const top = 0
  const topRight = lx
  const right = lx + arc
  const bottomRight = lx + arc + ly
  const bottom = lx + 2 * arc + ly
  const bottomLeft = 2 * lx + 2 * arc + ly
  const left = 2 * lx + 3 * arc + ly
  const topLeft = 2 * lx + 3 * arc + 2 * ly

  let s: number

  if (qx !== 0 && qy !== 0) {
    const cx = qx > 0 ? x1 : x0
    const cy = qy > 0 ? y1 : y0
    const base = qy < 0
      ? (qx > 0 ? topRight : topLeft)
      : (qx > 0 ? bottomRight : bottomLeft)
    const from = qy < 0
      ? (qx > 0 ? -Math.PI / 2 : Math.PI)
      : (qx > 0 ? 0 : Math.PI / 2)

    const dx = px - cx
    const dy = py - cy
    if (dx === 0 && dy === 0) {
      s = base
    }
    else {
      const t = (((Math.atan2(dy, dx) - from) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
      s = base + arc * Math.min(t / (Math.PI / 2), 1)
    }
  }
  else if (qx === 0 && qy !== 0) {
    // Record the side, so a pointer that dips outside and back resumes on it.
    if (hold) hold.side = qy < 0 ? TOP : BOTTOM
    s = qy < 0 ? top + (px - x0) : bottom + (x1 - px)
  }
  else if (qy === 0 && qx !== 0) {
    if (hold) hold.side = qx > 0 ? RIGHT : LEFT
    s = qx > 0 ? right + (py - y0) : left + (y1 - py)
  }
  else {
    const away = [py - c.y, c.x + c.w - px, c.y + c.h - py, px - c.x]
    let side = TOP
    for (let k = RIGHT; k <= LEFT; k++) if (away[k]! < away[side]!) side = k
    if (hold && hold.side >= 0 && hold.side !== side && away[hold.side]! - away[side]! < S.edge) {
      side = hold.side
    }
    if (hold) hold.side = side
    s = side === TOP
      ? top + (px - x0)
      : side === RIGHT
        ? right + (py - y0)
        : side === BOTTOM
          ? bottom + (x1 - px)
          : left + (y1 - py)
  }

  return (s / perimeter) * TURN
}

/** The inverse of `project`, and the rope's only source of geometry. */
function pointAt(c: CardBox, u: number) {
  const { lx, ly, arc, perimeter } = metrics(c)
  const x0 = c.x + c.r
  const x1 = c.x + c.w - c.r
  const y0 = c.y + c.r
  const y1 = c.y + c.h - c.r
  let s = (((u % TURN) + TURN) % TURN) / TURN * perimeter

  if (s <= lx) return { x: x0 + s, y: c.y }
  s -= lx
  if (s <= arc) {
    const t = arc > 0 ? (s / arc) * (Math.PI / 2) : 0
    return { x: x1 + c.r * Math.sin(t), y: y0 - c.r * Math.cos(t) }
  }
  s -= arc
  if (s <= ly) return { x: c.x + c.w, y: y0 + s }
  s -= ly
  if (s <= arc) {
    const t = arc > 0 ? (s / arc) * (Math.PI / 2) : 0
    return { x: x1 + c.r * Math.cos(t), y: y1 + c.r * Math.sin(t) }
  }
  s -= arc
  if (s <= lx) return { x: x1 - s, y: c.y + c.h }
  s -= lx
  if (s <= arc) {
    const t = arc > 0 ? (s / arc) * (Math.PI / 2) : 0
    return { x: x0 - c.r * Math.sin(t), y: y1 + c.r * Math.cos(t) }
  }
  s -= arc
  if (s <= ly) return { x: c.x, y: y1 - s }
  s -= ly
  const t = arc > 0 ? (s / arc) * (Math.PI / 2) : 0
  return { x: x0 - c.r * Math.cos(t), y: y0 - c.r * Math.sin(t) }
}

function radiusOf(card: Element, w: number, h: number) {
  const first = getComputedStyle(card).borderTopLeftRadius.split(' ')[0] ?? '0'
  const n = first.endsWith('%') ? (Number.parseFloat(first) / 100) * w : Number.parseFloat(first)
  return Math.max(0, Math.min(Number.isFinite(n) ? n : 0, w / 2, h / 2))
}

// Neighbours face each other across a gutter; corner-to-corner does not count, or paths would cut diagonally across the grid.
function touching(a: CardBox, b: CardBox) {
  const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  const gapX = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w)
  const gapY = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h)
  const side = overlapY >= S.grid.overlap && gapX >= -1 && gapX <= S.grid.gap
  const stack = overlapX >= S.grid.overlap && gapY >= -1 && gapY <= S.grid.gap
  return side || stack
}

interface Rung {
  i: number
  j: number
  ax: number
  ay: number
  bx: number
  by: number
  au: number
  bu: number
  len: number
  a: number
  b: number
}

// Feet land on straight runs only, so `project` is exact; null when only the rounded corners overlap. Oriented from `a` to `b`.
function rungBetween(i: number, j: number, a: CardBox, b: CardBox): Omit<Rung, 'a' | 'b'> | null {
  const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  const gapX = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w)
  const gapY = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h)

  let ax: number, ay: number, bx: number, by: number

  if (overlapY >= S.grid.overlap && gapX >= -1 && gapX <= S.grid.gap) {
    const low = Math.max(a.y + a.r, b.y + b.r) + S.bridge.gap / 2
    const high = Math.min(a.y + a.h - a.r, b.y + b.h - b.r) - S.bridge.gap / 2
    if (low > high) return null
    const mid = (Math.max(a.y, b.y) + Math.min(a.y + a.h, b.y + b.h)) / 2
    ay = by = clamp(mid, low, high)
    ax = a.x < b.x ? a.x + a.w : a.x
    bx = a.x < b.x ? b.x : b.x + b.w
  }
  else if (overlapX >= S.grid.overlap && gapY >= -1 && gapY <= S.grid.gap) {
    const low = Math.max(a.x + a.r, b.x + b.r) + S.bridge.gap / 2
    const high = Math.min(a.x + a.w - a.r, b.x + b.w - b.r) - S.bridge.gap / 2
    if (low > high) return null
    const mid = (Math.max(a.x, b.x) + Math.min(a.x + a.w, b.x + b.w)) / 2
    ax = bx = clamp(mid, low, high)
    ay = a.y < b.y ? a.y + a.h : a.y
    by = a.y < b.y ? b.y : b.y + b.h
  }
  else {
    return null
  }

  const len = Math.hypot(bx - ax, by - ay)

  return {
    i,
    j,
    ax,
    ay,
    bx,
    by,
    au: project(a, ax, ay),
    bu: project(b, bx, by),
    len,
  }
}

interface Gate {
  card: number
  u: number
  twin: number
  rung: Rung
}

function rungToFrame(i: number, j: number, c: CardBox, f: CardBox): Omit<Rung, 'a' | 'b'> | null {
  const away = [c.y - f.y, c.x - f.x, f.y + f.h - (c.y + c.h), f.x + f.w - (c.x + c.w)]
  let side = 0
  for (let k = 1; k < 4; k++) if (away[k]! < away[side]!) side = k
  const clear = away[side]!
  if (clear < 0 || clear > S.grid.gap) return null

  let ax: number, ay: number, bx: number, by: number
  if (side === 0 || side === 2) {
    const lo = Math.max(c.x + c.r, f.x + f.r)
    const hi = Math.min(c.x + c.w - c.r, f.x + f.w - f.r)
    if (lo > hi) return null
    ax = bx = clamp(c.x + c.w / 2, lo, hi)
    ay = side === 0 ? c.y : c.y + c.h
    by = side === 0 ? f.y : f.y + f.h
  }
  else {
    const lo = Math.max(c.y + c.r, f.y + f.r)
    const hi = Math.min(c.y + c.h - c.r, f.y + f.h - f.r)
    if (lo > hi) return null
    ay = by = clamp(c.y + c.h / 2, lo, hi)
    ax = side === 1 ? c.x : c.x + c.w
    bx = side === 1 ? f.x : f.x + f.w
  }

  const len = Math.hypot(bx - ax, by - ay)
  return { i, j, ax, ay, bx, by, au: project(c, ax, ay), bu: project(f, bx, by), len }
}

function buildGrid(cards: CardBox[], usable: (i: number) => boolean) {
  const n = cards.length
  const gatesOf: number[][] = cards.map(() => [])
  const gates: Gate[] = []
  const rails: Rung[] = []

  for (let i = 0; i < n; i++) {
    if (!usable(i)) continue
    for (let j = i + 1; j < n; j++) {
      if (!usable(j) || !touching(cards[i]!, cards[j]!)) continue
      const built = rungBetween(i, j, cards[i]!, cards[j]!)
      if (!built) continue

      const a = gates.length
      const b = a + 1
      const rung: Rung = { ...built, a, b }
      gates.push({ card: i, u: rung.au, twin: b, rung })
      gates.push({ card: j, u: rung.bu, twin: a, rung })
      gatesOf[i]!.push(a)
      gatesOf[j]!.push(b)

      // A flush pair stays crossable; only the picture is dropped, so the routed and the drawn graphs agree.
      if (rung.len >= S.bridge.min) rails.push(rung)
    }
  }
  return { rails, gates, gatesOf }
}

/** A place on the grid: a bearing on a card, or a fraction along a rung. */
type Spot = { card: number, u: number } | { rung: Rung, f: number }

/** `from`/`to` are bearings on a card and fractions on a rung, never normalised: a backwards arc has `to < from`. */
interface Seg {
  card: number
  rung: Rung | null
  from: number
  to: number
  len: number
  /** Cumulative px at this segment's start. */
  start: number
}

interface Route {
  segs: Seg[]
  /** Path length in px. */
  len: number
  /** `len` plus `bridge.cost` per pipe. Compare routes by this, never by `len`. */
  cost: number
}

// Dijkstra over the gates, with the start and the finish spliced in as two extra nodes.
function planRoute(
  cards: CardBox[],
  perims: number[],
  gates: Gate[],
  gatesOf: number[][],
  from: Spot,
  to: { card: number, u: number },
): Route | null {
  const arcPx = (card: number, a: number, b: number) =>
    (Math.abs(delta(a, b)) / TURN) * (perims[card] ?? 0)

  const G = gates.length
  const START = G
  const END = G + 1
  const N = G + 2

  const dist = new Float64Array(N).fill(Number.POSITIVE_INFINITY)
  const prev = new Int32Array(N).fill(-1)
  const done = new Uint8Array(N)
  dist[START] = 0

  const relax = (u: number, w: number, cost: number) => {
    const d = dist[u]! + cost
    if (d < dist[w]!) {
      dist[w] = d
      prev[w] = u
    }
  }

  for (let step = 0; step < N; step++) {
    let u = -1
    let best = Number.POSITIVE_INFINITY
    for (let k = 0; k < N; k++) {
      if (!done[k] && dist[k]! < best) {
        best = dist[k]!
        u = k
      }
    }
    if (u < 0 || u === END) break
    done[u] = 1

    if (u === START) {
      if ('card' in from) {
        for (const g of gatesOf[from.card] ?? []) relax(u, g, arcPx(from.card, from.u, gates[g]!.u))
        if (from.card === to.card) relax(u, END, arcPx(from.card, from.u, to.u))
      }
      else {
        // Already in a pipe: both mouths are reachable and the toll is already paid.
        relax(u, from.rung.a, from.f * from.rung.len)
        relax(u, from.rung.b, (1 - from.f) * from.rung.len)
      }
    }
    else {
      const g = gates[u]!
      for (const h of gatesOf[g.card] ?? []) {
        if (h !== u) relax(u, h, arcPx(g.card, g.u, gates[h]!.u))
      }
      relax(u, g.twin, g.rung.len + S.bridge.cost)
      if (g.card === to.card) relax(u, END, arcPx(g.card, g.u, to.u))
    }
  }

  if (!Number.isFinite(dist[END]!)) return null
  const cost = dist[END]!

  const chain: number[] = []
  for (let n = END; n !== -1; n = prev[n]!) chain.push(n)
  chain.reverse()

  const segs: Seg[] = []
  let len = 0
  const push = (seg: Omit<Seg, 'start'>) => {
    if (seg.len <= 0.001) return
    segs.push({ ...seg, start: len })
    len += seg.len
  }

  for (let k = 0; k < chain.length - 1; k++) {
    const p = chain[k]!
    const q = chain[k + 1]!

    if (p === START && !('card' in from)) {
      const toEnd = q === from.rung.a ? 0 : 1
      push({ card: -1, rung: from.rung, from: from.f, to: toEnd, len: Math.abs(toEnd - from.f) * from.rung.len })
      continue
    }

    const here = p === START
      ? (from as { card: number, u: number })
      : { card: gates[p]!.card, u: gates[p]!.u }
    const there = q === END ? to : { card: gates[q]!.card, u: gates[q]!.u }

    if (p !== START && q !== END && gates[p]!.twin === q) {
      const rung = gates[p]!.rung
      const forward = gates[p]!.card === rung.i
      push({ card: -1, rung, from: forward ? 0 : 1, to: forward ? 1 : 0, len: rung.len })
      continue
    }

    const d = delta(here.u, there.u)
    push({
      card: here.card,
      rung: null,
      from: here.u,
      to: here.u + d,
      len: (Math.abs(d) / TURN) * (perims[here.card] ?? 0),
    })
  }

  return { segs, len, cost }
}

interface Row { cards: number[], top: number, bottom: number }

function rowsOf(cards: CardBox[], usable: (i: number) => boolean, rtl: boolean) {
  const live: number[] = []
  for (let i = 0; i < cards.length; i++) if (usable(i)) live.push(i)
  live.sort((a, b) => (cards[a]!.y + cards[a]!.h / 2) - (cards[b]!.y + cards[b]!.h / 2))

  const rows: Row[] = []
  const rowOf: number[] = cards.map(() => -1)
  // The running intersection decides membership; the union is what is kept.
  let top = 0
  let bottom = 0
  for (const i of live) {
    const c = cards[i]!
    const row = rows[rows.length - 1]
    if (row && Math.min(bottom, c.y + c.h) - Math.max(top, c.y) >= S.grid.overlap) {
      row.cards.push(i)
      row.top = Math.min(row.top, c.y)
      row.bottom = Math.max(row.bottom, c.y + c.h)
      top = Math.max(top, c.y)
      bottom = Math.min(bottom, c.y + c.h)
    }
    else {
      rows.push({ cards: [i], top: c.y, bottom: c.y + c.h })
      top = c.y
      bottom = c.y + c.h
    }
  }
  rows.forEach((row, k) => {
    row.cards.sort((a, b) => (rtl ? cards[b]!.x - cards[a]!.x : cards[a]!.x - cards[b]!.x))
    for (const i of row.cards) rowOf[i] = k
  })
  return { rows, rowOf }
}

interface SnakeOptions {
  /** Card selector, resolved inside the container. */
  cards?: string
  /** Measurement origin; defaults to the svg's parent. */
  container?: Ref<HTMLElement | null>
}

export function useBorderSnake(svg: Ref<SVGSVGElement | null>, options: SnakeOptions = {}) {
  const selector = options.cards ?? S.cards
  const live = ref(false)
  /** Gutter crossings to draw; empty under reduced motion. */
  const rails = ref<Rung[]>([])

  let ctx: ReturnType<NonNullable<ReturnType<typeof gsapModules>>['gsap']['context']> | null = null

  onMounted(() => {
    const el = svg.value
    const host = options.container?.value ?? el?.parentElement ?? null
    if (!el || !host) return

    void loadGsap().then((m) => {
      if (!m || !svg.value) return
      const { gsap, ScrollTrigger } = m

      ctx = gsap.context(() => {
        gsap.matchMedia().add(
          // `always` is load-bearing: matchMedia only runs when some condition matches, so phones with no motion preference never built.
          { fine: media.fine, still: media.reduce, always: '(min-width: 0px)' },
          (self) => {
            const { fine, still } = self.conditions as Record<string, boolean>
            if (still) return

            const lines = [...el.querySelectorAll<SVGPathElement>('.snake__line')]
            const run = el.querySelector<SVGGElement>('.snake__run')
            const targets = [...host.querySelectorAll<HTMLElement>(selector)]
            if (!lines.length || !targets.length) return

            measureCorner(el)
            const stretch = lines.map((line) => {
              const k = Number.parseFloat(line.dataset.stretch ?? '1')
              return fine ? k : 1 + (k - 1) * S.follow.tail
            })
            const widths = lines.map(line => Number.parseFloat(line.getAttribute('stroke-width') ?? '2'))
            const widest = Math.max(...stretch)

            let cards: CardBox[] = []
            let perims: number[] = []
            let gates: Gate[] = []
            let gatesOf: number[][] = []
            let originX = 0
            let originY = 0
            let px = 0
            let py = 0
            let moved = false
            /** The pointer has left. A state, or the per-frame scan wakes the light again right after pointerleave. */
            let away = false
            /** False until real input: `px`/`py` start at 0,0, which is within `activation` of the first card. */
            let asked = false
            let hidden = false
            let dark = true
            /** How many cards the reveal has released. */
            let released = -1
            let settle: gsap.core.Tween | null = null

            // `trail` is every point the head has passed, oldest first; `head` is the live end.
            interface Pt { x: number, y: number, c: number, u: number }
            let trail: Pt[] = []
            let head: Pt | null = null
            /** Which card the head is on. Derived, never assigned beside it. */
            let active = -1
            let shown = -2

            let route: Route | null = null
            let s = 0
            /** px the head must still travel before the next rope point; carried across replans, or short orbit routes never lay one. */
            let due = S.sample
            let vel = 0
            // Re-decided on every ScrollTrigger refresh: a rotated tablet switches between a pinned bento and a column.
            const rtl = getComputedStyle(host!).direction === 'rtl'
            let mode: 'pointer' | 'follow' = fine ? 'pointer' : 'follow'
            let reader: ReturnType<typeof ScrollTrigger.create> | null = null
            let viewH = window.innerHeight
            let midX = 0
            let firstMid = 0
            let lastMid = 0
            let rows: Row[] = []
            let rowOf: number[] = []
            let tried = -1
            /** 1 clockwise, -1 counter-clockwise. */
            let orbitDir = 1
            /** px circled on the current card. */
            let lapped = 0
            /** 1 toward the reading end, -1 back. */
            let shuttle = 1
            let stranded: { rung: Rung, f: number } | null = null
            let shownLine = Number.NaN
            let ropeLen: number = S.body
            let fresh = true
            let heading = { x: 1, y: 0 }
            let planned: { card: number, u: number } | null = null

            /** GSAP's clock, in seconds. */
            let now = 0
            let flipped = Number.NEGATIVE_INFINITY
            let damped = Number.NEGATIVE_INFINITY
            let goal = -1
            let orbiting = false
            let orbitU = 0
            /** When anything last happened (pointer moved, rope travelling); orbiting is excluded or it would keep resetting its own clock. */
            let quiet = 0
            let stir = false
            let borderPx = 1
            let frame = -1
            /** Always drawn, but routable only while idle (see `linkFrame`). */
            let frameRungs: Rung[] = []
            let orbitOn = -1
            /** `gates.length` before any frame door was spliced in. */
            let baseGates = 0

            function ready(i: number) {
              // The frame has no element: never a pointer target, never held by the reveal.
              const card = targets[i]
              if (!card) return false
              // At rest, not merely visible: opacity passes 0.5 while the card is still scaled, and a box measured then stays cached small.
              // Both are inline reads (no layout) and clear on the same clearProps, so the count changes once.
              const held = card.style.opacity
              return (held === '' || Number(held) > 0.5) && card.style.transform === ''
            }

            function measure() {
              ropeLen = fine ? S.body : clamp(window.innerWidth * S.follow.body.ratio, S.follow.body.min, S.follow.body.max)
              // A crossing the head stands in survives the rebuild; replanning from its bearing would snap it to the crossing's foot.
              const crossing = mode === 'follow' ? (insidePipe() ?? stranded) : null
              const rect = host!.getBoundingClientRect()
              originX = rect.left + window.scrollX + host!.clientLeft
              originY = rect.top + window.scrollY + host!.clientTop
              borderPx = Number.parseFloat(getComputedStyle(targets[0]!).borderTopWidth) || 1
              // Inset once, here, so the router and the rope share one box: a card's border is drawn inside its rect.
              const i = S.inset
              cards = targets.map((card) => {
                const r = card.getBoundingClientRect()
                const w = Math.max(0, r.width - 2 * i)
                const h = Math.max(0, r.height - 2 * i)
                return {
                  x: r.left + window.scrollX - originX + i,
                  y: r.top + window.scrollY - originY + i,
                  w,
                  h,
                  r: Math.max(0, Math.min(radiusOf(card, r.width, r.height) - i, w / 2, h / 2)),
                }
              })
              // The frame goes after the cards (indices stay put) and before `perims`; its rect sits 1px in, on the 2px stroke's centre.
              const frameEl = host!.closest('.shell')?.querySelector<SVGSVGElement>('.shell__frame')
              frame = -1
              if (frameEl) {
                const r = frameEl.getBoundingClientRect()
                const w = Math.max(0, r.width - 2)
                const h = Math.max(0, r.height - 2)
                const rx = Number.parseFloat(frameEl.querySelector('rect')?.getAttribute('rx') ?? '0') || 0
                if (w > 0 && h > 0) {
                  frame = cards.length
                  cards.push({
                    x: r.left + window.scrollX - originX + 1,
                    y: r.top + window.scrollY - originY + 1,
                    w,
                    h,
                    r: Math.max(0, Math.min(rx, w / 2, h / 2)),
                  })
                }
              }
              perims = cards.map(c => metrics(c).perimeter)
              const grid = buildGrid(cards, ready)
              gates = grid.gates
              gatesOf = grid.gatesOf
              baseGates = gates.length
              // A reader's orbit survives: card indices do not move, only boxes do.
              if (mode !== 'follow') orbitOn = -1
              if (crossing) {
                const g = gates.find(x => x.rung.i === crossing.rung.i && x.rung.j === crossing.rung.j)
                stranded = g ? { rung: g.rung, f: crossing.f } : null
              }

              frameRungs = []
              if (frame >= 0) {
                const f = cards[frame]!
                for (let i = 0; i < frame; i++) {
                  if (!ready(i)) continue
                  const built = rungToFrame(i, frame, cards[i]!, f)
                  if (built) frameRungs.push({ ...built, a: -1, b: -1 })
                }
                for (const rung of frameRungs) if (rung.len >= S.bridge.min) grid.rails.push(rung)
              }
              rails.value = grid.rails
              joinEls.clear()
              if (!fine) {
                const built = rowsOf(cards, ready, rtl)
                rows = built.rows
                rowOf = built.rowOf
                // Over every card, held or not, so the column's ends stay put while the reveal works down it.
                firstMid = Number.POSITIVE_INFINITY
                lastMid = Number.NEGATIVE_INFINITY
                for (let k = 0; k < targets.length; k++) {
                  const c = cards[k]!
                  firstMid = Math.min(firstMid, c.y + c.h / 2)
                  lastMid = Math.max(lastMid, c.y + c.h / 2)
                }
                midX = window.innerWidth / 2 + window.scrollX - originX
                tried = -1
              }
              route = null
              planned = null
              // A head on the frame keeps its doors, or `planRoute` has nowhere to go and the light freezes.
              if (frame >= 0 && active === frame) linkFrame()
            }

            function at(d: number): Pt {
              const segs = route?.segs ?? []
              if (!segs.length) return head ?? { x: 0, y: 0, c: active, u: 0 }
              let seg = segs[segs.length - 1]!
              for (const candidate of segs) {
                if (d <= candidate.start + candidate.len) {
                  seg = candidate
                  break
                }
              }
              const t = seg.len > 0 ? clamp((d - seg.start) / seg.len, 0, 1) : 1
              if (seg.rung) {
                const f = seg.from + (seg.to - seg.from) * t
                const r = seg.rung
                return {
                  x: r.ax + (r.bx - r.ax) * f,
                  y: r.ay + (r.by - r.ay) * f,
                  c: f < 0.5 ? r.i : r.j,
                  u: f < 0.5 ? r.au : r.bu,
                }
              }
              const u = seg.from + (seg.to - seg.from) * t
              const p = pointAt(cards[seg.card]!, u)
              return { x: p.x, y: p.y, c: seg.card, u: ((u % TURN) + TURN) % TURN }
            }

            // The held side resets when the card changes, or the light lands on the wrong edge of the new card.
            const held = { card: -1, side: -1 }
            const aimOn = (card: number) => {
              if (held.card !== card) {
                held.card = card
                held.side = -1
              }
              return project(cards[card]!, px, py, held)
            }

            // `setting` is true only when a journey begins; asking "should the tail lead?" every frame oscillates and flashes the core end to end.
            function replan(to: { card: number, u: number }, setting = false) {
              if (!head) return
              const here = spot()
              const forward = plan(here, to)
              if (setting && now - flipped >= S.backUpHold && forward && trail.length > 4) {
                const tail = trail[0]!
                const back = plan({ card: tail.c, u: tail.u }, to)
                // Compared on cost (tolls included), not length; the margin is the whole rope because a flip moves the bright end its full length.
                if (back && back.cost + ropeLen * widest * S.backUp < forward.cost) {
                  const body = [...trail, head]
                  body.reverse()
                  head = body[body.length - 1]!
                  trail = body.slice(0, -1)
                  fresh = true
                  flipped = now
                  take(back, to)
                  return
                }
              }
              if (forward) take(forward, to)
              // Unreachable: remember the refusal so the router is not rerun every frame.
              else planned = to
            }

            // Only the last leg changed. Backing up is deliberately not renegotiated here: re-asking it per frame oscillates.
            function retarget(to: { card: number, u: number }) {
              if (!route || !planned || planned.card !== to.card) return false
              const last = route.segs[route.segs.length - 1]
              // Only while the head is short of the last leg: rewriting the leg it is on can strand it past its destination.
              if (!last || last.rung || last.card !== to.card || s > last.start) return false
              const d = delta(last.from, to.u)
              const was = last.len
              last.to = last.from + d
              last.len = (Math.abs(d) / TURN) * (perims[to.card] ?? 0)
              route.len = last.start + last.len
              // No door added or removed, so the cost moves by exactly the leg's change.
              route.cost += last.len - was
              planned = to
              return true
            }

            function insidePipe(): { rung: Rung, f: number } | null {
              for (const seg of route?.segs ?? []) {
                if (!seg.rung) continue
                if (s >= seg.start && s <= seg.start + seg.len) {
                  const t = seg.len > 0 ? (s - seg.start) / seg.len : 0
                  return { rung: seg.rung, f: seg.from + (seg.to - seg.from) * t }
                }
              }
              return null
            }

            function spot(): Spot {
              return insidePipe() ?? stranded ?? { card: head!.c, u: head!.u }
            }

            function plan(from: Spot, to: { card: number, u: number }) {
              // Within one card it is always an arc; short-circuiting keeps the router off the hot path.
              if ('card' in from && from.card === to.card) {
                const d = delta(from.u, to.u)
                const len = (Math.abs(d) / TURN) * (perims[from.card] ?? 0)
                return {
                  len,
                  cost: len,
                  segs: [{ card: from.card, rung: null, from: from.u, to: from.u + d, len, start: 0 }],
                }
              }
              return planRoute(cards, perims, gates, gatesOf, from, to)
            }

            function take(next: Route, to: { card: number, u: number }) {
              route = next
              s = 0
              stranded = null
              // `due` is not reset here: an orbit takes a ~1px route every frame, and a reset would starve the rope. Only `wake` and a re-lay clear it.
              planned = to
              if (next.len > 0.5) {
                const a = at(0)
                const b = at(Math.min(4, next.len))
                const dx = b.x - a.x
                const dy = b.y - a.y
                const l = Math.hypot(dx, dy)
                // Once per `turnHold`, not per replan, or `turnaround` compounds and the light stops dead.
                if (l > 0.1 && (dx * heading.x + dy * heading.y) / l < -0.2 && now - damped >= S.turnHold) {
                  vel *= S.turnaround
                  damped = now
                }
              }
            }

            // sqrt(2 * decel * remaining) is the speed that stops exactly at the target; the same against each pipe mouth arrives at the pipe's pace.
            function limitAt(from: number, remaining: number, k = 1) {
              let lim = Math.min(S.speed * k, Math.sqrt(2 * S.decel * k * Math.max(remaining, 0)))
              for (const seg of route?.segs ?? []) {
                if (!seg.rung) continue
                if (from >= seg.start && from <= seg.start + seg.len) return Math.min(lim, S.bridge.speed * k)
                if (seg.start > from) {
                  lim = Math.min(lim, Math.sqrt(2 * S.decel * k * (seg.start - from)) + S.bridge.speed * k)
                }
              }
              return lim
            }

            function runFor(remaining: number) {
              return mode === 'follow' ? clamp(remaining / S.follow.run.far, 1, S.follow.run.max) : 1
            }

            function advance(dt: number) {
              if (!route || !head) return
              const remaining = route.len - s
              if (remaining <= 0.01) {
                vel = 0
                return
              }
              const k = runFor(remaining)
              vel = Math.min(vel + S.accel * k * dt, limitAt(s, remaining, k))
              let next = s + vel * dt
              if (next >= route.len - 0.3) next = route.len

              // One point every `sample` px as travelled; the leftover distance carries to the next frame.
              let left = next - s
              let pos = s
              while (due <= left) {
                pos += due
                left -= due
                trail.push(at(pos))
                due = S.sample
              }
              due -= left
              const was = head
              head = at(next)
              s = next
              fresh = true
              if (head.c >= 0) active = head.c

              const dx = head.x - was.x
              const dy = head.y - was.y
              const l = Math.hypot(dx, dy)
              if (l > 0.01) heading = { x: dx / l, y: dy / l }
            }

            // Not while the taper is sliding after a flip: the bright end is at the start of the array then.
            function trim() {
              if (now - flipped < S.flip) return
              if (!head || trail.length < 2) return
              const max = ropeLen * widest + S.sample
              const last = trail[trail.length - 1]!
              let total = Math.hypot(head.x - last.x, head.y - last.y)
              for (let i = trail.length - 1; i > 0; i--) {
                const a = trail[i]!
                const b = trail[i - 1]!
                total += Math.hypot(a.x - b.x, a.y - b.y)
                if (total > max) {
                  trail.splice(0, i - 1)
                  return
                }
              }
            }

            function draw() {
              if (run && active !== shown) {
                shown = active
                // For the test harness; an attribute, so inline-style assertions never see it.
                run.setAttribute('data-card', String(active))
              }
              if (!head || trail.length < 1) {
                for (const line of lines) line.setAttribute('d', '')
                return
              }
              if (!fresh) return
              fresh = false

              const pts = [...trail, head]
              const back: number[] = Array.from({ length: pts.length }, () => 0)
              for (let i = pts.length - 2; i >= 0; i--) {
                const a = pts[i]!
                const b = pts[i + 1]!
                back[i] = back[i + 1]! + Math.hypot(a.x - b.x, a.y - b.y)
              }

              const whole = back[0]!
              // Where the taper's bright end sits (0 rope start, 1 head), derived from the clock: after a back-up it slides 0 -> 1 instead of jumping.
              const since = (now - flipped) / S.flip
              const sliding = since >= 0 && since < 1
              const lead = !sliding
                ? 1
                : since < 0.5 ? 2 * since * since : 1 - 2 * (1 - since) * (1 - since)

              const pointBack = (d: number) => {
                let i = 0
                while (i < pts.length - 2 && back[i + 1]! > d) i++
                const a = pts[i]!
                const b = pts[i + 1]!
                const seg = back[i]! - back[i + 1]!
                const t = seg > 0 ? clamp((back[i]! - d) / seg, 0, 1) : 1
                return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
              }
              const xy = (p: { x: number, y: number }) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`

              for (let k = 0; k < lines.length; k++) {
                const line = lines[k]!
                const want = Math.min(ropeLen * stretch[k]!, whole)
                // Round caps make a stroke shorter than its width a bead, not a line.
                if (whole < widths[k]!) {
                  line.setAttribute('d', '')
                  continue
                }

                const near = (1 - lead) * (whole - want)
                const far = near + want

                const parts = [`M${xy(pointBack(far))}`]
                for (let i = 0; i < pts.length; i++) {
                  if (back[i]! < far && back[i]! > near) parts.push(`L${xy(pts[i]!)}`)
                }
                parts.push(`L${xy(pointBack(near))}`)
                line.setAttribute('d', parts.join(''))
              }
            }

            interface Join { g: SVGGElement, hide: SVGPathElement, lip: SVGPathElement, lit: SVGPathElement }
            const joinEls = new Map<string, Join>()
            /** How open each join is (0..1), moved toward the rope's answer by at most `dt / join.ease` per frame. */
            const openness = new Map<string, { rung: Rung, t: number }>()
            function joinOf(key: string) {
              let j = joinEls.get(key)
              if (!j) {
                const g = el!.querySelector<SVGGElement>(`.snake__join[data-rung="${key}"]`)
                const hide = g?.querySelector<SVGPathElement>('.snake__hide')
                const lip = g?.querySelector<SVGPathElement>('.snake__lip')
                const lit = g?.querySelector<SVGPathElement>('.snake__lit')
                if (!g || !hide || !lip || !lit) return null
                // Set here, not in `measure`: Vue renders the joins on its own tick.
                lip.setAttribute('stroke-width', String(borderPx))
                lit.setAttribute('stroke-width', String(borderPx))
                j = { g, hide, lip, lit }
                joinEls.set(key, j)
              }
              return j
            }

            // The target openness is derived from where the rope is every frame and never stored, so it survives replans, fades and reversals.
            function drawJoins(dt: number) {
              const step = S.join.ease > 0 ? dt / S.join.ease : 1
              const want = new Map<string, { rung: Rung, heat: number }>()
              if (head && rails.value.length) {
                const whole = ropeLen * widest
                for (const rung of rails.value) {
                  if (rung.len < S.bridge.min) continue
                  const mx = (rung.ax + rung.bx) / 2
                  const my = (rung.ay + rung.by) / 2
                  if (Math.hypot(head.x - mx, head.y - my) > whole + S.join.open + rung.len) continue

                  const dx = rung.bx - rung.ax
                  const dy = rung.by - rung.ay
                  const l2 = dx * dx + dy * dy
                  /** `u` along the gutter (0 and 1 are the feet) and `off` its centreline, in px. */
                  const against = (x: number, y: number) => {
                    const u = l2 > 0 ? ((x - rung.ax) * dx + (y - rung.ay) * dy) / l2 : 0
                    const c = clamp(u, 0, 1)
                    return { u, off: Math.hypot(x - (rung.ax + dx * c), y - (rung.ay + dy * c)) }
                  }
                  // Strictly between the faces: a point at a foot is on a face, not in the gutter.
                  const inside = (p: { u: number, off: number }) => p.u > 0.04 && p.u < 0.96 && p.off < S.bridge.gap / 2 + 2

                  const h = against(head.x, head.y)
                  let t = 0
                  if (inside(h)) {
                    t = 1
                  }
                  else if (route) {
                    for (const seg of route.segs) {
                      if (seg.rung !== rung) continue
                      if (s < seg.start) t = 1 - (seg.start - s) / S.join.open
                      break
                    }
                  }
                  if (t < 1) {
                    for (let k = trail.length - 1; k >= 0; k -= 2) {
                      if (inside(against(trail[k]!.x, trail[k]!.y))) {
                        t = 1
                        break
                      }
                    }
                  }
                  if (t <= 0) continue
                  let heat = clamp(1 - Math.max(0, h.off - S.bridge.gap) / S.join.reach, 0, 1)
                  heat = heat * heat * (3 - 2 * heat)
                  want.set(`${rung.i}-${rung.j}`, { rung, heat })
                }
              }

              for (const [key, w] of want) if (!openness.has(key)) openness.set(key, { rung: w.rung, t: 0 })
              for (const [key, state] of openness) {
                const w = want.get(key)
                const target = w ? 1 : 0
                const next = clamp(state.t + clamp(target - state.t, -step, step), 0, 1)
                const jn = joinOf(key)
                if (!jn) {
                  openness.delete(key)
                  continue
                }
                if (next <= 0.001) {
                  jn.hide.setAttribute('d', '')
                  jn.lip.setAttribute('d', '')
                  jn.lit.setAttribute('d', '')
                  jn.g.setAttribute('opacity', '0')
                  openness.delete(key)
                  continue
                }
                state.t = next
                if (w) state.rung = w.rung
                const eased = next * next * (3 - 2 * next)
                writeJoin(jn, state.rung, eased, w?.heat ?? 0)
                jn.g.setAttribute('opacity', eased.toFixed(3))
              }
            }

            function writeJoin(j: Join, rung: Rung, t: number, heat: number) {
              const ux = (rung.bx - rung.ax) / rung.len
              const uy = (rung.by - rung.ay) / rung.len
              const nx = -uy
              const ny = ux
              // The reach stops where each card's straight run does, or the cover eats the corner arc and the lip floats off the curve.
              const room = (ci: number, fx: number, fy: number) => {
                const c = cards[ci]
                if (!c) return Number.POSITIVE_INFINITY
                const flat = Math.abs(nx) > 0.5
                const at = flat ? fx : fy
                const lo = flat ? c.x + c.r : c.y + c.r
                const hi = flat ? c.x + c.w - c.r : c.y + c.h - c.r
                return Math.max(0, Math.min(at - lo, hi - at))
              }
              const want = S.join.reach * t
              const ha = Math.min(want, room(rung.i, rung.ax, rung.ay))
              const hb = Math.min(want, room(rung.j, rung.bx, rung.by))
              const h = Math.min(ha, hb)
              // The throat scales with the clamped reach, so a tight join keeps its waist shape instead of becoming a bulge.
              const w = Math.min(S.bridge.gap / 2, h / 3)
              const mx = (rung.ax + rung.bx) / 2
              const my = (rung.ay + rung.by) / 2
              const P = (x: number, y: number) => `${x.toFixed(1)} ${y.toFixed(1)}`
              const cover = (x: number, y: number, reach: number, half: number) =>
                `M${P(x - ux * half + nx * reach, y - uy * half + ny * reach)}L${P(x + ux * half + nx * reach, y + uy * half + ny * reach)}L${P(x + ux * half - nx * reach, y + uy * half - ny * reach)}L${P(x - ux * half - nx * reach, y - uy * half - ny * reach)}Z`
              // Half the stroke (the frame's is 2px) plus 0.25px, so the border's antialiasing does not show at the edges.
              const halfA = (rung.i === frame ? 2 : borderPx) / 2 + 0.25
              const halfB = (rung.j === frame ? 2 : borderPx) / 2 + 0.25
              j.hide.setAttribute('d', cover(rung.ax, rung.ay, ha, halfA) + cover(rung.bx, rung.by, hb, halfB))
              const lip = (sg: number) =>
                `M${P(rung.ax + nx * ha * sg, rung.ay + ny * ha * sg)}`
                + `C${P(rung.ax + nx * ha * 0.45 * sg, rung.ay + ny * ha * 0.45 * sg)} ${P(rung.ax + ux * 3 + nx * w * sg, rung.ay + uy * 3 + ny * w * sg)} ${P(mx + nx * w * sg, my + ny * w * sg)}`
                + `C${P(rung.bx - ux * 3 + nx * w * sg, rung.by - uy * 3 + ny * w * sg)} ${P(rung.bx + nx * hb * 0.45 * sg, rung.by + ny * hb * 0.45 * sg)} ${P(rung.bx + nx * hb * sg, rung.by + ny * hb * sg)}`
              const d = lip(1) + lip(-1)
              j.lip.setAttribute('d', d)
              j.lit.setAttribute('d', d)
              j.lit.setAttribute('stroke-opacity', (S.join.lit * heat).toFixed(2))
            }

            function wake(index: number, dir = 1) {
              settle?.kill()
              settle = null
              if (!((perims[index] ?? 0) > 0)) return
              layRope(index, project(cards[index]!, px, py), dir)
              active = index
              goal = index
              orbiting = false
              route = null
              planned = null
              s = 0
              due = S.sample
              vel = 0
              heading = { x: 1, y: 0 }
              draw()
              dark = false
              live.value = true
            }

            // Lay the whole rope (`ropeLen * widest`) so every layer is its full length on the first frame.
            function layRope(index: number, u: number, dir = 1) {
              const card = cards[index]!
              const P = perims[index] ?? 0
              const len = Math.min(ropeLen * widest, P * 0.9)
              const n = Math.max(2, Math.ceil(len / S.sample))
              trail = []
              for (let k = 0; k <= n; k++) {
                const back = ((len * (1 - k / n)) / P) * TURN
                const uu = dir > 0 ? u - back : u + back
                const p = pointAt(card, uu)
                trail.push({ x: p.x, y: p.y, c: index, u: ((uu % TURN) + TURN) % TURN })
              }
              head = trail.pop()!
              fresh = true
            }

            function fade() {
              // Idempotent: reached every frame, and checks `live` (not `dark`, which lands `fade` seconds later) so delayedCalls never stack.
              if (!live.value) return
              settle?.kill()
              orbiting = false
              live.value = false
              // Keep the geometry until the CSS fade ends.
              settle = gsap.delayedCall(S.fade, () => {
                dark = true
                route = null
                planned = null
              })
            }

            function rest() {
              if (hidden || S.idle === 'fade' || active < 0 || !head) {
                fade()
                return
              }
              // Relight where it was left; `wake` would jump to a pointer that is not asking.
              if (dark || !live.value) relight()
              // Also re-check `orbitOn`: a still pointer that then leaves must hand over from its card to the frame.
              const wantFrame = away && S.idle === 'frame' && frameFits()
              const going = wantFrame ? frame : active
              if (!orbiting || orbitOn !== going) {
                if (wantFrame) linkFrame()
                orbiting = true
                orbitOn = going
                orbitU = going === active ? head.u : project(cards[going]!, head.x, head.y)
              }
            }

            function relight() {
              settle?.kill()
              settle = null
              dark = false
              live.value = true
              vel = 0
              route = null
              planned = null
            }

            // Frame doors exist only while idle: left in the graph, the frame is a hub and the router would tour the page edge between cards.
            function linkFrame() {
              unlinkFrame()
              if (frame < 0 || !cards[frame]) return
              for (const rung of frameRungs) {
                const a = gates.length
                const b = a + 1
                // Mutate the drawn rung itself, so the routed opening is the visible one.
                rung.a = a
                rung.b = b
                gates.push({ card: rung.i, u: rung.au, twin: b, rung })
                gates.push({ card: frame, u: rung.bu, twin: a, rung })
                gatesOf[rung.i]!.push(a)
                gatesOf[frame]!.push(b)
              }
            }

            function unlinkFrame() {
              if (gates.length <= baseGates) return
              gates.length = baseGates
              for (const list of gatesOf) {
                for (let k = list.length - 1; k >= 0; k--) if (list[k]! >= baseGates) list.splice(k, 1)
              }
            }

            function frameFits() {
              const f = frame >= 0 ? cards[frame] : null
              return !!f && f.w <= window.innerWidth + 2 && f.h <= window.innerHeight + 2
            }

            // Scroll is read from ScrollTrigger, never `window.scrollY`: the curtain rewrites it after navigation.
            function line() {
              const max = Math.max(0, reader?.end ?? 0)
              const y = clamp(reader?.scroll() ?? 0, 0, max)
              const R = S.follow.ramp * viewH
              const mid = y + S.follow.line * viewH - originY
              let at = mid
              if (R > 0 && y < R) {
                const t = Math.min(firstMid, mid)
                at = t + (at - t) * (y / R)
              }
              if (R > 0 && max - y < R) {
                const b = Math.max(lastMid, mid)
                at = b + (at - b) * ((max - y) / R)
              }
              return at
            }

            function level(y: number) {
              const cur = orbitOn >= 0 ? (rowOf[orbitOn] ?? -1) : -1
              const r = cur >= 0 ? rows[cur] : undefined
              if (r && y >= r.top - S.follow.hold && y <= r.bottom + S.follow.hold) return cur
              let best = -1
              let far = Number.POSITIVE_INFINITY
              for (let k = 0; k < rows.length; k++) {
                const d = Math.max(rows[k]!.top - y, 0, y - rows[k]!.bottom)
                if (d < far) {
                  far = d
                  best = k
                }
              }
              return best
            }

            function startFor(row: number[], card: number) {
              return row.length > 1 && row.indexOf(card) === row.length - 1 ? -1 : 1
            }

            // `tried` stops an unreachable row being replanned every frame; `measure` clears it, since a release may connect it.
            function follow() {
              if (!rows.length) return
              py = line()
              px = midX
              // For the test harness, as an attribute (see `data-card`).
              if (run && Math.round(py) !== shownLine) {
                shownLine = Math.round(py)
                run.setAttribute('data-line', String(shownLine))
              }
              const k = level(py)
              if (k < 0) return

              if (!head) {
                let c = -1
                let near = Number.POSITIVE_INFINITY
                for (const i of rows[k]!.cards) {
                  if (!gatesOf[i]?.length) continue
                  const d = distanceTo(cards[i]!, px, py)
                  if (d < near) {
                    near = d
                    c = i
                  }
                }
                if (c < 0) return
                orbitDir = rtl ? -1 : 1
                wake(c, orbitDir)
                // `wake` sets `head`; the narrowing above cannot know that.
                const lit = head as Pt | null
                if (!lit) return
                orbiting = true
                orbitOn = c
                orbitU = lit.u
                lapped = 0
                shuttle = startFor(rows[k]!.cards, c)
                tried = k
                return
              }

              if (dark || !live.value) {
                relight()
                orbiting = true
              }
              if (k !== rowOf[orbitOn] && k !== tried) {
                tried = k
                board(k)
              }
            }

            function board(k: number) {
              if (!head) return
              const cur = orbitOn >= 0 ? (rowOf[orbitOn] ?? -1) : -1
              const step = cur < 0 || cur === k ? 0 : (k > cur ? -1 : 1)
              const from = spot()
              for (let j = k; j >= 0 && j < rows.length; j += step) {
                if (j === cur) return
                let best: { card: number, route: Route } | null = null
                for (const c of rows[j]!.cards) {
                  const r = plan(from, { card: c, u: project(cards[c]!, head.x, head.y) })
                  if (r && (!best || r.cost < best.route.cost)) best = { card: c, route: r }
                }
                if (best) {
                  enter(best.card, best.route)
                  shuttle = startFor(rows[j]!.cards, best.card)
                  return
                }
                if (step === 0) return
              }
            }

            function enter(card: number, via: Route) {
              const segs = via.segs
              let foot = head!.u
              let along = heading
              for (let i = segs.length - 1; i >= 0; i--) {
                const seg = segs[i]!
                if (!seg.rung) continue
                foot = seg.to > seg.from ? seg.rung.bu : seg.rung.au
                const prev = segs[i - 1]
                if (prev && !prev.rung && prev.len > 0.5) {
                  const c = cards[prev.card]!
                  const back = Math.min((4 / (perims[prev.card] || 1)) * TURN, Math.abs(prev.to - prev.from))
                  const a = pointAt(c, prev.to - Math.sign(prev.to - prev.from) * back)
                  const b = pointAt(c, prev.to)
                  const l = Math.hypot(b.x - a.x, b.y - a.y)
                  if (l > 0.01) along = { x: (b.x - a.x) / l, y: (b.y - a.y) / l }
                }
                break
              }
              const P = perims[card] || 1
              const here = pointAt(cards[card]!, foot)
              const next = pointAt(cards[card]!, foot + (2 / P) * TURN)
              const dot = (next.x - here.x) * along.x + (next.y - here.y) * along.y
              if (Math.abs(dot) > 0.01) orbitDir = dot > 0 ? 1 : -1
              orbiting = true
              orbitOn = card
              orbitU = foot + orbitDir * (S.follow.enter / P) * TURN
              lapped = 0
            }

            // The target only advances once the head is on the card, so the finish line does not run away from it.
            function circle(dt: number) {
              if (active === orbitOn && !insidePipe() && !stranded) {
                const from = orbitU
                orbitU += orbitDir * ((S.follow.orbit * dt) / (perims[orbitOn] || 1)) * TURN
                lapped += S.follow.orbit * dt
                turn(from)
              }
              return { card: orbitOn, u: orbitU }
            }

            function turn(from: number) {
              const row = rows[rowOf[orbitOn] ?? -1]?.cards
              if (!row || row.length < 2 || !head) return
              if (lapped < S.follow.turn * (perims[orbitOn] ?? 0)) return
              const at = row.indexOf(orbitOn)
              if (at < 0) return
              if (row[at + shuttle] === undefined) shuttle = -shuttle
              const next = row[at + shuttle]
              if (next === undefined) return
              const door = (gatesOf[orbitOn] ?? []).find(g => gates[gates[g]!.twin]!.card === next)
              if (door === undefined) return
              const ahead = ((((gates[door]!.u - from) * orbitDir) % TURN) + TURN) % TURN
              if (ahead > Math.abs(orbitU - from)) return
              const r = plan(spot(), { card: next, u: project(cards[next]!, head.x, head.y) })
              if (r) enter(next, r)
            }

            function reach() {
              return fine ? S.activation : Number.POSITIVE_INFINITY
            }

            // `deltaTime` is GSAP's ticker ms; `dt` is clamped seconds, so a dropped frame cannot fling the head.
            function tick(_time: number, deltaTime: number) {
              // The only thing new input may gate: gating the nearest-card scan on input meant no decision was taken when the pointer stopped.
              if (dark && !live.value && !moved && mode === 'pointer') return
              moved = false
              now = _time

              // Hidden: `onVisibility` faded it, and the scan below would wake it straight back up.
              if (hidden) return

              if (stir || (!orbiting && route && route.len - s > 1)) {
                stir = false
                quiet = now
              }

              const dt = Math.min((deltaTime || 16.7) / 1000, 0.05)

              if (cards.length) {
                // Re-measure when the reveal releases a card: it moves (translateY) without resizing, which the ResizeObserver cannot see.
                let count = 0
                for (let i = 0; i < targets.length; i++) if (ready(i)) count++
                if (count !== released) {
                  released = count
                  measure()
                }

                if (mode === 'follow') {
                  follow()
                }
                else {
                  // Returns only after `measure`: the openings belong to the layout, not the pointer.
                  if (!asked) return

                  let index = -1
                  let distance = Number.POSITIVE_INFINITY
                  let inside = -1
                  for (let i = 0; i < cards.length; i++) {
                    if (!ready(i)) continue
                    const d = distanceTo(cards[i]!, px, py)
                    if (d === 0 && inside < 0) inside = i
                    if (d < distance) {
                      distance = d
                      index = i
                    }
                  }

                  const still = fine && asked && !away && head && now - quiet >= S.settle
                  if (away || still || (!fine && head) || index < 0 || distance > reach()) {
                    rest()
                  }
                  else if (dark || !live.value) {
                    wake(index)
                  }
                  else {
                    if (orbiting) {
                      orbiting = false
                      orbitOn = -1
                    }
                    // The card the pointer is over wins outright; hysteresis is only for the gutters.
                    let want = index
                    if (inside >= 0) {
                      want = inside
                    }
                    else if (goal >= 0 && goal < cards.length && index !== goal && ready(goal)) {
                      const held = distanceTo(cards[goal]!, px, py)
                      if (distance >= held - S.threshold) want = goal
                    }
                    goal = want
                  }
                }
              }

              if (dark || !head || !cards.length) return

              // While fading out (`live` false) it takes no new aim, so it finishes its route instead of heading back to a stale pointer.
              const drive = mode === 'follow' ? (orbiting ? orbitOn : -1) : (orbiting ? orbitOn : goal)
              if (live.value && drive >= 0 && cards[drive]) {
                const pace = drive === frame ? S.frame.speed : S.orbit
                let aim: { card: number, u: number }
                if (mode === 'follow') {
                  aim = circle(dt)
                }
                else if (orbiting) {
                  // `|| 1`, not `?? 1`: a zero perimeter would divide to Infinity.
                  aim = { card: drive, u: (orbitU += ((pace * dt) / (perims[drive] || 1)) * TURN) }
                }
                else {
                  aim = { card: drive, u: aimOn(drive) }
                }

                if (!route || !planned || planned.card !== aim.card || Math.abs(delta(planned.u, aim.u)) > 0.5) {
                  const setting = !route || !planned || planned.card !== aim.card || route.len - s <= 0.01
                  if (!retarget(aim)) replan(aim, setting)
                }
              }

              // Doors shut once the rope is home, not when the pointer returns: shutting them under a head on the frame freezes it.
              if (!orbiting && gates.length > baseGates && active !== frame
                && !(route?.segs ?? []).some(sg => sg.card === frame || sg.rung?.i === frame || sg.rung?.j === frame)) {
                unlinkFrame()
              }

              advance(dt)
              trim()
              draw()
              drawJoins(dt)
            }

            function onMove(event: PointerEvent) {
              // Touch contact on a hybrid device must not become a hover target.
              if (event.pointerType === 'touch') return
              // `stir`, not just `moved`: a resize also sets `moved` and is not someone asking.
              stir = true
              px = event.pageX - originX
              py = event.pageY - originY
              away = false
              asked = true
              moved = true
            }

            function onLeave() {
              away = true
              // Drop the chase's speed so the idle journey is not flung; `moved` lets the tick run once more so `rest()` decides.
              vel = 0
              moved = true
            }

            function onPointerOut(event: PointerEvent) {
              if (event.relatedTarget === null) onLeave()
            }

            function onVisibility() {
              hidden = document.visibilityState === 'hidden'
              if (hidden) fade()
              else moved = true
            }

            // Read here, write a frame later: layout writes inside the callback raise "ResizeObserver loop" errors, which the e2e suites fail on.
            let pending = false
            const ro = new ResizeObserver(() => {
              if (pending) return
              pending = true
              requestAnimationFrame(() => {
                pending = false
                measure()
                // Re-lay the rope on its card even if the pointer has left: old points stay where the cards were and would join with a chord.
                if (!dark && head && active >= 0 && active < cards.length && (perims[active] ?? 0) > 0) {
                  layRope(active, head.u, mode === 'follow' ? orbitDir : 1)
                  s = 0
                  due = S.sample
                  vel = 0
                  stranded = null
                }
                if (mode === 'follow') ScrollTrigger.refresh()
                moved = true
              })
            })

            measure()
            ro.observe(host!)
            for (const card of targets) ro.observe(card)

            if (fine) {
              document.addEventListener('pointermove', onMove, { passive: true })
              document.addEventListener('pointerleave', onLeave)
              document.addEventListener('pointerout', onPointerOut)
              window.addEventListener('blur', onLeave)
            }
            else {
              // `onRefresh` re-measures with the scroll's extent and re-decides the mode (a rotated tablet).
              reader = ScrollTrigger.create({
                start: 0,
                end: 'max',
                onRefresh: () => {
                  viewH = window.innerHeight
                  const room = document.documentElement.scrollHeight - window.innerHeight
                  const next = room > S.follow.floor ? 'follow' : 'pointer'
                  if (next !== mode) {
                    mode = next
                    tried = -1
                    lapped = 0
                    orbiting = false
                    orbitOn = -1
                    stranded = null
                  }
                  asked = mode === 'pointer'
                  measure()
                  moved = true
                },
              })
              ScrollTrigger.refresh()
            }
            document.addEventListener('visibilitychange', onVisibility)
            gsap.ticker.add(tick)

            return () => {
              // Input first, so no handler can run anything below again.
              document.removeEventListener('pointermove', onMove)
              document.removeEventListener('pointerleave', onLeave)
              document.removeEventListener('pointerout', onPointerOut)
              window.removeEventListener('blur', onLeave)
              reader?.kill()
              reader = null
              run?.removeAttribute('data-line')
              shownLine = Number.NaN
              document.removeEventListener('visibilitychange', onVisibility)
              // Neither is tracked by `gsap.context`; a ticker left running writes to detached elements.
              gsap.ticker.remove(tick)
              ro.disconnect()
              settle?.kill()
              settle = null
              cards = []
              perims = []
              gates = []
              gatesOf = []
              trail = []
              head = null
              route = null
              planned = null
              rows = []
              rowOf = []
              tried = -1
              orbitOn = -1
              lapped = 0
              stranded = null
              active = -1
              goal = -1
              away = false
              hidden = false
              asked = false
              orbiting = false
              vel = 0
              released = -1
              dark = true
              // On a condition change (Reduce Motion on) the element stays, and this class is what hides the line.
              live.value = false
              // Rails are drawn regardless of `live`, so clear them by hand.
              rails.value = []
            }
          },
        )
      }, el)
    })

    onBeforeUnmount(() => {
      ctx?.revert()
      ctx = null
    })
  })

  return { live, rails }
}
