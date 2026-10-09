<script setup lang="ts">
import { cursor as C, media } from '~/config/motion'

// The arrow is hidden (has-cursor on <html>) only inside the matchMedia branch, once the disc is alive.
// Two elements: GSAP writes `scale: none` inline on what it moves, which would beat the disc's CSS states.
// Mounted in app.vue, outside #stage so inert never reaches it.
const root = ref<HTMLElement | null>(null)
type State = 'idle' | 'link' | 'drag' | 'view' | 'push' | 'text'
const state = ref<State>('idle')

// Read through t() on every render, so a language switch under a hovering pointer changes the word.
const { t } = useI18n()
const word = computed(() => {
  if (state.value === 'view') return t('cursor.view')
  if (state.value === 'push') return t('cursor.push')
  if (state.value === 'drag') return t('cursor.drag')
  return ''
})
/** Held back until the pointer moves: no flash at 0,0 on load. */
const seen = ref(false)

function read(target: EventTarget | null): State {
  if (!(target instanceof Element)) return 'idle'
  const match = target.closest<HTMLElement>('[data-cursor], a, button, input, textarea, .slider__viewport')
  if (!match) return 'idle'

  const declared = match.dataset.cursor
  if (declared === 'link' || declared === 'drag' || declared === 'view' || declared === 'push' || declared === 'text') return declared

  if (match.matches('input, textarea')) return 'text'
  if (match.matches('.slider__viewport')) return 'drag'
  return 'link'
}

onMounted(() => {
  const el = root.value
  if (!el) return

  let ctx: ReturnType<NonNullable<ReturnType<typeof gsapModules>>['gsap']['context']> | null = null

  void loadGsap().then((m) => {
    if (!m || !root.value) return
    const { gsap } = m

    ctx = gsap.context(() => {
      // A matchMedia branch, not an if: plugging in a mouse or toggling reduced motion builds or reverts it live.
      gsap.matchMedia().add({ fine: media.fine, still: media.reduce }, (self) => {
        const { fine, still } = self.conditions as { fine: boolean, still: boolean }
        if (!fine || still) return

        const setX = gsap.quickTo(el, 'x', { duration: C.follow, ease: 'power3' })
        const setY = gsap.quickTo(el, 'y', { duration: C.follow, ease: 'power3' })

        const onMove = (event: PointerEvent) => {
          if (!seen.value) {
            // Under the pointer before showing it, or it flies in from the corner.
            gsap.set(el, { x: event.clientX, y: event.clientY })
            seen.value = true
          }
          setX(event.clientX)
          setY(event.clientY)
          state.value = read(event.target)
        }

        const onOver = (event: PointerEvent) => { state.value = read(event.target) }
        const onLeave = () => { seen.value = false }
        const onBlur = () => { seen.value = false }

        // The arrow goes only now, with the disc built and listening.
        document.documentElement.classList.add('has-cursor')

        document.addEventListener('pointermove', onMove, { passive: true })
        document.addEventListener('pointerover', onOver, { passive: true })
        document.addEventListener('pointerleave', onLeave)
        window.addEventListener('blur', onBlur)

        return () => {
          document.removeEventListener('pointermove', onMove)
          document.removeEventListener('pointerover', onOver)
          document.removeEventListener('pointerleave', onLeave)
          window.removeEventListener('blur', onBlur)
          document.documentElement.classList.remove('has-cursor')
          seen.value = false
        }
      })
    }, el)
  })

  onBeforeUnmount(() => { ctx?.revert() })
})
</script>

<template>
  <div
    ref="root"
    class="cursor"
    :class="{ 'is-seen': seen }"
    :data-state="state"
    :style="{
      '--cursor-size': `${C.size}px`,
      '--cursor-link': C.states.link / C.size,
      '--cursor-drag': C.states.drag / C.size,
      '--cursor-view': C.states.view / C.size,
      '--cursor-push': C.states.push / C.size,
    }"
    aria-hidden="true"
  >
    <span class="cursor__dot" />
    <!-- Beside the disc, not in it: a word inside the scaled disc would scale and blur with it. -->
    <Transition name="cursor-word">
      <span v-if="word" :key="word" class="cursor__word">{{ word }}</span>
    </Transition>
  </div>
</template>

<style scoped>
/* GSAP's element: position only, never styled by state. */
.cursor {
  position: fixed;
  top: 0;
  left: 0;
  width: var(--cursor-size);
  height: var(--cursor-size);
  margin: calc(var(--cursor-size) / -2);

  /* Above the curtain (50) and the grain (5); never interactive, so every click passes through. */
  z-index: 60;
  pointer-events: none;

  /* The theme wipe's frozen frame would show a second cursor; the live one carries on. */
  view-transition-name: cursor;
}

.cursor__dot {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background-color: var(--color-cursor);
  border: 1px solid transparent;

  opacity: 0;
  scale: 1;
  transition:
    scale var(--duration-base) var(--ease-out-soft),
    opacity var(--duration-fast) linear,
    background-color var(--duration-base) var(--ease-out-soft),
    border-color var(--duration-base) var(--ease-out-soft);
}

.cursor.is-seen .cursor__dot { opacity: 1; }

.cursor[data-state='link'] .cursor__dot {
  scale: var(--cursor-link);
  background-color: transparent;
  border-color: var(--color-cursor);
}

.cursor[data-state='view'] .cursor__dot,
.cursor[data-state='push'] .cursor__dot,
.cursor[data-state='drag'] .cursor__dot {
  background-color: var(--color-cursor-solid);
}

.cursor[data-state='drag'] .cursor__dot { scale: var(--cursor-drag); }
.cursor[data-state='view'] .cursor__dot { scale: var(--cursor-view); }
.cursor[data-state='push'] .cursor__dot { scale: var(--cursor-push); }

.cursor__word {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  /* The word may outgrow the 28px disc. */
  margin-inline: -1.5rem;
  font-size: 0.625rem;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  color: var(--color-cursor-ink);
}

/* Arabic letters join; letter-spacing breaks every word. */
:root[dir='rtl'] .cursor__word {
  letter-spacing: 0;
  text-transform: none;
  font-size: 0.75rem;
}

.cursor-word-enter-active,
.cursor-word-leave-active {
  transition:
    opacity var(--duration-fast) linear,
    translate var(--duration-fast) var(--ease-out-soft);
}

.cursor-word-enter-from { opacity: 0; translate: 0 40%; }
.cursor-word-leave-to { opacity: 0; translate: 0 -40%; }

/* Over a field the I-beam has to be unambiguous. */
.cursor[data-state='text'] .cursor__dot { opacity: 0; }

/* Belt and braces: a cached stylesheet could paint the disc before script arrives. */
@media (prefers-reduced-motion: reduce) {
  .cursor { display: none; }
}

@media (pointer: coarse) {
  .cursor { display: none; }
}
</style>
