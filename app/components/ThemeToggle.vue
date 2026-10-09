<script setup lang="ts">
import type { GsapModules } from '~/composables/useGsap'
import { toggle as M } from '~/config/motion'

// GSAP owns only the transition: the resting state is CSS keyed on `aria-checked`, and GSAP clears what it wrote.
const colorMode = useColorMode()
const isLight = computed(() => colorMode.value === 'light')

const pill = ref<HTMLElement | null>(null)
const knob = ref<HTMLElement | null>(null)
const glyph = ref<SVGSVGElement | null>(null)
const disc = ref<SVGPathElement | null>(null)
const rays = ref<SVGLineElement[]>([])

// Phosphor FILL shapes: single closed paths, which is what keeps the morph clean.
const MOON = 'M235.54,150.21a104.84,104.84,0,0,1-37,52.91A104,104,0,0,1,32,120,103.09,103.09,0,0,1,52.88,57.48a104.84,104.84,0,0,1,52.91-37,8,8,0,0,1,10,10,88.08,88.08,0,0,0,109.8,109.8,8,8,0,0,1,10,10Z'
const SUN = 'M128,64a64,64,0,1,0,64,64A64.07,64.07,0,0,0,128,64Z'
const RAYS = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4
  const at = (r: number) => ({ x: +(128 + r * Math.sin(a)).toFixed(2), y: +(128 - r * Math.cos(a)).toFixed(2) })
  return { from: at(88), to: at(96) }
})

const initialDisc = isLight.value ? SUN : MOON

let busy = false
let animating = false

// The knob follows the press, not `isLight`: the flood holds the theme change back, so `isLight` flips late.
const pressed = ref(false)
watch(isLight, (value) => {
  pressed.value = value
  if (!animating) disc.value?.setAttribute('d', value ? SUN : MOON)
}, { immediate: true })

type Gsap = GsapModules['gsap']
let gsapReady: Promise<Gsap | null> | null = null

function ensureGsap() {
  if (gsapReady) return gsapReady
  gsapReady = (async () => {
    const m = await loadGsap()
    if (!m) return null
    return await loadPlugin('MorphSVGPlugin') ? m.gsap : null
  })()
  return gsapReady
}

const stillness = prefersStillness

async function throwKnob(toLight: boolean) {
  const gsap = await ensureGsap()
  const k = knob.value
  const g = glyph.value
  const d = disc.value
  const lines = rays.value
  if (!gsap || !k || !g || !d || !lines.length) {
    unpin()
    d?.setAttribute('d', toLight ? SUN : MOON)
    return
  }

  // Measured: the pill differs at S. `clientWidth` is inside the 2px rim, hence the 2.
  const inset = Number.parseFloat(getComputedStyle(k).getPropertyValue('--pill-inset')) || 0
  const travel = pill.value!.clientWidth - 2 * (inset - 2) - k.clientWidth
  animating = true
  pill.value?.classList.add('is-scripted')

  await new Promise<void>((resolve) => {
    const tl = gsap.timeline({
      defaults: { ease: 'toggle-throw', duration: M.throw },
      onComplete: resolve,
    })
    registerTimeline('toggle', tl)
    if (toLight) {
      tl.to(k, { '--knob-x': `${travel}px` }, 0)
        .to(d, { morphSVG: { shape: SUN, type: 'rotational', origin: '50% 50%' } }, 0)
        .to(g, { '--glyph-turn': '90deg' }, 0)
        .fromTo(lines,
          { '--ray-scale': 0, '--ray-alpha': 0 },
          { '--ray-scale': 1, '--ray-alpha': 1, duration: M.rays.duration, stagger: M.rays.stagger, ease: 'back.out(1.7)' },
          M.rays.delay,
        )
    }
    else {
      tl.to(lines, { '--ray-scale': 0, '--ray-alpha': 0, duration: M.retract.duration, stagger: { each: M.retract.stagger, from: 'end' }, ease: 'power2.in' }, 0)
        .to(d, { morphSVG: { shape: MOON, type: 'rotational', origin: '50% 50%' } }, M.retract.lead)
        .to(g, { '--glyph-turn': '0deg' }, M.retract.lead)
        .to(k, { '--knob-x': '0px' }, M.retract.lead)
    }
  })

  gsap.set([k, g, ...lines], { clearProps: '--knob-x,--glyph-turn,--ray-scale,--ray-alpha' })
  d.setAttribute('d', toLight ? SUN : MOON)
  animating = false
}

