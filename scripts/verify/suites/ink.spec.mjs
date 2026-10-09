import { expect, test } from '@playwright/test'
import { collectErrors, curtainEndsOpen, noInlineMotionLeft } from '../lib/assert.mjs'
import { isStill } from '../lib/project.mjs'

/**
 * Gallery ink on the tour's shots: each ring lands on what it names, and its words are the caption's own.
 * DRAWN restates config/motion.ts with a margin, in ms: annotation.turn + draw x labelAt + label.
 */
const PAGE = '/projects/al-muraba-dmis'
const DRAWN = 750 + 560 + 400 + 700
const wide = page => page.evaluate(() => matchMedia('(width >= 1200px)').matches)

async function arrive(page, path = PAGE) {
  await page.goto(path)
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(600)
}

async function readStep(page, i, settle) {
  await page.evaluate((i) => {
    const s = document.querySelector(`[data-step="${i}"]`)
    const r = s.getBoundingClientRect()
    window.scrollTo(0, r.top + scrollY + r.height / 2 - innerHeight / 2)
  }, i)
  await page.waitForTimeout(settle)
}

/** On the shared screen from 1200px, in the step's own frame below. */
const inkOn = (page, i) => page.evaluate((i) => {
  const desk = matchMedia('(width >= 1200px)').matches
  const frame = desk ? document.querySelectorAll('.stage__layer')[i] : document.querySelector(`.step__frame[data-shot="${i}"]`)
  const ink = frame.querySelector('.ink')
  const line = ink.querySelector('.ink__line')
  const label = ink.querySelector('.ink__label')
  const words = getComputedStyle(label)
  return {
    phase: [...ink.classList].find(c => c.startsWith('is-')) ?? 'rest',
    offset: Number.parseFloat(getComputedStyle(line).strokeDashoffset) || 0,
    running: ink.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length,
    shown: words.opacity === '1' && (words.clipPath === 'none' || /^inset\(0(px)?( 0(px|%)?)*\)$/.test(words.clipPath)),
    // Custom properties are the ink's configuration; anything else inline is motion left behind.
    inline: [ink, line, label].flatMap(el => [...el.style].filter(p => !p.startsWith('--'))),
  }
}, i)

/** A layer that is off the screen is hidden, not moved, so it measures where it will be. */
function measureShots() {
  const desk = matchMedia('(width >= 1200px)').matches
  const n = desk ? document.querySelector('.tour__nda--glass')?.getBoundingClientRect() : null
  const frames = desk ? [...document.querySelectorAll('.stage__layer')] : [...document.querySelectorAll('.step__frame')]

  return frames.map((frame, i) => {
    // The two-layouts step is a slider of two shots, not a ringed one.
    if (frame.querySelector('.rz')) return { shot: i + 1, resize: true }
    const img = frame.querySelector('.stage__shot')
    const ink = frame.querySelector('.ink')
    if (!ink) return { shot: i + 1, ink: false }
    const svg = ink.querySelector('svg')
    const line = ink.querySelector('.ink__line')
    const label = ink.querySelector('.ink__label')
    const f = img.getBoundingClientRect()

    // Where `object-fit: contain` put the picture, from the picture's own size.
    const { width: W, height: H } = svg.viewBox.baseVal
    const k = Math.min(f.width / img.naturalWidth, f.height / img.naturalHeight)
    const px = f.left + (f.width - img.naturalWidth * k) / 2
    const py = f.top + (f.height - img.naturalHeight * k) / 2
    const b = line.getBBox()
    const want = [px + (b.x + b.width / 2) * k, py + (b.y + b.height / 2) * k]
    const r = line.getBoundingClientRect()
    const got = [r.left + r.width / 2, r.top + r.height / 2]

    const l = label.getBoundingClientRect()
    const at = { left: l.left - f.left, right: l.right - f.left, top: l.top - f.top, bottom: l.bottom - f.top }
    const side = [...label.classList].find(c => c.startsWith('ink__label--')).slice(12)
    const gap = { below: l.top - r.bottom, above: r.top - l.bottom, right: l.left - r.right, left: r.left - l.right }[side]

    return {
      shot: i + 1,
      ink: true,
      sized: img.naturalWidth === W && img.naturalHeight === H,
      off: Math.hypot(got[0] - want[0], got[1] - want[1]),
      inside: at.left >= -0.5 && at.top >= -0.5 && at.right <= f.width + 0.5 && at.bottom <= f.height + 0.5,
      underNote: !!n && l.left < n.right && l.right > n.left && l.top < n.bottom && l.bottom > n.top,
      gap,
      hidden: ink.getAttribute('aria-hidden'),
      label: label.textContent.trim(),
      // The screen's copy is decorative; the reader's words are the step frame's alt.
      caption: document.querySelector(`.step__frame[data-shot="${i}"] .stage__shot`)?.alt ?? '',
    }
  })
}

