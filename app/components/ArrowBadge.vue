<!-- Decorative: the parent link or button carries the accessible name. -->
<template>
  <span class="badge" aria-hidden="true">
    <Icon name="ph:arrow-up-right-bold" class="badge__glyph badge__glyph--lead" />
    <Icon name="ph:arrow-up-right-bold" class="badge__glyph badge__glyph--trail" />
  </span>
</template>

<style scoped>
/* RTL mirrors the whole badge, so the slide reverses with the arrows. */
[dir='rtl'] .badge { transform: scaleX(-1); }

/* Zero specificity so the parent's placing class (e.g. position: absolute) wins
   whatever the stylesheet order; equal specificity caused a layout shift. */
:where(.badge) {
  position: relative;
  display: grid;
  place-items: center;
  width: var(--layout-arrow-badge);
  height: var(--layout-arrow-badge);
  flex-shrink: 0;
  border: 2px solid var(--color-border-strong);
  border-radius: 50%;
  overflow: hidden;
  color: var(--color-ink-muted);
}

.badge__glyph {
  position: absolute;
  width: 1.125rem;
  height: 1.125rem;
  transition: transform var(--duration-base) var(--ease-out-soft);
}

@media (width >= 810px) {
  .badge__glyph {
    width: 1.25rem;
    height: 1.25rem;
  }
}

.badge__glyph--trail {
  transform: translate(-150%, 150%);
}

:where(a, button):hover .badge__glyph--lead,
:where(a, button):focus-visible .badge__glyph--lead {
  transform: translate(150%, -150%);
}

:where(a, button):hover .badge__glyph--trail,
:where(a, button):focus-visible .badge__glyph--trail {
  transform: translate(0, 0);
}

/* Focus too, not just hover: with no trail glyph, sliding the lead out leaves an empty ring. */
@media (prefers-reduced-motion: reduce) {
  .badge__glyph { transition: none; }
  .badge__glyph--trail { display: none; }
  :where(a, button):hover .badge__glyph--lead,
  :where(a, button):focus-visible .badge__glyph--lead { transform: none; }
}
</style>
