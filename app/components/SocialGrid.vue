<script setup lang="ts">
const content = useContent()
</script>

<template>
  <nav :aria-label="$t('a11y.socialLinks')">
    <ul class="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-3 gap-gutter">
      <SocialIcon v-for="link in content.socials" :key="link.id" :link="link" />
    </ul>
  </nav>
</template>
