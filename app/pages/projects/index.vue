<script setup lang="ts">

const { t, locale } = useI18n()
const content = useContent()
// Getters: the locale can change after setup.
const description = () => t('meta.projectsDescription', { count: content.projects.length, name: content.profile.name })

useSeoMeta({
  title: () => pageTitle('projects', {}, t, langOf(locale.value)).title,
  description,
  ogTitle: () => pageTitle('projects', {}, t, langOf(locale.value)).title,
  ogDescription: description,
  ogType: 'website',
  twitterCard: 'summary_large_image',
})

// Not a getter: `zeroRuntime` rasterises OG images at build time, so only the prerendered value is read.
useOgCard(t('sections.projects'), content.profile.name)
const localePath = useLocalePath()
</script>

<template>
  <div class="shell u-radius-sm">
    <NoiseOverlay />
    <DecorativeFrame class="shell__frame" />
    <div class="wrapper">
      <div v-reveal class="wrapper__close">
        <CloseOverlayButton />
      </div>

      <header class="head">
        <h1 v-reveal.chars class="text-h1 text-ink-strong">{{ $t('sections.projects') }}</h1>
        <p v-reveal.lines class="text-body-lg text-ink-muted">
          {{ $t('projects.fromRoles', { count: content.projects.length }) }}
          <NuxtLink :to="localePath('/about')" class="head__link">{{ $t('projects.aboutLink') }}</NuxtLink>.
        </p>
      </header>

      <ul v-reveal="{ children: '.row', batch: true, focus: true }" class="list">
        <ProjectItem v-for="(p, i) in content.projects" :key="p.id" :project="p" :index="i + 1" />
      </ul>
    </div>
  </div>
</template>

<style scoped>
.shell {
  position: relative;
  min-height: 100vh;
  background-color: var(--color-surface);
}

.wrapper {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  width: 100%;
  max-width: var(--container-content);
  margin-inline: auto;
  /* 20px, not the 24 gutter, deliberately: the design's phone inset. */
  padding: 1.25rem;
}

.wrapper__close { display: flex; justify-content: center; }

.head { display: flex; flex-direction: column; gap: 0.5rem; }
.head__link { color: var(--color-ink-strong); text-decoration: underline; }

.list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-gutter);
}

@media (width >= 810px) {
  .wrapper { padding: 2rem; }
}

@media (width >= 1200px) {
  .wrapper { width: 75%; gap: 6rem; padding-block: 4rem; }
}
</style>
