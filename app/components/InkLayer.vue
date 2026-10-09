<script setup lang="ts">
import { ink as I, media } from '~/config/motion'

// Ink that floods the nearest button or link on hover, keyboard focus and touch.
const props = withDefaults(defineProps<{
  /** How long a finger's ink stays after the tap, in s. */
  hold?: number
  tone?: 'invert' | 'brand'
}>(), { hold: I.touchHold, tone: 'invert' })

const emit = defineEmits<{ enter: [], leave: [] }>()

const layer = ref<HTMLElement | null>(null)
let host: HTMLElement | null = null
let hovering = false
let focused = false
let lift: ReturnType<typeof setTimeout> | undefined

function pointOf(e?: { clientX: number, clientY: number }) {
  const r = host!.getBoundingClientRect()
  if (e) return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }
  const rtl = getComputedStyle(host!).direction === 'rtl'
  return { x: rtl ? r.width : 0, y: r.height / 2, w: r.width, h: r.height }
}

function reach({ x, y, w, h }: ReturnType<typeof pointOf>) {
  return Math.ceil(Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y))) + 2
}

const disc = (r: number, x: number, y: number) => `circle(${r}px at ${x}px ${y}px)`

async function flood(at: ReturnType<typeof pointOf>) {
  const el = layer.value
  const m = await loadGsap()
  if (!el || !m || prefersStillness()) return
  const { gsap } = m
  el.classList.remove('is-full')
  gsap.fromTo(el, { clipPath: disc(0, at.x, at.y) }, {
    clipPath: disc(reach(at), at.x, at.y),
    duration: I.flood.duration,
    ease: I.flood.ease,
    overwrite: true,
    onComplete: () => { el.classList.add('is-full'); gsap.set(el, { clearProps: 'clipPath' }) },
  })
}

async function drain(at: ReturnType<typeof pointOf>) {
  const el = layer.value
  const m = await loadGsap()
  if (!el || !m) return
  const { gsap } = m
  const from = el.classList.contains('is-full') || !el.style.clipPath ? disc(reach(at), at.x, at.y) : el.style.clipPath
  el.classList.remove('is-full')
  gsap.fromTo(el, { clipPath: from }, {
    clipPath: disc(0, at.x, at.y),
    duration: I.drain.duration,
    ease: I.drain.ease,
    overwrite: true,
    onComplete: () => { gsap.set(el, { clearProps: 'clipPath' }) },
  })
}

async function stamp() {
  const m = await loadGsap()
  if (!host || !m || prefersStillness()) return
  const { gsap } = m
  const target = host
  gsap.timeline({ onComplete: () => { gsap.set(target, { clearProps: 'transform,scale' }) } })
    .to(target, { scale: I.stamp.scale, duration: I.stamp.down, ease: 'power2.out', overwrite: true })
    .to(target, { scale: 1, duration: I.stamp.up, ease: I.stamp.ease })
}

const fine = () => window.matchMedia(media.fine).matches
const still = () => prefersStillness()

function onEnter(e: PointerEvent) {
  if (e.pointerType === 'touch' || !fine() || still()) return
  hovering = true
  if (!focused) { void flood(pointOf(e)); emit('enter') }
}

function onLeave(e: PointerEvent) {
  if (e.pointerType === 'touch' || !hovering) return
  hovering = false
  if (!focused) { void drain(pointOf(e)); emit('leave') }
}

function onDown(e: PointerEvent) {
  if (still()) return
  void stamp()
  if (e.pointerType !== 'touch') return
  clearTimeout(lift)
  void flood(pointOf(e))
}

function onUp(e: PointerEvent) {
  if (e.pointerType !== 'touch' || still()) return
  const at = pointOf(e)
  clearTimeout(lift)
  lift = setTimeout(() => { void drain(at) }, props.hold * 1000)
}

function onFocus() {
  // A click focuses too; only keyboard focus inks.
  if (!host?.matches(':focus-visible') || still()) return
  focused = true
  if (!hovering) { void flood(pointOf()); emit('enter') }
}

function onBlur() {
  if (!focused) return
  focused = false
  if (!hovering && host) {
    const at = pointOf()
    void drain({ ...at, x: at.w - at.x })
    emit('leave')
  }
}

function onKey(e: KeyboardEvent) {
  if ((e.key === 'Enter' || e.key === ' ') && !still()) void stamp()
}

/** One flood-and-drain on the host's request; skipped while a pointer or keyboard holds the ink. */
let pulsing: ReturnType<typeof setTimeout> | undefined
function pulse() {
  if (!host || hovering || focused || still()) return
  const at = pointOf()
  void flood(at)
  clearTimeout(pulsing)
  pulsing = setTimeout(() => {
    if (!hovering && !focused) void drain({ ...at, x: at.w - at.x })
  }, (I.flood.duration + I.pulseHold) * 1000)
}

defineExpose({ pulse })

const bindings: Array<[string, (e: never) => void]> = [
  ['pointerenter', onEnter], ['pointerleave', onLeave], ['pointerdown', onDown],
  ['pointerup', onUp], ['pointercancel', onUp], ['focus', onFocus], ['blur', onBlur], ['keydown', onKey],
]

onMounted(() => {
  host = layer.value?.closest('button, a') ?? null
  if (!host) return
  host.classList.add('u-ink-host')
  for (const [type, fn] of bindings) host.addEventListener(type, fn as EventListener)
})

onBeforeUnmount(() => {
  clearTimeout(lift)
  clearTimeout(pulsing)
  if (!host) return
  for (const [type, fn] of bindings) host.removeEventListener(type, fn as EventListener)
  host.classList.remove('u-ink-host')
})
</script>

<template>
  <span ref="layer" class="ink" :class="{ 'ink--brand': tone === 'brand' }" aria-hidden="true" />
</template>

<style scoped>
.ink {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  /* White on purpose: under `difference` it inverts in both themes. */
  background-color: #fff;
  mix-blend-mode: difference;
  clip-path: circle(0 at 50% 50%);
}

.ink.is-full { clip-path: none; }

.ink--brand {
  z-index: 0;
  background-color: var(--brand);
  mix-blend-mode: normal;
}

@media (prefers-reduced-motion: reduce) {
  .ink { display: none; }
}
</style>

<style>
/* Isolated so the blend sees only the button's paint; clipped because the layer has no radius. */
.u-ink-host {
  position: relative;
  isolation: isolate;
  overflow: hidden;
}
</style>
