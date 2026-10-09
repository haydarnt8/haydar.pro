import { expect, test } from '@playwright/test'
import { curtainEndsOpen, edgesMatchTheDesign, grainStaysFixed, noInlineMotionLeft, nothingHiddenInView } from '../lib/assert.mjs'
import { isFine, isStill, isTouch } from '../lib/project.mjs'

// The language-switch mirror (app/composables/useMirror.ts): copies fly, real cards stay hidden, nothing is left behind.

const CARDS = '.u-card, .work, .avatar, .icon'

async function record(page, ms = 9000) {
  await page.evaluate(({ ms, cards }) => {
    window.__mirror = { frames: 0, curtain: 0, copies: 0, journeys: [], words: null, shownMidFlight: 0, layerSeen: false }
    const t0 = performance.now()
    // Also caught on insertion: a busy engine (WebKit under automation) can skip every frame of a flight.
    new MutationObserver((records) => {
      for (const r of records) {
        for (const node of r.addedNodes) {
          if (node.nodeType === 1 && node.classList.contains('mirror')) {
            window.__mirror.layerSeen = true
            window.__mirror.copies = Math.max(window.__mirror.copies, node.children.length)
          }
        }
      }
    }).observe(document.body, { childList: true })
    const top = [...document.querySelectorAll(`#stage :is(${cards})`)]
    const tick = () => {
      const m = window.__mirror
      m.frames++
      const panel = document.querySelector('.curtain__panel')?.getBoundingClientRect()
      if (panel && panel.bottom > 0 && panel.top < innerHeight && panel.right > 0 && panel.left < innerWidth) m.curtain++
      const layer = document.querySelector('.mirror')
      if (layer) {
        m.layerSeen = true
        m.copies = Math.max(m.copies, layer.children.length)
        if (!m.journeys.length) {
          for (const copy of layer.children) {
            const a = copy.getAnimations()[0]
            const k = a?.effect.getKeyframes()
            const x = Number(k?.at(-1)?.transform.match(/translate\(([-\d.]+)px/)?.[1])
            m.journeys.push({ left: Number.parseFloat(copy.style.left), width: Number.parseFloat(copy.style.width), dx: x })
          }
          const child = layer.firstElementChild?.firstElementChild
          const fade = child?.getAnimations()[0]
          if (fade) m.words = fade.effect.getKeyframes().map(k => Number(k.opacity))
        }
        const flying = [...layer.children].some(c => c.getAnimations().some(a => a.playState === 'running'))
        if (flying) {
          const live = [...document.querySelectorAll(`#stage :is(${cards})`)]
            .filter(el => !el.parentElement.closest(cards))
            .filter(el => getComputedStyle(el).visibility === 'visible' && !el.style.visibility)
          if (live.length) m.shownMidFlight++
        }
      }
      if (performance.now() - t0 < ms) requestAnimationFrame(tick)
    }
    void top
    requestAnimationFrame(tick)
  }, { ms, cards: CARDS })
}

async function mirrored(page) {
  await page.waitForFunction(() => window.__mirror.layerSeen && !document.querySelector('.mirror') && !document.documentElement.classList.contains('is-mirroring'), undefined, { timeout: 12000 })
    .catch(async () => {
      const seen = await page.evaluate(() => ({ frames: window.__mirror.frames, copies: window.__mirror.copies, curtain: window.__mirror.curtain, layer: !!document.querySelector('.mirror'), scope: document.documentElement.classList.contains('is-mirroring') }))
      throw new Error(`no reflection was seen through: ${JSON.stringify(seen)}`)
    })
}

async function recorded(page) {
  return page.evaluate(() => window.__mirror)
}

async function nothingLeftBehind(page) {
  // Park the pointer in a margin first: after Back it would rest on the hero, which signs itself under it.
  if (isFine()) {
    await page.mouse.move(2, 2)
    await page.waitForTimeout(1500)
  }
  const left = await page.evaluate(cards => ({
    layer: !!document.querySelector('.mirror'),
    scope: document.documentElement.classList.contains('is-mirroring'),
    pinned: [...document.querySelectorAll(`#stage :is(${cards})`)].filter(el => el.style.visibility).map(el => el.className),
    inert: !!document.getElementById('stage')?.inert,
  }), CARDS)
  expect(left, 'the mirror leaves nothing behind').toEqual({ layer: false, scope: false, pinned: [], inert: false })
  await noInlineMotionLeft(page)
  await nothingHiddenInView(page)
  await grainStaysFixed(page)
}

async function home(page) {
  await page.goto('/')
  await curtainEndsOpen(page, 9000)
  // The intro plays on every load; let it hand the page over first.
  await page.waitForTimeout(1500)
}

test('a language switch is a mirror: every card on screen crosses to its reflection', async ({ page }) => {
  test.skip(isStill(), 'reduced motion keeps its crossfade — see below')
  await home(page)
  const onScreen = await page.evaluate(sel => [...document.querySelectorAll(`#stage :is(${sel})`)]
    .filter(el => !el.parentElement.closest(sel))
    .filter((el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0 }).length, CARDS)

  await record(page)
  await page.click('a.lang')
  await page.waitForURL('**/ar')
  await mirrored(page)
  const m = await recorded(page)

  expect(m.curtain, 'nothing covers the page: the curtain never enters it').toBe(0)
  expect(m.copies, 'every card on screen is carried').toBe(onScreen)
  expect(m.shownMidFlight, 'no real card shows while its copy is still flying').toBe(0)

  const W = page.viewportSize().width
  for (const j of m.journeys) {
    const mirrored = W - j.left - j.width
    expect(Math.abs(j.left + j.dx - mirrored), `a card from x=${j.left} should be aimed at x=${mirrored}`).toBeLessThanOrEqual(1)
  }
  expect(m.words, 'the words have their own animation').toEqual([1, 0])

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await nothingLeftBehind(page)
  await edgesMatchTheDesign(page)
  // A tap moves no focus: Safari would ring the heading for it.
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('H1')
})

test('a switch from the keyboard hands focus to the new heading', async ({ page }) => {
  test.skip(isStill() || isTouch(), 'a keyboard, with motion')
  await home(page)
  await page.focus('a.lang')
  await page.keyboard.press('Enter')
  await page.waitForURL('**/ar')
  await page.waitForFunction(() => !document.querySelector('.mirror') && !document.documentElement.classList.contains('is-mirroring'), undefined, { timeout: 12000 })
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('H1')
})

test('after a mirror, the Arabic hero still signs itself', async ({ page }) => {
  test.skip(!isFine() || isStill(), 'the signed hover is a fine pointer\'s, with motion')
  await home(page)
  await page.click('a.lang')
  await page.waitForURL('**/ar')
  await page.waitForFunction(() => !document.querySelector('.mirror') && !document.documentElement.classList.contains('is-mirroring'), undefined, { timeout: 12000 })

  const words = await page.evaluate(() => [...document.querySelectorAll('[data-intro-name][data-landed] .word')].map(w => w.textContent.trim()))
  expect(words, 'the name is its own word, ready for the hand').toContain('Haydar')

  const box = await page.locator('.info').boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 })
  await page.waitForFunction(() => {
    const sig = document.querySelector('.info__sig')
    return sig && getComputedStyle(sig).visibility === 'visible'
  }, undefined, { timeout: 4000 })
})

