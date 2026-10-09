<script setup lang="ts">
import type { Project } from '~/types/portfolio'
import { isPlaceholderImage, isTodo } from '~/types/portfolio'

const props = defineProps<{ project: Project, index: number }>()
const hasRole = computed(() => !isTodo(props.project.role))
const localePath = useLocalePath()

// Latin digits in both locales on purpose, so item 03 matches item 03 across languages.
const ordinal = computed(() => String(props.index).padStart(2, '0'))
</script>

<template>
  <li class="row">
    <NuxtLink :to="localePath(`/projects/${project.slug}`)" class="row__link u-card">
      <span class="row__index" aria-hidden="true">{{ ordinal }}</span>

      <div
        class="row__media"
        :class="{ 'row__media--empty': !project.image || isPlaceholderImage(project.image) }"
      >
        <img
          v-if="project.image"
          :src="project.image"
          :alt="isPlaceholderImage(project.image) ? '' : $t('a11y.cover', { title: project.title })"
          :aria-hidden="isPlaceholderImage(project.image) ? 'true' : undefined"
          class="row__img"
        >
        <span v-else class="row__placeholder">{{ $t('todo.tag') }}</span>
      </div>

      <div class="row__body">
        <h2 class="text-h4 text-ink-strong">{{ project.title }}</h2>
        <p v-if="project.company" dir="auto" class="u-label text-ink-faint">{{ project.company }}</p>
      </div>

      <span v-if="hasRole" dir="auto" class="row__pill">{{ project.role }}</span>
      <ArrowBadge class="row__arrow" />
    </NuxtLink>
  </li>
</template>

<style scoped>
.row { display: block; }

.row__link {
  display: flex;
  align-items: center;
  gap: var(--spacing-gutter);
  padding: 1rem 1rem 1.5rem;
  border-radius: var(--radius-card-sm);
  transition: background-color var(--duration-base) var(--ease-out-soft);
}

.row__link:hover { background-color: var(--color-surface-hover); }

/* GSAP writes --row-focus and CSS maps it to opacity, so :hover still wins (a tweened opacity would outrank it).
   Defaults to 1 without JavaScript. */
.row__link {
  opacity: calc(var(--row-focus, 1));
  scale: calc(1 - (1 - var(--row-focus, 1)) * var(--row-recess, 0.06));
}

.row__link:hover,
.row__link:focus-visible {
  opacity: 1;
  scale: 1;
}

@media (prefers-reduced-motion: reduce) {
  .row__link { opacity: 1; scale: 1; }
}

.row__index {
  flex: 0 0 auto;
  min-width: 2.5ch;
  font-size: var(--text-label);
  font-variant-numeric: tabular-nums;
  letter-spacing: var(--text-label--letter-spacing);
  color: var(--color-ink-faint);
  transition: color var(--duration-base) var(--ease-out-soft);
}

.row__link:hover .row__index { color: var(--color-ink-strong); }

.row__media {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 5rem;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: var(--radius-tile);
  background-color: var(--color-surface-sunken);
}

.row__media--empty {
  border: 1px dashed var(--color-border-strong);
}

.row__img { width: 100%; height: 100%; object-fit: cover; }
.row__media--empty .row__img { object-fit: contain; padding: 14%; opacity: 0.6; }

.row__placeholder {
  font-size: var(--text-label);
  letter-spacing: var(--text-label--letter-spacing);
  color: var(--color-ink-muted);
}

.row__body {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 0;
  flex: 1 1 auto;
}

.row__pill {
  flex: 0 0 auto;
  padding: 0.375rem 0.875rem;
  border-radius: 50px;
  background-color: var(--color-border-subtle);
  color: var(--color-ink);
  font-size: var(--text-body-sm);
}

.row__arrow { flex: 0 0 auto; }

/* max-width lets a long role wrap; unbounded, it scrolled the page sideways on a phone. */
@media (width < 810px) {
  .row__link { flex-wrap: wrap; }
  .row__pill { order: 3; max-width: 100%; text-wrap: balance; }
}
</style>
