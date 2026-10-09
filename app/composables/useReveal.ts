import type { GsapModules } from '~/composables/useGsap'
import { ARABIC_RANGE, index as I, kinetic as K, reveal as R, rule as RULE } from '~/config/motion'
import { fontsSettled } from '~/utils/fonts-settled'

// GSAP scroll entrances only: hover stays CSS, route changes the curtain, the theme swap a View Transition.

type RevealModules = GsapModules

export type RevealKind = 'reveal' | 'chars' | 'lines' | 'scramble' | 'wipe'

export interface RevealOptions {
  /** Stagger these descendants instead of revealing the element itself. */
  children?: string
  batch?: boolean
  /** Also dim these rows by distance from the middle of the screen. */
  focus?: boolean
  /** Hide nothing at mount; `fold()` later hides only what is below the fold (the intro owns the rest). */
  below?: boolean
  /** A hairline inside each target, wiped in from the reading edge after the target lands. */
  wipe?: string
}

interface Entry {
  el: HTMLElement
  kind: RevealKind
  options: RevealOptions
  targets: HTMLElement[]
  ctx?: ReturnType<RevealModules['gsap']['context']>
  /** The targets actually hidden (by fold() or a mirror), the only ones it may animate; undefined until then. */
  pending?: HTMLElement[]
  /** Lets the sweep tell a stuck element from one still waiting to be scrolled to. */
  triggers?: ReturnType<RevealModules['ScrollTrigger']['create']>[]
  built: boolean
}

const waiting = new Set<Entry>()
const entries = new Map<HTMLElement, Entry>()
/** Hidden and shown with its target, so every release path frees the rule too. */
const ruleOf = new WeakMap<HTMLElement, HTMLElement>()
/** Targets whose trigger has fired: GSAP owns their inline style, so the sweep skips them. */
const taken = new WeakSet<HTMLElement>()

let modules: RevealModules | null = null
let failsafe: ReturnType<typeof setTimeout> | null = null

/** False while the curtain closes or covers: triggers built then would fire unseen. */
let armed = false

/** A language mirror carries the page: register everything, hide nothing; settleInView() splits it. */
let heldByMirror = false

const stillness = prefersStillness

// Written synchronously on mount, under the curtain, before GSAP loads; any later and content would flash.
function hide(el: HTMLElement) {
  el.style.opacity = '0'
  el.style.transform = `translateY(${R.y}px)`
  const rule = ruleOf.get(el)
  if (rule) conceal(rule)
}

function conceal(rule: HTMLElement) {
  rule.style.transform = 'scaleX(0)'
}

function show(el: HTMLElement) {
  el.style.removeProperty('opacity')
  el.style.removeProperty('transform')
  el.style.removeProperty('transform-origin')
  const rule = ruleOf.get(el)
  if (rule) show(rule)
}

async function load(): Promise<RevealModules | null> {
  const m = await loadGsap()
  if (!m) {
    releaseAll()
    return null
  }
  modules = m
  return m
}

/** The guarantee behind ScrollTrigger: nothing in the viewport stays invisible. Shows without animating. */
function sweepVisible() {
  if (!import.meta.client) return
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight
  for (const entry of entries.values()) {
    if (!entry.built) continue
    for (const t of entry.targets) {
      if (!t.style.opacity && !t.style.transform) continue
      // A fired trigger owns the inline style through its delay; clearing it would flash.
      if (taken.has(t)) continue
      const r = t.getBoundingClientRect()
      const inView = r.bottom > 0 && r.top < window.innerHeight
      if (!inView) continue
      // Waiting, not stuck: a reachable trigger is left to fire, or the entrance would replay.
      const st = entry.triggers?.find(s => s.trigger === t) ?? entry.triggers?.[0]
      if (st && st.start > st.scroll() && st.start <= maxScroll) continue
      show(t)
      // So a late trigger cannot replay it.
      const rule = ruleOf.get(t)
      modules?.gsap.killTweensOf(rule ? [t, rule] : [t])
    }
  }
}

