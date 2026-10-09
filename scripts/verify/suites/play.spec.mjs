import { expect, test } from '@playwright/test'
import { collectErrors, curtainEndsOpen, noInlineMotionLeft, noSidewaysScroll } from '../lib/assert.mjs'
import { isFine, isStill, isTouch } from '../lib/project.mjs'

// The home page's playthings: each plays, then hands its elements back with nothing inline.
// Waits restate config/motion.ts timings with a margin.

/** `tower.rewind.delay + tower.rewind.max`, plus the loop settling first: ms. */
const REBUILT = 450 + 1400 + 1500
/** `tower.touchRest` + a pile coming to rest + the rewind: ms. */
const REBUILT_BY_ITSELF = 1100 + 2500 + 1400 + 800

async function arrive(page, path = '/') {
  await page.goto(path)
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(900)
}

const displaced = page => page.evaluate(() =>
  [...document.querySelectorAll('.tower .block')].filter(b => b.style.transform).length)

async function towerInView(page) {
  const tower = page.locator('.tower')
  await tower.scrollIntoViewIfNeeded()
  await page.waitForTimeout(2600)
  return tower.boundingBox()
}

test.describe('the stack card: a tower you can knock down', () => {
  test('it arrives built, every block on its mark and nothing inline', async ({ page }) => {
    const errors = collectErrors(page)
    await arrive(page)
    await towerInView(page)

    const state = await page.evaluate(() => {
      const tower = document.querySelector('.tower')
      const blocks = [...tower.querySelectorAll('.block')]
      return {
        count: blocks.length,
        unbuilt: tower.classList.contains('is-unbuilt'),
        hidden: blocks.filter(b => getComputedStyle(b).visibility === 'hidden').length,
        inline: blocks.filter(b => b.style.transform).length,
        labels: blocks.map(b => b.querySelector('.sr-only')?.textContent).filter(Boolean).length,
        courses: new Set(blocks.map(b => Math.round(b.getBoundingClientRect().bottom))).size,
      }
    })
    expect(state.count, 'every CV technology is a block').toBe(19)
    expect(state.labels, 'and each one is named for a screen reader').toBe(19)
    expect(state.unbuilt).toBe(false)
    expect(state.hidden, 'nothing is left parked out of sight').toBe(0)
    expect(state.inline, 'the arrival hands every block back').toBe(0)
    expect([4, 5], 'four courses where the card is wide, five on a phone').toContain(state.courses)
    await noSidewaysScroll(page)
    expect(errors).toEqual([])
  })

  test('a pointer knocks it down, and leaving plays the fall backwards', async ({ page }) => {
    test.skip(!isFine() || isStill(), 'a hovering pointer, with motion')
    await arrive(page)
    const box = await towerInView(page)
    const before = await page.evaluate(() => [...document.querySelectorAll('.tower .block')].map((b) => {
      const r = b.getBoundingClientRect()
      return [r.left, r.top]
    }))

    const course = box.y + box.height - 14 - (before.length ? 1.5 * (await page.locator('.tower .block').first().boundingBox()).height : 50)
    await page.mouse.move(box.x + 3, course)
    await page.waitForTimeout(150)
    await page.mouse.move(box.x + box.width * 0.8, course, { steps: 24 })
    await page.waitForTimeout(700)
    expect(await displaced(page), 'the hand moves what it touches').toBeGreaterThan(2)

    await page.mouse.move(box.x - 150, box.y - 150, { steps: 3 })
    await page.waitForTimeout(REBUILT)
    expect(await displaced(page), 'the rewind hands every block back').toBe(0)
    const after = await page.evaluate(() => [...document.querySelectorAll('.tower .block')].map((b) => {
      const r = b.getBoundingClientRect()
      return [r.left, r.top]
    }))
    after.forEach(([x, y], i) => {
      expect(Math.abs(x - before[i][0]) + Math.abs(y - before[i][1]), `block ${i} is back on its mark`).toBeLessThan(0.5)
    })
    await noInlineMotionLeft(page)
  })

  test('a block can be picked up and thrown', async ({ page }) => {
    test.skip(!isFine() || isStill(), 'a hovering pointer, with motion')
    await arrive(page)
    const box = await towerInView(page)
    const top = page.locator('.tower .block').last()
    const b = await top.boundingBox()

    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 })
    await page.waitForTimeout(200)
    await page.mouse.down()
    await page.mouse.move(box.x + 30, box.y + 10, { steps: 5 })
    const held = await top.boundingBox()
    await page.mouse.up()
    expect(Math.abs(held.x - b.x) + Math.abs(held.y - b.y), 'the block follows the hand that holds it').toBeGreaterThan(20)

    await page.mouse.move(box.x - 150, box.y - 150, { steps: 3 })
    await page.waitForTimeout(REBUILT)
    expect(await displaced(page)).toBe(0)
  })

  test('a finger flicks a block, and the pile rebuilds itself', async ({ page }) => {
    test.skip(!isTouch() || isStill(), 'a touch screen, with motion')
    await arrive(page)
    await towerInView(page)
    // No wait: on a phone the first tap is what builds the physics world.

    for (const i of [18, 15]) {
      const b = await page.locator('.tower .block').nth(i).boundingBox()
      await page.touchscreen.tap(b.x + b.width * 0.3, b.y + b.height / 2)
      await page.waitForTimeout(250)
    }
    expect(await displaced(page), 'a tap moves the block it lands on').toBeGreaterThan(0)

    await page.waitForTimeout(REBUILT_BY_ITSELF)
    expect(await displaced(page), 'with no pointer to leave, rest is the cue to rebuild').toBe(0)
    await noSidewaysScroll(page)
  })

  test('under Reduce Motion it is a still tower', async ({ page }) => {
    test.skip(!isStill(), 'the stillness projects')
    await arrive(page)
    const box = await towerInView(page)
    if (isTouch()) {
      const b = await page.locator('.tower .block').last().boundingBox()
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
    }
    else {
      await page.mouse.move(box.x + 3, box.y + box.height - 40)
      await page.mouse.move(box.x + box.width * 0.8, box.y + box.height - 40, { steps: 16 })
    }
    await page.waitForTimeout(800)
    expect(await displaced(page)).toBe(0)
    expect(await page.locator('.tower.is-unbuilt').count()).toBe(0)
  })
})

