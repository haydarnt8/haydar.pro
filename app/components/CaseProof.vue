<script setup lang="ts">
import type { CaseEvidence, CaseFlowStep } from '~/types/portfolio'
import { caseStudy as M } from '~/config/motion'

// Each part plays once, only if it was below the fold at load. The server renders the finished state and script
// only hides what it is about to play, so a GSAP chunk that never arrives hands it straight back.
const props = defineProps<{ evidence: CaseEvidence[], flow?: CaseFlowStep[] }>()

const format = (n: number) => n.toLocaleString('en-US')

const root = ref<HTMLElement | null>(null)
const killers: Array<() => void> = []
let seen: IntersectionObserver | null = null

const unseen = (el: Element) => el.getBoundingClientRect().top > window.innerHeight

function release(part: HTMLElement) {
  part.removeAttribute('data-armed')
  for (const n of part.querySelectorAll<HTMLElement>('[data-count]')) n.textContent = n.dataset.final ?? n.textContent
}

async function playNumbers(part: HTMLElement) {
  const m = await loadGsap()
  if (!m) return release(part)
  const { gsap } = m
  const nums = Array.from(part.querySelectorAll<HTMLElement>('[data-count]'))
  part.removeAttribute('data-armed')
  nums.forEach((el, i) => {
    const to = Number(el.dataset.count)
    const box = { v: 0 }
    const t = gsap.to(box, {
      v: to,
      duration: M.count,
      delay: i * M.countStagger,
      ease: 'power2.out',
      onUpdate: () => { el.textContent = format(Math.round(box.v)) },
      onComplete: () => { el.textContent = el.dataset.final ?? format(to) },
    })
    killers.push(() => t.progress(1).kill())
  })
}

async function playFlow(part: HTMLElement) {
  const m = await loadGsap()
  if (!m) return release(part)
  const draw = await loadPlugin('DrawSVGPlugin')
  const { gsap } = m
  const steps = Array.from(part.querySelectorAll<HTMLElement>('.cs__step'))
  const tl = gsap.timeline({ onComplete: () => gsap.set(steps, { clearProps: 'opacity,transform' }) })
  gsap.set(steps, { opacity: 0, y: 14 })
  part.removeAttribute('data-armed')
  steps.forEach((step) => {
    tl.to(step, { opacity: 1, y: 0, duration: M.step, ease: 'power3.out' })
    const lines = step.querySelectorAll<SVGPathElement>('.cs__link path')
    if (!lines.length) return
    if (draw) {
      tl.fromTo(lines[0]!, { drawSVG: '0%' }, { drawSVG: '100%', duration: M.draw, ease: 'power1.inOut' }, '-=0.1')
      if (lines[1]) tl.fromTo(lines[1], { drawSVG: '50% 50%' }, { drawSVG: '0% 100%', duration: M.draw * 0.6, ease: 'power2.out' })
    }
    else {
      tl.fromTo(lines, { opacity: 0 }, { opacity: 1, duration: M.draw }, '-=0.1')
    }
  })
  killers.push(() => tl.progress(1).kill())
}

onMounted(() => {
  const el = root.value
  if (!el || prefersStillness()) return
  const parts = Array.from(el.querySelectorAll<HTMLElement>('[data-play]')).filter(unseen)
  if (!parts.length) return
  for (const part of parts) {
    part.setAttribute('data-armed', '')
    for (const n of part.querySelectorAll<HTMLElement>('[data-count]')) n.textContent = '0'
  }
  seen = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      const part = entry.target as HTMLElement
      seen?.unobserve(part)
      if (part.dataset.play === 'numbers') void playNumbers(part)
      else void playFlow(part)
    }
  }, { threshold: M.inView })
  for (const part of parts) seen.observe(part)
})

onBeforeUnmount(() => {
  seen?.disconnect()
  for (const kill of killers) kill()
})
</script>

<template>
  <section ref="root" class="cs">
    <div class="cs__row cs__row--proof">
      <div v-reveal class="cs__card cs__evidence" data-play="numbers">
        <h2 v-reveal.scramble class="u-label-lg text-ink-faint">{{ $t('caseStudy.evidence') }}</h2>
        <dl class="cs__stats">
          <div v-for="(e, i) in props.evidence" :key="i" class="cs__stat">
            <dt class="cs__statLabel text-body-sm text-ink">{{ e.label }}</dt>
            <dd class="cs__statValue">
              <!-- The visible number counts; the reader hears it once, whole. -->
              <span class="sr-only">{{ format(e.value) }}{{ e.suffix }}</span>
              <span aria-hidden="true" class="text-ink-strong">
                <span :data-count="e.value" :data-final="format(e.value)">{{ format(e.value) }}</span>{{ e.suffix }}
              </span>
            </dd>
            <dd class="cs__statSource u-label text-ink-faint">{{ $t('caseStudy.source', { source: e.source }) }}</dd>
          </div>
        </dl>
      </div>

      <div v-if="props.flow?.length" v-reveal class="cs__card cs__flowCard">
        <h2 v-reveal.scramble class="u-label-lg text-ink-faint">{{ $t('caseStudy.flow') }}</h2>
        <ol class="cs__flow" data-play="flow">
          <li
            v-for="(s, i) in props.flow"
            :key="i"
            class="cs__step"
            :class="{ 'cs__step--external': s.external }"
          >
            <div class="cs__node">
              <p class="cs__nodeTitle text-body text-ink-strong">
                {{ s.title }}
                <span v-if="s.external" class="cs__tag u-label">{{ $t('caseStudy.external') }}</span>
              </p>
              <p class="text-body-sm text-ink-muted">{{ s.detail }}</p>
            </div>
            <svg
              v-if="i < props.flow.length - 1"
              class="cs__link"
              viewBox="0 0 12 32"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M6 1 V29" />
              <path d="M1.5 24.5 L6 29 L10.5 24.5" />
            </svg>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cs {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-gutter);
}

.cs__row {
  display: grid;
  gap: var(--spacing-gutter);
}

.cs__card {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  background-color: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card-sm);
  padding: 1.5rem;
}

.cs__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.5rem 1.25rem;
}

.cs__stat {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

/* Label first in the markup so the definition list pairs them for a screen reader; the value shows first. */
.cs__statValue { order: -1; }
.cs__statValue [aria-hidden] {
  font-size: clamp(2.25rem, 5vw, 3.25rem);
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

/* Not uppercased: a source is often a file name. */
.cs__statSource {
  text-transform: none;
  letter-spacing: normal;
}

.cs__flow {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.cs__step {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cs__node {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 100%;
  padding: 0.875rem 1rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-tile);
  background-color: var(--color-surface-sunken);
  text-align: center;
}

.cs__step--external .cs__node {
  border-style: dashed;
  background-color: transparent;
}

.cs__nodeTitle {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
}

.cs__tag {
  padding: 0.125rem 0.5rem;
  border-radius: 50px;
  background-color: var(--color-border-subtle);
  color: var(--color-ink-muted);
}

.cs__link {
  width: 0.75rem;
  height: 2rem;
  overflow: visible;
}

.cs__link path {
  fill: none;
  stroke: var(--color-ink-faint);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

/* Hidden by script, never by the server. */
.cs__flow[data-armed] .cs__step { opacity: 0; }

@media (width >= 810px) {
  .cs__card { padding: 2rem; }
  .cs__stats { gap: 2rem 1.5rem; }
}

@media (width >= 1200px) {
  .cs__stats { grid-template-columns: repeat(4, minmax(0, 1fr)); }

  .cs__flow { flex-direction: row; gap: 2rem; }
  .cs__step { position: relative; flex: 1 1 0; min-width: 0; }
  .cs__node { height: 100%; justify-content: center; }
  .cs__link {
    position: absolute;
    top: 50%;
    inset-inline-end: -1.375rem;
    translate: 0 -50%;
    rotate: -90deg;
  }
  [dir='rtl'] .cs__link { rotate: 90deg; }
}
</style>
