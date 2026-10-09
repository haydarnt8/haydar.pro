import { expect, test } from '@playwright/test'
import { collectErrors, curtainEndsOpen, noInlineMotionLeft } from '../lib/assert.mjs'
import { isFine, isStill, isTouch } from '../lib/project.mjs'

// The border snake: a lit rope riding the edges of the nearest card, read back from the rendered path, never re-derived.

const CARDS = '.u-card, .work, .avatar, .icon'
const pointerOnly = () => test.skip(!isFine(), 'pointer-only by design')

async function arrive(page) {
  await page.goto('/')
  await curtainEndsOpen(page, 9000)
  await page.waitForTimeout(800)
}

// HEAD is the live end (the rope is drawn head-last); NEAR is point-to-rect distance, zero inside.
const IN_PAGE = `
  const CORE = () => [...document.querySelectorAll('.snake__line')].pop();
  const WRAP = () => document.querySelector('.wrap').getBoundingClientRect();
  const NEAR = (b, x, y) => Math.hypot(
    Math.max(b.x - x, 0, x - (b.x + (b.w ?? b.width))),
    Math.max(b.y - y, 0, y - (b.y + (b.h ?? b.height))),
  );
  const HEAD = () => {
    const core = CORE();
    if (!core || !core.getAttribute('d')) return null;
    const L = core.getTotalLength();
    if (!(L > 0)) return null;
    const w = WRAP();
    const p = core.getPointAtLength(L);
    return { x: p.x + w.left, y: p.y + w.top, lit: L };
  };
`

const head = page => page.evaluate(`(() => {
  ${IN_PAGE}
  const svg = document.querySelector('.snake');
  const run = document.querySelector('.snake__run');
  if (!svg || !run) return null;
  const live = svg.classList.contains('is-live');
  const h = HEAD();
  if (!h) return { live, at: null, litPx: 0, card: null };
  const core = CORE();
  const w = WRAP();
  const tail = core.getPointAtLength(0);
  return {
    live,
    litPx: h.lit,
    at: { x: h.x, y: h.y },
    tail: { x: tail.x + w.left, y: tail.y + w.top },
    /*
      THE ENGINE'S OWN ANSWER, as an attribute rather than as something inferred.

      It replaces reading the frame's x/y/width off a \`<rect>\`, which is what
      identified the card back when the snake WAS a rect. There is no rect now —
      the rope is a \`d\` — so the one thing geometry cannot recover is which card
      the engine believes it is on while the rope is spanning two of them.
    */
    card: Number(run.getAttribute('data-card')),
    origin: { x: w.left, y: w.top },
  };
})()`)

// 12 frames (~200ms) outlast a crossing's slowdown and a replan; STILL_PX is slack for d's one decimal place.
const STILL_FRAMES = 12
const STILL_PX = 0.2

/** Not settled(): the rope is an attribute, not an inline style. Fine pointer only; on touch it never stops (see snakeCircles). */
async function snakeSettles(page, { on = null, timeoutMs = 9000 } = {}) {
  // Seeded per call, so a previous call's history cannot report an instant arrival.
  await page.evaluate(() => { window.__snake = { x: null, y: null, frames: 0, seen: null } })

  await page.waitForFunction(
    new Function('a', `
      ${IN_PAGE}
      const { on, need, px } = a;
      const s = window.__snake;
      const svg = document.querySelector('.snake');
      if (!s || !svg) return false;
      const h = HEAD();
      if (!h) return false;

      // Lit, because while it is dark the ticker writes nothing at all and the
      // head is perfectly still on the card it LEFT — stillness alone would call
      // that an arrival.
      const alight = svg.classList.contains('is-live');
      const off = on ? NEAR(on, h.x, h.y) : 0;
      const there = !on || off < 2;
      /*
        A REVERSAL MOVES THE HEAD WITHOUT ANYTHING MOVING. When the tail is
        better placed to lead, the two ends trade roles: the same points are
        drawn, but the head is suddenly at the other end of the rope. That reads
        here as a large step, which resets the count — which is right, because
        what follows it is a fresh journey.
      */
      const steady = s.x !== null && Math.hypot(h.x - s.x, h.y - s.y) < px;
      s.frames = steady && there && alight ? s.frames + 1 : 0;
      s.x = h.x; s.y = h.y;
      s.seen = { x: Math.round(h.x), y: Math.round(h.y), off: +off.toFixed(1), lit: +h.lit.toFixed(1), there, alight };
      return s.frames >= need;
    `),
    { on, need: STILL_FRAMES, px: STILL_PX },
    { timeout: timeoutMs, polling: 'raf' },
  ).catch(async () => {
    const seen = await page.evaluate(() => window.__snake?.seen ?? null)
    const where = on ? ` on the card at ${Math.round(on.x)},${Math.round(on.y)}` : ''
    throw new Error(`the snake did not settle${where} within ${timeoutMs}ms: ${JSON.stringify(seen)}`)
  })
}

test('it rides the border of the card nearest the pointer', async ({ page }) => {
  pointerOnly()
  await arrive(page)

  const card = await page.locator('.contact').boundingBox()
  const px = card.x - 6
  const py = card.y + card.height * 0.34
  await page.mouse.move(px, py, { steps: 6 })
  await snakeSettles(page, { on: card })

  const h = await head(page)
  expect(h?.live, 'the snake lights when the pointer is on a card').toBe(true)
  expect(Math.abs(h.at.y - py), 'the head sits level with the pointer').toBeLessThan(2)
  expect(Math.abs(h.at.x - card.x), 'the head sits on the left edge').toBeLessThan(2)
  const astray = await page.evaluate(`(() => {
    ${IN_PAGE}
    const core = CORE();
    const w = WRAP();
    const box = ${JSON.stringify(card)};
    let worst = 0;
    const L = core.getTotalLength();
    for (let k = 0; k <= 40; k++) {
      const p = core.getPointAtLength((L * k) / 40);
      worst = Math.max(worst, NEAR(box, p.x + w.left, p.y + w.top));
    }
    return +worst.toFixed(2);
  })()`)
  expect(astray, 'the whole run lies on that card, not just its head').toBeLessThan(2)
})

test('it finds the nearest point on a corner, not just on an edge', async ({ page }) => {
  pointerOnly()
  await arrive(page)

  // .info's outer corner is the container's padding; a middle card's corner lands in a gutter where a neighbour is nearer.
  const card = await page.locator('.info').boundingBox()
  await page.mouse.move(card.x - 14, card.y - 14, { steps: 6 })
  await snakeSettles(page, { on: card })

  const h = await head(page)
  expect(h.at.x - card.x, 'the head is inset from the left edge').toBeGreaterThan(4)
  expect(h.at.y - card.y, 'the head is inset from the top edge').toBeGreaterThan(4)
  const radius = await page.locator('.info').evaluate(el => Number.parseFloat(getComputedStyle(el).borderTopLeftRadius))
  const centre = { x: card.x + radius, y: card.y + radius }
  const onArc = Math.hypot(h.at.x - centre.x, h.at.y - centre.y)
  expect(onArc, 'and it is exactly one radius from the corner centre').toBeCloseTo(radius - 0.5, 0)
})

