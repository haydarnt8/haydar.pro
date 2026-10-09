// Per-frame recorder: window.__watch(selectors) starts it, window.__frames() returns the record. Installed with
// addInitScript so it sees the first frame of the first load; kept cheap so it does not change the timings it measures.

/** Must be self-contained: it is stringified into the page. */
export function installSampler() {
  const state = { watching: [], frames: [], running: false, t0: 0 }
  window.__motionProbe = state

  const read = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return {
      transform: cs.transform === 'none' ? null : cs.transform,
      opacity: Number(cs.opacity),
      visibility: cs.visibility,
      clipPath: cs.clipPath === 'none' ? null : cs.clipPath,
      scale: cs.scale === 'none' ? null : cs.scale,
      rect: { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) },
      inlineStyle: el.getAttribute('style') || null,
    }
  }

  const tick = () => {
    if (!state.running) return
    const frame = { t: Math.round(performance.now() - state.t0), el: {} }
    for (const sel of state.watching) frame.el[sel] = read(sel)
    frame.scrollY = Math.round(window.scrollY)
    const curtain = document.querySelector('.curtain')
    frame.curtain = curtain
      ? {
          visible: curtain.classList.contains('is-visible'),
          sealed: curtain.classList.contains('is-sealed'),
          panels: document.querySelectorAll('.curtain__panel').length,
        }
      : null
    frame.stageInert = !!document.getElementById('stage')?.hasAttribute('inert')
    state.frames.push(frame)
    requestAnimationFrame(tick)
  }

  window.__watch = (selectors, ms = 6000) => {
    state.watching = Array.isArray(selectors) ? selectors : [selectors]
    state.frames = []
    state.t0 = performance.now()
    state.running = true
    requestAnimationFrame(tick)
    setTimeout(() => { state.running = false }, ms)
  }

  window.__frames = () => state.frames
  window.__stopWatch = () => { state.running = false }
}

export async function attachSampler(context) {
  await context.addInitScript(installSampler)
}
