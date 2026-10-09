<script setup lang="ts">
import type { CaseDecision } from '~/types/portfolio'
import { tour as T } from '~/config/motion'

// The turned-away face is `inert`; focus follows the turn to the other face's button.
defineProps<{ decisions: CaseDecision[] }>()

const turned = ref<boolean[]>([])
/** True until the client knows the cards can turn: under Reduce Motion both faces show, so the server makes neither inert. */
const still = ref(true)
const root = ref<HTMLElement | null>(null)
let seen: IntersectionObserver | null = null
let dealt: { kill(): void } | null = null

async function turn(i: number, to: boolean) {
  turned.value[i] = to
  await nextTick()
  root.value?.querySelector<HTMLElement>(`[data-card="${i}"] [data-face="${to ? 'back' : 'front'}"] button`)?.focus()
}

onMounted(() => {
  still.value = prefersStillness()
  const el = root.value
  if (!el || still.value || el.getBoundingClientRect().top <= window.innerHeight) return
  const cards = Array.from(el.querySelectorAll<HTMLElement>('.dc__card'))
  el.setAttribute('data-armed', '')
  seen = new IntersectionObserver(async ([entry]) => {
    if (!entry?.isIntersecting) return
    seen?.disconnect()
    const m = await loadGsap()
    el.removeAttribute('data-armed')
    if (!m) return
    const row = el.getBoundingClientRect()
    const mid = row.left + row.width / 2
    const tl = m.gsap.timeline({ onComplete: () => m.gsap.set(cards, { clearProps: 'all' }) })
    cards.forEach((card, i) => {
      const box = card.getBoundingClientRect()
      tl.from(card, {
        x: mid - (box.left + box.width / 2),
        y: 60,
        rotate: (i - (cards.length - 1) / 2) * -6,
        opacity: 0,
        duration: T.deal.duration,
        ease: 'power3.out',
      }, i * T.deal.stagger)
    })
    dealt = tl
  }, { threshold: 0.3 })
  seen.observe(el)
})

onBeforeUnmount(() => {
  seen?.disconnect()
  dealt?.kill()
})
</script>

<template>
  <section ref="root" class="dc" :aria-label="$t('caseStudy.decisions')">
    <h2 v-reveal.scramble class="u-label-lg text-ink-faint dc__heading">{{ $t('caseStudy.decisions') }}</h2>
    <ol class="dc__row">
      <li
        v-for="(d, i) in decisions"
        :key="i"
        class="dc__card"
        :class="{ 'is-turned': turned[i] }"
        :data-card="i"
      >
        <div class="dc__inner">
          <div class="dc__face dc__front" data-face="front" :inert="(!still && turned[i]) || undefined">
            <span class="dc__index" aria-hidden="true">{{ String(i + 1).padStart(2, '0') }}</span>
            <h3 class="text-h4 text-ink-strong">{{ d.title }}</h3>
            <p class="text-body text-ink">{{ d.why }}</p>
            <button type="button" class="dc__turn" :aria-expanded="!!turned[i]" @click="turn(i, true)">
              <Icon name="ph:arrows-clockwise" aria-hidden="true" />
              {{ $t('tour.flip') }}
            </button>
          </div>
          <div class="dc__face dc__back" data-face="back" :inert="(!still && !turned[i]) || undefined">
            <span class="dc__index" aria-hidden="true">{{ String(i + 1).padStart(2, '0') }}</span>
            <p class="u-label dc__costLabel">{{ $t('caseStudy.tradeoff') }}</p>
            <p class="text-h4 text-ink-strong dc__cost">{{ d.tradeoff }}</p>
            <button type="button" class="dc__turn dc__turn--back" @click="turn(i, false)">
              <Icon name="ph:arrows-clockwise" aria-hidden="true" />
              {{ $t('tour.back') }}
            </button>
          </div>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.dc { display: flex; flex-direction: column; gap: 1rem; }
.dc__heading { padding-inline: 0.25rem; }

.dc__row {
  display: grid;
  gap: var(--spacing-gutter);
}

.dc__card { perspective: 1600px; }

/* Both faces share one grid cell, so a card never changes height when it turns. */
.dc__inner {
  display: grid;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.6s var(--ease-out-soft);
}

.dc__face {
  grid-area: 1 / 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card-sm);
  background-color: var(--color-surface-raised);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.dc__back {
  transform: rotateY(180deg);
  background-color: color-mix(in srgb, var(--color-lamp) 7%, var(--color-surface-raised));
  border-color: color-mix(in srgb, var(--color-lamp) 30%, var(--color-border));
}

.dc__card.is-turned .dc__inner { transform: rotateY(180deg); }
[dir='rtl'] .dc__card.is-turned .dc__inner,
[dir='rtl'] .dc__back { transform: rotateY(-180deg); }

.dc__index {
  font-size: var(--text-label);
  letter-spacing: var(--text-label--letter-spacing);
  font-variant-numeric: tabular-nums;
  color: var(--color-ink-faint);
}

.dc__costLabel { color: var(--color-ink-muted); }
.dc__cost { text-wrap: pretty; }

.dc__turn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  align-self: flex-start;
  margin-top: auto;
  padding: 0.5rem 0.875rem;
  border: 1px solid var(--color-border-strong);
  border-radius: 50px;
  background: transparent;
  color: var(--color-ink);
  font-size: var(--text-body-sm);
  cursor: pointer;
  transition: background-color var(--duration-base) var(--ease-out-soft);
}

.dc__turn:hover { background-color: var(--color-surface-hover); }

/* Hidden by script, never by the server. */
.dc[data-armed] .dc__card { opacity: 0; }

@media (width >= 810px) {
  .dc__face { padding: 2rem; }
}

@media (width >= 1200px) {
  .dc__row { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (prefers-reduced-motion: reduce) {
  .dc__inner { display: flex; flex-direction: column; transform: none !important; transition: none; }
  .dc__face { grid-area: auto; }
  .dc__front { border-end-start-radius: 0; border-end-end-radius: 0; border-bottom: 0; }
  .dc__back { transform: none !important; border-start-start-radius: 0; border-start-end-radius: 0; }
  .dc__turn { display: none; }
}
</style>
