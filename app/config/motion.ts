/**
 * Every motion number on the site. Seconds unless a name ends in `Ms` or a note says otherwise.
 * The carousel track is the one tween left inline (exempted in `noInlineMotionLeft`): its transform is its state.
 */

// Curtain timings, in ms (ported from docs/curtain-demo.html).
const SPEED = 1

const BASE = { close: 550, hold: 120, open: 650, stagger: 60 } as const

// `--ease-out-soft` from main.css as an SVG path: CustomEase cannot read a custom property.
const EASE_OUT_SOFT = 'M0,0 C0.22,1 0.36,1 1,1'

/** Named curves, built once by `loadGsap()`; the key is what a tween passes as `ease`. */
export const eases = {
  'reveal': EASE_OUT_SOFT,
  'intro-arrive': EASE_OUT_SOFT,
  'intro-settle': 'M0,0 C0.7,0 0.2,1 1,1',
  'toggle-throw': 'M0,0 C0.2,0.85 0.3,1 1,1',
} as const

/**
 * For `gsap.matchMedia()`. Every JS animation must branch on `reduce`: main.css's reduced-motion block never reaches a tween.
 * `md`/`lg`/`xl` restate `--breakpoint-*` from main.css, which script cannot read.
 */
export const media = {
  reduce: '(prefers-reduced-motion: reduce)',
  motion: '(prefers-reduced-motion: no-preference)',
  fine: '(hover: hover) and (pointer: fine)',
  coarse: '(pointer: coarse)',
  md: '(width >= 810px)',
  lg: '(width >= 1200px)',
  xl: '(width >= 1440px)',
} as const

export type CurtainVariant = 'slab' | 'blinds' | 'theatre' | 'sweep'

export const PANEL_COUNT: Record<CurtainVariant, number> = {
  slab: 1,
  blinds: 5,
  theatre: 2,
  sweep: 1,
}

export const curtain = {
  /** `home` must be the single-panel slab: the intro's handoff wipes along its one edge. */
  variant: { page: 'blinds', lang: 'sweep', home: 'slab' } as Record<'page' | 'lang' | 'home', CurtainVariant>,

  // WAAPI strings: `ease` is --ease-in-out-weighted and `easeOut` is --ease-out-soft in main.css.
  ease: 'cubic-bezier(.76,0,.24,1)',
  easeOut: 'cubic-bezier(.22,1,.36,1)',

  close: BASE.close / SPEED,
  hold: BASE.hold / SPEED,
  open: BASE.open / SPEED,
  stagger: BASE.stagger / SPEED,

  /** Label fade, as fractions of close/open. */
  label: {
    inDelay: 0.55, // × close
    inDur: 0.5, //    × open
    outDur: 0.35, //  × open
    outMin: 150, //   floor, in ms
  },

  reveal: {
    fontsTimeout: 1500,
    // Must stay well under the CSS failsafe's 6s so the two never race.
    renderTimeout: 3000,
    labelIn: 500,
    hold: 350,
    labelOut: 250,
    panelExtra: 150,
  },

  /** Reduced motion: a crossfade instead of the curtain. */
  reduced: { out: 180, in: 220 },

  watchdogGrace: 1500,
} as const

/** The language-switch mirror (useMirror.ts). Milliseconds. */
export const mirror = {
  cards: '.u-card, .work, .avatar, .icon',
  duration: 720,
  /** `staggerMax` caps the last card's start, however many cards there are. */
  stagger: 35,
  staggerMax: 300,
  ease: curtain.ease,
  /** When a card's old words fade, as fractions of its journey. */
  words: [0.2, 0.55] as const,
  land: 260,
  landEase: curtain.easeOut,
  /** Correction when a card's real new place is not its exact reflection (phone column). */
  settle: 280,
  settleEase: curtain.easeOut,
  /** Longest wait for the copies' first paint before building the next page. */
  paintMs: 120,
  fontsMs: 600,
  /** Give up on a page that never arrives. */
  updateMs: 4000,
  /** Back/Forward mirror only within this share of a screen of scroll; further uses the sweep. */
  near: 0.5,
} as const

const INTRO = { meet: 0.18, fly: 0.6, liftLead: 0.4 } as const

