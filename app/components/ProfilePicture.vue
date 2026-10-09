<script setup lang="ts">
import { parallax as P } from '~/config/motion'
import { isPlaceholderImage } from '~/types/portfolio'

const content = useContent()

// `fetchpriority="high"`: the portrait is the page's LCP element. `sizes` are the card's measured widths.
const zone = ref<HTMLElement | null>(null)
const layer = ref<HTMLElement | null>(null)
const { enter, move, leave } = usePointerParallax({ zone, layer, drift: P.portrait })
</script>

<template>
  <div
    ref="zone"
    class="avatar"
    @pointerenter="enter"
    @pointermove="move"
    @pointerleave="leave"
  >
    <span ref="layer" class="avatar__layer">
      <img
      v-if="content.profile.photo"
      :src="content.profile.photo"
      srcset="/portrait-360.webp 360w, /portrait-720.webp 720w"
      sizes="(min-width: 1200px) 268px, (min-width: 810px) 235px, 60vw"
      fetchpriority="high"
      decoding="async"
      :alt="isPlaceholderImage(content.profile.photo) ? '' : $t('a11y.portrait', { name: content.profile.name })"
      :aria-hidden="isPlaceholderImage(content.profile.photo) ? 'true' : undefined"
      class="avatar__img"
      :class="{ 'avatar__img--placeholder': isPlaceholderImage(content.profile.photo) }"
    >
      <span v-else class="avatar__empty">
        <span class="avatar__label">{{ $t('todo.tag') }}&nbsp;&middot;&nbsp;{{ $t('todo.noPhoto') }}</span>
      </span>
    </span>
  </div>
</template>

<style scoped>
.avatar {
  position: relative;
  aspect-ratio: 1;
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card-sm);
  background-color: var(--color-surface-raised);
}

@media (width >= 810px) {
  .avatar {
    border-radius: var(--radius-card);
    width: var(--layout-profile-size);
    flex-shrink: 0;
  }
}

/* Pinned bento: the square follows the row height (see HomeBento). */
@media (width >= 1200px) {
  .avatar {
    width: auto;
    height: 100%;
  }
}

.avatar__img,
.avatar__empty {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* Overscanned so the drift never exposes an edge. */
.avatar__layer {
  position: absolute;
  inset: calc(-1 * var(--parallax-overscan, 8px));
  display: block;
}

.avatar__img { object-fit: cover; }

.avatar__img--placeholder {
  object-fit: contain;
  padding: 22%;
  background-color: var(--color-surface-sunken);
  opacity: 0.55;
}

.avatar__empty {
  display: grid;
  place-items: center;
  border: 1px dashed var(--color-border-strong);
  border-radius: inherit;
}

.avatar__label {
  font-size: var(--text-label);
  letter-spacing: var(--text-label--letter-spacing);
  text-transform: uppercase;
  color: var(--color-ink-muted);
}

@media (hover: none) and (prefers-reduced-motion: no-preference) {
  .avatar { --parallax-overscan: 12px; }

  /* Named: `.avatar` clips, so an anonymous view() would measure against it. */
  @supports (animation-timeline: view()) {
    .avatar { view-timeline-name: --avatar-view; }

    .avatar__layer {
      animation: avatar-depth linear both;
      animation-timeline: --avatar-view;
    }
  }
}

@keyframes avatar-depth {
  from { translate: 0 -8px; }
  to { translate: 0 8px; }
}
</style>