test.describe('the stack card: the heading names the block you touch', () => {
  /** `tower.name.dwell` + `contact.roll.duration`, with a margin: ms. */
  const NAMED = 150 + 500 + 450
  /** `tower.name.hold` + the roll back, with a margin: ms. */
  const HELD = 1600 + 500 + 600
  const LABELS = ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'Vue.js', 'React.js', 'Nuxt.js', 'Pinia', 'Redux', 'Axios',
    'TanStack Query', 'Vuetify', 'Tailwind', 'Firebase', 'Netlify', 'GitHub', 'Vite', 'Figma', 'Postman']

  const line = page => page.evaluate(() => {
    const head = document.querySelector('.stack__head')
    return {
      showing: head?.getAttribute('data-head'),
      name: head?.querySelector('.stack__nameText')?.textContent.trim(),
      hidden: head?.querySelector('.stack__name')?.getAttribute('aria-hidden'),
      moving: [...head.querySelectorAll('*')].filter(el => el.style.transform && el.style.transform !== 'none').length,
    }
  })

  /** A synthetic pointermove on the block: it is named without the hand entering and pushing anything. */
  const pointAt = (page, i) => page.locator('.tower .block').nth(i).evaluate((el) => {
    const r = el.getBoundingClientRect()
    el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }))
  })

  test('pointing at a block names it, and leaving gives the heading back', async ({ page }) => {
    test.skip(!isFine(), 'a hovering pointer')
    await arrive(page)
    const box = await towerInView(page)
    expect((await line(page)).showing, 'the heading, before anything is asked').toBe('title')

    // From above, so the top block is reached before anything is pushed.
    const b = await page.locator('.tower .block').last().boundingBox()
    await page.mouse.move(b.x + b.width / 2, box.y + 2)
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 })
    await page.waitForTimeout(NAMED)
    const named = await line(page)
    expect(named.showing, 'a block under the pointer is named').toBe('name')
    expect(LABELS, `"${named.name}" is one of the tower's names`).toContain(named.name)
    expect(named.hidden, 'for the eye only').toBe('true')
    await expect(page.getByRole('heading', { name: 'My tech stack' }), 'the heading stays in the accessibility tree').toHaveCount(1)

    await page.mouse.move(box.x + box.width / 2, box.y - 120, { steps: 6 })
    await page.waitForTimeout(NAMED)
    expect((await line(page)).showing, 'leaving gives the heading back').toBe('title')
    await page.waitForTimeout(REBUILT)
    await noInlineMotionLeft(page)
  })

  test('a tap names the block, then the heading comes back', async ({ page }) => {
    test.skip(!isTouch(), 'a finger')
    await arrive(page)
    await towerInView(page)
    const i = 18
    const label = await page.locator('.tower .block').nth(i).getAttribute('data-label')
    const b = await page.locator('.tower .block').nth(i).boundingBox()
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
    await page.waitForTimeout(700)
    const named = await line(page)
    expect(named.showing, 'a tap names the block it landed on').toBe('name')
    expect(named.name, 'by the name of the block it landed on').toBe(label)
    await page.waitForTimeout(HELD)
    expect((await line(page)).showing, 'a finger has no leave, so the name holds a moment and goes').toBe('title')
  })

  test('under stillness the name changes without motion', async ({ page }) => {
    test.skip(!isStill() || isTouch(), 'a hovering pointer under Reduce Motion')
    await arrive(page)
    await towerInView(page)
    await pointAt(page, 7)
    await page.waitForTimeout(400)
    const named = await line(page)
    expect(named.showing, 'named under stillness too: a name is not motion').toBe('name')
    expect(named.name).toBe(await page.locator('.tower .block').nth(7).getAttribute('data-label'))
    expect(named.moving, 'and nothing rolled').toBe(0)
    expect(await displaced(page), 'the tower stood still').toBe(0)
  })

  test('a name never moves the card or the tower, and fits its line', async ({ page }) => {
    test.skip(!isFine(), 'a layout question, one engine per family')
    test.setTimeout(180_000)
    const failures = []
    for (const [width, height, path] of [[1200, 640, '/'], [1280, 720, '/'], [1440, 900, '/'], [390, 844, '/'], [390, 844, '/about']]) {
      await page.setViewportSize({ width, height })
      await arrive(page, path)
      await towerInView(page)
      const boxes = () => page.evaluate(() => {
        const r = sel => document.querySelector(sel).getBoundingClientRect()
        return { card: r('.stack'), tower: r('.tower'), head: r('.stack__head') }
      })
      const before = await boxes()
      const count = await page.locator('.tower .block').count()
      for (let i = 0; i < count; i++) {
        await pointAt(page, i)
        await page.waitForTimeout(NAMED)
        const fit = await page.evaluate(() => {
          const layer = document.querySelector('.stack__name')
          // The text's box, not the element's: the element is as wide as its line whatever it holds.
          const range = document.createRange()
          range.selectNodeContents(layer.querySelector('.stack__nameText'))
          const text = range.getBoundingClientRect()
          const cs = getComputedStyle(layer)
          const l = layer.getBoundingClientRect()
          return {
            name: layer.textContent.trim(),
            over: Math.max(text.right - (l.right - Number.parseFloat(cs.paddingRight)), (l.left + Number.parseFloat(cs.paddingLeft)) - text.left),
          }
        })
        const now = await boxes()
        const at = `${width}x${height} ${path} "${fit.name}"`
        if (fit.over > 0.5) failures.push(`${at}: runs ${fit.over.toFixed(1)}px past its line`)
        for (const k of ['card', 'tower', 'head']) {
          if (Math.abs(now[k].height - before[k].height) > 0.5 || Math.abs(now[k].top - before[k].top) > 0.5) failures.push(`${at}: moved the ${k}`)
        }
      }
    }
    expect(failures, 'a name must fit its line and move nothing').toEqual([])
  })
})

