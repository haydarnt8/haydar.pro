<script setup lang="ts">
import type { Project, ShotNote } from '~/types/portfolio'
import { tour as T } from '~/config/motion'
import { quadMatrix } from '~/utils/quad'
import { isPlaceholderImage } from '~/types/portfolio'

// A written-up project as a guided tour: from 1200px a sticky screen beside the scrolling steps,
// below it each step carries its own shot. State the tests can trust: the zoom is `--p`, the
// shown screen is a class; nothing is ever left with an inline transform or opacity.
const props = defineProps<{ project: Project }>()
const p = computed(() => props.project)

const content = useContent()
const localePath = useLocalePath()
const { t, locale } = useI18n()
const rtl = computed(() => langOf(locale.value) === 'ar')

const fileOf = (name: string) => p.value.gallery.find(src => src.slice(src.lastIndexOf('/') + 1).replace(/\.\w+$/, '') === name)
const captionOf = (name: string) => {
  const i = p.value.gallery.findIndex(src => src.slice(src.lastIndexOf('/') + 1).replace(/\.\w+$/, '') === name)
  return i >= 0 ? (p.value.captions?.[i] ?? '') : ''
}

interface Step {
  src: string
  alt: string
  note?: ShotNote
  title: string
  body: string
  how?: string
  brief: boolean
  constraints: string[]
  phone?: { src: string, alt: string, breakpoint: number }
}

const steps = computed<Step[]>(() => (p.value.tour ?? []).flatMap((s) => {
  const src = fileOf(s.shot)
  if (!src) return []
  const brief = !!s.brief
  const phoneSrc = s.phone ? fileOf(s.phone) : undefined
  return [{
    src,
    alt: captionOf(s.shot),
    note: s.phone ? undefined : p.value.notes?.[s.shot],
    title: brief ? t(p.value.caseStudy ? 'caseStudy.problem' : 'tour.overview') : (s.title ?? ''),
    body: brief ? (p.value.caseStudy?.problem ?? p.value.summary) : (s.phone ? captionOf(s.phone) : captionOf(s.shot)),
    how: s.tech !== undefined ? p.value.technical?.[s.tech] : undefined,
    brief,
    constraints: brief ? (p.value.caseStudy?.constraints ?? []) : [],
    phone: phoneSrc ? { src: phoneSrc, alt: captionOf(s.phone!), breakpoint: s.breakpoint ?? 960 } : undefined,
  }]
}))

const pad = (n: number) => String(n).padStart(2, '0')
const meta = computed(() => [p.value.company, p.value.period && formatPeriod(p.value.period)].filter(Boolean).join(' · '))

const screen = computed(() => (p.value.image && !isPlaceholderImage(p.value.image) ? p.value.screen : undefined))
const GLASS = 720
const glassStyle = computed(() => {
  const s = screen.value
  if (!s) return undefined
  const h = Math.round(GLASS / s.aspect)
  return { 'width': `${GLASS}px`, 'height': `${h}px`, '--quad': quadMatrix(GLASS, h, s.corners) }
})
const coverBox = ref<HTMLElement | null>(null)
const coverK = ref(0)
const page = ref(0)
let cycling: ReturnType<typeof setInterval> | null = null

const root = ref<HTMLElement | null>(null)
const frame = ref<HTMLElement | null>(null)
const spacer = ref<HTMLElement | null>(null)
/** The step being read; -1 while the camera is still moving into the screen. */
const active = ref(0)
const seen = ref<boolean[]>([])
/** The zoom, 0 at the cover to 1 inside the screen. */
const zoom = ref(1)
const zoomVars = reactive({ zx: 0, zy: 0, zk: 1, ox: 0, oy: 0 })
const desk = ref(false)
const moving = ref(false)

const tourStyle = computed(() => ({
  '--p': Math.round(zoom.value * 1000) / 1000,
  '--zx': `${zoomVars.zx}px`,
  '--zy': `${zoomVars.zy}px`,
  '--zk': zoomVars.zk,
  '--zox': `${zoomVars.ox}px`,
  '--zoy': `${zoomVars.oy}px`,
}))

