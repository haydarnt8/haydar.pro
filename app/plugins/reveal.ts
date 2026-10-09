import type { RevealKind, RevealOptions } from '~/composables/useReveal'

function kindOf(modifiers: Partial<Record<string, boolean>>): RevealKind {
  if (modifiers.chars) return 'chars'
  if (modifiers.lines) return 'lines'
  if (modifiers.scramble) return 'scramble'
  if (modifiers.wipe) return 'wipe'
  return 'reveal'
}

// Universal, not `.client`: SSR calls getSSRProps on every directive and the page 500s if it is missing.
export default defineNuxtPlugin((nuxtApp) => {
  const { register, unregister, arm, disarm } = useReveal()

  nuxtApp.vueApp.directive<HTMLElement, RevealOptions | undefined>('reveal', {
    getSSRProps: () => ({}),
    mounted(el, binding) {
      register(el, kindOf(binding.modifiers), binding.value ?? {})
    },
    unmounted(el) {
      unregister(el)
    },
  })

  if (!import.meta.client) return

  // Arm only at idle: at 'opening' the curtain still covers the hero while its reveals play.
  // No dependsOn: the status lives in useState, and this plugin also runs on the server.
  const curtain = useCurtain()

  watch(
    curtain.status,
    (status) => {
      if (status === 'idle') arm()
      else disarm()
    },
    { immediate: true },
  )
})
