import { mirror as M } from '~/config/motion'
import { fontsSettled } from '~/utils/fonts-settled'
import { takeScroll } from '~/utils/scroll-stash'

// The language switch as a mirror: each card on screen is copied into a fixed layer and flown to its
// reflection while the real cards hide and the new page renders underneath (begin() in beforeEach,
// land() on page:finish). Web Animations, not a View Transition: a VT shows a still while Safari builds.

interface MirrorDeps {
  reveal: ReturnType<typeof useReveal>
  focusHeading: () => Promise<void> | void
  isIdle: () => boolean
}

interface Flight {
  index: number
  kind: string
  copy: HTMLElement
  from: DOMRect
  delay: number
  dx: number
  anim: Animation
  card: HTMLElement | null
  done: boolean
}

interface Run {
  flights: Flight[]
  layer: HTMLElement
  /** `document.timeline` time at the press, in ms. */
  started: number
  fromY: number
  history: boolean
  timer: ReturnType<typeof setTimeout>
  landing: boolean
  finished: boolean
  keyboard: boolean
}

const SCOPE = 'is-mirroring'

// Pinned inline on each copy: it leaves the card's ancestors, so inherited and box styles must travel with it.
const INHERITED = ['color', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-align', 'direction']
const BOX = [
  'background-color', 'background-image', 'box-shadow', 'overflow',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'display', 'flex-direction', 'align-items', 'justify-content', 'gap',
]

const now = () => (document.timeline.currentTime as number | null) ?? performance.now()
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/** Outermost cards in document order: both languages share it, so flights pair by index. */
function cards(): HTMLElement[] {
  const stage = document.getElementById('stage')
  if (!stage) return []
  return [...stage.querySelectorAll<HTMLElement>(M.cards)].filter(el => !el.parentElement?.closest(M.cards))
}

function kindOf(el: HTMLElement) {
  return `${el.tagName}.${[...el.classList].filter(c => !c.startsWith('is-')).sort().join('.')}`
}

function onScreen(r: DOMRect) {
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight
}

function copyOf(card: HTMLElement, at: DOMRect): HTMLElement {
  const copy = card.cloneNode(true) as HTMLElement
  const style = getComputedStyle(card)
  for (const p of [...INHERITED, ...BOX]) copy.style.setProperty(p, style.getPropertyValue(p))
  for (const el of [copy, ...copy.querySelectorAll<HTMLElement>('[id]')]) el.removeAttribute('id')
  Object.assign(copy.style, {
    position: 'absolute',
    left: `${at.left}px`,
    top: `${at.top}px`,
    width: `${at.width}px`,
    height: `${at.height}px`,
    margin: '0',
    boxSizing: 'border-box',
    transform: 'none',
    opacity: '1',
    visibility: 'visible',
  })
  return copy
}

function offsetOf(el: HTMLElement) {
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform === 'none' ? undefined : getComputedStyle(el).transform)
  return { x: m.m41, y: m.m42 }
}

