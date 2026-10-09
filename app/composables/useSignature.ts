import type { GsapModules } from '~/composables/useGsap'

type Timeline = ReturnType<GsapModules['gsap']['timeline']>

interface Draw {
  letter: number
  stagger: number
  fill: number
  ease: string
  fillEase: string
}

/** Set outside the timeline, before the layer is shown. */
export const INK_FROM = { drawSVG: '0%', fillOpacity: 0, strokeOpacity: 1 } as const

// Only inserts tweens into the caller's timeline at `at`; the intro's later steps rely on it creating nothing else.
export function writeSignature(tl: Timeline, paths: Element[], draw: Draw, at = 0) {
  paths.forEach((path, i) => {
    const start = at + i * draw.stagger
    tl
      .to(path, { drawSVG: '100%', duration: draw.letter, ease: draw.ease }, start)
      .to(path, { fillOpacity: 1, strokeOpacity: 0, duration: draw.fill, ease: draw.fillEase }, start + draw.letter - 0.1)
  })
  return tl
}
