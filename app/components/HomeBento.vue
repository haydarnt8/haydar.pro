<script setup lang="ts">
import { BENTO_BLOCKS } from '~/config/motion'

// Read through on every render, never destructured: a language switch changes it under a mounted bento.
const content = useContent()
const workA = computed(() => content.featuredProjects[0])
const workB = computed(() => content.featuredProjects[1])
const workC = computed(() => content.featuredProjects[2])
</script>

<template>
  <div class="shell">
    <NoiseOverlay />
    <DecorativeFrame class="shell__frame" />

    <!-- Markup is in reading order (the phone's stack): Tab and screen readers follow it; CSS places the desktop grid.
         WorkC keeps `cell-1`: selectors and the geometry recording know it by that. -->
    <div v-reveal="{ children: BENTO_BLOCKS, batch: true, below: true }" class="wrap">
      <div class="left">
        <InfoCard />
        <div class="intro">
          <ProfilePicture class="intro__photo" />
          <AboutTeaser class="intro__about" />
        </div>
        <div class="works">
          <WorkCard v-if="workA" :project="workA" class="works__item" />
          <WorkCard v-if="workB" :project="workB" class="works__item" />
        </div>
        <WorkCard v-if="workC" :project="workC" class="cell-1" />
        <div class="second">
          <StackCard class="second__stack" />
          <div class="second__toggle">
            <ThemeToggle />
          </div>
        </div>
        <ContactCard />
      </div>

      <div class="right">
        <ProjectsTeaser class="right__projects" />
        <GetInTouchCard class="right__email" />
        <SocialGrid class="right__social" />
      </div>

      <!-- Last, inside `.wrap`: `.wrap` is its measurement origin, and last paints it over the card borders. -->
      <BorderSnake />
    </div>
  </div>
</template>

<style scoped>
.shell {
  position: relative;
  min-height: 100vh;
  background-color: var(--color-surface);
}

.second__toggle {
  display: grid;
  align-items: stretch;
  justify-items: stretch;
}

.wrap {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-gutter);
  padding: 1.25rem;
}

.left,
.right,
.works,
.intro,
.second {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-gutter);
  min-width: 0;
}

.second { flex-direction: row; }

@media (width < 810px) {
  .intro { flex-direction: row; align-items: stretch; }
  .intro__about { flex: 1 1 0; min-width: 0; }

  /* Doubled to beat the avatar's own rule; clearing aspect-ratio lets the row's height reach the photo. */
  .intro__photo.intro__photo {
    flex: 0 0 34%;
    aspect-ratio: auto;
  }
}
.second__stack { flex: 1 1 0; }
.second__toggle { flex: 0 0 38.6%; }

/* Everything must be free to shrink, or a wide child forces its track (and the page) open. */
.wrap :where(div, section, article) { min-width: 0; }

@media (width < 1200px) {
  .left,
  .right { display: contents; }
}

@media (width >= 810px) {
  .wrap { padding: 2rem; }

  .works,
  .intro,
  .second {
    flex-direction: row;
  }

  .works__item,
  .second__stack,
  .intro__about { flex: 1 1 0; }

  .second__toggle { flex: 0 0 34%; }

  .intro__photo { flex: 0 0 auto; }
}

@media (width >= 810px) and (width < 1200px) {
  .wrap {
    flex-flow: row wrap;
    align-content: flex-start;
  }

  .info,
  .works,
  .intro,
  .work.cell-1,
  .contact,
  .second,
  .right__social { flex: 0 0 100%; }

  .right__projects { flex: 333 1 0; }
  .right__email { flex: 397 1 0; }
}

@media (width >= 1200px) {
  .wrap {
    flex-direction: row;
    height: 100dvh;
    min-height: 640px;
  }

  .left  { flex: 2 1 0; }
  .right { flex: 0.5 1 0; }

  /* Grid, not flex: flex siblings resolved unevenly. The rows split differently, so the tracks
     are the arithmetic: lines at 4W/9, 4W/7 and 5W/7, W being the width less a gutter. */
  .left {
    display: grid;
    grid-template-columns:
      [start] calc((100% - var(--spacing-gutter)) * 4 / 9)
      [works] calc((100% - var(--spacing-gutter)) * 8 / 63 - var(--spacing-gutter))
      [second] calc((100% - var(--spacing-gutter)) / 7 - var(--spacing-gutter))
      [workc] minmax(0, 1fr) [end];
    grid-template-rows: repeat(3, minmax(0, 1fr));
  }

  .info { grid-area: 1 / start / 2 / works; }
  .works { grid-area: 1 / works / 2 / end; }
  .intro { grid-area: 2 / start / 3 / workc; }
  .work.cell-1 { grid-area: 2 / workc / 3 / end; }

  .contact { grid-area: 3 / start / 4 / second; }
  .second { grid-area: 3 / second / 4 / end; }

  .works {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .works__item { min-height: 0; }

  /* Stays flex: grid resolves widths before heights, so it cannot derive the square from the row. */
  .intro {
    display: flex;
    flex-direction: row;
  }

  .intro__photo { flex: 0 0 auto; aspect-ratio: 1; height: 100%; width: auto; }
  .intro__about { flex: 1 1 0; min-width: 0; }

  .second {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 160px;
  }

  /* Grid, not flex: a padded card's flex base size has a floor, which skews flex ratios. */
  .right {
    display: grid;
    grid-template-rows: auto minmax(0, 338fr) minmax(0, 290fr);
  }

  /* The markup reads Projects, Get in touch, Socials (phone order); the column puts socials first. */
  .right__social { grid-row: 1; }
  .right__projects { grid-row: 2; }
  .right__email { grid-row: 3; }

  .right__projects,
  .right__email { min-height: 0; }
}

/* Row 3 `auto`, not minmax(share, auto): a minmax track only grows into free space, and the tower spilled out. */
@media (width >= 1200px) and (height < 640px) {
  .left {
    grid-template-rows:
      calc((100% - 2 * var(--spacing-gutter)) / 3)
      calc((100% - 2 * var(--spacing-gutter)) / 3)
      auto;
  }
}

@media (width >= 1200px) and (height < 720px) {
  .wrap {
    --card-pad: 1.5rem;
    --text-h3: 1.25rem;
    --text-body-lg: 1.125rem;
  }
}

@media (width >= 1440px) {
  .left {
    grid-template-columns:
      [start] calc((100% - var(--spacing-gutter)) / 2)
      [works second] calc((100% - var(--spacing-gutter)) / 6 - var(--spacing-gutter))
      [workc] minmax(0, 1fr) [end];
  }

  .second { grid-template-columns: minmax(0, 1fr) 208px; }
}
</style>
