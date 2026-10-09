<script setup lang="ts">
/**
 * Build-time OG image (1200x630).
 *
 * Rendered by satori, which resolves neither CSS custom properties nor external
 * stylesheets — so the design tokens are inlined as literals here. That is the
 * one place in this codebase where raw hex is unavoidable; the values are the
 * dark theme's `--color-surface`, `--color-surface-raised`, `--color-border`,
 * `--color-ink-strong` and `--color-ink-muted`, and must be kept in step with
 * `app/assets/css/main.css` by hand.
 *
 * ARABIC IS SET BY HAND, A WORD AT A TIME. satori shapes each Arabic word
 * correctly but lays the words of a line out left to right, so "منو اني؟" read
 * "اني؟ منو" and every card with more than one Arabic word was backwards, the
 * Gudea card with its name at the wrong end. A line holding Arabic is therefore
 * handed over as one element per run (an Arabic word, or a stretch of Latin
 * words kept together) in a row running right to left, and a card holding
 * Arabic sits against its right edge. English is untouched.
 *
 * THE PORTRAIT stands at the card's far edge, at the start of reading's end:
 * right of the words in English, left of them in Arabic. His own picture
 * (2026-10-08), as public/portrait/og.png, a copy scripts/generate-icons.mjs
 * makes for this card, its shirt cut level with the card's foot. The words keep
 * the rest of the width, so the longest project title (32 characters) still
 * wraps to two lines at most.
 */
const props = withDefaults(defineProps<{
  title?: string
  subtitle?: string
  /** The card's version, never drawn: it is in the card's address only. See useOgCard. */
  v?: string
}>(), {
  title: 'Haydar Yosef',
  subtitle: 'Frontend Developer',
})

const ARABIC = /[؀-ۿ]/

/** A line in reading order: each Arabic word on its own, Latin words kept together. */
function runs(text: string) {
  const out: string[] = []
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = out.at(-1)
    if (last !== undefined && !ARABIC.test(word) && !ARABIC.test(last)) out[out.length - 1] = `${last} ${word}`
    else out.push(word)
  }
  return out
}

const rtl = computed(() => ARABIC.test(props.title + props.subtitle))

/*
  The gap stands in for the space satori drops between Arabic words: about a
  quarter of the size, which is what a space measures in both faces. Arabic
  takes no negative tracking — it pulls joined letters apart (see main.css).
*/
const lines = computed(() => [
  { text: props.title, style: 'font-size:72px;font-weight:500;color:#ffffff', latin: 'letter-spacing:-2px', gap: 18 },
  { text: props.subtitle, style: 'font-size:36px;color:#acacac', latin: '', gap: 9 },
].map(line => ARABIC.test(line.text)
  ? { runs: runs(line.text), style: `display:flex;flex-direction:row-reverse;flex-wrap:wrap;column-gap:${line.gap}px;${line.style}` }
  : { runs: [line.text], style: `display:flex;${line.style};${line.latin}` }))
</script>

<template>
  <div
    style="width:1200px;height:630px;display:flex;flex-direction:column;justify-content:center;
           background-color:#090909;padding:80px;font-family:'DM Sans',sans-serif"
  >
    <div
      :style="`position:relative;display:flex;flex-direction:column;justify-content:center;gap:24px;
               height:470px;padding:64px;${rtl ? 'padding-left:420px;align-items:flex-end' : 'padding-right:420px'};
               border-radius:32px;overflow:hidden;background-color:#141414;border:2px solid #242424`"
    >
      <!-- Every line as spans. A bare text branch under v-if/v-else rendered
           nothing at all once converted for satori: every Latin line vanished. -->
      <div v-for="(line, i) in lines" :key="i" :style="line.style">
        <span v-for="(run, j) in line.runs" :key="j">{{ run }}</span>
      </div>
      <img
        src="/portrait/og.png"
        width="372"
        :style="`position:absolute;bottom:0;${rtl ? 'left:24px' : 'right:24px'}`"
      >
    </div>
  </div>
</template>
