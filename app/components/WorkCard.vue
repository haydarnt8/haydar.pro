<script setup lang="ts">
import type { Project } from '~/types/portfolio'
import { media as MQ, parallax as P, screen as SCR } from '~/config/motion'
import { isPlaceholderImage } from '~/types/portfolio'

// The resting state is the full card; the hover shrink exists only under (hover: hover) and no
// reduced motion. The title is scaled, not resized, so it never relayouts or rewraps.
const props = defineProps<{
  project: Project
  headingLevel?: 2 | 3 | 4
}>()

const root = ref<HTMLElement | null>(null)

// The wrapper drifts, never the image: the stylesheet owns the image's transform for the hover.
const media = ref<HTMLElement | null>(null)
const { enter, move, leave } = usePointerParallax({
  zone: root,
  layer: media,
  drift: P.media,
  spotlight: true,
})
const localePath = useLocalePath()

// Live screen: on hover the cover's device plays the project's other screens. Rendered on first
// hover only; geometry is CSS custom properties, never an inline transform.
const screen = computed(() =>
  props.project.image && !isPlaceholderImage(props.project.image) ? props.project.screen : undefined)
const GLASS = 720
const picture = ref<HTMLElement | null>(null)
const glass = ref<HTMLElement | null>(null)
/** The layer exists: set on the first hover and never unset, so the pages stay loaded. */
const live = ref(false)
/** Where the cover's own box sits in the picture's: `object-fit: cover`, done by hand. */
const fit = reactive({ x: 0, y: 0, k: 1, ox: 50, oy: 50 })

const pictureStyle = computed(() => {
  const s = screen.value
  if (!s) return undefined
  return {
    '--cover-w': `${s.size[0]}px`,
    '--cover-h': `${s.size[1]}px`,
    '--fit-x': `${fit.x}px`,
    '--fit-y': `${fit.y}px`,
    '--fit-k': fit.k,
    '--push-origin': `${fit.ox}px ${fit.oy}px`,
    '--screen-mask': `url('${s.mask}')`,
    '--screen-wipe': `${SCR.wipe}s`,
    '--screen-close': `${SCR.close}s`,
  }
})

const glassStyle = computed(() => {
  const s = screen.value
  if (!s) return undefined
  const h = Math.round(GLASS / s.aspect)
  return { 'width': `${GLASS}px`, 'height': `${h}px`, '--quad': quadMatrix(GLASS, h, s.corners) }
})

function measure() {
  const s = screen.value
  const el = picture.value
  if (!s || !el) return
  const w = el.clientWidth
  const h = el.clientHeight
  const k = Math.max(w / s.size[0], h / s.size[1])
  fit.k = k
  fit.x = (w - s.size[0] * k) / 2
  fit.y = (h - s.size[1] * k) / 2
  const cx = s.corners.reduce((sum, [x]) => sum + x, 0) / 4
  const cy = s.corners.reduce((sum, [, y]) => sum + y, 0) / 4
  fit.ox = fit.x + cx * k
  fit.oy = fit.y + cy * k
}

type Gsap = NonNullable<ReturnType<typeof gsapModules>>['gsap']
let playing: ReturnType<Gsap['timeline']> | null = null
let closing: ReturnType<Gsap['delayedCall']> | null = null
let shown: HTMLElement | null = null
/** Asked for, and still wanted: every await below checks it again. */
let wanted = false

// Page state is a class, never an inline style (tests read inline styles as leftover motion).
// A fresh timeline per page: a repeating one rewinds its earlier steps when it wraps.
function turn(gsap: Gsap, pages: HTMLElement[], i: number, lead = 0) {
  const page = pages[i % pages.length]!
  const tl = gsap.timeline({
    delay: lead,
    onComplete: () => { if (wanted && playing === tl) turn(gsap, pages, i + 1) },
  })
  if (page !== shown) {
    tl.call(() => page.classList.add('is-arriving'))
      .call(() => {
        page.classList.add('is-up')
        page.classList.remove('is-arriving')
        shown?.classList.remove('is-up')
        shown = page
      }, undefined, SCR.wipe)
  }
  tl.to({}, { duration: SCR.hold })
  playing = tl
}

