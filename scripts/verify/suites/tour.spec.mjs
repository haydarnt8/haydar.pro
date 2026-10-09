import { expect, test } from '@playwright/test'
import { collectErrors, curtainEndsOpen, noInlineMotionLeft, noSidewaysScroll, nothingHiddenInView } from '../lib/assert.mjs'
import { isStill, isTouch } from '../lib/project.mjs'

// The guided tour on project pages (ProjectTour.vue).
const PAGE = '/projects/health360-education-platform'
const wide = page => page.evaluate(() => matchMedia('(width >= 1200px)').matches)

async function arrive(page, path = PAGE) {
  await page.goto(path)
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(600)
}

/** Put step `i`'s middle on the viewport's middle line, as a reader would. */
async function readStep(page, i, settle = 1600) {
  await page.evaluate((i) => {
    const s = document.querySelector(`[data-step="${i}"]`)
    const r = s.getBoundingClientRect()
    window.scrollTo(0, r.top + scrollY + r.height / 2 - innerHeight / 2)
  }, i)
  await page.waitForTimeout(settle)
}

test('every project is a tour, and none is the gallery page', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/projects')
  await curtainEndsOpen(page, 9000)
  const projects = await page.$$eval('.row__link', links => [...new Set(links.map(a => a.getAttribute('href')))])
  expect(projects.length, 'every project on the index').toBeGreaterThan(0)
  for (const href of projects) {
    await page.goto(href)
    await curtainEndsOpen(page, 9000)
    expect(await page.locator('.tour-page[data-project]').count(), `${href} is a tour`).toBe(1)
    expect(await page.locator('.detail').count(), `${href} is not the gallery page`).toBe(0)
    expect(await page.locator('[data-step]').count(), `${href} has its steps`).toBeGreaterThan(4)
  }
  expect(errors).toEqual([])
})

test('the blur is explained before the first shot, once', async ({ page }) => {
  await arrive(page)
  const nda = await page.evaluate(() => {
    const line = document.querySelector('.tour__nda--line')
    const glass = document.querySelector('.tour__nda--glass')
    const first = document.querySelector('[data-step="0"]')
    const box = el => el.getBoundingClientRect()
    const shown = el => getComputedStyle(el).display !== 'none' && box(el).width > 2
    return {
      text: line.textContent.trim(),
      before: !!(line.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING),
      line: shown(line),
      glass: shown(glass),
      inFrame: (() => { const g = box(glass), f = box(document.querySelector('.stage__frame')); return g.left >= f.left && g.right <= f.right && g.top >= f.top && g.bottom <= f.bottom })(),
      glassHidden: !!glass.closest('[aria-hidden="true"]'),
      lineHidden: !!line.closest('[aria-hidden="true"]'),
    }
  })
  expect(nda.text, 'the gallery\'s own words').toMatch(/NDA/)
  expect(nda.before, 'ahead of the first step in the reading order').toBe(true)
  expect(nda.lineHidden, 'and read there').toBe(false)
  expect(nda.glassHidden, 'the screen\'s copy is for the eye only').toBe(true)
  if (await wide(page)) {
    expect(nda.glass, 'on the desk the screen wears it').toBe(true)
    expect(nda.inFrame, 'on the screen\'s corner').toBe(true)
    expect(nda.line, 'and the line is not shown twice').toBe(false)
  }
  else {
    expect(nda.line, 'below 1200px it is a line before the first step').toBe(true)
  }
})

test('the width readout never sits on the NDA note, in either language', async ({ page }) => {
  await arrive(page, '/projects/gudea-event-dashboard')
  test.skip(!(await wide(page)), 'the note is on the screen only on the desk')
  for (const lang of ['', '/ar']) {
    await arrive(page, `${lang}/projects/gudea-event-dashboard`)
    const i = await page.evaluate(() => [...document.querySelectorAll('.stage__layer')].findIndex(l => l.querySelector('.rz')))
    await readStep(page, i, 900)
    const handle = page.locator('.stage__layer .rz__handle')
    await handle.focus()
    for (const key of ['End', 'Home', 'PageUp', 'PageUp', 'PageUp']) {
      await page.keyboard.press(key)
      const meet = await page.evaluate(() => {
        const n = document.querySelector('.tour__nda--glass').getBoundingClientRect()
        const w = document.querySelector('.stage__layer .rz__width').getBoundingClientRect()
        return w.left < n.right && w.right > n.left && w.top < n.bottom && w.bottom > n.top
      })
      expect(meet, `${lang || '/en'} after ${key}: the readout is clear of the note`).toBe(false)
    }
  }
})

