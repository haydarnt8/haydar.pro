import { expect, test } from '@playwright/test'
import { curtainEndsOpen, edgesMatchTheDesign, noSidewaysScroll } from '../lib/assert.mjs'
import { isFine, isStill } from '../lib/project.mjs'

/** The design's edges and fills on every page, in both themes. Card borders are asserted, not assumed absent. */
const ROUTES = ['/', '/about', '/projects', '/projects/gudea-event-dashboard', '/ar']

for (const route of ROUTES) {
  test(`${route} draws the design's edges`, async ({ page }) => {
    await page.goto(route)
    await curtainEndsOpen(page, 9000)
    await page.waitForTimeout(500)
    await edgesMatchTheDesign(page)
  })

  test(`${route} does not scroll sideways`, async ({ page }) => {
    await page.goto(route)
    await curtainEndsOpen(page, 9000)
    await page.waitForTimeout(500)
    await noSidewaysScroll(page)
    // The column below the fold is revealed lazily, so check again at the bottom.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForTimeout(900)
    await noSidewaysScroll(page)
  })
}

test('and draws them in light as well as dark', async ({ page }) => {
  await page.goto('/')
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(600)

  expect(await page.evaluate(() => document.documentElement.className)).toContain('dark')
  await page.locator('.pill').click()
  await page.waitForTimeout(1200)
  expect(
    await page.evaluate(() => document.documentElement.className),
    'the switch should have put the page in light',
  ).toContain('light')

  await edgesMatchTheDesign(page)

  const fills = await page.evaluate(() => {
    const bg = el => (el ? getComputedStyle(el).backgroundColor : null)
    const border = el => (el ? getComputedStyle(el).borderTopColor : null)
    return {
      page: bg(document.body),
      card: bg(document.querySelector('#stage .u-card')),
      cardLine: border(document.querySelector('#stage .u-card')),
      chip: bg(document.querySelector('.chip')),
    }
  })
  expect(fills.page, 'the page is /BG 1').toBe('rgb(244, 245, 246)')
  expect(fills.card, 'a card is /BG 2').toBe('rgb(255, 255, 255)')
  expect(fills.cardLine, 'inside a /Border 2 hairline').toBe('rgb(216, 219, 222)')
  expect(fills.chip, 'the chip is /Border 1 used as a fill').toBe('rgb(238, 240, 241)')
})

test('the teaser arrows sit in their corners', async ({ page }) => {
  for (const route of ['/', '/ar']) {
    await page.goto(route)
    await curtainEndsOpen(page, 9000)
    await page.waitForTimeout(500)
    const arrows = await page.evaluate(() => [...document.querySelectorAll('.teaser__arrow')].map((a) => {
      const card = a.closest('.teaser')
      const ar = a.getBoundingClientRect()
      const cr = card.getBoundingClientRect()
      const rtl = getComputedStyle(card).direction === 'rtl'
      return {
        position: getComputedStyle(a).position,
        fromBottom: Math.round(cr.bottom - ar.bottom),
        fromEnd: Math.round(rtl ? ar.left - cr.left : cr.right - ar.right),
      }
    }))
    expect(arrows.length, `${route} should have teaser arrows`).toBeGreaterThan(0)
    for (const a of arrows) {
      expect(a.position, `${route}: placed by the card, not left in the text flow`).toBe('absolute')
      // 1rem at S, 1.5rem from 810; the inline-end inset is 1rem then 2rem.
      expect(a.fromBottom, `${route}: pinned to the bottom`).toBeLessThanOrEqual(32)
      expect(a.fromEnd, `${route}: pinned to the reading-end side`).toBeLessThanOrEqual(40)
    }
  }
})