function measureZoom() {
  const s = screen.value
  const el = frame.value
  if (!s || !el) return
  const fw = el.clientWidth
  const fh = el.clientHeight
  if (!fw || !fh) return
  const [cw, ch] = s.size
  const c0 = Math.max(fw / cw, fh / ch)
  const ox = (fw - cw * c0) / 2
  const oy = (fh - ch * c0) / 2
  const xs = s.corners.map(([x]) => x)
  const ys = s.corners.map(([, y]) => y)
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  const sc = [ox + c0 * (x0 + x1) / 2, oy + c0 * (y0 + y1) / 2] as const
  const shot = Math.min(fw / 1600, fh / 1000) * 1600
  zoomVars.zk = Math.round((shot / (c0 * (x1 - x0))) * 1000) / 1000
  zoomVars.ox = Math.round(sc[0])
  zoomVars.oy = Math.round(sc[1])
  zoomVars.zx = Math.round(fw / 2 - sc[0])
  zoomVars.zy = Math.round(fh / 2 - sc[1])
}

function measureCover() {
  const s = screen.value
  const el = coverBox.value
  if (!s || !el?.clientWidth) return
  coverK.value = Math.round((el.clientWidth / s.size[0]) * 10000) / 10000
}

let ticking = false
function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => {
    ticking = false
    const el = spacer.value
    if (!el) return
    const r = el.getBoundingClientRect()
    const run = Math.max(1, r.height - window.innerHeight * 0.5)
    zoom.value = Math.min(1, Math.max(0, -r.top / run))
  })
}

const rope = ref<SVGSVGElement | null>(null)
const ropeD = ref('')
let roping: { kill(): void } | null = null

/** The ring's outer point on the steps' side, in viewport coordinates. */
function ringPoint(i: number): [number, number] | null {
  const step = steps.value[i]
  const layer = frame.value?.querySelectorAll<HTMLElement>('.stage__layer')[i]
  if (!step || !layer) return null
  if (step.phone) {
    const h = layer.querySelector('.rz__handle')?.getBoundingClientRect()
    return h ? [rtl.value ? h.left - 4 : h.right + 4, h.top + h.height / 2] : null
  }
  if (!step.note) return null
  const f = layer.getBoundingClientRect()
  const [W, H] = step.note.size
  const k = Math.min(f.width / W, f.height / H)
  const ix = f.left + (f.width - W * k) / 2
  const iy = f.top + (f.height - H * k) / 2
  const [x, y, w, h] = step.note.ring
  return [ix + (rtl.value ? x - 8 : x + w + 8) * k, iy + (y + h / 2) * k]
}

async function throwRope(i: number) {
  roping?.kill()
  for (const path of rope.value?.querySelectorAll('path') ?? []) path.removeAttribute('style')
  ropeD.value = ''
  if (!desk.value || prefersStillness() || i < 0) return
  const from = root.value?.querySelector<HTMLElement>(`[data-step="${i}"] .step__title`)?.getBoundingClientRect()
  const to = ringPoint(i)
  if (!from || !to) return
  const sx = rtl.value ? from.right + 10 : from.left - 10
  const sy = from.top + Math.min(from.height / 2, 22)
  const dir = rtl.value ? 1 : -1
  ropeD.value = `M${sx} ${sy} C${sx + dir * 70} ${sy}, ${to[0] - dir * 120} ${to[1]}, ${to[0]} ${to[1]}`
  await nextTick()
  const m = await loadGsap()
  const draw = await loadPlugin('DrawSVGPlugin')
  const paths = rope.value?.querySelectorAll('path')
  if (!m || !draw || !paths?.length || active.value !== i) return
  const { gsap } = m
  // GSAP keeps a transform-origin on an SVG element even after clearProps, so the attribute goes too.
  const done = () => { gsap.set(paths, { clearProps: 'all' }); for (const path of paths) path.removeAttribute('style'); ropeD.value = '' }
  const tl = gsap.timeline({ onComplete: done })
  tl.fromTo(paths, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: T.rope.draw, ease: 'power2.inOut' })
    .to(paths, { drawSVG: '100% 100%', duration: T.rope.fade, ease: 'power2.in' }, `+=${T.rope.hold}`)
  roping = tl
}

watch(active, i => void throwRope(i))

let watchSteps: IntersectionObserver | null = null
let watchShots: IntersectionObserver | null = null
let resized: ResizeObserver | null = null
let wide: MediaQueryList | null = null

function setDesk() {
  desk.value = !!wide?.matches
  moving.value = desk.value && !prefersStillness() && !!screen.value
  if (moving.value) { measureZoom(); onScroll() }
  else zoom.value = 1
}

function goTo(i: number) {
  root.value?.querySelector<HTMLElement>(`[data-step="${i}"]`)?.scrollIntoView({ behavior: prefersStillness() ? 'auto' : 'smooth', block: 'center' })
}

