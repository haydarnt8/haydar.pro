<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const status = computed(() => props.error?.statusCode ?? 404)
const { t } = useI18n()

useSeoMeta({
  // A getter: a language switch changes the locale after setup, mid-navigation.
  title: () => t(status.value === 404 ? 'meta.notFoundTitle' : 'meta.errorTitle', { status: status.value }),
  robots: 'noindex',
})

// A fatal error replaces app.vue as the root, taking its lang/dir head entries with it.
const localeHead = useLocaleHead()
useHead(() => ({ htmlAttrs: localeHead.value.htmlAttrs }))
const localePath = useLocalePath()

// The curtain mounts here too: a fatal error unmounts app.vue's mid-transition, and this one resumes from its useState.
const { isBlocking } = useCurtain()
</script>

<template>
  <main id="stage" :inert="isBlocking">
    <div class="shell">
      <NoiseOverlay />
      <div class="wrapper">
        <div class="card">
          <img src="/portrait/avatar.webp" alt="" aria-hidden="true" width="256" height="256" decoding="async" class="portrait">
          <div class="card__content">
            <p v-reveal.chars class="code">{{ status }}</p>
            <p class="text-body-lg text-ink-muted">
              <template v-if="status === 404">
                {{ $t('error.notFound') }}
              </template>
              <template v-else>
                {{ $t('error.generic') }}
              </template>
            </p>
          </div>
          <BaseButton :href="localePath('/')" :show-arrow="false" @click="clearError({ redirect: localePath('/') })">
            {{ $t('error.home') }}
          </BaseButton>
        </div>
      </div>
    </div>
  </main>

  <TheCurtain />
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
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 1.5rem;
}

.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  width: 100%;
  max-width: 34rem;
  padding: 2rem 2.25rem 3rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background-color: var(--color-surface-raised);
  text-align: center;
}

.portrait {
  width: 8rem;
  height: 8rem;
  margin-top: -6rem; /* the card's 2rem padding, then half the badge */
  margin-bottom: -1rem;
  border-radius: 50%;
  border: 4px solid var(--color-surface-raised);
  box-shadow: 0 0 0 1px var(--color-border);
  pointer-events: none;
  user-select: none;
}

.wrapper { padding-top: 5.5rem; }

.card__content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.code {
  font-size: clamp(5rem, 18vw, 9rem);
  font-weight: 500;
  line-height: 1.1;
  letter-spacing: -0.04em;
  color: var(--color-ink-strong);
}
</style>
