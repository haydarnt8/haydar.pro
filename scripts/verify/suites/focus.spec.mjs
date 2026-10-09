import { expect, test } from '@playwright/test'
import { curtainEndsOpen } from '../lib/assert.mjs'
import { isFine, isStill, isTouch, isWebKit } from '../lib/project.mjs'

// Reads pixels, not computed style: each stop is shot focused, then blurred, and the two must differ.
// WebKit tabs to links only with Option+Tab (Safari's default).
const TAB = () => (isWebKit() ? 'Alt+Tab' : 'Tab')

/** Pixels whose largest channel differs by more than 24, between two PNGs of the same size. */
const changed = (page, a, b) => page.evaluate(async ({ a, b }) => {
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
  const da = g.getImageData(0, 0, ia.width, ia.height).data
  g.clearRect(0, 0, ia.width, ia.height)
  g.drawImage(ib, 0, 0)
  const db = g.getImageData(0, 0, ia.width, ia.height).data
  let n = 0
  for (let i = 0; i < da.length; i += 4) {
    if (Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])) > 24) n++
  }
  return n
}, { a: a.toString('base64'), b: b.toString('base64') })

const focused = page => page.evaluate(() => {
  const el = document.activeElement
  if (!el || el === document.body) return null
  const r = el.getBoundingClientRect()
  const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.id || el.tagName)
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 40)
  return {
    name,
    key: `${el.tagName}|${name}|${Math.round(r.left)}|${Math.round(r.top + scrollY)}`,
    rect: { x: r.left, y: r.top, width: r.width, height: r.height },
  }
})

async function tabTo(page, selector, limit = 30) {
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press(TAB())
    if (await page.evaluate(sel => !!document.activeElement?.matches(sel), selector)) return true
  }
  return false
}

async function arrive(page, route) {
  await page.goto(route)
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(600)
}

test('every control on the home page shows where the keyboard is', async ({ page }) => {
  test.skip(!isStill(), 'with motion, focus also plays each card\'s own reveal: stillness is where a missing ring cannot hide')
  test.setTimeout(120_000)

  const invisible = []
  for (const route of ['/', '/ar']) {
    await arrive(page, route)
    const seen = new Set()
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press(TAB())
      const stop = await focused(page)
      if (!stop || seen.has(stop.key)) break
      seen.add(stop.key)

      const vp = page.viewportSize()
      const x = Math.max(0, stop.rect.x - 8)
      const y = Math.max(0, stop.rect.y - 8)
      const clip = {
        x,
        y,
        width: Math.min(vp.width, stop.rect.x + stop.rect.width + 8) - x,
        height: Math.min(vp.height, stop.rect.y + stop.rect.height + 8) - y,
      }
      if (clip.width < 4 || clip.height < 4) continue

      const on = await page.screenshot({ clip })
      await page.evaluate(() => {
        window.__focusStop = document.activeElement
        document.activeElement.blur()
      })
      await page.waitForTimeout(120)
      const off = await page.screenshot({ clip })
      // Back where Tab left it, so the next press carries on from here.
      await page.evaluate(() => window.__focusStop.focus())

      const n = await changed(page, on, off)
      if (n < 100) invisible.push(`${route} "${stop.name}": ${n} pixels change when it takes focus`)
    }
    expect(seen.size, `${route}: Tab should reach the page's controls`).toBeGreaterThan(10)
  }
  expect(invisible, 'a control that looks the same focused as not').toEqual([])
})

test('a focused work card wears the ring, with motion as well', async ({ page }) => {
  test.skip(!isFine(), 'a mouse with motion: focus plays the reveal, and the ring must be there too')
  await arrive(page, '/')
  expect(await tabTo(page, '.work__link'), 'Tab reaches a work card').toBe(true)
  const ring = await page.evaluate(() => {
    const cs = getComputedStyle(document.activeElement.closest('.work'))
    return { style: cs.outlineStyle, width: cs.outlineWidth, offset: cs.outlineOffset }
  })
  expect(ring, 'the card draws the global ring its link cannot').toEqual({ style: 'solid', width: '2px', offset: '2px' })
})

test('under stillness a focused link keeps its arrow in the badge', async ({ page }) => {
  test.skip(!isStill(), 'with motion the second glyph slides in; only stillness has just the one')
  for (const route of ['/', '/ar', '/projects']) {
    await arrive(page, route)
    expect(await tabTo(page, 'a:has(.badge)'), `${route}: Tab reaches a link with an arrow badge`).toBe(true)
    const inside = await page.evaluate(() => {
      const link = document.activeElement
      const b = link.querySelector('.badge').getBoundingClientRect()
      const r = link.querySelector('.badge__glyph--lead').getBoundingClientRect()
      const w = Math.max(0, Math.min(r.right, b.right) - Math.max(r.left, b.left))
      const h = Math.max(0, Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top))
      return (w * h) / (r.width * r.height)
    })
    expect(inside, `${route}: the arrow stays in its badge`).toBeGreaterThan(0.5)
  }
})

const READING = ['.info', '.intro', '.works', '.work.cell-1', '.second', '.contact', '.right__projects', '.right__email', '.right__social']

async function tabWalk(page) {
  const stops = []
  const seen = new Set()
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press(TAB())
    const stop = await page.evaluate((blocks) => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const r = el.getBoundingClientRect()
      return {
        block: blocks.find(sel => el.closest(sel)) ?? el.tagName.toLowerCase(),
        y: Math.round(r.top + scrollY),
        key: `${el.tagName}|${el.textContent.trim().slice(0, 30)}|${Math.round(r.left)}|${Math.round(r.top + scrollY)}`,
      }
    }, READING)
    if (!stop || seen.has(stop.key)) break
    seen.add(stop.key)
    stops.push(stop)
  }
  return stops
}

test('Tab reads the home page in the order it is shown', async ({ page }) => {
  test.skip(!isFine() && !isTouch(), 'a mouse at a desktop and a tablet width, and the phones')
  test.setTimeout(120_000)
  const sizes = isTouch() ? [null] : [{ width: 834, height: 1112 }, { width: 1440, height: 900 }]
  for (const size of sizes) {
    if (size) await page.setViewportSize(size)
    for (const route of ['/', '/ar']) {
      await arrive(page, route)
      const stops = await tabWalk(page)
      const at = `${size ? `${size.width}x${size.height}` : 'phone'} ${route}`
      const blocks = stops.map(s => s.block).filter((b, i, all) => b !== all[i - 1])
      expect(blocks, `${at}: the cards in reading order`).toEqual(READING)
      if (!size || size.width < 1200) {
        const back = stops.flatMap((s, i) => (i && s.y < stops[i - 1].y - 40 ? [`${stops[i - 1].block} y${stops[i - 1].y} -> ${s.block} y${s.y}`] : []))
        expect(back, `${at}: Tab never goes back up the page`).toEqual([])
      }
    }
  }
})