export const intro = {
  ...INTRO,
  draw: { letter: 0.3, stagger: 0.1, fill: 0.25, ease: 'power1.inOut', fillEase: 'power2.out' },
  /** The doodled marks around the name. */
  marks: { start: 0.15, draw: 0.4, stagger: 0.08, leave: 0.35 },
  /** The bento building as the slab lifts; `y` in px. */
  assemble: { y: 34, scale: 0.94, duration: 0.55, stagger: 0.035 },
  /** The page border drawn as the name lands (desktop only). */
  frame: { draw: 0.9, delay: 0.1 },
  /** Wait for GSAP and fonts; past this the plain reveal runs. */
  loadTimeoutMs: 1500,
  /** Added to the watchdog: everything before the lift, plus the flight. */
  budgetMs: Math.round((1.2 + INTRO.meet + INTRO.fly + 0.8) * 1000),
} as const

/** Theme switch. The page flood's timings live in main.css (`--vt-*`). */
export const toggle = {
  throw: 0.45,
  rays: { duration: 0.3, stagger: 0.025, delay: 0.2 },
  retract: { duration: 0.25, stagger: 0.02, lead: 0.1 },
} as const

/** ProjectsTeaser's pile of covers. */
export const deck = {
  deal: 0.05,
  open: 0.5,
  close: 0.35,
  tick: 0.14,
  hold: 1.4,
} as const

/** WorkCard's live screens. */
export const screen = {
  lead: 0.25,
  wipe: 0.6,
  hold: 1.3,
  close: 0.4,
  /** A phone's "hover": IntersectionObserver margin for the middle band of the viewport. */
  band: '-38% 0px -38% 0px',
} as const

/** StackTower / useTowerPhysics. Block size and the five-course width live in StackTower.vue's CSS. */
export const tower = {
  /** Wide cards use the CV's groups instead (`towerCourses` in data/skills.ts). */
  narrowCourses: [5, 4, 4, 3, 3],
  build: {
    stagger: 0.045,
    /** Fraction of a block. */
    bounce: 0.07,
    bounceTime: 0.07,
    /** Builds anyway after this long on screen if the heading never lands. */
    failsafe: 2,
  },
  /** px/s², shared by the GSAP falls and Matter.js so both fall alike. */
  gravity: 3200,
  /** Matter.js units. */
  physics: {
    friction: 0.55,
    frictionStatic: 1,
    frictionAir: 0.012,
    restitution: 0.12,
    density: 0.002,
  },
  /** The recorded fall played backwards: `speed` × real time, clamped to `min`..`max`. */
  rewind: {
    delay: 0.45,
    speed: 2.4,
    min: 0.5,
    max: 1.4,
    ease: 'sine.inOut',
  },
  /** px per step. */
  poke: { lift: 7, spread: 3.5 },
  /** Phone scroll acceleration felt by the blocks: `gain` scales page px/s², `max` caps it. */
  shake: { gain: 0.35, max: 7000, wake: 1500 },
  touchRest: 1.1,
  /** Heading names the touched block after `dwell`; a tap's name holds for `hold`. */
  name: { dwell: 0.15, hold: 1.6 },
  /** Frames; a longer game is halved into it so the rewind always reaches the built tower. */
  maxFrames: 2400,
} as const

/**
 * CardSlider once GSAP has the track. A swipe is a drag past `distance` px OR a flick over `flick` px/s,
 * measured over the whole gesture: Observer's per-frame `tolerance` changes with refresh rate.
 */
export const slider = {
  duration: 0.6,
  swipe: { distance: 48, flick: 600 },
} as const

/** GalleryInk: handed to CSS as custom properties; at rest the ink is simply there. */
export const annotation = {
  turn: slider.duration + 0.15,
  arrive: 0.2,
  draw: 0.8,
  /** Share of the ring drawn before the words start. */
  labelAt: 0.7,
  label: 0.4,
} as const

/** Scroll reveals. */
export const reveal = {
  /** px */
  y: 12,
  duration: 0.5,
  stagger: 0.06,
  // Not 85%: lower, and the last row on a page that barely scrolls can never reach the trigger.
  start: 'top 92%',
  /** Show everything if the GSAP chunk never arrives; no path may end with content hidden. */
  loadTimeoutMs: 2000,
} as const

export const caseStudy = {
  count: 1.4,
  countStagger: 0.12,
  step: 0.4,
  draw: 0.35,
  /** Share of a part on screen before it plays. */
  inView: 0.35,
} as const

/** ProjectTour. The step-inside zoom is scroll-driven; its length is the spacer's, in CSS. */
export const tour = {
  rope: { draw: 0.5, hold: 0.9, fade: 0.4 },
  /** `to` is a width in px. */
  resizeDemo: { to: 600, settle: 820, duration: 1.4, pause: 0.35 },
  /** px; Shift takes the big step. */
  resizeStep: 40,
  resizeBigStep: 160,
  deal: { duration: 0.7, stagger: 0.14 },
} as const

