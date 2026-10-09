// Open stroked paths, never filled shapes or icon fonts: DrawSVG can only draw a stroke.
// Each mark is a 48x48 box placed on the 1000x560 stage the signature is centred on.
export interface Doodle {
  name: string
  /** The box's position on the 1000x560 stage. */
  x: number
  y: number
  /** Degrees. */
  rotate: number
  scale: number
  paths: readonly string[]
}

export const STAGE = { width: 1000, height: 560 } as const

export const doodles: readonly Doodle[] = [
  {
    name: 'code',
    x: 72, y: 52, rotate: -10, scale: 1.7,
    paths: [
      'M15 13 L5 24 L15 35',
      'M33 13 L43 24 L33 35',
      'M28 8 L20 40',
    ],
  },
  {
    name: 'braces',
    x: 852, y: 40, rotate: 8, scale: 1.7,
    paths: [
      'M19 6 C13 6 13 11 13 15 C13 19 10 22 6 24 C10 26 13 29 13 33 C13 37 13 42 19 42',
      'M29 6 C35 6 35 11 35 15 C35 19 38 22 42 24 C38 26 35 29 35 33 C35 37 35 42 29 42',
    ],
  },
  {
    name: 'cursor',
    x: 22, y: 250, rotate: -6, scale: 1.7,
    paths: [
      'M11 6 L11 35 L18.5 28 L24 42 L30 39.5 L24.5 26 L35 25 Z',
    ],
  },
  {
    name: 'window',
    x: 910, y: 318, rotate: 6, scale: 1.7,
    paths: [
      'M9 9 H39 A5 5 0 0 1 44 14 V35 A5 5 0 0 1 39 40 H9 A5 5 0 0 1 4 35 V14 A5 5 0 0 1 9 9 Z',
      'M4 19 H44',
      'M10 14 H10.01',
      'M16 14 H16.01',
    ],
  },
  {
    name: 'terminal',
    x: 118, y: 452, rotate: 5, scale: 1.7,
    paths: [
      'M8 13 L21 24 L8 35',
      'M26 35 H40',
    ],
  },
  {
    name: 'branch',
    x: 846, y: 440, rotate: -8, scale: 1.7,
    paths: [
      'M12 14 V40',
      'M12 8 A4 4 0 1 0 12.01 8',
      'M12 46 A4 4 0 1 0 12.01 46',
      'M36 12 A4 4 0 1 0 36.01 12',
      'M36 16 C36 28 12 24 12 34',
    ],
  },
] as const
