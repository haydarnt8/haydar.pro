/** Waits for inline motion styles to stop changing: a production build cannot be asked whether GSAP is idle. */
export async function settled(page, { quietMs = 400, timeoutMs = 12_000 } = {}) {
  const started = Date.now()
  let last = null
  let lastChange = Date.now()

  while (Date.now() - started < timeoutMs) {
    const snapshot = await page.evaluate(() =>
      [...document.querySelectorAll('#stage [style]')]
        .map(el => el.getAttribute('style'))
        .join('|'))
    if (snapshot !== last) {
      last = snapshot
      lastChange = Date.now()
    }
    else if (Date.now() - lastChange >= quietMs) {
      return
    }
    await page.waitForTimeout(100)
  }
  throw new Error(`the page was still animating after ${timeoutMs}ms`)
}

// Checked by effect, not presence: a lingering will-change, a non-identity transform (a containing block for fixed
// children), a clip-path, or opacity < 1 on screen. GSAP's leftover `translate: none` is harmless.
const IDENTITY = /^(none|matrix\(1,\s*0,\s*0,\s*1,\s*0,\s*0\)|translate\(0px(,\s*0px)?\))$/

export async function noInlineMotionLeft(page, scope = '#stage', exempt = ['.slider__track']) {
  await settled(page)
  const offenders = await page.evaluate(
    ({ scope, exempt, identity }) => {
      const root = document.querySelector(scope)
      if (!root) return []
      const isIdentity = new RegExp(identity)
      const out = []

      for (const el of root.querySelectorAll('[style]')) {
        if (exempt.some(sel => el.matches(sel) || el.closest(sel))) continue

        // Below kinetic.start (88%), the earliest trigger line, an element is a reveal waiting its turn, not a leak.
        // Must agree with nothingHiddenInView.
        const r = el.getBoundingClientRect()
        const line = window.innerHeight * 0.88
        const onScreen = r.bottom > 0 && r.top < line && r.width > 0 && r.height > 0
        if (!onScreen) continue

        const held = []

        if (el.style.willChange && el.style.willChange !== 'auto') held.push(`will-change: ${el.style.willChange}`)

        const transform = el.style.transform
        if (transform && !isIdentity.test(transform.trim())) held.push(`transform: ${transform}`)

        const clip = el.style.clipPath
        if (clip && clip !== 'none') held.push(`clip-path: ${clip}`)

        const opacity = el.style.opacity
        if (opacity && Number(opacity) < 1) held.push(`opacity: ${opacity}`)

        if (held.length) {
          const name = String(el.className).split(' ')[0] || el.tagName.toLowerCase()
          out.push(`${name} holds ${held.join('; ')}`)
        }
      }
      return out
    },
    { scope, exempt, identity: IDENTITY.source },
  )
  if (offenders.length) throw new Error(`motion left behind:\n  ${offenders.join('\n  ')}`)
}

/** NoiseOverlay is position: fixed; a transform, filter or clip on any ancestor makes it scroll with the page. */
export async function grainStaysFixed(page) {
  const bad = await page.evaluate(() => {
    const noise = document.querySelector('.noise')
    if (!noise) return null
    const r = noise.getBoundingClientRect()
    const off = Math.abs(r.top) + Math.abs(r.left)
      + Math.abs(r.width - window.innerWidth) + Math.abs(r.height - window.innerHeight)
    return off > 2 ? { top: r.top, left: r.left, w: r.width, h: r.height, vw: window.innerWidth, vh: window.innerHeight } : null
  })
  if (bad) throw new Error(`the grain is no longer viewport-fixed: ${JSON.stringify(bad)}`)
}

/** A curtain that ends with `inert` left on renders fine but cannot be clicked, tabbed into or read. */
export async function curtainEndsOpen(page, budgetMs = 6000) {
  await page.waitForFunction(
    () => {
      const c = document.querySelector('.curtain')
      const stage = document.getElementById('stage')
      const covering = c?.classList.contains('is-visible') || c?.classList.contains('is-sealed')
      return !covering && !stage?.hasAttribute('inert')
    },
    undefined,
    { timeout: budgetMs },
  ).catch(async () => {
    const state = await page.evaluate(() => {
      const c = document.querySelector('.curtain')
      return { class: c?.className ?? 'no curtain', inert: !!document.getElementById('stage')?.hasAttribute('inert') }
    })
    throw new Error(`curtain did not end open within ${budgetMs}ms: ${JSON.stringify(state)}`)
  })
}

