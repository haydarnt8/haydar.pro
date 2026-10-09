/**
 * Resolves when the faces this page draws have loaded or failed.
 * Not `document.fonts.ready`: on WebKit an og-image Plex face with an unquoted `local()` errors and `ready` never resolves.
 * Arabic is probed with Arabic text: the default space would match that broken full-range face.
 * Only the current language's faces: `load()` fetches, and a Latin-only page must never request Plex.
 */
const LATIN: ReadonlyArray<readonly [font: string, text?: string]> = [
  ['400 1em "DM Sans"'],
  ['500 1em "DM Sans"'],
]
const ARABIC: ReadonlyArray<readonly [font: string, text?: string]> = [
  ['400 1em "IBM Plex Sans Arabic"', 'حيدر'],
  ['500 1em "IBM Plex Sans Arabic"', 'حيدر'],
]

/** WebKit only: there `-apple-system` draws Arabic in the installed SF Arabic, so probing Plex would download it for nothing. */
const systemArabic = () => typeof CSS !== 'undefined' && CSS.supports?.('font', '-apple-system-body') === true

export function fontsSettled(): Promise<void> {
  if (!import.meta.client || !document.fonts?.load) return Promise.resolve()
  const arabic = document.documentElement.lang === 'ar' && !systemArabic()
  const faces = arabic ? [...LATIN, ...ARABIC] : LATIN
  return Promise.allSettled(faces.map(([font, text]) => document.fonts.load(font, text)))
    .then(() => undefined)
}

let warmed = false
export function warmArabicFace() {
  if (warmed || !import.meta.client || !document.fonts?.load || systemArabic()) return
  if (document.documentElement.lang === 'ar') return
  warmed = true
  for (const [font, text] of ARABIC) void document.fonts.load(font, text).catch(() => {})
}
