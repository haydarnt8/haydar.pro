import { contact as C, kinetic as K } from '~/config/motion'

type Timeline = ReturnType<NonNullable<ReturnType<typeof gsapModules>>['gsap']['timeline']>

// CSS owns where things rest (`visibility: hidden` also drops them from tabbing and AT). Each move runs after
// render and hands every property back; under reduced motion each returns before touching anything.
export function useContactMotion() {
  const running = new Map<HTMLElement, Timeline>()

  /** `dir` 1 rolls up, -1 down. A second roll FINISHES the first: kill() skips the onComplete that hands layers back. */
  async function roll(slot: HTMLElement | null, from: HTMLElement | null, to: HTMLElement | null, dir: 1 | -1) {
    if (!slot || !from || !to || from === to) return
    const m = await loadGsap()
    if (!m || prefersStillness()) return
    const { gsap } = m

    running.get(slot)?.progress(1)

    // The slot clips only while moving, so a focus ring is never cut off at rest.
    gsap.set([from, to], { visibility: 'visible' })
    slot.classList.add('is-rolling')

    const tl = gsap.timeline({
      defaults: { duration: C.roll.duration, ease: 'reveal' },
      onComplete: () => {
        gsap.set([from, to], { clearProps: 'transform,visibility' })
        slot.classList.remove('is-rolling')
        if (running.get(slot) === tl) running.delete(slot)
      },
    })
      .fromTo(to, { yPercent: dir * C.roll.yPercent }, { yPercent: 0 }, 0)
      .fromTo(from, { yPercent: 0 }, { yPercent: -dir * C.roll.yPercent }, 0)

    running.set(slot, tl)
    return tl
  }

  async function shake(el: HTMLElement | null) {
    if (!el) return
    const m = await loadGsap()
    if (!m || prefersStillness()) return
    const { gsap } = m
    const x = C.shake.x
    gsap.fromTo(el, { x: 0 }, {
      keyframes: { x: [0, -x, x, -x * 0.6, x * 0.6, -x * 0.25, 0], easeEach: 'sine.inOut' },
      duration: C.shake.duration,
      ease: 'none',
      overwrite: true,
      onComplete: () => { gsap.set(el, { clearProps: 'transform' }) },
    })
  }

  /** text-indent, not an overlay: the input clips its own text, and indent is logical for RTL. Caret hidden for the trip. */
  async function post(input: HTMLInputElement | null) {
    if (!input) return
    const m = await loadGsap()
    if (!m || prefersStillness()) return
    input.classList.add('is-posting')
    return m.gsap.to(input, {
      textIndent: input.clientWidth,
      duration: C.post.duration,
      ease: C.post.ease,
      overwrite: true,
    })
  }

  async function unpost(input: HTMLInputElement | null) {
    if (!input) return
    const m = await loadGsap()
    if (!m) return
    if (prefersStillness()) return rest(input)
    m.gsap.fromTo(input, { textIndent: input.clientWidth }, {
      textIndent: 0,
      duration: C.unpost.duration,
      ease: 'reveal',
      overwrite: true,
      onComplete: () => rest(input),
    })
  }

  function rest(input: HTMLInputElement | null) {
    if (!input) return
    gsapModules()?.gsap.killTweensOf(input, 'textIndent')
    input.style.removeProperty('text-indent')
    input.classList.remove('is-posting')
  }

  async function pen(field: HTMLElement | null, how: 'arrive' | 'focus') {
    const svg = field?.querySelector<SVGSVGElement>('.contact__ring')
    const rect = svg?.querySelector('rect')
    const input = field?.querySelector('input')
    if (!svg || !rect || !input) return
    const [m, drawSVG] = await Promise.all([loadGsap(), loadPlugin('DrawSVGPlugin')])
    if (!m || !drawSVG || prefersStillness()) return
    const { gsap } = m

    const w = input.offsetWidth
    const h = input.offsetHeight
    const r = Math.max(0, Number.parseFloat(getComputedStyle(input).borderTopLeftRadius) - 1)
    gsap.set(rect, { attr: { x: 1, y: 1, width: Math.max(0, w - 2), height: Math.max(0, h - 2), rx: r, ry: r } })
    gsap.killTweensOf([svg, rect])
    gsap.set(svg, { opacity: 1 })

    const tl = gsap.timeline()
      .fromTo(rect, { drawSVG: '0%' }, { drawSVG: '100%', duration: how === 'arrive' ? C.pen.arrive : C.pen.focus, ease: C.pen.ease })
    if (how === 'arrive') {
      tl.to(svg, { opacity: 0, duration: C.pen.fade, onComplete: () => { gsap.set([svg, rect], { clearProps: 'all' }); clean(svg, rect) } })
    }
    return tl
  }

  async function lift(field: HTMLElement | null) {
    const svg = field?.querySelector<SVGSVGElement>('.contact__ring')
    const rect = svg?.querySelector('rect')
    const m = await loadGsap()
    if (!svg || !rect || !m || !svg.style.opacity) return
    const { gsap } = m
    gsap.killTweensOf([svg, rect])
    gsap.to(rect, {
      drawSVG: '0%',
      duration: C.pen.lift,
      ease: 'power2.in',
      onComplete: () => { gsap.set([svg, rect], { clearProps: 'all' }); clean(svg, rect) },
    })
  }

  /** A custom property read as scaleX, not an inline transform (noInlineMotionLeft); set, not skipped, under stillness. */
  async function rule(field: HTMLElement | null, fraction: number, ready: boolean) {
    if (!field) return
    field.classList.toggle('is-ready', ready)
    const m = await loadGsap()
    if (!m || prefersStillness()) {
      field.style.setProperty('--fill', String(fraction))
      return
    }
    m.gsap.to(field, { '--fill': fraction, duration: C.rule.duration, ease: C.rule.ease, overwrite: true })
  }

  /** Arabic rolls instead of scrambling (see useReveal); it lands on exactly the text Vue rendered. */
  async function decode(prompt: HTMLElement | null) {
    if (!prompt) return
    const m = await loadGsap()
    if (!m || prefersStillness()) return
    const { gsap } = m
    const text = prompt.textContent?.trim() ?? ''
    if (/[\u0600-\u06FF]/.test(text)) {
      gsap.fromTo(prompt, { yPercent: 100, opacity: 0 }, {
        yPercent: 0,
        opacity: 1,
        duration: C.roll.duration,
        ease: 'reveal',
        onComplete: () => { gsap.set(prompt, { clearProps: 'transform,opacity' }) },
      })
      return
    }
    gsap.to(prompt, {
      duration: K.scramble.duration,
      ease: 'none',
      scrambleText: { text, chars: 'lowerCase', speed: K.scramble.speed },
    })
  }

  /** GSAP leaves a transform-origin on SVG it touched, which clearProps misses; removed by hand. */
  function clean(...els: Element[]) {
    for (const el of els as SVGElement[]) {
      el.style.removeProperty('transform-origin')
      if (!el.getAttribute('style')) el.removeAttribute('style')
    }
  }

  onBeforeUnmount(() => {
    for (const tl of running.values()) tl.kill()
    running.clear()
  })

  return { roll, shake, post, unpost, rest, pen, lift, rule, decode }
}