test('a project without a live screen in its cover opens straight onto the first shot', async ({ page }) => {
  await arrive(page, '/projects/gudea-dashboard')
  const open = await page.evaluate(() => ({
    hint: document.querySelectorAll('.op__hint').length,
    screen: document.querySelectorAll('.op__screen').length,
    inside: document.querySelector('.tour__inside').getBoundingClientRect().height,
    cover: document.querySelectorAll('.stage__cover').length,
  }))
  expect(open.screen, 'no screen to step into').toBe(0)
  expect(open.hint, 'so no promise of one').toBe(0)
  expect(open.inside, 'and no room kept for the camera').toBe(0)
  expect(open.cover).toBe(0)
  if (!(await wide(page))) return
  await page.evaluate(() => window.scrollTo(0, document.querySelector('.tour').getBoundingClientRect().top + scrollY - 40))
  await page.waitForTimeout(900)
  const first = await page.evaluate(() => [...document.querySelectorAll('.stage__layer')].map(l => l.classList.contains('is-on')))
  expect(first[0], 'the screen shows the first shot from the start').toBe(true)
  expect(first.filter(Boolean).length).toBe(1)
})

test('every step shows its own shot on the screen, and only that one', async ({ page }) => {
  await arrive(page)
  test.skip(!(await wide(page)), 'the shared screen is the desk layout')
  const steps = await page.locator('[data-step]').count()
  expect(steps, 'EMP has seven steps').toBe(7)
  for (let i = 0; i < steps; i++) {
    await readStep(page, i, 900)
    const on = await page.evaluate(() => [...document.querySelectorAll('.stage__layer')].map(l => l.classList.contains('is-on')))
    expect(on.filter(Boolean).length, `step ${i + 1}: one shot on the screen`).toBe(1)
    expect(on[i], `step ${i + 1}: and it is its own`).toBe(true)
  }
})

test('reading a step rings what it names, on the screen', async ({ page }) => {
  await arrive(page)
  test.skip(!(await wide(page)), 'the shared screen is the desk layout')
  await readStep(page, 1, 2600)
  const ink = await page.evaluate(() => {
    const layer = document.querySelectorAll('.stage__layer')[1]
    const el = layer.querySelector('.ink')
    return { phase: [...el.classList].find(c => c.startsWith('is-')) ?? 'rest', label: getComputedStyle(el.querySelector('.ink__label')).opacity }
  })
  expect(isStill() ? ['rest'] : ['is-turning'], 'the ring is drawn').toContain(ink.phase)
  expect(Number(ink.label), 'and its words are there').toBeGreaterThan(0.99)
})

test('the rope runs from the step to its ring, then lets go', async ({ page }) => {
  test.skip(isStill(), 'no rope under Reduce Motion')
  await arrive(page)
  test.skip(!(await wide(page)), 'the rope is the desk layout')
  await readStep(page, 0, 1200)
  await readStep(page, 1, 350)
  const during = await page.evaluate(() => {
    const d = document.querySelector('.tour__ropeLine').getAttribute('d') ?? ''
    const title = document.querySelector('[data-step="1"] .step__title').getBoundingClientRect()
    const frame = document.querySelector('.stage__frame').getBoundingClientRect()
    const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
    return { d, start: nums.slice(0, 2), end: nums.slice(-2), title: [title.left, title.right], frame: [frame.left, frame.right, frame.top, frame.bottom] }
  })
  expect(during.d, 'a rope is out').not.toBe('')
  expect(Math.abs(during.start[0] - during.title[0]), 'it starts at the title').toBeLessThan(30)
  expect(during.end[0], 'and ends on the screen').toBeGreaterThan(during.frame[0])
  expect(during.end[0]).toBeLessThan(during.frame[1])
  expect(during.end[1]).toBeGreaterThan(during.frame[2])
  expect(during.end[1]).toBeLessThan(during.frame[3])
  await page.waitForTimeout(2600)
  const after = await page.evaluate(() => ({
    d: document.querySelector('.tour__ropeLine').getAttribute('d') ?? '',
    styled: [...document.querySelectorAll('.tour__rope path')].filter(p => p.getAttribute('style')).length,
  }))
  expect(after.d, 'and it lets go').toBe('')
  expect(after.styled, 'leaving nothing written on it').toBe(0)
})