test('the lit run is the same object on a big card and a small one', async ({ page }) => {
  pointerOnly()
  await arrive(page)

  const read = async (selector) => {
    const box = await page.locator(selector).first().boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 })
    await snakeSettles(page, { on: box })
    return (await head(page)).litPx
  }

  const hero = await read('.info')
  const tile = await read('.icon')
  expect(hero, 'the rope is its own length').toBeCloseTo(80, 0)
  expect(Math.abs(hero - tile), `a 1418px card and a 292px one: ${hero.toFixed(1)} against ${tile.toFixed(1)}`).toBeLessThan(1)
})

test('it always takes the shorter way round', async ({ page }) => {
  pointerOnly()
  await arrive(page)

  const card = await page.locator('.contact').boundingBox()
  // Both points inside the card, either side of the path's seam at (x + r, y), so no card change can happen.
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2, { steps: 6 })
  await snakeSettles(page, { on: card })

  await page.mouse.move(card.x + 60, card.y + 6, { steps: 6 })
  await snakeSettles(page, { on: card })

  const watching = page.evaluate(`(() => {
    ${IN_PAGE}
    const corner = ${JSON.stringify({ x: card.x, y: card.y })};
    let worst = 0;
    /*
      IT STOPS AT ARRIVAL, not after a fixed time — because a settled snake no
      longer stays settled. snake.settle starts it walking the card on its own
      0.4s after it parks, so a window long enough to watch the journey is also
      long enough to watch an orbit, and the orbit would be scored as straying.
      What is being asked here is which WAY it went round the corner, and that
      question is answered the moment it lands.
    */
    let quiet = 0, last = null;
    const cap = performance.now() + 2200;
    return new Promise((resolve) => {
      const tick = () => {
        const h = HEAD();
        if (h) {
          worst = Math.max(worst, Math.hypot(h.x - corner.x, h.y - corner.y));
          quiet = last && Math.hypot(h.x - last.x, h.y - last.y) < 0.2 ? quiet + 1 : 0;
          last = h;
        }
        if (quiet < 10 && performance.now() < cap) requestAnimationFrame(tick);
        else resolve(+worst.toFixed(1));
      };
      requestAnimationFrame(tick);
    });
  })()`)

  await page.mouse.move(card.x + 6, card.y + 60, { steps: 6 })
  const furthest = await watching

  const settled = await head(page)
  expect(Math.abs(settled.at.x - card.x), 'it ended on the left edge').toBeLessThan(12)
  expect(furthest, `it went the short way round the corner, straying ${furthest}px from it`).toBeLessThan(150)
})

test('the rope is one unbroken line, whatever it is crossing', async ({ page }) => {
  pointerOnly()
  await arrive(page)

  const a = await page.locator('.info').boundingBox()
  const b = await page.locator('.touch').boundingBox()
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2, { steps: 6 })
  await snakeSettles(page, { on: a })

  const watching = page.evaluate(`(() => {
    ${IN_PAGE}
    const seen = [];
    const stop = performance.now() + 2600;
    return new Promise((resolve) => {
      const tick = () => {
        const core = CORE();
        const d = core.getAttribute('d') || '';
        if (d) {
          const n = d.match(/-?\\d+(?:\\.\\d+)?/g).map(Number);
          let gap = 0;
          for (let i = 2; i + 1 < n.length; i += 2) {
            gap = Math.max(gap, Math.hypot(n[i] - n[i - 2], n[i + 1] - n[i - 1]));
          }
          seen.push({ gap, len: core.getTotalLength(), pts: n.length / 2 });
        }
        if (performance.now() < stop) requestAnimationFrame(tick);
        else {
          resolve({
            frames: seen.length,
            worstGap: +Math.max(...seen.map(s => s.gap)).toFixed(2),
            shortest: +Math.min(...seen.map(s => s.len)).toFixed(1),
            longest: +Math.max(...seen.map(s => s.len)).toFixed(1),
            fewestPoints: Math.min(...seen.map(s => s.pts)),
          });
        }
      };
      requestAnimationFrame(tick);
    });
  })()`)
  await page.mouse.move(b.x + 12, b.y + b.height * 0.6, { steps: 2 })
  const run = await watching

  // Consecutive points are 2px apart except one replan seam (two samples), so 8px bounds it.
  expect(run.frames, 'the recorder watched real frames').toBeGreaterThan(30)
  expect(run.fewestPoints, 'the rope is drawn as many points, not two').toBeGreaterThan(20)
  expect(run.worstGap, `the rope was broken by a ${run.worstGap}px gap`).toBeLessThan(8)
  expect(run.longest - run.shortest, `it breathed from ${run.shortest} to ${run.longest}px`).toBeLessThan(1.5)
})

test('it slows to a walk inside a pipe', async ({ page }) => {
  pointerOnly()
  await arrive(page)

  // A long journey: the head is inside a 16px bore for only two or three frames, too few to survive a dropped frame.
  const a = await page.locator('.info').boundingBox()
  const b = await page.locator('.touch').boundingBox()
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2, { steps: 6 })
  await snakeSettles(page, { on: a })

  const watching = page.evaluate(`(() => {
    ${IN_PAGE}
    const wrap = document.querySelector('.wrap');
    const boxes = [...wrap.querySelectorAll('${CARDS}')].map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    const seen = [];
    const stop = performance.now() + 2600;
    return new Promise((resolve) => {
      const tick = () => {
        const h = HEAD();
        if (h) {
          const off = Math.min(...boxes.map(bx => NEAR(bx, h.x, h.y)));
          seen.push({ t: performance.now(), x: h.x, y: h.y, off });
        }
        if (performance.now() < stop) requestAnimationFrame(tick);
        else {
          let onBorder = 0;
          let inBore = 0;
          let fastest = 0;
          let boreFastest = 0;
          for (let i = 1; i < seen.length; i++) {
            const dt = (seen[i].t - seen[i - 1].t) / 1000;
            const step = Math.hypot(seen[i].x - seen[i - 1].x, seen[i].y - seen[i - 1].y);
            // A reversal swaps which end is the head. Nothing moves; skip it.
            if (dt <= 0 || step > 25) continue;
            const v = step / dt;
            if (seen[i].off > 3) { inBore++; boreFastest = Math.max(boreFastest, v); }
            else { onBorder++; fastest = Math.max(fastest, v); }
          }
          resolve({ onBorder, inBore, fastest: Math.round(fastest), boreFastest: Math.round(boreFastest) });
        }
      };
      requestAnimationFrame(tick);
    });
  })()`)
  await page.mouse.move(b.x + b.width / 2, b.y + b.height * 0.6, { steps: 2 })
  const run = await watching

  expect(run.inBore, 'it was inside a pipe for some frames').toBeGreaterThan(1)
  expect(run.fastest, 'it gets up a proper speed along a border').toBeGreaterThan(400)
  expect(run.boreFastest, `it went through the bore at ${run.boreFastest}px/s`).toBeLessThan(420)
  expect(run.boreFastest, 'and it did not stop dead in there either').toBeGreaterThan(20)
})

test('it does not flicker in the gutter between two cards', async ({ page }) => {
  pointerOnly()
  await arrive(page)

  const a = await page.locator('.contact').boundingBox()
  const midline = a.x + a.width + 8 // the 16px gutter's centre
  const y = a.y + a.height / 2

  await page.mouse.move(a.x + a.width / 2, y, { steps: 6 })
  await snakeSettles(page, { on: a })
  const settled = (await head(page)).card

  const seen = []
  for (const dx of [0, 5, -5, 4, -4, 6, -6]) {
    await page.mouse.move(midline + dx, y, { steps: 2 })
    await page.waitForTimeout(260)
    seen.push((await head(page)).card)
  }
  expect(new Set(seen).size, `it stayed put in the gutter, saw cards ${seen.join(',')}`).toBe(1)
  expect(seen[0], 'and it stayed on the card it started from').toBe(settled)
})

