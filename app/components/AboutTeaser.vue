<script setup lang="ts">
const content = useContent()
const localePath = useLocalePath()
</script>

<template>
  <NuxtLink :to="localePath('/about')" class="teaser u-card">
    <h2 v-reveal.scramble class="u-label-lg text-ink-faint">{{ $t('sections.about') }}</h2>
    <p dir="auto" class="text-h3 text-ink">
      <TodoPlaceholder :value="content.profile.aboutTeaser" />
    </p>
    <ArrowBadge class="teaser__arrow" />
  </NuxtLink>
</template>

<style scoped>
.teaser {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  /* Room for the absolute arrow, so text never runs under it. */
  padding-bottom: 4.5rem;
  transition: background-color var(--duration-base) var(--ease-out-soft);
}

/* Invisible in light mode (both surfaces are white); deliberate. */
.teaser:hover { background-color: var(--color-surface-hover); }

.teaser__arrow {
  position: absolute;
  inset-inline-end: 1rem;
  bottom: 1rem;
}

@media (width >= 810px) {
  .teaser__arrow { inset-inline-end: 2rem; bottom: 1.5rem; }
}
</style>