test('scrolling steps inside the cover\'s screen, and out of the zoom into the first shot', async ({ page }) => {
  test.skip(isStill(), 'no zoom under Reduce Motion')
  await arrive(page)
  test.skip(!(await wide(page)), 'the zoom is the desk layout')
  const at = async (f) => {
    await page.evaluate((f) => {
      const r = document.querySelector('.tour__inside').getBoundingClientRect()
      window.scrollTo(0, r.top + scrollY + (r.height - innerHeight * 0.5) * f)
    }, f)
    await page.waitForTimeout(400)
    return page.evaluate(() => ({
      p: Number(getComputedStyle(document.querySelector('.tour')).getPropertyValue('--p')),
      cover: document.querySelector('.stage__cover').classList.contains('is-on'),
      first: Number(getComputedStyle(document.querySelector('.stage__layer.is-first')).opacity),
    }))
  }
  const start = await at(0)
  const mid = await at(0.5)
  const end = await at(1.05)
  expect(start.p, 'at the start the camera is outside').toBeLessThan(0.05)
  expect(start.cover, 'looking at the cover').toBe(true)
  expect(mid.p, 'half way in').toBeGreaterThan(0.3)
  expect(mid.p).toBeLessThan(0.7)
  expect(end.p, 'and all the way in').toBe(1)
  expect(end.cover, 'where the cover has gone').toBe(false)
  expect(end.first, 'and the first shot is the screen').toBeGreaterThan(0.99)
})

test('the screen can be narrowed into the phone layout by the keyboard', async ({ page }) => {
  await arrive(page)
  const desk = await wide(page)
  const scope = desk ? '.stage__layer' : '.step__frame'
  await readStep(page, 6, 2600)
  const handle = page.locator(`${scope} .rz__handle`).last()
  await handle.focus()
  await page.keyboard.press('End')
  const layout = () => page.evaluate(s => {
    const rz = [...document.querySelectorAll(`${s} .rz`)].at(-1)
    return { phone: rz.classList.contains('is-phone'), now: Number(rz.querySelector('.rz__handle').getAttribute('aria-valuenow')), text: rz.querySelector('.rz__handle').getAttribute('aria-valuetext') }
  }, scope)
  const full = await layout()
  const room = await page.evaluate((s) => {
    const rz = [...document.querySelectorAll(`${s} .rz`)].at(-1)
    const f = rz.parentElement.getBoundingClientRect()
    const within = el => { const b = el.getBoundingClientRect(); return b.left >= f.left - 0.5 && b.right <= f.right + 0.5 && b.bottom <= f.bottom + 0.5 }
    return { handle: within(rz.querySelector('.rz__handle')), ticks: [...rz.querySelectorAll('.rz__tick')].every(within) }
  }, scope)
  expect(await handle.evaluate(h => !!h.closest('[aria-hidden="true"]')), 'the slider is in the accessibility tree').toBe(false)
  expect(room.handle, 'at full width the handle is still inside the screen').toBe(true)
  expect(room.ticks, 'and so is every number on the ruler').toBe(true)
  expect(full.now, 'End is the widest screen').toBe(1440)
  expect(full.phone, 'which is the desktop layout').toBe(false)
  expect(full.text, 'and says so').toContain('desktop')
  await page.keyboard.press('Home')
  const narrow = await layout()
  expect(narrow.now, 'Home is a phone').toBe(390)
  expect(narrow.phone, 'which is the phone layout').toBe(true)
  expect(narrow.text).toContain('phone')
  await page.keyboard.press('ArrowRight')
  expect((await layout()).now, 'an arrow is one step').toBe(430)
  await page.keyboard.press('Shift+ArrowRight')
  expect((await layout()).now, 'Shift is a big one').toBe(590)
})