test('every step it takes is between two cards that touch', async ({ page }) => {
  pointerOnly()
  await arrive(page)

  // Every step must be between cards that touch; the router may take two pipes when cheaper (snake.bridge.cost).
  const grid = await page.evaluate((sel) => {
    const wrap = document.querySelector('.wrap')
    const wr = wrap.getBoundingClientRect()
    const cards = [...wrap.querySelectorAll(sel)].map((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.left - wr.left, y: r.top - wr.top, w: r.width, h: r.height }
    })
    const touching = (a, b) => {
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
      const gx = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w)
      const gy = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h)
      return (oy >= 8 && gx >= -1 && gx <= 40) || (ox >= 8 && gy >= -1 && gy <= 40)
    }
    const pairs = []
    const near = cards.map(() => [])
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        if (!touching(cards[i], cards[j])) continue
        near[i].push(j)
        near[j].push(i)
        if (pairs.length < 3) pairs.push([i, j])
      }
    }
    return { cards, pairs, near, origin: { x: wr.left, y: wr.top } }
  }, CARDS)

  expect(grid.pairs.length, 'the grid has neighbours to test').toBeGreaterThan(0)

  for (const [i, j] of grid.pairs) {
    const from = grid.cards[i]
    const to = grid.cards[j]
    await page.mouse.move(grid.origin.x + from.x + from.w / 2, grid.origin.y + from.y + from.h / 2, { steps: 4 })
    await snakeSettles(page, { on: { x: grid.origin.x + from.x, y: grid.origin.y + from.y, width: from.w, height: from.h } })

    const watching = page.evaluate(`(() => {
      const run = document.querySelector('.snake__run');
      const seen = [];
      const stop = performance.now() + 2200;
      return new Promise((resolve) => {
        const tick = () => {
          const c = Number(run.getAttribute('data-card'));
          if (seen.at(-1) !== c) seen.push(c);
          if (performance.now() < stop) requestAnimationFrame(tick);
          else resolve(seen);
        };
        requestAnimationFrame(tick);
      });
    })()`)
    await page.mouse.move(grid.origin.x + to.x + 10, grid.origin.y + to.y + to.h * 0.6, { steps: 2 })
    const sat = await watching

    const trail = `${i}->${j}: ${sat.join(' -> ')}`
    expect(sat.length, `it went somewhere — ${trail}`).toBeGreaterThan(1)
    expect(sat.at(-1), `it arrived — ${trail}`).toBe(j)

    // A reversal can jump the head to the far end of a rope spanning two cards; that is still a step between neighbours.
    const strangers = sat.slice(1)
      .map((c, k) => (grid.near[sat[k]].includes(c) ? null : `${sat[k]}->${c}`))
      .filter(Boolean)
    expect(strangers, `${trail} stepped between cards that do not touch: ${strangers.join(', ')}`).toEqual([])
    // Two pipes can be cheaper than one; more is a tour.
    expect(sat.length, `a neighbour move sat on ${sat.length} cards — ${trail}`).toBeLessThanOrEqual(3)
  }
})

test('it is only ever on a border or inside a pipe', async ({ page }) => {
  pointerOnly()
  await arrive(page)

  const from = await page.locator('.info').boundingBox()
  const to = await page.locator('.icon').first().boundingBox()
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2, { steps: 6 })
  await snakeSettles(page, { on: from })

  const journey = page.evaluate(`(() => {
    ${IN_PAGE}
    const wrap = document.querySelector('.wrap');
    const boxes = [...wrap.querySelectorAll('${CARDS}')].map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });

    /*
      THE CROSSINGS, read off the markup rather than the engine's state.

      Nothing is drawn at a crossing until the light is near, so there is no
      picture to recover them from; instead every join publishes its two feet
      as data. The segment between them is exactly the path through the gutter.
    */
    const bores = [];
    const wr = WRAP();
    for (const g of document.querySelectorAll('.snake__join')) {
      const n = (k) => Number.parseFloat(g.getAttribute(k));
      bores.push({ ax: n('data-ax') + wr.left, ay: n('data-ay') + wr.top, bx: n('data-bx') + wr.left, by: n('data-by') + wr.top });
    }

    const toSegment = (px, py, s) => {
      const dx = s.bx - s.ax, dy = s.by - s.ay;
      const l2 = dx * dx + dy * dy;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - s.ax) * dx + (py - s.ay) * dy) / l2)) : 0;
      return Math.hypot(px - (s.ax + dx * t), py - (s.ay + dy * t));
    };

    const seen = [];
    const strays = [];
    let frames = 0;
    let samples = 0;
    let orphans = 0;
    const stop = performance.now() + 2600;
    return new Promise((resolve) => {
      const tick = () => {
        const core = CORE();
        const wr = WRAP();
        if (core.getAttribute('d')) {
          frames++;
          const c = Number(document.querySelector('.snake__run').getAttribute('data-card'));
          if (seen.at(-1) !== c) seen.push(c);
          const L = core.getTotalLength();
          for (let k = 0; k <= 16; k++) {
            const p = core.getPointAtLength((L * k) / 16);
            const x = p.x + wr.left, y = p.y + wr.top;
            samples++;
            const onCard = Math.min(...boxes.map(bx => NEAR(bx, x, y)));
            if (onCard < 2) continue;
            const inPipe = bores.length ? Math.min(...bores.map(s => toSegment(x, y, s))) : Infinity;
            if (inPipe < 2) continue;
            orphans++;
            if (strays.length < 4) {
              strays.push({ at: [Math.round(x), Math.round(y)], offCard: +onCard.toFixed(1), offPipe: +inPipe.toFixed(1) });
            }
          }
        }
        if (performance.now() < stop) requestAnimationFrame(tick);
        else resolve({ frames, samples, orphans, strays, visited: seen, bores: bores.length });
      };
      requestAnimationFrame(tick);
    });
  })()`)
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 2 })
  const walked = await journey

  expect(walked.bores, 'there were pipes to be inside').toBeGreaterThan(8)
  expect(walked.frames, 'the recorder watched real frames').toBeGreaterThan(30)
  expect(walked.samples, 'and sampled the whole rope on each').toBeGreaterThan(400)
  expect(walked.visited.length, 'it went through the cards on the way, not over them').toBeGreaterThanOrEqual(3)
  expect(walked.orphans, `${walked.orphans} of ${walked.samples} samples were neither on a card nor in a pipe: ${JSON.stringify(walked.strays)}`).toBe(0)

  const gaps = await page.evaluate(`(() => {
    const wrap = document.querySelector('.wrap');
    const cards = [...wrap.querySelectorAll('${CARDS}')].map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    const touching = (a, b) => {
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      const gx = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w);
      const gy = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h);
      return (oy >= 8 && gx >= -1 && gx <= 40) || (ox >= 8 && gy >= -1 && gy <= 40);
    };
    const seq = ${JSON.stringify(walked.visited)};
    return seq.slice(1).map((c, i) => (touching(cards[seq[i]], cards[c]) ? null : [seq[i], c])).filter(Boolean);
  })()`)
  expect(gaps, `these steps were between cards that do not touch: ${JSON.stringify(gaps)}`).toEqual([])

  // By now the light has landed and started orbiting (snake.settle), so move again and read at the arrival.
  await page.mouse.move(to.x + to.width / 2 + 1, to.y + to.height / 2 + 1)
  await snakeSettles(page, { on: to })
  const done = await head(page)
  expect(Math.hypot(done.at.x - (to.x + to.width / 2), done.at.y - to.y), 'arriving where it was sent').toBeLessThan(30)
})

