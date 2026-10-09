// Decided once per load and held, so the plugin preloading GSAP and the curtain playing it agree.
let decision: boolean | null = null

function decide(): boolean {
  if (!import.meta.client) return false
  if (prefersStillness()) return false

  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined

  // Read ?intro=1 from the navigation entry: mid-hydration the address bar has lost its query.
  const requested = nav?.name ?? location.href
  let forced = false
  try {
    forced = new URL(requested).searchParams.get('intro') === '1'
  }
  catch { /* no override */ }
  if (forced) return true

  return nav?.type !== 'back_forward'
}

// Asked fresh each time: reduced motion can change without a reload.
function canReplay(): boolean {
  return import.meta.client && !prefersStillness()
}

export function useIntro() {
  const shouldRun = () => (decision ??= decide())
  const shouldReplay = canReplay
  return { shouldRun, shouldReplay }
}