export function createMirror(deps: MirrorDeps) {
  let run: Run | null = null

  function can(when: { home: boolean, back: boolean, uaAnimated: boolean, savedTop: number | null }) {
    if (!import.meta.client || run || !when.home) return false
    if (typeof Element.prototype.animate !== 'function') return false
    if (prefersStillness() || document.hidden) return false
    if (when.back) {
      if (when.uaAnimated) return false
      if (when.savedTop != null && Math.abs(when.savedTop - window.scrollY) > M.near * window.innerHeight) return false
    }
    return cards().some(el => onScreen(el.getBoundingClientRect()))
  }

  /** Resolves once the copies are painted; null if there is nothing to carry (the curtain runs instead). */
  function begin(history: boolean, toDir: 'ltr' | 'rtl'): Promise<void> | null {
    const html = document.documentElement
    const width = window.innerWidth

    // Fixed and outside #stage, so no transform captures the grain. Keeps the OLD dir, so copies do not
    // mirror their insides when `<html dir>` flips mid-flight.
    const layer = document.createElement('div')
    layer.className = 'mirror'
    layer.setAttribute('aria-hidden', 'true')
    layer.setAttribute('inert', '')
    layer.dir = html.dir || 'ltr'

    const picked = cards().map((card, index) => ({ card, index, r: card.getBoundingClientRect() }))
      .filter(p => onScreen(p.r))
    if (!picked.length) return null

    const land = (r: DOMRect) => ({ row: Math.round(r.top / 24), side: toDir === 'rtl' ? r.left : width - r.right })
    const order = [...picked].sort((a, b) => land(a.r).row - land(b.r).row || land(a.r).side - land(b.r).side)

    const started = now()
    const flights: Flight[] = order.map((p, k) => {
      const copy = copyOf(p.card, p.r)
      const delay = Math.min(k * M.stagger, M.staggerMax)
      const dx = width - p.r.right - p.r.left
      const anim = copy.animate(
        [{ transform: 'translate(0px, 0px)' }, { transform: `translate(${dx}px, 0px)` }],
        { duration: M.duration, delay, easing: M.ease, fill: 'forwards' },
      )
      return { index: p.index, kind: kindOf(p.card), copy, from: p.r, delay, dx, anim, card: null, done: false }
    })
    for (const f of [...flights].reverse()) layer.append(f.copy)

    document.body.append(layer)
    html.classList.add(SCOPE)

    const [go, gone] = M.words
    for (const f of flights) {
      for (const child of f.copy.children) {
        (child as HTMLElement).animate([{ opacity: 1 }, { opacity: 0 }], {
          delay: f.delay + M.duration * go,
          duration: M.duration * (gone - go),
          easing: 'linear',
          fill: 'forwards',
        })
      }
    }

    deps.reveal.disarm()
    deps.reveal.hold()

    run = {
      flights,
      layer,
      started,
      fromY: window.scrollY,
      history,
      timer: setTimeout(() => abort(), M.updateMs),
      landing: false,
      finished: false,
      // Only a keyboard press moves focus: Safari rings any element script focuses when nothing had focus.
      keyboard: !!document.activeElement?.matches(':focus-visible'),
    }

    // Two frames before the route may build: until the copies are painted, the compositor cannot carry them
    // and the whole flight happens unseen behind the busy thread. Capped.
    return new Promise<void>((resolve) => {
      const cap = setTimeout(resolve, M.paintMs)
      requestAnimationFrame(() => requestAnimationFrame(() => {
        clearTimeout(cap)
        resolve()
      }))
    })
  }

  function pending() {
    return !!run && !run.landing
  }

  async function land() {
    const r = run
    if (!r || r.landing) return
    r.landing = true

    const saved = takeScroll()
    window.scrollTo(0, r.history && saved ? saved.top : r.fromY)

    await Promise.race([fontsSettled(), wait(M.fontsMs)])
    if (run !== r) return

    deps.reveal.settleInView()

    const list = cards()
    const paired = new Set<number>()
    for (const f of r.flights) {
      const card = list[f.index]
      if (!card || kindOf(card) !== f.kind) {
        f.anim.finished.then(() => fade(f)).catch(() => {})
        continue
      }
      paired.add(f.index)
      f.card = card
      const to = card.getBoundingClientRect()
      const target = { x: to.left - f.from.left, y: to.top - f.from.top }
      const resized = Math.abs(to.width - f.from.width) > 1 || Math.abs(to.height - f.from.height) > 1
      if (resized || Math.abs(target.x - f.dx) > 1 || Math.abs(target.y) > 1) {
        const at = offsetOf(f.copy)
        const left = Math.max(M.settle, f.delay + M.duration - (now() - r.started))
        f.anim.cancel()
        f.anim = f.copy.animate(
          [
            { transform: `translate(${at.x}px, ${at.y}px)`, width: `${f.from.width}px`, height: `${f.from.height}px` },
            { transform: `translate(${target.x}px, ${target.y}px)`, width: `${to.width}px`, height: `${to.height}px` },
          ],
          { duration: left, easing: M.settleEase, fill: 'forwards' },
        )
      }
      f.anim.finished.then(() => handOver(f)).catch(() => {})
    }

    list.forEach((card, i) => {
      if (paired.has(i) || !onScreen(card.getBoundingClientRect())) return
      card.style.visibility = 'visible'
      wordsIn(card)
    })
    settle()
  }

  function wordsIn(card: HTMLElement) {
    for (const child of card.children) {
      (child as HTMLElement).animate([{ opacity: 0 }, { opacity: 1 }], { duration: M.land, easing: M.landEase, fill: 'backwards' })
    }
  }

  function handOver(f: Flight) {
    if (f.done || !f.card) return
    f.done = true
    f.card.style.visibility = 'visible'
    wordsIn(f.card)
    f.copy.remove()
    settle()
  }

  function fade(f: Flight) {
    if (f.done) return
    f.done = true
    void f.copy.animate([{ opacity: 1 }, { opacity: 0 }], { duration: M.land, easing: 'linear' }).finished
      .then(() => f.copy.remove(), () => f.copy.remove())
    settle()
  }

  function settle() {
    const r = run
    if (!r || !r.landing || r.finished || r.flights.some(f => !f.done)) return
    r.finished = true
    setTimeout(() => finish(r, true), M.land)
  }

  function abort() {
    const r = run
    if (!r || r.finished) return
    r.finished = true
    finish(r, false)
  }

  function finish(r: Run, completed: boolean) {
    clearTimeout(r.timer)
    for (const f of r.flights) f.anim.cancel()
    r.layer.remove()
    for (const card of cards()) card.style.removeProperty('visibility')
    document.documentElement.classList.remove(SCOPE)
    if (run === r) run = null
    deps.reveal.hold(false)
    // If another navigation took over, the curtain arms the reveals itself.
    if (!deps.isIdle()) return
    deps.reveal.arm()
    if (completed && r.keyboard) void deps.focusHeading()
  }

  return { can, begin, pending, land, abort }
}
