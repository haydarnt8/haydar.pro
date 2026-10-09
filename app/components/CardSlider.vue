<script setup lang="ts" generic="T">
import type { GsapModules } from '~/composables/useGsap'
import { slider as S } from '~/config/motion'

// At rest the track is CSS (`--slider-index` + a transition); once GSAP loads it takes the
// track over seamlessly. Every path (dot, arrow, key, swipe) goes through `go()`.
const props = withDefaults(defineProps<{
  items: T[]
  label: string
  showArrows?: boolean
}>(), { showArrows: false })

const root = ref<HTMLElement | null>(null)
const viewport = ref<HTMLElement | null>(null)
const track = ref<HTMLElement | null>(null)

const index = ref(0)
const count = computed(() => props.items.length)
const scripted = ref(false)

// From the locale, not the DOM, so it is right during SSR. RTL flips both the arrow keys and the track.
const { locale, locales } = useI18n()
const rtl = computed(() =>
  (locales.value as { code: string, dir?: string }[])
    .find(l => l.code === locale.value)?.dir === 'rtl',
)
/** +1 when reading runs to the right, -1 when it runs to the left. */
const fwd = computed(() => (rtl.value ? -1 : 1))

type Gsap = GsapModules['gsap']
let gsap: Gsap | null = null
let ctx: ReturnType<Gsap['context']> | null = null
let swipe: Promise<void> | null = null
let unbind: (() => void) | null = null

/** Track position for a slide, in % of its own width. */
const positionOf = (i: number) => -fwd.value * i * 100

/** `index` moves first (everything reads it); stillness is asked per call, as it can change mid-session. */
function go(to: number) {
  index.value = Math.max(0, Math.min(count.value - 1, to))
  const el = track.value
  if (!scripted.value || !gsap || !ctx || !el) return
  const g = gsap
  const vars = { xPercent: positionOf(index.value), overwrite: true }
  ctx.add(() => {
    if (prefersStillness()) g.set(el, vars)
    else g.to(el, { ...vars, duration: S.duration, ease: 'reveal' })
  })
}

/** `x: 0` is not redundant: GSAP reads the CSS translate as px and would add `xPercent` on top. */
function takeOver(m: GsapModules) {
  const host = root.value
  const el = track.value
  if (!host || !el || scripted.value) return
  gsap = m.gsap
  ctx = gsap.context(() => {}, host)
  ctx.add(() => m.gsap.set(el, { x: 0, xPercent: positionOf(index.value) }))
  scripted.value = true
}

// One step per gesture, measured over the whole gesture (Observer's per-frame `tolerance`
// depends on refresh rate). `wheelSpeed: -1` makes a trackpad read like a drag.
async function bindSwipe() {
  if (count.value < 2) return
  const Observer = await loadPlugin('Observer')
  const vp = viewport.value
  if (!Observer || !vp || unbind) return

  let armed = true
  let wheeled = 0

  const step = (travel: number, velocity: number) => {
    if (!armed) return
    const far = Math.abs(travel) >= S.swipe.distance
    if (!far && Math.abs(velocity) < S.swipe.flick) return
    armed = false
    // Pushed left (negative) means the slide to the right: next in LTR, previous in RTL.
    const pushed = Math.sign(far ? travel : velocity)
    go(index.value - pushed * fwd.value)
  }

  const observer = Observer.create({
    target: vp,
    type: 'touch,pointer,wheel',
    lockAxis: true,
    wheelSpeed: -1,
    onPress: () => { armed = true },
    onDrag: (self) => {
      if (self.axis === 'y') return
      step((self.x ?? 0) - (self.startX ?? 0), self.velocityX)
    },
    onWheel: (self) => {
      if (Math.abs(self.deltaX) <= Math.abs(self.deltaY)) return
      wheeled += self.deltaX
      step(wheeled, 0)
    },
    onStop: () => { armed = true; wheeled = 0 },
  })

  // Claim sideways wheels so the browser doesn't go Back; Observer's listeners are passive and can't.
  const onWheel = (e: WheelEvent) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) e.preventDefault()
  }
  vp.addEventListener('wheel', onWheel, { passive: false })

  unbind = () => {
    observer.kill()
    vp.removeEventListener('wheel', onWheel)
  }
}

/** Under stillness nothing is fetched at mount; the first contact fetches the swipe. */
function prime() {
  swipe ??= bindSwipe()
}

