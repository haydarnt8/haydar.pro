import { expect, test } from '@playwright/test'
import { collectErrors, curtainEndsOpen, noInlineMotionLeft } from '../lib/assert.mjs'
import { isStill, isTouch, isWebKit } from '../lib/project.mjs'

// Touch is driven through CDP: Observer ignores synthetic mice on a touch screen, and only a real
// touch sequence goes through the browser's gesture arbitration, so `touch-action` can be tested.

const isMobile = () => isTouch()
const isReduced = () => isStill()

const state = (page, nth = 0) => page.evaluate((i) => {
  const slider = document.querySelectorAll('.slider')[i]
  if (!slider) return null
  const track = slider.querySelector('.slider__track')
  const slides = [...slider.querySelectorAll('.slider__slide')]
  const m = getComputedStyle(track).transform.match(/matrix\(([^)]+)\)/)
  return {
    count: slides.length,
    index: slides.findIndex(s => s.getAttribute('aria-hidden') !== 'true'),
    inert: slides.map(s => s.hasAttribute('inert')),
    x: m ? Math.round(Number(m[1].split(',')[4])) : 0,
    width: Math.round(track.getBoundingClientRect().width),
    scripted: slider.classList.contains('is-scripted'),
    status: slider.querySelector('[role="status"]')?.textContent.trim() ?? '',
    dot: [...slider.querySelectorAll('.slider__dot')].findIndex(d => d.classList.contains('is-current')),
    arrows: [...slider.querySelectorAll('.slider__arrow')].map(a => a.disabled),
  }
}, nth)

async function settleOn(page, nth = 0) {
  const viewport = page.locator('.slider__viewport').nth(nth)
  await viewport.scrollIntoViewIfNeeded()
  await page.waitForTimeout(900)
  return viewport
}

/** Under stillness the swipe is bound on first contact, so give it before any gesture. */
async function prime(page, viewport) {
  if (!isReduced()) return
  const box = await viewport.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(900)
}

async function touchSwipe(page, from, to, { steps = 8, ms = 160 } = {}) {
  // Playwright can't synthesise touch in WebKit (CDP is Chromium-only; `new Touch()` is illegal there),
  // so the swipe is not verified on WebKit.
  test.skip(isWebKit(), 'Playwright cannot synthesise touch gestures in WebKit; see the note in touchSwipe')
  const cdp = await page.context().newCDPSession(page)
  const at = (x, y) => [{ x: Math.round(x), y: Math.round(y) }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(from.x, from.y) })
  for (let i = 1; i <= steps; i++) {
    const x = from.x + (to.x - from.x) * (i / steps)
    const y = from.y + (to.y - from.y) * (i / steps)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(x, y) })
    await page.waitForTimeout(ms / steps)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
}

async function mouseSwipe(page, from, to, { steps = 8 } = {}) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps })
  await page.mouse.up()
}

async function swipe(page, viewport, dx, dy = 0) {
  const box = await viewport.boundingBox()
  const from = { x: box.x + box.width / 2 - dx / 2, y: box.y + box.height / 2 - dy / 2 }
  const to = { x: from.x + dx, y: from.y + dy }
  if (isMobile()) await touchSwipe(page, from, to)
  else await mouseSwipe(page, from, to)
}

/** ms until a slide change is over; under stillness it is a cut. */
const moved = () => (isReduced() ? 60 : 900)

test('a dot moves one slide and everything agrees', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/about')
  await curtainEndsOpen(page, 9000)
  await settleOn(page, 0)

  const before = await state(page, 0)
  expect(before.count).toBe(4)
  expect(before.index).toBe(0)
  expect(before.inert).toEqual([false, true, true, true])
  expect(before.x).toBe(0)
  expect(before.scripted, 'GSAP owns the track unless stillness was asked for').toBe(!isReduced())

  const dots = await page.locator('.slider').nth(0).locator('.slider__dot').evaluateAll(els =>
    els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, w: r.width, h: r.height } }))
  for (const d of dots) {
    expect(d.w, 'a dot is a 24px target').toBeGreaterThanOrEqual(24)
    expect(d.h, 'a dot is a 24px target').toBeGreaterThanOrEqual(24)
  }
  for (let i = 1; i < dots.length; i++) {
    expect(Math.abs(dots[i].x - dots[i - 1].x), 'targets must not overlap').toBeGreaterThanOrEqual(24)
  }

  await page.locator('.slider').nth(0).locator('.slider__dot').nth(1).click()
  await page.waitForTimeout(moved())
  const after = await state(page, 0)
  expect(after.index).toBe(1)
  expect(after.x, 'the track moved exactly one slide').toBe(-after.width)
  expect(after.inert).toEqual([true, false, true, true])
  expect(after.dot).toBe(1)
  expect(after.status).toMatch(/2 of 4|2 من 4/)

  await settleOn(page, 1)
  const gallery = page.locator('.slider').nth(1)
  expect((await state(page, 1)).arrows).toEqual([true, false])
  await gallery.locator('.slider__dot').last().click()
  await page.waitForTimeout(moved())
  const end = await state(page, 1)
  expect(end.index).toBe(end.count - 1)
  expect(end.arrows).toEqual([false, true])
  expect(end.x).toBe(-(end.count - 1) * end.width)

  await noInlineMotionLeft(page)
  expect(errors).toEqual([])
})

