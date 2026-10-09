import { expect, test } from '@playwright/test'
import { curtainEndsOpen } from '../lib/assert.mjs'
import { isFine, isStill, isTouch, isWebKit } from '../lib/project.mjs'

/* Type size and colour against the published design, and each page's language. */

// Measured on the published design: [font-size, line-height] in px per viewport width.
const RAMP = {
  390: { h1: [24, 33.6], tagline: [18, 28.8], about: [20, 28], story: [18, 30.6] },
  810: { h1: [32, 44.8], tagline: [24, 36], about: [26, 36.4], story: [20, 36] },
  1300: { h1: [28, 39.2], tagline: [22, 33], about: [24, 33.6], story: [18, 27] },
  1440: { h1: [32, 44.8], tagline: [24, 36], about: [26, 36.4], story: [20, 36] },
}

// Rounded to 0.01px: WebKit reports 33.6 as 33.599998.
const sizeOf = (page, sel) => page.evaluate((sel) => {
  const el = document.querySelector(sel)
  const cs = getComputedStyle(el)
  const px = v => Math.round(Number.parseFloat(v) * 100) / 100
  return [px(cs.fontSize), px(cs.lineHeight)]
}, sel)

test('the type follows the design at every breakpoint, L included', async ({ page }) => {
  test.skip(!isFine(), 'one engine per family is enough for a stylesheet question')
  for (const [width, want] of Object.entries(RAMP)) {
    await page.setViewportSize({ width: Number(width), height: 900 })
    await page.goto('/')
    await curtainEndsOpen(page, 9000)
    await page.waitForTimeout(500)
    expect(await sizeOf(page, '.info h1'), `${width}: the hero heading`).toEqual(want.h1)
    expect(await sizeOf(page, '.info__content > p'), `${width}: the hero line`).toEqual(want.tagline)
    expect(await sizeOf(page, '.teaser p.text-h3'), `${width}: the About line`).toEqual(want.about)

    await page.goto('/about')
    await curtainEndsOpen(page, 9000)
    await page.waitForTimeout(500)
    const story = await sizeOf(page, '.intro__section p')
    expect(story[0], `${width}: the About story's size`).toBe(want.story[0])
    expect(story[1], `${width}: and its leading`).toBeCloseTo(want.story[1], 1)
  }
})

test('the hero and About lines are in the design\'s own inks', async ({ page }) => {
  test.skip(!isFine(), 'one engine per family is enough for a stylesheet question')
  await page.goto('/')
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(500)
  const inks = await page.evaluate(() => {
    const color = sel => getComputedStyle(document.querySelector(sel)).color
    return { name: color('.info h1'), tagline: color('.info__content > p'), about: color('.teaser p.text-h3') }
  })
  expect(inks.name, 'the name is /Text 3').toBe('rgb(204, 204, 204)')
  expect(inks.about, 'the About line is /Text 3').toBe('rgb(204, 204, 204)')
  expect(inks.tagline, 'the tagline is /Text 1, AA-corrected').toBe('rgb(138, 138, 138)')
})

const ARABIC = /[؀-ۿ]/

for (const [route, sel] of [
  ['/ar', '.info__content > p'],
  ['/ar', '.teaser p.text-h3'],
  ['/ar/about', '.intro__section p'],
  ['/ar/about', '.intro__roles li'],
  ['/ar/projects', '.row h2'],
  ['/ar/projects/gudea-event-dashboard', '#stage h1'],
]) {
  test(`${route} says "${sel}" in Arabic`, async ({ page }) => {
    await page.goto(route)
    await curtainEndsOpen(page, 9000)
    const text = await page.locator(sel).first().textContent()
    expect(text?.trim(), `${route} ${sel}`).toMatch(ARABIC)
  })
}