test('placeholders are never split into columns', async ({ page }) => {
  for (const route of ['/', '/about', '/ar', '/projects/gudea-event-dashboard']) {
    await page.goto(route)
    await curtainEndsOpen(page, 9000)
    await page.waitForTimeout(1200)
    const split = await page.evaluate(() => [...document.querySelectorAll('.todo')]
      .map(t => ({ pieces: t.querySelectorAll('.todo__text').length, text: t.textContent.trim().slice(0, 40) }))
      .filter(t => t.pieces !== 1))
    expect(split, `${route}: a placeholder's text must stay one piece`).toEqual([])
  }
})

/*
  Reads pixels: the line is rasterisation, which no computed style can see.
  A leak is a spike, one row or column brighter than both neighbours; a monotonic step is just an edge.
  811@2 shows the defect; 390@3 and 1440@2 land on whole pixels and are the control.
*/
test('a cover never shows under its caption\'s edge', async ({ browser }) => {
  test.skip(!isFine() || isStill(), 'one pass per engine; each size opens its own context')
  test.setTimeout(120_000)

  const SIZES = [
    { viewport: { width: 811, height: 760 }, deviceScaleFactor: 2 },
    { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 },
    { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  ]

  /** Mean brightness per device row, or per device column, of a PNG. */
  const profile = (page, png, axis) => page.evaluate(async ({ b64, axis }) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const g = canvas.getContext('2d')
    g.drawImage(img, 0, 0)
    const { data } = g.getImageData(0, 0, img.width, img.height)
    const lum = (x, y) => { const i = (y * img.width + x) * 4; return (data[i] + data[i + 1] + data[i + 2]) / 3 }
    const [outer, inner] = axis === 'rows' ? [img.height, img.width] : [img.width, img.height]
    const out = []
    for (let a = 0; a < outer; a++) {
      let sum = 0
      for (let b = 0; b < inner; b++) sum += axis === 'rows' ? lum(b, a) : lum(a, b)
      out.push(Math.round(sum / inner))
    }
    return out
  }, { b64: png.toString('base64'), axis })

  const spikes = line => line.filter((v, i) => i > 0 && i < line.length - 1
    && v - line[i - 1] > 20 && v - line[i + 1] > 20)

  const found = []
  for (const size of SIZES) {
    const context = await browser.newContext(size)
    const page = await context.newPage()
    await page.goto('/')
    await curtainEndsOpen(page, 9000)
    await page.waitForTimeout(600)

    for (const theme of ['dark', 'light']) {
      if (theme === 'light') {
        await page.locator('.pill').click()
        await page.waitForTimeout(1200)
        expect(await page.evaluate(() => document.documentElement.className)).toContain('light')
      }
      const count = await page.locator('.work').count()
      expect(count, 'the home page shows its work cards').toBeGreaterThan(0)

      for (let i = 0; i < count; i++) {
        const card = page.locator('.work').nth(i)
        await card.evaluate(el => el.scrollIntoView({ block: 'center' }))
        await page.mouse.move(1, 1)
        await page.waitForTimeout(1500)
        const box = await card.boundingBox()
        const at = `${size.viewport.width}@${size.deviceScaleFactor} ${theme}, card ${i + 1}`

        const bottom = await page.screenshot({
          clip: { x: box.x + 40, y: box.y + box.height - 6, width: box.width - 80, height: 6 },
          scale: 'device',
        })
        const rows = await profile(page, bottom, 'rows')
        if (spikes(rows).length) found.push(`${at}: bottom edge rows ${rows.join(' ')}`)

        // The sides the scrim reaches, above the corners' curves.
        for (const [side, x] of [['start', box.x], ['end', box.x + box.width - 6]]) {
          const strip = await page.screenshot({
            clip: { x, y: box.y + box.height * 0.72, width: 6, height: box.height * 0.28 - 40 },
            scale: 'device',
          })
          const cols = await profile(page, strip, 'cols')
          if (spikes(cols).length) found.push(`${at}: ${side} edge columns ${cols.join(' ')}`)
        }
      }
    }
    await context.close()
  }

  expect(found, 'a light line along a card edge is the cover showing under its scrim').toEqual([])
})
