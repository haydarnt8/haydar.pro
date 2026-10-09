<script setup lang="ts">
const content = useContent()
const currentRoles = computed(() => content.experience.filter(e => e.period.end === null))
const { t } = useI18n()
const modeOf = (role: { employmentType?: string, arrangement?: string }) => [
  role.employmentType && t(`employment.${role.employmentType}`),
  role.arrangement && t(`arrangement.${role.arrangement}`),
].filter(Boolean).join(t('list.separator'))
</script>

<template>
  <BaseCard as="section" class="intro">
    <div class="intro__title">
      <h1 v-reveal.chars class="text-h1 text-ink-strong">{{ $t('sections.aboutHeading') }}</h1>
      <hr v-reveal.wipe class="intro__divider">
    </div>

    <section class="intro__section">
      <h2 v-reveal.scramble class="u-label text-ink-faint">{{ $t('sections.myStory') }}</h2>
      <p v-reveal.lines dir="auto" class="text-body-md text-ink-muted">{{ content.profile.summary }}</p>
    </section>

    <section class="intro__section">
      <h2 v-reveal.scramble class="u-label text-ink-faint">{{ $t('sections.whatIDoNow') }}</h2>
      <ul v-reveal="{ children: 'li' }" class="intro__roles">
        <li v-for="role in currentRoles" :key="role.id" dir="auto" class="text-body-md text-ink-muted">
          {{ role.company ? $t('roleAt', { role: role.role, company: role.company }) : role.role }}
          <span v-if="role.employmentType || role.arrangement" class="intro__mode">
            {{ modeOf(role) }}
          </span>
        </li>
      </ul>
    </section>
  </BaseCard>
</template>

<style scoped>
.intro {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.intro__title {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.intro__divider {
  height: 1px;
  border: 0;
  background-color: var(--color-border);
}

.intro__section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.intro__roles {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* Set off by a space, not a margin: when it wraps, a margin becomes an indent. */
.intro__mode {
  font-size: var(--text-body-sm);
  color: var(--color-ink-faint);
  white-space: nowrap;
}

.intro__mode::before { content: '('; }
.intro__mode::after { content: ')'; }
</style>