test('a decision turns over to what it cost, and focus goes with it', async ({ page }) => {
  await arrive(page)
  await page.locator('.dc').scrollIntoViewIfNeeded()
  await page.waitForTimeout(1800)
  if (isStill()) {
    const still = await page.evaluate(() => ({
      buttons: [...document.querySelectorAll('.dc__turn')].filter(b => getComputedStyle(b).display !== 'none').length,
      inert: document.querySelectorAll('.dc [inert]').length,
      cost: getComputedStyle(document.querySelector('.dc__back')).visibility,
    }))
    expect(still.buttons, 'nothing turns under Reduce Motion').toBe(0)
    expect(still.inert, 'so neither face is put out of reach').toBe(0)
    expect(still.cost, 'and the cost is shown').toBe('visible')
    return
  }
  const card = page.locator('.dc__card').nth(1)
  await card.locator('.dc__front button').click()
  await page.waitForTimeout(800)
  const turned = await page.evaluate(() => ({
    turned: document.querySelectorAll('.dc__card')[1].classList.contains('is-turned'),
    focus: document.activeElement?.closest('[data-face]')?.dataset.face,
    frontInert: document.querySelectorAll('.dc__card')[1].querySelector('.dc__front').hasAttribute('inert'),
  }))
  expect(turned.turned, 'it turned').toBe(true)
  expect(turned.focus, 'focus went to its back').toBe('back')
  expect(turned.frontInert, 'and the front is out of reach').toBe(true)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(800)
  const back = await page.evaluate(() => ({
    turned: document.querySelectorAll('.dc__card')[1].classList.contains('is-turned'),
    focus: document.activeElement?.closest('[data-face]')?.dataset.face,
  }))
  expect(back.turned, 'Enter turns it home').toBe(false)
  expect(back.focus, 'with focus on its front').toBe('front')
})

test('in Arabic the screen and the story change sides', async ({ page }) => {
  await arrive(page, `/ar${PAGE}`)
  test.skip(!(await wide(page)), 'sides are the desk layout')
  const sides = await page.evaluate(() => ({
    stage: document.querySelector('.tour__stage').getBoundingClientRect().left,
    steps: document.querySelector('.tour__steps').getBoundingClientRect().left,
  }))
  expect(sides.stage, 'the screen is on the right in Arabic').toBeGreaterThan(sides.steps)
})

test('on a phone each step carries its own shot, and nothing scrolls sideways', async ({ page }) => {
  test.skip(!isTouch(), 'the phone layout')
  await arrive(page)
  const layout = await page.evaluate(() => ({
    stage: getComputedStyle(document.querySelector('.tour__stage')).display,
    frames: [...document.querySelectorAll('.step__frame')].filter(f => f.getBoundingClientRect().height > 100).length,
  }))
  expect(layout.stage, 'no shared screen on a phone').toBe('none')
  expect(layout.frames, 'every step has its own shot').toBe(7)
  // Centre each shot, not each step: a tall step would leave its shot above a short screen, never drawn.
  for (let i = 0; i < 7; i++) {
    await page.evaluate((i) => {
      const r = document.querySelector(`.step__frame[data-shot="${i}"]`).getBoundingClientRect()
      window.scrollTo(0, r.top + scrollY + r.height / 2 - innerHeight / 2)
    }, i)
    await page.waitForTimeout(500)
  }
  await page.waitForTimeout(1500)
  const inks = await page.evaluate(() => [...document.querySelectorAll('.step__frame .ink')].map(i => [...i.classList].find(c => c.startsWith('is-')) ?? 'rest'))
  for (const phase of inks) expect(isStill() ? ['rest'] : ['is-turning'], 'each ring is drawn as its step is read').toContain(phase)
  await noSidewaysScroll(page)
})

test('nothing is left hidden or half-moved anywhere along the tour', async ({ page }) => {
  const errors = collectErrors(page)
  await arrive(page)
  const H = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y < H; y += 600) {
    await page.evaluate(y => window.scrollTo(0, y), y)
    await page.waitForTimeout(250)
  }
  for (const f of [0, 0.35, 0.7, 1]) {
    await page.evaluate(f => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * f), f)
    await page.waitForTimeout(2600)
    await nothingHiddenInView(page)
    await noInlineMotionLeft(page)
  }
  expect(errors).toEqual([])
})