async function turnOn() {
  if (!screen.value || prefersStillness()) return
  wanted = true
  live.value = true
  await nextTick()
  const m = await loadGsap()
  const pane = glass.value
  if (!m || !pane || !wanted) return
  const { gsap } = m

  if (closing) {
    closing.kill()
    closing = null
    pane.classList.remove('is-closing')
  }
  if (playing) return

  const pages = Array.from(pane.querySelectorAll<HTMLImageElement>('.work__page'))
  // Decode first: a blank page rendering in is a glitch.
  await pages[0]?.decode().catch(() => {})
  if (!wanted || playing || !pages.length) return

  const next = shown ? pages.indexOf(shown as HTMLImageElement) + 1 : 0
  turn(gsap, pages, next, shown ? 0 : SCR.lead)
  root.value?.setAttribute('data-screen', 'on')
}

async function turnOff() {
  wanted = false
  const pane = glass.value
  if (!pane || (!playing && !shown)) return
  const m = await loadGsap()
  if (!m || wanted) return
  const { gsap } = m
  playing?.kill()
  playing = null
  const pages = Array.from(pane.querySelectorAll<HTMLElement>('.work__page'))
  const rest = () => {
    closing = null
    shown = null
    for (const page of pages) page.classList.remove('is-up', 'is-arriving')
    pane.classList.remove('is-closing')
    root.value?.removeAttribute('data-screen')
  }
  if (!shown && !pages.some(page => page.classList.contains('is-arriving'))) return rest()
  pane.classList.add('is-closing')
  closing = gsap.delayedCall(SCR.close, rest)
}

const fine = () => window.matchMedia(MQ.fine).matches

function onEnter(event: PointerEvent) {
  enter()
  if (event.pointerType !== 'touch' && fine()) void turnOn()
}

function onLeave(event: PointerEvent) {
  leave()
  if (event.pointerType !== 'touch' && fine()) void turnOff()
}

function onFocusIn(event: FocusEvent) {
  if ((event.target as HTMLElement | null)?.matches?.(':focus-visible')) void turnOn()
}

function onFocusOut(event: FocusEvent) {
  if (!root.value?.contains(event.relatedTarget as Node | null) && !root.value?.matches(':hover')) void turnOff()
}

let resized: ResizeObserver | null = null
let band: IntersectionObserver | null = null

onMounted(() => {
  if (!screen.value || !picture.value) return
  resized = new ResizeObserver(measure)
  resized.observe(picture.value)
  // A phone's hover is the middle of its screen.
  if (!fine()) {
    band = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void turnOn()
      else void turnOff()
    }, { rootMargin: SCR.band })
    band.observe(picture.value)
  }
})

onBeforeUnmount(() => {
  wanted = false
  resized?.disconnect()
  band?.disconnect()
  playing?.kill()
  closing?.kill()
})
</script>

<template>
  <article
    ref="root"
    class="work"
    :class="{ 'work--stub': !project.image || isPlaceholderImage(project.image) }"
    @pointerenter="onEnter"
    @pointermove="move"
    @pointerleave="onLeave"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
  >
    <!-- data-cursor on the link, not the card: the cursor reads the nearest annotated ancestor. -->
    <NuxtLink
      :to="localePath(`/projects/${project.slug}`)"
      class="work__link"
      data-cursor="view"
    >
      <span ref="media" class="work__media" aria-hidden="true">
        <span ref="picture" class="work__picture" :style="pictureStyle">
          <img
            v-if="project.image"
            :src="project.image"
            :alt="isPlaceholderImage(project.image) ? '' : $t('a11y.screenshot', { title: project.title })"
            :aria-hidden="isPlaceholderImage(project.image) ? 'true' : undefined"
            class="work__img"
            :class="{ 'work__img--placeholder': isPlaceholderImage(project.image) }"
          >
          <span v-else class="work__empty">
            <span class="work__empty-label">{{ $t('todo.tag') }}&nbsp;&middot;&nbsp;{{ $t('todo.noScreenshot') }}</span>
          </span>

          <span v-if="screen && live" class="work__screen">
            <span ref="glass" class="work__glass" :style="glassStyle">
              <img
                v-for="page in screen.shots"
                :key="page"
                :src="page"
                alt=""
                decoding="async"
                class="work__page"
              >
            </span>
          </span>
        </span>
      </span>

      <span class="work__glow" aria-hidden="true"></span>

      <span class="work__scrim" aria-hidden="true"></span>

      <div class="work__overlay">
        <span class="work__rule" aria-hidden="true"></span>

        <div v-if="project.company" class="work__meta">
          <div>
            <p dir="auto" class="u-label work__company">{{ project.company }}</p>
          </div>
        </div>

        <component :is="`h${headingLevel ?? 2}`" class="text-h4 work__title">
          {{ project.title }}
        </component>
      </div>

      <span class="work__arrow" aria-hidden="true">
        <Icon name="ph:arrow-up-right-bold" class="u-rtl-mirror" />
      </span>
    </NuxtLink>
  </article>
