<script setup lang="ts">
withDefaults(defineProps<{
  as?: string
  flush?: boolean
}>(), { as: 'div', flush: false })
</script>

<template>
  <component :is="as" class="u-card relative" :class="{ 'u-card--flush': flush }">
    <slot />
  </component>
</template>

<style scoped>
.u-card--flush {
  padding: 0;
}
</style>
