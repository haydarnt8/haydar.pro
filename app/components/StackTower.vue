<script setup lang="ts">
import type { Block, Bounds, Point, Tower } from '~/composables/useTowerPhysics'
import { LANDED } from '~/composables/useReveal'
import { createTower, loadMatter } from '~/composables/useTowerPhysics'
import { media, tower as T } from '~/config/motion'
import { towerCourses } from '~/data/skills'

// CSS owns the tower at rest, so the server renders it finished; the physics only writes a transform
// relative to that place, and the rewind hands it back empty. Under reduced motion nothing is built or fetched.
const content = useContent()
const { locale } = useI18n()

/** `null` hands the line back to the heading. */
const emit = defineEmits<{ name: [label: string | null] }>()

const WIDE_COLS = Math.max(...towerCourses.map(course => course.length))
const NARROW_COLS = Math.max(...T.narrowCourses)

interface Placed {
  item: (typeof content.stack)[number]
  wide: Point
  narrow: Point
}

/** In course-widths from the reading start, and courses from the floor. */
const placed = computed(() => {
  const byId = new Map(content.stack.map(item => [item.id, item]))
  const loose = content.stack.map(item => item.id).filter(id => !towerCourses.some(course => course.includes(id)))
  const courses = loose.length ? [...towerCourses, loose] : towerCourses
  const order = courses.flat()

  const wide = new Map<string, Point>()
  courses.forEach((course, y) => {
    const offset = (WIDE_COLS - course.length) / 2
    course.forEach((id, i) => wide.set(id, { x: offset + i, y }))
  })

  const narrow = new Map<string, Point>()
  let k = 0
  for (let y = 0; k < order.length; y++) {
    const count = T.narrowCourses[y] ?? T.narrowCourses.at(-1)!
    const course = order.slice(k, k + count)
    const offset = (NARROW_COLS - course.length) / 2
    course.forEach((id, i) => narrow.set(id, { x: offset + i, y }))
    k += count
  }

  return order.flatMap((id): Placed[] => {
    const item = byId.get(id)
    return item ? [{ item, wide: wide.get(id)!, narrow: narrow.get(id)! }] : []
  })
})

const wideRows = computed(() => Math.max(...placed.value.map(b => b.wide.y)) + 1)
const narrowRows = computed(() => Math.max(...placed.value.map(b => b.narrow.y)) + 1)

const stage = ref<HTMLElement | null>(null)
const unbuilt = ref(false)
/** Settles once the tower is standing; the physics measures nothing before it. */
let building: Promise<void> | null = null
let watcher: MutationObserver | null = null
let failsafe: ReturnType<typeof setTimeout> | null = null

const blocksOf = (host: HTMLElement) => Array.from(host.querySelectorAll<HTMLElement>('.block'))

// Only when the heading still awaits its entrance; a tower already in view just stands (rebuilding it would flash).
function arm() {
  const host = stage.value
  if (!host || prefersStillness()) return
  const heading = host.closest('.u-card')?.querySelector<HTMLElement>('h2, h3')
  if (!heading || heading.hasAttribute(LANDED) || heading.style.opacity !== '0') return

  unbuilt.value = true
  let done!: () => void
  building = new Promise((resolve) => { done = resolve })

  const go = () => {
    watcher?.disconnect()
    watcher = null
    if (failsafe) clearTimeout(failsafe)
    failsafe = null
    void build().finally(done)
  }

  // The landing is the cue; the heading appearing only starts a failsafe, since the mirror sets headings down without landing.
  watcher = new MutationObserver(() => {
    if (heading.hasAttribute(LANDED)) go()
    else if (heading.style.opacity !== '0' && !failsafe) failsafe = setTimeout(go, T.build.failsafe * 1000)
  })
  watcher.observe(heading, { attributes: true, attributeFilter: [LANDED, 'style'] })
}

