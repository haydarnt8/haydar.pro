<script setup lang="ts">
import { isTodo } from '~/types/portfolio'

const props = defineProps<{ value: string }>()
const pending = computed(() => isTodo(props.value))
const label = computed(() => props.value.replace(/^TODO:\s*/, ''))
</script>

<template>
  <span v-if="!pending"><slot>{{ value }}</slot></span>
  <span v-else class="todo" :title="$t('todo.unwritten', { label })">
    <span class="todo__tag">{{ $t('todo.tag') }}</span>
    <span dir="auto" class="todo__text">{{ label }}</span>
  </span>
</template>

<style scoped>
.todo {
  display: inline-flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.125rem 0.5rem;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-tile);
  /* ink-muted, not ink-faint: faint fails AA on the --color-border-subtle pills this sits in. */
  color: var(--color-ink-muted);
}

.todo__tag {
  font-size: var(--text-label);
  letter-spacing: var(--text-label--letter-spacing);
  font-weight: var(--text-label--font-weight);
  text-transform: uppercase;
}

.todo__text {
  font-size: var(--text-body-sm);
}
</style>
