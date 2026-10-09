import { expect, test } from '@playwright/test'
import { collectErrors, curtainEndsOpen, grainStaysFixed, noInlineMotionLeft } from '../lib/assert.mjs'
import { isTouch } from '../lib/project.mjs'
import { installSampler } from '../lib/sampler.mjs'

// The curtain must always end open: a wrong end state leaves `inert` on a page that looks fine.

const ROUTES = ['/', '/about', '/projects', '/projects/gudea-event-dashboard', '/ar', '/ar/about']

test.beforeEach(async ({ context }) => {
  await context.addInitScript(installSampler)
})

for (const route of ROUTES) {
  test(`${route} ends open and usable`, async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto(route)
    await curtainEndsOpen(page)
    await grainStaysFixed(page)
    await noInlineMotionLeft(page)
    expect(errors, `console errors on ${route}`).toEqual([])
  })
}

test('every navigation from home ends open', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await curtainEndsOpen(page)

  for (const href of ['/about', '/', '/projects', '/']) {
    await page.click(`a[href="${href}"]`)
    await page.waitForURL(`**${href}`)
    await curtainEndsOpen(page)
    await grainStaysFixed(page)
  }

  await noInlineMotionLeft(page)
  expect(errors).toEqual([])
})

test('back and forward end open', async ({ page }) => {
  await page.goto('/')
  await curtainEndsOpen(page)
  await page.click('a[href="/about"]')
  await page.waitForURL('**/about')
  await curtainEndsOpen(page)

  await page.goBack()
  await curtainEndsOpen(page)
  await page.goForward()
  await curtainEndsOpen(page)
})

test('a click moves no focus', async ({ page }) => {
  await page.goto('/')
  await curtainEndsOpen(page)
  await page.click('a[href="/about"]')
  await page.waitForURL('**/about')
  await curtainEndsOpen(page)
  await page.waitForTimeout(200)
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('H1')
})

test('a navigation from the keyboard hands focus to the new heading', async ({ page }) => {
  test.skip(isTouch(), 'a keyboard')
  await page.goto('/')
  await curtainEndsOpen(page)
  await page.focus('a[href="/about"]')
  await page.keyboard.press('Enter')
  await page.waitForURL('**/about')
  await curtainEndsOpen(page)
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('H1')
})

test('a language switch ends open, in the new direction', async ({ page }) => {
  await page.goto('/')
  await curtainEndsOpen(page)
  await page.click('a.lang')
  await page.waitForURL('**/ar')
  await curtainEndsOpen(page)
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await grainStaysFixed(page)
})

test('a cold 404 ends open', async ({ page }) => {
  await page.goto('/no-such-page-exists')
  await curtainEndsOpen(page)
})
