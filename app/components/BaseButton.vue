<script setup lang="ts">
withDefaults(defineProps<{
  href?: string
  external?: boolean
  showArrow?: boolean
  /** Defaults to `button` (a bare button in a form submits it); the contact form passes `submit`. */
  type?: 'button' | 'submit' | 'reset'
}>(), { showArrow: true, external: false, type: 'button' })
</script>

<template>
  <component
    :is="href ? (external ? 'a' : resolveComponent('NuxtLink')) : 'button'"
    :href="href && external ? href : undefined"
    :to="href && !external ? href : undefined"
    :type="href ? undefined : type"
    :target="external ? '_blank' : undefined"
    :rel="external ? 'noopener noreferrer' : undefined"
    class="btn"
  >
    <span><slot /></span>
    <Icon v-if="showArrow" name="ph:arrow-up-right-bold" class="btn__arrow u-rtl-mirror" aria-hidden="true" />
    <span v-if="external" class="sr-only">{{ $t('a11y.newTab') }}</span>
  </component>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: 2px solid var(--color-border-strong);
  border-radius: var(--radius-pill);
  background-color: var(--color-surface-raised);
  color: var(--color-ink-strong);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  letter-spacing: var(--text-body--letter-spacing);
  transition: background-color var(--duration-base) var(--ease-out-soft);
}

.btn:hover {
  background-color: var(--color-surface-sunken);
}

.btn__arrow {
  width: 1.125rem;
  height: 1.125rem;
  flex-shrink: 0;
}
</style>