</template>

<style scoped>
.work {
  position: relative;
  overflow: hidden;
  min-height: 0;
  border-radius: var(--radius-card-sm);
  background-color: var(--color-surface-raised);
  /* Every child is absolute: without a ratio the card collapses. 350x244 is the design's card at 390px. */
  aspect-ratio: 350 / 244;
}

/* At M every card is 340px tall: a ratio would turn the full-width card into a square. */
@media (width >= 810px) and (width < 1200px) {
  .work {
    aspect-ratio: auto;
    height: 340px;
  }
}

/* The hairline lies over the picture (not a border), so it covers the light row a fractional edge leaves. */
.work::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid var(--color-border);
  border-radius: inherit;
  pointer-events: none;
}

.work__link {
  position: absolute;
  inset: 0;
  display: block;
  border-radius: inherit;
}

/* The card clips its link, so the card draws the ring (its own outline escapes its overflow). */
.work:has(> .work__link:focus-visible) {
  outline: 2px solid var(--color-ink-strong);
  outline-offset: 2px;
}

.work__link:focus-visible { outline: none; }

/* main.css's hover darkens a border; this card's edge is ::after. Colour only: a test reads the width. */
@media (prefers-reduced-motion: reduce) and (hover: hover) and (pointer: fine) {
  .work:hover::after { border-color: var(--color-border-strong); }
}

/* Overscanned so the drift never exposes the card's surface at an edge. */
.work__media {
  position: absolute;
  inset: calc(-1 * var(--parallax-overscan, 8px));
  display: block;
}

.work__picture {
  position: absolute;
  inset: 0;
  display: block;
  transform-origin: var(--push-origin, 50% 50%);
}

.work__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.work__screen {
  position: absolute;
  top: 0;
  left: 0;
  width: var(--cover-w);
  height: var(--cover-h);
  transform-origin: 0 0;
  transform: translate(var(--fit-x), var(--fit-y)) scale(var(--fit-k));
  -webkit-mask-image: var(--screen-mask);
  mask-image: var(--screen-mask);
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  pointer-events: none;
}

.work__glass {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  transform: var(--quad);
}

.work__page {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
  clip-path: inset(0% 0% 100% 0%);
}

.work__page.is-up {
  z-index: 1;
  clip-path: none;
}

/* power2.inOut and power2.in, as cubic-béziers: the stylesheet runs the wipes. */
.work__page.is-arriving {
  z-index: 2;
  animation: page-arrives var(--screen-wipe, 0.6s) cubic-bezier(0.45, 0, 0.55, 1) both;
}

.work__glass.is-closing {
  animation: page-leaves var(--screen-close, 0.4s) cubic-bezier(0.55, 0, 1, 0.45) both;
}

@keyframes page-arrives {
  from { clip-path: inset(0% 0% 100% 0%); }
  to { clip-path: inset(0% 0% 0% 0%); }
}

@keyframes page-leaves {
  from { clip-path: inset(0% 0% 0% 0%); }
  to { clip-path: inset(0% 0% 100% 0%); }
}

/* Bottom-heavy padding on purpose: centred, the logo sat behind the caption. */
.work__img--placeholder {
  object-fit: contain;
  padding: 14% 18% 32%;
  background-color: var(--color-surface-sunken);
  opacity: 0.7;
}

.work__empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background-color: var(--color-surface-sunken);
}