function releaseAll() {
  for (const entry of waiting) {
    for (const t of entry.targets) show(t)
  }
  waiting.clear()
  if (failsafe) { clearTimeout(failsafe); failsafe = null }
}

let fontsWatched = false
let sweepBound = false

async function refreshOnFonts(m: RevealModules) {
  if (fontsWatched || !document.fonts) return
  fontsWatched = true
  try {
    // Not document.fonts.ready, which never resolves on WebKit.
    await fontsSettled()
    m.ScrollTrigger.refresh()
  }
  catch { /* the first refresh still stands */ }
}

// Armed when the curtain lifts, not at registration: the first-load curtain outlasts the timeout.
function armFailsafe() {
  if (failsafe || !import.meta.client || modules) return
  failsafe = setTimeout(() => {
    failsafe = null
    if (!modules) releaseAll()
  }, R.loadTimeoutMs)
}

const hasArabic = (el: HTMLElement) => ARABIC_RANGE.test(el.textContent ?? '')

// SplitText's inline overflow: clip cuts Arabic dots and shifts WebKit baselines; clip-path
// masks (main.css) take no part in layout. Call from every onSplit: a re-split builds new masks.
function giveRoom(masks: readonly Element[]) {
  for (const mask of masks as HTMLElement[]) {
    mask.style.removeProperty('overflow')
    mask.classList.add(hasArabic(mask) ? 'u-mask-room' : 'u-mask-tight')
  }
}

function buildType(entry: Entry, m: RevealModules) {
  const { gsap, SplitText } = m
  const el = entry.el

  if (entry.kind === 'scramble') {
    // Never scramble Arabic: random glyphs break a joined script.
    if (hasArabic(el)) return buildLines(entry, m)

    const text = el.textContent ?? ''
    entry.ctx = gsap.context(() => {
      gsap.to(el, {
        duration: K.scramble.duration,
        scrambleText: { text, chars: K.scramble.chars, speed: K.scramble.speed },
        ease: 'none',
        scrollTrigger: { trigger: el, start: K.start, once: true },
      })
    })
    return
  }

  if (entry.kind === 'lines') return buildLines(entry, m)

  // Arabic splits into words: per-character splitting breaks the joining.
  const grain = hasArabic(el) ? 'words' : 'chars'

  entry.ctx = gsap.context(() => {
    // Never reverted: split text is slightly wider (no kerning across boxes), so a revert twitches the line.
    let played = false
    SplitText.create(el, {
      // Words too, so lines break only between words; the intro finds the name by these classes.
      type: grain === 'chars' ? 'words,chars' : 'words',
      mask: grain,
      wordsClass: 'word',
      charsClass: 'char',
      aria: ariaFor(el),
      autoSplit: true,
      onSplit: (self) => {
        giveRoom(self.masks)
        const parts = grain === 'chars' ? self.chars : self.words
        // A re-split after the reveal has run must not replay it.
        if (played) return gsap.set(parts, { clearProps: 'all' })
        return gsap.from(parts, {
          // Words only ever means Arabic, whose masks reach further down.
          yPercent: grain === 'words' ? K.room.yPercent : K.chars.yPercent,
          opacity: 0,
          duration: K.chars.duration,
          ease: K.chars.ease,
          stagger: K.chars.stagger,
          scrollTrigger: { trigger: el, start: K.start, once: true },
          onComplete: () => {
            played = true
            landed(el)
          },
        })
      },
    })

    // Scaling is safe here: the masks scale with the glyphs.
    gsap.from(el, {
      scale: K.rise.scale,
      duration: K.rise.duration,
      ease: K.rise.ease,
      transformOrigin: getComputedStyle(el).direction === 'rtl' ? 'right center' : 'left center',
      scrollTrigger: { trigger: el, start: K.start, once: true },
      onComplete: () => gsap.set(el, { clearProps: 'transform,transformOrigin' }),
    })

  })
}