const animated = () => {
  const list: Array<[Element, string[]]> = []
  if (knob.value) list.push([knob.value, ['--knob-x']])
  if (glyph.value) list.push([glyph.value, ['--glyph-turn']])
  for (const r of rays.value) list.push([r, ['--ray-scale', '--ray-alpha']])
  return list
}

// Pin current values inline before `aria-checked` flips, or the rule jumps the knob and GSAP tweens end to end.
function pin() {
  for (const [el, props] of animated()) {
    const cs = getComputedStyle(el)
    for (const prop of props) (el as HTMLElement).style.setProperty(prop, cs.getPropertyValue(prop).trim())
  }
}

function unpin() {
  for (const [el, props] of animated()) for (const prop of props) (el as HTMLElement).style.removeProperty(prop)
}

function toggle() {
  if (busy) return

  const next = pressed.value ? 'dark' : 'light'
  const toLight = next === 'light'
  const el = pill.value
  const still = stillness()

  busy = true

  let motion: Promise<void> = Promise.resolve()
  if (still) {
    disc.value?.setAttribute('d', toLight ? SUN : MOON)
  }
  else {
    pin()
    motion = throwKnob(toLight)
  }
  pressed.value = toLight

  // `startViewTransition` is typed non-optional, so this is a plain runtime check.
  const reveal = (still || !el || !document.startViewTransition)
    ? Promise.resolve().then(() => { colorMode.preference = next })
    : flood(el, next)
      // A bare `.finally` would re-throw and leave the theme unchanged.
      .catch(() => { colorMode.preference = next })

  void Promise.all([motion, reveal]).finally(() => { busy = false })
}

function toMs(value: string, fallback: number) {
  const n = Number.parseFloat(value)
  if (!Number.isFinite(n)) return fallback
  return value.trim().endsWith('ms') ? n : n * 1000
}

// color-mode sets the class through two chained watchers; check, or the transition snapshots the old theme.
async function applied(theme: string) {
  for (let i = 0; i < 4; i++) {
    await nextTick()
    if (document.documentElement.classList.contains(theme)) return
  }
}

