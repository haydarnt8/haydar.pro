<script setup lang="ts">
import { snake as S } from '~/config/motion'

// Written by script per frame and carries no geometry of its own, so it can never shift layout.
const tail = [...S.layers].reverse()
const svg = ref<SVGSVGElement | null>(null)
const { live, rails } = useBorderSnake(svg)
</script>

<template>
  <svg
    ref="svg"
    class="snake"
    :class="{ 'is-live': live }"
    :style="{ '--snake-fade': `${S.fade}s` }"
    aria-hidden="true"
    focusable="false"
  >
    <!-- Joins: no stroke-width anywhere; the engine reads the card's own border weight.
         Outside .snake__run: a join is border, not ink, so it does not fade with the snake. -->
    <g
      v-for="rail in rails"
      :key="`${rail.i}-${rail.j}`"
      class="snake__join"
      :data-rung="`${rail.i}-${rail.j}`"
      :data-span="rail.len"
      :data-ax="rail.ax"
      :data-ay="rail.ay"
      :data-bx="rail.bx"
      :data-by="rail.by"
    >
      <path class="snake__hide" d="" />
      <path class="snake__lip" d="" />
      <path class="snake__lit" d="" stroke-opacity="0" />
    </g>

    <g class="snake__run">
      <path
        v-for="(layer, i) in tail"
        :key="i"
        class="snake__line"
        d=""
        :stroke-width="layer.width"
        :stroke-opacity="layer.opacity"
        :data-stretch="layer.stretch"
      />
    </g>
  </svg>
</template>

<style scoped>
.snake {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 3;
  pointer-events: none;
  overflow: visible;
}

.snake__run {
  opacity: 0;
  transition: opacity var(--snake-fade, 0.3s) var(--ease-out-soft);
}

.snake.is-live .snake__run { opacity: 1; }

.snake__line {
  fill: none;
  stroke: var(--color-ink-strong);
  stroke-linecap: round;
  stroke-linejoin: round;
}

.snake__hide { fill: var(--color-surface); }

.snake__lip {
  fill: none;
  stroke: var(--color-border);
  stroke-linecap: round;
  stroke-linejoin: round;
}

.snake__lit {
  fill: none;
  stroke: var(--color-ink-strong);
  stroke-linecap: round;
  stroke-linejoin: round;
}

@media (hover: none), (pointer: coarse) {
  .snake__line { stroke-width: 1.4; }
  .snake__line[data-stretch="1"] { stroke-width: 1.8; }
}

@media (prefers-reduced-motion: reduce) {
  .snake { display: none; }
}
</style>
