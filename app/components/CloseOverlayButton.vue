<!-- A real link to /, not history-back: the page may be opened directly. -->
<script setup lang="ts">
const localePath = useLocalePath()
</script>

<template>
  <NuxtLink :to="localePath('/')" class="close">
    <Icon name="ph:x" class="close__glyph" aria-hidden="true" />
    <span class="sr-only">{{ $t('a11y.closeOverlay') }}</span>
  </NuxtLink>
</template>

<style scoped>
.close {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border: 2px solid var(--color-border-strong);
  border-radius: 50%;
  background-color: var(--color-surface);
  color: var(--color-ink-strong);
  transition: background-color var(--duration-base) var(--ease-out-soft);
}

.close:hover { background-color: var(--color-surface-hover); }

.close__glyph { width: 1.25rem; height: 1.25rem; }
</style>
