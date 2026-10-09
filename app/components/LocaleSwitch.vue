<script setup lang="ts">
// A real link with no click handler: the curtain runs from the router, so Back out of /ar animates too.
// Its name is the target language in that language, with `lang` set so it is pronounced right.
const { locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()

const other = computed(() =>
  locales.value.filter(l => typeof l !== 'string').find(l => l.code !== locale.value),
)

</script>

<template>
  <NuxtLink
    v-if="other"
    :to="switchLocalePath(other.code)"
    class="lang"
    :lang="other.code"
    :aria-label="other.name ?? other.code"
    :title="other.name ?? other.code"
  >
    <Icon name="ph:globe-simple" class="lang__glyph" aria-hidden="true" />
  </NuxtLink>
</template>

<style scoped>
.lang {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-tile);
  background-color: var(--color-surface-raised);
  color: var(--color-ink);
  transition:
    color var(--duration-base) var(--ease-out-soft),
    border-color var(--duration-base) var(--ease-out-soft),
    background-color var(--duration-base) var(--ease-out-soft);
}

.lang:hover,
.lang:focus-visible {
  color: var(--color-ink-strong);
  border-color: var(--color-border-strong);
  background-color: var(--color-surface-hover);
}

.lang__glyph {
  width: 1.25rem;
  height: 1.25rem;
  transition: transform 700ms var(--ease-out-soft);
}

.lang:hover .lang__glyph,
.lang:focus-visible .lang__glyph {
  transform: rotate(360deg);
}

@media (prefers-reduced-motion: reduce) {
  .lang__glyph { transition: none; }
  .lang:hover .lang__glyph,
  .lang:focus-visible .lang__glyph { transform: none; }
}
</style>
