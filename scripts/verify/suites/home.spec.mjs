import { expect, test } from '@playwright/test'
import { curtainEndsOpen, grainStaysFixed, noInlineMotionLeft, nothingHiddenInView, settled } from '../lib/assert.mjs'
import { installSampler } from '../lib/sampler.mjs'
import { isFine, isStill, isTouch } from '../lib/project.mjs'

// The intro owns the blocks on screen, the reveal engine the rest: none owned twice, none by neither.

const BLOCKS = '#stage .wrap .u-card:not(.info), #stage .wrap .work, #stage .wrap .intro__photo, #stage .wrap .icon'

test.beforeEach(async ({ context }) => {
  await context.addInitScript(installSampler)
})

test('the arrival assembles what is on screen and holds the rest', async ({ page }) => {
  await page.goto('/?intro=1')
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(900)

  const after = await page.evaluate((sel) => {
    const blocks = [...document.querySelectorAll(sel)]
    const vh = window.innerHeight
    return {
      total: blocks.length,
      hidden: blocks.filter(el => Number(getComputedStyle(el).opacity) < 0.01).length,
      scrollable: document.body.scrollHeight > vh + 10,
    }
  }, BLOCKS)

  expect(after.total, 'the bento should have blocks to animate').toBeGreaterThan(10)

  if (isStill()) {
    expect(after.hidden, 'stillness must hold nothing back').toBe(0)
  }
  else if (after.scrollable) {
    expect(after.hidden, 'a scrolling column should hold its below-fold blocks').toBeGreaterThan(0)
  }
  else {
    expect(after.hidden, 'a pinned grid must not hide anything').toBe(0)
  }

  await nothingHiddenInView(page)
  await grainStaysFixed(page)
})

test('everything the column holds is released by the scroll', async ({ page }) => {
  await page.goto('/')
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(900)

  const height = await page.evaluate(() => document.body.scrollHeight)
  const viewport = page.viewportSize()?.height ?? 900
  test.skip(height <= viewport + 10, 'the pinned grid does not scroll')

  for (let y = 0; y < height; y += Math.floor(viewport * 0.6)) {
    await page.evaluate(to => window.scrollTo(0, to), y)
    await page.waitForTimeout(450)
    await nothingHiddenInView(page)
  }

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(1200)

  const left = await page.evaluate((sel) =>
    [...document.querySelectorAll(sel)].filter(el => Number(getComputedStyle(el).opacity) < 0.01).length, BLOCKS)
  expect(left, 'every block should be visible once the column has been scrolled through').toBe(0)

  await noInlineMotionLeft(page)
})

test('an arrival from another page splits the column the same way', async ({ page }) => {
  await page.goto('/')
  await curtainEndsOpen(page, 9000)

  await page.click('a[href="/about"]')
  await page.waitForURL('**/about')
  await curtainEndsOpen(page)

  await page.click('a.close')
  await page.waitForURL(url => !url.pathname.includes('about'))
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(900)

  await nothingHiddenInView(page)
  await grainStaysFixed(page)
})

test('the frame is drawn with the build and handed back to CSS', async ({ page }) => {
  test.skip(isStill(), 'nothing is drawn under reduced motion')
  test.skip((page.viewportSize()?.width ?? 0) < 1200, 'the frame is rendered below 1200, but only DRAWN from L')

  await page.goto('/?intro=1')

  const seen = []
  const until = Date.now() + 6000
  while (Date.now() < until) {
    seen.push(await page.evaluate(() => {
      const r = document.querySelector('.frame__line')
      if (!r) return null
      return { dash: getComputedStyle(r).strokeDasharray, w: Math.round(r.getBoundingClientRect().width) }
    }))
    await page.waitForTimeout(120)
  }

  const present = seen.filter(x => x && x.w > 0)
  const drawing = present.filter(x => x.dash && x.dash !== 'none')
  expect(drawing.length, 'the frame should be drawn, not simply painted').toBeGreaterThan(2)

  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(800)

  const rest = await page.evaluate(() => {
    const r = document.querySelector('.frame__line')
    return {
      dash: getComputedStyle(r).strokeDasharray,
      inline: r.getAttribute('style'),
      width: r.getAttribute('width'),
      box: Math.round(r.getBoundingClientRect().width),
      viewport: window.innerWidth,
    }
  })
  expect(rest.dash, 'the dash pattern must be cleared').toBe('none')
  expect(rest.inline ?? '', 'no inline style may be left on the frame').toBe('')
  expect(rest.width, 'the frame must go back to sizing itself').toContain('%')
  expect(rest.box).toBeGreaterThan(rest.viewport - 80)
})