test('it never gets in the way of the page', async ({ page }) => {
  pointerOnly()
  const errors = collectErrors(page)
  await arrive(page)

  const card = await page.locator('.work').first().boundingBox()
  const x = card.x + card.width / 2
  const y = card.y + card.height / 2
  await page.mouse.move(x, y, { steps: 6 })
  await page.waitForTimeout(500)

  const hit = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y)
    return el ? `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}` : null
  }, [x, y])
  expect(hit, 'the overlay must be transparent to hit-testing').not.toContain('snake')

  await page.locator('.work').first().locator('a').first().click()
  await page.waitForURL('**/projects/**')
  await curtainEndsOpen(page)
  expect(errors, 'and nothing threw on the way').toEqual([])
})

test('it writes no inline style, so there is nothing to leave behind', async ({ page }) => {
  pointerOnly()
  await arrive(page)

  for (const selector of ['.info', '.work', '.avatar', '.icon', '.contact', '.touch']) {
    const box = await page.locator(selector).first().boundingBox()
    if (!box) continue
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 })
    await page.waitForTimeout(220)
  }
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(700)

  const held = await page.evaluate(() => {
    const svg = document.querySelector('.snake')
    const inside = [...svg.querySelectorAll('[style]')].length
    return {
      style: svg.getAttribute('style'),
      inside,
      // The run fades, not the surface: the rails stay drawn.
      opacity: getComputedStyle(svg.querySelector('.snake__run')).opacity,
      rails: svg.querySelectorAll('.snake__join').length,
    }
  })
  expect(held.style, 'the surface carries no motion in its style attribute').toBe('--snake-fade:0.3s;')
  expect(held.inside, 'and the paths carry none at all').toBe(0)
  expect(Number(held.opacity), 'it went dark when nobody was looking at the page').toBeLessThan(0.05)
  expect(held.rails, 'the grid keeps its wiring with the light out').toBeGreaterThan(0)

  await noInlineMotionLeft(page)
})

/* 0 on the page's outline; corners at most ~12px from both straight runs (r 40). */
const ON_FRAME = () => {
  const core = [...document.querySelectorAll('.snake__line')].pop()
  const d = core?.getAttribute('d')
  if (!d) return 999
  const L = core.getTotalLength()
  const p = core.getPointAtLength(L)
  const wr = document.querySelector('.wrap').getBoundingClientRect()
  const f = document.querySelector('.shell__frame').getBoundingClientRect()
  const x = p.x + wr.left, y = p.y + wr.top
  return Math.min(Math.abs(x - f.x), Math.abs(x - (f.x + f.width)), Math.abs(y - f.y), Math.abs(y - (f.y + f.height)))
}

for (const exit of ['pointerleave', 'pointerout', 'blur']) {
  test(`window exit (${exit}) hands the light to the page frame, and a pointer takes it back`, async ({ page }) => {
    pointerOnly()
    await arrive(page)
    const card = await page.locator('.info').boundingBox()
    await page.mouse.move(card.x + card.width / 2, card.y + 6)
    await snakeSettles(page, { on: card })

    await page.evaluate((kind) => {
      if (kind === 'blur') window.dispatchEvent(new Event('blur'))
      else document.dispatchEvent(new PointerEvent(kind, { relatedTarget: null, bubbles: true }))
    }, exit)
    await page.waitForFunction(`(${ON_FRAME})() < 2.5`, null, { timeout: 9000 })
    await expect(page.locator('.snake')).toHaveClass(/is-live/)

    // `frame.speed` is 160px/s.
    const a = await head(page)
    await page.waitForTimeout(600)
    const b = await head(page)
    expect(b.live, 'still lit with nothing asking').toBe(true)
    expect(Math.hypot(b.at.x - a.at.x, b.at.y - a.at.y), 'and moving along the frame').toBeGreaterThan(40)

    await page.mouse.move(card.x + card.width / 2, card.y + card.height - 6)
    await snakeSettles(page, { on: card })
    expect(Math.abs((await head(page)).at.y - (card.y + card.height)), 'the pointer takes it back').toBeLessThan(3)
  })
}

// The recorder starts before the resize, so a resize it never saw cannot pass.
for (const exit of [null, 'pointerleave', 'pointerout', 'blur']) {
  test(`a resize re-lays the rope (${exit ?? 'pointer inside'})`, async ({ page }) => {
    pointerOnly()
    await arrive(page)
    const card = await page.locator('.intro__about').boundingBox()
    await page.mouse.move(card.x + card.width / 2, card.y + 6, { steps: 6 })
    await snakeSettles(page, { on: card })
    if (exit) {
      await page.evaluate((kind) => {
        if (kind === 'blur') window.dispatchEvent(new Event('blur'))
        else document.dispatchEvent(new PointerEvent(kind, { relatedTarget: null, bubbles: true }))
      }, exit)
      await page.waitForTimeout(400)
    }
    await page.evaluate(`(() => {
      window.__gaps = []; window.__stop = false; window.__on = false;
      const tick = () => {
        let worst = 0;
        for (const line of document.querySelectorAll('.snake__line')) {
          const n = (line.getAttribute('d') || '').match(/-?\\d+(?:\\.\\d+)?/g)?.map(Number) ?? [];
          for (let i = 2; i + 1 < n.length; i += 2) worst = Math.max(worst, Math.hypot(n[i] - n[i - 2], n[i + 1] - n[i - 1]));
        }
        window.__gaps.push(worst); window.__on = true;
        if (!window.__stop) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    })()`)
    await page.waitForFunction(() => window.__on === true)
    await page.setViewportSize({ width: 1300, height: 860 })
    await page.waitForTimeout(1500)
    const gaps = await page.evaluate(() => { window.__stop = true; return window.__gaps })
    expect(gaps.length, 'the recorder watched real frames').toBeGreaterThan(30)
    expect(Math.max(...gaps), 'the rope joined the old layout to the new with one straight line').toBeLessThan(8)
  })
}

test('a resize that retires the frame still lets a pointer take the light back', async ({ page }) => {
  pointerOnly()
  await arrive(page)
  const start = await page.locator('.info').boundingBox()
  await page.mouse.move(start.x + start.width / 2, start.y + 6)
  await snakeSettles(page, { on: start })
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await page.waitForFunction(`(${ON_FRAME})() < 2.5`, null, { timeout: 9000 })

  await page.setViewportSize({ width: 1000, height: 800 })
  await page.waitForTimeout(600)
  const card = await page.locator('.info').boundingBox()
  await page.mouse.move(card.x + card.width / 2, card.y + 6, { steps: 6 })
  await snakeSettles(page, { on: card, timeoutMs: 12000 })
})

