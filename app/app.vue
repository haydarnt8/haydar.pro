<script setup lang="ts">
// Locale head (lang, dir, hreflang, og:locale and the canonical) for every page; add no other canonical.
// Needs i18n.baseUrl to be a real origin (NUXT_PUBLIC_SITE_URL), or the alternates point at localhost.
const head = useLocaleHead()
const { locale } = useI18n()

useHead(() => ({
  htmlAttrs: head.value.htmlAttrs,
  link: [
    ...(head.value.link ?? []),
    { rel: 'manifest', href: locale.value === 'ar' ? '/site.ar.webmanifest' : '/site.webmanifest' },
  ],
  meta: head.value.meta,
}))

// inert, not pointer-events: the keyboard and AT must not reach a covered page. NuxtRouteAnnouncer stays outside.
// isBlocking, not isBusy: false until hydrated, since only script can remove inert.
const { isBlocking } = useCurtain()
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />

    <!-- Not the Nuxt root: the reduced-motion crossfade of #stage would fade the curtain too. -->
    <main id="stage" :inert="isBlocking">
      <NuxtPage />
    </main>

    <TheCurtain />

    <!-- Outside #stage, so inert never reaches it and no page transform captures it. -->
    <TheCursor />
  </div>
</template>
