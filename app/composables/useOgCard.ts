// `v` (a hash of template + portrait, set in nuxt.config.ts) is part of the address: cards
// are served immutable, so a changed card must get a new URL. It is never drawn.
export function useOgCard(title: string, subtitle: string) {
  const { ogCardVersion } = useRuntimeConfig().public
  defineOgImageComponent('Portfolio', { title, subtitle, v: ogCardVersion })
}