test('the English pages stay English, and nothing renders as an object', async ({ page }) => {
  for (const route of ['/', '/about', '/projects', '/projects/gudea-event-dashboard', '/ar', '/ar/about', '/ar/projects', '/ar/projects/gudea-event-dashboard']) {
    await page.goto(route)
    await curtainEndsOpen(page, 9000)
    const text = await page.locator('#stage').innerText()
    expect(text, `${route} printed a value that was never resolved to one language`).not.toContain('[object Object]')
    if (!route.startsWith('/ar')) {
      expect(text, `${route} has Arabic on the English page`).not.toMatch(ARABIC)
    }
  }
})

// Everything seen or heard (text, alt, aria-label, title, placeholder) may hold only these names in Latin.
const NAMES = new Set([
  'Haydar', 'TransForat', 'Health360', 'Gudea', 'AL', 'Muraba', 'ERP', 'DMIS', 'CMS', 'QR', 'API',
  'HTML', 'CSS', 'JavaScript', 'TypeScript', 'Vue.js', 'React.js', 'Nuxt.js', 'Pinia', 'Redux', 'Axios',
  'TanStack', 'Query', 'Vuetify', 'Tailwind', 'Firebase', 'Netlify', 'GitHub', 'Vite', 'Figma', 'Postman',
  'LinkedIn', 'Telegram', 'WhatsApp', 'Instagram', 'English',
  'MERP', 'MDC', 'HES', 'EMP', 'AlMuraba', 'v2',
])
// Allowed on a project's own page only: anywhere else, "View" or "Table" would hide a leak.
const TECH = new Set([
  'Vue', 'vue', 'React', 'Router', 'Vuex', 'Vuexy', 'Vuelidate', 'webpack', 'CLI', 'Sass', 'Zustand', 'Recharts',
  'ApexCharts', 'Unovis', 'Leaflet', 'MapLibre', 'Mapbox', 'GL', 'OpenFreeMap', 'OpenStreetMap', 'DevExtreme',
  'DataGrid', 'TreeList', 'Table', 'Virtual', 'CASL', 'ABP', 'Keycloak', 'JWT', 'OTP', 'CSP', 'reCAPTCHA', 'i18n',
  'i18next', 'RTL', 'CKEditor', 'shadcn', 'reka', 'ui', 'vee', 'validate', 'validators', 'ofetch', 'dayjs', 'jsPDF',
  'pdf.js', 'PDF', 'html2canvas', 'JsBarcode', 'qrcode', 'cropperjs', 'cropper', 'advanced', 'he', 'tree', 'face',
  'api.js', 'PWA', 'WebSocket', 'SSE', 'Web', 'Locks', 'View', 'Transition', 'Transitions', 'DLMS', 'COSEM', 'OBIS',
  'Docker', 'nginx', 'CI', 'Vitest', 'Playwright', 'axe', 'push', 'commit', 'refactor', 'config', 'schema', 'slug',
  'parentId', 'mixins', 'postMessage', 'iframe', 'JSON', 'Excel', 'ISO', 'NET', 'px', 'pro', 'v3', 'v4',
  'BaseDynamic', 'Desktop', 'Mobile', 'headless', 'invoice',
  'backend', 'bottom', 'sheets', 'composable', 'commits', 'git',
])
const PHRASES = ['AL Muraba for Information Technology', 'MIGRATION_CHECKLIST.md']

