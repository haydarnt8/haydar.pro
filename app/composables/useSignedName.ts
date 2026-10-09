import type { Ref } from 'vue'
import type { GsapModules } from '~/composables/useGsap'
import { signature } from '~/assets/signature'
import { LANDED } from '~/composables/useReveal'
import { INK_FROM, writeSignature } from '~/composables/useSignature'
import { intro, kinetic as K, media, parallax as P, signed as S } from '~/config/motion'

// Fine-pointer hover on the hero card: the word drops behind its masks and the intro's signature is written
// in its box; leaving reverses the same timeline. The svg is placed outside the timeline, on every entry.
type Gsap = GsapModules['gsap']
type Timeline = ReturnType<Gsap['timeline']>

export function useSignedName({ heading, svg, wrap }: {
  heading: Ref<HTMLElement | null>
  svg: Ref<SVGSVGElement | null>
  wrap: Ref<HTMLElement | null>
}) {
  const card = ref<HTMLElement | null>(null)
  const armed = ref(false)
  const lean = usePointerParallax({ zone: card, layer: svg, drift: P.signature })
  let ctx: ReturnType<Gsap['context']> | null = null

  onMounted(() => {
    const el = heading.value
    card.value = el?.closest<HTMLElement>('.u-card') ?? null

    void loadGsap().then((m) => {
      const zone = card.value
      if (!m || !el || !zone) return
      const { gsap } = m

      ctx = gsap.context(() => {
        gsap.matchMedia().add({ fine: media.fine, still: media.reduce }, (self) => {
          const { fine, still } = self.conditions as { fine: boolean, still: boolean }
          if (!fine || still) return
          armed.value = true
          // Read on every use: the card renders the svg a tick after `armed`, and removes it on revert.
          const sig = () => svg.value

          let tl: Timeline | null = null
          let letters: Element[] = []
          let paths: Element[] = []
          let inside = false
          let pending = false

          /** Named property by property: clearProps 'all' on SVG leaves a transform-origin behind. */
          const reset = () => {
            gsap.set(paths, { clearProps: 'strokeDasharray,strokeDashoffset,fillOpacity,strokeOpacity' })
            if (sig()) gsap.set(sig(), { clearProps: 'visibility,opacity,left,top,width,height' })
            gsap.set(letters, { clearProps: 'transform' })
          }

          /** Arabic is split by words, so the word stands in for its letters. */
          const find = () => {
            const word = Array.from(el.querySelectorAll<HTMLElement>('.word'))
              .find(w => w.textContent?.trim() === signature.text)
            if (!word) return null
            const chars = Array.from(word.querySelectorAll<HTMLElement>('.char'))
            return { word, letters: chars.length ? chars : [word] }
          }

          const place = (word: HTMLElement) => {
            const host = wrap.value
            const svgEl = sig()
            if (!host || !svgEl) return
            const w = word.getBoundingClientRect()
            const h = host.getBoundingClientRect()
            gsap.set(svgEl, { left: w.left - h.left, top: w.top - h.top, width: w.width, height: w.height })
          }

          /** Only `to` tweens after the zero sets: a reverse to zero restores the state before `reset` clears it. */
          const build = (svgEl: SVGSVGElement) => {
            self.add(() => {
              tl = gsap.timeline({ paused: true, onReverseComplete: reset })
              tl.set(paths, INK_FROM, 0)
              tl.set(svgEl, { autoAlpha: 1 }, 0)
              tl.to(letters, {
                yPercent: K.chars.yPercent,
                duration: S.drop.duration,
                ease: S.drop.ease,
                stagger: { each: S.drop.stagger, from: 'end' },
              }, 0)
              writeSignature(tl, paths, intro.draw, S.drop.duration)
            })
          }

          const enter = async () => {
            inside = true
            if (pending) return
            if (tl && !letters.every(l => l.isConnected)) {
              tl.kill()
              reset()
              tl = null
            }
            if (!tl) {
              if (!el.hasAttribute(LANDED)) return
              if (!find()) return
              pending = true
              const ok = await loadPlugin('DrawSVGPlugin')
              pending = false
              if (!ok || !inside) return
              const found = find()
              const svgEl = sig()
              if (!found || !svgEl) return
              letters = found.letters
              paths = Array.from(svgEl.querySelectorAll('path'))
              build(svgEl)
            }
            const found = find()
            if (found) place(found.word)
            tl!.timeScale(1).play()
          }

          const leave = () => {
            inside = false
            tl?.timeScale(S.unwrite).reverse()
          }

          const onEnter = (event: PointerEvent) => {
            lean.enter()
            lean.move(event)
            void enter()
          }
          // Move also enters: a pointer already resting on the card when the curtain lifts, or when the heading lands, gets no pointerenter.
          const onMove = (event: PointerEvent) => {
            lean.move(event)
            if (!inside || (!tl && !pending)) void enter()
          }
          const onLeave = () => {
            lean.leave()
            leave()
          }

          zone.addEventListener('pointerenter', onEnter)
          zone.addEventListener('pointermove', onMove)
          zone.addEventListener('pointerleave', onLeave)

          return () => {
            zone.removeEventListener('pointerenter', onEnter)
            zone.removeEventListener('pointermove', onMove)
            zone.removeEventListener('pointerleave', onLeave)
            tl?.kill()
            reset()
            tl = null
            armed.value = false
          }
        })
      }, el)
    })
  })

  onBeforeUnmount(() => {
    ctx?.revert()
    ctx = null
  })

  return { armed }
}