onMounted(() => {
  const el = root.value
  if (!el) return
  wide = window.matchMedia('(width >= 1200px)')
  wide.addEventListener('change', setDesk)
  setDesk()

  resized = new ResizeObserver(() => { measureZoom(); measureCover() })
  if (frame.value) resized.observe(frame.value)
  if (coverBox.value) resized.observe(coverBox.value)
  measureCover()

  // The step crossing the middle of the screen is the one being read.
  watchSteps = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue
      const i = Number((e.target as HTMLElement).dataset.step)
      active.value = Number.isNaN(i) ? -1 : i
    }
  }, { rootMargin: '-50% 0px -50% 0px' })
  for (const s of el.querySelectorAll('[data-step]')) watchSteps.observe(s)
  if (spacer.value) watchSteps.observe(spacer.value)

  watchShots = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) seen.value[Number((e.target as HTMLElement).dataset.shot)] = true
    }
  }, { threshold: 0.5 })
  for (const s of el.querySelectorAll('[data-shot]')) watchShots.observe(s)

  window.addEventListener('scroll', onScroll, { passive: true })

  if (screen.value && !prefersStillness()) {
    cycling = setInterval(() => {
      if (document.hidden) return
      page.value = (page.value + 1) % (screen.value?.shots.length ?? 1)
    }, 2600)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  wide?.removeEventListener('change', setDesk)
  watchSteps?.disconnect()
  watchShots?.disconnect()
  resized?.disconnect()
  roping?.kill()
  if (cycling) clearInterval(cycling)
})

const next = computed(() => {
  const list = content.projects
  const i = list.findIndex(x => x.slug === p.value.slug)
  return list.length > 1 ? list[(i + 1) % list.length] : undefined
})
const nextThumb = computed(() => {
  const img = next.value?.image
  return img && !isPlaceholderImage(img) ? img.replace(/cover\.webp$/, 'thumb.webp') : null
})
</script>

