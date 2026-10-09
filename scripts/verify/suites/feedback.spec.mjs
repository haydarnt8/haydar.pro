import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { collectErrors, curtainEndsOpen, noInlineMotionLeft, noSidewaysScroll } from '../lib/assert.mjs'
import { isFine, isStill, isTouch, isWebKit } from '../lib/project.mjs'

// Copying the email and sending the contact form: the visitor is told, in order, and no roll leaves old text behind.

test('copying the address rolls the label and announces it', async ({ page, context }) => {
  // WebKit has no clipboard permission to grant and throws; the test is about the label, not the write.
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
  await page.goto('/')
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(800)

  const chip = page.locator('.chip')
  await expect(chip).toContainText(/copy/i)

  await chip.click()
  await page.waitForTimeout(1200)

  const settled = await page.evaluate(() => {
    const mask = document.querySelector('.chip__label')
    const status = [...document.querySelectorAll('[role="status"]')]
      .map(el => el.textContent.trim())
      .filter(Boolean)
    return {
      labels: mask.children.length,
      text: mask.textContent.trim(),
      inline: mask.firstElementChild?.getAttribute('style') ?? '',
      status,
    }
  })

  expect(settled.labels, 'the outgoing label must be removed, not stacked').toBe(1)
  expect(settled.text).toMatch(/copied/i)
  expect(settled.inline, 'the label must be handed back to CSS').toBe('')
  expect(settled.status.join(' '), 'the result has to be announced').toMatch(/copied/i)
})

const COPY = Object.fromEntries(['en', 'ar'].map(lang => [lang,
  JSON.parse(readFileSync(new URL(`../../../i18n/locales/${lang}.json`, import.meta.url), 'utf8')).contact]))

const ROW_ACTION = '[data-layer="form"] .contact__action'

// The contact endpoint is always stubbed (a test must never send mail); the stub records every payload.
async function stub(page, reply = route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' })) {
  const bodies = []
  await page.route('**/api.web3forms.com/**', (route) => {
    bodies.push(JSON.parse(route.request().postData() ?? '{}'))
    return reply(route)
  })
  return bodies
}

