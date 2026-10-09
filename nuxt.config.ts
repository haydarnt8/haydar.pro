import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'

// Versions the OG cards, which are cached as immutable at a props-only URL;
// nuxt-og-image's own template hash cannot find this component.
const ogCardVersion = createHash('sha256')
  .update(readFileSync(new URL('./app/components/OgImage/Portfolio.satori.vue', import.meta.url)))
  .update(readFileSync(new URL('./public/portrait/og.png', import.meta.url)))
  .digest('hex')
  .slice(0, 10)

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxt/fonts',
    '@nuxtjs/i18n',
    '@nuxt/icon',
    '@nuxtjs/color-mode',
    '@nuxtjs/robots',
    '@nuxtjs/sitemap',
    'nuxt-og-image',
  ],

  app: {
    // No page/layout/view transition: the curtain covers route changes, and a second one would expose the swap.
    head: {
      // No htmlAttrs.lang: useLocaleHead() in app.vue sets lang/dir per locale.
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '16x16 32x32 48x48 64x64' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' },
        // The manifest is per language; app.vue links it.
      ],
      meta: [
        // Raw hex on purpose: --color-surface per theme (meta tags cannot read CSS vars).
        { name: 'theme-color', content: '#f4f5f6', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#090909', media: '(prefers-color-scheme: dark)' },
      ],
    },
  },

  css: ['~/assets/css/main.css'],

  // Off: inlined styles get swapped for a JS-loaded route stylesheet after paint (mobile CLS).
  features: {
    inlineStyles: false,
  },

  vite: {
    plugins: [tailwindcss()],
  },

  // vercel-static by default: scripts/verify serves .vercel/output/static. Netlify sets NITRO_PRESET.
  nitro: {
    preset: process.env.NITRO_PRESET || 'vercel-static',
    prerender: {
      // No server at runtime, so these server routes must be prerendered; /sitemap.xml
      // becomes a redirect stub to sitemap_index.xml.
      routes: ['/robots.txt', '/sitemap.xml'],
    },
  },

  // Set NUXT_PUBLIC_SITE_URL on the host; the localhost fallback is deliberate (a made-up domain would fail silently).
  site: {
    url: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    name: 'Haydar Yosef',
  },

  runtimeConfig: {
    public: {
      // Public by design: Web3Forms access keys are meant for client-side POSTs.
      web3formsKey: '11d92dee-66a5-4357-ab03-b9d8636fcac8',
      ogCardVersion,
    },
  },

  robots: {
    disallow: [],
  },

  sitemap: {
    // Nuxt's SPA fallback is not a page.
    exclude: ['/200.html'],
  },

  ogImage: {
    // No server: every OG image is rasterised at build time.
    zeroRuntime: true,
    // The module defaults to 1200x600, which crops the 1200x630 card.
    defaults: { width: 1200, height: 630 },
    security: {
      // ms; the 15s default timed out under build contention. Safe: images render only at build time.
      renderTimeout: 120_000,
    },
    // No `fonts` option: not in this module's schema; @nuxt/fonts feeds the renderer.
    // Its "Unknown Nitro preset vercel-static" warning is harmless with zeroRuntime.
  },

  // Font files are self-hosted in main.css. This only hands Plex Arabic to the OG
  // renderer (its Inter has no Arabic); DM Sans is a variable woff2, which satori
  // cannot use. og-image's local-font matcher requires `global: true`.
  fonts: {
    defaults: { subsets: ['latin', 'arabic'] },
    families: [
      { name: 'IBM Plex Sans Arabic', provider: 'local', global: true, weights: [400, 500], styles: ['normal'] },
    ],
  },

  // Bundled, not fetched from Iconify at runtime: static output has no server.
  icon: {
    mode: 'svg',
    clientBundle: {
      scan: true,
      // Names come from app/data/*.ts, so `scan` alone can miss them.
      icons: [
        'ph:github-logo', 'ph:linkedin-logo', 'ph:envelope',
        'ph:phone', 'ph:whatsapp-logo', 'ph:instagram-logo',
        // No RTL arrow: Arabic mirrors this glyph in CSS (.u-rtl-mirror).
        'ph:arrow-up-right-bold', 'ph:copy', 'ph:check',
        'ph:sun', 'ph:moon', 'ph:x', 'ph:caret-left', 'ph:caret-right', 'ph:globe-simple',
        'ph:eye-slash',
        'logos:html-5', 'logos:css-3', 'logos:javascript', 'logos:typescript-icon',
        'logos:vue', 'logos:react', 'logos:nuxt-icon', 'logos:pinia', 'logos:redux',
        'simple-icons:axios', 'logos:react-query-icon', 'logos:vuetifyjs', 'logos:tailwindcss-icon',
        'logos:firebase-icon', 'logos:netlify-icon', 'ph:github-logo-fill', 'logos:vitejs',
        'logos:figma', 'logos:postman-icon',
      ],
    },
  },

  // Real /ar/ URLs (not a cookie toggle) so Arabic is crawlable; each locale's `dir` drives RTL.
  i18n: {
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
    locales: [
      { code: 'en', language: 'en', dir: 'ltr', name: 'English', file: 'en.json' },
      { code: 'ar', language: 'ar', dir: 'rtl', name: 'العربية', file: 'ar.json' },
    ],
    // Fully-qualified hreflang; same env var as site.url so they never disagree.
    baseUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    detectBrowserLanguage: false,

    // The switch stays pending until the curtain plugin finalises it on page:finish,
    // so <html dir> never flips under the old page.
    skipSettingLocaleOnNavigate: true,
  },

  // classSuffix '' gives a bare .dark on <html>, which main.css's @custom-variant matches.
  colorMode: {
    classSuffix: '',
    preference: 'dark',
    fallback: 'dark',
    storageKey: 'portfolio-color-mode',
  },
})
