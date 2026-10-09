<script setup lang="ts">
import { tour as T } from '~/config/motion'

// A real slider (role="slider", 390 to 1440 CSS px), so the keyboard does what the pointer does; mirrored in Arabic.
// The width reaches the page as a custom property, never an inline transform.
const props = defineProps<{
  desktop: string
  phone: string
  desktopAlt: string
  phoneAlt: string
  breakpoint: number
  /** Its step is the one being read. */
  active: boolean
}>()

const MIN = 390
const MAX = 1440
const value = ref(MAX)
const isPhone = computed(() => value.value < props.breakpoint)
const { t, locale } = useI18n()
const rtl = computed(() => langOf(locale.value) === 'ar')
const valueText = computed(() => t('tour.resize.value', {
  n: value.value,
  layout: t(isPhone.value ? 'tour.resize.phone' : 'tour.resize.desktop'),
}))

const area = ref<HTMLElement | null>(null)
let touched = false
let demo: { kill(): void } | null = null
let shown = false

const clamp = (n: number) => Math.round(Math.min(MAX, Math.max(MIN, n)) / 10) * 10

function set(n: number) {
  touched = true
  demo?.kill()
  value.value = clamp(n)
}

function fromPointer(e: PointerEvent) {
  const box = area.value?.getBoundingClientRect()
  if (!box?.width) return
  const along = rtl.value ? box.right - e.clientX : e.clientX - box.left
  set((along / box.width) * MAX)
}

function grab(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
  el.focus({ preventScroll: true })
  fromPointer(e)
}

function drag(e: PointerEvent) {
  if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) fromPointer(e)
}

function key(e: KeyboardEvent) {
  const step = e.shiftKey ? T.resizeBigStep : T.resizeStep
  const grow = rtl.value ? 'ArrowLeft' : 'ArrowRight'
  const shrink = rtl.value ? 'ArrowRight' : 'ArrowLeft'
  const moves: Record<string, number> = {
    [grow]: step, ArrowUp: step, [shrink]: -step, ArrowDown: -step,
    PageUp: T.resizeBigStep, PageDown: -T.resizeBigStep,
  }
  if (e.key === 'Home') set(MIN)
  else if (e.key === 'End') set(MAX)
  else if (e.key in moves) set(value.value + moves[e.key]!)
  else return
  e.preventDefault()
}

watch(() => props.active, async (now) => {
  if (!now || shown || touched || prefersStillness()) return
  shown = true
  const m = await loadGsap()
  if (!m || touched) return
  const box = { v: value.value }
  demo = m.gsap.to(box, {
    v: T.resizeDemo.to,
    duration: T.resizeDemo.duration,
    delay: T.resizeDemo.pause,
    ease: 'power2.inOut',
    onUpdate: () => { value.value = clamp(box.v) },
  })
})

onBeforeUnmount(() => demo?.kill())
</script>

<template>
  <div class="rz" :class="{ 'is-phone': isPhone }" :style="{ '--w': value / MAX }">
    <div ref="area" class="rz__area">
      <div class="rz__vp">
        <img :src="desktop" :alt="isPhone ? '' : desktopAlt" :aria-hidden="isPhone || undefined" loading="lazy" decoding="async" class="rz__shot rz__shot--desktop">
        <img :src="phone" :alt="isPhone ? phoneAlt : ''" :aria-hidden="!isPhone || undefined" loading="lazy" decoding="async" class="rz__shot rz__shot--phone">
        <span class="rz__width" aria-hidden="true" dir="ltr">{{ value }} px</span>
        <span
          class="rz__handle"
          role="slider"
          tabindex="0"
          :aria-label="$t('tour.resize.label')"
          :aria-valuemin="MIN"
          :aria-valuemax="MAX"
          :aria-valuenow="value"
          :aria-valuetext="valueText"
          aria-orientation="horizontal"
          @pointerdown="grab"
          @pointermove="drag"
          @keydown="key"
        >
          <Icon name="ph:arrows-horizontal-bold" aria-hidden="true" />
        </span>
      </div>
    </div>
    <div class="rz__ruler" aria-hidden="true" dir="ltr">
      <span class="rz__tick" :style="{ '--at': MIN / MAX }">{{ MIN }}</span>
      <span class="rz__tick rz__tick--bp" :style="{ '--at': breakpoint / MAX }">{{ breakpoint }}</span>
      <span class="rz__tick" :style="{ '--at': 1 }">{{ MAX }}</span>
    </div>
  </div>
</template>

<style scoped>
/* Inset so the handle and the ruler's last number stay clear of the frame's rounded, clipping edge. */
.rz {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  height: 100%;
  padding: 0.75rem 1.25rem 0.5rem;
}

.rz__area {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
}

.rz__vp {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  width: calc(var(--w, 1) * 100%);
  border-radius: var(--radius-tile);
  background-color: var(--color-surface-sunken);
  outline: 1px solid var(--color-border-strong);
}

.rz__shot {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: inherit;
  transition: opacity 0.35s var(--ease-out-soft), scale 0.35s var(--ease-out-soft);
}

.rz__shot--phone { opacity: 0; scale: 0.96; }
.rz.is-phone .rz__shot--phone { opacity: 1; scale: 1; }
.rz.is-phone .rz__shot--desktop { opacity: 0; scale: 1.04; }

/* Physical sides: the readout is dir="ltr" for its digits, and a logical inset would follow that, not the page. */
.rz__width {
  position: absolute;
  bottom: 0.75rem;
  right: 1.5rem;
  z-index: 1;
  padding: 0.25rem 0.625rem;
  border-radius: 50px;
  background: rgb(10 10 10 / 0.8);
  color: var(--color-lamp);
  font-size: var(--text-label);
  font-variant-numeric: tabular-nums;
}

.rz__handle {
  position: absolute;
  top: 50%;
  inset-inline-end: -0.875rem;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 1.75rem;
  height: 4rem;
  translate: 0 -50%;
  border-radius: 0.875rem;
  background: var(--color-lamp);
  color: #111;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-lamp) 25%, transparent), 0 6px 18px rgb(0 0 0 / 0.45);
  cursor: ew-resize;
  touch-action: none;
}

.rz__handle:focus-visible {
  outline: 2px solid var(--color-ink-strong);
  outline-offset: 3px;
}

.rz__ruler {
  position: relative;
  height: 1.25rem;
  border-top: 1px solid var(--color-border-strong);
  color: var(--color-ink-faint);
  font-size: var(--text-label);
  font-variant-numeric: tabular-nums;
}

[dir='rtl'] .rz__width { right: auto; left: 1.5rem; }
[dir='rtl'] .rz__ruler { transform: scaleX(-1); }
[dir='rtl'] .rz__tick { transform: scaleX(-1); }

.rz__tick {
  position: absolute;
  top: 0.25rem;
  left: calc(var(--at) * 100%);
  translate: -50% 0;
}

.rz__tick:last-child { translate: -100% 0; }

.rz__tick::before {
  content: '';
  position: absolute;
  top: -0.6rem;
  left: 50%;
  width: 1px;
  height: 0.5rem;
  background: currentColor;
}

.rz__tick:last-child::before { left: 100%; }
.rz__tick--bp { color: var(--color-lamp); }

@media (prefers-reduced-motion: reduce) {
  .rz__shot { transition: none; }
}
</style>
