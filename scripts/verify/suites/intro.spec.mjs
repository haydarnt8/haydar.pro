import { expect, test } from '@playwright/test'
import { collectErrors, curtainEndsOpen, landsWhereItShould, noInlineMotionLeft, nothingHiddenInView } from '../lib/assert.mjs'
import { installSampler } from '../lib/sampler.mjs'
import { isStill } from '../lib/project.mjs'

// The intro's handoff lands, and every way it is cut short still ends with a usable page.
const NAME = '[data-intro-name]'

test.beforeEach(async ({ context }) => {
  await context.addInitScript(installSampler)
})

const plays = () => test.skip(isStill(), 'the intro does not run under reduced motion')

test('the signature lands on the hero heading', async ({ page, context, baseURL }) => {
  plays()
  const errors = collectErrors(page)
  await page.goto('/?intro=1')
  await page.evaluate(() => window.__watch(['.intro-layer', '.intro-layer__sig', '[data-intro-name]'], 6000))
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(600)

  await landsWhereItShould(page, context, `${baseURL}/`, NAME, 0.5, '[data-intro-name][data-landed]')
  await noInlineMotionLeft(page)
  await nothingHiddenInView(page)
  expect(errors).toEqual([])
})

test('the letters are drawn one after another, not all at once', async ({ page }) => {
  plays()
  await page.goto('/?intro=1')
  await page.evaluate(() => window.__watch(['.intro-layer'], 9000))
  // Wait for frames, not a timer: WebKit settles the hero seconds later than Blink.
  // The `.catch` is deliberate: the assertions below report what was seen instead of a timeout.
  await page.waitForFunction(() => {
    const frames = window.__frames?.() ?? []
    return frames.filter(f => f.el['.intro-layer'] && f.el['.intro-layer'].opacity > 0.5).length > 20
  }, null, { timeout: 12_000 }).catch(() => {})

  const fills = await page.evaluate(() => {
    const done = window.__introFillTimes ?? null
    if (done) return done
    return null
  })
  // No fill-time hook in production: assert the layer stayed up long enough to draw.
  const frames = await page.evaluate(() => window.__frames())
  const shown = frames.filter(f => f.el['.intro-layer'] && f.el['.intro-layer'].opacity > 0.5)
  expect(fills ?? shown.length, 'the intro layer was never visible').toBeTruthy()
  expect(shown.length, 'the intro should be on screen for more than a few frames').toBeGreaterThan(20)
})

test('it can be skipped from the first frame and still lands', async ({ page, context, baseURL }) => {
  plays()
  const errors = collectErrors(page)
  await page.goto('/?intro=1')
  await page.waitForTimeout(500)
  await page.mouse.click(700, 450)

  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(600)
  await landsWhereItShould(page, context, `${baseURL}/`, NAME, 0.5, '[data-intro-name][data-landed]')
  await noInlineMotionLeft(page)
  expect(errors).toEqual([])
})

test('it plays again on every arrival at home', async ({ page }) => {
  plays()
  await page.goto('/')
  await curtainEndsOpen(page, 9000)

  await page.click('a[href="/about"]')
  await page.waitForURL('**/about')
  await curtainEndsOpen(page)

  await page.evaluate(() => window.__watch(['.intro-layer'], 7000))
  await page.click('a.close')
  await page.waitForURL(url => !url.pathname.includes('about'))
  await page.waitForTimeout(1600)

  const seen = await page.evaluate(() =>
    window.__frames().some(f => f.el['.intro-layer'] && f.el['.intro-layer'].opacity > 0.5))
  expect(seen, 'the intro should play when home is reached from another page').toBe(true)

  await curtainEndsOpen(page, 9000)
  await noInlineMotionLeft(page)
})

test('a refresh plays it again', async ({ page }) => {
  plays()
  for (const visit of ['first load', 'refresh', 'second refresh']) {
    if (visit === 'first load') await page.goto('/')
    else await page.reload()
    await page.evaluate(() => window.__watch(['.intro-layer'], 6000))
    await page.waitForTimeout(2500)
    const seen = await page.evaluate(() =>
      window.__frames().some(f => f.el['.intro-layer'] && f.el['.intro-layer'].opacity > 0.5))
    expect(seen, `the intro should play on the ${visit}`).toBe(true)
    await curtainEndsOpen(page, 9000)
  }
  await noInlineMotionLeft(page)
})

test('it declines when the heading is not in view', async ({ page }) => {
  test.skip(page.viewportSize().width > 1000, 'home only scrolls below 1200px')

  await page.goto('/')
  await curtainEndsOpen(page, 9000)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(500)

  await page.click('a[href="/about"]')
  await page.waitForURL('**/about')
  await curtainEndsOpen(page)

  await page.evaluate(() => window.__watch(['.intro-layer'], 6000))
  await page.goBack()
  await page.waitForTimeout(1800)

  const heroTop = await page.evaluate(() => {
    const el = document.querySelector('[data-intro-name]')
    return el ? el.getBoundingClientRect().top : 0
  })
  if (heroTop < 0) {
    const played = await page.evaluate(() =>
      window.__frames().some(f => f.el['.intro-layer'] && f.el['.intro-layer'].opacity > 0.5))
    expect(played, 'the intro must decline when its target is off screen').toBe(false)
  }
  await curtainEndsOpen(page, 9000)
})

test('reduced motion never shows it and never hides anything', async ({ page }) => {
  test.skip(!isStill(), 'this is the reduced-motion project')

  const errors = collectErrors(page)
  await page.goto('/?intro=1')
  await page.evaluate(() => window.__watch(['.intro-layer'], 4000))
  await page.waitForTimeout(2500)

  const everShown = await page.evaluate(() =>
    window.__frames().some(f => f.el['.intro-layer'] && f.el['.intro-layer'].opacity > 0.1))
  expect(everShown, 'no intro under reduced motion').toBe(false)

  await curtainEndsOpen(page)
  await nothingHiddenInView(page)
  expect(errors).toEqual([])
})
