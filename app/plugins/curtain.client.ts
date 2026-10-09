import type { RouteLocationNormalized } from 'vue-router'
import { NavigationFailureType, isNavigationFailure } from 'vue-router'
import type { CurtainTarget } from '~/composables/useCurtain'
import { curtain as M, intro as INTRO } from '~/config/motion'
import { contentFor, langOf } from '~/utils/content'
import { loadGsap } from '~/composables/useGsap'
import { createMirror } from '~/composables/useMirror'
import { takeScroll } from '~/utils/scroll-stash'
import { fontsSettled, warmArabicFace } from '~/utils/fonts-settled'

// Opens on page:finish, the only hook that fires once the new page's Suspense has resolved.
// i18n's middleware runs in Nuxt's own beforeEach, so skipSettingLocaleOnNavigate defers the locale to
// finalizePendingLocaleChange(), called below while covered.
export default defineNuxtPlugin({
  name: 'curtain',
  // $i18n has to exist before resolveTarget reads locales off it.
  dependsOn: ['i18n:plugin'],

  setup(nuxtApp) {
    const router = useRouter()
    const curtain = useCurtain()
    const i18n = nuxtApp.$i18n
    const routeBaseName = useRouteBaseName(nuxtApp)

    // Captured here in setup: the guards run outside the Nuxt instance context.
    const { shouldReplay } = useIntro()
    const reveal = useReveal()
    const { fold } = reveal
    const mirror = createMirror({
      reveal,
      focusHeading: curtain.focusHeading,
      isIdle: () => curtain.status.value === 'idle',
    })
    const codes = () => i18n.localeCodes.value as string[]
    const localeList = () =>
      (i18n.locales.value as Array<string | { code: string, name?: string, dir?: string }>)
        .filter((l): l is { code: string, name?: string, dir?: string } => typeof l !== 'string')

    let navSeq = 0
    let pageStarted = false
    let pageFinished = false
    let fromPopstate = false
    let wantedDir: 'ltr' | 'rtl' = 'ltr'

    let uaAnimated = false
    let savedTop: number | null = null

    // The other language is prefetched ahead of a switch, so a mirror never sits frozen waiting for the network.
    const warmed = new Set<string>()
    function warmLanguage(link: HTMLAnchorElement | null) {
      const code = link?.getAttribute('lang')
      const href = link?.getAttribute('href')
      if (!code || !href || warmed.has(code) || !codes().includes(code)) return
      warmed.add(code)
      if (code === 'ar') warmArabicFace()
      void i18n.loadLocaleMessages(code as Parameters<typeof i18n.loadLocaleMessages>[0]).catch(() => {})
      // runWithContext: from an event listener useNuxtApp() finds nothing. loadPayload fills the cache the navigation reads.
      void nuxtApp.runWithContext(() => Promise.allSettled([
        preloadRouteComponents(href),
        loadPayload(href),
      ]))
    }
    const onIntent = (event: Event) => {
      warmLanguage((event.target as Element | null)?.closest?.<HTMLAnchorElement>('a.lang') ?? null)
    }
    document.addEventListener('pointerover', onIntent, { passive: true })
    document.addEventListener('touchstart', onIntent, { passive: true })
    document.addEventListener('focusin', onIntent)
    watch(curtain.status, (status) => {
      if (status !== 'idle') return
      const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
      if (saveData) return
      setTimeout(() => {
        if (!document.hidden && curtain.status.value === 'idle') warmLanguage(document.querySelector<HTMLAnchorElement>('a.lang'))
      }, 1500)
    })

    window.addEventListener('popstate', (event) => {
      fromPopstate = true
      // iOS's swipe-back draws its own transition; a mirror on top would be two.
      uaAnimated = Boolean((event as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition)
      const top = (event.state as { scroll?: { top?: number } } | null)?.scroll?.top
      savedTop = typeof top === 'number' ? top : null
    }, { capture: true })

    /** `prefix_except_default`: the locale IS the first path segment, or the default. */
    function localeOf(path: string): string {
      const segment = path.split('/')[1] ?? ''
      return codes().includes(segment) ? segment : (i18n.defaultLocale as string)
    }

    function metaFor(code: string) {
      return localeList().find(l => l.code === code)
    }

    function wantsIntro(to: RouteLocationNormalized, from: RouteLocationNormalized): boolean {
      if (!shouldReplay()) return false
      return routeBaseName(to) === 'index' && routeBaseName(from) !== 'index'
    }

    function resolveTarget(to: RouteLocationNormalized, from: RouteLocationNormalized): CurtainTarget {
      const toLocale = localeOf(to.path)
      const fromLocale = localeOf(from.path)

      if (toLocale !== fromLocale) {
        const meta = metaFor(toLocale)
        return {
          variant: M.variant.lang,
          label: meta?.name ?? toLocale,
          lang: toLocale,
          dir: meta?.dir === 'rtl' ? 'rtl' : 'ltr',
        }
      }

      const meta = metaFor(toLocale)
      // vue-router allows symbol route names, so the type is narrowed rather than asserted.
      const base = routeBaseName(to)
      const { label } = pageTitle(
        typeof base === 'string' ? base : undefined,
        to.params as Record<string, unknown>,
        i18n.t,
        langOf(toLocale),
      )
      const intro = wantsIntro(to, from)
      return {
        // The intro hands off along one lifting edge, so it needs the slab.
        variant: intro ? M.variant.home : M.variant.page,
        label,
        lang: toLocale,
        dir: meta?.dir === 'rtl' ? 'rtl' : 'ltr',
        intro,
      }
    }

    const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0))

    // unhead writes <html dir> on its own setTimeout(0); opening first flashes the new page in the old direction.
    async function dirSettled() {
      for (let i = 0; i < 12; i++) {
        if (document.documentElement.dir === wantedDir) return
        await tick()
      }
    }

    function restoreScroll() {
      const target = takeScroll()
      if (target?.hash) {
        const el = document.querySelector(target.hash)
        if (el) { el.scrollIntoView(); return }
      }
      window.scrollTo(target?.left ?? 0, target?.top ?? 0)
    }

    // Unchanged page key (Nuxt skips Suspense, no page:finish) or a failed navigation would stay covered.
    // The navSeq check yields to a newer navigation, which owns the curtain.
    function scheduleStallCheck() {
      const seq = navSeq
      setTimeout(() => {
        if (seq !== navSeq) return
        if (pageStarted || pageFinished) return
        const status = curtain.status.value
        if (status === 'closing' || status === 'covered') void curtain.open()
      }, 250)
    }

    router.beforeEach((to, from) => {
      if (!from.name) return // first load: the reveal owns it
      if (to.path === from.path) return

      mirror.abort()

      const status = curtain.status.value
      const target = resolveTarget(to, from)
      wantedDir = target.dir

      if (target.intro) void loadGsap()

      // Already covering: join the same close. Waving it through would swap the DOM behind a half-down curtain.
      if (status === 'closing' || status === 'covered') {
        curtain.retarget({ label: target.label, lang: target.lang, intro: target.intro })
        return curtain.pending()
      }

      // Mid-reveal clicks are dropped; a history press is let through, since aborting popstate makes the URL bounce.
      if (status === 'opening') return fromPopstate ? undefined : false

      navSeq++
      pageStarted = false
      pageFinished = false

      if (
        target.variant === M.variant.lang
        && mirror.can({
          home: routeBaseName(to) === 'index' && routeBaseName(from) === 'index',
          back: fromPopstate,
          uaAnimated,
          savedTop,
        })
      ) {
        const flying = mirror.begin(fromPopstate, target.dir)
        if (flying) return flying
      }

      return curtain.close(target)
    })

    router.afterEach((to, _from, failure) => {
      fromPopstate = false
      uaAnimated = false
      savedTop = null
      if (nuxtApp.isHydrating) return

      if (failure) mirror.abort()

      if (failure) {
        // A duplicated navigation never ran the guards, so nothing was armed.
        if (isNavigationFailure(failure, NavigationFailureType.duplicated)) return
        // A newer navigation owns the curtain; opening here would reveal the old page (the error page's "Back to home" does this).
        if (router.currentRoute.value.fullPath !== to.fullPath) return
      }

      scheduleStallCheck()
    })

    nuxtApp.hook('page:start', () => { pageStarted = true })

    let markRendered: () => void
    const firstRender = new Promise<void>((resolve) => { markRendered = resolve })

    nuxtApp.hook('page:finish', async () => {
      pageFinished = true
      markRendered()

      // The first one belongs to hydration; reveal() uncovers that.
      if (nuxtApp.isHydrating) return

      const covered = curtain.status.value !== 'idle'

      try {
        // Always finalize, even when no curtain ran: a mirrored language switch still needs its locale and dir.
        await i18n.finalizePendingLocaleChange()
        await dirSettled()

        if (mirror.pending()) await mirror.land()

        if (covered) restoreScroll()

        // Fold only here: the scroll is restored and nothing is visible.
        if (covered) fold()
      }
      finally {
        // `finally`: this hook runs inside NuxtPage's own try, and a throw would leave the page covered.
        // Not awaited, so the reveal does not hold up Nuxt's loading state.
        if (covered) void curtain.open()
      }
    })

    router.onError(() => curtain.forceOpen('router error'))

    // No vue:error handler: it fires for every captured error, and on a fatal one uncovers the old page before error.vue mounts.

    nuxtApp.hook('app:mounted', () => {
      // A cold load of the error page has no <NuxtPage>, so page:finish never fires for it.
      if (nuxtApp.payload.error) markRendered()

      fold()

      // Fonts and GSAP are races, not waits: if either misses its window the plain reveal runs on time.
      // Nothing starts in a background tab: rAF is frozen there and the watchdog would cut the intro short.
      const visible = document.hidden
        ? new Promise<void>((resolve) => {
            const onVisible = () => {
              if (document.hidden) return
              document.removeEventListener('visibilitychange', onVisible)
              resolve()
            }
            document.addEventListener('visibilitychange', onVisible)
          })
        : Promise.resolve()

      const wantIntro = useIntro().shouldRun()
      let fontsInTime = false
      let gsapInTime = false
      // Not document.fonts.ready: it never resolves on WebKit here; see utils/fonts-settled.ts.
      const fontsReady = fontsSettled().then(() => { fontsInTime = true })
      const gsapReady = wantIntro
        ? loadGsap().then((m) => { gsapInTime = !!m })
        : Promise.resolve()

      // Not awaited: Nuxt awaits this hook, and the reveal takes about a second.
      void curtain.reveal(
        contentFor(langOf(i18n.locale.value as string)).profile.name,
        i18n.locale.value as string,
        Promise.all([
          Promise.race([fontsReady, wait(M.reveal.fontsTimeout)]),
          // Never uncover an empty document (the SPA fallback is still resolving); capped so a stall cannot hold the cover.
          Promise.race([firstRender, wait(M.reveal.renderTimeout)]),
          Promise.race([gsapReady, wait(INTRO.loadTimeoutMs)]),
          visible,
        ]),
        () => wantIntro && fontsInTime && gsapInTime,
      )
    })
  },
})

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
