<script setup lang="ts">
const { t, locale } = useI18n()
const content = useContent()
const description = () => content.profile.summary.split('. ')[0] + '.'

// Getters: the locale can change after setup.
useSeoMeta({
  title: () => pageTitle('about', {}, t, langOf(locale.value)).title,
  description,
  ogTitle: () => pageTitle('about', {}, t, langOf(locale.value)).title,
  ogDescription: description,
  ogType: 'profile',
  twitterCard: 'summary_large_image',
})

// Not a getter on purpose: zeroRuntime rasterises OG images at build time only.
useOgCard(t('sections.about'), content.profile.name)
</script>

<template>
  <AboutLayout />
</template>
