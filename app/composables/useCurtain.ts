import type { CurtainVariant } from '~/config/motion'
import { curtain as M, intro as INTRO, PANEL_COUNT, watchdogFor } from '~/config/motion'

// Invariant: the page is never mid-swap while any of it is visible, and the curtain always ends open.

export type CurtainStatus = 'idle' | 'closing' | 'covered' | 'opening'

export interface CurtainTarget {
  variant: CurtainVariant
  label: string
  lang: string
  dir: 'ltr' | 'rtl'
  /** Try to give the covered moment to the intro; if it cannot run, the label's beat plays instead. */
  intro?: boolean
}

interface CurtainState {
  status: CurtainStatus
  variant: CurtainVariant
  label: string
  lang: string
  dir: 'ltr' | 'rtl'
  count: number
  /** Panels rest covering from CSS alone: the SSR cover, and a remount mid-cover (error.vue swaps the root). */
  still: boolean
  intro: boolean
}

type IntroOutcome = 'done' | 'declined' | 'stale'

interface Ctx { dir: 'ltr' | 'rtl', order: (i: number) => number }

interface VariantSpec {
  count: number
  close: (panel: Element, i: number, ctx: Ctx) => Animation
  open: (panel: Element, i: number, ctx: Ctx) => Animation
}

interface CurtainDom { root: HTMLElement, panels: HTMLElement, label: SVGElement }

export interface IntroHandle {
  readonly el: HTMLElement | null
  /** False when no heading is on screen to hand the name to; the caller then plays its ordinary beat. */
  arm: () => Promise<boolean>
  play: () => Promise<void>
  fly: () => Promise<void>
  finish: () => void
  cancel: () => void
}

let dom: CurtainDom | null = null
let introHandle: IntroHandle | null = null

// Gates `inert`: only script can remove it, so SSR must never set it (no-JS or a 404'd chunk = a dead page).
// A module ref, not useState: never serialised, always false on the server.
const hydrated = ref(false)

// Run id: `Animation.finished` rejects on cancel, so a superseded run would write its status over its successor.
// Every run captures it, re-checks it after each await, and writes status only through commit().
let epoch = 0

let closingPromise: Promise<void> | null = null
let openingPromise: Promise<void> | null = null
/** The covered moment must not end before this has played. */
let labelInAnim: Animation | null = null
let watchdog: ReturnType<typeof setTimeout> | null = null
// Focus moves to the new heading only after keyboard navigation: Safari rings any element script focuses after a click.
let byKeyboard = false

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// fill: 'both': during its stagger delay a strip holds its first keyframe instead of flashing the CSS rest position.
const anim = (el: Element, frames: Keyframe[], options: KeyframeAnimationOptions) =>
  el.animate(frames, { fill: 'both', ...options })

const settled = (a: Animation) => a.finished.catch(() => {})

const VARIANTS: Record<CurtainVariant, VariantSpec> = {
  slab: {
    count: PANEL_COUNT.slab,
    close: p => anim(p, [{ transform: 'translateY(101%)' }, { transform: 'translateY(0)' }], { duration: M.close, easing: M.ease }),
    open: p => anim(p, [{ transform: 'translateY(0)' }, { transform: 'translateY(-101%)' }], { duration: M.open, easing: M.ease }),
  },
  blinds: {
    count: PANEL_COUNT.blinds,
    close: (p, i, ctx) => anim(p, [{ transform: 'translateY(-101%)' }, { transform: 'translateY(0)' }], { duration: M.close, delay: ctx.order(i) * M.stagger, easing: M.ease }),
    open: (p, i, ctx) => anim(p, [{ transform: 'translateY(0)' }, { transform: 'translateY(101%)' }], { duration: M.open, delay: ctx.order(i) * M.stagger, easing: M.ease }),
  },
  theatre: {
    count: PANEL_COUNT.theatre,
    close: (p, i) => anim(p, [{ transform: `translateX(${i ? '101%' : '-101%'})` }, { transform: 'translateX(0)' }], { duration: M.close, easing: M.ease }),
    open: (p, i) => anim(p, [{ transform: 'translateX(0)' }, { transform: `translateX(${i ? '101%' : '-101%'})` }], { duration: M.open, easing: M.ease }),
  },
  sweep: {
    count: PANEL_COUNT.sweep,
    close: (p, _i, ctx) => anim(p, [{ transform: `translateX(${ctx.dir === 'rtl' ? '101%' : '-101%'})` }, { transform: 'translateX(0)' }], { duration: M.close, easing: M.ease }),
    open: (p, _i, ctx) => anim(p, [{ transform: 'translateX(0)' }, { transform: `translateX(${ctx.dir === 'rtl' ? '-101%' : '101%'})` }], { duration: M.open, easing: M.ease }),
  },
}

