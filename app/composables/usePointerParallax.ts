import { media, parallax as P } from '~/config/motion'

interface Drift {
  /** Peak travel either side, in px. */
  x: number
  y: number
  /** Catch-up duration, in s. */
  follow: number
}

interface ParallaxTargets {
  zone: Ref<HTMLElement | null>
  /** Never the hover-styled image itself: the stylesheet owns its transform. */
  layer: Ref<HTMLElement | SVGElement | null>
  drift: Drift
  /** Also write the eased pointer position onto the zone as `--mx`/`--my`. */
  spotlight?: boolean
}

export function usePointerParallax({ zone, layer, drift, spotlight = false }: ParallaxTargets) {
  type Setter = (value: number) => void

  let ctx: ReturnType<NonNullable<ReturnType<typeof gsapModules>>['gsap']['context']> | null = null
  let setX: Setter | null = null
  let setY: Setter | null = null
  let setMx: Setter | null = null
  let setMy: Setter | null = null
  let box: DOMRect | null = null
  let building = false

  async function build() {
    if (ctx || building) return
    building = true
    const m = await loadGsap()
    building = false
    if (!m || !zone.value || !layer.value) return

    const { gsap } = m
    ctx = gsap.context(() => {
      // matchMedia, not an `if`: GSAP reverts the setters if a condition changes mid-session.
      gsap.matchMedia().add({ fine: media.fine, still: media.reduce }, (self) => {
        const { fine, still } = self.conditions as { fine: boolean, still: boolean }
        if (!fine || still) return

        setX = gsap.quickTo(layer.value!, 'x', { duration: drift.follow, ease: 'power3' })
        setY = gsap.quickTo(layer.value!, 'y', { duration: drift.follow, ease: 'power3' })

        if (spotlight) {
          // Seeded so GSAP has a unit to interpolate a custom property from.
          gsap.set(zone.value!, { '--mx': '0px', '--my': '0px' })
          setMx = gsap.quickTo(zone.value!, '--mx', { duration: P.spotlight.follow, ease: 'power3' })
          setMy = gsap.quickTo(zone.value!, '--my', { duration: P.spotlight.follow, ease: 'power3' })
        }

        return () => { setX = setY = setMx = setMy = null }
      })
    }, zone.value)
  }

  // The box is read once on enter: measuring in pointermove forces a layout every frame.
  function enter() {
    box = zone.value?.getBoundingClientRect() ?? null
    void build()
  }

  function move(event: PointerEvent) {
    if (!box) box = zone.value?.getBoundingClientRect() ?? null
    if (!box) return

    const px = (event.clientX - box.left) / box.width
    const py = (event.clientY - box.top) / box.height

    setX?.((px - 0.5) * -2 * drift.x)
    setY?.((py - 0.5) * -2 * drift.y)

    setMx?.(event.clientX - box.left)
    setMy?.(event.clientY - box.top)
  }

  function leave() {
    box = null
    const m = gsapModules()
    if (!m || !layer.value) return
    // clearProps: a leftover transform would make this element a containing block.
    m.gsap.to(layer.value, {
      x: 0,
      y: 0,
      duration: drift.follow,
      ease: 'power3',
      overwrite: 'auto',
      clearProps: 'transform,willChange',
      onComplete: () => { if (spotlight && zone.value) m.gsap.set(zone.value, { clearProps: '--mx,--my' }) },
    })
  }

  onBeforeUnmount(() => {
    ctx?.revert()
    ctx = null
  })

  return { enter, move, leave }
}
