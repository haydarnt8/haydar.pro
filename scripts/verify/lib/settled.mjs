import desktopConfig from 'lighthouse/core/config/desktop-config.js'

// Accessibility runs in its own pass after every entrance ends: axe reads
// mid-animation opacity into contrast. Performance keeps Lighthouse's timing.
export const SETTLE_MS = 6000

export function settledConfig(preset) {
  const base = preset === 'desktop' ? desktopConfig : { extends: 'lighthouse:default' }
  return {
    ...base,
    settings: {
      ...(base.settings ?? {}),
      onlyCategories: ['accessibility'],
      pauseAfterFcpMs: SETTLE_MS,
      pauseAfterLoadMs: SETTLE_MS,
    },
  }
}