const contextFor = (dir: 'ltr' | 'rtl', count: number): Ctx => ({
  dir,
  order: i => (dir === 'rtl' ? count - 1 - i : i),
})

const panelsOf = () => (dom ? Array.from(dom.panels.children) : [])

const isOffscreen = (panel: Element) => {
  const r = panel.getBoundingClientRect()
  return r.bottom <= 0 || r.top >= window.innerHeight
}

const clearPanels = () => {
  for (const p of panelsOf()) for (const a of p.getAnimations()) a.cancel()
}

// Cancel every animation: the fade-in's held fill would otherwise start the next run with the label already opaque.
const clearLabel = () => {
  if (!dom) return
  for (const a of dom.label.getAnimations()) a.cancel()
}

export function useCurtain() {
  const state = useState<CurtainState>('curtain', () => ({
    status: 'covered',
    variant: 'slab',
    label: '',
    lang: '',
    dir: 'ltr',
    count: 1,
    still: true,
    intro: false,
  }))

  const status = computed(() => state.value.status)
  const isBusy = computed(() => state.value.status !== 'idle')

  // isVisible: painted until the open animation has finished, so the slide-away is seen.
  // isSealed/isBlocking: only while the page is hidden; `still` covers the first-load beat parked over it.
  // Only isBlocking waits for hydration, because only script can remove inert; the CSS failsafe frees isSealed.
  const sealing = computed(() =>
    state.value.status === 'closing' || state.value.status === 'covered' || state.value.still)
  const isVisible = computed(() => state.value.status !== 'idle')
  const isSealed = sealing
  const isBlocking = computed(() => hydrated.value && sealing.value)

  const reduced = prefersStillness

  function commit(run: number, next: CurtainStatus) {
    if (run !== epoch) return false
    state.value.status = next
    return true
  }

  /** `extra` (ms): the intro's playing time, on top of the cycle's budget. */
  function armWatchdog(panels: number, extra = 0) {
    if (watchdog) clearTimeout(watchdog)
    const budget = watchdogFor(panels) + extra
    watchdog = setTimeout(() => {
      watchdog = null
      forceOpen(`watchdog: still ${state.value.status} after ${Math.round(budget)}ms`)
    }, budget)
  }

  function clearWatchdog() {
    if (watchdog) clearTimeout(watchdog)
    watchdog = null
  }

  const stage = () => document.getElementById('stage')

  // nextTick first: #stage stays inert until Vue writes the attribute, and focus() inside inert is ignored.
  async function focusHeading() {
    await nextTick()
    const h1 = stage()?.querySelector('h1')
    if (!h1) return // the error page has no h1
    if (!h1.hasAttribute('tabindex')) h1.tabIndex = -1
    h1.focus({ preventScroll: true })
  }

  /** Resolves once FULLY covered; the navigation guard returns it so the route cannot commit earlier. */
  function close(target: CurtainTarget): Promise<void> {
    if (!import.meta.client) return Promise.resolve()

    const run = ++epoch
    const spec = VARIANTS[target.variant]
    armWatchdog(spec.count)
    byKeyboard = !!document.activeElement?.matches(':focus-visible')
    introHandle?.cancel()
    // A finished open must not be mistaken for one in flight (see open()).
    openingPromise = null

    closingPromise = (async () => {
      if (reduced()) {
        const el = stage()
        commit(run, 'closing')
        if (el) {
          for (const a of el.getAnimations()) a.cancel()
          await settled(anim(el, [{ opacity: 1 }, { opacity: 0 }], { duration: M.reduced.out, easing: 'ease' }))
        }
        commit(run, 'covered')
        return
      }

      if (!dom) {
        commit(run, 'covered')
        return
      }

      clearPanels()
      clearLabel()
      state.value.variant = target.variant
      state.value.label = target.label
      state.value.lang = target.lang
      state.value.dir = target.dir
      state.value.count = spec.count
      state.value.intro = target.intro === true
      // Let the panel count reach the DOM before reading the children back.
      await nextTick()
      if (run !== epoch) return

      commit(run, 'closing')

      const ctx = contextFor(target.dir, spec.count)
      const panels = panelsOf()

      // Skipped when promised to the intro; the text is still set in case it declines and open() plays this beat.
      labelInAnim = target.intro
        ? null
        : anim(
            dom.label,
            [{ opacity: 0, transform: 'translateY(.15em)' }, { opacity: 1, transform: 'translateY(0)' }],
            { duration: M.open * M.label.inDur, delay: M.close * M.label.inDelay, easing: M.easeOut },
          )

      const running = panels.map((p, i) => spec.close(p, i, ctx))
      // Dropped AFTER the animations start: a frame between would paint the panels at their uncovered rest.
      state.value.still = false

      await Promise.all(running.map(settled))
      if (run !== epoch) return

      commit(run, 'covered')

      // Re-armed once covered, not at the click: a slow chunk load would spend the budget before the covered wait.
      armWatchdog(spec.count)

      // Back to the CSS covering rest, so a remount mid-cover (error.vue) renders covering instead of flashing the page.
      state.value.still = true
    })()

    return closingPromise
  }

  /** `declined`: nothing ran, the caller owes the ordinary beat. `stale`: a newer navigation owns the curtain. */
  async function introStage(run: number, handle: IntroHandle): Promise<IntroOutcome> {
    armWatchdog(1, INTRO.budgetMs)
    try {
      await handle.play()
    }
    catch (err) {
      console.error('[curtain] intro failed — opening without it', err)
      handle.cancel()
      armWatchdog(1)
      return 'declined'
    }
    if (run !== epoch) return 'stale'

    handle.fly().catch((err: unknown) => {
      console.error('[curtain] intro handoff failed — the lift goes on without it', err)
      handle.cancel()
    })
    await wait((INTRO.fly - INTRO.liftLead) * 1000)
    return run === epoch ? 'done' : 'stale'
  }

  // Panel and intro layer share one keyframe/options set: the name is erased exactly where the heading is uncovered.
  async function lift(run: number, layer: HTMLElement | null): Promise<boolean> {
    if (!dom) return false
    const panel = dom.panels.firstElementChild
    const opts: KeyframeAnimationOptions = { duration: M.open + M.reveal.panelExtra, easing: M.ease }
    const running = [
      layer
        ? anim(layer, [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 101% 0)' }], opts)
        : anim(dom.label, [{ opacity: 1 }, { opacity: 0 }], { duration: M.reveal.labelOut, easing: 'ease' }),
      ...(panel
        ? [anim(panel, [{ transform: 'translateY(0)' }, { transform: 'translateY(-101%)' }], opts)]
        : []),
    ]
    // Already true on first load; an arrival becomes 'opening' here.
    commit(run, 'opening')
    state.value.still = false

    await Promise.all(running.map(settled))
    if (run !== epoch) return false

    commit(run, 'idle')
    clearWatchdog()
    for (const a of running) a.cancel()
    clearLabel()
    return true
  }

  function open(): Promise<void> {
    if (!import.meta.client) return Promise.resolve()
    const current = state.value.status
    if (current === 'idle') return Promise.resolve()
    // Single-flight on the promise, not the status: the intro holds 'covered' for seconds and a Back press calls open() again.
    if (openingPromise) return openingPromise

    const run = epoch

    openingPromise = (async () => {
      await closingPromise
      if (run !== epoch) return

      if (reduced()) {
        const el = stage()
        commit(run, 'opening')
        let fade: Animation | null = null
        if (el) {
          fade = anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: M.reduced.in, easing: 'ease' })
          await settled(fade)
        }
        // Cancel even when superseded: the fade must not be left filling (see below).
        if (run !== epoch) { fade?.cancel(); return }
        // A remount inside a covered window sets `still` back to true.
        state.value.still = false
        commit(run, 'idle')
        clearWatchdog()
        // Cancel, don't leave it filling: a held opacity animation keeps #stage a stacking context and the
        // containing block of the fixed grain overlay for the rest of the session.
        fade?.cancel()
        if (byKeyboard) void focusHeading()
        return
      }

      // Arrival at home: the intro takes the covered moment. Any failure falls back to the label's beat skipped in close().
      if (state.value.intro && dom && introHandle) {
        const handle = introHandle
        const armed = await handle.arm()
        if (run !== epoch) return

        if (armed) {
          const outcome = await introStage(run, handle)
          if (outcome === 'stale') return
          if (outcome === 'done') {
            if (!await lift(run, handle.el)) return
            handle.finish()
            if (byKeyboard) void focusHeading()
            return
          }
        }
        else {
          handle.cancel()
        }

        if (!labelInAnim && state.value.label) {
          labelInAnim = anim(
            dom.label,
            [{ opacity: 0, transform: 'translateY(.15em)' }, { opacity: 1, transform: 'translateY(0)' }],
            { duration: M.reveal.labelIn, easing: M.easeOut },
          )
        }
      }

      if (labelInAnim) await settled(labelInAnim)
      await wait(M.hold)
      if (run !== epoch) return

      if (!dom) {
        commit(run, 'idle')
        clearWatchdog()
        return
      }

      const spec = VARIANTS[state.value.variant]
      const ctx = contextFor(state.value.dir, state.value.count)
      const panels = panelsOf()

      // 'opening' before the animations start unseals the page; the status holds until they finish so the curtain stays painted.
      commit(run, 'opening')

      const running = [
        anim(dom.label, [{ opacity: 1 }, { opacity: 0 }], { duration: Math.max(M.label.outMin, M.open * M.label.outDur), easing: 'ease' }),
        ...panels.map((p, i) => spec.open(p, i, ctx)),
      ]
      state.value.still = false

      await Promise.all(running.map(settled))
      if (run !== epoch) return

      commit(run, 'idle')
      clearWatchdog()

      // fill: forwards would otherwise stack one held animation per navigation.
      for (const a of running) a.cancel()
      clearLabel()
      if (byKeyboard) void focusHeading()
    })()

    return openingPromise
  }

  /** Finishes rather than cancels: cancel() returns panels to their off-screen rest and would reveal the unswapped page. */
  function forceOpen(reason: string) {
    if (!import.meta.client) return
    console.warn(`[curtain] forced open — ${reason}`)
    clearWatchdog()
    introHandle?.cancel()

    const was = state.value.status
    epoch++
    closingPromise = null
    openingPromise = null

    if (was === 'idle') return

    if (was === 'opening') {
      clearPanels()
      clearLabel()
      // `still` too: it is half of `sealing`, and leaving it set keeps #stage inert for the session.
      state.value.still = false
      state.value.status = 'idle'
      return
    }

    const run = epoch
    void (async () => {
      if (!dom || reduced()) {
        const el = stage()
        if (el) for (const a of el.getAnimations()) a.cancel()
        if (el) el.style.opacity = ''
        state.value.still = false
        commit(run, 'idle')
        return
      }
      const spec = VARIANTS[state.value.variant]
      const ctx = contextFor(state.value.dir, state.value.count)
      commit(run, 'opening')
      const running = [
        anim(dom.label, [{ opacity: 0 }], { duration: M.label.outMin, easing: 'ease' }),
        ...panelsOf().map((p, i) => spec.open(p, i, ctx)),
      ]
      state.value.still = false
      await Promise.all(running.map(settled))
      if (run !== epoch) return
      commit(run, 'idle')
      for (const a of running) a.cancel()
      clearLabel()
    })()
  }

  /** `ready` is awaited before anything moves, so the reveal never uncovers an empty document. */
  async function reveal(labelText: string, lang: string, ready: Promise<unknown>, withIntro?: () => boolean) {
    if (!import.meta.client) return

    const run = ++epoch
    // 'opening' from the outset makes the guard drop clicks for the whole reveal.
    commit(run, 'opening')

    if (reduced() || !dom) {
      await ready
      if (run !== epoch) return
      // `still` is SSR'd true and nothing here animates the panels; left set, #stage stays inert for the session.
      state.value.still = false
      commit(run, 'idle')
      clearWatchdog()
      return
    }

    await ready
    if (run !== epoch) return

    let intro = withIntro?.() ? introHandle : null

    // The CSS failsafe may have uncovered the page before hydration on a slow network; don't lift it a second time.
    const first = dom.panels.firstElementChild
    if (first && isOffscreen(first)) {
      introHandle?.cancel()
      state.value.still = false
      commit(run, 'idle')
      clearWatchdog()
      return
    }

    // Wanted the intro but it lost its race: its hidden layer must not linger.
    if (!intro) introHandle?.cancel()

    if (intro) {
      const outcome = await introStage(run, intro)
      if (outcome === 'stale') return
      if (outcome === 'declined') intro = null
    }
    else {
      armWatchdog(1)
      state.value.label = labelText
      state.value.lang = lang

      await settled(anim(
        dom.label,
        [{ opacity: 0, transform: 'translateY(.15em)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: M.reveal.labelIn, easing: M.easeOut },
      ))
      if (run !== epoch) return

      await wait(M.reveal.hold)
      if (run !== epoch) return
    }

    if (!await lift(run, intro?.el ?? null)) return
    intro?.finish()
    // No focus move on first load: it would fight the browser's initial placement.
  }

  /** Label, language and intro only: changing variant or panel count mid-close destroys panels whose animations are awaited. */
  function retarget(target: Pick<CurtainTarget, 'label' | 'lang' | 'intro'>) {
    state.value.label = target.label
    state.value.lang = target.lang
    state.value.intro = target.intro === true
  }

  const pending = () => closingPromise ?? undefined

  async function run(target: CurtainTarget, swap: () => void | Promise<void>) {
    await close(target)
    try {
      await swap()
    }
    finally {
      await open()
    }
  }

  function registerDom(next: CurtainDom) {
    // Only a remount opens from here; the first mount belongs to reveal(), and opening here as well raced it.
    const remount = hydrated.value
    dom = next
    hydrated.value = true
    // A remount mid-cover arrives with fresh panels; they must render covering or the page flashes before the open.
    if (remount && (state.value.status === 'covered' || state.value.status === 'closing')) {
      state.value.still = true
      void open()
    }
  }

  function releaseDom(el: HTMLElement) {
    if (dom?.root === el) dom = null
  }

  function registerIntro(handle: IntroHandle) {
    introHandle = handle
  }

  function releaseIntro(handle: IntroHandle) {
    if (introHandle === handle) introHandle = null
  }

  return {
    state,
    status,
    isBusy,
    isVisible,
    isSealed,
    isBlocking,
    close,
    open,
    reveal,
    forceOpen,
    retarget,
    pending,
    run,
    registerDom,
    releaseDom,
    registerIntro,
    releaseIntro,
    focusHeading,
  }
}
