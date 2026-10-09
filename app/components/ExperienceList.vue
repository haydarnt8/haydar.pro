<script setup lang="ts">
const content = useContent()
const roles = computed(() => [...content.experience].sort(byRecency))
</script>

<template>
  <BaseCard as="section" class="exp">
    <h2 v-reveal.scramble class="u-label-lg text-ink-faint">{{ $t('sections.experience') }}</h2>

    <ol v-reveal="{ children: '.exp__item', wipe: '.exp__rule' }" class="exp__list">
      <li v-for="role in roles" :key="role.id" class="exp__item">
        <span dir="auto" class="text-body-md text-ink-strong exp__role">
          {{ role.company ? $t('roleAt', { role: role.role, company: role.company }) : role.role }}
        </span>
        <span class="exp__rule" aria-hidden="true" />
        <time class="text-body-md text-ink-muted exp__date" :datetime="periodDateTime(role.period)">
          {{ formatPeriod(role.period, { presentLabel: $t('period.current') }) }}
        </time>
      </li>
    </ol>
  </BaseCard>
</template>

<style scoped>
.exp {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 2rem;
}

.exp__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.exp__item {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.exp__rule { display: none; }

.exp__date { color: var(--color-ink-faint); }

@media (width >= 810px) {
  .exp__item {
    flex-direction: row;
    align-items: center;
    gap: 1.5rem;
  }

  /* Must shrink and wrap, or a long company name overflows the card. */
  .exp__role {
    flex: 0 1 auto;
    min-width: 0;
  }

  .exp__rule {
    display: block;
    flex: 1 1 1.5rem;
    min-width: 1.5rem;
    height: 1px;
    background-color: var(--color-border-strong);
  }

  .exp__date {
    flex: 0 0 auto;
    white-space: nowrap;
    color: var(--color-ink-muted);
  }
}
</style>