.work__empty-label {
  font-size: var(--text-label);
  letter-spacing: var(--text-label--letter-spacing);
  text-transform: uppercase;
  color: var(--color-ink-muted);
}

.work__glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(
    circle 15rem at var(--mx, 50%) var(--my, 50%),
    rgb(255 255 255 / 0.2),
    rgb(255 255 255 / 0) 64%
  );
}

.work__scrim {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  height: 70%;
  pointer-events: none;
  transform-origin: bottom;
  background: linear-gradient(
    to top,
    rgb(0 0 0 / 0.88) 0%,
    rgb(0 0 0 / 0.6) 40%,
    rgb(0 0 0 / 0) 100%
  );
}

.work__overlay {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 1.5rem;
}

.work__rule {
  width: 2.25rem;
  height: 1px;
  margin-bottom: 0.75rem;
  background: rgb(255 255 255 / 0.5);
  transform-origin: left center;
}

/* 0fr -> 1fr animates to an intrinsic height. No overflow clip: it would cut the company's halo;
   the fold is a clip-path in the reveal below. */
.work__meta {
  display: grid;
  grid-template-rows: 1fr;
}

.work__meta > * {
  min-height: 0;
}

/* Fixed light values, not tokens: they sit on a dark scrim in both themes. */
.work__company {
  padding-bottom: 0.35rem;
  color: rgb(255 255 255 / 0.7);
}

.work__title {
  max-width: 100%;
  color: #fff;
  text-wrap: balance;
  transform-origin: left bottom;
}

/* The halo keeps the caption at 4.5:1 over bright covers without dimming the picture. */
.work__title,
.work__company {
  text-shadow:
    0 0 1px rgb(0 0 0 / 0.8),
    0 1px 2px rgb(0 0 0 / 0.7),
    0 0 8px rgb(0 0 0 / 0.7),
    0 0 18px rgb(0 0 0 / 0.5);
}

.work__arrow {
  position: absolute;
  top: 1.25rem;
  inset-inline-end: 1.25rem;
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  font-size: 1.125rem;
  border-radius: 50%;
  /* Dark glass: no scrim behind it, so it must hold up over bright and dark covers. */
  border: 1px solid rgb(255 255 255 / 0.3);
  background: rgb(10 10 10 / 0.34);
  backdrop-filter: blur(10px);
  color: #fff;
}

/* Stand-in (placeholder or no image): the caption sits on the card, not a picture, so it uses theme tokens. */
.work--stub .work__scrim {
  background: linear-gradient(
    to top,
    var(--color-surface-raised) 0%,
    color-mix(in srgb, var(--color-surface-raised) 82%, transparent) 46%,
    transparent 100%
  );
}

.work--stub .work__glow {
  background: radial-gradient(
    circle 15rem at var(--mx, 50%) var(--my, 50%),
    var(--glow-tint),
    transparent 64%
  );
}

.work--stub .work__rule { background: var(--color-border-strong); }
.work--stub .work__title { color: var(--color-ink-strong); }
.work--stub .work__company { color: var(--color-ink-faint); }
.work--stub .work__title,
.work--stub .work__company { text-shadow: none; }

.work--stub .work__arrow {
  background: var(--color-surface-sunken);
  backdrop-filter: none;
  color: var(--color-ink-strong);
}

