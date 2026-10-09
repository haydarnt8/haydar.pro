<script setup lang="ts">
import type { ShotNote } from '~/types/portfolio'
import { isPlaceholderImage } from '~/types/portfolio'

const props = defineProps<{
  images: string[]
  title: string
  captions?: string[]
  notes?: Record<string, ShotNote>
}>()
// An empty gallery still needs one slide, otherwise the card collapses.
const slides = computed(() => props.images.length ? props.images : [null])
const blurred = computed(() => props.images.some(item => !isPlaceholderImage(item)))

const { t } = useI18n()
const altFor = (item: string, index: number) =>
  isPlaceholderImage(item) ? '' : (props.captions?.[index] || t('a11y.galleryImage', { title: props.title, n: index + 1 }))

const noteFor = (item: string | null) =>
  item ? props.notes?.[item.slice(item.lastIndexOf('/') + 1).replace(/\.\w+$/, '')] : undefined
</script>

<template>
  <div class="gallery">
    <!-- The NDA note comes first in reading order, so screen readers hear it before the slides. -->
    <p v-if="blurred" class="gallery__note">
      <Icon name="ph:eye-slash" class="gallery__note-icon" aria-hidden="true" />
      <span>{{ $t('projects.ndaNote') }}</span>
    </p>
    <CardSlider :items="slides" :label="$t('slider.projectGallery', { title })" :show-arrows="slides.length > 1">
      <template #default="{ item, index, current }">
        <div class="gallery__frame">
          <img
            v-if="item"
            :src="item"
            :alt="altFor(item, index)"
            :aria-hidden="isPlaceholderImage(item) ? 'true' : undefined"
            :loading="index === 0 ? undefined : 'lazy'"
            decoding="async"
            class="gallery__img"
            :class="{ 'gallery__img--placeholder': isPlaceholderImage(item) }"
          >
          <div v-else class="gallery__empty">
            <span class="gallery__label">{{ $t('todo.tag') }}&nbsp;&middot;&nbsp;{{ $t('todo.noScreenshots') }}</span>
          </div>
          <GalleryInk v-if="noteFor(item)" :note="noteFor(item)!" :current="current" :seed="index" />
        </div>
      </template>
    </CardSlider>
  </div>
</template>

<style scoped>
.gallery__frame {
  position: relative;
  width: 100%;
  height: 100%;
  /* GalleryInk locates the contained picture with container units. */
  container-type: size;
}

.gallery { position: relative; height: 100%; min-height: 0; }

/* Raw colours on purpose: it sits on a screenshot, so it cannot follow the theme. */
.gallery__note {
  position: absolute;
  z-index: 2;
  top: 0.75rem;
  inset-inline-start: 0.75rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  max-width: calc(100% - 1.5rem);
  padding: 0.35rem 0.75rem;
  border: 1px solid rgb(255 255 255 / 0.2);
  border-radius: 999px;
  background: rgb(10 10 10 / 0.6);
  backdrop-filter: blur(8px);
  color: #fff;
  font-size: 0.75rem;
  line-height: 1.35;
  pointer-events: none;
}

.gallery__note-icon {
  flex: none;
  width: 0.95rem;
  height: 0.95rem;
}

.gallery > :deep(.slider) { height: 100%; }

.gallery__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background-color: var(--color-surface-sunken);
  border-radius: var(--radius-tile);
}

.gallery__img--placeholder {
  padding: 12%;
  opacity: 0.55;
}

.gallery__empty {
  display: grid;
  place-items: center;
  height: 100%;
  min-height: 14rem;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-tile);
  background-color: var(--color-surface-sunken);
}

.gallery__label {
  font-size: var(--text-label);
  letter-spacing: var(--text-label--letter-spacing);
  text-transform: uppercase;
  color: var(--color-ink-muted);
}
</style>