test('hiding the page puts it out, and it stays out until a pointer moves', async ({ page }) => {
  pointerOnly()
  await arrive(page)
  const card = await page.locator('.info').boundingBox()
  await page.mouse.move(card.x + card.width / 2, card.y + 6)
  await snakeSettles(page, { on: card })

  const shape = () => page.locator('.snake__line').last().getAttribute('d')
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  const frozen = await shape()
  await expect(page.locator('.snake')).not.toHaveClass(/is-live/)
  await expect(page.locator('.snake__run')).toHaveCSS('opacity', '0')
  await page.waitForTimeout(400)
  expect(await shape(), 'it keeps its last shape while the CSS fades it').toBe(frozen)

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.mouse.move(card.x + card.width / 2, card.y + card.height - 6)
  await snakeSettles(page, { on: card })
  expect(Math.abs((await head(page)).at.y - (card.y + card.height))).toBeLessThan(3)
})

test('moving between elements and returning during a fade keeps the snake responsive', async ({ page }) => {
  pointerOnly()
  await arrive(page)
  const card = await page.locator('.info').boundingBox()
  await page.mouse.move(card.x + card.width / 2, card.y + 6)
  await snakeSettles(page, { on: card })
  await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerout', {
    relatedTarget: document.querySelector('.info'),
  })))
  await expect(page.locator('.snake')).toHaveClass(/is-live/)
  await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerleave')))
  await page.waitForTimeout(60)
  await page.mouse.move(card.x + card.width / 2, card.y + card.height - 6)
  await snakeSettles(page, { on: card })
  await page.waitForTimeout(400)
  await expect(page.locator('.snake')).toHaveClass(/is-live/)
})

test('the cards themselves are never touched', async ({ page }) => {
  pointerOnly()
  await arrive(page)

  // Snapshot first: SocialIcon's --brand and usePointerParallax's --mx/--my are already inline; nothing may change.
  const read = () => page.evaluate(sel =>
    [...document.querySelector('.wrap').querySelectorAll(sel)]
      .map(el => (el.getAttribute('style') ?? '').replace(/--m[xy]:[^;]*;?/g, '').trim()), CARDS)
  const before = await read()

  for (const selector of ['.info', '.work', '.avatar', '.icon', '.contact']) {
    const box = await page.locator(selector).first().boundingBox()
    if (!box) continue
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 })
    await page.waitForTimeout(260)
  }

  const after = await read()
  expect(after, 'the effect is an overlay and owns nothing of theirs').toEqual(before)
})

// The reader (touch): the light circles the card being read. Steered with scrollBy, which is faithful since nothing is scrubbed.
const readerOnly = () => test.skip(!isTouch() || isStill(), 'the reader answer, and only where motion runs')

/** px/s: the walking cap times follow.run's maximum. */
const RUN_PX_S = 560 * 3

const indexOf = (page, sel) => page.evaluate(([sel, all]) =>
  [...document.querySelector('.wrap').querySelectorAll(all)].indexOf(document.querySelector(sel)), [sel, CARDS])

/** In page coordinates, which a scroll does not move. */
const boxes = page => page.evaluate(all => [...document.querySelector('.wrap').querySelectorAll(all)].map((e) => {
  const r = e.getBoundingClientRect()
  return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height }
}), CARDS)

const near = (b, x, y) => Math.hypot(Math.max(b.x - x, 0, x - (b.x + b.w)), Math.max(b.y - y, 0, y - (b.y + b.h)))

function touches(a, b) {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  const gx = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w)
  const gy = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h)
  return (oy >= 8 && gx >= -1 && gx <= 40) || (ox >= 8 && gy >= -1 && gy <= 40)
}

function cardsIn(frames) {
  const seq = []
  for (const f of frames) if (f.card >= 0 && seq.at(-1) !== f.card) seq.push(f.card)
  return seq
}

/** A back-up (the tail taking over as head) moves the head a rope's length; a few are allowed. */
function tooFast(frames) {
  const out = []
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1]
    const b = frames[i]
    if (a.x == null || b.x == null) continue
    const d = Math.hypot(b.x - a.x, b.y - a.y)
    const dt = (b.t - a.t) / 1000
    if (d > RUN_PX_S * Math.min(dt, 0.05) * 1.25 + 2) out.push(Math.round(d))
  }
  return out
}

async function steer(page, sel, { below = false } = {}) {
  await page.waitForFunction(() => document.querySelector('.snake__run')?.hasAttribute('data-line'), null, { timeout: 9000 })
  for (let i = 0; i < 500; i++) {
    const d = await page.evaluate(([sel, below]) => {
      const line = Number(document.querySelector('.snake__run').getAttribute('data-line'))
      const w = document.querySelector('.wrap').getBoundingClientRect()
      const r = document.querySelector(sel).getBoundingClientRect()
      return (below ? r.bottom - w.top + 8 : r.top - w.top + r.height / 2) - line
    }, [sel, below])
    if (Math.abs(d) < 8) return
    await page.evaluate(dy => window.scrollBy(0, dy), Math.sign(d) * Math.min(17, Math.max(2, Math.abs(d) / 3)))
    await page.waitForTimeout(16)
  }
  throw new Error(`could not bring the reading line to ${sel}`)
}

/** The reader's counterpart to snakeSettles: its light never stops. Name the destination; a passing light circles too. */
async function snakeCircles(page, { card = null, reading = false, timeoutMs = 12000 } = {}) {
  await page.evaluate(() => { window.__circ = { x: null, y: null, frames: 0, seen: null } })
  await page.waitForFunction(
    new Function('a', `
      ${IN_PAGE}
      const { card, reading, all } = a;
      const s = window.__circ;
      const svg = document.querySelector('.snake');
      const run = document.querySelector('.snake__run');
      if (!s || !svg || !run) return false;
      const h = HEAD();
      if (!h) return false;
      const on = Number(run.getAttribute('data-card'));
      const el = [...document.querySelector('.wrap').querySelectorAll(all)][on];
      const r = el ? el.getBoundingClientRect() : null;
      const aboard = !!r && NEAR({ x: r.left, y: r.top, w: r.width, h: r.height }, h.x, h.y) < 2;
      // In page coordinates, so the page settling after a scroll is not motion.
      const y = h.y + scrollY;
      const moving = s.x !== null && Math.hypot(h.x - s.x, y - s.y) > 0.2;
      const named = card === null || (Array.isArray(card) ? card.includes(on) : on === card);
      // The card's own band holds the reading line, within the engine's hold.
      const line = Number(run.getAttribute('data-line'));
      const w = document.querySelector('.wrap').getBoundingClientRect();
      const reads = !reading || (!!r && Number.isFinite(line) && line >= r.top - w.top - 40 && line <= r.bottom - w.top + 40);
      const wanted = named && reads;
      s.frames = svg.classList.contains('is-live') && aboard && moving && wanted ? s.frames + 1 : 0;
      s.x = h.x; s.y = y;
      s.seen = { on, aboard, moving, wanted, frames: s.frames };
      return s.frames >= 12;
    `),
    { card, reading, all: CARDS },
    { timeout: timeoutMs, polling: 'raf' },
  ).catch(async () => {
    const seen = await page.evaluate(() => window.__circ?.seen ?? null)
    throw new Error(`the snake was not circling${card === null ? '' : ` card ${card}`} within ${timeoutMs}ms: ${JSON.stringify(seen)}`)
  })
}