/* The reveal: gated on real hover and no reduced motion, so nobody gets a shrunken card they can't restore. */
@media (hover: hover) and (prefers-reduced-motion: no-preference) {
  .work__picture {
    transition: transform var(--duration-slow) var(--ease-out-soft);
  }

  .work__img {
    transition:
      filter var(--duration-slow) var(--ease-out-soft),
      opacity var(--duration-slow) var(--ease-out-soft);
  }

  /* Must stay after the rule above — same specificity, later wins. */
  .work__img--placeholder { opacity: 0.38; }

  .work__glow {
    transition: opacity var(--duration-base) var(--ease-out-soft);
  }

  .work__scrim {
    transform: scaleY(0.5);
    opacity: 0.82;
    transition:
      transform var(--duration-slow) var(--ease-out-soft),
      opacity var(--duration-slow) var(--ease-out-soft);
  }

  .work__rule {
    transform: scaleX(0);
    transition: transform var(--duration-base) var(--ease-out-soft);
  }

  .work__meta {
    grid-template-rows: 0fr;
    opacity: 0;
    transition:
      grid-template-rows var(--duration-base) var(--ease-out-soft),
      opacity var(--duration-fast) linear;
  }

  /* The fold: closed, a clip with no height; open, 1.5rem outside the label so its halo is whole. */
  .work__meta > * {
    clip-path: inset(0 -1.5rem 100% -1.5rem);
    transition: clip-path var(--duration-base) var(--ease-out-soft);
  }

  .work { --rest-scale: 0.68; } /* 22px -> 15px */

  @media (width >= 810px) and (width < 1200px) {
    .work { --rest-scale: 0.75; } /* 20px -> 15px */
  }

  @media (width < 810px) {
    .work { --rest-scale: 0.83; } /* 18px -> 15px */
  }

  .work__title {
    transform: scale(var(--rest-scale));
    opacity: 0.9;
    transition:
      transform var(--duration-slow) var(--ease-out-soft),
      opacity var(--duration-base) var(--ease-out-soft);
  }

  .work__arrow {
    opacity: 0;
    /* Parked OUTWARD toward its own corner, which is the other corner in RTL. */
    transform: translate(calc(0.75rem * var(--rtl-x, 1)), -0.75rem) scale(0.8);
    transition:
      opacity var(--duration-base) var(--ease-out-soft),
      transform var(--duration-base) var(--ease-out-soft);
  }

  /* Delays on the way in only (a staggered exit reads as lag). :focus-within mirrors hover for the keyboard. */
  .work:hover .work__picture,
  .work:focus-within .work__picture {
    transform: scale(1.06);
  }

  .work:hover .work__img,
  .work:focus-within .work__img {
    opacity: 1;
    filter: none;
  }

  .work:hover .work__img--placeholder,
  .work:focus-within .work__img--placeholder { opacity: 0.72; }

  .work:hover .work__glow,
  .work:focus-within .work__glow { opacity: 1; }

  .work:hover .work__scrim,
  .work:focus-within .work__scrim {
    transform: none;
    opacity: 1;
  }

  .work:hover .work__rule,
  .work:focus-within .work__rule {
    transform: none;
    transition-delay: 60ms;
  }

  .work:hover .work__meta,
  .work:focus-within .work__meta {
    grid-template-rows: 1fr;
    opacity: 1;
    transition-delay: 80ms;
  }

  .work:hover .work__meta > *,
  .work:focus-within .work__meta > * {
    clip-path: inset(-1.5rem);
    transition-delay: 80ms;
  }

  .work:hover .work__title,
  .work:focus-within .work__title {
    transform: none;
    opacity: 1;
  }

  .work:hover .work__arrow,
  .work:focus-within .work__arrow {
    opacity: 1;
    transform: none;
    transition-delay: 120ms;
  }
}

/* transform-origin has no logical keyword, so RTL needs explicit origins. */
[dir='rtl'] .work__rule { transform-origin: right center; }
[dir='rtl'] .work__title { transform-origin: right bottom; }
[dir='rtl'] .work { --rtl-x: -1; }

@media (width >= 810px) {
  .work { border-radius: var(--radius-card); }
  .work__overlay { padding: 2rem; }

  .work__arrow {
    top: 1.75rem;
    inset-inline-end: 1.75rem;
  }
}

/* In the pinned bento the grid row sets the height, and aspect-ratio would overshoot it. */
@media (width >= 1200px) and (height >= 640px) {
  .work { aspect-ratio: auto; }
}

/* On touch the picture lags the card on scroll, via `translate` so it never fights the pointer's transform. */
@media (hover: none) and (prefers-reduced-motion: no-preference) {
  .work { --parallax-overscan: 16px; }

  /* A named timeline, not view(): the card's overflow makes it the scroller an anonymous one would track. */
  @supports (animation-timeline: view()) {
    .work { view-timeline-name: --work-view; }

    .work__media {
      animation: work-depth linear both;
      animation-timeline: --work-view;
    }
  }
}

@keyframes work-depth {
  from { translate: 0 -12px; }
  to { translate: 0 12px; }
}
</style>