const PROJECTS = ['al-muraba-erp', 'mdc-hes', 'gudea-dashboard', 'health360-education-platform', 'gudea-event-dashboard', 'al-muraba-dmis', 'government-mail-system', 'al-muraba-cms']
for (const route of ['/ar', '/ar/about', '/ar/projects', ...PROJECTS.map(s => `/ar/projects/${s}`)]) {
  test(`${route} says nothing in English`, async ({ page }) => {
    await page.goto(route)
    await curtainEndsOpen(page, 9000)
    const english = await page.evaluate(({ phrases, email }) => {
      const stage = document.querySelector('#stage')
      // WebKit's innerText drops the space where a line wraps between split words, so read those word by word.
      const split = [...new Set([...stage.querySelectorAll('.word')].map(w => w.closest(':not(.word):not(.word-mask)')))]
      const said = split.map(el => [...el.querySelectorAll('.word')].map(w => w.textContent).join(' '))
      const was = split.map(el => el.style.display)
      split.forEach((el) => { el.style.display = 'none' })
      said.push(stage.innerText)
      split.forEach((el, i) => { el.style.display = was[i] })
      for (const el of stage.querySelectorAll('[alt], [aria-label], [title], [placeholder]')) {
        for (const a of ['alt', 'aria-label', 'title', 'placeholder']) {
          if (el.hasAttribute(a)) said.push(el.getAttribute(a))
        }
      }
      let text = said.join('\n').replaceAll(email, ' ')
      for (const p of phrases) text = text.replaceAll(p, ' ')
      return text.match(/[A-Za-z][A-Za-z0-9.]*[A-Za-z0-9]|[A-Za-z]/g) ?? []
    }, { phrases: PHRASES, email: 'haydarnt8@gmail.com' })
    // Case-blind: eyebrow labels are uppercase.
    const allowed = new Set([...NAMES, ...(route.startsWith('/ar/projects/') ? TECH : [])].map(n => n.toLowerCase()))
    const leaks = [...new Set(english.filter(w => !allowed.has(w.toLowerCase())))]
    expect(leaks, `${route} shows English a visitor reads or hears`).toEqual([])
  })
}

// The About card's width follows the window's height, so assert clearance from the arrow, not a line count.
test('the hero line and the About line fit their cards', async ({ page }) => {
  test.skip(!isFine(), 'one engine per family is enough for a layout question')
  for (const [width, height] of [[1200, 800], [1200, 900], [1300, 1000], [1440, 900]]) {
    await page.setViewportSize({ width, height })
    for (const route of ['/', '/ar']) {
      await page.goto(route)
      await curtainEndsOpen(page, 9000)
      await page.waitForTimeout(500)
      const fit = await page.evaluate(() => {
        const tagline = document.querySelector('.info__content > p')
        const line = document.querySelector('.teaser p.text-h3')
        const arrow = document.querySelector('.teaser .teaser__arrow').getBoundingClientRect()
        return {
          tagline: Math.round(tagline.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(tagline).lineHeight)),
          clear: Math.round(arrow.top - line.getBoundingClientRect().bottom),
        }
      })
      expect(fit.tagline, `${width}x${height} ${route}: the hero line`).toBeLessThanOrEqual(4)
      expect(fit.clear, `${width}x${height} ${route}: the About line stays above its arrow`).toBeGreaterThanOrEqual(0)
    }
  }
})

// Hidden layers keep their size in the slot's grid, so one measurement covers every state.
test('the contact card\'s content stays inside its padding', async ({ page }) => {
  test.skip(!isFine(), 'one engine per family is enough for a layout question')
  for (const [width, height] of [[1440, 900], [1440, 760], [1280, 720], [1200, 800], [1200, 640]]) {
    await page.setViewportSize({ width, height })
    for (const route of ['/', '/ar']) {
      await page.goto(route)
      await curtainEndsOpen(page, 9000)
      await page.waitForTimeout(500)
      const fit = await page.evaluate(() => {
        const card = document.querySelector('.contact')
        const cs = getComputedStyle(card)
        const c = card.getBoundingClientRect()
        const top = c.top + Number.parseFloat(cs.borderTopWidth) + Number.parseFloat(cs.paddingTop)
        const bottom = c.bottom - Number.parseFloat(cs.borderBottomWidth) - Number.parseFloat(cs.paddingBottom)
        const head = card.querySelector('.contact__head').getBoundingClientRect()
        const form = card.querySelector('.contact__form').getBoundingClientRect()
        return {
          above: +(top - Math.min(head.top, form.top)).toFixed(1),
          below: +(Math.max(head.bottom, form.bottom) - bottom).toFixed(1),
        }
      })
      expect(fit.above, `${width}x${height} ${route}: the heading runs into the top padding`).toBeLessThanOrEqual(0.5)
      expect(fit.below, `${width}x${height} ${route}: the form runs into the bottom padding`).toBeLessThanOrEqual(0.5)
    }
  }
})