test('Back reflects it back', async ({ page }) => {
  test.skip(isStill(), 'reduced motion keeps its crossfade')
  await home(page)
  await page.click('a.lang')
  await page.waitForURL('**/ar')
  await page.waitForFunction(() => !document.querySelector('.mirror') && !document.documentElement.classList.contains('is-mirroring'), undefined, { timeout: 12000 })
  await page.waitForTimeout(400)

  await record(page)
  await page.goBack()
  await page.waitForURL(url => new URL(url).pathname === '/')
  await mirrored(page)
  const m = await recorded(page)
  expect(m.curtain, 'Back is a mirror too').toBe(0)
  expect(m.copies, 'and carries the cards back').toBeGreaterThan(0)
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await nothingLeftBehind(page)
})

test('a click in the middle of a mirror ends cleanly on the new page', async ({ page }) => {
  test.skip(isStill(), 'reduced motion keeps its crossfade')
  await home(page)
  await page.click('a.lang')
  await page.waitForTimeout(150)
  await page.evaluate(() => document.querySelector('#stage a[href$="/about"]')?.click())
  await page.waitForURL(url => /\/about$/.test(new URL(url).pathname), { timeout: 8000 })
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(600)
  await nothingLeftBehind(page)
})

test('away from home, a language change still takes the sweep', async ({ page }) => {
  test.skip(isStill(), 'reduced motion has its own path')
  await page.goto('/about')
  await curtainEndsOpen(page, 9000)
  // An in-app push, so Back stays within the app's history.
  await page.evaluate(() => document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$router.push('/ar/about'))
  await page.waitForURL('**/ar/about')
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(500)
  await record(page)
  await page.goBack()
  await page.waitForURL(url => new URL(url).pathname === '/about')
  await curtainEndsOpen(page, 9000)
  const m = await recorded(page)
  expect(m.layerSeen, 'no mirror away from home').toBe(false)
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
})

test('reduced motion switches language with no mirror', async ({ page }) => {
  test.skip(!isStill(), 'the reduced-motion projects only')
  await home(page)
  await record(page)
  await page.click('a.lang')
  await page.waitForURL('**/ar')
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(600)
  const m = await recorded(page)
  expect(m.layerSeen, 'nothing flies under reduced motion').toBe(false)
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await nothingLeftBehind(page)
})

test('on a phone, what was below the screen still arrives on scroll', async ({ page }) => {
  test.skip(!isTouch() || isStill(), 'the scrolling column, with motion')
  await home(page)
  await page.click('a.lang')
  await page.waitForURL('**/ar')
  await page.waitForFunction(() => !document.querySelector('.mirror') && !document.documentElement.classList.contains('is-mirroring'), undefined, { timeout: 12000 })
  await page.waitForTimeout(400)

  const waiting = await page.evaluate(() => [...document.querySelectorAll('#stage [style*="opacity: 0"]')]
    .filter(e => e.getBoundingClientRect().top >= innerHeight).length)
  expect(waiting, 'cards below the screen wait for their entrance').toBeGreaterThan(0)

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(1500)
  await nothingHiddenInView(page)
})