<template>
  <div class="tour-page" data-project>
    <header class="op">
      <div class="op__copy">
        <p v-if="meta" v-reveal.lines class="u-label text-ink-faint">{{ meta }}</p>
        <h1 v-reveal.chars class="text-h1 text-ink-strong op__title">{{ p.title }}</h1>
        <p v-if="p.tagline" v-reveal.lines class="text-body-lg text-ink-muted">{{ p.tagline }}</p>
        <span v-reveal class="op__pill">{{ p.role }}</span>
        <p v-if="screen" class="op__hint u-label text-ink-faint" aria-hidden="true">
          <span class="op__mouse" />{{ $t('tour.inside') }}
        </p>
      </div>
      <!-- The scale lives on the screen layer: v-reveal clears this element's inline style when it lands. -->
      <div v-if="p.image" ref="coverBox" v-reveal class="op__cover">
        <img :src="p.image" :alt="$t('a11y.cover', { title: p.title })" class="op__img" decoding="async">
        <span v-if="screen && coverK" class="op__screen" :style="{ '--screen-mask': `url('${screen.mask}')`, '--k': coverK }" aria-hidden="true">
          <span class="op__glass" :style="glassStyle">
            <img
              v-for="(shot, i) in screen.shots"
              :key="shot"
              :src="shot"
              alt=""
              decoding="async"
              loading="lazy"
              class="op__page"
              :class="{ 'is-on': i === page }"
            >
          </span>
        </span>
      </div>
    </header>

    <section
      ref="root"
      class="tour"
      :class="{ 'tour--moving': moving, 'tour--cover': !!screen }"
      :style="tourStyle"
      :aria-label="$t('tour.steps')"
    >
      <!-- The screen is for the eye; only the two-layouts slider stays in the accessibility tree. -->
      <div class="tour__stage">
        <div ref="frame" class="stage__frame">
          <p v-if="steps.length" class="tour__nda tour__nda--glass" aria-hidden="true">
            <Icon name="ph:eye-slash" class="tour__ndaIcon" />
            <span>{{ $t('projects.ndaNote') }}</span>
          </p>
          <div v-if="screen" class="stage__cover" :class="{ 'is-on': moving && zoom < 1 }" aria-hidden="true">
            <img :src="p.image!" alt="" class="stage__coverImg" decoding="async">
          </div>
          <div
            v-for="(s, i) in steps"
            :key="i"
            class="stage__layer"
            :class="{ 'is-on': active === i || (active < 0 && i === 0), 'is-first': i === 0 }"
            :aria-hidden="s.phone ? undefined : 'true'"
          >
            <TourResize
              v-if="s.phone"
              :desktop="s.src"
              :phone="s.phone.src"
              :desktop-alt="s.alt"
              :phone-alt="s.phone.alt"
              :breakpoint="s.phone.breakpoint"
              :active="desk && active === i"
            />
            <template v-else>
              <img :src="s.src" alt="" class="stage__shot" :loading="i === 0 ? undefined : 'lazy'" decoding="async">
              <GalleryInk v-if="s.note" :note="s.note" :current="desk && active === i" :seed="i" />
            </template>
          </div>
        </div>
        <ol class="stage__thumbs" aria-hidden="true">
          <li v-for="(s, i) in steps" :key="i">
            <button
              type="button"
              class="stage__thumb"
              :class="{ 'is-on': active === i }"
              tabindex="-1"
              :aria-label="$t('tour.goTo', { n: i + 1, title: s.title })"
              @click="goTo(i)"
            >
              <img :src="s.src" alt="" loading="lazy" decoding="async">
            </button>
          </li>
        </ol>
      </div>

      <div class="tour__steps">
        <div ref="spacer" class="tour__inside" aria-hidden="true" />
        <!-- Shown below 1200px; on the desk it is visually hidden but still read. -->
        <p v-if="steps.length" class="tour__nda tour__nda--line">
          <Icon name="ph:eye-slash" class="tour__ndaIcon" aria-hidden="true" />
          <span>{{ $t('projects.ndaNote') }}</span>
        </p>
        <article v-for="(s, i) in steps" :key="i" class="step" :data-step="i">
          <div class="step__frame" :data-shot="i">
            <TourResize
              v-if="s.phone"
              :desktop="s.src"
              :phone="s.phone.src"
              :desktop-alt="s.alt"
              :phone-alt="s.phone.alt"
              :breakpoint="s.phone.breakpoint"
              :active="!desk && !!seen[i]"
            />
            <template v-else>
              <img :src="s.src" :alt="s.alt" class="stage__shot" loading="lazy" decoding="async">
              <GalleryInk v-if="s.note" :note="s.note" :current="!desk && !!seen[i]" :seed="i" />
            </template>
          </div>
          <p class="step__n" dir="ltr" :aria-label="$t('tour.step', { n: i + 1, total: steps.length })">
            {{ pad(i + 1) }} / {{ pad(steps.length) }}
          </p>
          <p class="u-label text-ink-faint">{{ s.brief ? $t(p.caseStudy ? 'caseStudy.label' : 'tour.overviewLabel') : $t('tour.does') }}</p>
          <h2 class="step__title text-h3 text-ink-strong">{{ s.title }}</h2>
          <p class="text-body-lg text-ink step__body">{{ s.body }}</p>
          <div v-if="s.constraints.length" class="step__how">
            <p class="u-label text-ink-faint">{{ $t('caseStudy.constraints') }}</p>
            <ul class="step__constraints">
              <li v-for="(c, j) in s.constraints" :key="j" class="text-body text-ink-muted">{{ c }}</li>
            </ul>
          </div>
          <div v-else-if="s.how" class="step__how">
            <p class="u-label text-ink-faint">{{ $t('project.technical') }}</p>
            <p class="text-body text-ink-muted">{{ s.how }}</p>
            <p v-if="s.phone" class="text-body-sm step__try">{{ $t('tour.resize.hint') }}</p>
          </div>
        </article>
      </div>

      <svg ref="rope" class="tour__rope" aria-hidden="true" focusable="false">
        <path class="tour__ropeGlow" :d="ropeD" />
        <path class="tour__ropeLine" :d="ropeD" />
      </svg>
    </section>

    <DecisionCards v-if="p.caseStudy?.decisions.length" :decisions="p.caseStudy.decisions" />

    <CaseProof v-if="p.caseStudy" :evidence="p.caseStudy.evidence" :flow="p.caseStudy.flow" />

    <footer class="end">
      <div v-if="p.stack.length" v-reveal class="end__card end__stack">
        <h2 class="u-label-lg text-ink-faint">{{ $t('project.stack') }}</h2>
        <ul class="end__chips">
          <li v-for="s in p.stack" :key="s" dir="ltr" class="end__chip">{{ s }}</li>
        </ul>
      </div>
      <NuxtLink v-if="next" v-reveal :to="localePath(`/projects/${next.slug}`)" class="end__card end__next">
        <span class="u-label-lg text-ink-faint">{{ $t('tour.next') }}</span>
        <span class="end__nextRow">
          <img v-if="nextThumb" :src="nextThumb" alt="" class="end__thumb" loading="lazy" decoding="async">
          <span class="text-h4 text-ink-strong">{{ next.title }}</span>
          <ArrowBadge class="end__arrow" />
        </span>
      </NuxtLink>
    </footer>
  </div>