/** Started with a handshake, not awaited: awaiting an in-page recorder runs it before what it watches happens. */
async function startRecording(page, { held = false } = {}) {
  await page.evaluate(`(() => {
    ${IN_PAGE}
    window.__rec = []; window.__recStop = false; window.__recording = false;
    const all = ${JSON.stringify(CARDS)};
    const tick = () => {
      const h = HEAD();
      const run = document.querySelector('.snake__run');
      const f = {
        t: performance.now(),
        card: run ? Number(run.getAttribute('data-card')) : -1,
        live: !!document.querySelector('.snake.is-live'),
        x: h ? h.x : null, y: h ? h.y + scrollY : null,
        open: [...document.querySelectorAll('.snake__join')]
          .filter(g => g.querySelector('.snake__lip').getAttribute('d'))
          .map(g => g.getAttribute('data-rung')),
      };
      ${held
        ? `const els = [...document.querySelector('.wrap').querySelectorAll(all)];
      f.held = els.map((el, i) => ((el.style.opacity !== '' && Number(el.style.opacity) < 0.5) || el.style.transform !== '') ? i : -1).filter(i => i >= 0);
      f.onHeld = h ? f.held.some(i => { const r = els[i].getBoundingClientRect(); return NEAR({ x: r.left, y: r.top, w: r.width, h: r.height }, h.x, h.y) < 2; }) : false;`
        : ''}
      window.__rec.push(f);
      window.__recording = true;
      if (!window.__recStop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  })()`)
  await page.waitForFunction(() => window.__recording === true)
}
const stopRecording = page => page.evaluate(() => { window.__recStop = true; return window.__rec })

test('on a phone it circles the card being read, and never stops', async ({ page }) => {
  readerOnly()
  const errors = collectErrors(page)
  await arrive(page)
  await snakeCircles(page)

  const hero = await indexOf(page, '.info')
  await startRecording(page)
  await page.waitForTimeout(3000)
  const frames = (await stopRecording(page)).filter(f => f.x != null)
  const all = await boxes(page)

  expect(cardsIn(frames), 'arriving, it reads the hero').toEqual([hero])
  let moving = 0
  let travel = 0
  for (let i = 1; i < frames.length; i++) {
    const d = Math.hypot(frames[i].x - frames[i - 1].x, frames[i].y - frames[i - 1].y)
    travel += d
    if (d > 0.2) moving++
  }
  const seconds = (frames.at(-1).t - frames[0].t) / 1000
  expect(moving / (frames.length - 1), 'it moves on every frame of a still page').toBeGreaterThan(0.95)
  // follow.orbit, with room for the brake and a frame or two of jitter.
  expect(travel / seconds, 'at a reading pace').toBeGreaterThan(110)
  expect(travel / seconds, 'at a reading pace').toBeLessThan(190)
  const off = frames.filter(f => near(all[hero], f.x, f.y) > 2)
  expect(off.length, 'on the hero\'s own border the whole time').toBe(0)
  expect(await page.locator('.snake__trace').count(), 'and it leaves no trace behind').toBe(0)
  await noInlineMotionLeft(page)
  expect(errors).toEqual([])
})

for (const route of ['/', '/ar']) {
  test(`${route}: scrolling takes it card by card, never faster than it can run`, async ({ page }) => {
    readerOnly()
    await page.goto(route)
    await curtainEndsOpen(page, 9000)
    await page.waitForTimeout(800)
    await snakeCircles(page)

    await startRecording(page)
    for (let i = 0; i < 90; i++) {
      await page.evaluate(() => window.scrollBy(0, 17))
      await page.waitForTimeout(16)
    }
    await page.waitForTimeout(3000)
    const frames = await stopRecording(page)
    const all = await boxes(page)

    const seq = cardsIn(frames)
    expect(seq.length, `it walked down the column: ${seq.join(' > ')}`).toBeGreaterThanOrEqual(5)
    const apart = []
    for (let i = 1; i < seq.length; i++) if (!touches(all[seq[i - 1]], all[seq[i]])) apart.push(`${seq[i - 1]}>${seq[i]}`)
    expect(apart, 'every step was between two cards that touch').toEqual([])

    const fast = tooFast(frames)
    expect(fast.filter(d => d > 200), 'no step longer than the rope itself').toEqual([])
    expect(fast.length, `${fast.length} steps faster than it can run: ${fast.join(', ')}`).toBeLessThanOrEqual(4)

    // Half a 16px gutter is the furthest a crossing can be from every card.
    const lost = frames.filter(f => f.x != null && Math.min(...all.map(b => near(b, f.x, f.y))) > 9)
    expect(lost.length, 'never anywhere but a border or a crossing').toBe(0)
  })
}

test('when the reader stops, no gate is left open', async ({ page }) => {
  readerOnly()
  await arrive(page)
  await snakeCircles(page)

  const work = await indexOf(page, '.work')
  await startRecording(page)
  await steer(page, '.work')
  await snakeCircles(page, { card: work })
  const journey = await stopRecording(page)
  expect(journey.some(f => f.open.length), 'a gate opened on the way there, or this proves nothing').toBe(true)

  await page.waitForFunction(
    () => [...document.querySelectorAll('.snake__join .snake__lip')].every(p => !p.getAttribute('d')),
    null,
    { timeout: 2500 },
  )
  await startRecording(page)
  await page.waitForTimeout(3000)
  const resting = await stopRecording(page)
  expect(resting.filter(f => f.open.length).length, 'and none opens while it circles').toBe(0)

  await steer(page, '.work', { below: true })
  await page.waitForTimeout(3000)
  await startRecording(page)
  await page.waitForTimeout(3000)
  const parked = await stopRecording(page)
  expect(new Set(parked.map(f => f.card)).size, 'the row being read held while the line sat in the gutter').toBe(1)
})

test('on a row of two it takes turns', async ({ page }) => {
  readerOnly()
  await arrive(page)
  await snakeCircles(page)

  const all = await boxes(page)
  const photo = await indexOf(page, '.avatar')
  const mate = all.findIndex((b, i) => i !== photo && touches(b, all[photo])
    && Math.min(b.y + b.h, all[photo].y + all[photo].h) - Math.max(b.y, all[photo].y) > 8)
  expect(mate, 'the portrait has a card beside it').toBeGreaterThanOrEqual(0)

  await steer(page, '.avatar')
  await snakeCircles(page, { card: [photo, mate] })
  await startRecording(page)
  await page.waitForTimeout(14000)
  const frames = await stopRecording(page)

  const seq = cardsIn(frames)
  expect(seq.every(c => c === photo || c === mate), `it stayed on the row: ${seq.join(' > ')}`).toBe(true)
  expect(seq.length, `it went round one and then the other, and back: ${seq.join(' > ')}`).toBeGreaterThanOrEqual(3)

  const key = `${Math.min(photo, mate)}-${Math.max(photo, mate)}`
  for (let i = 1; i < frames.length; i++) {
    if (frames[i].card === frames[i - 1].card) continue
    const around = frames.slice(Math.max(0, i - 20), i + 20)
    expect(around.some(f => f.open.includes(key)), `the hand-over at frame ${i} went through their gate`).toBe(true)
  }
  const later = frames.filter(f => f.t - frames[0].t > 2000)
  expect([...new Set(later.flatMap(f => f.open))].filter(k => k !== key), 'no other gate opened').toEqual([])

  const stays = []
  let from = 0
  for (let i = 1; i <= frames.length; i++) {
    if (i === frames.length || frames[i].card !== frames[from].card) {
      stays.push({ card: frames[from].card, s: (frames[i - 1].t - frames[from].t) / 1000 })
      from = i
    }
  }
  for (const stay of stays.slice(1, -1)) {
    const b = all[stay.card]
    const lap = 2 * (b.w + b.h) * 0.9
    expect(stay.s, `a turn on card ${stay.card} lasted ${stay.s.toFixed(1)}s`).toBeGreaterThan((0.4 * lap) / 150)
  }
})

