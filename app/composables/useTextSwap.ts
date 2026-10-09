import { media, swap as S } from '~/config/motion'

// Rolls a label's old text out (as an aria-hidden clone) and the new text in.
// Never animate the role="status" region beside it: a live region must announce at once.
export function useTextSwap(el: Ref<HTMLElement | null>) {
  let running: ReturnType<NonNullable<ReturnType<typeof gsapModules>>['gsap']['timeline']> | null = null
  // Held here because killing a timeline does not run its onComplete.
  let outgoing: HTMLElement | null = null

  function sweep() {
    outgoing?.remove()
    outgoing = null
  }

  // Call after the new text has rendered: it reads it from the DOM.
  async function swapTo(previous: string) {
    const host = el.value
    if (!host) return
    if (previous === host.textContent?.trim()) return

    const m = await loadGsap()
    if (!m) return
    const { gsap } = m

    if (window.matchMedia(media.reduce).matches) return

    running?.kill()
    sweep()

    const clone = host.cloneNode(true) as HTMLElement
    clone.textContent = previous
    clone.setAttribute('aria-hidden', 'true')
    clone.style.position = 'absolute'
    clone.style.inset = '0'
    clone.style.display = 'flex'
    clone.style.alignItems = 'center'
    clone.style.justifyContent = 'inherit'
    host.parentElement?.appendChild(clone)
    outgoing = clone

    running = gsap.timeline({
      defaults: { duration: S.duration, ease: 'reveal' },
      onComplete: () => {
        sweep()
        gsap.set(host, { clearProps: 'transform,willChange' })
        running = null
      },
    })
      .fromTo(host, { yPercent: S.yPercent }, { yPercent: 0 }, 0)
      .to(clone, { yPercent: -S.yPercent }, 0)
  }

  onBeforeUnmount(() => { running?.kill(); running = null; sweep() })

  return { swapTo }
}