</template>

<style scoped>
.tour-page {
  display: flex;
  flex-direction: column;
  gap: 3rem;
}

.op {
  display: grid;
  gap: 2rem;
  align-items: center;
}

.op__copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.25rem;
}

.op__title { text-wrap: balance; }

.op__pill {
  padding: 0.375rem 0.875rem;
  border-radius: 50px;
  background-color: var(--color-border-subtle);
  color: var(--color-ink);
  font-size: var(--text-body-sm);
}

.op__hint {
  display: none;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.op__mouse {
  position: relative;
  width: 1.125rem;
  height: 1.75rem;
  border: 1.5px solid var(--color-border-strong);
  border-radius: 0.6rem;
}

.op__mouse::after {
  content: '';
  position: absolute;
  top: 0.3rem;
  left: 50%;
  width: 2px;
  height: 0.4rem;
  margin-left: -1px;
  border-radius: 1px;
  background: var(--color-ink-faint);
}

.op__cover {
  position: relative;
  overflow: hidden;
  aspect-ratio: 4 / 3;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card-sm);
  background-color: var(--color-surface-sunken);
}

.op__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* The cover's own size (1600x1200), scaled to the box: the same layer as WorkCard's live screen. */
.op__screen {
  position: absolute;
  top: 0;
  left: 0;
  width: 1600px;
  height: 1200px;
  transform-origin: 0 0;
  scale: var(--k);
  -webkit-mask-image: var(--screen-mask);
  mask-image: var(--screen-mask);
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  pointer-events: none;
}

.op__glass {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  transform: var(--quad);
}

.op__page {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
  opacity: 0;
  transition: opacity 0.8s var(--ease-out-soft);
}

.op__page.is-on { opacity: 1; }

.tour { position: relative; }

.tour__stage { display: none; }

.tour__steps {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.tour__inside { display: none; }

.tour__nda {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  line-height: 1.35;
}

.tour__nda--line { color: var(--color-ink-muted); }
.tour__nda--glass { display: none; }

.tour__ndaIcon {
  flex: none;
  width: 0.95rem;
  height: 0.95rem;
}

.step {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.step__frame {
  position: relative;
  aspect-ratio: 16 / 10;
  margin-bottom: 0.5rem;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card-sm);
  background-color: var(--color-surface-sunken);
  container-type: size;
}

.step__n {
  font-size: var(--text-label);
  letter-spacing: var(--text-label--letter-spacing);
  font-variant-numeric: tabular-nums;
  color: var(--color-ink-faint);
}

.step__title { text-wrap: balance; }
.step__body { text-wrap: pretty; }

.step__how {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border-strong);
}

