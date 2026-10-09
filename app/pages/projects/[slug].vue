<script setup lang="ts">
import { isTodo } from '~/types/portfolio'

const route = useRoute()
const content = useContent()
const project = computed(() => content.projectBySlug(String(route.params.slug)))

if (!project.value) {
  throw createError({ statusCode: 404, statusMessage: 'Project not found', fatal: true })
}

const { t, locale } = useI18n()
const localePath = useLocalePath()
const p = computed(() => project.value!)

const meta = computed(() => [p.value.company, p.value.period && formatPeriod(p.value.period)].filter(Boolean).join(' · '))
const hasTech = computed(() => !!p.value.technical?.length)
const description = computed(() =>
  isTodo(p.value.summary)
    ? t('meta.projectDescription', { title: p.value.title, name: content.profile.name })
    : p.value.summary)

useSeoMeta({
  title: () => pageTitle('projects-slug', { slug: p.value.slug }, t, langOf(locale.value)).title,
  description,
  ogTitle: () => pageTitle('projects-slug', { slug: p.value.slug }, t, langOf(locale.value)).title,
  ogDescription: description,
  ogType: 'article',
  twitterCard: 'summary_large_image',
})

useOgCard(p.value.title, p.value.company ?? content.profile.name)
</script>

<template>
  <div class="shell u-radius-sm">
    <NoiseOverlay />
    <DecorativeFrame class="shell__frame" />
    <div class="wrapper" :class="{ 'wrapper--tour': p.tour?.length }">
      <div v-reveal class="wrapper__close">
        <CloseOverlayButton />
      </div>

      <ProjectTour v-if="p.tour?.length" :project="p" />

      <template v-else>
      <div class="title">
        <h1 v-reveal.chars class="text-h1 text-ink-strong">{{ p.title }}</h1>
        <p v-if="p.tagline" v-reveal.lines class="text-body-lg text-ink-muted">{{ p.tagline }}</p>
        <p
          v-if="meta"
          v-reveal.lines
          :class="p.tagline ? 'title__meta u-label text-ink-faint' : 'text-body-lg text-ink-muted'"
        >
          {{ meta }}
        </p>
      </div>

      <div class="detail" :class="{ 'detail--tech': hasTech }" data-project>
        <div v-reveal class="detail__gallery">
          <ProjectGallery :images="p.gallery" :title="p.title" :captions="p.captions" :notes="p.notes" />
        </div>

        <div v-reveal class="detail__panel">
          <div v-reveal="{ children: '> *' }" class="panel__top">
            <span class="panel__pill">
              <TodoPlaceholder :value="p.role" />
            </span>

            <p class="text-body-md text-ink-muted">
              <TodoPlaceholder :value="p.summary" />
            </p>

            <hr class="panel__divider">

            <ul v-if="p.highlights.length" class="panel__features">
              <li v-for="(h, i) in p.highlights" :key="i" class="text-body text-ink">{{ h }}</li>
            </ul>
            <p v-else class="text-body text-ink-faint">
              <TodoPlaceholder :value="$t('todo.listBuilt', { title: p.title })" />
            </p>
          </div>

          <div v-if="p.stack.length || p.links.length" class="panel__bottom">
            <ul v-if="p.stack.length" class="panel__stack" :aria-label="$t('project.stack')">
              <li v-for="s in p.stack" :key="s" dir="ltr" class="panel__chip">{{ s }}</li>
            </ul>
            <div v-if="p.links.length" class="panel__buttons">
              <BaseButton v-for="l in p.links" :key="l.href" :href="l.href" external>
                {{ l.label }}
              </BaseButton>
            </div>
          </div>
          <p v-else class="text-body-sm text-ink-faint">
            {{ $t('todo.tag') }}&nbsp;&middot;&nbsp;{{ $t('todo.noLinks') }}
          </p>
        </div>

        <section v-if="hasTech" v-reveal class="detail__tech">
          <h2 v-reveal.scramble class="u-label-lg text-ink-faint">{{ $t('project.technical') }}</h2>
          <ul v-reveal="{ children: 'li' }" class="tech__list">
            <li v-for="(h, i) in p.technical" :key="i" class="text-body text-ink">{{ h }}</li>
          </ul>
        </section>
      </div>

      </template>
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
  padding: 1.25rem;
}

.wrapper__close { display: flex; justify-content: center; }

.title { display: flex; flex-direction: column; }

.detail {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-gutter);
}

.detail__gallery {
  background-color: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card-sm);
  padding: 1rem;
  min-height: 0;
  /* Below L there is no row height; the shape stops a tall shot setting the height. */
  aspect-ratio: 4 / 3;
}

@media (width < 810px) {
  .detail__gallery { aspect-ratio: 1 / 1; }
}

.detail__panel {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 2.5rem;
  background-color: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card-sm);
  padding: 1.5rem;
}

.panel__top { display: flex; flex-direction: column; gap: 2rem; }

.panel__pill {
  align-self: flex-start;
  padding: 0.375rem 0.875rem;
  border-radius: 50px;
  background-color: var(--color-border-subtle);
  color: var(--color-ink);
  font-size: var(--text-body-sm);
}

.panel__divider {
  height: 1px;
  border: 0;
  background-color: var(--color-border-strong);
}

.panel__features { display: flex; flex-direction: column; gap: 0.5rem; }

.panel__buttons { display: flex; flex-direction: column; gap: 0.75rem; }
.panel__buttons :deep(.btn) { justify-content: center; }

.title__meta { margin-top: 0.75rem; }

.panel__bottom { display: flex; flex-direction: column; gap: 1.5rem; }

.panel__stack { display: flex; flex-wrap: wrap; gap: 0.375rem; }

.panel__chip {
  padding: 0.25rem 0.625rem;
  border-radius: 50px;
  background-color: var(--color-border-subtle);
  color: var(--color-ink-muted);
  font-size: var(--text-label);
  line-height: var(--text-label--line-height);
}

.detail__tech {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  background-color: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card-sm);
  padding: 1.5rem;
}

.tech__list { display: flex; flex-direction: column; gap: 0.625rem; }

@media (width >= 810px) {
  .wrapper { padding: 2rem; }
  .detail__panel { padding: 1.5rem; }
  .tech__list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem 2rem; }
}

@media (width >= 1200px) {
  .wrapper { width: 75%; gap: 6rem; padding-block: 4rem; }
  .wrapper--tour { width: min(92%, 1320px); max-width: 1320px; }

  .detail {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-auto-rows: minmax(0, 650px);
  }

  .detail__gallery { grid-column: span 2; aspect-ratio: auto; }

  /* The panel spans both rows, so long copy grows the page instead of spilling out. */
  .detail--tech {
    grid-template-rows: 650px auto;
    grid-auto-rows: auto;
  }

  .detail--tech .detail__gallery { grid-column: 1 / span 2; grid-row: 1; }
  .detail--tech .detail__panel { grid-column: 3; grid-row: 1 / span 2; }
  .detail--tech .detail__tech { grid-column: 1 / span 2; grid-row: 2; }
}
</style>
