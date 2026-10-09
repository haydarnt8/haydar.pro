<script setup lang="ts">
import type { ShotNote } from '~/types/portfolio'
import { annotation as A, reveal as R } from '~/config/motion'

// A ring drawn round what a gallery shot's caption names, plus a few of its words.
// No vector-effect: non-scaling-stroke: both engines then ignore pathLength, so the width is measured instead.
const props = defineProps<{
  note: ShotNote
  current: boolean
  seed: number
}>()

const root = ref<HTMLElement | null>(null)
const ring = computed(() => inkRing(props.note.ring, props.seed))

// Rounded: server and browser Math differ in the 16th digit (hydration mismatch).
const fraction = (n: number) => Math.round(n * 1e4) / 1e4
const anchor = computed(() => {
  const { top, right, bottom, left } = ring.value.reach
  const [x, y] = { below: bottom, above: top, left, right }[props.note.side]
  return { x: fraction(x / props.note.size[0]), y: fraction(y / props.note.size[1]) }
})

// Picture px per CSS px; CSS cannot divide a length by a length.
const unit = ref<number | null>(null)

const phase = ref<'rest' | 'waiting' | 'arriving' | 'turning'>('rest')

const style = computed(() => ({
  '--ratio': fraction(props.note.size[0] / props.note.size[1]),
  '--ax': anchor.value.x,
  '--ay': anchor.value.y,
  '--ink-unit': unit.value ?? undefined,
  '--ink-turn': `${A.turn}s`,
  '--ink-arrive': `${A.arrive}s`,
  '--ink-draw': `${A.draw}s`,
  '--ink-label-at': A.labelAt,
  '--ink-label': `${A.label}s`,
}))

function measure() {
  const el = root.value
  if (!el?.clientWidth || !el.clientHeight) return
  const [w, h] = props.note.size
  unit.value = Math.round(Math.max(w / el.clientWidth, h / el.clientHeight) * 1000) / 1000
}

let resized: ResizeObserver | null = null
let watcher: MutationObserver | null = null
let failsafe: ReturnType<typeof setTimeout> | null = null

function stopWaiting() {
  watcher?.disconnect()
  watcher = null
  if (failsafe) clearTimeout(failsafe)
  failsafe = null
}

function arrive() {
  stopWaiting()
  if (props.current && phase.value === 'waiting') phase.value = 'arriving'
}

// useReveal hides a card with inline opacity: 0 until it lands.
function heldBack() {
  for (let el = root.value?.parentElement; el && el !== document.body; el = el.parentElement) {
    if (el.style.opacity === '0') return el
  }
  return null
}

watch(() => props.current, (now) => {
  stopWaiting()
  phase.value = now && !prefersStillness() ? 'turning' : 'rest'
})

onMounted(async () => {
  const el = root.value
  if (!el) return
  resized = new ResizeObserver(measure)
  resized.observe(el)

  if (!props.current || prefersStillness()) return
  // The reveal hides the card in its own `mounted` hook, which runs after this one.
  await nextTick()
  const host = heldBack()
  if (!host || !props.current) return

  phase.value = 'waiting'
  // Cue on landing (inline opacity cleared); the failsafe covers a card shown any
  // other way, so the ink never waits on a signal that can stop.
  watcher = new MutationObserver(() => {
    const opacity = host.style.opacity
    if (opacity === '0') return
    if (opacity === '' || Number(opacity) >= 1) return arrive()
    failsafe ??= setTimeout(arrive, (R.duration + 0.5) * 1000)
  })
  watcher.observe(host, { attributes: true, attributeFilter: ['style'] })
})

onBeforeUnmount(() => {
  stopWaiting()
  resized?.disconnect()
})
</script>

<template>
  <div
    ref="root"
    class="ink"
    :class="[phase !== 'rest' && `is-${phase}`, note.pen === 'light' && 'ink--light']"
    :style="style"
    aria-hidden="true"
  >
    <svg
      class="ink__marks"
      :viewBox="`0 0 ${note.size[0]} ${note.size[1]}`"
      preserveAspectRatio="xMidYMid meet"
      focusable="false"
    >
      <path class="ink__line" :d="ring.d" pathLength="1" />
    </svg>
    <span class="ink__label" :class="`ink__label--${note.side}`">{{ note.label }}</span>
  </div>
</template>