async function build() {
  const m = await loadGsap()
  const host = stage.value
  if (!m || !host) {
    unbuilt.value = false
    return
  }
  const { gsap } = m
  const els = blocksOf(host)
  const top = host.getBoundingClientRect().top
  const rects = els.map(el => el.getBoundingClientRect())
  const landed: number[] = []

  const tl = gsap.timeline({
    onComplete: () => { gsap.set(els, { clearProps: 'transform' }) },
  })

  rects.forEach((r, k) => {
    const height = r.bottom - top
    const fall = Math.sqrt((2 * height) / T.gravity)
    const under = rects.flatMap((q, j) =>
      j < k && Math.abs(q.top - r.bottom) < 1.5 && q.right > r.left + 1 && q.left < r.right - 1 ? [landed[j]!] : [])
    const start = Math.max(k * T.build.stagger, ...under.map(t => t + 0.02 - fall))
    landed[k] = start + fall

    const rebound = T.build.bounce * r.height
    tl.fromTo(els[k]!, { y: -height }, { y: 0, duration: fall, ease: 'power2.in', immediateRender: true }, start)
      .to(els[k]!, { y: -rebound, duration: T.build.bounceTime, ease: 'power2.out' }, start + fall)
      .to(els[k]!, { y: 0, duration: T.build.bounceTime, ease: 'power2.in' }, start + fall + T.build.bounceTime)
  })

  // Every block is parked above the stage by now; showing them shows nothing.
  unbuilt.value = false
  registerTimeline('tower', tl)
  await tl.then()
}

let tower: Tower | null = null
let creating: Promise<Tower | null> | null = null
let fine = false
let inside = false
let holding = false
let visible = false
let last: Point | null = null
let rewindTimer: ReturnType<typeof setTimeout> | null = null
let down: { x: number, y: number, t: number } | null = null

function measure(): { blocks: Block[], bounds: Bounds } | null {
  const host = stage.value
  if (!host) return null
  const box = host.getBoundingClientRect()
  const blocks = blocksOf(host).map((el) => {
    const r = el.getBoundingClientRect()
    return { el, size: r.width, rest: { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 } }
  })
  if (!blocks.length) return null
  const wall = Number.parseFloat(getComputedStyle(host).getPropertyValue('--wall')) || 0
  const floor = Math.max(...blocks.map(b => b.rest.y + b.size / 2))
  return { blocks, bounds: { left: wall, right: box.width - wall, top: 0, floor } }
}

function ensure(): Promise<Tower | null> {
  if (tower) return Promise.resolve(tower)
  creating ??= (async () => {
    await building
    const [M, m] = await Promise.all([loadMatter(), loadGsap()])
    if (!M || !m || prefersStillness() || tower) return tower
    const layout = measure()
    if (!layout) return null
    tower = createTower(M, { ...layout, gsap: m.gsap, carried: !fine, onSettle })
    return tower
  })().finally(() => { creating = null })
  return creating
}

function local(event: PointerEvent): Point {
  const box = stage.value!.getBoundingClientRect()
  return { x: event.clientX - box.left, y: event.clientY - box.top }
}

const pointing = (event: PointerEvent) => fine && event.pointerType !== 'touch'

function cancelRewind() {
  if (rewindTimer) clearTimeout(rewindTimer)
  rewindTimer = null
}

function rebuild(after: number) {
  cancelRewind()
  rewindTimer = setTimeout(() => {
    rewindTimer = null
    const t = tower
    if (!t || inside || holding) return
    void t.rewind().then(() => { if (inside && last) t.aim(last) })
  }, after * 1000)
}

function onSettle() {
  if (fine || !tower?.displaced()) return
  rebuild(T.touchRest)
}

// Not motion: naming also runs under reduced motion, where the line swaps instead of rolling.
let named: string | null = null
let pending: string | null = null
let dwellTimer: ReturnType<typeof setTimeout> | null = null
let holdTimer: ReturnType<typeof setTimeout> | null = null

const labelAt = (target: EventTarget | null) =>
  target instanceof Element ? target.closest<HTMLElement>('.block')?.dataset.label ?? null : null

function stopNaming() {
  if (dwellTimer) clearTimeout(dwellTimer)
  if (holdTimer) clearTimeout(holdTimer)
  dwellTimer = null
  holdTimer = null
  pending = null
}