test('a swipe goes one slide, and only one, however long it is', async ({ page }) => {
  await page.goto('/about')
  await curtainEndsOpen(page, 9000)
  const viewport = await settleOn(page, 0)
  await prime(page, viewport)

  await swipe(page, viewport, -80)
  await page.waitForTimeout(1000)
  expect((await state(page, 0)).index, 'an 80px swipe advances one slide').toBe(1)

  await swipe(page, viewport, -260)
  await page.waitForTimeout(1000)
  expect((await state(page, 0)).index, 'a long drag is still one decision').toBe(2)

  await swipe(page, viewport, 80)
  await page.waitForTimeout(1000)
  const back = await state(page, 0)
  expect(back.index).toBe(1)
  expect(back.inert, 'inert follows the gesture').toEqual([true, false, true, true])
  expect(back.status).toMatch(/2 of 4/)
  expect(back.x).toBe(-back.width)
})

test('the same gesture runs the other way in Arabic', async ({ page }) => {
  for (const [route, next] of [['/about', -1], ['/ar/about', 1]]) {
    await page.goto(route)
    await curtainEndsOpen(page, 9000)
    const viewport = await settleOn(page, 0)
    await prime(page, viewport)

    await swipe(page, viewport, -next * 80)
    await page.waitForTimeout(800)
    expect((await state(page, 0)).index, `${route}: nothing lies before the first slide`).toBe(0)

    await swipe(page, viewport, next * 80)
    await page.waitForTimeout(1000)
    const s = await state(page, 0)
    expect(s.index, `${route}: forward is toward the reading end`).toBe(1)
    expect(s.x, `${route}: and the track moved that way`).toBe(next * s.width)
  }
})

test('up and down still belongs to the page', async ({ page }) => {
  await page.goto('/about')
  await curtainEndsOpen(page, 9000)
  const viewport = await settleOn(page, 0)
  await prime(page, viewport)
  const box = await viewport.boundingBox()
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2

  const { before, room } = await page.evaluate(() => ({
    before: Math.round(window.scrollY),
    room: document.documentElement.scrollHeight - window.innerHeight - window.scrollY,
  }))
  test.skip(room < 60, 'no room left to scroll at this viewport')

  if (isMobile()) await touchSwipe(page, { x: cx, y: cy + 60 }, { x: cx, y: cy - 60 })
  else { await page.mouse.move(cx, cy); await page.mouse.wheel(0, 240) }
  await page.waitForTimeout(800)

  expect(await page.evaluate(() => Math.round(window.scrollY)), 'the page scrolled').toBeGreaterThan(before + 20)
  expect((await state(page, 0)).index, 'the slider did not move').toBe(0)
})

test('a sideways trackpad gesture is the slider\'s, and its momentum is not a second one', async ({ page }) => {
  test.skip(isMobile(), 'no wheel on a touch screen')
  await page.goto('/about')
  await curtainEndsOpen(page, 9000)
  const viewport = await settleOn(page, 0)
  const box = await viewport.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(900)
  await page.evaluate(() => {
    window.__wheels = []
    document.addEventListener('wheel', e => window.__wheels.push({ dx: e.deltaX, dy: e.deltaY, claimed: e.defaultPrevented }))
  })

  // A gesture, then the momentum tail a trackpad sends after the fingers lift: one decision.
  await page.mouse.wheel(120, 0)
  await page.mouse.wheel(40, 0)
  await page.mouse.wheel(20, 0)
  await page.waitForTimeout(1000)
  expect((await state(page, 0)).index, 'a sideways gesture steps forward, once').toBe(1)

  await page.mouse.wheel(0, 120)
  await page.waitForTimeout(600)
  expect((await state(page, 0)).index).toBe(1)

  const wheels = await page.evaluate(() => window.__wheels)
  expect(wheels.length).toBe(4)
  for (const w of wheels) {
    expect(w.claimed, `deltaX ${w.dx} / deltaY ${w.dy}: sideways is claimed so the browser never goes Back; vertical is left alone`)
      .toBe(Math.abs(w.dx) > Math.abs(w.dy))
  }
})

test('the keyboard goes the same way as the swipe', async ({ page }) => {
  for (const [route, forward, back] of [['/about', 'ArrowRight', 'ArrowLeft'], ['/ar/about', 'ArrowLeft', 'ArrowRight']]) {
    await page.goto(route)
    await curtainEndsOpen(page, 9000)
    await settleOn(page, 0)
    await page.locator('.slider').nth(0).focus()

    await page.keyboard.press(forward)
    await page.waitForTimeout(moved())
    expect((await state(page, 0)).index, `${route}: ${forward} is forward`).toBe(1)

    await page.keyboard.press(back)
    await page.waitForTimeout(moved())
    expect((await state(page, 0)).index, `${route}: ${back} is back`).toBe(0)
  }
})

test('the swipe costs no request', async ({ page }) => {
  test.skip(isReduced(), 'under stillness GSAP itself is fetched on contact, by design')
  const scripts = []
  page.on('request', (r) => { if (/\/_nuxt\/.*\.js/.test(r.url())) scripts.push(r.url()) })

  await page.goto('/about')
  await curtainEndsOpen(page, 9000)
  const viewport = await settleOn(page, 0)
  const loaded = scripts.length

  await swipe(page, viewport, -80)
  await page.waitForTimeout(1200)
  expect((await state(page, 0)).index).toBe(1)
  expect(scripts.slice(loaded), 'no script may be fetched for the swipe').toEqual([])
})

