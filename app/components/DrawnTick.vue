<script setup lang="ts">
import { tick as T } from '~/config/motion'

// At rest the stroke is drawn; the tween only runs 0% → 100%, so without GSAP or under Reduce Motion it still shows.
const props = withDefaults(defineProps<{
  play?: boolean
  /** Seconds. */
  delay?: number
}>(), { play: true, delay: 0 })

const path = ref<SVGPathElement | null>(null)

async function draw() {
  const el = path.value
  if (!el) return
  const [m, drawSVG] = await Promise.all([loadGsap(), loadPlugin('DrawSVGPlugin')])
  if (!m || !drawSVG || prefersStillness()) return
  const { gsap } = m
  gsap.fromTo(el, { drawSVG: '0%' }, {
    drawSVG: '100%',
    duration: T.draw,
    ease: T.ease,
    delay: props.delay,
    overwrite: true,
    onComplete: () => { gsap.set(el, { clearProps: 'strokeDasharray,strokeDashoffset' }) },
  })
}

onMounted(() => { if (props.play) void draw() })
watch(() => props.play, (now) => { if (now) void draw() })
</script>

<template>
  <svg class="tick" viewBox="0 0 24 24" fill="none" focusable="false" aria-hidden="true">
    <path
      ref="path"
      d="M5 12.5 L10 17.5 L19.5 7.5"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