test('the CV is one step from the hero, and never covers a word of it', async ({ page, request }) => {
  test.skip(!isFine() && !isTouch(), 'a mouse at desktop and tablet widths, and the phones')
  test.setTimeout(120_000)

  const pdf = await request.get('/Haydar-Yosef-CV.pdf')
  expect(pdf.status(), 'the CV is served').toBe(200)
  expect(pdf.headers()['content-type'], 'as a PDF').toContain('application/pdf')
  expect((await pdf.body()).subarray(0, 5).toString(), 'and it is one').toBe('%PDF-')

  const sizes = isTouch() ? [null] : [[1440, 900], [1440, 760], [1280, 720], [1200, 640], [1024, 768], [834, 1112], [360, 740]]
  for (const size of sizes) {
    if (size) await page.setViewportSize({ width: size[0], height: size[1] })
    for (const route of ['/', '/ar']) {
      await page.goto(route)
      await curtainEndsOpen(page, 9000)
      await page.waitForTimeout(500)
      const cv = await page.evaluate(() => {
        const link = document.querySelector('.info__cv')
        const r = link.getBoundingClientRect()
        const card = document.querySelector('.info').getBoundingClientRect()
        const lang = document.querySelector('.info__langs').getBoundingClientRect()
        const text = [document.querySelector('.info h1'), ...document.querySelectorAll('.info__content > p')].flatMap((el) => {
          const range = document.createRange()
          range.selectNodeContents(el)
          return [...range.getClientRects()]
        })
        return {
          href: link.getAttribute('href'),
          target: link.target,
          covers: text.some(w => w.right > r.left + 0.5 && w.left < r.right - 0.5 && w.bottom > r.top + 0.5 && w.top < r.bottom - 0.5),
          inCard: r.left >= card.left && r.right <= card.right && r.top >= card.top && r.bottom <= card.bottom,
          besideLanguage: Math.abs(r.top - lang.top) < 1 && (r.right <= lang.left || r.left >= lang.right),
        }
      })
      const at = `${size ? size.join('x') : 'phone'} ${route}`
      expect(cv.href, `${at}: the CV link`).toBe('/Haydar-Yosef-CV.pdf')
      expect(cv.target, `${at}: it opens beside the page`).toBe('_blank')
      expect(cv.covers, `${at}: the CV button covers a word of the greeting or the tagline`).toBe(false)
      expect(cv.inCard, `${at}: the CV button stays in the hero card`).toBe(true)
      if (size && size[0] >= 810) expect(cv.besideLanguage, `${at}: in the language button's row, beside it`).toBe(true)
    }
  }
})

test('an Arabic 404 reads right to left, in Arabic', async ({ page }) => {
  await page.goto('/ar/not-a-page')
  await curtainEndsOpen(page, 9000)
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  expect(await page.locator('#stage').innerText()).toMatch(ARABIC)
})