test.describe('the work cards: a screen that plays', () => {
  const state = page => page.evaluate(() => {
    const card = document.querySelector('.work')
    return {
      on: card.getAttribute('data-screen'),
      layer: Boolean(card.querySelector('.work__screen')),
      shown: card.querySelectorAll('.work__page.is-up, .work__page.is-arriving').length,
      inline: [...card.querySelectorAll('.work__page, .work__glass')].filter(p => p.style.clipPath).length,
    }
  })

  test('a hover plays the project’s screens in the cover, and leaving hands the card back', async ({ page }) => {
    test.skip(!isFine() || isStill(), 'a hovering pointer, with motion')
    await arrive(page)
    const card = await page.locator('.work').first().boundingBox()
    await page.mouse.move(card.x + card.width - 30, card.y + 30, { steps: 4 })
    await page.waitForTimeout(1400)

    const playing = await state(page)
    expect(playing.on).toBe('on')
    expect(playing.shown, 'a page is on the screen').toBeGreaterThan(0)

    const glass = await page.locator('.work').first().locator('.work__glass').boundingBox()
    expect(glass.x).toBeGreaterThan(card.x)
    expect(glass.x + glass.width).toBeLessThan(card.x + card.width)
    expect(glass.width * glass.height, 'a screen, not a sticker').toBeGreaterThan(card.width * card.height * 0.2)

    await page.mouse.move(card.x - 200, card.y + card.height + 200, { steps: 3 })
    await page.waitForTimeout(900)
    const after = await state(page)
    expect(after.on, 'the screen goes back to the cover’s own page').toBeNull()
    expect(after.inline, 'nothing is left inline').toBe(0)
    await noInlineMotionLeft(page)
  })

  test('on a phone, the card in the middle of the screen plays', async ({ page }) => {
    test.skip(!isTouch() || isStill(), 'a touch screen, with motion')
    await arrive(page)
    const card = page.locator('.work').first()
    const box = await card.boundingBox()
    await page.evaluate(y => window.scrollBy(0, y), box.y + box.height / 2 - (await page.evaluate(() => innerHeight)) / 2)
    await page.waitForTimeout(1800)
    expect((await state(page)).on).toBe('on')

    await page.evaluate(() => window.scrollBy(0, innerHeight))
    await page.waitForTimeout(1200)
    expect((await state(page)).on, 'it stops once it has left the middle').toBeNull()
  })

  test('under Reduce Motion the cover is simply the cover', async ({ page }) => {
    test.skip(!isStill(), 'the stillness projects')
    await arrive(page)
    const card = page.locator('.work').first()
    const box = await card.boundingBox()
    if (isFine()) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 })
    else await page.evaluate(y => window.scrollBy(0, y), box.y + box.height / 2 - (await page.evaluate(() => innerHeight)) / 2)
    await page.waitForTimeout(1500)
    const s = await state(page)
    expect(s.layer, 'the screen is never even built').toBe(false)
  })
})

