<script setup lang="ts">
import type { IntroHandle } from '~/composables/useCurtain'
import type { GsapModules } from '~/composables/useGsap'
import { doodles, STAGE } from '~/assets/doodles'
import { signature } from '~/assets/signature'
import { INK_FROM, writeSignature } from '~/composables/useSignature'
import { BENTO_BLOCKS, intro as M, media } from '~/config/motion'

// The name is drawn, flies into the hero heading, and the curtain's edge wipes this layer as it uncovers the heading.
const { registerIntro, releaseIntro } = useCurtain()
const { shouldRun } = useIntro()
const { prepare } = useReveal()

const alive = ref(true)
const root = ref<HTMLElement | null>(null)
const sig = ref<SVGSVGElement | null>(null)

type Gsap = GsapModules['gsap']
type Ctx = ReturnType<Gsap['context']>
type Timeline = ReturnType<Gsap['timeline']>
type Tween = ReturnType<Gsap['to']>

let ctx: Ctx | null = null
let mm: ReturnType<Gsap['matchMedia']> | null = null
let tl: Timeline | null = null
let unbindSkip: (() => void) | null = null
let resolvePlay: (() => void) | null = null
let settle: (() => void) | null = null
let ended = false
/** Only the blocks this run animated; `end()` must clear these and no others. */
let assembled: HTMLElement[] = []
let framed: SVGRectElement | null = null

const letterEls = () => Array.from(sig.value?.querySelectorAll<SVGPathElement>('path') ?? [])
const markEls = () => Array.from(root.value?.querySelectorAll<SVGGElement>('.intro-layer__mark') ?? [])

// From the one BENTO_BLOCKS definition the reveal engine also uses, so no block is owned by both or neither.
const BENTO = BENTO_BLOCKS.split(',').map(part => `#stage .wrap ${part.trim()}`).join(', ')

// Bottom first, by position: the slab uncovers from the bottom. A Set: the toggle matches twice.
function bentoBlocks() {
  const found = new Set(document.querySelectorAll<HTMLElement>(BENTO))
  return [...found]
    .filter((el) => {
      const r = el.getBoundingClientRect()
      // On screen only: the blocks under the fold belong to the reveal engine (`fold()`).
      return r.height > 0 && r.top < window.innerHeight
    })
    .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)
}

// Capture phase on the document: the sealed curtain swallows everything else.
const SKIP_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchmove'] as const

function bindSkip() {
  const jump = () => tl?.progress(1)
  const opts: AddEventListenerOptions = { capture: true, passive: true }
  for (const type of SKIP_EVENTS) document.addEventListener(type, jump, opts)
  unbindSkip = () => {
    for (const type of SKIP_EVENTS) document.removeEventListener(type, jump, opts)
    unbindSkip = null
  }
}

async function arm(): Promise<boolean> {
  if (!import.meta.client || !gsapModules()) return false

  const target = document.querySelector<HTMLElement>('[data-intro-name]')
  if (!target) return false
  const box = target.getBoundingClientRect()
  if (box.top < 0 || box.bottom > window.innerHeight) return false

  if (alive.value) {
    end()
    await nextTick()
  }

  ended = false
  ctx = null
  mm = null
  tl = null
  settle = null
  alive.value = true
  await nextTick()
  return !!root.value && !!sig.value
}

async function play() {
  const m = gsapModules()
  const el = root.value
  if (!m || !el || !sig.value) throw new Error('intro: GSAP or the layer is missing')
  const { gsap } = m

  if (!await loadPlugin('DrawSVGPlugin')) throw new Error('intro: DrawSVG is missing')

  ctx = gsap.context(() => {
    // Held for `end()`: this runs on every arrival, and an unreverted query leaks a listener each time.
    mm = gsap.matchMedia()
    mm.add(media.motion, () => {
      const letters = letterEls()
      const marks = markEls()
      const strokes = marks.flatMap(g => Array.from(g.querySelectorAll('path')))

      // The starting frame is set BEFORE the layer becomes visible.
      gsap.set(letters, INK_FROM)
      gsap.set(strokes, { drawSVG: '0%' })
      gsap.set(el, { autoAlpha: 1 })

      tl = gsap.timeline({ paused: true })

      writeSignature(tl, letters, M.draw)

      marks.forEach((g, i) => {
        tl!.to(g.querySelectorAll('path'), {
          drawSVG: '100%',
          duration: M.marks.draw,
          ease: M.draw.ease,
          stagger: 0.05,
        }, M.marks.start + i * M.marks.stagger)
      })

      tl.to({}, { duration: M.meet }, '>-0.05')
    })
  }, el)

  const timeline = tl
  if (!timeline) return

  bindSkip()
  registerTimeline('intro', timeline)

  await new Promise<void>((resolve) => {
    resolvePlay = resolve
    timeline.eventCallback('onComplete', resolve)
    timeline.play()
  })
  resolvePlay = null
  unbindSkip?.()
}