test('Arabic is never cut by its mask, and the greeting keeps one baseline', async ({ page }) => {
  test.skip(isStill(), 'nothing is split under reduced motion')
  for (const route of ['/ar', '/ar/about', '/ar/projects']) {
    await page.goto(route)
    await curtainEndsOpen(page, 9000)
    await page.waitForTimeout(600)
    const masks = await page.evaluate(() => [...document.querySelectorAll('#stage *')]
      .filter(el => el.style.overflow === 'clip' || /\bu-mask-/.test(el.className))
      .filter(el => /[\u0600-\u06FF]/.test(el.textContent))
      .map(el => ({ text: el.textContent.trim().slice(0, 24), cls: String(el.className), inline: el.style.overflow })))
    expect(masks.length, `${route} has Arabic split into masks`).toBeGreaterThan(0)
    for (const m of masks) {
      expect(m.inline, `${route}: "${m.text}" is clipped to its own line`).toBe('')
      expect(m.cls, `${route}: "${m.text}" has room below its line`).toContain('u-mask-room')
    }
  }

  await page.goto('/ar')
  await curtainEndsOpen(page, 9000)
  await page.waitForSelector('[data-intro-name][data-landed]', { timeout: 6000 })
  const words = await page.evaluate(() => {
    const h1 = document.querySelector('[data-intro-name]')
    const line = Number.parseFloat(getComputedStyle(h1).lineHeight)
    return { line, tops: [...h1.querySelectorAll('.word')].map(w => w.getBoundingClientRect().top) }
  })
  // Words on one line share a top; a wrapped word is a whole line further down.
  for (const a of words.tops) for (const b of words.tops) {
    const d = Math.abs(a - b)
    expect(d <= 0.5 || d >= words.line * 0.8, `two words of the greeting ${d.toFixed(1)}px apart`).toBe(true)
  }
})

// WebKit grows a line whose masks clip by overflow, so every mask must clip by clip-path.
test('a heading split into letters keeps its line height', async ({ page }) => {
  test.skip(isStill(), 'nothing is split under reduced motion')
  for (const route of ['/projects/al-muraba-dmis', '/']) {
    await page.goto(route)
    await curtainEndsOpen(page, 9000)
    await page.waitForSelector('#stage h1[data-landed]', { timeout: 8000 })
    const h = await page.evaluate(() => {
      const h1 = document.querySelector('#stage h1')
      const line = Number.parseFloat(getComputedStyle(h1).lineHeight)
      const tops = new Set([...h1.querySelectorAll('.word')].map(w => Math.round(w.getBoundingClientRect().top)))
      return {
        line,
        lines: tops.size,
        height: h1.getBoundingClientRect().height,
        clipping: [...h1.querySelectorAll('*')].filter(el => el.style.overflow === 'clip').length,
      }
    })
    expect(h.lines, `${route}: the heading is split into words`).toBeGreaterThan(0)
    expect(h.clipping, `${route}: no mask is left clipping by overflow`).toBe(0)
    expect(Math.abs(h.height - h.lines * h.line), `${route}: ${h.lines} line(s) of ${h.line}px, ${h.height}px tall`).toBeLessThan(1.5)
  }
})

// WebKit names no face per glyph: match the system face's width, and check Plex is never requested.
const PLEX = /ibm-plex-sans-arabic/

test('the Arabic is SF Arabic on Apple devices, and Plex everywhere else', async ({ page }) => {
  const fetched = []
  page.on('request', r => fetched.push(r.url()))
  await page.goto('/ar')
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(800)
  const plex = fetched.filter(u => PLEX.test(u))

  if (isWebKit()) {
    expect(plex, 'an Apple device must not download Plex').toEqual([])
    const widths = await page.evaluate(() => {
      const measure = (family) => {
        const s = document.createElement('span')
        s.style.cssText = `font: 500 40px ${family}; position: absolute; white-space: nowrap; visibility: hidden`
        s.textContent = 'مرحبابكمفيبغداد'
        document.body.append(s)
        const w = s.getBoundingClientRect().width
        s.remove()
        return w
      }
      return { page: measure('var(--font-sans)'), system: measure('-apple-system') }
    })
    expect(Math.abs(widths.page - widths.system), 'the Arabic is drawn by the system face').toBeLessThan(0.5)
  }
  else {
    expect(plex.length, 'without the system face, the Arabic page draws Plex').toBeGreaterThan(0)
  }
})

test('an English page never downloads the Arabic face', async ({ page }) => {
  const fetched = []
  page.on('request', r => fetched.push(r.url()))
  for (const route of ['/', '/about', '/projects']) {
    await page.goto(route)
    await curtainEndsOpen(page, 9000)
    await page.waitForTimeout(500)
  }
  expect(fetched.filter(u => PLEX.test(u)), 'Plex on an English page').toEqual([])
})
