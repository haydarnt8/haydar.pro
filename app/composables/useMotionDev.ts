import type { GsapModules } from '~/composables/useGsap'

type Animation = ReturnType<GsapModules['gsap']['timeline']> | ReturnType<GsapModules['gsap']['to']>

// Dev only. GSDevTools attaches to one named timeline via ?gsdev=<name>, never by default, with persist: false:
// its persisted sessionStorage state restored onto a mid-flight intro and stalled the page.
const timelines: Record<string, Animation> = {}

export type MotionName = 'intro' | 'toggle' | 'tower' | 'card' | 'slider'

export function registerTimeline(name: MotionName, timeline: Animation) {
  if (!import.meta.dev || !import.meta.client) return

  timelines[name] = timeline
  ;(window as unknown as { __motion?: Record<string, Animation> }).__motion = timelines

  // `location` is settled here; useIntro runs mid-hydration and reads the navigation entry instead.
  if (new URLSearchParams(location.search).get('gsdev') !== name) return

  // Imported here, not via loadPlugin, so a production build drops the plugin.
  void (async () => {
    const m = await loadGsap()
    if (!m) return
    const { GSDevTools } = await import('gsap/GSDevTools')
    m.gsap.registerPlugin(GSDevTools)
    GSDevTools.create({ animation: timeline, minimal: true, persist: false, globalSync: false })
  })()
}
