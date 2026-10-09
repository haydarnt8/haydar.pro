import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { curtainEndsOpen, settled } from '../lib/assert.mjs'
import { isFine, isStill, isTouch, isWebKit } from '../lib/project.mjs'

/**
 * Every card relative to `.wrap`, against a recorded fixture, in both languages and both engines.
 * `RECORD_BENTO=1` rewrites the fixture: record only on purpose, together with the design change.
 */
const FIXTURE = fileURLToPath(new URL('../fixtures/bento-geometry.json', import.meta.url))
const RECORD = process.env.RECORD_BENTO === '1'

const PROBES = [
  '.left', '.right', '.info', '.works', '.works__item', '.intro', '.intro__photo', '.intro__about',
  '.work.cell-1', '.contact', '.second', '.second__stack', '.second__toggle',
  '.right__social', '.right__projects', '.right__email',
]
const SIZES = [
  [390, 844], [810, 1080], [1024, 768], [1199, 900],
  [1200, 600], [1200, 640], [1200, 800], [1280, 720], [1439, 900],
  [1440, 600], [1440, 900], [1920, 1080], [2560, 1440],
]
const TOLERANCE = 0.5

const measure = page => page.evaluate((probes) => {
  const wrap = document.querySelector('.wrap').getBoundingClientRect()
  const f = v => Math.round(v * 1000) / 1000
  const out = {}
  for (const sel of probes) {
    out[sel] = [...document.querySelectorAll(sel)].map((el) => {
      const r = el.getBoundingClientRect()
      return [f(r.left - wrap.left), f(r.top - wrap.top), f(r.width), f(r.height)]
    })
  }
  return out
}, PROBES)

test('the bento keeps its geometry', async ({ page, browserName }) => {
  // One still Chromium (nothing can be mid-flight) and WebKit at desktop size.
  test.skip(!(isStill() && !isTouch()) && !(isWebKit() && isFine()), 'one project per engine')
  test.setTimeout(300_000)

  const recorded = existsSync(FIXTURE) ? JSON.parse(readFileSync(FIXTURE, 'utf8')) : {}
  if (!RECORD) expect(recorded[browserName], `no recorded geometry for ${browserName}: record it with RECORD_BENTO=1`).toBeTruthy()

  const now = {}
  const moved = []
  for (const route of ['/', '/ar']) {
    for (const [width, height] of SIZES) {
      await page.setViewportSize({ width, height })
      await page.goto(route)
      await curtainEndsOpen(page, 9000)
      await settled(page)
      const size = `${width}x${height}`
      const got = await measure(page)
      now[route] ??= {}
      now[route][size] = got
      if (RECORD) continue

      const was = recorded[browserName][route]?.[size]
      if (!was) {
        moved.push(`${route} ${size}: nothing recorded`)
        continue
      }
      for (const sel of PROBES) {
        const a = was[sel] ?? []
        const b = got[sel] ?? []
        if (a.length !== b.length) {
          moved.push(`${route} ${size} ${sel}: ${a.length} recorded, ${b.length} now`)
          continue
        }
        a.forEach((box, i) => {
          const off = Math.max(...box.map((v, k) => Math.abs(v - b[i][k])))
          if (off > TOLERANCE) moved.push(`${route} ${size} ${sel}[${i}]: [${box}] -> [${b[i]}]`)
        })
      }
    }
  }

  if (RECORD) {
    recorded[browserName] = now
    mkdirSync(dirname(FIXTURE), { recursive: true })
    writeFileSync(FIXTURE, `${JSON.stringify(recorded, null, 1)}\n`)
    return
  }
  expect(moved, 'a card that moved, against the recording').toEqual([])
})
