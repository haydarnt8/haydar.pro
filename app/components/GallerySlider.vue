<script setup lang="ts">
import { isPlaceholderImage, isTodo } from '~/types/portfolio'

const content = useContent()
</script>

<template>
  <div class="gallery">
    <CardSlider :items="content.gallery" :label="$t('slider.photoGallery')" show-arrows class="gallery__slider">
      <template #default="{ item, index }">
        <img
          v-if="item.src"
          :src="item.src"
          :alt="isTodo(item.alt) ? '' : item.alt"
          :loading="index === 0 ? undefined : 'lazy'"
          decoding="async"
          class="gallery__img"
          :class="{ 'gallery__img--placeholder': isPlaceholderImage(item.src) }"
          :style="item.focus ? { objectPosition: item.focus } : undefined"
        >
        <div v-else class="gallery__empty">
          <span class="gallery__label">{{ $t('todo.tag') }}&nbsp;&middot;&nbsp;{{ $t('todo.noImage') }}</span>
        </div>
      </template>
    </CardSlider>
  </div>
</template>

<style scoped>
.gallery {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card-sm);
  background-color: var(--color-surface-raised);
  background-image: url('/grain.png');
  background-size: 64px;
  padding: 1rem;
  min-height: 0;
}

.gallery__slider { height: 100%; }

.gallery__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--radius-tile);
}

.gallery__img--placeholder {
  object-fit: contain;
  padding: 22%;
  opacity: 0.55;
  background-color: var(--color-surface-sunken);
}

.gallery__empty {
  display: grid;
  place-items: center;
  height: 100%;
  min-height: 8rem;
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