export const kinetic = {
  // Translate only per character: a scaled glyph outgrows its own mask, is cropped, then snaps.
  chars: {
    yPercent: 120,
    stagger: 0.02,
    duration: 1.1,
    ease: 'expo.out',
  },

  // Scaling the whole element is safe: the masks scale with the glyphs.
  rise: {
    scale: 1.06,
    duration: 1.2,
    ease: 'expo.out',
  },
  lines: {
    yPercent: 110,
    stagger: 0.05,
    duration: 1,
    ease: 'expo.out',
  },
  // Arabic masks clip 0.4em further out (`.u-mask-room`); 140% starts every piece below that edge.
  room: { yPercent: 140 },
  scramble: {
    duration: 0.9,
    /** Latin only; Arabic is never scrambled. */
    chars: 'upperCase',
    speed: 0.4,
  },
  start: 'top 88%',
} as const

/** /about hairlines wiped in after their row; `lag` counts from the row reaching full opacity. */
export const rule = { wipe: 0.6, lag: 0.15 } as const

/** Signed hero hover (useSignedName). */
export const signed = {
  drop: { duration: 0.3, stagger: 0.04, ease: 'expo.in' },
  /** How much faster the unwrite runs than the write. */
  unwrite: 1.6,
} as const

/** Cursor disc. px and seconds. */
export const cursor = {
  size: 28,
  follow: 0.12,
  /** Diameters in px, applied as a scale of `size`: a width change would re-centre it. */
  states: {
    link: 44,
    drag: 56,
    view: 48,
    /** The tower's push body has this same diameter. */
    push: 40,
  },
} as const

export const swap = {
  duration: 0.35,
  yPercent: 110,
} as const

export const tick = { draw: 0.35, ease: 'power2.out' } as const

/** Contact card. `shake.x` is px. */
export const contact = {
  shake: { x: 6, duration: 0.42 },
  roll: { duration: 0.5, yPercent: 110 },
  post: { duration: 0.45, ease: 'power2.in' },
  unpost: { duration: 0.45 },
  tickAt: 0.2,
  /** How far the row trails the heading when the card turns over. */
  turn: 0.08,
  pen: { arrive: 0.8, fade: 0.4, focus: 0.45, lift: 0.3, ease: 'power2.inOut' },
  /** `emailChars`/`messageChars`: characters at which the rule is full; `ready`: message length that may send. */
  rule: { duration: 0.35, ease: 'power2.out', emailChars: 22, messageChars: 32, ready: 2 },
} as const

/** InkLayer: the pressed state of the copy chip and the contact card's buttons. */
export const ink = {
  flood: { duration: 0.5, ease: 'power3.out' },
  drain: { duration: 0.35, ease: 'power2.in' },
  stamp: { scale: 0.96, down: 0.08, up: 0.4, ease: 'back.out(3)' },
  touchHold: 0.3,
  pulseHold: 0.12,
  /** Latin only: the address is Latin in both languages, and Arabic is never scrambled. */
  decode: { duration: 0.6, chars: 'lowerCase', speed: 0.5, revealDelay: 0.1 },
  decodeMinPx: 11,
  /** On a tap, how long the decoded address shows before the thanks. */
  touchReveal: 1.3,
} as const

/** Pointer parallax. px and seconds. */
export const parallax = {
  // Travel must stay under `--parallax-overscan` (8px, in CSS) or the picture's edge shows.
  media: { x: 6, y: 4, follow: 0.6 },
  portrait: { x: 4, y: 3, follow: 0.8 },
  signature: { x: 3, y: 2, follow: 0.6 },
  spotlight: { follow: 0.25 },
} as const

