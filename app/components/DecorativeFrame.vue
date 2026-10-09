<script setup lang="ts">
// An SVG rect, not a CSS border, so the intro can draw it.
</script>

<template>
  <!-- Mirrored in Arabic so the intro's stroke starts top-right, at the reading start. -->
  <svg
    class="frame u-rtl-mirror"
    aria-hidden="true"
    focusable="false"
    preserveAspectRatio="none"
  >
    <!-- Plain percentages: WebKit rejects calc() in SVG attributes. -->
    <rect
      class="frame__line"
      x="0"
      y="0"
      width="100%"
      height="100%"
      rx="40"
      ry="40"
    />
  </svg>
</template>

<style scoped>
.frame {
  position: absolute;
  /* Sized explicitly: an <svg> is replaced and would fall back to 300x150.
     The extra 1px lets the rect be a plain 100% with its 2px stroke inside. */
  top: calc(var(--layout-frame-inset) + 1px);
  left: calc(var(--layout-frame-inset) + 1px);
  width: calc(100% - 2 * var(--layout-frame-inset) - 2px);
  height: calc(100% - 2 * var(--layout-frame-inset) - 2px);
  z-index: 1;
  pointer-events: none;
  overflow: visible;
}

.frame__line {
  fill: none;
  stroke: var(--color-border);
  stroke-width: 2;
  /* As CSS so the corner follows the token; the rx/ry attributes are the fallback. */
  rx: var(--radius-frame);
  ry: var(--radius-frame);
  vector-effect: non-scaling-stroke;
}
</style>