test('the frame is drawn from the reading-start corner', async ({ page }) => {
  // A rect's stroke starts top-left; in Arabic the frame is mirrored so it starts top-right.
  test.skip(isStill(), 'nothing is drawn under reduced motion')
  test.skip((page.viewportSize()?.width ?? 0) < 1200, 'checked where the intro draws it')

  const mirror = async (route) => {
    await page.goto(route)
    await curtainEndsOpen(page, 9000)
    return page.evaluate(() => getComputedStyle(document.querySelector('.frame')).transform)
  }
  expect(await mirror('/'), 'English: the rect as authored').toBe('none')
  expect(await mirror('/ar'), 'Arabic: mirrored, so the stroke starts top-right').toBe('matrix(-1, 0, 0, 1, 0, 0)')
})

test('the cover leans against the pointer and lets go afterwards', async ({ page }) => {
  const fine = isFine()

  await page.goto('/')
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(900)

  const card = page.locator('.work').first()
  // Wholly on screen first, or the far move can leave the page and fire the card's own leave.
  await card.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  const box = await card.boundingBox()
  expect(box, 'there should be a work card to hover').not.toBeNull()

  const drift = () => page.evaluate(() => {
    const el = document.querySelector('.work__media')
    if (!el) return null
    const t = getComputedStyle(el).transform
    if (!t || t === 'none') return { x: 0, y: 0 }
    const v = t.match(/matrix\(([^)]+)\)/)?.[1].split(',').map(Number) ?? []
    return { x: +(v[4] ?? 0).toFixed(1), y: +(v[5] ?? 0).toFixed(1) }
  })

  expect(await drift(), 'nothing should be displaced before the pointer arrives').toEqual({ x: 0, y: 0 })

  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.2)
  await page.waitForTimeout(700)
  const near = await drift()

  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.8, { steps: 8 })
  await page.waitForTimeout(800)
  const far = await drift()

  if (!fine) {
    expect(near, 'a coarse pointer must not bind the parallax').toEqual({ x: 0, y: 0 })
    expect(far).toEqual({ x: 0, y: 0 })
    return
  }

  expect(Math.sign(near.x), 'the cover should lean against the cursor').toBe(-Math.sign(far.x))
  expect(Math.abs(near.x)).toBeLessThan(8)
  expect(Math.abs(near.y)).toBeLessThan(8)

  await page.mouse.move(5, 5)
  await page.waitForTimeout(1400)
  const left = await page.evaluate(() => ({
    media: document.querySelector('.work__media')?.getAttribute('style') ?? '',
    card: document.querySelector('.work')?.getAttribute('style') ?? '',
  }))
  expect(left.media, 'the cover must be handed back to CSS').toBe('')
  expect(left.card, 'the spotlight properties must be cleared too').toBe('')
})

const wordBox = page => page.evaluate(() => {
  const w = [...document.querySelectorAll('[data-intro-name] .word')].find(el => el.textContent.trim() === 'Haydar')
  if (!w) return null
  const r = w.getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height }
})

