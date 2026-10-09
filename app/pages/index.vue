<script setup lang="ts">
const { t, locale } = useI18n()
const content = useContent()

const description = () => content.profile.summary.split('. ')[0] + '.'

// Getters: a language switch changes the locale after setup (`skipSettingLocaleOnNavigate`).
useSeoMeta({
  title: () => pageTitle('index', {}, t, langOf(locale.value)).title,
  description,
  ogTitle: () => pageTitle('index', {}, t, langOf(locale.value)).title,
  ogDescription: description,
  ogType: 'website',
  twitterCard: 'summary_large_image',
})

useOgCard(content.profile.name, t('meta.jobTitle'))

usePersonSchema()
</script>

<template>
  <HomeBento />
</template>
