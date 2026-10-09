<script setup lang="ts">
const content = useContent()
</script>

<template>
  <BaseCard as="section" class="services">
    <h2 v-reveal.scramble class="u-label-lg text-ink-faint">{{ $t('sections.services') }}</h2>

    <CardSlider :items="content.services" :label="$t('sections.services')" class="services__slider">
      <template #default="{ item }">
        <div class="services__slide">
          <h3 class="text-h4 text-ink-strong">
            <TodoPlaceholder :value="item.title" />
          </h3>
          <p class="text-body-md text-ink-muted">
            <TodoPlaceholder :value="item.description" />
          </p>
        </div>
      </template>
    </CardSlider>
  </BaseCard>
</template>

<style scoped>
.services {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  min-height: 0;
}

.services__slider { flex: 1 1 auto; }

.services__slide {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
}
</style>