const signedState = page => page.evaluate(() => {
  const word = [...document.querySelectorAll('[data-intro-name] .word')].find(el => el.textContent.trim() === 'Haydar')
  const chars = word ? [...word.querySelectorAll('.char')] : []
  const letters = chars.map((c) => {
    const mask = c.parentElement
    const cr = c.getBoundingClientRect()
    const mr = mask.getBoundingClientRect()
    const ms = getComputedStyle(mask)
    return { top: cr.top, maskBottom: mr.bottom, maskTop: mr.top, overflow: ms.overflow, clipPath: ms.clipPath, inline: c.getAttribute('style') ?? '' }
  })
  const svg = document.querySelector('.info__sig')
  const paths = svg ? [...svg.querySelectorAll('path')] : []
  const sr = svg?.getBoundingClientRect()
  // Placement is judged with the pointer lean's translate taken back out.
  const m = svg ? getComputedStyle(svg).transform.match(/matrix\(([^)]+)\)/) : null
  const [tx, ty] = m ? m[1].split(',').map(Number).slice(4) : [0, 0]
  return {
    letters,
    svg: svg
      ? {
          visibility: getComputedStyle(svg).visibility,
          inline: svg.getAttribute('style') ?? '',
          x: sr.x - tx, y: sr.y - ty, w: sr.width, h: sr.height,
          transform: getComputedStyle(svg).transform,
        }
      : null,
    paths: paths.map((p) => {
      const cs = getComputedStyle(p)
      const dash = cs.strokeDasharray
      return {
        fill: Number(cs.fillOpacity),
        stroke: Number(cs.strokeOpacity),
        drawn: !dash || dash === 'none' ? 1 : Math.min(1, Number.parseFloat(dash) / p.getTotalLength()),
        inline: p.getAttribute('style') ?? '',
      }
    }),
    h1: document.querySelector('[data-intro-name]').outerHTML,
  }
})

test('the hero signs itself under the pointer, and is itself again after', async ({ page }) => {
  test.skip(!isFine(), 'a fine pointer only')

  await page.goto('/?intro=1')
  await curtainEndsOpen(page, 9000)
  await page.waitForSelector('[data-intro-name][data-landed]', { timeout: 6000 })
  await page.waitForTimeout(600)

  const word = await wordBox(page)
  expect(word, 'the name is split and the word is there').not.toBeNull()
  const before = await signedState(page)
  expect(before.letters.length, 'the word is split into masked letters').toBe(6)
  expect(before.svg?.visibility, 'the hand is hidden at rest').toBe('hidden')

  const card = await page.locator('.info').boundingBox()
  await page.mouse.move(card.x + 24, card.y + card.height - 24)
  await page.mouse.move(card.x + 40, card.y + card.height - 40, { steps: 3 })
  await page.waitForTimeout(1700)

  const signed = await signedState(page)
  for (const l of signed.letters) {
    // clip-path (.u-mask-tight, for WebKit's taller lines) or overflow: clip; either clips.
    expect(l.overflow === 'clip' || /^inset\(0(px)?\)$/.test(l.clipPath), 'the masks clip — the letters drop behind them').toBe(true)
    expect(l.top, 'each letter has dropped fully behind its mask').toBeGreaterThanOrEqual(l.maskBottom - 0.5)
  }
  expect(signed.svg.visibility).toBe('visible')
  for (const [k, v] of Object.entries({ x: word.x, y: word.y, w: word.w, h: word.h })) {
    expect(Math.abs(signed.svg[k] - v), `the hand is placed on the word (${k})`).toBeLessThan(1.5)
  }
  expect(signed.paths.length).toBe(6)
  for (const p of signed.paths) {
    expect(p.drawn, 'every letter is fully traced').toBeGreaterThan(0.98)
    expect(p.fill, 'and flooded with ink').toBeGreaterThan(0.99)
    expect(p.stroke, 'and its outline has gone').toBeLessThan(0.01)
  }

  await page.mouse.move(card.x + 30, card.y + 30, { steps: 4 })
  await page.waitForTimeout(700)
  const a = (await signedState(page)).svg.transform
  await page.mouse.move(card.x + card.width - 30, card.y + card.height - 30, { steps: 4 })
  await page.waitForTimeout(700)
  const b = (await signedState(page)).svg.transform
  const tx = t => (t.match(/matrix\(([^)]+)\)/)?.[1].split(',').map(Number)[4]) ?? 0
  expect(Math.sign(tx(a)) * Math.sign(tx(b)), 'the lean changes sign across the card').toBeLessThan(0)
  expect(Math.max(Math.abs(tx(a)), Math.abs(tx(b))), 'and stays a few pixels').toBeLessThan(4)

  await page.mouse.move(5, 5, { steps: 4 })
  await page.waitForTimeout(1600)
  const after = await signedState(page)
  expect(after.svg.visibility, 'the hand is hidden again').toBe('hidden')
  expect(after.svg.inline, 'and holds nothing inline').toBe('')
  for (const p of after.paths) expect(p.inline, 'a path holds nothing inline').toBe('')
  after.letters.forEach((l, i) => {
    expect(Math.abs(l.top - before.letters[i].top), `letter ${i} is back where it was`).toBeLessThan(0.5)
  })
  expect(after.h1, 'the heading is byte-identical to before').toBe(before.h1)
  await noInlineMotionLeft(page)
  await grainStaysFixed(page)
})

