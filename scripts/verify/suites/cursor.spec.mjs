import { expect, test } from '@playwright/test'
import { curtainEndsOpen } from '../lib/assert.mjs'
import { isFine } from '../lib/project.mjs'

// The custom cursor: never intercepts anything; absent, not merely still, off a fine pointer.

const disc = page => page.evaluate(() => {
  const box = document.querySelector('.cursor')
  const dot = document.querySelector('.cursor__dot')
  if (!box || !dot) return null
  const bs = getComputedStyle(box)
  const ds = getComputedStyle(dot)
  const m = bs.transform && bs.transform !== 'none'
    ? bs.transform.match(/matrix\(([^)]+)\)/)?.[1].split(',').map(Number)
    : null
  return {
    state: box.dataset.state,
    display: bs.display,
    opacity: Number(ds.opacity),
    scale: ds.scale,
    ring: ds.backgroundColor === 'rgba(0, 0, 0, 0)',
    x: m ? Math.round(m[4]) : null,
    y: m ? Math.round(m[5]) : null,
  }
})

test('it is absent on a touch screen and under reduced motion', async ({ page }) => {
  const shouldBeGone = !isFine()

  await page.goto('/')
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(600)

  const state = await disc(page)
  if (shouldBeGone) {
    expect(state?.display, 'a finger is not a cursor').toBe('none')
  }
  else {
    expect(state?.display).not.toBe('none')
  }
})

test('it follows the pointer and answers what is under it', async ({ page }) => {
  test.skip(!isFine(), 'pointer-only by design')

  await page.goto('/')
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(800)

  expect((await disc(page)).opacity, 'nothing is shown before the pointer moves').toBe(0)

  await page.mouse.move(720, 430)
  await page.waitForTimeout(400)
  const moved = await disc(page)
  expect(moved.opacity, 'the disc appears once the pointer does').toBe(1)
  expect(moved.x, 'it follows the pointer').toBeGreaterThan(600)

  const card = await page.locator('.work').first().boundingBox()
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2, { steps: 6 })
  await page.waitForTimeout(500)
  const onCard = await disc(page)
  expect(onCard.state).toBe('view')
  expect(Number(onCard.scale), 'the state scale must survive the follow').toBeGreaterThan(1.5)
  expect(onCard.ring, 'a card stays filled').toBe(false)

  expect(await page.locator('.cursor__word').textContent(), 'a card says what a press does').toBe('View')

  // Entered from above the blocks, where there is nothing yet to push.
  const tower = await page.locator('.tower').first().boundingBox()
  await page.mouse.move(tower.x + tower.width / 2, tower.y + 6, { steps: 6 })
  await page.waitForTimeout(500)
  const onTower = await disc(page)
  expect(onTower.state).toBe('push')
  expect(await page.locator('.cursor__word').textContent()).toBe('Push')

  const field = await page.locator('#contact-email').boundingBox()
  await page.mouse.move(field.x + 30, field.y + field.height / 2, { steps: 6 })
  await page.waitForTimeout(400)
  const onField = await disc(page)
  expect(onField.state).toBe('text')
  expect(onField.opacity, 'it gets out of the way of a text field').toBe(0)
})

test('it never intercepts anything', async ({ page }) => {
  test.skip(!isFine(), 'pointer-only by design')

  await page.goto('/')
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(800)
  await page.mouse.move(720, 430)
  await page.waitForTimeout(300)

  const hit = await page.evaluate(() => {
    const el = document.elementFromPoint(720, 430)
    return el ? `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}` : null
  })
  expect(hit, 'the cursor must be transparent to hit-testing').not.toContain('cursor')

  await page.click('a[href="/about"]')
  await page.waitForURL('**/about')
  await curtainEndsOpen(page)
})

test('the native arrow is hidden only where the disc is alive to replace it', async ({ page }) => {
  await page.goto('/')
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(900)

  const state = await page.evaluate(() => {
    const probe = sel => (document.querySelector(sel) ? getComputedStyle(document.querySelector(sel)).cursor : 'absent')
    return {
      klass: document.documentElement.classList.contains('has-cursor'),
      body: getComputedStyle(document.body).cursor,
      link: probe('a'),
      field: probe('#contact-email'),
      disc: !!document.querySelector('.cursor'),
    }
  })

  if (isFine()) {
    expect(state.disc, 'the disc is built on a fine pointer').toBe(true)
    expect(state.klass, 'and only then is the arrow hidden').toBe(true)
    expect(state.body, 'the page hides the system cursor').toBe('none')
    expect(state.link, 'including over links — the disc answers for them').toBe('none')
    // Blink serialises a field's default cursor as `text`, WebKit as `auto`; both render the I-beam.
    expect(['text', 'auto'], 'a text field keeps its I-beam').toContain(state.field)
  }
  else {
    expect(state.klass, 'no disc, no hiding — the arrow must survive').toBe(false)
    expect(state.body, 'the system cursor is untouched').not.toBe('none')
  }
})

test('the arrow comes back if the disc is ever torn down', async ({ page }) => {
  test.skip(!isFine(), 'only the built path can be torn down')

  await page.goto('/')
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(900)
  expect(await page.evaluate(() => document.documentElement.classList.contains('has-cursor'))).toBe(true)

  // Reduce Motion mid-session reverts the matchMedia branch that built the disc.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(900)

  const after = await page.evaluate(() => ({
    klass: document.documentElement.classList.contains('has-cursor'),
    body: getComputedStyle(document.body).cursor,
  }))
  expect(after.klass, 'the class goes with the branch that set it').toBe(false)
  expect(after.body, 'and the arrow is back').not.toBe('none')
})