function sayName(label: string | null) {
  stopNaming()
  if (label === named) return
  named = label
  emit('name', label)
}

function sayNameSoon(label: string) {
  if (label === named) {
    stopNaming()
    return
  }
  if (label === pending) return
  if (dwellTimer) clearTimeout(dwellTimer)
  pending = label
  dwellTimer = setTimeout(() => sayName(label), T.name.dwell * 1000)
}

function onEnter(event: PointerEvent) {
  if (!pointing(event) || prefersStillness()) return
  inside = true
  last = local(event)
  cancelRewind()
  void ensure().then((t) => { if (t && inside && last) t.aim(last) })
}

function onMove(event: PointerEvent) {
  if (!pointing(event)) return
  // The logo is `pointer-events: none`, so the target is the block itself.
  if (!holding) {
    const label = labelAt(event.target)
    if (label) sayNameSoon(label)
  }
  last = local(event)
  if (holding) tower?.drag(last)
  else if (inside) tower?.aim(last)
}

function onDown(event: PointerEvent) {
  if (!pointing(event)) {
    down = { x: event.clientX, y: event.clientY, t: performance.now() }
    return
  }
  if (!tower || event.button !== 0) return
  // Read before the capture below, which makes every later event the stage's.
  const label = labelAt(event.target)
  if (tower.grab(local(event))) {
    holding = true
    if (label) sayName(label)
    stage.value?.setPointerCapture(event.pointerId)
    event.preventDefault()
  }
}

function onUp(event: PointerEvent) {
  if (holding) {
    holding = false
    tower?.release()
    if (stage.value?.hasPointerCapture(event.pointerId)) stage.value.releasePointerCapture(event.pointerId)
    return
  }
  if (pointing(event) || !down) return
  const still = Math.hypot(event.clientX - down.x, event.clientY - down.y) < 10
  const quick = performance.now() - down.t < 400
  down = null
  if (!still || !quick) return
  // The pointerdown's target, since a touch is captured where it lands.
  const label = labelAt(event.target)
  if (label) {
    sayName(label)
    holdTimer = setTimeout(() => sayName(null), T.name.hold * 1000)
  }
  if (prefersStillness()) return
  const p = local(event)
  void ensure().then((t) => {
    if (!t) return
    cancelRewind()
    t.poke(p)
  })
}

function onLeave(event: PointerEvent) {
  if (!pointing(event) || holding) return
  sayName(null)
  inside = false
  tower?.lower()
  rebuild(T.rewind.delay)
}

// The first visible scroll builds the world, not the card entering view (that fetched the physics mid-swipe).
function onScroll() {
  if (!visible || fine || prefersStillness()) return
  if (tower) tower.wake()
  else void ensure()
}

function onApproach(event: PointerEvent) {
  if (pointing(event) && !prefersStillness()) void ensure()
}

function reset() {
  cancelRewind()
  holding = false
  sayName(null)
  tower?.destroy()
  tower = null
}

let resized: ReturnType<typeof setTimeout> | null = null
function onResize() {
  if (!tower) return
  if (resized) clearTimeout(resized)
  resized = setTimeout(reset, 120)
}

let sight: IntersectionObserver | null = null
let card: HTMLElement | null = null
let pointerQuery: MediaQueryList | null = null
const onPointerChange = () => {
  fine = pointerQuery?.matches ?? false
  reset()
}

watch(locale, reset)

onMounted(() => {
  pointerQuery = window.matchMedia(media.fine)
  fine = pointerQuery.matches
  pointerQuery.addEventListener('change', onPointerChange)

  // After the reveal engine has registered the heading, whichever mounted first.
  requestAnimationFrame(arm)

  card = stage.value?.closest<HTMLElement>('.u-card') ?? null
  card?.addEventListener('pointerenter', onApproach)

  sight = new IntersectionObserver(([entry]) => { visible = Boolean(entry?.isIntersecting) })
  if (stage.value) sight.observe(stage.value)

  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onResize, { passive: true })
})