test('without a fine pointer the hero never signs', async ({ page }) => {
  test.skip(isFine(), 'the fine-pointer path is tested above')
  await page.goto('/?intro=1')
  await curtainEndsOpen(page, 9000)
  // Wait for data-landed, not a timer: a slow engine is still mid-intro at 900ms.
  // Under stillness it is never written; settled() covers both.
  if (!isStill()) await page.waitForSelector('[data-intro-name][data-landed]', { timeout: 12_000 })
  await settled(page)
  const before = await page.evaluate(() => document.querySelector('[data-intro-name]')?.outerHTML)

  const card = await page.locator('.info').boundingBox()
  await page.mouse.move(card.x + 40, card.y + 40)
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2, { steps: 4 })
  await page.waitForTimeout(1200)

  const state = await page.evaluate(() => {
    const svg = document.querySelector('.info__sig')
    return { visibility: svg ? getComputedStyle(svg).visibility : 'absent', h1: document.querySelector('[data-intro-name]')?.outerHTML }
  })
  expect(state.visibility, 'the paths are never even rendered without a fine pointer').toBe('absent')
  expect(state.h1, 'the heading is untouched').toBe(before)
})

const CAPTION = ['.work__title', '.work__company', '.work__rule', '.work__arrow', '.work__meta']

const captionState = page => page.evaluate((sel) => {
  const card = document.querySelector('.work')
  if (!card) return null
  const out = {}
  for (const s of sel) {
    const el = card.querySelector(s)
    if (!el) continue
    // Effective, not own: opacity multiplies up to the card, and an ancestor clipped to nothing hides it.
    let opacity = 1
    let clipped = false
    for (let a = el; a && a !== card; a = a.parentElement) {
      const cs = getComputedStyle(a)
      opacity *= Number(cs.opacity)
      const ar = a.getBoundingClientRect()
      if (a !== el && cs.overflow !== 'visible' && (ar.width < 0.5 || ar.height < 0.5)) clipped = true
    }
    const r = el.getBoundingClientRect()
    // A scaled-to-nothing rule has opacity 1 and no width; both count as hidden.
    out[s] = opacity > 0.05 && !clipped && r.width > 0.5 && r.height > 0.5
  }
  return { parts: out, revealApplies: matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches }
}, CAPTION)

test('a touch screen is shown everything a hover would reveal', async ({ page }) => {
  test.skip(!isTouch(), 'the no-hover path is the point')

  await page.goto('/')
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(900)

  const state = await page.evaluate((sel) => {
    const card = document.querySelector('.work')
    const out = {}
    for (const s of sel) {
      const el = card.querySelector(s)
      if (!el) continue
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      out[s] = Number(cs.opacity) > 0.05 && r.width > 0.5 && r.height > 0.5
    }
    return { parts: out, revealApplies: matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches, hover: matchMedia('(hover: hover)').matches }
  }, CAPTION)

  expect(state.hover, 'this project emulates a touch screen').toBe(false)
  expect(state.revealApplies, 'the hover choreography must not apply without a hover').toBe(false)

  for (const [sel, visible] of Object.entries(state.parts)) {
    expect(visible, `${sel} must be visible on a touch screen — there is no hover to reveal it`).toBe(true)
  }
})

test('and on a pointer the same parts are the hover, not the resting state', async ({ page }) => {
  test.skip(!isFine(), 'the hover path')

  await page.goto('/')
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(900)

  const rest = await captionState(page)
  expect(rest.revealApplies, 'a fine pointer gets the choreography').toBe(true)
  expect(rest.parts['.work__title'], 'the title never hides, on any device').toBe(true)
  for (const sel of ['.work__company', '.work__rule', '.work__arrow']) {
    expect(rest.parts[sel], `${sel} waits for the pointer`).toBe(false)
  }

  const box = await page.locator('.work').first().boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 })
  await page.waitForTimeout(700)

  const hovered = await captionState(page)
  for (const sel of CAPTION) {
    if (hovered.parts[sel] === undefined) continue
    expect(hovered.parts[sel], `${sel} is revealed by the pointer`).toBe(true)
  }
})

