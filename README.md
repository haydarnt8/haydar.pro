# haydar.pro — Haydar Yosef's portfolio

**Live:** [haydar.pro](https://haydar.pro) in English, and [haydar.pro/ar](https://haydar.pro/ar) in
Iraqi Arabic, right to left.

A bilingual portfolio for a frontend developer, built with **Nuxt 4** and hand-written Vue
single-file components, and generated as a static site (hosted on Netlify). The layout
reimplements a purchased Framer template, **BentoX by Tamer Magdy**, outside Framer; the
places it departs from the template are listed below.

What is in it:

- **Every project page is a guided tour** (GSAP, DrawSVG): the camera steps into the cover's
  screen, the steps scroll beside a sticky screen, a rope runs from each step to the part of
  the shot it names, and a slider narrows the screen into the app's phone layout.
- **English and Arabic as mirror images**, with the Arabic written in Baghdadi dialect, not
  translated word for word.
- **Motion that reads as physical**: the drawn intro, a border-snake rope over the home
  cards, a knock-down tower of the tech stack (Matter.js), and a calm path for Reduce Motion.
- **Client work shown honestly**: every screenshot is blurred because the work is under NDA,
  each one carries a ring and a few words saying what it shows, and the sharp copies are not
  in this repository.
- **Tested like a product**: a Playwright matrix in Chromium and WebKit, on desktop and
  phone, with and without reduced motion, plus a Lighthouse baseline and an accessibility
  pass on every page.
- **A CV generated from the same data**, so it cannot say what the site does not.

Stack: Nuxt 4 · Vue 3 · TypeScript · Tailwind CSS 4 · GSAP 3 · Matter.js · @nuxtjs/i18n ·
nuxt-og-image · Playwright · Lighthouse.

Licence: the code is [MIT](LICENSE). Haydar's portrait, photos and CV, and the projects'
write-ups and screenshots, are his own content and are not covered by it.

## Quick start

```bash
pnpm install
pnpm dev                        # dev server
pnpm build                      # production build → .vercel/output/static
pnpm generate                   # same, explicit static generate
pnpm exec nuxi typecheck
pnpm verify                     # generate → Playwright matrix → Lighthouse against the baseline
pnpm verify:e2e                 # the Playwright matrix alone, against an existing build
pnpm verify:lh                  # Lighthouse alone; `--save` records a new baseline
node scripts/verify/a11y.mjs    # every failing accessibility audit, by element
pnpm cv                         # the CV, rebuilt from app/data → public/Haydar-Yosef-CV.pdf
```

Requires Node 22+, pnpm 10+ (the CV script imports the data's `.ts` directly, which needs
Node 23.6+). The harness needs Playwright's Chromium once:
`pnpm exec playwright install chromium`.

**The CV is generated, never edited by hand.** `scripts/cv/build.mjs` reads the same data the
site renders: his CV's own summary, the jobs verbatim, the eight projects (each linked to its page
on the site), skills and education.
So it cannot say what the site does not. Run `pnpm cv` after changing any of it, and commit the
PDF. It is a text PDF in Arial, because in DM Sans text extraction split every run of capitals, and
résumé scanners find a CV's sections by their headings. Each job reads its title, then "employer ·
dates", then the rest, because right-aligned dates were read after the bullets. It was tested on two
résumé parsers (Affinda's and OpenResume's, 2026-10-01). The rules that came out of that, among
them why projects show no role, are at the top of `scripts/cv/build.mjs`.

**The phone number is published,** at Haydar's request (2026-09-30), reversing "Phone on site: No".
It is `profile.phone` (as he wrote it). The CV, the `tel:` tile that took Telegram's place in the
social grid, the WhatsApp link (`wa.me` needs the number; it was a username that did not resolve)
and the JSON-LD `telephone` are all made from it.

## Icons

Haydar's portrait, close on the head, on `--color-surface` with a disc in `--color-lamp`.
The source is `design/logo/haydar-portrait.svg`. Regenerate with:

```bash
node scripts/generate-icons.mjs        # favicon.ico, apple-touch-icon.png, icon-192/512.png
python3 scripts/generate-noise.py      # the grain tile; deterministic, rarely needed
```

