<script setup lang="ts">
// The DOM order is already the mobile order; nothing is reordered.
</script>

<template>
  <div class="shell u-radius-sm">
    <NoiseOverlay />
    <DecorativeFrame class="shell__frame" />

    <div class="wrapper">
      <div v-reveal class="wrapper__close">
        <CloseOverlayButton />
      </div>

      <!-- One v-reveal per card: from 1200px both columns start at the same Y. -->
      <div class="content">
        <div class="col col--left">
          <AboutIntro v-reveal class="grow-2" />
          <ExperienceList v-reveal class="grow-1" />
        </div>

        <div class="col col--right">
          <ServicesSlider v-reveal class="grow-services" />
          <StackCard v-reveal class="grow-stack" />
          <div class="media">
            <GallerySlider v-reveal class="media__item" />
            <GetInTouchCard v-reveal class="media__item" />
          </div>
        </div>
      </div>
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

.wrapper__close {
  display: flex;
  justify-content: center;
}

.content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-gutter);
}

.col {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-gutter);
  min-width: 0;
}

.media {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-gutter);
  min-width: 0;
}

.media__item { min-width: 0; }

@media (width >= 810px) {
  .wrapper { padding: 2rem; }
  .media { flex-direction: row; }
  .media__item { flex: 1 1 0; }
}

@media (width >= 1200px) {
  .wrapper {
    width: 75%;
    gap: 6rem;
    padding-block: 4rem;
  }

  .content {
    flex-direction: row;
    /* min-height, not height: the real copy needs more than 850px and overflowed. */
    min-height: 850px;
  }

  /* No min-height: 0 (it let the text overflow); min-width: 0 stops wide children forcing the column open. */
  .col { flex: 1 1 0; min-width: 0; }

  .grow-2 { flex: 2 1 auto; }
  .grow-1 { flex: 1 1 auto; }
  .grow-services { flex: 1.1 1 auto; min-width: 0; }
  .grow-stack { flex: 0.88 1 auto; min-width: 0; }
  .media { flex: 1 1 auto; min-width: 0; }
}
</style>
