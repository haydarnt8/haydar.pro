<script setup lang="ts">
import type { SocialLink } from '~/types/portfolio'
import { isTodo } from '~/types/portfolio'

const props = defineProps<{ link: SocialLink }>()

const pending = computed(() => isTodo(props.link.href) || Boolean(props.link.blocked))
const staysHere = computed(() => /^(mailto|tel):/.test(props.link.href))
</script>

<template>
  <li class="cell">
    <a
      v-if="!pending"
      :href="link.href"
      :target="staysHere ? undefined : '_blank'"
      :rel="staysHere ? undefined : 'noopener noreferrer'"
      class="icon"
      :style="{ '--brand': link.brandColor }"
    >
      <Icon :name="link.icon" class="icon__glyph" aria-hidden="true" />
      <span class="sr-only">{{ link.label }}</span>
      <InkLayer tone="brand" />
    </a>

    <span
      v-else
      class="icon icon--pending"
      :title="link.blocked ?? $t('a11y.linkNotSupplied', { label: link.label })"
    >
      <Icon :name="link.icon" class="icon__glyph" aria-hidden="true" />
      <span class="sr-only">{{ $t('a11y.linkNotAvailable', { label: link.label }) }}</span>
    </span>
  </li>
</template>

<style scoped>
.cell { display: block; }

.icon {
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card-sm);
  background-color: var(--color-surface-raised);
  color: var(--color-ink);
  transition:
    background-color var(--duration-base) var(--ease-out-soft),
    color var(--duration-base) var(--ease-out-soft),
    border-color var(--duration-base) var(--ease-out-soft);
}

/* Fill where the ink has not bound (no script, or before it binds). */
a.icon:not(.u-ink-host):hover,
a.icon:not(.u-ink-host):focus-visible {
  background-color: var(--brand);
}

@media (prefers-reduced-motion: reduce) {
  a.icon:hover,
  a.icon:focus-visible { background-color: var(--brand); }
}

a.icon:hover,
a.icon:focus-visible {
  border-color: var(--brand);
  /* Deliberately not a token: the brand fill is the same in both themes. */
  color: #fff;
}

.icon--pending {
  border-style: dashed;
  color: var(--color-ink-faint);
  cursor: not-allowed;
}

.icon__glyph {
  position: relative;
  z-index: 1;
  width: 36%;
  height: 36%;
}
</style>