test('on a row of tiles it moves along one tile at a time', async ({ page }) => {
  readerOnly()
  await arrive(page)
  await snakeCircles(page)

  await steer(page, '.icon')
  const all = await boxes(page)
  const first = await indexOf(page, '.icon')
  // By vertical overlap, the engine's rule: a tile the reveal is still sliding in sits 12px low.
  const f = all[first]
  const row = all.map((b, i) => (Math.min(b.y + b.h, f.y + f.h) - Math.max(b.y, f.y) > 8 ? i : -1)).filter(i => i >= 0)
  expect(row.length, 'three tiles to a row').toBeGreaterThanOrEqual(2)
  await snakeCircles(page, { card: row })

  await startRecording(page)
  await page.waitForTimeout(10000)
  const seq = cardsIn(await stopRecording(page))
  expect(seq.every(c => row.includes(c)), `it stayed on the row: ${seq.join(' > ')}`).toBe(true)
  expect(new Set(seq).size, 'and visited more than one tile').toBeGreaterThanOrEqual(2)
  for (let i = 1; i < seq.length; i++) {
    expect(touches(all[seq[i - 1]], all[seq[i]]), `${seq[i - 1]} > ${seq[i]} are neighbours`).toBe(true)
  }
})

test('after a flick it runs to catch up, walking every card on the way', async ({ page }) => {
  readerOnly()
  await arrive(page)
  await snakeCircles(page)

  const last = await page.evaluate((all) => {
    const els = [...document.querySelector('.wrap').querySelectorAll(all)]
    const ys = els.map(e => e.getBoundingClientRect().top + scrollY)
    const bottom = Math.max(...ys)
    return els.map((e, i) => (ys[i] > bottom - 20 ? i : -1)).filter(i => i >= 0)
  }, CARDS)

  await startRecording(page)
  const t0 = Date.now()
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
  // Calibrated: 4.2-4.6s in Blink and WebKit, held to the worst plus a third.
  await page.waitForFunction(
    last => last.includes(Number(document.querySelector('.snake__run').getAttribute('data-card'))),
    last,
    { timeout: 6500 },
  )
  const took = Date.now() - t0
  const frames = await stopRecording(page)
  const all = await boxes(page)

  const seq = cardsIn(frames)
  expect(seq.length, `it walked the column: ${seq.join(' > ')} in ${took}ms`).toBeGreaterThanOrEqual(6)
  for (let i = 1; i < seq.length; i++) {
    expect(touches(all[seq[i - 1]], all[seq[i]]), `${seq[i - 1]} > ${seq[i]} touch`).toBe(true)
  }
  const fast = tooFast(frames)
  expect(fast.filter(d => d > 200), 'running is still moving: no step longer than the rope').toEqual([])
})

test('it never rides a card the reveal has not released yet', async ({ page }) => {
  readerOnly()
  await arrive(page)
  await snakeCircles(page)

  await startRecording(page, { held: true })
  for (let i = 0; i < 70; i++) {
    await page.evaluate(() => window.scrollBy(0, 17))
    await page.waitForTimeout(16)
  }
  await page.waitForTimeout(1500)
  const frames = await stopRecording(page)

  expect(frames.filter(f => f.live && f.held.length).length, 'cards were held while it was lit').toBeGreaterThanOrEqual(10)
  expect(frames.filter(f => f.onHeld).length, 'it rode a card the reveal still held').toBe(0)
  expect(frames.filter(f => f.held.includes(f.card)).length, 'or believed it was on one').toBe(0)
})

test('in Arabic its first lap sets off the other way round', async ({ page }) => {
  readerOnly()
  for (const [route, sign] of [['/', 1], ['/ar', -1]]) {
    await page.goto(route)
    await curtainEndsOpen(page, 9000)
    await snakeCircles(page)
    const hero = (await boxes(page))[await indexOf(page, '.info')]
    await startRecording(page)
    await page.waitForTimeout(1500)
    const frames = (await stopRecording(page)).filter(f => f.x != null)
    // y points down, so clockwise on screen is an increasing angle.
    const cx = hero.x + hero.w / 2
    const cy = hero.y + hero.h / 2
    let sweep = 0
    for (let i = 1; i < frames.length; i++) {
      let d = Math.atan2(frames[i].y - cy, frames[i].x - cx) - Math.atan2(frames[i - 1].y - cy, frames[i - 1].x - cx)
      if (d > Math.PI) d -= 2 * Math.PI
      if (d < -Math.PI) d += 2 * Math.PI
      sweep += d
    }
    expect(Math.sign(sweep), `${route}: toward the reading end first`).toBe(sign)
  }
})

test('a narrow desktop window scrolls without anything asking it to light', async ({ page }) => {
  test.skip(!isFine() || isStill(), 'the pointer answer')
  await page.setViewportSize({ width: 1000, height: 800 })
  await arrive(page)
  await page.evaluate(() => window.scrollBy(0, 600))
  await page.waitForTimeout(1200)

  const state = await page.evaluate(() => ({
    live: document.querySelector('.snake')?.classList.contains('is-live') ?? null,
    line: document.querySelector('.snake__run')?.getAttribute('data-line') ?? null,
  }))
  expect(state.line, 'no reading line on a desk').toBeNull()
  expect(state.live, 'and nothing lit without a pointer').toBe(false)
})

test('under stillness the border lights on hover instead', async ({ page }) => {
  test.skip(!isStill() || !isFine(), 'the reduced-motion answer, on a pointer that can hover')
  await arrive(page)

  const card = page.locator('.contact')
  const before = await card.evaluate(el => getComputedStyle(el).borderTopColor)
  await card.hover()
  await page.waitForTimeout(200)
  const after = await card.evaluate(el => getComputedStyle(el).borderTopColor)
  const strong = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-border-strong').trim())

  expect(after, 'hovering lights the card edge').not.toBe(before)
  expect(strong, 'and it lights it with the token the snake would have used').not.toBe('')
})

test('the snake goes when the branch that built it does', async ({ page }) => {
  pointerOnly()
  await arrive(page)

  const card = await page.locator('.contact').boundingBox()
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2, { steps: 6 })
  await snakeSettles(page, { on: card })
  expect((await head(page)).live, 'it was alive to begin with').toBe(true)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(500)

  const after = await page.evaluate(() => {
    const svg = document.querySelector('.snake')
    return { display: getComputedStyle(svg).display, live: svg.classList.contains('is-live') }
  })
  expect(after.display, 'and it is gone').toBe('none')
  expect(after.live, 'with nothing left lit on the last card pointed at').toBe(false)
})

