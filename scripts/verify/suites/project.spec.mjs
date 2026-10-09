import { expect, test } from '@playwright/test'
import { curtainEndsOpen, noInlineMotionLeft, nothingHiddenInView } from '../lib/assert.mjs'
import { isStill } from '../lib/project.mjs'

// Opening a project and coming back: the page swaps under the curtain both ways.

/** Records, per frame, whether the curtain was covering when the project page first existed. */
async function watchTheSwap(page) {
  await page.evaluate(() => {
    window.__swap = null
    const tick = () => {
      const detail = location.pathname.includes('/projects/') && document.querySelector('#stage [data-project]')
      if (detail && window.__swap === null) {
        const c = document.querySelector('.curtain')
        window.__swap = { covering: !!(c?.classList.contains('is-visible') || c?.classList.contains('is-sealed')) }
        return
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

for (const [from, link] of [['/', '.work__link'], ['/projects', '.row__link']]) {
  test(`opening a project from ${from} is covered by the curtain`, async ({ page }) => {
    test.skip(isStill(), 'the curtain is a crossfade under reduced motion')
    await page.goto(from)
    await curtainEndsOpen(page, 9000)
    await page.waitForTimeout(700)

    await watchTheSwap(page)
    await page.locator(link).first().click()
    await page.waitForURL('**/projects/**')
    await page.waitForFunction(() => window.__swap !== null, null, { timeout: 6000 })
    const swap = await page.evaluate(() => window.__swap)
    expect(swap.covering, 'the project page appeared with nothing covering the swap').toBe(true)

    await curtainEndsOpen(page, 9000)
    await page.waitForTimeout(900)
    const heading = await page.evaluate(() => {
      const h = document.querySelector('#stage h1')
      return h ? { text: h.textContent.trim(), opacity: Number(getComputedStyle(h).opacity), inline: h.getAttribute('style') ?? '' } : null
    })
    expect(heading?.text.length, 'the project has a heading').toBeGreaterThan(0)
    expect(heading.opacity, 'and it is not left hidden').toBeGreaterThan(0.99)
    await nothingHiddenInView(page)
    await noInlineMotionLeft(page)
  })
}

test('opening a project from a scrolled index lands at the top', async ({ page }) => {
  await page.goto('/projects')
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(700)

  await page.evaluate(() => window.scrollTo(0, 400))
  await page.waitForTimeout(500)
  expect(await page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(200)

  const rows = await page.locator('.row__link').count()
  await page.locator('.row__link').nth(Math.min(4, rows - 1)).click()
  await page.waitForURL('**/projects/**')
  await curtainEndsOpen(page, 9000)

  expect(
    await page.evaluate(() => Math.round(window.scrollY)),
    'the detail page must start at the top, not where the index was',
  ).toBeLessThan(40)
})

test('going straight back strands nothing', async ({ page }) => {
  await page.goto('/projects')
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(700)

  await page.locator('.row__link').first().click()
  await page.waitForURL('**/projects/**')
  await page.waitForTimeout(250)
  await page.goBack()
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(900)
  await nothingHiddenInView(page)
})

test('back to the index keeps your place in the list', async ({ page }) => {
  await page.goto('/projects')
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(700)

  await page.evaluate(() => window.scrollTo(0, 350))
  await page.waitForTimeout(500)

  const row = page.locator('.row__link').nth(4)
  await row.scrollIntoViewIfNeeded()
  // A trial click does the click's own scroll first, so the position read next is the one the page leaves from.
  await row.click({ trial: true })
  await page.waitForTimeout(400)
  const left = await page.evaluate(() => Math.round(window.scrollY))
  test.skip(left < 100, 'this viewport does not scroll the index far enough')

  await row.click()
  await page.waitForURL('**/projects/**')
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(600)
  expect(await page.evaluate(() => Math.round(window.scrollY)), 'the detail page starts at the top').toBeLessThan(40)

  await page.goBack()
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(900)

  const back = await page.evaluate(() => Math.round(window.scrollY))
  expect(Math.abs(back - left), 'Back returns to where you were').toBeLessThan(40)
  await nothingHiddenInView(page)
})

// Lazy slides count too: their src is in the markup before they load.
test('every picture a project page names is there', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'a question about files, not about an engine')
  await page.goto('/projects')
  const slugs = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href*="/projects/"]')]
    .map(a => new URL(a.href).pathname.split('/').filter(Boolean).pop()))])
  expect(slugs.length, 'the index lists the projects').toBeGreaterThan(0)

  const missing = []
  for (const slug of slugs) {
    for (const prefix of ['', '/ar']) {
      await page.goto(`${prefix}/projects/${slug}`)
      const srcs = await page.evaluate(() => [...new Set([...document.querySelectorAll('#stage img')]
        .map(img => img.getAttribute('src')).filter(Boolean))])
      for (const src of srcs) {
        const res = await page.request.get(src)
        if (res.status() !== 200) missing.push(`${prefix}/projects/${slug}: ${src} (${res.status()})`)
      }
    }
  }
  expect(missing).toEqual([])
})