/** Border snake. Lengths in px, speeds in px/s, times in seconds. */
export const snake = {
  /** Unlike `BENTO_BLOCKS`, includes the hero. */
  cards: '.u-card, .work, .avatar, .icon',
  /** The rope's length. */
  body: 80,
  /** Core first: `stretch` × `body`, `width` in px; later layers are longer, finer and fainter. */
  layers: [
    { stretch: 1, opacity: 1, width: 2.2 },
    { stretch: 1.25, opacity: 0.6, width: 2 },
    { stretch: 1.5, opacity: 0.36, width: 1.7 },
    { stretch: 1.8, opacity: 0.2, width: 1.4 },
    { stretch: 2.1, opacity: 0.11, width: 1.1 },
    { stretch: 2.45, opacity: 0.06, width: 0.8 },
    { stretch: 2.8, opacity: 0.03, width: 0.6 },
  ],
  /** Spacing of the rope's polyline points. */
  sample: 2,
  /** Top speed of the head. */
  speed: 560,
  /** px/s² */
  accel: 1500,
  /** px/s²; braking at sqrt(2 × decel × remaining) is what stops any overshoot. */
  decel: 1400,
  /** Share of speed kept when a new route doubles back on the old one. */
  turnaround: 0.15,
  /** Time for the bright end to travel down the rope when the tail takes over. */
  flip: 0.18,
  /** Least time between back-ups; re-deciding every frame makes it oscillate. */
  backUpHold: 0.4,
  /** Least time between turnaround dampings; compounding them stalls the light. */
  turnHold: 0.25,
  /** The tail leads when it is this much closer, as a share of the whole rope. */
  backUp: 0.3,
  bridge: {
    /** Through a pipe. */
    speed: 200,
    /** Added per pipe: what a crossing costs in time at the cap. Re-derive if speed/accel/decel change. */
    cost: 120,
    /** The waist's narrowest width. */
    gap: 10,
    /** Narrower gutters keep the crossing but draw nothing, so the routed and drawn graphs agree. */
    min: 2,
  },
  /** Neighbours: spans overlap by ≥ `overlap` on one axis, ≤ `gap` apart on the other. */
  grid: { gap: 40, overlap: 8 },
  // Widened from the literal: the engine compares against all three.
  idle: 'frame' as 'fade' | 'orbit' | 'frame',
  orbit: 80,
  /** Still-pointer time before the light walks on its own. */
  settle: 0.4,
  /** Falls back to the card orbit when the frame is larger than the window. */
  frame: { speed: 160 },
  /** Touch: the reader's line stands in for the pointer. */
  follow: {
    /** Share of the viewport height, from the top. */
    line: 0.45,
    /** Viewports of scroll over which the line eases to the first and last rows. */
    ramp: 0.5,
    /** Beyond a row's band before the next row takes over. */
    hold: 32,
    orbit: 150,
    /** Share of a lap before stepping to a neighbour; must exceed rope / smallest tile perimeter or the last join never closes. */
    turn: 0.5,
    /** Aimed past the door on arrival. */
    enter: 32,
    /** Beyond `far` of route, speeds scale by up to `max`; keep `max` < 4 so one 60Hz step stays shorter than the core. */
    run: { far: 240, max: 3 },
    /** Share of viewport width, clamped to px. */
    body: { ratio: 0.22, min: 72, max: 120 },
    /** Layer reach as a share of the desktop's: 1 + (stretch - 1) × tail. */
    tail: 0.6,
    /** Scroll below which there is no column to read; the pointer orbit takes over. */
    floor: 240,
  },
  join: {
    /** Each border's curve into the gutter; under ~2× `bridge.gap` the waist reads as an eye. */
    reach: 28,
    /** Ahead of the mouth at which it starts to open. */
    open: 48,
    /** Time to open or close. */
    ease: 0.22,
    /** Opacity of the ink over the lips as the light passes. */
    lit: 0.7,
  },
  fade: 0.3,
  /** Further than this from every card, `idle` takes over. */
  activation: 150,
  /** Deadband before switching sides of a card: its diagonals are equidistant from two sides. */
  edge: 18,
  /** How much closer a new card must be to take over. */
  threshold: 24,
  /** Half the 1px border, which is drawn inside the box. */
  inset: 0.5,
} as const

/**
 * Shared by the intro (on screen) and the reveal engine (below the fold): one definition, or a block is owned by both or neither.
 * Excludes the hero, the signature's anchor.
 */
export const BENTO_BLOCKS = '.u-card:not(.info), .work, .intro__photo, .icon'

/** Projects index. GSAP writes `--row-focus` and CSS applies it, so `:hover` still wins; ProjectItem's CSS keeps its own no-JS literal. */
export const index = {
  /** Opacity at the viewport edge. */
  floor: 0.42,
  /** How much a fully dimmed row shrinks, as a fraction. */
  recess: 0.06,
} as const

// Never character-split text matching this: it breaks Arabic joins.
export const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/

// The watchdog must use these spans, not raw durations: staggered panels lengthen the cycle.
export const spanClose = (panels: number) => curtain.close + (panels - 1) * curtain.stagger
export const spanOpen = (panels: number) => curtain.open + (panels - 1) * curtain.stagger

export const watchdogFor = (panels: number) =>
  spanClose(panels) + curtain.hold + spanOpen(panels) + curtain.watchdogGrace