for (const lang of ['en', 'ar']) {
  test(`every shot's ink lands on what it names, in its caption's own words (${lang})`, async ({ page }) => {
    test.setTimeout(240_000)
    const errors = collectErrors(page)
    await page.goto('/projects')
    await curtainEndsOpen(page, 9000)
    const projects = await page.$$eval('.row__link', links => [...new Set(links.map(a => a.getAttribute('href')))])
    expect(projects.length, 'every project on the index').toBeGreaterThan(0)

    for (const href of projects) {
      const path = lang === 'ar' ? `/ar${href}` : href
      await page.goto(path)
      await curtainEndsOpen(page, 9000)
      // Every shot loaded, not only the one on screen: the check reads their real sizes.
      await page.evaluate(() => Promise.all([...document.querySelectorAll('.stage__shot')].map((img) => {
        img.loading = 'eager'
        return img.decode().catch(() => {})
      })))

      const shots = await page.evaluate(measureShots)
      // A tour that measured nothing would pass everything below: it has to have been there.
      expect(shots.filter(s => !s.resize).length, `${path}: its shots were measured`).toBeGreaterThan(0)
      for (const s of shots.filter(s => !s.resize)) {
        const at = `${path} shot ${s.shot}`
        expect(s.ink, `${at}: every shot has its ink`).toBe(true)
        expect(s.sized, `${at}: the note's size is the picture's own`).toBe(true)
        expect(s.off, `${at}: the ring is where the picture is`).toBeLessThan(2)
        expect(s.inside, `${at}: its words stay inside the frame`).toBe(true)
        expect(s.underNote, `${at}: its words are clear of the NDA note`).toBe(false)
        expect(s.gap, `${at}: its words sit beside the ring`).toBeGreaterThan(-10)
        expect(s.gap, `${at}: its words sit beside the ring`).toBeLessThan(16)
        expect(s.hidden, `${at}: decorative, the alt text says it all`).toBe('true')
        expect(s.caption.toLowerCase(), `${at}: "${s.label}" is the caption's own words`).toContain(s.label.toLowerCase())
        expect(/[؀-ۿ]/.test(s.label), `${at}: "${s.label}" is in the page's language`).toBe(lang === 'ar')
      }
    }
    expect(errors).toEqual([])
  })
}

test('a step\'s ring is drawn as it is read, again when it is read again, and nothing is left behind', async ({ page }) => {
  test.skip(isStill(), 'nothing is drawn under Reduce Motion — see the last test')
  const errors = collectErrors(page)
  await arrive(page)
  test.skip(!(await wide(page)), 'read again is the shared screen; a phone draws each frame once (tour.spec)')

  await readStep(page, 0, DRAWN)
  await readStep(page, 2, 150)
  const early = await inkOn(page, 2)
  expect(early.phase).toBe('is-turning')
  expect(early.offset, 'undrawn while the screen is still changing').toBeGreaterThan(0.9)
  expect(early.shown, 'and no words yet').toBe(false)
  expect((await inkOn(page, 0)).offset).toBeLessThan(0.001)

  await page.waitForTimeout(DRAWN)
  const late = await inkOn(page, 2)
  expect(late.offset, 'the ring is whole').toBeLessThan(0.001)
  expect(late.running, 'the pen has lifted').toBe(0)
  expect(late.shown, 'its words are out').toBe(true)
  expect(late.inline, 'nothing inline but the ink\'s own settings').toEqual([])

  await readStep(page, 0, 150)
  expect((await inkOn(page, 0)).offset).toBeGreaterThan(0.9)
  await page.waitForTimeout(DRAWN)
  expect((await inkOn(page, 0)).offset).toBeLessThan(0.001)

  await noInlineMotionLeft(page)
  expect(errors).toEqual([])
})

test('under Reduce Motion the ink is simply there', async ({ page }) => {
  test.skip(!isStill(), 'the Reduce Motion projects')
  await arrive(page)
  for (const i of [0, 1]) {
    await readStep(page, i, 400)
    const ink = await inkOn(page, i)
    expect(ink.phase, `shot ${i + 1}: never drawn`).toBe('rest')
    expect(ink.offset, `shot ${i + 1}: whole`).toBeLessThan(0.001)
    expect(ink.running).toBe(0)
    expect(ink.shown, `shot ${i + 1}: its words are there`).toBe(true)
  }
})