test.describe('the projects card: a deck that counts itself', () => {
  const deck = page => page.evaluate(() => ({
    count: document.querySelector('.teaser__count')?.textContent,
    opened: [...document.querySelectorAll('.deck__card')].filter(c => c.style.getPropertyValue('--open')).length,
    cards: document.querySelectorAll('.deck__card').length,
  }))

  test('a hover deals the hand and counts it out; leaving gathers it', async ({ page }) => {
    test.skip(!isFine() || isStill(), 'a hovering pointer, with motion')
    await arrive(page)
    const rest = await deck(page)
    expect(rest.cards, 'a card for every project').toBeGreaterThan(0)
    expect(rest.count).toBe(String(rest.cards))

    const teaser = await page.locator('.right__projects').boundingBox()
    await page.mouse.move(teaser.x + teaser.width / 2, teaser.y + 40, { steps: 3 })
    const counts = []
    for (let i = 0; i < 12; i++) {
      counts.push(Number((await deck(page)).count))
      await page.waitForTimeout(40)
    }
    const rising = counts.every((n, i) => i === 0 || n >= counts[i - 1])
    expect(rising, `the number counts up: ${counts.join(',')}`).toBe(true)
    expect(Math.min(...counts), 'it starts from the first card').toBeLessThan(rest.cards)
    await page.waitForTimeout(600)
    expect((await deck(page)).count).toBe(String(rest.cards))

    await page.mouse.move(teaser.x - 200, teaser.y + 40, { steps: 3 })
    await page.waitForTimeout(900)
    const gathered = await deck(page)
    expect(gathered.opened, 'the pile is the stylesheet’s again').toBe(0)
    expect(gathered.count, 'however it was interrupted, it ends on the truth').toBe(String(rest.cards))
  })

  test('a phone deals the hand once, when the card comes into view', async ({ page }) => {
    test.skip(!isTouch() || isStill(), 'a touch screen, with motion')
    await arrive(page)
    await page.locator('.right__projects').scrollIntoViewIfNeeded()
    await page.waitForTimeout(900)
    expect((await deck(page)).opened, 'dealt').toBeGreaterThan(0)
    await page.waitForTimeout(2600)
    expect((await deck(page)).opened, 'and gathered again').toBe(0)
  })
})

