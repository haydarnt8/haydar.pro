<script setup lang="ts">
const motion = useContactMotion()
const headEl = ref<HTMLElement | null>(null)
const titleEl = ref<HTMLElement | null>(null)
const nameLayer = ref<HTMLElement | null>(null)
const nameEl = ref<HTMLElement | null>(null)
const naming = ref<string | null>(null)
/** Not cleared when the name leaves, so it rolls out with its words. */
const label = ref('')
const { swapTo } = useTextSwap(nameEl)

async function onName(next: string | null) {
  const was = naming.value
  if (next === was) return
  naming.value = next
  if (next && was) {
    const before = label.value
    label.value = next
    await nextTick()
    void swapTo(before)
    return
  }
  if (next) label.value = next
  await nextTick()
  // CSS has already swapped the layers (`data-head`); this is only the move.
  if (next) void motion.roll(headEl.value, titleEl.value, nameLayer.value, 1)
  else void motion.roll(headEl.value, nameLayer.value, titleEl.value, -1)
}
</script>

<template>
  <BaseCard as="section" flush class="stack">
    <div ref="headEl" class="stack__head" :data-head="naming ? 'name' : 'title'">
      <h2 ref="titleEl" v-reveal.lines class="text-h3 text-ink-strong stack__title" data-layer="title">{{ $t('sections.stack') }}</h2>
      <span ref="nameLayer" class="text-h3 text-ink-strong stack__name" data-layer="name" aria-hidden="true">
        <span class="stack__nameBox"><span ref="nameEl" class="stack__nameText">{{ label }}</span></span>
      </span>
    </div>
    <StackTower class="stack__tower" @name="onName" />
  </BaseCard>
</template>

<style scoped>
.stack {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  /* No bottom padding: the tower's own floor sits the blocks above the edge. */
  padding-top: 1.5rem;
}

.stack__title,
.stack__name {
  padding-inline: 1.5rem;
}

@media (width >= 810px) {
  .stack { padding-top: var(--card-pad, 2rem); }
  .stack__title,
  .stack__name { padding-inline: var(--card-pad, 2rem); }
}

/* `visibility`, not `display`: the hidden layer keeps its size, so the line never changes height. */
.stack__head { display: grid; }

.stack__head > * {
  grid-area: 1 / 1;
  min-width: 0;
  /* Never transitioned, even by the global reduced-motion rule: a visibility flip must not lag a frame. */
  transition-property: none;
}

.stack__head:not([data-head='name']) > [data-layer='name'] {
  visibility: hidden;
}

/* Opacity, not visibility: the heading stays in the accessibility tree while the aria-hidden name shows. */
.stack__head[data-head='name']:not(.is-rolling) > [data-layer='title'] {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .stack__head,
  .stack__head * {
    transition-property: none !important;
  }
}

.stack__head.is-rolling { clip-path: inset(0 -1rem); }

/* One line, always: a taller row would shrink the tower. One type step down so long names fit. */
.stack__name {
  white-space: nowrap;
  font-size: min(var(--text-h3), var(--text-h4));
  align-self: center;
}

/* Inside the layer's padding: useTextSwap places its copy at `inset: 0` of this box. */
.stack__nameBox {
  position: relative;
  display: grid;
  clip-path: inset(0 -1rem);
}

.stack__nameText { display: block; }
</style>
