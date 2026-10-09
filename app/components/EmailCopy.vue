<script setup lang="ts">
import { ink as I } from '~/config/motion'

const content = useContent()

type State = 'idle' | 'copied' | 'failed'
const state = ref<State>('idle')
let timer: ReturnType<typeof setTimeout> | undefined

const { t } = useI18n()
const label = computed(() => (state.value === 'copied' ? t('emailCopy.copied') : t('emailCopy.copy')))

const labelEl = ref<HTMLElement | null>(null)
const { swapTo } = useTextSwap(labelEl)

const chipEl = ref<HTMLElement | null>(null)
const addressEl = ref<HTMLElement | null>(null)
let inked = false
const decoded = ref(false)
let pressedBy = ''
let reveal: ReturnType<typeof setTimeout> | undefined

function fit(chip: HTMLElement, el: HTMLElement) {
  const cs = getComputedStyle(el)
  const base = Number.parseFloat(getComputedStyle(chip).fontSize)
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return
  ctx.font = `${cs.fontWeight} ${base}px ${cs.fontFamily}`
  const wide = ctx.measureText(content.profile.email).width
  const room = el.clientWidth - Number.parseFloat(cs.paddingLeft) - Number.parseFloat(cs.paddingRight) - 4
  const size = Math.max(I.decodeMinPx, Math.min(base, (base * room) / wide))
  chip.style.setProperty('--address-size', `${size.toFixed(2)}px`)
}

/** `force`: a finger has no hover, so a tap asks for the address directly. */
async function showAddress(force = false) {
  const chip = chipEl.value
  const el = addressEl.value
  const m = await loadGsap()
  if (!chip || !el || !m || prefersStillness()) return
  if (!force && (!inked || state.value !== 'idle')) return
  fit(chip, el)
  decoded.value = true
  el.textContent = ''
  m.gsap.to(el, {
    duration: I.decode.duration,
    ease: 'none',
    overwrite: true,
    scrambleText: {
      text: content.profile.email,
      chars: I.decode.chars,
      speed: I.decode.speed,
      revealDelay: I.decode.revealDelay,
    },
  })
}

function hideAddress() {
  clearTimeout(reveal)
  decoded.value = false
  if (addressEl.value) gsapModules()?.gsap.killTweensOf(addressEl.value)
}

function notePress(e: PointerEvent) {
  pressedBy = e.pointerType
}

function inkIn() {
  inked = true
  void showAddress()
}

function inkOut() {
  inked = false
  hideAddress()
}

async function copy() {
  const previous = label.value
  const byFinger = pressedBy === 'touch' && !prefersStillness()
  pressedBy = ''
  // Under a finger the address shows first: marked now, so the tick waits hidden instead of drawing unseen.
  if (byFinger) decoded.value = true
  else hideAddress()
  try {
    await navigator.clipboard.writeText(content.profile.email)
    state.value = 'copied'
  }
  catch {
    // Clipboard access fails on insecure origins and when permission is denied.
    state.value = 'failed'
  }

  // After the render: the swap reads the new label from the DOM.
  await nextTick()
  void swapTo(previous)
  if (byFinger) {
    if (state.value === 'copied') {
      void showAddress(true)
      clearTimeout(reveal)
      reveal = setTimeout(hideAddress, I.touchReveal * 1000)
    }
    else hideAddress()
  }

  clearTimeout(timer)
  timer = setTimeout(async () => {
    const was = label.value
    state.value = 'idle'
    await nextTick()
    void swapTo(was)
    void showAddress()
  }, 4000)
}

onBeforeUnmount(() => { clearTimeout(timer); clearTimeout(reveal) })
</script>

<template>
  <div class="wrap">
    <button
      ref="chipEl"
      type="button"
      class="chip"
      :class="{ 'is-decoded': decoded }"
      @pointerdown="notePress"
      @click="copy"
    >
      <span class="chip__face">
        <span class="chip__label">
          <span ref="labelEl" class="chip__text">{{ label }}</span>
        </span>

        <span class="chip__glyph" aria-hidden="true">
          <Icon v-if="state !== 'copied'" name="ph:copy" class="chip__icon" />
          <DrawnTick v-else :play="!decoded" class="chip__icon" />
        </span>
      </span>

      <!-- Left empty for ScrambleText, so Vue never holds a text node GSAP replaced. -->
      <span ref="addressEl" class="chip__address" dir="ltr" aria-hidden="true" />

      <InkLayer :hold="I.touchReveal" @enter="inkIn" @leave="inkOut" />
    </button>

    <!-- Never animated: a status must announce at once. -->
    <p class="sr-only" role="status" aria-live="polite">
      <template v-if="state === 'copied'">{{ $t('emailCopy.copiedStatus') }}</template>
      <template v-else-if="state === 'failed'">{{ $t('emailCopy.failed') }}</template>
    </p>

    <p v-if="state === 'failed'" class="fallback">
      {{ $t('emailCopy.manual') }}
      <a :href="`mailto:${content.profile.email}`">{{ content.profile.email }}</a>
    </p>
  </div>
</template>

<style scoped>
.wrap { width: 100%; }

.chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 1rem;
  border-radius: var(--radius-tile);
  background-color: var(--color-border-subtle);
  color: var(--color-ink-strong);
  font-size: var(--text-body);
  transition: background-color var(--duration-base) var(--ease-out-soft);
}

/* Real hover only: iOS keeps :hover on whatever was last tapped. */
@media (hover: hover) {
  .chip:hover { background-color: var(--color-surface-emphasis); }
}

.chip__face {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  transition: opacity var(--duration-fast) linear;
}

.chip__address {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding-inline: 1rem;
  white-space: nowrap;
  font-size: var(--address-size, var(--text-body));
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--duration-fast) linear;
}

.chip.is-decoded .chip__face { opacity: 0; }
.chip.is-decoded .chip__address { opacity: 1; }

/* A clip, not overflow: hidden, a little wide of the sides: the ز of "دز" overhangs by 0.06em.
   Padding would widen the box the outgoing clone is laid out in. */
.chip__label {
  position: relative;
  display: block;
  clip-path: inset(0 -0.15em);
  line-height: 1.4;
  height: 1.4em;
}

.chip__text { display: block; }

.chip__glyph {
  display: grid;
  place-items: center;
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

.chip__icon { width: 1.25rem; height: 1.25rem; }

.fallback {
  margin-top: 0.75rem;
  font-size: var(--text-body-sm);
  color: var(--color-ink-muted);
}

.fallback a { color: var(--color-ink-strong); text-decoration: underline; }
</style>
