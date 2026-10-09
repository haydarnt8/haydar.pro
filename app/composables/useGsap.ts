import { eases } from '~/config/motion'

// Its own module: inside the reveals it made a circular import (reveals and morph) that broke SSR.
// One shared instance: two copies would keep two plugin registries and two tickers.
export interface GsapModules {
  gsap: typeof import('gsap')['gsap']
  ScrollTrigger: typeof import('gsap/ScrollTrigger')['ScrollTrigger']
  SplitText: typeof import('gsap/SplitText')['SplitText']
  Flip: typeof import('gsap/Flip')['Flip']
  CustomEase: typeof import('gsap/CustomEase')['CustomEase']
  ScrambleTextPlugin: typeof import('gsap/ScrambleTextPlugin')['ScrambleTextPlugin']
}

interface LazyPlugins {
  DrawSVGPlugin: typeof import('gsap/DrawSVGPlugin')['DrawSVGPlugin']
  MorphSVGPlugin: typeof import('gsap/MorphSVGPlugin')['MorphSVGPlugin']
  Draggable: typeof import('gsap/Draggable')['Draggable']
  InertiaPlugin: typeof import('gsap/InertiaPlugin')['InertiaPlugin']
  Observer: typeof import('gsap/Observer')['Observer']
}

type PluginName = keyof LazyPlugins

const IMPORTS: { [K in PluginName]: () => Promise<LazyPlugins[K]> } = {
  DrawSVGPlugin: () => import('gsap/DrawSVGPlugin').then(m => m.DrawSVGPlugin),
  MorphSVGPlugin: () => import('gsap/MorphSVGPlugin').then(m => m.MorphSVGPlugin),
  Draggable: () => import('gsap/Draggable').then(m => m.Draggable),
  InertiaPlugin: () => import('gsap/InertiaPlugin').then(m => m.InertiaPlugin),
  // Already in the shared chunk via ScrollTrigger; listed so features register it the same way.
  Observer: () => import('gsap/Observer').then(m => m.Observer),
  // No GSDevTools here: a dynamic import in this map makes Vite emit it as a production chunk.
}

let modules: GsapModules | null = null
let loader: Promise<GsapModules | null> | null = null
const plugins = new Map<PluginName, Promise<unknown>>()

/** Never triggers a load. */
export const gsapModules = () => modules

/** Resolves null if the chunk cannot load; callers treat that as "no animation". */
export function loadGsap(): Promise<GsapModules | null> {
  if (loader) return loader

  loader = (async () => {
    try {
      const [
        { gsap }, { ScrollTrigger }, { CustomEase }, { SplitText }, { ScrambleTextPlugin }, { Flip },
      ] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
        import('gsap/CustomEase'),
        import('gsap/SplitText'),
        import('gsap/ScrambleTextPlugin'),
        import('gsap/Flip'),
      ])
      gsap.registerPlugin(ScrollTrigger, CustomEase, SplitText, ScrambleTextPlugin, Flip)

      // GSAP cannot read CSS custom properties, so the site's eases are restated as paths and registered once.
      for (const [name, path] of Object.entries(eases)) CustomEase.create(name, path)

      // iOS's address bar changes the height mid-scroll; re-measuring would re-evaluate fired `once: true` triggers.
      ScrollTrigger.config({ ignoreMobileResize: true })

      modules = { gsap, ScrollTrigger, SplitText, Flip, CustomEase, ScrambleTextPlugin }
      return modules
    }
    catch {
      return null
    }
  })()

  return loader
}

/** Cached per name; resolves null on failure so the feature degrades, not the page. */
export function loadPlugin<K extends PluginName>(name: K): Promise<LazyPlugins[K] | null> {
  const cached = plugins.get(name)
  if (cached) return cached as Promise<LazyPlugins[K] | null>

  const pending = (async () => {
    const m = await loadGsap()
    if (!m) return null
    try {
      const plugin = await IMPORTS[name]()
      m.gsap.registerPlugin(plugin as object)
      return plugin
    }
    catch {
      return null
    }
  })()

  plugins.set(name, pending)
  return pending as Promise<LazyPlugins[K] | null>
}

/** Read fresh every time: the preference can change without a reload. */
export const prefersStillness = () =>
  import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches
