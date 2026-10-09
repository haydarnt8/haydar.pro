import { expect, test } from '@playwright/test'
import { curtainEndsOpen, noInlineMotionLeft, settled } from '../lib/assert.mjs'
import { installSampler } from '../lib/sampler.mjs'
import { isStill, isTouch } from '../lib/project.mjs'

// Sampled per frame: a wrong-edge wipe, an early start or a pop to full width leaves no trace afterwards.

const ROW = '.exp__item'
const RULE = '.exp__rule'
const DIVIDER = '.intro__divider'
/** `rule.lag` in config/motion.ts, in ms, less two frames of sampling slack. */
const LAG_MS = 150 - 34

const isMobile = () => isTouch()
const isReduced = () => isStill()

test.beforeEach(async ({ context }) => {
  await context.addInitScript(installSampler)
})

function scaleX(el) {
  if (!el) return null
  if (!el.transform) return 1
  const m = el.transform.match(/matrix\(([^)]+)\)/)
  return m ? Number(m[1].split(',')[0]) : 1
}

function trace(frames, sel) {
  const scales = frames.map(f => scaleX(f.el[sel]))
  const firstZero = scales.findIndex(s => s !== null && s < 0.001)
  const lastZero = scales.findLastIndex(s => s !== null && s < 0.001)
  const start = lastZero + 1
  const done = scales.findIndex((s, i) => i > start && s !== null && s > 0.999)
  const popped = firstZero >= 0 && scales.slice(firstZero, lastZero + 1).some(s => s !== null && s > 0.01)
  const mid = frames
    .slice(start, done === -1 ? undefined : done)
    .filter((f) => { const s = scaleX(f.el[sel]); return s > 0.05 && s < 0.95 })
  return { hidden: firstZero >= 0, popped, startedAt: frames[start]?.t ?? null, done: done >= 0, mid, final: frames.at(-1).el[sel] }
}

function landing(frames, sel) {
  const ops = frames.map(f => f.el[sel]?.opacity ?? null)
  const lastHidden = ops.findLastIndex(o => o !== null && o < 0.5)
  return frames.slice(lastHidden + 1).find(f => (f.el[sel]?.opacity ?? 0) >= 0.99) ?? null
}

function grewFrom(edge, t, final) {
  const r = t.rect
  const e = final.rect
  return edge === 'left' ? Math.abs(r.x - e.x) : Math.abs((r.x + r.w) - (e.x + e.w))
}

for (const [route, edge] of [['/about', 'left'], ['/ar/about', 'right']]) {
  test(`${route}: the hairlines are wiped in from the ${edge}, each a beat after its text`, async ({ page }) => {
    test.skip(isReduced(), 'nothing is hidden or moved under stillness')
    await page.addInitScript(sels => window.__watch?.(sels, 15000), [ROW, RULE, DIVIDER])

    await page.goto(route)
    await curtainEndsOpen(page, 9000)
    // The list sits below the fold: scrolled in after the divider's beat, sampled across the scroll.
    await page.waitForTimeout(400)
    await page.evaluate(() => document.querySelector('.exp__list')?.scrollIntoView({ block: 'center' }))
    await settled(page)
    const frames = await page.evaluate(() => window.__frames())

    const divider = trace(frames, DIVIDER)
    expect(divider.hidden, 'the divider starts with no width').toBe(true)
    expect(divider.popped, 'and never pops to full width while it waits').toBe(false)
    expect(divider.done, 'and reaches its full width').toBe(true)
    expect(divider.mid.length, 'frames were caught mid-wipe').toBeGreaterThan(2)
    for (const f of divider.mid) {
      expect(grewFrom(edge, f.el[DIVIDER], divider.final), `the divider grows from the ${edge} at t=${f.t}`).toBeLessThan(1.5)
    }

    // The row rules only exist at md and up.
    if (!isMobile()) {
      const rule = trace(frames, RULE)
      expect(rule.hidden, 'the rule starts with no width').toBe(true)
      expect(rule.popped, 'and never pops to full width while it waits').toBe(false)
      expect(rule.done, 'and reaches its full width').toBe(true)

      const landed = landing(frames, ROW)
      expect(landed, 'the row itself landed').not.toBeNull()
      expect(rule.startedAt - landed.t, 'the rule waits its beat after the row').toBeGreaterThanOrEqual(LAG_MS)

      expect(rule.mid.length, 'frames were caught mid-wipe').toBeGreaterThan(2)
      for (const f of rule.mid) {
        expect(grewFrom(edge, f.el[RULE], rule.final), `the rule grows from the ${edge} at t=${f.t}`).toBeLessThan(1.5)
      }
    }

    await noInlineMotionLeft(page)
  })
}

test('under stillness the hairlines are simply there', async ({ page }) => {
  test.skip(!isReduced(), 'the stillness project only')
  await page.goto('/about')
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(600)

  const lines = await page.evaluate(() =>
    [...document.querySelectorAll('.exp__rule, .intro__divider')].map(el => ({
      transform: getComputedStyle(el).transform,
      inline: el.getAttribute('style') ?? '',
    })))
  expect(lines.length).toBeGreaterThan(0)
  for (const line of lines) {
    expect(line.transform, 'no scale of any kind').toBe('none')
    expect(line.inline, 'and nothing written inline').toBe('')
  }
})