function buildLines(entry: Entry, m: RevealModules) {
  const { gsap, SplitText } = m
  const el = entry.el

  entry.ctx = gsap.context(() => {
    // Not reverted; autoSplit re-splits on resize so line breaks follow the viewport.
    let played = false
    const arabic = hasArabic(el)
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      aria: ariaFor(el),
      autoSplit: true,
      onSplit: (self) => {
        if (arabic) giveRoom(self.masks)
        if (played) return gsap.set(self.lines, { clearProps: 'all' })
        return gsap.from(self.lines, {
          yPercent: arabic ? K.room.yPercent : K.lines.yPercent,
          opacity: 0,
          duration: K.lines.duration,
          ease: K.lines.ease,
          stagger: K.lines.stagger,
          scrollTrigger: { trigger: el, start: K.start, once: true },
          // The contact card's pen waits for this landed mark.
          onComplete: () => { played = true; landed(el) },
        })
      },
    })
  })
}

/** Split as the entrance would, but at rest (intro, language mirror), so the hover finds the same letters. */
function splitAtRest(entry: Entry, m: RevealModules) {
  const { gsap, SplitText } = m
  const el = entry.el
  const grain = hasArabic(el) ? 'words' : 'chars'
  entry.ctx = gsap.context(() => {
    SplitText.create(el, {
      type: grain === 'chars' ? 'words,chars' : 'words',
      mask: grain,
      wordsClass: 'word',
      charsClass: 'char',
      aria: ariaFor(el),
      autoSplit: true,
      onSplit: (self) => {
        giveRoom(self.masks)
        const parts = (grain === 'chars' ? self.chars : self.words) as HTMLElement[]
        return gsap.set(parts, { clearProps: 'all' })
      },
    })
  })
}

/** Scrubbed row emphasis on the link inside each row, so it composes with the row's own reveal. */
function buildFocus(el: HTMLElement, selector: string, m: RevealModules) {
  const { gsap } = m
  const rows = Array.from(el.querySelectorAll<HTMLElement>(selector))

  // The stylesheet carries the same default, for a page without JavaScript.
  gsap.set(el, { '--row-recess': I.recess })

  for (const row of rows) {
    const target = row.querySelector<HTMLElement>('.row__link') ?? row
    gsap.set(target, { '--row-focus': I.floor })
    gsap.timeline({
      scrollTrigger: {
        trigger: row,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.4,
      },
    })
      .to(target, { '--row-focus': 1, ease: 'none', duration: 1 })
      .to(target, { '--row-focus': I.floor, ease: 'none', duration: 1 })
  }
}

// SplitText aria 'hidden' hides the element itself; 'auto' adds aria-label, which is prohibited
// on role-less elements. So headings get 'auto', everything else 'none'.
function ariaFor(el: HTMLElement): 'auto' | 'none' {
  return /^H[1-6]$/.test(el.tagName) ? 'auto' : 'none'
}

/** Set once the letters have landed; the hero's hover (useSignedName) binds to nothing before it. */
export const LANDED = 'data-landed'
function landed(el: HTMLElement) {
  el.setAttribute(LANDED, '')
}

// A scale, not a width: width is layout and would move the date beside the rule.
const wipeFrom = { scaleX: 0 }
function wipeTo(stagger = 0) {
  return {
    scaleX: 1,
    duration: RULE.wipe,
    ease: 'reveal',
    stagger,
    transformOrigin: (_: number, el: Element) =>
      (getComputedStyle(el).direction === 'rtl' ? 'right center' : 'left center'),
    clearProps: 'transform,transformOrigin',
  }
}