async function arrive(page, path = '/') {
  await page.goto(path)
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(800)
  await page.evaluate(() => document.querySelector('.contact').scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(1200)
}

/** Also waits out the ready pulse: a finger has no hover, so it runs on a phone. */
async function settle(page) {
  const still = () => page.waitForFunction(() => !document.querySelector('.contact .is-rolling')
    && ![...document.querySelectorAll('.contact .ink')].some(ink => ink.style.clipPath), null, { timeout: 5000 })
  await still()
  // Twice: a full pulse holds nothing inline for a moment, so one reading can land in that gap.
  await page.waitForTimeout(700)
  await still()
  await page.waitForTimeout(200)
}

const shown = (page, layer) => page.evaluate(
  l => getComputedStyle(document.querySelector(`.contact [data-layer="${l}"]`)).visibility === 'visible', layer)

const box = page => page.evaluate(() => {
  const r = el => { const b = document.querySelector(el).getBoundingClientRect(); return { w: b.width, h: b.height } }
  return { card: r('.contact'), stage: r('.contact__stage') }
})

const held = page => page.evaluate(() => [...document.querySelectorAll('.contact__stage [style], .contact__stage[style]')]
  .map(el => ['transform', 'visibility', 'clipPath', 'textIndent']
    .filter(p => el.style[p]).map(p => `${String(el.className).split(' ')[0]} ${p}: ${el.style[p]}`))
  .flat())

async function toMessage(page, address = 'someone@example.com') {
  await page.fill('#contact-email', address)
  await page.locator(ROW_ACTION).click()
  await settle(page)
}

test('two steps share one slot, and the card never changes size', async ({ page }) => {
  await stub(page)
  const sizes = isFine() ? [null, { width: 1280, height: 720 }] : [null]
  for (const size of sizes) {
    if (size) await page.setViewportSize(size)
    await arrive(page)
    const before = await box(page)

    expect(await page.locator(`${ROW_ACTION} .contact__labelText`).textContent()).toContain(COPY.en.next)
    await toMessage(page)

    expect(await shown(page, 'message'), 'the message field is in the slot').toBe(true)
    expect(await shown(page, 'email'), 'and the email has left it').toBe(false)
    expect(await page.evaluate(() => document.activeElement?.id), 'focus followed the step').toBe('contact-message')
    expect((await page.locator(`${ROW_ACTION} .contact__labelText`).textContent()).trim()).toBe(COPY.en.send)

    const after = await box(page)
    expect(Math.abs(after.card.h - before.card.h), 'the card keeps its height').toBeLessThan(0.5)
    expect(Math.abs(after.stage.h - before.stage.h), 'and so does the slot').toBeLessThan(0.5)
    expect(await held(page), 'the roll hands everything back').toEqual([])
    await noInlineMotionLeft(page)
  }
})

test('the button never changes width, so the field beside it never moves', async ({ page }) => {
  await stub(page, async (route) => { await new Promise(r => setTimeout(r, 900)); await route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' }) })
  await arrive(page)
  const width = () => page.evaluate(() => Math.round(document.querySelector('.contact__fields').getBoundingClientRect().width * 10) / 10)
  const next = await width()
  await toMessage(page)
  const send = await width()
  await page.fill('#contact-message', 'Hello')
  await page.focus('#contact-message')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(250)
  const sending = await width()
  expect(send, 'Next and Send leave the field the same width').toBe(next)
  expect(sending, 'and so does Sending…').toBe(next)
})

test('back returns to the email, with the address kept', async ({ page }) => {
  await stub(page)
  await arrive(page)
  await toMessage(page, 'kept@example.com')

  await page.locator('.contact__back').click()
  await settle(page)
  expect(await shown(page, 'email')).toBe(true)
  expect(await page.inputValue('#contact-email')).toBe('kept@example.com')
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('contact-email')
  expect((await page.locator(`${ROW_ACTION} .contact__labelText`).textContent()).trim()).toBe(COPY.en.next)
  expect(await held(page)).toEqual([])
})

for (const [path, lang] of [['/', 'en'], ['/ar', 'ar']]) {
  test(`${path}: a bad address or an empty message is refused, in the page's language`, async ({ page }) => {
    const bodies = await stub(page)
    await arrive(page, path)

    await page.fill('#contact-email', 'haydar@')
    await page.locator(ROW_ACTION).click()
    await page.waitForTimeout(700)
    expect(await page.evaluate(() => document.querySelector('#contact-email').validationMessage),
      'the browser says it, but in our words and the page\'s language').toBe(COPY[lang].invalidEmail)
    expect(await shown(page, 'email'), 'and the form stays where it is').toBe(true)

    await toMessage(page)
    await page.locator(ROW_ACTION).click()
    await page.waitForTimeout(700)
    expect(await page.evaluate(() => document.querySelector('#contact-message').validationMessage)).toBe(COPY[lang].emptyMessage)

    expect(bodies, 'nothing is sent until both are right').toEqual([])
    expect(await held(page), 'the shake hands the field back').toEqual([])
  })

  test(`${path}: Web3Forms is sent the address, the message and the language`, async ({ page }) => {
    const bodies = await stub(page)
    await arrive(page, path)
    await toMessage(page)
    await page.fill('#contact-message', 'A dashboard for a clinic')
    await page.keyboard.press('Enter')
    await expect.poll(() => bodies.length).toBe(1)

    const [body] = bodies
    expect(body.access_key, 'the public key').toMatch(/^[0-9a-f-]{36}$/)
    expect(body.email).toBe('someone@example.com')
    expect(body.message).toBe('A dashboard for a clinic')
    expect(body.botcheck, 'the honeypot, unticked').toBe(false)
    expect(body.subject).toContain('someone@example.com')
    expect(body.language).toBe(lang === 'ar' ? 'Arabic' : 'English')
  })
}

test('sent: the thanks takes the form\'s place, and Send another brings it back empty', async ({ page }) => {
  const errors = collectErrors(page)
  await stub(page)
  await arrive(page)
  const before = await box(page)
  await toMessage(page)
  await page.fill('#contact-message', 'Hello')

  await page.evaluate(() => {
    window.__frames = []
    const watch = () => {
      const moving = [...document.querySelectorAll('.contact__stage > *, .contact__field')]
        .some(el => el.style.transform && el.style.transform !== 'none')
      const indent = document.querySelector('#contact-message').style.textIndent
      window.__frames.push({ moving, indent })
      if (window.__frames.length < 150) requestAnimationFrame(watch)
    }
    requestAnimationFrame(watch)
  })
  // Enter from the field: Safari does not focus a button on click, so a click leaves no focus in the form.
  await page.focus('#contact-message')
  await page.keyboard.press('Enter')
  await expect.poll(() => shown(page, 'sent')).toBe(true)
  await settle(page)
  const frames = await page.evaluate(() => window.__frames)

  if (isStill()) {
    expect(frames.some(f => f.moving || f.indent), 'under Reduce Motion the states simply swap').toBe(false)
  }
  else {
    expect(frames.some(f => f.moving), 'the answer rolls in').toBe(true)
    expect(frames.some(f => Number.parseFloat(f.indent) > 0), 'the message is posted toward the button').toBe(true)
  }

  expect(await shown(page, 'form'), 'the form has given the slot to the answer').toBe(false)
  expect(await page.evaluate(() => !!document.activeElement?.closest('[data-layer="sent"]')),
    'focus followed the answer in').toBe(true)
  expect(await page.locator('.contact [role="status"]').textContent()).toContain(COPY.en.sent)
  expect(await page.evaluate(() => document.querySelectorAll('.contact__label > :not(.contact__labelSizer)').length),
    'no interrupted label roll left its copy behind').toBe(1)
  const after = await box(page)
  expect(Math.abs(after.card.h - before.card.h), 'the answer is the form\'s size').toBeLessThan(0.5)
  if (isTouch()) await noSidewaysScroll(page)

  await page.locator('[data-layer="sent"] .contact__action').click()
  await settle(page)
  expect(await shown(page, 'message')).toBe(true)
  expect(await page.inputValue('#contact-message'), 'another message starts empty').toBe('')
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('contact-message')
  expect(await held(page), 'and nothing the send moved is still held').toEqual([])
  await noInlineMotionLeft(page)
  expect(errors).toEqual([])
})

for (const [how, reply] of [
  ['refused', route => route.fulfill({ status: 400, contentType: 'application/json', body: '{"success":false,"message":"nope"}' })],
  ['unreachable', route => route.abort('failed')],
]) {
  test(`failed (${how}): the address is offered, and Try again returns the message`, async ({ page }) => {
    await stub(page, reply)
    await arrive(page)
    await toMessage(page)
    await page.fill('#contact-message', 'Returned to sender')
    await page.locator(ROW_ACTION).click()

    await expect.poll(() => shown(page, 'failed')).toBe(true)
    await settle(page)
    await expect(page.locator('[data-layer="failed"] a[href^="mailto:"]')).toBeVisible()
    expect(await page.locator('.contact [role="status"]').textContent()).toContain(COPY.en.failedLead)

    await page.locator('[data-layer="failed"] .contact__action').click()
    await settle(page)
    await page.waitForTimeout(400)
    expect(await shown(page, 'message')).toBe(true)
    expect(await page.inputValue('#contact-message'), 'the message comes back as it was typed').toBe('Returned to sender')
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('contact-message')
    expect(await held(page), 'and slid back all the way in').toEqual([])
  })
}

test('a hidden step is out of the tab order', async ({ page }) => {
  test.skip(!isFine() || isWebKit(), 'WebKit does not Tab to buttons by default; Chromium answers the question')
  await stub(page)
  await arrive(page)
  await page.focus('#contact-email')
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => document.activeElement?.closest('[data-layer]')?.dataset.layer),
    'the next stop is Next, not the message field waiting underneath').toBe('form')
  expect(await page.evaluate(() => document.activeElement?.classList.contains('contact__action'))).toBe(true)
})

const inkState = (page, host) => page.evaluate((host) => {
  const el = document.querySelector(`${host} .ink`)
  return { full: el.classList.contains('is-full'), inline: el.getAttribute('style') ?? '', display: getComputedStyle(el).display }
}, host)

test('the copy chip inks from the pointer, and shows the address it copies', async ({ page }) => {
  test.skip(!isFine() || isStill(), 'a hover, on a pointer that can hover')
  for (const size of [null, { width: 1200, height: 800 }]) {
    if (size) await page.setViewportSize(size)
    await page.goto('/')
    await curtainEndsOpen(page, 9000)
    await page.waitForTimeout(800)

    const chip = await page.locator('.chip').boundingBox()
    await page.mouse.move(chip.x - 20, chip.y + chip.height / 2)
    await page.mouse.move(chip.x + chip.width / 2, chip.y + chip.height / 2, { steps: 8 })
    await page.waitForTimeout(1000)

    expect((await inkState(page, '.chip')).full, 'the ink covers the chip').toBe(true)
    expect((await inkState(page, '.chip')).inline, 'and holds nothing inline to do it').toBe('')
    const shown = await page.evaluate(() => {
      const el = document.querySelector('.chip__address')
      return { decoded: document.querySelector('.chip').classList.contains('is-decoded'), text: el.textContent, fits: el.scrollWidth <= el.clientWidth + 0.5 }
    })
    expect(shown.decoded, 'the address takes the label\'s place').toBe(true)
    expect(shown.text, 'and it is the address the chip copies').toMatch(/^[\w.+-]+@[\w-]+\.[\w.]+$/)
    expect(shown.fits, `the address fits the chip at ${size?.width ?? 1440}px`).toBe(true)

    await page.mouse.move(chip.x + chip.width + 30, chip.y + chip.height / 2, { steps: 8 })
    await page.waitForTimeout(900)
    const after = await inkState(page, '.chip')
    expect(after.full, 'the ink drained').toBe(false)
    expect(after.inline, 'and was handed back to the stylesheet').toBe('')
    expect(await page.evaluate(() => document.querySelector('.chip').classList.contains('is-decoded'))).toBe(false)
  }
})

test('a press is a stamp, and hands the chip back', async ({ page, context }) => {
  test.skip(isStill(), 'no stamp under stillness — the chip is the designed one')
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
  await page.goto('/')
  await curtainEndsOpen(page, 9000)
  await page.evaluate(() => document.querySelector('.chip').scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(1200)

  await page.evaluate(() => {
    window.__squash = []
    const chip = document.querySelector('.chip')
    const watch = () => {
      window.__squash.push(chip.style.transform || '')
      if (window.__squash.length < 60) requestAnimationFrame(watch)
    }
    requestAnimationFrame(watch)
  })
  await page.locator('.chip').click()
  await page.waitForTimeout(1200)
  const frames = await page.evaluate(() => window.__squash)
  expect(frames.some(t => /scale|matrix/.test(t)), 'the press squashed the chip').toBe(true)
  expect(await page.evaluate(() => document.querySelector('.chip').style.transform), 'and let it go').toBe('')
})

test('a finger inks the press, shows the address, then the thanks', async ({ page, context }) => {
  test.skip(!isTouch() || isStill(), 'a touch screen, with motion')
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
  await page.goto('/')
  await curtainEndsOpen(page, 9000)
  await page.evaluate(() => document.querySelector('.chip').scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(1200)

  await page.evaluate(() => {
    window.__inked = false
    const ink = document.querySelector('.chip .ink')
    const watch = () => {
      if (ink.style.clipPath || ink.classList.contains('is-full')) window.__inked = true
      requestAnimationFrame(watch)
    }
    requestAnimationFrame(watch)
  })
  await page.locator('.chip').tap()

  await page.waitForTimeout(800)
  const during = await page.evaluate(() => ({
    decoded: document.querySelector('.chip').classList.contains('is-decoded'),
    address: document.querySelector('.chip__address').textContent,
    fits: (el => el.scrollWidth <= el.clientWidth + 0.5)(document.querySelector('.chip__address')),
  }))
  expect(during.decoded, 'the address takes the chip first').toBe(true)
  expect(during.address).toMatch(/^[\w.+-]+@[\w-]+\.[\w.]+$/)
  expect(during.fits, 'and fits it').toBe(true)
  expect(await page.evaluate(() => window.__inked), 'the tap flooded the chip').toBe(true)

  await page.waitForTimeout(1600)
  expect(await page.evaluate(() => document.querySelector('.chip').classList.contains('is-decoded'))).toBe(false)
  expect(await page.locator('.chip__label').textContent()).toMatch(/copied|نسخته/i)
  const after = await inkState(page, '.chip')
  expect(after.full || after.inline !== '', 'the ink lifted').toBe(false)
  await noSidewaysScroll(page)
})

test('the contact card\'s buttons are inked the same way', async ({ page }) => {
  test.skip(!isFine() || isStill(), 'a hover, on a pointer that can hover')
  await arrive(page)
  const next = await page.locator(ROW_ACTION).boundingBox()
  await page.mouse.move(next.x + next.width + 20, next.y + next.height / 2)
  await page.mouse.move(next.x + next.width / 2, next.y + next.height / 2, { steps: 6 })
  await page.waitForTimeout(900)
  expect((await inkState(page, ROW_ACTION)).full).toBe(true)
  await page.mouse.move(next.x + next.width / 2, next.y - 60, { steps: 6 })
  await page.waitForTimeout(800)
  expect(await inkState(page, ROW_ACTION)).toEqual({ full: false, inline: '', display: 'block' })
})

test('under stillness there is no ink, and no address decodes', async ({ page }) => {
  test.skip(!isStill(), 'the reduced-motion answer')
  await page.goto('/')
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(600)
  expect((await inkState(page, '.chip')).display).toBe('none')
  if (isFine()) {
    const chip = await page.locator('.chip').boundingBox()
    await page.mouse.move(chip.x + chip.width / 2, chip.y + chip.height / 2, { steps: 4 })
    await page.waitForTimeout(800)
    expect(await page.evaluate(() => document.querySelector('.chip').classList.contains('is-decoded'))).toBe(false)
  }
})

test('the card arrives written, once its heading has landed', async ({ page }) => {
  test.skip(isStill(), 'nothing is drawn under stillness: the card is simply there')
  await page.addInitScript(() => {
    window.__arrival = { ring: 0, prompts: new Set(), pulse: false }
    const watch = () => {
      const ring = document.querySelector('[data-layer="email"] .contact__ring')
      if (ring) window.__arrival.ring = Math.max(window.__arrival.ring, Number(getComputedStyle(ring).opacity))
      const prompt = document.querySelector('[data-layer="email"] .contact__prompt')
      if (prompt) window.__arrival.prompts.add(prompt.textContent)
      const ink = document.querySelector('[data-layer="form"] .contact__action .ink')
      if (ink && (ink.style.clipPath || ink.classList.contains('is-full'))) window.__arrival.pulse = true
      requestAnimationFrame(watch)
    }
    requestAnimationFrame(watch)
  })
  await page.goto('/')
  await curtainEndsOpen(page, 9000)
  await page.evaluate(() => document.querySelector('.contact').scrollIntoView({ block: 'center' }))
  await page.waitForFunction(() => document.querySelector('[data-layer="ask"]')?.hasAttribute('data-landed'), null, { timeout: 8000 })
  await page.waitForTimeout(2000)

  const seen = await page.evaluate(() => ({ ...window.__arrival, prompts: [...window.__arrival.prompts] }))
  expect(seen.ring, 'the pen drew the field').toBeGreaterThan(0.5)
  expect(seen.prompts.length, 'the prompt decoded in, through more than one frame of letters').toBeGreaterThan(2)
  expect(seen.pulse, 'and Next answered with its ink').toBe(true)

  const rest = await page.evaluate(() => ({
    ring: document.querySelector('[data-layer="email"] .contact__ring').getAttribute('style'),
    rect: document.querySelector('[data-layer="email"] .contact__ring rect').getAttribute('style'),
    prompt: document.querySelector('[data-layer="email"] .contact__prompt').textContent.trim(),
  }))
  expect(rest.ring, 'the pen handed the ring back').toBeNull()
  expect(rest.rect).toBeNull()
  expect(rest.prompt).toBe(COPY.en.placeholder)
})

test('the field is drawn round while it is written in, and its line is inked', async ({ page }) => {
  await stub(page)
  await arrive(page)
  const field = page.locator('[data-layer="email"]')
  const state = () => field.evaluate(f => ({
    ring: Number(getComputedStyle(f.querySelector('.contact__ring')).opacity),
    raised: getComputedStyle(f.querySelector('.contact__prompt')).transform !== 'none',
    fill: Number.parseFloat(f.style.getPropertyValue('--fill') || '0'),
    ready: f.classList.contains('is-ready'),
  }))

  await page.click('#contact-email')
  await page.waitForTimeout(700)
  let now = await state()
  expect(now.raised, 'the prompt floats up out of the way').toBe(true)
  if (!isStill()) expect(now.ring, 'the pen goes round the field').toBeGreaterThan(0.5)

  await page.keyboard.type('someone@gmail', { delay: 20 })
  await page.waitForTimeout(600)
  now = await state()
  expect(now.fill, 'the line grows with the address').toBeGreaterThan(0.2)
  expect(now.fill, 'but a domain with no ending is not an address yet').toBeLessThan(1)
  expect(now.ready).toBe(false)

  await page.keyboard.type('.com', { delay: 20 })
  await page.waitForTimeout(600)
  now = await state()
  expect(now.fill, 'a real address completes it').toBe(1)
  expect(now.ready).toBe(true)

  await page.locator('.contact h2[data-layer="ask"]').click()
  await page.waitForTimeout(700)
  expect(await field.evaluate(f => f.querySelector('.contact__ring').getAttribute('style')), 'the pen lifted').toBeNull()
  expect((await state()).raised, 'written in, the prompt stays up as a label').toBe(true)
})

test('an address with no domain ending is refused', async ({ page }) => {
  const bodies = await stub(page)
  await arrive(page)
  await page.fill('#contact-email', 'name@gmail')
  await page.locator(ROW_ACTION).click()
  await page.waitForTimeout(600)
  expect(await page.evaluate(() => document.querySelector('#contact-email').validationMessage)).toBe(COPY.en.invalidEmail)
  expect(await shown(page, 'email')).toBe(true)
  expect(bodies).toEqual([])
})

test('the whole card turns over when it is sent, and back for another', async ({ page }) => {
  await stub(page)
  await arrive(page)
  const before = await box(page)
  await toMessage(page, 'reader@example.com')
  await page.fill('#contact-message', 'Hello')
  await page.locator(ROW_ACTION).click()
  await expect.poll(() => shown(page, 'sent')).toBe(true)
  await settle(page)
  await page.waitForTimeout(300)

  expect(await shown(page, 'thanks'), 'the heading has become the thanks').toBe(true)
  expect(await shown(page, 'ask')).toBe(false)
  expect(await page.locator('[data-layer="sent"] .contact__answerText').textContent(),
    'with the address the reply will go to, where a typo can be seen').toContain('reader@example.com')
  expect(Math.abs((await box(page)).card.h - before.card.h), 'and the card is the same size').toBeLessThan(0.5)
  expect(await held(page)).toEqual([])

  await page.locator('[data-layer="sent"] .contact__action').click()
  await settle(page)
  await page.waitForTimeout(300)
  expect(await shown(page, 'ask'), 'another: the ask is back').toBe(true)
  expect(await shown(page, 'message')).toBe(true)
  await noInlineMotionLeft(page)
})