async function flood(el: HTMLElement, next: string) {
  const html = document.documentElement

  // Read BEFORE the transition: getComputedStyle in the update callback forces a flush while rendering is suspended.
  const motion = getComputedStyle(html)
  const hold = toMs(motion.getPropertyValue('--vt-hold'), 200)
  const duration = toMs(motion.getPropertyValue('--vt-reveal-dur'), 620)
  const easing = motion.getPropertyValue('--vt-reveal-ease').trim()
    || 'cubic-bezier(0.33, 1, 0.68, 1)'

  await new Promise(resolve => setTimeout(resolve, hold))

  // Navigated away during the hold: a detached node measures all zeroes.
  if (!el.isConnected) {
    colorMode.preference = next
    return
  }

  // Measured AFTER the hold: the page may have scrolled.
  const box = el.getBoundingClientRect()
  const x = box.left + box.width / 2
  const y = box.top + box.height / 2
  const reach = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  )

  // Scopes main.css's document-level ::view-transition rules to this transition only.
  html.classList.add('vt-theme')

  try {
    const view = document.startViewTransition(async () => {
      colorMode.preference = next
      await applied(next)
    })

    await view.ready
    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${reach}px at ${x}px ${y}px)`,
        ],
      },
      { duration, easing, pseudoElement: '::view-transition-new(root)' },
    )
    await view.finished
  }
  catch {
    // `ready` rejects when the browser skips the transition; uncaught, it would strand `busy`.
  }
  finally {
    html.classList.remove('vt-theme')
  }
}
</script>

<template>
  <BaseCard as="div" class="toggle">
    <ClientOnly>
      <!-- The state lives in `aria-checked`, which assistive tech reads; the CSS follows it. -->
      <button
        ref="pill"
        type="button"
        class="pill"
        role="switch"
        :aria-checked="pressed"
        @click="toggle"
        @pointerenter="ensureGsap"
        @focus="ensureGsap"
      >
        <span class="sr-only">{{ $t('a11y.lightMode') }}</span>

        <span ref="knob" class="pill__knob" aria-hidden="true">
          <svg ref="glyph" class="pill__glyph" viewBox="0 0 256 256" focusable="false">
            <path ref="disc" class="pill__disc" :d="initialDisc" />
            <line
              v-for="(ray, i) in RAYS"
              :key="i"
              ref="rays"
              class="pill__ray"
              :x1="ray.from.x"
              :y1="ray.from.y"
              :x2="ray.to.x"
              :y2="ray.to.y"
            />
          </svg>
        </span>
      </button>

      <template #fallback>
        <!-- Same box, invisible, so nothing shifts on hydration. -->
        <span class="pill pill--placeholder" aria-hidden="true" />
      </template>
    </ClientOnly>
  </BaseCard>
</template>

<style scoped>
/* Registered so the no-GSAP fallback can transition them. */
@property --knob-x {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

@property --glyph-turn {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

.toggle {
  display: grid;
  place-items: center;
  height: 100%;
  padding: 1rem;
}

.pill {
  --pill-w: 80px;
  --pill-h: 48px;
  --knob: 36px;
  --glyph: 20px;
  /* Knob inset from the pill's OUTER edge; the track has a 2px rim. */
  --pill-inset: 6px;
  --travel: calc(var(--pill-w) - 2 * var(--pill-inset) - var(--knob));

  position: relative;
  display: block;
  box-sizing: border-box;
  width: var(--pill-w);
  height: var(--pill-h);
  padding: 0;
  border: 2px solid var(--color-border-strong);
  border-radius: 999px;
  background-color: var(--color-border-subtle);
  cursor: pointer;
  transition:
    background-color var(--duration-base) var(--ease-out-soft),
    border-color var(--duration-base) var(--ease-out-soft);
}

@media (width >= 810px) {
  .pill {
    --pill-w: 90px;
    --pill-h: 54px;
    --knob: 42px;
    --glyph: 24px;
  }
}

.pill:hover {
  background-color: var(--color-surface-hover);
  border-color: var(--color-ink-faint);
}

.pill:focus-visible {
  outline: 2px solid var(--color-ink-strong);
  outline-offset: 4px;
}

.pill--placeholder { visibility: hidden; }

.pill__knob {
  --knob-x: 0px;
  --knob-dir: 1;

  position: absolute;
  top: calc(var(--pill-inset) - 2px);
  inset-inline-start: calc(var(--pill-inset) - 2px);
  display: grid;
  place-items: center;
  width: var(--knob);
  height: var(--knob);
  border-radius: 50%;
  background-color: var(--color-knob);
  color: var(--color-lamp);
  translate: calc(var(--knob-x) * var(--knob-dir)) 0;
}

/* RTL: "on" travels away from the reading start. */
[dir='rtl'] .pill__knob { --knob-dir: -1; }

.pill[aria-checked='true'] .pill__knob { --knob-x: var(--travel); }

/* Off while scripted: a transition would fight every frame GSAP writes. */
.pill:not(.is-scripted) .pill__knob {
  transition: --knob-x var(--duration-base) var(--ease-out-soft);
}

.pill__glyph {
  --glyph-turn: 0deg;
  width: var(--glyph);
  height: var(--glyph);
  overflow: visible;
  rotate: var(--glyph-turn);
  fill: currentColor;
  stroke: currentColor;
}

.pill[aria-checked='true'] .pill__glyph { --glyph-turn: 90deg; }

.pill__disc {
  stroke: none;
}

.pill__ray {
  --ray-scale: 0;
  --ray-alpha: 0;
  stroke-width: 16;
  stroke-linecap: round;
  transform-box: view-box;
  transform-origin: 128px 128px;
  scale: var(--ray-scale);
  opacity: var(--ray-alpha);
}

.pill[aria-checked='true'] .pill__ray {
  --ray-scale: 1;
  --ray-alpha: 1;
}

@media (prefers-reduced-motion: reduce) {
  .pill,
  .pill__knob { transition: none; }
}
</style>