onBeforeUnmount(() => {
  watcher?.disconnect()
  sight?.disconnect()
  card?.removeEventListener('pointerenter', onApproach)
  if (failsafe) clearTimeout(failsafe)
  if (resized) clearTimeout(resized)
  pointerQuery?.removeEventListener('change', onPointerChange)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onResize)
  reset()
})
</script>

<template>
  <div
    ref="stage"
    class="tower"
    :class="{ 'is-unbuilt': unbuilt }"
    data-cursor="push"
    :style="{
      '--wide-cols': WIDE_COLS,
      '--wide-rows': wideRows,
      '--narrow-cols': NARROW_COLS,
      '--narrow-rows': narrowRows,
    }"
    @pointerenter="onEnter"
    @pointermove="onMove"
    @pointerdown="onDown"
    @pointerup="onUp"
    @pointercancel="onUp"
    @pointerleave="onLeave"
  >
    <ul class="tower__blocks">
      <li
        v-for="block in placed"
        :key="block.item.id"
        class="block"
        :data-label="block.item.label"
        :style="{ '--wx': block.wide.x, '--wy': block.wide.y, '--nx': block.narrow.x, '--ny': block.narrow.y }"
      >
        <Icon :name="block.item.icon" class="block__logo" :style="block.item.color ? { color: block.item.color } : undefined" aria-hidden="true" />
        <span class="sr-only">{{ block.item.label }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.tower {
  /* Courses touch: a gap would be a fall the moment physics starts. */
  --g: 4px;
  /* Read by the physics. */
  --wall: 12px;
  --floor: 14px;
  --s-max: 44px;

  position: relative;
  container: tower / inline-size;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding-bottom: var(--floor);
  overflow: clip;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
}

.tower::after {
  content: '';
  position: absolute;
  inset-inline: var(--wall);
  bottom: calc(var(--floor) - 1px);
  height: 1px;
  background-color: var(--color-border);
  pointer-events: none;
}

.tower__blocks {
  --cols: var(--wide-cols);
  --rows: var(--wide-rows);
  --s: min(var(--s-max), calc((100cqw - 2 * var(--wall) - (var(--cols) - 1) * var(--g)) / var(--cols)));

  position: relative;
  flex: none;
  width: calc(var(--cols) * var(--s) + (var(--cols) - 1) * var(--g));
  height: calc(var(--rows) * var(--s));
  margin-inline: auto;
}

.block {
  --x: var(--wx);
  --y: var(--wy);

  /* Logical, so Arabic lays the order from the right. */
  position: absolute;
  inset-inline-start: calc(var(--x) * (var(--s) + var(--g)));
  bottom: calc(var(--y) * var(--s));
  display: grid;
  place-items: center;
  width: var(--s);
  height: var(--s);
  /* The physics rounds its body by the same fraction. */
  border-radius: calc(var(--s) * 16 / 72);
  background-color: var(--color-border-subtle);
  box-shadow: inset 0 0 0 1px var(--color-border);
}

.block__logo {
  width: calc(var(--s) * 0.56);
  height: calc(var(--s) * 0.56);
  color: var(--color-ink-strong);
  pointer-events: none;
}

/* Visibility, not opacity: nothing half-shows. */
.tower.is-unbuilt .block { visibility: hidden; }

@media (hover: hover) {
  .block { transition: background-color var(--duration-base) var(--ease-out-soft); }
  .block:hover { background-color: var(--color-surface-hover); }
}

/* Not where the card is pinned. The width is literal: a container query cannot read `--*`. */
@media not ((width >= 1200px) and (height >= 640px)) {
  @container tower (width < 260px) {
    .tower__blocks {
      --cols: var(--narrow-cols);
      --rows: var(--narrow-rows);
    }

    .block {
      --x: var(--nx);
      --y: var(--ny);
    }
  }
}

@media (width >= 1200px) and (height >= 640px) {
  .tower {
    container-type: size;
    flex: 1 1 0;
    min-height: 0;
  }

  .tower__blocks {
    --s: min(
      var(--s-max),
      calc((100cqw - 2 * var(--wall) - (var(--cols) - 1) * var(--g)) / var(--cols)),
      calc((100cqh - 0.5rem) / var(--rows))
    );
  }
}
</style>