.step__constraints {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.step__constraints li {
  padding-inline-start: 0.875rem;
  border-inline-start: 2px solid var(--color-border-strong);
}

.step__try { color: var(--color-lamp); }

.stage__shot {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.tour__rope { display: none; }

.end {
  display: grid;
  gap: var(--spacing-gutter);
}

.end__card {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card-sm);
  background-color: var(--color-surface-raised);
}

.end__chips { display: flex; flex-wrap: wrap; gap: 0.375rem; }

.end__chip {
  padding: 0.25rem 0.625rem;
  border-radius: 50px;
  background-color: var(--color-border-subtle);
  color: var(--color-ink-muted);
  font-size: var(--text-label);
  line-height: var(--text-label--line-height);
}

.end__next { transition: background-color var(--duration-base) var(--ease-out-soft); }
.end__next:hover { background-color: var(--color-surface-hover); }

.end__nextRow {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.end__thumb {
  width: 5rem;
  aspect-ratio: 4 / 3;
  border-radius: 0.5rem;
  object-fit: cover;
}

.end__arrow { margin-inline-start: auto; flex: none; }

@media (width >= 810px) {
  .end__card { padding: 2rem; }
  .end { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
}

@media (width >= 1200px) {
  .tour-page { gap: 6rem; }

  .op {
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
    min-height: calc(100vh - 12rem);
  }

  .op__hint { display: flex; }

  /* Display size on purpose, not the 32px section heading. */
  .op__title {
    font-size: clamp(2.5rem, 4.2vw, 4rem);
    line-height: 1.05;
    letter-spacing: -0.035em;
  }

  .tour {
    display: grid;
    grid-template-columns: minmax(0, 7fr) minmax(0, 4fr);
    gap: 4rem;
  }

  /* The frame is capped at 100vh - 15rem so the whole sticky card fits at any desktop height. */
  .tour__stage {
    position: sticky;
    top: 4rem;
    align-self: start;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    padding: 1rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card-sm);
    background-color: var(--color-surface-raised);
  }

  .stage__frame {
    position: relative;
    width: min(100%, (100vh - 15rem) * 1.6);
    margin-inline: auto;
    aspect-ratio: 16 / 10;
    overflow: hidden;
    border-radius: var(--radius-tile);
    background-color: var(--color-surface-sunken);
  }

  .stage__layer {
    position: absolute;
    inset: 0;
    opacity: 0;
    visibility: hidden;
    container-type: size;
    transition: opacity 0.45s var(--ease-out-soft), visibility 0s linear 0.45s;
  }

  .stage__layer.is-on {
    opacity: 1;
    visibility: visible;
    transition: opacity 0.45s var(--ease-out-soft), visibility 0s;
  }

  /* Fixed dark glass over the screenshot in both themes, as on the gallery. */
  .tour__nda--glass {
    position: absolute;
    z-index: 4;
    top: 0.75rem;
    inset-inline-start: 0.75rem;
    display: inline-flex;
    max-width: calc(100% - 1.5rem);
    padding: 0.35rem 0.75rem;
    border: 1px solid rgb(255 255 255 / 0.2);
    border-radius: 999px;
    background: rgb(10 10 10 / 0.6);
    backdrop-filter: blur(8px);
    color: #fff;
    pointer-events: none;
  }

  .tour__nda--line {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  /* The first shot fades in over the zoom's last quarter. */
  .tour--moving .stage__layer.is-first.is-on { opacity: clamp(0, (var(--p, 1) - 0.72) * 4, 1); transition: none; }

  .stage__cover {
    position: absolute;
    inset: 0;
    opacity: 0;
    visibility: hidden;
  }

  .stage__cover.is-on {
    opacity: clamp(0, (1 - var(--p, 1)) * 4, 1);
    visibility: visible;
  }

  .stage__coverImg {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform-origin: var(--zox) var(--zoy);
    transform:
      translate(calc(var(--p, 0) * var(--zx, 0px)), calc(var(--p, 0) * var(--zy, 0px)))
      scale(calc(1 + var(--p, 0) * (var(--zk, 1) - 1)));
  }

  .stage__thumbs {
    display: flex;
    gap: 0.5rem;
  }

  .stage__thumbs li { flex: 1 1 0; min-width: 0; }

  .stage__thumb {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 10;
    overflow: hidden;
    padding: 0;
    border: 1px solid var(--color-border-strong);
    border-radius: 0.5rem;
    background: var(--color-surface-sunken);
    opacity: 0.45;
    cursor: pointer;
    transition: opacity var(--duration-base) var(--ease-out-soft), border-color var(--duration-base) var(--ease-out-soft);
  }

  .stage__thumb img { width: 100%; height: 100%; object-fit: cover; }
  .stage__thumb:hover { opacity: 0.8; }
  .stage__thumb.is-on { opacity: 1; border-color: var(--color-lamp); }

  .step {
    min-height: 100vh;
    justify-content: center;
  }

  .step__frame { display: none; }

  /* The rope: one path in the viewport's own coordinates, over everything. */
  .tour__rope {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 5;
    width: 100vw;
    height: 100vh;
    overflow: visible;
    pointer-events: none;
    fill: none;
    stroke-linecap: round;
  }

  /* A dark edge under the light line, so the rope reads over a light screenshot. */
  .tour__ropeGlow {
    stroke: rgb(0 0 0 / 0.55);
    stroke-width: 4.5;
  }

  .tour__ropeLine {
    stroke: var(--color-ink-strong);
    stroke-width: 1.75;
  }

  .end { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
}

/* The zoom's room is in CSS, not added by script, so nothing shifts when the page wakes. */
@media (width >= 1200px) and (prefers-reduced-motion: no-preference) {
  .tour--cover .tour__inside { display: block; height: 120vh; }
}

@media (prefers-reduced-motion: reduce) {
  .op__page { transition: none; }
  .stage__layer, .stage__layer.is-on { transition: none; }
  .tour__rope { display: none; }
}
</style>