function build(entry: Entry, m: RevealModules) {
  if (entry.built) return
  entry.built = true

  const { gsap, ScrollTrigger } = m

  if (entry.kind === 'wipe') {
    if (entry.el.getBoundingClientRect().top < 0) { show(entry.el); return }
    entry.ctx = gsap.context(() => {
      entry.triggers = [gsap.fromTo(entry.el, wipeFrom, {
        ...wipeTo(),
        delay: RULE.lag,
        scrollTrigger: { trigger: entry.el, start: R.start, once: true, onEnter: () => taken.add(entry.el) },
      }).scrollTrigger!]
    })
    return
  }

  if (entry.kind !== 'reveal') {
    if (entry.el.getBoundingClientRect().top < 0) { show(entry.el); return }
    show(entry.el) // the split's own mask hides it from here on
    buildType(entry, m)
    return
  }

  // Already scrolled past (e.g. Back into a restored scroll) is shown, never animated.
  // Once set, `pending` (fold() or a mirror) wins; a `below` entry without it animates nothing.
  const candidates = entry.pending ?? (entry.options.below ? [] : entry.targets)

  const fresh: HTMLElement[] = []
  for (const t of candidates) {
    if (t.getBoundingClientRect().top < 0) show(t)
    else fresh.push(t)
  }
  if (!fresh.length) {
    // Row focus is not an entrance: build it even when no row is left to enter.
    if (entry.options.batch && entry.options.focus) {
      entry.ctx = gsap.context(() => buildFocus(entry.el, entry.options.children!, m))
    }
    return
  }

  const from = { opacity: 0, y: R.y }
  const to = {
    opacity: 1,
    y: 0,
    duration: R.duration,
    ease: 'reveal',
    // A held transform would make a containing block for fixed descendants.
    clearProps: 'all',
  }

  const rulesOf = (targets: HTMLElement[]) =>
    targets.map(t => ruleOf.get(t)).filter((r): r is HTMLElement => !!r)

  entry.ctx = gsap.context(() => {
    if (entry.options.batch) {
      if (entry.options.focus) buildFocus(entry.el, entry.options.children!, m)

      entry.triggers = ScrollTrigger.batch(fresh, {
        start: R.start,
        once: true,
        onEnter: (batched) => {
          const rows = batched as HTMLElement[]
          for (const t of rows) taken.add(t)
          gsap.fromTo(rows, from, { ...to, stagger: R.stagger, overwrite: true })
          const rules = rulesOf(rows)
          if (rules.length) gsap.fromTo(rules, wipeFrom, { ...wipeTo(R.stagger), delay: R.duration + RULE.lag })
        },
      })
      return
    }

    const stagger = fresh.length > 1 ? R.stagger : 0
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: entry.el,
        start: R.start,
        once: true,
        onEnter: () => { for (const t of fresh) taken.add(t) },
      },
    })
    entry.triggers = tl.scrollTrigger ? [tl.scrollTrigger] : []
    tl.fromTo(fresh, from, { ...to, stagger })
    const rules = rulesOf(fresh)
    if (rules.length) tl.fromTo(rules, wipeFrom, wipeTo(stagger), R.duration + RULE.lag)
  })
}

async function drain() {
  if (!armed || !waiting.size) return
  const m = modules ?? await load()
  if (!m || !armed) return

  for (const entry of [...waiting]) {
    waiting.delete(entry)
    build(entry, m)
  }

  // The scroll was restored while covered, so earlier measurements are stale.
  m.ScrollTrigger.refresh()

  // Again once fonts land: a late reflow can strand a once-trigger below a line it already crossed.
  void refreshOnFonts(m)

  if (!sweepBound) {
    sweepBound = true
    let t: ReturnType<typeof setTimeout> | null = null
    const later = () => { if (t) clearTimeout(t); t = setTimeout(sweepVisible, 180) }
    window.addEventListener('scroll', later, { passive: true })
    window.addEventListener('resize', later, { passive: true })
    later()
  }

  if (failsafe) { clearTimeout(failsafe); failsafe = null }
}

