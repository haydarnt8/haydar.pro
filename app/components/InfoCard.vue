<script setup lang="ts">
import { signature } from '~/assets/signature'
import { isTodo } from '~/types/portfolio'

const { t } = useI18n()
const content = useContent()
const wrap = ref<HTMLElement | null>(null)
const name = ref<HTMLElement | null>(null)
const sig = ref<SVGSVGElement | null>(null)
const signed = computed(() => t('hero.greeting', { name: content.profile.name }).includes(signature.text))
const { armed } = useSignedName({ heading: name, svg: sig, wrap })

// Split into lines only real copy: SplitText lays the inline-flex TODO box's lines side by side.
const taglineWritten = computed(() => !isTodo(content.profile.tagline))
</script>

<template>
  <BaseCard as="section" class="info">
    <LocaleSwitch class="info__langs" />

    <div class="info__content">
      <div ref="wrap" class="info__name">
        <!-- `data-intro-name`: where the intro lands the name. -->
        <h1 ref="name" v-reveal.chars data-intro-name class="text-h1 text-ink">
          {{ $t('hero.greeting', { name: content.profile.name }) }}
        </h1>
        <svg
          v-if="signed && armed"
          ref="sig"
          class="info__sig"
          :viewBox="signature.viewBox"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <path v-for="letter in signature.letters" :key="letter.index" :d="letter.d" />
        </svg>
      </div>
      <p v-if="taglineWritten" v-reveal.lines dir="auto" class="text-body-lg text-ink-faint">
        <TodoPlaceholder :value="content.profile.tagline" />
      </p>
      <p v-else v-reveal dir="auto" class="text-body-lg text-ink-faint">
        <TodoPlaceholder :value="content.profile.tagline" />
      </p>
      <!-- After the tagline in DOM (Tab) order; the stylesheet places it in the corner. -->
      <a
        class="info__cv"
        href="/Haydar-Yosef-CV.pdf"
        target="_blank"
        rel="noopener"
        :aria-label="`${$t('hero.cvName')} ${$t('a11y.newTab')}`"
      >
        {{ $t('hero.cv') }}
        <Icon name="ph:arrow-up-right-bold" class="info__cvGlyph u-rtl-mirror" aria-hidden="true" />
      </a>
    </div>
  </BaseCard>
</template>

<style scoped>
.info__langs {
  position: absolute;
  top: 0.875rem;
  inset-inline-end: 0.875rem;
  z-index: 1;
}

.info {
  display: flex;
  align-items: center;
}

.info__content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-gutter);
  width: 92%;
}

.info__name { position: relative; }

.info__cv {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  align-self: flex-start;
  height: 2.5rem;
  padding-inline: 0.875rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-tile);
  background-color: var(--color-surface-raised);
  color: var(--color-ink);
  font-size: var(--text-body-sm);
  line-height: 1;
  transition:
    color var(--duration-base) var(--ease-out-soft),
    border-color var(--duration-base) var(--ease-out-soft),
    background-color var(--duration-base) var(--ease-out-soft);
}

.info__cv:hover,
.info__cv:focus-visible {
  color: var(--color-ink-strong);
  border-color: var(--color-border-strong);
  background-color: var(--color-surface-hover);
}

.info__cvGlyph {
  width: 0.875rem;
  height: 0.875rem;
}

@media (width >= 810px) {
  .info__cv {
    position: absolute;
    z-index: 1;
    top: 0.875rem;
    inset-inline-end: calc(0.875rem + 2.5rem + 0.5rem);
  }
}

/* `visibility`, never `display: none`, and no `vector-effect`: DrawSVG cannot measure paths under either. */
.info__sig {
  position: absolute;
  overflow: visible;
  pointer-events: none;
  visibility: hidden;
  opacity: 0;
  color: var(--color-ink);
  fill: currentColor;
  stroke: currentColor;
  stroke-width: 10;
  stroke-linecap: round;
  stroke-linejoin: round;
  paint-order: stroke fill;
}
</style>