test('a resting title reads at 15px on every pointer layout', async ({ page }) => {
  test.skip(!isFine(), 'the resting caption exists only for a pointer with motion')
  for (const [width, height] of [[1440, 900], [1280, 720], [1200, 640], [1000, 800], [700, 800]]) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await curtainEndsOpen(page, 9000)
    await page.waitForTimeout(900)
    const drawn = await page.$$eval('.work__title', els => els.map((el) => {
      const cs = getComputedStyle(el)
      const m = new DOMMatrixReadOnly(cs.transform === 'none' ? undefined : cs.transform)
      return +(Number.parseFloat(cs.fontSize) * m.a).toFixed(2)
    }))
    expect(drawn.length, `${width}x${height}: the work cards are there`).toBe(3)
    for (const px of drawn) expect(Math.abs(px - 15), `${width}x${height}: a resting title drawn at ${px}px`).toBeLessThanOrEqual(0.3)
  }
})

// Contrast from pixels: shoot the title with and without its glyphs; the glyphs'
// median luminance against the 95th-percentile luminance behind them.
test('a resting title stays legible over its cover', async ({ browser }) => {
  test.skip(!isFine(), 'the resting caption exists only for a pointer with motion')
  test.setTimeout(120_000)

  const contrast = (page, a, b) => page.evaluate(async ({ a, b }) => {
    const load = async (b64) => {
      const img = new Image()
      img.src = `data:image/png;base64,${b64}`
      await img.decode()
      return img
    }
    const [ia, ib] = await Promise.all([load(a), load(b)])
    const canvas = document.createElement('canvas')
    canvas.width = ia.width
    canvas.height = ia.height
    const g = canvas.getContext('2d')
    g.drawImage(ia, 0, 0)
    const da = g.getImageData(0, 0, canvas.width, canvas.height).data
    g.clearRect(0, 0, canvas.width, canvas.height)
    g.drawImage(ib, 0, 0)
    const db = g.getImageData(0, 0, canvas.width, canvas.height).data
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    const L = (d, i) => 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2])
    const text = []
    const behind = []
    for (let i = 0; i < da.length; i += 4) {
      const la = L(da, i)
      const lb = L(db, i)
      if (la - lb > 0.25) { text.push(la); behind.push(lb) }
    }
    if (!text.length) return 0
    text.sort((x, y) => x - y)
    behind.sort((x, y) => x - y)
    const q = (xs, p) => xs[Math.min(xs.length - 1, Math.floor(p * xs.length))]
    return +((q(text, 0.5) + 0.05) / (q(behind, 0.95) + 0.05)).toFixed(2)
  }, { a: a.toString('base64'), b: b.toString('base64') })

  const low = []
  for (const [width, height] of [[1440, 900], [1280, 720], [1200, 640]]) {
    // 2x, so a glyph has a core to measure rather than only its antialiased edge.
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 })
    const page = await context.newPage()
    await page.goto('/')
    await curtainEndsOpen(page, 9000)
    await page.waitForTimeout(900)
    const titles = page.locator('.work__title')
    const count = await titles.count()
    expect(count, 'the work cards are there').toBe(3)
    for (let i = 0; i < count; i++) {
      const title = titles.nth(i)
      const box = await title.boundingBox()
      const clip = { x: box.x - 4, y: box.y - 4, width: box.width + 8, height: box.height + 8 }
      const a = await page.screenshot({ clip })
      await title.evaluate((el) => { el.style.color = 'transparent' })
      const b = await page.screenshot({ clip })
      await title.evaluate((el) => { el.style.color = '' })
      const c = await contrast(page, a, b)
      if (c < 4.5) low.push(`${width}x${height} "${(await title.textContent()).trim()}": ${c}:1`)
    }
    await context.close()
  }
  expect(low, 'a resting title must read at 4.5:1 against the cover behind it').toEqual([])
})
