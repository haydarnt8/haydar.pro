// Gate tests on capability sets, never on a project name: a name check silently skips a new project.

/** pointer: fine, so hover applies. */
const FINE = new Set(['desktop', 'webkit-desktop'])

const TOUCH = new Set(['mobile', 'webkit-phone', 'reduced-phone'])

/** prefers-reduced-motion: reduce, independent of the pointer. */
const STILL = new Set(['reduced', 'reduced-phone'])

const WEBKIT = new Set(['webkit-phone', 'webkit-desktop'])

import { test } from '@playwright/test'

const name = () => test.info().project.name

export const isFine = () => FINE.has(name())
export const isTouch = () => TOUCH.has(name())
export const isStill = () => STILL.has(name())
export const isWebKit = () => WEBKIT.has(name())