// Blocks only, never a container: a transformed ancestor would become NoiseOverlay's containing block.
function assemble(gsap: Gsap) {
  const blocks = bentoBlocks()
  if (!blocks.length) return
  assembled = blocks
  gsap.fromTo(
    blocks,
    { y: M.assemble.y, scale: M.assemble.scale, opacity: 0 },
    {
      y: 0,
      scale: 1,
      opacity: 1,
      duration: M.assemble.duration,
      ease: 'intro-settle',
      stagger: M.assemble.stagger,
      clearProps: 'transform,opacity,willChange',
    },
  )
}

// DrawSVG cannot measure a rect sized in %, so measured px go on as attributes for the draw; `end()` removes them.
function drawFrame(gsap: Gsap) {
  const rect = document.querySelector<SVGRectElement>('#stage .shell__frame .frame__line')
  if (!rect) return
  const box = rect.ownerSVGElement?.getBoundingClientRect()
  if (!box || box.width < 2 || box.height < 2) return
  if (!window.matchMedia(media.lg).matches) return

  framed = rect
  gsap.set(rect, { attr: { x: 0, y: 0, width: box.width, height: box.height } })
  gsap.from(rect, {
    drawSVG: '0%',
    duration: M.frame.draw,
    ease: 'intro-settle',
    delay: M.frame.delay,
  })
}

async function fly() {
  const m = gsapModules()
  const scope = ctx
  const svg = sig.value
  if (!m || !scope || !svg) return
  const { gsap, Flip } = m

  const target = document.querySelector<HTMLElement>('[data-intro-name]')
  const claim = target ? prepare(target) : null
  settle = claim?.settle ?? null

  const flights: Promise<unknown>[] = []
  scope.add(() => {
    // Fit FIRST: Flip.fit reads the box now, and the build's from() tweens would already have displaced it.
    const dest = claim?.words().find(w => w.textContent?.trim() === signature.text)
    if (dest) {
      const tween = Flip.fit(svg, dest, { scale: true, duration: M.fly, ease: 'intro-settle' }) as Tween
      flights.push(tween.then())
    }

    assemble(gsap)
    drawFrame(gsap)

    gsap.to(markEls(), {
      scale: 0.6,
      autoAlpha: 0,
      transformOrigin: '50% 50%',
      duration: M.marks.leave,
      stagger: 0.03,
      ease: 'power2.in',
    })
  })

  await Promise.all(flights)
}

function end() {
  if (ended) return
  ended = true
  unbindSkip?.()
  resolvePlay?.()
  resolvePlay = null
  settle?.()
  settle = null
  // Cleared by hand before ctx.revert(), which would put a cut-short block back at its from-state.
  const g = gsapModules()?.gsap
  if (g && assembled.length) g.set(assembled, { clearProps: 'transform,opacity,willChange' })
  assembled = []

  if (g && framed) {
    g.set(framed, { clearProps: 'strokeDasharray,strokeDashoffset' })
    for (const attr of ['width', 'height']) framed.removeAttribute(attr)
  }
  framed = null
  mm?.revert()
  mm = null
  ctx?.revert()
  ctx = null
  tl = null
  alive.value = false
}

const handle: IntroHandle = {
  get el() { return root.value },
  arm,
  play,
  fly,
  finish: end,
  cancel: end,
}

onMounted(() => {
  // Lent unconditionally: shouldRun() decides only the first load; later arrivals ask arm().
  registerIntro(handle)
  if (!shouldRun()) alive.value = false
})

onBeforeUnmount(() => {
  releaseIntro(handle)
  ctx?.revert()
  ctx = null
})
</script>

<template>
  <div v-if="alive" ref="root" class="intro-layer" aria-hidden="true">
    <div class="intro-layer__stage">
      <svg
        class="intro-layer__marks"
        :viewBox="`0 0 ${STAGE.width} ${STAGE.height}`"
        focusable="false"
      >
        <g
          v-for="mark in doodles"
          :key="mark.name"
          :transform="`translate(${mark.x} ${mark.y}) rotate(${mark.rotate} 24 24) scale(${mark.scale})`"
        >
          <!-- Animated group inside the placed one, so GSAP transforms never fight the placement. -->
          <g class="intro-layer__mark">
            <path v-for="(d, i) in mark.paths" :key="i" :d="d" />
          </g>
        </g>
      </svg>

      <svg
        ref="sig"
        class="intro-layer__sig"
        :viewBox="signature.viewBox"
        focusable="false"
      >
        <path v-for="letter in signature.letters" :key="letter.index" :d="letter.d" />
      </svg>
    </div>

  </div>
</template>

<style scoped>
/* Hidden in CSS for SSR; GSAP shows the layer only after the first frame is written. */
.intro-layer {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  visibility: hidden;
  opacity: 0;
  color: var(--curtain-label);
}

.intro-layer__stage {
  position: relative;
  display: grid;
  place-items: center;
  width: min(92vw, 1100px);
  aspect-ratio: 1000 / 560; /* STAGE, assets/doodles */
}

.intro-layer__marks {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  fill: none;
  stroke: currentColor;
  /* In the marks' own 48-unit box. */
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.intro-layer__sig {
  width: 76%;
  height: auto;
  overflow: visible;
  fill: currentColor;
  stroke: currentColor;
  /* Font units at 300 per em. */
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
  paint-order: stroke fill;
}
</style>
