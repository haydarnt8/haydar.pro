<template>
  <div class="noise" aria-hidden="true" />
</template>

<style scoped>
.noise {
  /* Under the content: every page's content sits in a z-index 2 wrapper. */
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.08;

  /* Tile from scripts/generate-noise.py; the size must stay in step with it. */
  background-image: url('/noise.png');
  background-size: 64px;
  background-repeat: repeat;
}
</style>