The cut is measured on the picture (the head's width above the shoulders), so a new portrait
gets the same one. The PNGs are 256-colour palettes, a third to a quarter of full colour's
bytes; the ICO container is written by hand. `public/placeholder.png` is the old `HY` mark,
kept as the stand-in for a project without screenshots.

The same script makes every other copy of the portrait, so the pages never load the 1.8 MB SVG:

| File | Size | Where |
|---|---|---|
| `public/portrait/og.png` | 37 KB | the link-preview card, at its far edge (right in English, left in Arabic) |
| `public/portrait/avatar.webp` | 8 KB | the 404 page's badge, and beside the contact card's reply |
| `design/logo/exports/avatar-{400,1024}.png` | | profile pictures for GitHub, LinkedIn and so on; not committed |

## Words

Both languages speak in Haydar's own voice: first person, short sentences, plain and warm,
and every claim is the CV's (`design/HANDOFF.md`). The interface lives in `i18n/locales/`,
the content in `app/data/` as `{ en, ar }` pairs; names — his, the companies', every
technology's — stay in Latin letters in both. The Arabic is Iraqi — Baghdadi dialect, the
way he talks (اني، هسه، شدا أسوي، دزلي) — and speaks to one visitor, as he chose.

`content.spec` holds it there: no English word a visitor can read or hear on an Arabic page
(text, `alt`, `aria-label`, `title`, `placeholder` — only names pass), no Arabic on an
English one, and the lines with fixed slots still clear their cards: the hero line, the
About line, and the contact card's heading and thanks, which share one slot.

## Unwritten content

Gaps are **marked, never invented**. A believable fake project write-up is exactly the kind
of placeholder that ships by accident and misstates someone's work to an employer, so every
gap renders as a visible "Coming soon" badge ("قريبا" on `/ar`) instead. Each stub is written
in both languages, and both halves carry the `TODO:` marker.

```bash
grep -rn "stub(\|todo(\|ROLE\|DESCRIBE" app/data/   # every unwritten field
```

Nothing is owed: every field is written, from the CV, the projects' own write-ups and
Haydar's own photos for the /about gallery (published with their location data stripped).

A project without screenshots would fall back to `/placeholder.png`, the old `HY` mark, so it
can never be mistaken for a screenshot of real work; `isPlaceholderImage()` keeps it out of the
accessibility tree and gives it an empty `alt`.

## Lighthouse

Measured by `pnpm verify:lh`: the static output served **gzipped** on a local port,
Lighthouse 13 through the node API, three runs per route and preset, medians reported.
The numbers live in `scripts/verify/baseline.json`, and the run fails on a **regression**
against them rather than on a goal — the goals are printed as "still short of" lines, so a
score that was never met cannot block a change that made nothing worse. Accessibility is
read in its own pass on the settled page (`scripts/verify/lib/settled.mjs`): axe folds
opacity into its contrast ratio, and Lighthouse's own timing catches this site mid-entrance.

Recorded 2026-09-16:

| route | performance mobile / desktop | accessibility | best practices | SEO | mobile FCP · LCP · TBT · CLS |
|---|---|---|---|---|---|
| `/` | 85 / 98 | 100 | 96 | 100 | 2.9s · 3.3s · 43ms · 0 |
| `/about` | 86 / 97 | 100 | 96 | 100 | 2.9s · 3.2s · 44ms · 0.007 |
| `/projects` | 89 / 98 | 100 | 96 | 100 | 2.4s · 2.6s · 12ms · 0.112 |
| `/projects/gudea-event-dashboard` | 85 / 98 | 100 | 96 | 100 | 2.4s · 2.7s · 12ms · 0.151 |
| `/ar` | 81 / 98 | 100 | 96 | 100 | 3.3s · 3.6s · 46ms · 0.018 |

How to read it:

- **Compression is the biggest single factor.** Served uncompressed the same build scores 77
  on mobile. Netlify serves brotli, so the deployed figure should be at least the gzipped one.
  Measure again after the first deploy rather than trusting a local number.
- **Mobile performance is bounded by the fonts and the ~60KB GSAP chunk** arriving over a
  simulated slow 4G with a 4× CPU slowdown. Desktop is unthrottled.
- **Best Practices 96 came from the analytics.** Its only failure was two console errors:
  `/_vercel/insights/script.js` and `/_vercel/speed-insights/script.js` returning 404, paths
  that only Vercel's platform serves. The site is hosted on Netlify, where they 404'd for
  every visitor and recorded nothing, so both scripts were removed (2026-09-28).
- **The mobile CLS on `/projects` is a webfont swap** on the row titles, recorded and not yet
  fixed.

## Architecture

```
app/
  assets/css/main.css   design tokens — Tailwind v4 @theme, light + dark — and the motion
                        tokens CSS reads (durations, eases, --vt-*)
  components/           one SFC per Framer section, plus primitives; TheCurtain, TheIntro
    OgImage/            build-time social card (satori)
  composables/          the motion engines — useCurtain, useReveal, useIntro,
                        useGsap, usePointerParallax, useTextSwap — and the JSON-LD Person
  config/motion.ts      every number the motion runs on
  data/                 all content, typed
  pages/                /, /about, /projects, /projects/:slug
  plugins/              the curtain (client only) and the v-reveal directive (universal)
  types/portfolio.ts    content types + the todo()/isTodo() helpers
  utils/period.ts       the single date formatter
design/
  DESIGN-AUDIT.md       what the Framer design actually is, and every decision
  HANDOFF.md            the CV, transcribed: the source of the site's claims
  CONTENT-GAPS.md       what the CV cannot fill
  raw/                  gitignored Framer MCP dumps
docs/curtain-demo.html  the approved curtain choreography; config/motion.ts froze its numbers
scripts/verify/         the regression harness — Playwright suites, Lighthouse gate, a11y lister
```

**Rules that hold throughout:** no raw hex or arbitrary px in components — tokens only (the
two exceptions are commented where they occur); one `<h1>` and one `<main>` per page; `alt`
on every image; every text/background pair meets WCAG AA in both themes; every touch target
is 24px; the rules under *Motion* below.

**The type ramp is a breakpoint variant, not a scale.** Framer sets a smaller ramp below
810px and the build used the desktop one everywhere, so a phone read 32px headings where the
design has 24. The sizes live as custom-property overrides in `main.css`, so every `text-h1`
and `u-label` call site follows without knowing about it; the table in that block is the
measurement.

**The grain is a raster tile** (`public/noise.png`, generated by `scripts/generate-noise.py`
from the design's measured distribution — 256×256, monochrome, 16 levels, tiled at 64px at
8%). It textures the page and the surfaces, never what is on them: the page's own layer is
fixed UNDER the content, and every raised surface carries the same tile, with the 8% already
in its alpha (`grain.png`), as a layer of its own background. It used to be one layer over
everything, which grained every screenshot and photo too. It was an SVG `feTurbulence` filter, which is *colour* noise and
centres near white: 94% of its pixels carried a visible hue against the design's 0%, at mean
luminance 186 against 75.6 and half the contrast. It read as a pale haze lifting the page
toward grey rather than a texture sitting on it.

**Every edge the design draws, and the width it draws it at.** Cards, social tiles, the
gallery frame and the portrait carry a 1px `/Border 2` hairline; the arrow badge, the
button, the theme pill and the close button a 2px `/Border 3` ring; the newsletter field a
2px inset ring. The copy chip, the stack tiles and the newsletter submit are fills with no
line at all. Framer draws its borders on `::after` overlays, so reading `borderTopWidth`
off the elements reports `0px` and the design looks border-free — on that reading the
hairlines were removed from the whole site before anyone noticed. `edgesMatchTheDesign()`
in the harness asserts the widths, in both themes, on every page; a *missing* border is a
regression too, and it is the kind no screenshot diff catches.

`design/DESIGN-AUDIT.md` is the reference for why anything looks the way it does, including
the places the build deliberately departs from the template.

## Deliberate departures from the Framer template

1. **Work-card titles are always visible.** The template revealed them on hover only, which
   left the cards as unlabelled images on touch devices. On a pointer they rest as a 15px
   caption, and grow on hover. A tight text shadow keeps them at 4.5:1 or better over the
   brightest cover (measured from the pixels in `home.spec`); before it, EMP and DMIS sat
   on a laptop's white screen at 1.6–3.2:1.
2. **The profile photo is kept at mobile width.** The template drops it entirely.
3. **The social grid is kept below L, where the template drops it** — 3×2 on a phone,
   instead of a single row whose sixth icon ran off the screen edge. At tablet width it
   takes the design's own arrangement, one row of six.
4. **Project pages exist at `/projects/:slug`, with their write-ups marked.** The template's
   `/work/:slug` needs four images and four rich-text sections per project; the pages are
   built around that shape, with the gallery, role and summary rendered as visible TODOs
   rather than invented.
5. **Two colour tokens were darkened** to meet WCAG AA — the template's values failed.
6. **The Resources section and the blog were dropped** (a paid-products store with a required
   price field; nothing to sell), taking `@nuxt/content` with them.
7. **The home bento has a border snake.** One run of ink rides the edges of the cards,
   travelling to wherever the pointer is. **Its body is the path its head has travelled**,
   trimmed to a fixed 80px — not a dash on a rectangle, which is what it was for three phases
   and which could not be made right. A dash lives on one rect, so a run crossing a 16px
   gutter had to be drawn as three pieces on three elements made to abut by arithmetic, and a
   run moving from the 1418px hero to a 292px tile had to change length, and did, visibly,
   every time. A rope is continuous across a gutter for the same reason it is continuous
   anywhere, and its length is the one thing about it that is fixed.

   The bento is modelled as a GRAPH — two cards are neighbours when their spans overlap on one
   axis and the gap on the other is about a gutter — and **nothing of that graph is drawn at
   rest.** Walls, subtracted openings and crescent recesses were all tried, and at real scale
   every one of them is a few pixels of permanent mark on a 1px border, which reads as dirt or
   as nothing; that was measured against four candidates at real size, not decided by taste.
   What happens instead happens only while the light is near: **the two facing borders soften,
   bow toward each other and join into an hourglass waist**, the light passes through the
   throat, and they let go. The lips are the border's own token flowing into the neck and the
   cover is the page reaching through, so the join is border and not ink, and it closes behind
   the snake. A crossing's two feet are the only doors between two cards, so the light goes
   *through* one or it does not get there; route planning is shortest-path over those doors with
   a price on each — `bridge.cost`, what a crossing costs in *time* written as the distance the
   light could have covered instead. Every step is still between two cards that touch. When
   nothing is asking, the light leaves the grid the same way, through a join out to the page's
   own frame, and runs round that.

   Three things follow from planning the whole way rather than one hop at a time. **It knows
   how far is left**, so the head brakes to arrive — `sqrt(2 · decel · remaining)` is the speed
   that stops in exactly the distance available — landing on the pointer instead of easing
   towards it forever, and the same formula against a pipe's mouth with the bore's pace as its
   terminal speed is what makes a crossing a step rather than a jolt. **A change of mind moves
   the finish line** rather than restarting a hop, so a flick across the grid is one journey
   with the destination re-aimed on the way, and there is nothing left for a dwell to suppress.
   And **it can back up like a train**: point back the way it came and the end already nearest
   simply starts leading, because a rope on a narrow ledge does not turn round. When nothing is
   asking within the page it keeps walking the card it was left on. Leaving the window or
   losing focus hands the light out through a door to the page's own frame, which it circles
   until a pointer moves; hiding the tab fades it. A resize lays the rope again on the new
   layout, whether or not the pointer is there: the rope is kept in page coordinates, and
   the old points would otherwise be joined to the new ones by one straight line.

   **On phones and tablets the reader is the pointer.** The light circles the card in
   the row being read — a line 45% down the screen — and when the reader scrolls on it
   walks to the next row with the same router, doors and brake as the desk; after a
   flick it runs to catch up (`follow.run`), still walking every card between. On a row
   of two or three cards it takes turns: most of the way round one, then through the
   door to the next, back and forth for as long as that row is read. It never stops,
   so it never freezes into a still bracket, and since it always finishes on a card it
   never leaves a join half-open. The rope is shorter on a touch screen (86px at 390,
   from `follow.body`) with a shorter tail. This replaced a version the scroll *drew* —
   one serpentine path, the head's place read off the scroll — which on a real iPhone
   froze whenever the reader stopped, darted sideways across rows, and left a faint
   line in every gap. A pinned landscape tablet, with nothing to scroll, walks the card
   it was left on instead.

   The template's `Border` is static and locked (audit §9), so this is ours, in the same class
   as the hero that signs itself. Neither branch ever rides a card the reveal has not released,
   and an opening is only drawn where both of its cards have arrived. Nothing wakes it until
   something has actually asked: `0,0` is not where the pointer is, it is where nothing is.
8. **Carousel dots sit 24px apart, not 8px.** An 8px dot 8px from the next cannot be hit by a
   finger and fails WCAG 2.5.8 whatever is hidden behind it; the dots themselves stay 8px.
9. **The stack card is a tower, not a marquee** (the design's `Ticker`, audit §9). Haydar
   chose it over an exploded view, a keyboard and a split-flap board: see *The home page's
   playthings* below.
10. **The work cards' screens play, and the projects card holds a deck** of every project's
    cover. Neither exists in the template; both are Haydar's picks.
11. **The cursor says what a press will do** where that is unusual: View, Push, Drag, in the
    page's language. The design's disc is kept for everything else.
12. **A project's shots say what the blur hides**: a ring drawn round what each shot's
    caption names, and a few of the caption's words beside it. Haydar's pick (2026-09-28),
    on every shot of every project; see *Ink on the gallery* below.
13. **Every project page is a guided tour** (2026-10-08), not the design's detail page; see
    *The guided tour* below.

## Motion

Seven runtimes, one job each, and the job is written where the code is:

| runtime | owns |
|---|---|
| **CSS** | rest states and two-state hovers — every transition that has a before and an after and nothing in between worth choreographing — and the gallery's ink, a dash run out along each ring (`GalleryInk.vue`) |
| **GSAP 3.15** | entrances (scroll reveals, kinetic type), the drawn intro and the hero that signs itself under the pointer (the same pen, `useSignature.ts`), the theme toggle's morph, the carousels once touched, pointer depth, the cursor, the border snake, the contact card's steps (`useContactMotion.ts`), the ink pressed into every button that reaches Haydar and into the social icons (`InkLayer.vue`), the tower's arrival and its rewind, the work cards' screens, the projects card's deck |
| **Matter.js** | the stack card's tower once it is touched: rigid bodies, friction, the hand that pushes it (`useTowerPhysics.ts`). Fetched on the first contact on a desk and when the card comes into view on a phone, never with the page |
| **CSS scroll timelines** | a phone's depth: the work covers and the portrait lag their frames as the page scrolls (`animation-timeline` on the card's named view timeline). No script at all, and nothing where the engine lacks them |
| **Web Animations API** | the route curtain, and the language switch — a mirror: every card on screen is carried across to its reflection and set down in the other language (`useMirror.ts`; the curtain's sweep wherever it cannot run). Both compositor-driven, so they keep moving while the next route builds on the main thread |
| **View Transitions** | the theme flood |
| **Vue state** | `inert`, `aria-*`, the live regions, the dots: everything that has to stay true whichever engine moves the pixels |

Rules every engine keeps. Each is a comment where it applies, and each is an assertion in
`scripts/verify/lib/assert.mjs`:

1. **Nothing animates on `#stage`, `.shell`, `.wrap` or any ancestor of the grain.**
   `NoiseOverlay` is `position: fixed`; a transformed ancestor becomes its containing block
   and the grain silently starts scrolling with the page. Blocks only. (`grainStaysFixed`)
2. **CSS owns rest, GSAP owns transition.** Every tween ends with `clearProps`; the page
   afterwards is identical to one where it never ran. One documented exception whose
   transform *is* its state: the carousels' track. The border snake needed no second: it
   writes its geometry as SVG ATTRIBUTES and fades on a class, so it holds no inline style
   at any point in its life. Nor did the tower, which looks like one: however it is knocked
   about, it plays its own fall back onto its marks and hands every block back clean.
   (`noInlineMotionLeft`)
3. **Nothing is ever left hidden.** Failsafes, watchdogs and a visibility sweep stand behind
   every entrance; the curtain always ends open and never leaves the page `inert`.
   (`nothingHiddenInView`, `curtainEndsOpen`)
4. **Every JS motion carries its own reduced-motion gate.** The CSS media block has no
   authority over a tween. Under stillness the tower stands still, the screens stay covers,
   the deck stays a pile, the gallery's ink is simply there, the intro never plays, the
   carousels cut, the cursor is not built.
5. **Touch and keyboard parity.** Nothing a mouse reveals is hidden from a finger or Tab;
   hover choreographies mirror `:focus-within`; the cursor and pointer depth exist only for a
   fine pointer that can hover. Wherever the keyboard is, it shows: a card that clips its
   own link (the work cards) wears the focus ring itself, and `focus.spec` shoots every Tab
   stop focused and blurred to prove it. The home page's markup is in reading order, the
   phone's stack, and one grid places the desktop, so Tab and a screen reader follow the
   page as it is shown; `bento.spec` holds that grid to the layout it replaced, to half a
   pixel. The border snake instead has a second input: on a touch
   screen the row being read drives it, because what a reader is looking at is the honest
   answer to the question a pointer would otherwise be asking.
6. **Every horizontal motion carries a sign.** `translateX` is physical and `dir="rtl"` does
   not mirror it — see the table below.
7. **Numbers live in `app/config/motion.ts`**, eases in one registry, media queries in one
   place. Plugins load per feature through one loader (`useGsap.ts`).

### Right-to-left

Arabic is not a translation of the English page but the same page run the other way, and a
sign is only ever right or wrong. Every directional motion, with where its sign comes from:

| motion | sign source |
|---|---|
| The language switch: each card crosses to its mirrored place, the first to leave from the new language's reading side, row by row | `useMirror.ts` — the reading order of the NEW language, from the target locale's `dir`; where a card lands is the new layout's own |
| Curtain panels close from the reading start and open toward it; blinds stagger in reading order; the sweep (the language switch's fallback) enters from the new language's reading side | `useCurtain.ts` — `ctx.dir`, from the target locale's `dir` |
| Curtain label | `TheCurtain.vue` — `direction: state.dir` |
| Intro frame, drawn from the reading-start corner | `DecorativeFrame.vue` — `.u-rtl-mirror` (mirrored invisibly; the shape is symmetric) |
| Headings settle from the reading edge | `useReveal.ts` — `transformOrigin` from computed `direction` |
| Hairlines wipe in from the reading edge | `useReveal.ts` — same |
| Carousel track moves toward the reading end; swipe and arrow keys swapped | `CardSlider.vue` — `--slider-dir` on `[dir='rtl']` for the rest state, `fwd` from the locale for GSAP, keys and swipe |
| The tower is laid in the CV's order from the reading start | `StackTower.vue` — `inset-inline-start`; the physics measures what the stylesheet laid, so it needs no sign |
| The deck deals from the reading-start corner and fans toward the reading end | `ProjectsTeaser.vue` — `--dir` on `[dir='rtl']` |
| The work cards' screens, a phone's depth | none — a page renders top to bottom in any language, and a scroll is vertical |
| Theme knob throws toward the reading end | `ThemeToggle.vue` — `--knob-dir` on `[dir='rtl']` |
| Work card: the badge arrives from the reading side, rule and title grow from the reading edge | `WorkCard.vue` — `--rtl-x` and `transform-origin` on `[dir='rtl']` |
| Arrow glyphs on badges, buttons and slider arrows | `.u-rtl-mirror` |
| The signed hero's letters drop last-first and the hand is written left to right on every page | none by design — a Latin signature has one way of being written (`useSignedName.ts`) |
| The cursor, pointer depth | none — geometry and the physical pointer carry no sign |
| The contact card: a sent message leaves through the field's far edge, toward the button; the way back points to the reading start | `useContactMotion.ts` — none needed: the message moves by `text-indent`, which is logical; the steps roll vertically; the back caret is `.u-rtl-mirror` |
| Ink on the copy chip and the contact buttons: from the pointer's entry and out at its exit; from the reading start for the keyboard | `InkLayer.vue` — a pointer carries no sign; the keyboard's start is the host's computed `direction` |
| The border snake: which way round the card it travels, and where its rungs sit | none by design — it takes the shorter way, which is a question about a circle, not about a language, and a rung is the middle of the space two cards share (`useBorderSnake.ts`) |
| The border snake on a touch screen: its first lap, and which way along a row it takes turns | `useBorderSnake.ts` — the first lap runs toward the reading end (anticlockwise on `/ar`) and each row is kept in reading order, from the container's computed `direction` |

The harness checks the ones that can be watched: swipe and key direction on `/ar`, wipe
origin by geometry, the frame's mirror.

Arabic also sits lower. The entrance masks round each split word and line are one line tall,
and the dots under a final ي hang below that line (by 0.28em in Plex on a label), so they
were cut off and "عني" read "عنى". In an element holding Arabic, `useReveal` swaps
SplitText's `overflow: clip` for a clip-path that reaches past the box (`.u-mask-room`), and
the Arabic entrance starts lower to match (`kinetic.room`). The Latin words beside it,
like the name in the greeting, get a clip-path that hugs them (`.u-mask-tight`). They can't
keep `overflow: clip`, because WebKit sets such a word on its bottom edge rather than its
text, which put the name 11px above the Arabic. `content.spec` holds both.

### The contact card

The home page's form is two steps in one slot: the email first, as the design has it, then
"What's it about?" in the same place, so the enquiry that arrives carries a message and not
only an address. It posts to Web3Forms from the browser (the access key is public by design,
in `runtimeConfig.public`), with a 15-second timeout, the honeypot, and the page's language,
so a reply can be in Arabic when the visitor wrote from `/ar`.

Every state has the same footprint: the email, the message, the thanks and the error trade
places in their slot rather than stacking, so the card never changes size. Forward rolls go
up, back rolls go down; on Send the typed message slides out through the field's far edge
toward the button, and on Try again it slides back in. The answer replaces the form (the
design's own Default → Success), with the same drawn tick as the copy chip (`DrawnTick.vue`),
and the whole card turns over with it: the heading rolls up to the thanks, and the row
follows with the address the reply will go to.

The field is written in with a pen: its outline is drawn in ink on focus and lifts on blur;
its prompt floats up into a small label, by CSS alone (`:placeholder-shown`); and a ruled line
under the text is inked as the visitor writes, completing when the entry is ready, when the
button answers with a pulse of its own ink. The card also arrives written: once its heading
has landed, the pen draws the field and the prompt decodes in. None of it hides anything at
rest, so without script or under Reduce Motion the card is the designed one.
Validation is the browser's own bubble, but in the page's words: left alone it speaks the
browser's language.

Its buttons and the copy chip beside it share one pressed state, ink (`InkLayer.vue`): a
white disc under `mix-blend-mode: difference` floods the button from where the pointer came
in, so the button's own colours invert exactly under it — letters included, whatever they say
— and drains out where the pointer left. A press is a stamp. While the ink is in, the copy
chip's label decodes into the address it copies (ScrambleText, sized to fit the narrow pinned
column); a phone, which has no hover, gets the address as part of the tap, then the thanks. `feedback.spec` asserts each step, the payload, and that nothing moves
under Reduce Motion.

### The home page's playthings

Asked for as "more advanced GSAP" (2026-09-24); each is Haydar's pick from options, and each
is judged by `play.spec.mjs` the way everything else is: by what it leaves behind.

- **The tower** (`StackTower.vue`, `useTowerPhysics.ts`). The nineteen CV technologies are
  blocks, built into a tower in the CV's order: Frontend is the base, state and HTTP on it,
  UI libraries and services on those, the tools on top (five courses of 5·4·4·3·3 on a
  phone's half-width card). It arrives built — every block falls into its place once the
  card's heading has landed, each for as long as its height takes at the tower's gravity.
  A mouse pushes it: the cursor's disc is a body of the disc's own size, eased by the
  cursor's own follow, so what touches a block is what you see touching it; pressing takes
  hold of a block and letting go throws it. Leaving plays the recorded fall backwards onto
  the marks. A finger flicks the block it taps, and a phone's scrolling is felt the way a
  box on a car seat feels the brakes — only the lift, since being pressed into the floor
  shows nothing and made Matter's stack spring. A knocked pile on a phone lies still a
  moment, then plays itself back. **The heading's line names the block you touch.** The
  logos are marks, so the block a resting pointer is on, the one being held or the one a
  finger tapped is named where the heading is, one type step smaller. It rolls in as the
  heading rolls out, with the contact card's roll, and the heading comes back when you
  leave (or 1.6s after a tap). The line already exists, so nothing moves. The name is for
  the eye only, and the heading stays in the accessibility tree meanwhile.
- **The live screens** (`WorkCard.vue`, `quadMatrix`). Hovering a work card turns its
  device on: the project's other screens arrive in it one after another, each rendering
  from the top, in the screen's perspective with the notch and bezel kept, and the camera
  leans in toward the screen. The corners and outline come from the mockup template the
  cover was made from (`portfolio-assets/_tools/screens.py`), so the pages land on the
  screen to the pixel. A phone plays the card in the middle of the screen.
- **The deck** (`ProjectsTeaser.vue`). Every project's cover, as a pile of cards in the
  corner of the projects card; a hover deals them into a hand while the heading's number
  counts them out. A phone deals the hand once, when the card comes into view.
- **Ink on the social icons.** The design's brand fill, arriving as ink: it floods from where
  the pointer came in and drains where it left (`InkLayer.vue`, `tone="brand"`).
- **A phone's depth** — the work covers and the portrait lag their frames as the page
  scrolls, on CSS scroll timelines.
- **Cursor words** — View over a work card, Push over the tower, Drag over a carousel, in
  the page's language.

### The screenshots are blurred, on purpose

The projects are client work under NDA. Every gallery screenshot was re-shot with invented
data and marks, and is then published blurred (Gaussian, radius 12 at 1600px) so it shows
the interface and nothing it says; every cover's *screen* is blurred the same way, by
rebuilding the cover from its own template (`_tools/blur.py`, `_tools/blur-covers.py`, both
in portfolio-assets, which keeps the sharp copies). Every project page says so before its
first shot: on the tour's screen from 1200px, and as a line above the first step below that.
A new project's screenshots go through the same two scripts before they ship.

### Ink on the gallery

The blur hides what a shot says, so the page says it instead (`GalleryInk.vue`): a ring
drawn round the part of the shot its caption names, and a few of the caption's words beside
it. Every shot of every project has one; EMP's nine were the pilot. The shots are shown by
the guided tour now (below), on its screen and in each step's frame, and `ink.spec.mjs`
measures them there.

- **The words are the caption's own**, word for word, in both languages — the ink may
  shorten a caption, never say something it does not. `ink.spec.mjs` checks every label
  against its shot's alt text.
- **The data** is a project's `notes`, keyed by the shot's file name and measured in the
  shot's own pixels: its size, the box the ring goes round, and the side the words sit on.
  Boxes are measured on the sharp copies in `portfolio-assets/_published-sharp`, and
  checked with `portfolio-assets/_tools/ink.py`, which lays each ring and its words out as
  the page does — desktop and phone, both languages — and names every rule a note breaks.
- **Where.** The ring is an SVG over the frame whose `preserveAspectRatio` places it exactly
  as `object-fit: contain` places the picture; the words find the picture with container
  units. No script places anything, at any size.
- **The pen** is a dash run out along the ring (`pathLength="1"`), in CSS, as a step
  becomes the one being read (or a slide arrives); the words unroll out of the ring after
  it. At rest the ink is whole, which is all Reduce Motion ever sees.
- **On the tour's screen the NDA note holds the top start corner.** Rings and words, and the
  resize step's width readout, stay clear of it (`ink.spec`, `tour.spec`).
- **The pen is the shot's colour, not the theme's**: dark on a light interface, `pen: 'light'`
  on a dark-mode shot.

A new shot needs its note before it ships: `ink.spec.mjs` fails any real shot without one.

### The guided tour (every project's page)

Every project's page is `ProjectTour.vue`: EMP first, then the other seven (2026-10-08). A
project without a `tour` in its data would still get the old gallery page. Haydar chose it
from a storyboard. It tells one story where the gallery page had three boxes:

1. **The opening**: the title at display size, the cover, its laptop paging through the app
   (where the cover has a mapped `screen`: EMP, DMIS, HES).
2. **Step inside**: from 1200px, scrolling moves the camera into the cover's screen until the
   first shot is the screen; a cover without a screen opens straight onto the first shot. One number, `--p`, written as a custom property; the room it
   takes is in the stylesheet, so nothing shifts when the page wakes.
3. **The tour**: the screen is a sticky column and the step crossing the middle of the
   viewport decides its shot (a class, never an inline style). Each step is a shot, its
   caption, its ring (`GalleryInk`, the gallery's own pen) and, under it, the line of
   `technical` that built that screen. A rope, the border snake's light, runs from the
   step's title to the ring (DrawSVG), and lets go. The "two layouts" step is
   `TourResize.vue`: a real slider (390-1440px, keyboard included) that narrows the screen
   until, at the app's own breakpoint (EMP 960px, Gudea 768px, Gudea Events 1024px), the
   desktop shot gives way to the phone's. The screen is otherwise hidden from assistive
   technology (the steps carry its words); the slider alone is left in.
4. **The decisions** (`DecisionCards.vue`), dealt into a row, each turning over to what it
   cost; the turned-away face is `inert`, and focus follows the turn.
5. **The proof** (`CaseProof.vue`): the numbers count up, the system draws itself.
   Decisions and proof come from a `caseStudy`; only EMP has one so far.
6. **Built with**, and the next project.

Below 1200px there is no shared screen: each step carries its own shot, ringed as it comes
into view. Under Reduce Motion there is no zoom, no rope and no turning; the cost sits under
each decision. Nothing new is said: a step's words are its shot's caption, its note and a
line of `technical`; the first step is the case study's problem, or the project's summary.
A step only cites a `technical` line that is Haydar's own work. `tour.spec.mjs` covers it.

### Verification

`pnpm verify` generates the site, serves it gzipped, and runs `scripts/verify/suites/*.spec.mjs`
across six Playwright projects — Chromium at 1440×900, a 390×844 touch phone, both under
`prefers-reduced-motion` too, and WebKit as an iPhone and as desktop Safari (every iOS
browser is WebKit; `pnpm exec playwright install chromium webkit`) — then Lighthouse against
the recorded baseline. The suites
drive the page (load, navigate, hover, drag, swipe, scroll, key) and assert on what the
motion leaves behind, with a per-frame sampler (`lib/sampler.mjs`) for what a final
screenshot cannot show: where the signature landed, when a wipe started, which edge it
grew from, whether a rule popped to full width while it waited.

## Stack

Nuxt 4 · Tailwind v4 · DM Sans and IBM Plex Sans Arabic, self-hosted, with Apple's own SF
Arabic ahead of Plex on Apple devices (never shipped — its license forbids it; the system
already has it) · `@nuxt/icon` (Phosphor +
logos, and Simple Icons for Axios's mark, bundled offline) · `@nuxtjs/i18n` (English, Arabic) · `@nuxtjs/color-mode` (dark by
default) · **GSAP 3.15** (ScrollTrigger, SplitText, Flip, CustomEase, ScrambleText in the
shared chunk; DrawSVG, MorphSVG, Draggable, Inertia, Observer per feature) · **Matter.js**
(the tower, on first contact) · `nuxt-og-image`
· `@nuxtjs/sitemap` · `@nuxtjs/robots` · Web3Forms.
Playwright and Lighthouse, for the harness only.
