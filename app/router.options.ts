import type { RouterConfig } from '@nuxt/schema'
import { stashScroll } from '~/utils/scroll-stash'

// Replaces Nuxt's scrollBehavior, which would scroll after the curtain opens: the position is
// stashed and applied while the page is still covered.
export default {
  scrollBehavior(to, from, savedPosition) {
    // Same page: no curtain runs, so the router scrolls itself.
    if (to.path === from.path) return to.hash ? { el: to.hash } : false

    stashScroll({
      top: savedPosition?.top ?? 0,
      left: savedPosition?.left ?? 0,
      hash: to.hash,
    })
    return false
  },
} satisfies RouterConfig
