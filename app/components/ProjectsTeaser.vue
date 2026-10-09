<script setup lang="ts">
import type { Project } from '~/types/portfolio'
import { deck as D, media as MQ } from '~/config/motion'
import { isPlaceholderImage } from '~/types/portfolio'

const content = useContent()

// CSS owns the deck's geometry: `--open` (0 to 1) moves each card from pile to hand; it is all GSAP writes, and it is cleared.
const localePath = useLocalePath()

const TILTS = [-3, 4, -6, 2, 7, -2, 5, -5]

const thumbOf = (p: Project) =>
  p.image && !isPlaceholderImage(p.image) ? p.image.replace(/cover\.webp$/, 'thumb.webp') : null

const cards = computed(() => content.projects.flatMap((p, i) => {
  const src = thumbOf(p)
  return src ? [{ id: p.id, src, tilt: TILTS[i % TILTS.length]! }] : []
}))

const root = ref<{ $el: HTMLElement } | null>(null)
type Gsap = NonNullable<ReturnType<typeof gsapModules>>['gsap']
let dealt: ReturnType<Gsap['timeline']> | null = null
let open = false

const host = () => root.value?.$el as HTMLElement | undefined

/** The number in the heading, wherever the line split has put it. */
function setCount(gsap: Gsap, n: number) {
  const el = host()?.querySelector<HTMLElement>('.teaser__count')
  if (!el) return
  el.textContent = String(n)
  gsap.fromTo(el, { yPercent: 45, opacity: 0.25 }, {
    yPercent: 0, opacity: 1, duration: D.tick, ease: 'power2.out', overwrite: true, clearProps: 'transform,opacity',
  })
}

async function deal() {
  if (open || prefersStillness()) return
  open = true
  const m = await loadGsap()
  const el = host()
  if (!m || !el || !open) return
  const { gsap } = m
  const pile = Array.from(el.querySelectorAll<HTMLElement>('.deck__card'))
  dealt?.kill()
  dealt = gsap.timeline()
  pile.forEach((card, i) => {
    dealt!.to(card, { '--open': 1, duration: D.open, ease: 'power3.out' }, i * D.deal)
      .call(() => setCount(gsap, i + 1), undefined, i * D.deal)
  })
}

async function gather() {
  if (!open) return
  open = false
  const m = await loadGsap()
  const el = host()
  if (!m || !el || open) return
  const { gsap } = m
  const pile = Array.from(el.querySelectorAll<HTMLElement>('.deck__card'))
  dealt?.kill()
  dealt = gsap.timeline({
    onComplete: () => { gsap.set(pile, { clearProps: '--open' }) },
  })
  dealt.to(pile, { '--open': 0, duration: D.close, ease: 'power2.inOut', stagger: { each: D.deal / 2, from: 'end' } })
  // However the count was interrupted, it ends on the truth.
  setCount(gsap, content.projects.length)
}

const fine = () => window.matchMedia(MQ.fine).matches

function onEnter(event: PointerEvent) {
  if (event.pointerType !== 'touch' && fine()) void deal()
}

function onLeave(event: PointerEvent) {
  if (event.pointerType !== 'touch' && fine()) void gather()
}

function onFocus(event: FocusEvent) {
  if ((event.target as HTMLElement | null)?.matches?.(':focus-visible')) void deal()
}

function onBlur() {
  if (!host()?.matches(':hover')) void gather()
}

let seen: IntersectionObserver | null = null
let holding: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  if (fine() || prefersStillness()) return
  const el = host()
  if (!el) return
  seen = new IntersectionObserver(([entry]) => {
    if (!entry?.isIntersecting) return
    seen?.disconnect()
    seen = null
    void deal()
    holding = setTimeout(() => void gather(), (D.hold + cards.value.length * D.deal + D.open) * 1000)
  }, { threshold: 0.75 })
  seen.observe(el)
})

onBeforeUnmount(() => {
  seen?.disconnect()
  if (holding) clearTimeout(holding)
  dealt?.kill()
})
</script>

<template>
  <NuxtLink
    ref="root"
    :to="localePath('/projects')"
    class="teaser u-card"
    @pointerenter="onEnter"
    @pointerleave="onLeave"
    @focus="onFocus"
    @blur="onBlur"
  >
    <h2 v-reveal.scramble class="u-label-lg text-ink-faint">{{ $t('sections.projects') }}</h2>
    <i18n-t v-reveal.lines keypath="projects.all" tag="p" scope="global" class="text-h3 text-ink-strong">
      <template #count>
        <span class="teaser__count">{{ content.projects.length }}</span>
      </template>
    </i18n-t>

    <span class="deck" aria-hidden="true">
      <img
        v-for="(card, i) in cards"
        :key="card.id"
        :src="card.src"
        alt=""
        width="192"
        height="144"
        loading="lazy"
        decoding="async"
        class="deck__card"
        :style="{ '--i': i, '--n': cards.length, '--tilt': `${card.tilt}deg` }"
      >
    </span>

    <ArrowBadge class="teaser__arrow" />
  </NuxtLink>
</template>

<style scoped>
.teaser {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1rem;
  min-height: 0;
  /* Reserve the band the arrow and the deck share, so text never runs under either. */
  padding-bottom: 4.5rem;
  transition: background-color var(--duration-base) var(--ease-out-soft);
}

.teaser:hover { background-color: var(--color-surface-hover); }

/* Its own box, so a count can tick without moving the words beside it. */
.teaser__count {
  display: inline-block;
  font-variant-numeric: tabular-nums;
}

.teaser__arrow {
  position: absolute;
  inset-inline-end: 1.5rem;
  bottom: 1.5rem;
}

.deck {
  --card-w: 3.5rem;
  position: absolute;
  inset-inline-start: 1.75rem;
  bottom: 1.5rem;
  width: var(--card-w);
  aspect-ratio: 4 / 3;
  pointer-events: none;
}

.deck__card {
  --open: 0;
  /* In the order dealt, from the reading start: Arabic deals from the right. */
  --angle: calc((var(--i) - (var(--n) - 1) / 2) * 8.5deg * var(--dir, 1));

  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 5px;
  border: 1px solid rgb(255 255 255 / 0.18);
  box-shadow: 0 2px 6px rgb(0 0 0 / 0.35);
  z-index: calc(var(--n) - var(--i));
  transform-origin: 50% 260%;
  rotate: calc(var(--tilt) * (1 - var(--open)) + var(--angle) * var(--open));
  translate: calc(var(--open) * 2.6rem) calc(var(--open) * -0.4rem);
}

[dir='rtl'] .deck__card {
  --dir: -1;
  translate: calc(var(--open) * -2.6rem) calc(var(--open) * -0.4rem);
}

@media (width >= 810px) {
  .teaser__arrow { inset-inline-end: 2rem; bottom: 1.5rem; }
  .deck { inset-inline-start: 2.25rem; }
}
</style>
