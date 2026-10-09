<template>
  <BaseCard as="section" class="touch">
    <h2 v-reveal.lines class="text-h3 text-ink-strong">{{ $t('sections.preferEmail') }}</h2>
    <EmailCopy />
  </BaseCard>
</template>

<style scoped>
.touch {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 1.5rem;
}
</style>