<style scoped>
/* Where object-fit: contain puts the shot; the frame is the container (ProjectGallery.vue). */
.ink {
  --img-w: min(100cqw, 100cqh * var(--ratio));
  --img-h: min(100cqh, 100cqw / var(--ratio));
  --img-x: calc((100cqw - var(--img-w)) / 2);
  --img-y: calc((100cqh - var(--img-h)) / 2);
  --pen: 2.25px;
  --gap: 0.4rem;
  --edge: 0.5rem;

  position: absolute;
  inset: 0;
  pointer-events: none;
}

.ink__marks {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Raw colours on purpose: the ink is written on the picture, so it follows the shot, not the theme. */
.ink__line {
  stroke: #111;
  stroke-width: calc(var(--pen) * var(--ink-unit, 2.4));
}

.ink--light .ink__line { stroke: #f2f2f2; }

/* Raw colours on purpose: the label sits on a picture, so it cannot follow the theme. */
.ink__label {
  --left: calc(var(--img-x) + var(--ax) * var(--img-w));
  --top: calc(var(--img-y) + var(--ay) * var(--img-h));

  position: absolute;
  left: var(--left);
  top: var(--top);
  width: max-content;
  padding: 0.3rem 0.6rem;
  border: 1px solid rgb(255 255 255 / 0.2);
  border-radius: 0.5rem;
  background: rgb(10 10 10 / 0.72);
  backdrop-filter: blur(8px);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.35;
  text-wrap: balance;
}

.ink__label--below {
  translate: -50% var(--gap);
  max-width: calc(2 * min(var(--left), 100cqw - var(--left)) - 2 * var(--edge));
}

.ink__label--above {
  translate: -50% calc(-100% - var(--gap));
  max-width: calc(2 * min(var(--left), 100cqw - var(--left)) - 2 * var(--edge));
}

.ink__label--right {
  translate: var(--gap) -50%;
  max-width: calc(100cqw - var(--left) - var(--gap) - var(--edge));
}

.ink__label--left {
  translate: calc(-100% - var(--gap)) -50%;
  max-width: calc(var(--left) - var(--gap) - var(--edge));
}

@media (width >= 810px) {
  .ink__label { font-size: 0.8125rem; }
}

/* Enhancement only: every way of not running it must leave the ring whole. */
@media (prefers-reduced-motion: no-preference) {
  .ink.is-waiting .ink__line {
    stroke-dasharray: 1 2;
    stroke-dashoffset: 1.001;
  }

  .ink.is-waiting .ink__label { opacity: 0; }

  .ink.is-arriving { --lead: var(--ink-arrive); }
  .ink.is-turning { --lead: var(--ink-turn); }

  .ink:is(.is-arriving, .is-turning) .ink__line {
    stroke-dasharray: 1 2;
    animation: ink-pen var(--ink-draw) cubic-bezier(0.45, 0, 0.55, 1) var(--lead) both;
  }

  .ink:is(.is-arriving, .is-turning) .ink__label {
    animation-duration: var(--ink-label);
    animation-timing-function: var(--ease-out-soft);
    animation-delay: calc(var(--lead) + var(--ink-draw) * var(--ink-label-at));
    animation-fill-mode: both;
  }

  /* Named here, one by one: scoped CSS renames a keyframe only where it can see the name. */
  .ink:is(.is-arriving, .is-turning) .ink__label--below { animation-name: ink-unroll-down; }
  .ink:is(.is-arriving, .is-turning) .ink__label--above { animation-name: ink-unroll-up; }
  .ink:is(.is-arriving, .is-turning) .ink__label--right { animation-name: ink-unroll-right; }
  .ink:is(.is-arriving, .is-turning) .ink__label--left { animation-name: ink-unroll-left; }
}

@keyframes ink-pen {
  from { stroke-dashoffset: 1.001; }
  to { stroke-dashoffset: 0; }
}

@keyframes ink-unroll-down {
  from { clip-path: inset(0 0 100% 0); }
  to { clip-path: inset(0); }
}

@keyframes ink-unroll-up {
  from { clip-path: inset(100% 0 0 0); }
  to { clip-path: inset(0); }
}

@keyframes ink-unroll-right {
  from { clip-path: inset(0 100% 0 0); }
  to { clip-path: inset(0); }
}

@keyframes ink-unroll-left {
  from { clip-path: inset(0 0 0 100%); }
  to { clip-path: inset(0); }
}

@supports not (width: 1cqw) {
  .ink__label { display: none; }
}
</style>