test('the social icons flood with their own colour, from where the pointer came in', async ({ page }) => {
  test.skip(!isFine() || isStill(), 'a hovering pointer, with motion')
  await arrive(page)
  const icon = page.locator('a.icon').nth(1)
  const b = await icon.boundingBox()
  await page.mouse.move(b.x - 20, b.y + b.height / 2)
  await page.mouse.move(b.x + 4, b.y + b.height / 2)
  await page.waitForTimeout(700)

  const inked = await icon.evaluate((el) => {
    const ink = el.querySelector('.ink--brand')
    return {
      full: ink?.classList.contains('is-full'),
      fill: ink && getComputedStyle(ink).backgroundColor,
      brand: getComputedStyle(el).getPropertyValue('--brand').trim(),
      glyph: getComputedStyle(el.querySelector('.icon__glyph')).color,
    }
  })
  expect(inked.full, 'the ink covers the tile').toBe(true)
  expect(inked.glyph, 'the glyph turns white over it').toBe('rgb(255, 255, 255)')
  const hex = inked.brand.replace('#', '')
  const rgb = [0, 2, 4].map(i => Number.parseInt(hex.slice(i, i + 2), 16))
  expect(inked.fill, 'in the platform’s own colour').toBe(`rgb(${rgb.join(', ')})`)

  await page.mouse.move(b.x + b.width / 2, b.y + b.height + 60, { steps: 3 })
  await page.waitForTimeout(700)
  expect(await icon.evaluate(el => el.querySelector('.ink')?.style.clipPath || ''), 'drained and handed back').toBe('')
})

test('on a phone the pictures lag their frames as the page scrolls', async ({ page }) => {
  test.skip(!isTouch() || isStill(), 'a touch screen, with motion')
  await arrive(page)
  const supported = await page.evaluate(() => CSS.supports('animation-timeline: view()'))
  test.skip(!supported, 'no scroll timelines in this engine: the pictures stay still, by design')

  const card = page.locator('.work').first()
  await card.scrollIntoViewIfNeeded()
  const shift = () => card.evaluate(el => Number.parseFloat(getComputedStyle(el.querySelector('.work__media')).translate.split(' ')[1] || '0'))
  const a = await shift()
  await page.evaluate(() => window.scrollBy(0, 200))
  await page.waitForTimeout(200)
  const b = await shift()
  expect(b - a, 'scrolling on moves the picture down its frame').toBeGreaterThan(1)
  expect(Math.abs(b), 'and never past the overscan').toBeLessThanOrEqual(12)
})
