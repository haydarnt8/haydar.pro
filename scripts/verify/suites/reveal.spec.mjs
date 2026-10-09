import { expect, test } from '@playwright/test'
import { collectErrors, curtainEndsOpen, grainStaysFixed, noInlineMotionLeft, nothingHiddenInView } from '../lib/assert.mjs'
import { installSampler } from '../lib/sampler.mjs'

/** The reveal engine's invariant: nothing inside the viewport stays invisible. */

const SCROLLING = ['/about', '/projects', '/projects/gudea-event-dashboard', '/ar/about', '/ar/projects']

test.beforeEach(async ({ context }) => {
  await context.addInitScript(installSampler)
})

for (const route of SCROLLING) {
  test(`${route} never hides content in view, top to bottom`, async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto(route)
    await curtainEndsOpen(page)
    expect(await page.locator('main').count(), 'exactly one main landmark').toBe(1)
    await nothingHiddenInView(page)

    const height = await page.evaluate(() => document.body.scrollHeight)
    const viewport = page.viewportSize()?.height ?? 900
    for (let y = 0; y < height; y += Math.floor(viewport * 0.6)) {
      await page.evaluate(to => window.scrollTo(0, to), y)
      await page.waitForTimeout(450)
      await nothingHiddenInView(page)
    }

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(900)
    await nothingHiddenInView(page)
    await grainStaysFixed(page)
    await noInlineMotionLeft(page)
    expect(errors, `console errors on ${route}`).toEqual([])
  })
}

test('headings keep an accessible name after they are split', async ({ page }) => {
  // SplitText's aria: 'hidden' hides the element itself, and inside a link the link's name.
  await page.goto('/projects')
  await curtainEndsOpen(page)
  await page.waitForTimeout(1200)

  const h1 = await page.evaluate(() => {
    const el = document.querySelector('h1')
    if (!el) return null
    return {
      hidden: el.getAttribute('aria-hidden'),
      label: el.getAttribute('aria-label'),
      text: (el.textContent || '').trim(),
    }
  })
  expect(h1).not.toBeNull()
  expect(h1.hidden, 'a split heading must not be hidden from assistive tech').not.toBe('true')
  expect((h1.label ?? h1.text).length, 'a split heading must still have a name').toBeGreaterThan(0)
})

test('teaser links keep a name in Arabic', async ({ page }) => {
  // In Arabic, scramble degrades to lines, so the heading inside the link is split there only.
  await page.goto('/ar')
  await curtainEndsOpen(page)
  await page.waitForTimeout(1500)

  const nameless = await page.evaluate(() =>
    [...document.querySelectorAll('a.teaser')]
      .filter(a => !(a.getAttribute('aria-label') || a.textContent || '').trim())
      .length)
  expect(nameless, 'every teaser link needs a discernible name').toBe(0)
})

test('back into a scrolled page leaves nothing hidden', async ({ page }) => {
  // once: true plus manual scroll restoration: anything above the restored position must be shown outright.
  await page.goto('/projects')
  await curtainEndsOpen(page)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(700)

  await page.click('.row__link')
  await page.waitForURL('**/projects/**')
  await curtainEndsOpen(page)

  await page.goBack()
  await curtainEndsOpen(page)
  await page.waitForTimeout(900)
  await nothingHiddenInView(page)
})