function onKey(e: KeyboardEvent) {
  const forward = rtl.value ? 'ArrowLeft' : 'ArrowRight'
  const back = rtl.value ? 'ArrowRight' : 'ArrowLeft'
  if (e.key === forward) { go(index.value + 1); e.preventDefault() }
  if (e.key === back) { go(index.value - 1); e.preventDefault() }
}

onMounted(() => {
  if (prefersStillness()) return
  void loadGsap().then((m) => {
    if (!m || !root.value) return
    takeOver(m)
    prime()
  })
})

onBeforeUnmount(() => {
  unbind?.()
  unbind = null
  ctx?.revert()
  ctx = null
  gsap = null
})
</script>

<template>
  <div
    ref="root"
    class="slider"
    :class="{ 'is-scripted': scripted }"
    role="group"
    :aria-roledescription="$t('slider.carousel')"
    :aria-label="label"
    tabindex="0"
    @keydown="onKey"
  >
    <div
      ref="viewport"
      class="slider__viewport"
      @pointerenter="prime"
      @touchstart.passive="prime"
      @dragstart.prevent
    >
      <!-- Plain divs, not a list: the slides are role="group". -->
      <div ref="track" class="slider__track" :style="{ '--slider-index': index }">
        <div
          v-for="(item, i) in items"
          :key="i"
          class="slider__slide"
          role="group"
          :aria-roledescription="$t('slider.slide')"
          :aria-label="$t('slider.indexOf', { n: i + 1, count })"
          :aria-hidden="i !== index"
          :inert="i !== index ? true : undefined"
        >
          <slot :item="item" :index="i" :current="i === index" />
        </div>
      </div>
    </div>

    <div class="slider__controls">
      <button
        v-if="showArrows"
        type="button"
        class="slider__arrow"
        :disabled="index === 0"
        @click="go(index - 1)"
      >
        <Icon name="ph:caret-left" class="u-rtl-mirror" aria-hidden="true" />
        <span class="sr-only">{{ $t('slider.previous') }}</span>
      </button>

      <ul class="slider__dots">
        <li v-for="(_, i) in items" :key="i">
          <button
            type="button"
            class="slider__dot"
            :class="{ 'is-current': i === index }"
            :aria-current="i === index ? 'true' : undefined"
            @click="go(i)"
          >
            <span class="sr-only">{{ $t('slider.goTo', { n: i + 1 }) }}</span>
          </button>
        </li>
      </ul>

      <button
        v-if="showArrows"
        type="button"
        class="slider__arrow"
        :disabled="index === count - 1"
        @click="go(index + 1)"
      >
        <Icon name="ph:caret-right" class="u-rtl-mirror" aria-hidden="true" />
        <span class="sr-only">{{ $t('slider.next') }}</span>
      </button>
    </div>

    <p class="sr-only" role="status" aria-live="polite">
      {{ $t('slider.position', { n: index + 1, count }) }}
    </p>
  </div>
</template>

<style scoped>
.slider {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;
  min-width: 0;
}

.slider__viewport {
  flex: 1 1 auto;
  overflow: hidden;
  min-height: 0;
  touch-action: pan-y;
  user-select: none;
}

.slider__track {
  /* translateX is physical: RTL puts the first slide at the right, so the sign flips. */
  --slider-dir: -1;
  display: flex;
  height: 100%;
  transform: translateX(calc(var(--slider-index, 0) * var(--slider-dir) * 100%));
  transition: transform var(--duration-slow) var(--ease-out-soft);
}

[dir='rtl'] .slider__track { --slider-dir: 1; }

/* Left in place, the transition would chase every frame of the GSAP tween. */
.slider.is-scripted .slider__track { transition: none; }

.slider__slide {
  flex: 0 0 100%;
  min-width: 0;
}

.slider__controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.slider__arrow {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  color: var(--color-ink-muted);
  transition: color var(--duration-fast) var(--ease-out-soft);
}

.slider__arrow:hover:not(:disabled) { color: var(--color-ink-strong); }
.slider__arrow:disabled { opacity: 0.35; cursor: not-allowed; }

/* 24px targets with the 8px dot centred: WCAG 2.5.8 (overlapping hit areas don't count). */
.slider__dots { display: flex; }

.slider__dot {
  display: grid;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
}

.slider__dot::before {
  content: '';
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background-color: var(--color-border-strong);
  transition: background-color var(--duration-fast) var(--ease-out-soft);
}

.slider__dot.is-current::before { background-color: var(--color-ink-muted); }

@media (prefers-reduced-motion: reduce) {
  .slider__track { transition: none; }
}
</style>