test('a join exists only while the light is going through it', async ({ page }) => {
  test.skip(!isFine(), 'pointer-only by design')
  await arrive(page)

  const lit = () => page.evaluate(() => [...document.querySelectorAll('.snake__join')]
    .filter(g => g.querySelector('.snake__lip').getAttribute('d'))
    .map(g => g.getAttribute('data-rung')))

  await page.waitForFunction(() => document.querySelectorAll('.snake__join').length > 0, null, { timeout: 9000 })
  expect(await lit(), 'at rest, no border is touched').toEqual([])

  const info = await page.locator('.info').boundingBox()
  await page.mouse.move(info.x + info.width / 2, info.y + 6, { steps: 6 })
  await snakeSettles(page, { on: info })
  expect(await lit(), 'still nothing while it is resting on a card').toEqual([])

  const neighbour = await page.evaluate((sel) => {
    const g = document.querySelector('.snake__join[data-rung^="0-"]')
    const j = Number(g.getAttribute('data-rung').split('-')[1])
    const cards = [...document.querySelector('.wrap').querySelectorAll(sel)]
    return cards[j] ? j : -1
  }, CARDS)
  expect(neighbour, 'the hero has at least one neighbour with a gutter').toBeGreaterThan(0)
  const target = await page.locator(CARDS).nth(neighbour).boundingBox()

  const run = page.evaluate((sel) => {
    window.__joins = true
    const wr = document.querySelector('.wrap').getBoundingClientRect()
    const cards = [...document.querySelector('.wrap').querySelectorAll(sel)].map(el => el.getBoundingClientRect())
    const frame = document.querySelector('.shell__frame')?.getBoundingClientRect()
    const onAnEdge = (x, y) => {
      const boxes = frame ? [...cards, frame] : cards
      return Math.min(...boxes.map(b => Math.min(
        Math.abs(x - b.x), Math.abs(x - (b.x + b.width)), Math.abs(y - b.y), Math.abs(y - (b.y + b.height))
      ) + (x < b.x - 2 || x > b.x + b.width + 2 || y < b.y - 2 || y > b.y + b.height + 2 ? 99 : 0)))
    }
    const frames = []
    const stop = performance.now() + 6000
    const tick = () => {
      const seen = []
      for (const g of document.querySelectorAll('.snake__join')) {
        const d = g.querySelector('.snake__lip').getAttribute('d')
        if (!d) continue
        const cover = g.querySelector('.snake__hide').getAttribute('d')
        let worst = 0
        for (const sub of d.split('M').filter(Boolean)) {
          const nums = sub.match(/-?\d+(?:\.\d+)?/g).map(Number)
          const pts = [[nums[0], nums[1]], [nums[nums.length - 2], nums[nums.length - 1]]]
          for (const [x, y] of pts) worst = Math.max(worst, onAnEdge(x + wr.left, y + wr.top))
        }
        seen.push({ rung: g.getAttribute('data-rung'), covered: !!cover, worst })
      }
      frames.push({ seen, card: document.querySelector('.snake__run').getAttribute('data-card') })
      if (performance.now() < stop && !window.__stopJoins) requestAnimationFrame(tick); else res(frames)
    }
    let res; const p = new Promise(r => { res = r })
    requestAnimationFrame(tick)
    return p
  }, CARDS)
  await page.waitForFunction(() => window.__joins === true)
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 })
  await snakeSettles(page, { on: target })
  // Settling on the neighbour leaves the tail in the crossing, so walk to its far side before asking.
  const farX = target.x + (target.x > info.x ? target.width - 8 : 8)
  await page.mouse.move(farX, target.y + target.height - 8, { steps: 6 })
  await snakeSettles(page, { on: target })
  await page.waitForTimeout(600)                       // `join.ease` and then some
  await page.evaluate(() => { window.__stopJoins = true })
  const frames = await run

  const withJoin = frames.filter(f => f.seen.length > 0)
  expect(withJoin.length, 'a join was drawn while it crossed').toBeGreaterThan(3)
  const loose = withJoin.flatMap(f => f.seen).filter(s => s.worst > 1.5 || !s.covered)
  expect(loose, `${loose.length} lips were not on a border or had no cover`).toEqual([])
  const strays = withJoin.flatMap(f => f.seen.filter(s => !s.rung.split('-').includes(String(f.card))))
  expect(strays.length, 'a join was drawn at a crossing the light was not making').toBe(0)
  expect(frames.at(-1).seen, 'nothing is left behind').toEqual([])
})

test('stillness leaves every border whole', async ({ page }) => {
  test.skip(!isStill(), 'the reduced-motion answer')
  await arrive(page)

  // The count, not computed style: under stillness the branch never builds, so there is nothing to hide.
  expect(await page.locator('.snake__join').count(), 'no joins without the thing that goes through them').toBe(0)
})

test('tablet touch trail adapts to orientation, theme, and reading direction', async ({ browser }) => {
  pointerOnly()
  const context = await browser.newContext({
    viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true,
    deviceScaleFactor: 2, colorScheme: 'light', baseURL: 'http://127.0.0.1:4173',
  })
  await context.addInitScript(() => localStorage.setItem('portfolio-color-mode', 'light'))
  const page = await context.newPage()
  const errors = collectErrors(page)
  try {
    await arrive(page)
    await expect(page.locator('html')).toHaveClass(/light/)
    await snakeCircles(page, { reading: true })
    // follow.body: 22% of 820 is past the 120px ceiling.
    const lit = (await head(page)).litPx
    expect(lit).toBeGreaterThan(115)
    expect(lit).toBeLessThan(123)
    // The coarse-pointer rule's core width.
    await expect(page.locator('.snake__line').last()).toHaveCSS('stroke-width', '1.8px')
    await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }))
    await snakeCircles(page, { reading: true })
    await page.screenshot({ path: test.info().outputPath('tablet-portrait.png') })
    await page.setViewportSize({ width: 1180, height: 820 })
    await snakeCircles(page, { reading: true })
    const h = await head(page)
    expect(h.at.y).toBeGreaterThan(-20)
    expect(h.at.y).toBeLessThan(840)
    expect(await page.locator('.snake__join').count()).toBeGreaterThan(0)
    const diagonal = await page.locator('.snake__join').evaluateAll(joins => joins.filter((g) => {
      const n = k => Number.parseFloat(g.getAttribute(k))
      return Math.abs(n('data-ax') - n('data-bx')) > 0.01 && Math.abs(n('data-ay') - n('data-by')) > 0.01
    }).length)
    expect(diagonal, 'crossings meet straight card edges squarely').toBe(0)
    await page.screenshot({ path: test.info().outputPath('tablet-landscape.png') })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    // Large iPads can show the pinned bento with nothing to read: a quiet orbit, then reading again in portrait.
    await page.setViewportSize({ width: 1366, height: 1024 })
    await page.waitForTimeout(600)
    const start = await head(page)
    await page.waitForTimeout(700)
    const orbit = await head(page)
    expect(orbit.live).toBe(true)
    expect(Math.hypot(orbit.at.x - start.at.x, orbit.at.y - start.at.y)).toBeGreaterThan(10)
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.waitForTimeout(60)
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.waitForTimeout(500)
    await expect(page.locator('.snake')).toHaveClass(/is-live/)
    await page.setViewportSize({ width: 820, height: 1180 })
    await snakeCircles(page, { reading: true })
    await page.goto('/ar')
    await curtainEndsOpen(page, 9000)
    await snakeCircles(page, { reading: true })
    await page.evaluate(() => window.scrollTo({ top: 700, behavior: 'instant' }))
    await snakeCircles(page, { reading: true })
    expect((await head(page)).live).toBe(true)
    expect(errors).toEqual([])
  }
  finally {
    await context.close()
  }
})
