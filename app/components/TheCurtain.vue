<script setup lang="ts">
/** Mounted once per root (app.vue and error.vue): Nuxt swaps the whole root on a fatal error. */
const { state, isVisible, isSealed, registerDom, releaseDom } = useCurtain()

const root = ref<HTMLElement | null>(null)
const panels = ref<HTMLElement | null>(null)
const label = ref<SVGElement | null>(null)

// SVG text doesn't wrap: CSS sizes long labels by char count (0.58 = DM Sans 500's average em advance).
const chars = computed(() => Math.max(state.value.label.length, 1))

onMounted(() => {
  if (!root.value || !panels.value || !label.value) return
  registerDom({ root: root.value, panels: panels.value, label: label.value })

  // On the element, non-passive: Chrome forces wheel listeners on window/document/body to be passive.
  const block = (event: Event) => { if (isSealed.value) event.preventDefault() }
  root.value.addEventListener('wheel', block, { passive: false })
  root.value.addEventListener('touchmove', block, { passive: false })

  onBeforeUnmount(() => {
    root.value?.removeEventListener('wheel', block)
    root.value?.removeEventListener('touchmove', block)
  })
})

onBeforeUnmount(() => { if (root.value) releaseDom(root.value) })

// `!important`: a later scoped `display` would re-cover the page for visitors without JavaScript.
useHead({
  noscript: [{ innerHTML: '<style>.curtain{display:none!important}</style>' }],
})

// Longer in dev: a cold Vite server's first hydration can outlast the 6s failsafe.
const failsafeStyle = import.meta.dev ? { '--curtain-failsafe': '30s' } : undefined
</script>

<template>
  <div
    ref="root"
    class="curtain"
    :class="{ 'is-visible': isVisible, 'is-sealed': isSealed }"
    :style="failsafeStyle"
    aria-hidden="true"
  >
    <div ref="panels" class="curtain__panels">
      <div
        v-for="i in state.count"
        :key="i"
        class="curtain__panel"
        :class="{ 'is-still': state.still }"
      />
    </div>

    <!-- SVG, not a heading: SVG text is not an LCP candidate; HTML text this large would be. -->
    <svg
      ref="label"
      class="curtain__label"
      :lang="state.lang || undefined"
      :style="{ '--label-chars': chars, direction: state.dir }"
      focusable="false"
      aria-hidden="true"
    >
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central">{{ state.label }}</text>
    </svg>

    <TheIntro />
  </div>
</template>

<style scoped>
.curtain {
  position: fixed;
  inset: 0;
  z-index: 50;
  visibility: hidden;
  pointer-events: none;
}

/* Painted (is-visible) and blocking (is-sealed) are separate: it is still drawn while it slides away. */
.curtain.is-visible {
  visibility: visible;

  /* Failsafe 2: if script never runs, the sealed SSR layer would block clicks; drop it from hit testing. */
  animation: curtain-failsafe-release 1ms linear calc(var(--curtain-failsafe, 6s) + 600ms) forwards;
}

.curtain.is-sealed {
  pointer-events: auto;
  touch-action: none;
}

@keyframes curtain-failsafe-release {
  to { visibility: hidden; }
}

/* Forced ltr so panel order is physical: JS applies the stagger's direction; a flipped row would undo it. */
.curtain__panels {
  position: absolute;
  inset: 0;
  display: flex;
  direction: ltr;
}

.curtain__panel {
  flex: 1 1 0;
  background-color: var(--curtain-ink);
  /* Hides sub-pixel seams between strips at fractional viewport widths. */
  box-shadow: 0 0 0 1px var(--curtain-ink);
  will-change: transform;
  transform: translateY(-101%);
}

.curtain__panel.is-still {
  transform: none;

  /* Failsafe for JS enabled but never arriving (`<noscript>` doesn't apply); script animations outrank it. */
  animation: curtain-failsafe 600ms linear var(--curtain-failsafe, 6s) forwards;
}

@keyframes curtain-failsafe {
  to { transform: translateY(-101%); }
}

.curtain__label {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  overflow: visible;
}

.curtain__label text {
  fill: var(--curtain-label);
  font-family: var(--font-sans);
  font-weight: 500;
  letter-spacing: -0.015em;
  font-size: min(
    clamp(3rem, 11vw, 10rem),
    92vw / (var(--label-chars, 6) * 0.58)
  );
}

/* Arabic joins; negative tracking breaks the joins, same rule as the type scale. */
.curtain__label:lang(ar) text { letter-spacing: normal; }

/* Hidden in CSS, not only script, so the SSR cover never paints; useCurtain crossfades instead. */
@media (prefers-reduced-motion: reduce) {
  .curtain { display: none; }
}
</style>