export function useReveal() {
  function register(el: HTMLElement, kind: RevealKind = 'reveal', options: RevealOptions = {}) {
    if (!import.meta.client) return
    // The real reduced-motion gate: main.css's block cannot reach JS tweens.
    if (stillness()) return
    // Never hide what is already on screen (the curtain's CSS failsafe may have
    // uncovered the page), unless a mirror holds the old frame over it.
    if (curtainAlreadyOff() && !heldByMirror) return

    const targets = kind === 'reveal' && options.children
      ? Array.from(el.querySelectorAll<HTMLElement>(scoped(options.children)))
      : [el]
    if (!targets.length) return

    if (kind === 'reveal' && options.wipe) {
      for (const t of targets) {
        const rule = t.querySelector<HTMLElement>(options.wipe)
        if (rule) ruleOf.set(t, rule)
      }
    }

    // `below` waits for fold(); under a mirror, settleInView() decides.
    if (!options.below && !heldByMirror) for (const t of targets) (kind === 'wipe' ? conceal : hide)(t)

    const entry: Entry = { el, kind, options, targets, built: false }
    entries.set(el, entry)
    waiting.add(entry)

    void load().then(() => drain())
    void drain()
  }

  function unregister(el: HTMLElement) {
    const entry = entries.get(el)
    if (!entry) return
    entries.delete(el)
    waiting.delete(entry)
    entry.ctx?.revert()
    for (const t of entry.targets) show(t)
  }

  /** Hand a heading's entrance to the first-load intro: split now, at rest, under the cover. */
  function prepare(el: HTMLElement): { words: () => HTMLElement[], settle: () => void } | null {
    const entry = entries.get(el)
    const m = modules ?? gsapModules()
    if (!entry || !m || entry.built || entry.kind !== 'chars') return null
    entry.built = true
    waiting.delete(entry)
    modules = m
    show(el)
    splitAtRest(entry, m)

    return {
      words: () => Array.from(el.querySelectorAll<HTMLElement>('.word')),
      settle: () => landed(el),
    }
  }

  /** Called by the curtain while covered, once layout and scroll are final: hide only what is below the fold. */
  function fold() {
    if (!import.meta.client || stillness()) return
    if (curtainAlreadyOff()) return

    for (const entry of entries.values()) {
      if (!entry.options.below || entry.pending || entry.built) continue
      const hidden: HTMLElement[] = []
      for (const t of entry.targets) {
        if (t.getBoundingClientRect().top < window.innerHeight) continue
        hide(t)
        hidden.push(t)
      }
      entry.pending = hidden
    }
  }

  /** After a language mirror: on screen stays at rest, below the screen keeps its entrance. */
  function settleInView() {
    heldByMirror = false
    if (!import.meta.client || stillness()) return
    const m = modules ?? gsapModules()
    const below = (t: HTMLElement) => t.getBoundingClientRect().top >= window.innerHeight

    for (const entry of entries.values()) {
      if (entry.built) continue

      if (entry.kind === 'reveal') {
        const later: HTMLElement[] = []
        for (const t of entry.targets) {
          if (below(t)) {
            hide(t)
            later.push(t)
          }
          else {
            show(t)
          }
        }
        entry.pending = later
        continue
      }

      // Hidden now: a mirror hid nothing at registration.
      if (below(entry.el)) {
        (entry.kind === 'wipe' ? conceal : hide)(entry.el)
        continue
      }

      show(entry.el)
      if (entry.kind === 'chars' && m) {
        modules = m
        splitAtRest(entry, m)
        landed(entry.el)
      }
      entry.built = true
      waiting.delete(entry)
    }
  }

  /** `false` lets go without settling, for an abandoned mirror. */
  function hold(on = true) {
    heldByMirror = on
  }

  /** The curtain is lifting: the page is about to be seen. */
  function arm() {
    if (!import.meta.client || armed) return
    armed = true
    armFailsafe()
    void drain()
  }

  /** The curtain is closing: hold everything until it opens again. */
  function disarm() {
    armed = false
  }

  return { register, unregister, prepare, fold, settleInView, hold, arm, disarm }
}

// From geometry: at hydration the curtain's state still says covered.
function curtainAlreadyOff() {
  const panel = document.querySelector('.curtain__panel')
  if (!panel) return false
  const r = panel.getBoundingClientRect()
  return r.bottom <= 0 || r.top >= window.innerHeight
}

// `> *` alone is invalid in querySelectorAll; :scope makes it legal.
function scoped(selector: string) {
  return selector
    .split(',')
    .map(s => (s.trim().startsWith('>') ? `:scope ${s.trim()}` : s.trim()))
    .join(', ')
}