export async function nothingHiddenInView(page, { wait = true } = {}) {
  if (wait) await settled(page, { quietMs: 300, timeoutMs: 8000 }).catch(() => {})
  const hidden = await page.evaluate(() => {
    // The earliest line the engine fires at: kinetic.start (88%) fires later than reveal.start (92%).
    // Below it an element is waiting, not stuck. Must agree with noInlineMotionLeft.
    const line = window.innerHeight * 0.88
    const out = []
    for (const el of document.querySelectorAll('#stage [style*="opacity"]')) {
      if (Number(getComputedStyle(el).opacity) > 0.01) continue
      const r = el.getBoundingClientRect()
      const past = r.bottom > 0 && r.top < line && r.width > 0 && r.height > 0
      if (past) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} at y=${Math.round(r.top)}`)
    }
    return out
  })
  if (hidden.length) throw new Error(`invisible content past the reveal line:\n  ${hidden.join('\n  ')}`)
}

/** Measured against a cold render of the same route: the answer depends on viewport, locale and font. */
export async function landsWhereItShould(page, context, url, selector, tolerance = 0.5, readyWhen = null) {
  const landed = await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }
  }, selector)
  if (!landed) throw new Error(`${selector} is not on the page after the flight`)

  const cold = await context.newPage()
  await cold.goto(url, { waitUntil: 'load' })
  // `settled` alone can return in the quiet stretch before an arrival (WebKit); callers pass the page's arrival signal as readyWhen.
  if (readyWhen) await cold.waitForSelector(readyWhen, { timeout: 15_000 })
  await settled(cold)
  const expected = await cold.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }
  }, selector)
  await cold.close()
  if (!expected) throw new Error(`${selector} is missing from a cold render of ${url}`)

  const delta = {
    dx: +(landed.x - expected.x).toFixed(1),
    dy: +(landed.y - expected.y).toFixed(1),
    dw: +(landed.w - expected.w).toFixed(1),
    dh: +(landed.h - expected.h).toFixed(1),
  }
  const worst = Math.max(...Object.values(delta).map(Math.abs))
  if (worst > tolerance) throw new Error(`${selector} landed ${JSON.stringify(delta)} off (tolerance ${tolerance}px)`)
  return delta
}

export function travelDirection(frames, selector) {
  const xs = frames.map(f => f.el[selector]?.rect.x).filter(x => typeof x === 'number')
  if (xs.length < 2) return 0
  const drift = xs[xs.length - 1] - xs[0]
  return Math.abs(drift) < 1 ? 0 : Math.sign(drift)
}

export async function listenerCount(page, type) {
  const client = await page.context().newCDPSession(page)
  const { result } = await client.send('Runtime.evaluate', { expression: 'window', objectGroup: 'lk' })
  const { listeners } = await client.send('DOMDebugger.getEventListeners', { objectId: result.objectId })
  await client.detach()
  return listeners.filter(l => l.type === type).length
}

export function collectErrors(page) {
  const errors = []
  page.on('pageerror', e => errors.push(`pageerror: ${String(e).slice(0, 200)}`))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const text = m.text()
    // A failed subresource keeps its URL in the message location, not the text.
    const from = `${m.location?.().url ?? ''}`
    errors.push(`${text.slice(0, 160)}${from ? ` <- ${from.slice(-60)}` : ''}`)
  })
  return errors
}

// Card borders are drawn on ::after to stay out of layout, so an element's own border width reads 0px.
const EDGES = [
  ['.u-card', 1, 'a card carries a 1px /Border 2 hairline'],
  // The fourth entry names the pseudo-element; the element's own border must then be zero, or the edge is drawn twice.
  ['.work', 1, 'a work card is a card, its hairline laid over the cover', '::after'],
  ['.icon', 1, 'a social tile is a card'],
  ['.badge', 2, 'the arrow badge is a 2px /Border 3 ring around nothing'],
  ['.btn', 2, 'the button is a 2px /Border 3 pill'],
  ['.pill', 2, 'the theme switch is a 2px /Border 3 pill'],
]

const FILLED_NOT_OUTLINED = [
  ['.chip', 'the copy chip is /Border 1 used as a fill'],
]

export async function edgesMatchTheDesign(page) {
  const wrong = await page.evaluate(({ edges, filled }) => {
    const out = []
    const seen = el => el.getBoundingClientRect().width > 0

    const line = s => s.borderTopStyle !== 'none' ? Math.round(parseFloat(s.borderTopWidth)) : 0

    for (const [sel, width, why, pseudo] of edges) {
      for (const el of document.querySelectorAll(`#stage ${sel}`)) {
        if (!seen(el)) continue
        const drawn = line(getComputedStyle(el, pseudo ?? null))
        if (drawn !== width) {
          out.push(`${sel}${pseudo ?? ''} draws ${drawn}px, expected ${width}px — ${why}`)
          break
        }
        if (pseudo && line(getComputedStyle(el)) !== 0) {
          out.push(`${sel} draws its own border as well as its ${pseudo} — the edge is doubled`)
          break
        }
      }
    }

    for (const [sel, why] of filled) {
      for (const el of document.querySelectorAll(`#stage ${sel}`)) {
        if (!seen(el)) continue
        const s = getComputedStyle(el)
        const drawn = s.borderTopStyle !== 'none' ? parseFloat(s.borderTopWidth) : 0
        if (drawn >= 1) {
          out.push(`${sel} draws a ${s.borderTopWidth} line, expected none — ${why}`)
          break
        }
      }
    }
    return [...new Set(out)]
  }, { edges: EDGES, filled: FILLED_NOT_OUTLINED })

  if (wrong.length) throw new Error(`edges do not match the design:\n  ${wrong.join('\n  ')}`)
}

/** Measures scrollWidth, not boxes: walking rects flags legitimate scroll strips and misses escaped overflow. */
export async function noSidewaysScroll(page, slackPx = 1) {
  const found = await page.evaluate(async (slack) => {
    const settle = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    const doc = document.documentElement
    const before = window.scrollX
    window.scrollTo(doc.scrollWidth, window.scrollY)
    await settle()
    const reached = Math.round(window.scrollX)
    window.scrollTo(before, window.scrollY)
    await settle()

    if (reached <= slack) return null

    const vw = doc.clientWidth
    let worst = null
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.right > vw + slack && (!worst || r.right > worst.right)) {
        worst = { right: Math.round(r.right), sel: `${el.tagName.toLowerCase()}.${(el.className?.toString() || '').trim().split(/\s+/).join('.')}`.slice(0, 70) }
      }
    }
    return { reached, vw, scrollWidth: doc.scrollWidth, worst }
  }, slackPx)

  if (found) {
    throw new Error(
      `the page scrolls sideways ${found.reached}px (viewport ${found.vw}, scrollWidth ${found.scrollWidth})`
      + (found.worst ? ` — widest overhang: ${found.worst.sel} reaching x=${found.worst.right}` : ''),
    )
  }
}
