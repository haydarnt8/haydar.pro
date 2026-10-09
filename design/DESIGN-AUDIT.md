# Design audit — Framer → Nuxt 4

Phase 1 deliverable. Read from the live Framer project ("BentoX") via the `framer` MCP
server, 2026-09-14. Raw dumps in `design/raw/` (gitignored).

Companion docs: [`HANDOFF.md`](HANDOFF.md) (CV, locked decisions, package versions) ·
[`CONTENT-GAPS.md`](CONTENT-GAPS.md) (content the CV cannot fill).

**Coverage:** all 4 in-scope pages and 8 of 19 components read in full via the MCP, plus
the **responsive behaviour captured from Framer Preview** (§6, `design/raw/breakpoints.md`).
Remaining gaps are listed in §12 and are small.

## 0a. Design-fidelity remediation (2026-09-14, after visual QA)

The first build passed every gate and still did not look like the design. Root cause: the
build was verified against **this document**, not against the rendered Framer design. Side
by side, the home grid was visibly broken. Fixed:

| # | Defect | Fix |
|---|---|---|
| 1 | Cards collided; text cut mid-sentence; work card lost 45px, contact form 33px | Rigid `1fr` rows inside `height:100vh` + `overflow:hidden` replaced with `minmax(0,1fr)` and no clipping |
| 2 | 80px y-scroll at 1512×780 | Dropped `min-height: 860px`; pinned with `100dvh` above a 640px floor. **No scroll at 1440×900, 1512×780 or 1280×720** |
| 3 | Grain invisible | `NoiseOverlay` was `z-index: 0` *behind* the grid, so every card covered it. Now `fixed`, `z-index: 5`, above the content as in the design |
| 4 | Card fills flat | Added `--card-sheen`, a very subtle gradient, light and dark |
| 5 | Work card wrong shape | Image now full-bleed with the title overlaid on a scrim — keeps the touch-accessibility fix *and* the design's proportions |
| 6 | No page transitions, no load-in | Nuxt `pageTransition`, plus a `.u-rise` stagger. Both fully disabled under `prefers-reduced-motion` |
| 7 | Resources dropped | Restored as **Projects**: `/projects` and `/projects/[slug]`, built to the template's own `/resource` list and detail shapes |

**Caught during the fix, not in review:** the rewritten work card had every child absolutely
positioned, so with no grid-assigned row height it **collapsed to 2px at M and S**. Desktop
hid it. Fixed with an intrinsic `aspect-ratio: 260 / 235`.

**Second contrast gap of the same kind:** `--color-ink-faint` measures 4.42:1 (light) and
4.50 (dark) on `--color-border-subtle`, which is used as a pill fill — a surface the earlier
matrix never covered. Placeholders moved to `--color-ink-muted`; every ink × surface pair is
now verified.

**Lighthouse after remediation:** Performance **92** (was 95 — the site gained 9 routes),
Accessibility **100**, Best Practices 96, SEO **100**. CLS **0.047**, within Google's "good"
threshold but not the 0 it was; the remaining shift was not traced to hydration or fonts.

**Method change:** fidelity is now checked by screenshotting Framer and the build at the same
width and comparing, before and after every change. Structural checks alone let all of the
above through.

---

## 0. Decisions taken (2026-09-14)

| # | Decision | Effect |
|---|---|---|
| 1 | **Darken `/Text 1` and `/Text 2`** to meet AA | §7 palette updated with verified values |
| 2 | **Defer `/work/:slug`** — work cards render but do not link | route not built in v1 (§5.3) |
| 3 | **Three deliberate S-breakpoint departures** | work-card titles always visible · profile photo kept · socials stay 3×2 (§6.2) |
| 4 | **No accent colour** — palette stays neutral | no `--color-accent` token (§7) |
| 5 | **Resources section dropped** | 2 routes, 3 components, 1 CMS collection, `@nuxt/content` removed (§10) |
| 6 | **Web3Forms goes in the newsletter input slot** | reuses `Input Field/(XL)` (§14) |
| 7 | **Work covers ship as visible TODO placeholders** | no invented prose or imagery |


---

## 1. What this design is

A **purchased commercial Framer template by Tamer Magdy**, used unmodified. Evidence: two
off-canvas note frames addressed to the buyer (`QwyaZkfE0` "Thanks for purchasing the
template" + a Framer referral code; `Brh5tkKit` a note about the theme toggle), and a
`position: fixed` **`GetTemplateButton`** on the home page still pointing at the vendor's
own Lemon Squeezy checkout.

The project has **never been published** — `getProjectWebsiteUrl` returns `null` for both
production and staging.

### 1.1 Vendor content — none of this ships

The template arrives with its author's own content: his name, photo, copy, socials, email,
work history, sample projects, a newsletter heading, his tool logos, notes to the buyer and a
fixed "get this template" button. All of it was replaced or removed.

> **Licence:** worth confirming the template licence covers reimplementing the design
> outside Framer. Normal for a personal portfolio, but it is Haydar's call.

---

## 2. Page inventory

| Path | nodeId | Read | Disposition |
|---|---|---|---|
| `/` | `V74kcPksv` | ✅ | build |
| `/about` | `XhZL2AyBN` | ✅ | build |
| `/work/:slug` | `vTEi6kS1E` | ✅ | build — but see §5.3 |
| `/404` | `zOW2E4Q_4` | ✅ | build |
| `/resource` | `pR19LOPis` | — | **dropped** (§10) |
| `/resource/:slug` | `k4FLODgRG` | — | **dropped** (§10) |

`/about` and `/work/:slug` are Framer **Template** pages with `Close? = Yes` and
`Close Link = Home` — i.e. they present as **modal overlays over the home page**, with a
close affordance rather than site navigation. There is **no nav bar anywhere in the
design**. In Nuxt these are still real routes; the close control returns to `/`.

---

## 3. Three distinct layout systems

Not one system — three, and only the first is a bento grid.

| Page | Wrapper | Notes |
|---|---|---|
| `/` | `width: 1fr`, **`height: 100vh`, `min-height: 860px`**, `padding: 32px`, `gap: 16px` | Bento grid pinned to one screen. Does **not** scroll. |
| `/about`, `/work/:slug` | `width: 75%`, `max-width: 1100px`, `gap: 96px` | Centred column, scrolls normally. |
| `/404` | `width: 60%`, `height: 100vh`, `max-width: 1100px` | Single centred card. |

Shared by every page: a locked `Noise` overlay (full-bleed, `opacity: 0.08`,
`backgroundSize: 64` — a 256×256 monochrome raster tile, see §7). **Only the home page**
additionally has the locked decorative `Border`, and it is drawn at **every width**, not
just on desktop: measured `2px solid /Border 2` at a `16px` inset with `radius 40px` from
M up, and `8px` / `radius 32px` at S. It runs the height of the **document**, not the
viewport, so on a scrolling column it frames the whole page.

> The border is on an `::after` overlay, like every other border in this design — see
> §3.1. A build that measured only the elements would conclude there is no frame at all.

### 3.1 Card recipe

```
background:    /BG 2          ← a FLAT fill: no gradient, on the element or its ::after
border:        1px solid /Border 2
padding:       32px
border-radius: 32px   ← home, /404
               24px   ← /about, /work/:slug
```

> ⚠️ **The border is drawn on an `::after` overlay, not on the element.** This matters
> for anyone measuring the published design: `getComputedStyle(el).borderTopWidth` returns
> `0px` on every card, and the design looks as though it separates surfaces by fill alone.
> It does not — `getComputedStyle(el, '::after')` returns `1px solid rgb(36, 36, 36)`, at
> every width, in both themes. Framer uses a pseudo-element so the border costs no layout,
> the same reason the newsletter field uses an inset ring.
>
> On 2026-09-16 this block was "corrected" to `border: none` on exactly that faulty
> reading, and the build lost the hairline from every card, tile, teaser and portrait and
> the ring from every badge, button and the theme switch before Haydar caught it. **Measure
> pseudo-elements.** The full set, measured:
>
> | element | fill | edge | radius |
> |---|---|---|---|
> | card, social tile, gallery frame, portrait | `/BG 2` | **1px `/Border 2`** | 32 / 24 |
> | arrow badge | transparent | **2px `/Border 3`** | 50% |
> | Button | `/BG 2` | **2px `/Border 3`** | 48 |
> | theme pill | `/Border 1` | **2px `/Border 3`** | 40 |
> | close button | `/BG 1` | **2px `/Border 3`** | 50% |
> | newsletter field | transparent | **2px inset ring**, `/Border 3` | 16 |
> | copy chip, stack tile, newsletter submit | `/Border 1` | none | 16 |
>
> `/Border 1` is a FILL token in this design as well as a hairline one. The card fill is
> genuinely flat, though — no `background-image` on the element or on the `::after` — so a
> sheen is an invention.

> ✅ **Padding is per-PAGE, radius is per-page and per-breakpoint.** Measured 2026-09-16:
>
> | | S | M / L / XL |
> |---|---|---|
> | home bento — padding | **24px** | 32px |
> | home bento — radius | 24px | 32px |
> | `/about`, `/work/:slug` — padding | **32px** | 32px |
> | `/about`, `/work/:slug` — radius | 24px | 24px |
>
> The drop to 24px padding at S is the `About Section` S variant and belongs to the
> bento's own teaser — the inner pages keep 32px at every width. The build applied the
> drop everywhere.
>
> The page GUTTER is `20px` at S (cards at `x=20` inside a frame inset by 8), stepping to
> `32px` from M. The build used 24px, which is why its cards came out 342 wide against the
> design's 350.

> 🟡 **Card radius is not consistent across pages**: 32px on `/` and `/404`, 24px on
> `/about` and `/work/:slug`. The `About Section` component confirms this is at least
> partly deliberate — its `S` variant drops to `radius 24px` **and** `padding 24px` (§6).
> Decide in Phase 2 whether to model this as two tokens (`--radius-card` / `--radius-card-sm`)
> or normalise. Do not silently pick one.

---

## 4. Home page `/` — document order

```
Wrapper (100vh, min-h 860, pad 32, gap 16, horizontal)
├── Left (2fr, vertical, gap 16)
│   ├── Row1 ── Info card (H1 + Body1 tagline) │ Work card 1 → CMS "Cashless"
│   ├── Row2 ── Profile 235px │ About Section │ Work card 2 → CMS "BoostPro"
│   └── Row3 ── Newsletter (H3 + Input XL) │ Stack I use (1.5fr, H3 + Ticker 72px) │ Theme Toggle
└── Right (0.5fr, vertical, gap 16)
    ├── Social grid (3×2, gap 16, 6 icons)
    └── 2nd ── Resources (1.5fr) ← DROPPED │ Get in touch (1fr, H3 + Email)
```

## 5. Other pages

### 5.1 `/about`

Left column: **"What I'm about?"** card (`/Heading 1` + a 1px `/Border 2` divider, then two
`/Label 2` + `/Body 2` sections) over an **Experience** card. Right column: **"What I Do
Best"** (`/Label 1` + `Slider/Services`) over **Stack I use** and a row of
`Slider/Gallery` + **Get in touch**.

The Experience row pattern is a clean three-part flex — **it maps directly onto the CV**:

```
[ role at company ]  ──────1px /Border 3, width 1fr──────  [ Current | 2021 - 2022 ]
   /Body 2                                                      /Body 2
gap 24px between parts · gap 8px between rows · 4 rows in the vendor design
```

### 5.2 `/work/:slug` — CMS detail template

```
Title:  {{ Project Name }} /Heading 1  +  {{ Subtitle }} /Body 1
Row (540px):  meta card 1fr  │  summary card 2fr
   meta:    Company · My Role · Tools · Timeline   (each /Label 2 + /Body 2, gap 8; group gap 32)
   summary: Description · Context · Button          (gap 40)
Cover image: 65vh
Body (80% width, gap 48):
   Content 1 → Image 1 → Content 2 → Content 3 → Image 2 → Image 3 → Content 4
```

The four rich-text blocks follow a fixed arc in all three vendor items: **Problem/Challenge
→ Process → Solution → Key Insights/Outcome**. `Tools` is a newline-separated string.

> 🔴 **The body copy is `font="Inter"`, not a text style and not DM Sans.** Framer cannot
> apply project text styles to CMS `formattedText`, so all four content blocks silently fall
> back to Inter. This is a template defect, not a design intent. **In the rebuild, render
> these with the `/Body 2` / `/Body 3` tokens in DM Sans** — and note it as a deliberate, improving
> departure from the source.

### 5.3 🔴 `/work/:slug` is the biggest content problem

A complete entry needs **4 images + 4 rich-text sections + 9 short fields**.
`CONTENT-GAPS.md` records that all 8 of Haydar's projects have *none* of it. Per the
decision this session every field would ship as a visible `TODO` — a page made almost
entirely of TODOs.

> ✅ **Decided: defer the route.** `/work/:slug` is **not built in v1**. Work cards render on
> the home page but **do not link anywhere** until real content exists. Nothing
> half-finished ships, and the route can be added later without touching layout.
>
> Phase 4 consequence: the work card must have a **non-interactive variant** — no `<a>`, no
> pointer cursor, no hover-reveal affordance implying a destination. The card's hover
> overlay (§9) becomes a plain always-visible title instead (§6.2).

### 5.4 `/404`

One centred card (`radius 32`, `padding 32 36 48 36`, `gap 32`): an oversized "404" in
`GF;DM Sans-500` (size is an override the MCP does not expose), a `/Body 1` message, and a
`Button` linking `/`.

---

## 6. Breakpoints

| Name | Width | Home | About | Work | 404 |
|---|---|---|---|---|---|
| XL | **1440px** | `xrYgrx4xS` | `ziYAE_5N0` | `bPGqaLS07` | `Wn4HyQHVF` |
| L | **1200px** | `E04OTX8al` | `kpn0SUgR4` | `LgP0ScCij` | `pt5wZYM7M` |
| M | **810px** | `IefM77gTk` | `ucLOTtS1q` | `di0ujVmqh` | `Wbzo8PKuY` |
| S | **390px** | `q0QikAU5f` | `KDe8PrgfD` | `QEo_0hQpY` | `WD_2gmiuM` |

Every L/M/S page variant returns **empty** from the MCP — they inherit XL and their
per-node overrides are not exposed. **Captured instead from Framer Preview** by setting the
viewport width directly; full notes in `design/raw/breakpoints.md`. The preview renders the
real site, so the following is observed behaviour, not inferred.

### 6.1 How the home page collapses

| | Layout |
|---|---|
| **XL 1440** | Bento grid, Left `2fr` / Right `0.5fr`, three rows, `100vh` |
| **L ~1390** | Bento retained; scrolls once the viewport is shorter than `min-height: 860px` |
| **M 810** | Scrolling stack: Info (full) → Profile │ About (2-up) → Work │ Work (2-up) → image (full) → Stack │ Toggle (2-up) → Newsletter (full) |
| **S 390** | Single column; only `Stack I use │ Theme Toggle` stays 2-up |

### 6.2 Confirmed scaling rules

| Property | XL / L / M | S |
|---|---|---|
| Card radius, padding | 32px | **24px** (via `About Section` S variant) |
| Newsletter input | horizontal, `gap 16` | **vertical** — field above, full-width button below |
| Social icons | `3 × 2` grid | **one row** |
| `/about` Experience row | `role ── 1px rule ── date` | **two lines, rule removed** |
| Profile photo | shown | **removed entirely** |

> ✅ **Decided — three deliberate departures from the template at S:**
> 1. **Work-card titles are always visible**, not hover-only. Fixes a real accessibility
>    gap: on touch there is no way to reveal the name (§9).
> 2. **The profile photo is kept at S.** The template drops it, removing the only picture
>    of Haydar from the view most visitors get.
> 3. **Socials stay `3 × 2` at S**, not the single row. Also sidesteps the unresolved
>    wrap/scroll/clip question about the sixth icon.
>
> All three are departures, recorded here so they are reviewable rather than accidental.

### 6.3 Slider contents

From the indicator dots on `/about`: `Slider/Services` has **4 slides**,
`Slider/Gallery` has **3 slides** plus prev/next arrows.

### 6.4 Measured 2026-09-16 — was "still unmeasured"

The **type ramp per breakpoint** was the last open question here: the override values are
not exposed by the MCP, so they had to come off the rendered design. They now have — see
the table under §7's type ramp. It shrinks at S more than "a 24px `/Body 1` almost
certainly shrinks" suggested: the hero drops 32 → 24 and the eyebrow labels lose a size
AND half a millimetre of tracking.

It went unresolved for long enough to ship, and the build used the desktop ramp at every
width until Haydar said the phone "not look the same". The lesson is the one in §3.1: the
MCP describes the design, the render *is* the design.

```css
--breakpoint-sm:  390px;  --breakpoint-md:  810px;
--breakpoint-lg: 1200px;  --breakpoint-xl: 1440px;
```

---

## 7. Colour styles → semantic tokens

All 13 define light **and** dark. Framer's names are positional, so tokens are semantic.

| Framer | Light | Dark | Proposed token |
|---|---|---|---|
| `/BG 1` | `#f4f5f6` | `#090909` | `--color-surface` |
| `/BG 2` | `#ffffff` | `#141414` | `--color-surface-raised` |
| `/BG 3` | `#ffffff` | `#1f1f1f` | `--color-surface-hover` |
| `/BG 4` | `#f4f5f6` | `#1f1f1f` | `--color-surface-sunken` |
| `/BG 5` | `#d8dbde` | `#1f1f1f` | `--color-surface-emphasis` |
| `/Border 1` | `#eef0f1` | `#242424` | `--color-border-subtle` |
| `/Border 2` | `#d8dbde` | `#242424` | `--color-border` |
| `/Border 3` | `#d9dbde` | `#333333` | `--color-border-strong` |
| `/Text 1` | ~~`#8a949e`~~ → **`#667079`** | ~~`#666666`~~ → **`#858585`** | `--color-ink-faint` (§7.1) |
| `/Text 2` | ~~`#6b7680`~~ → **`#5c6670`** | `#acacac` (unchanged) | `--color-ink-muted` (§7.1) |
| `/Text 3` | `#1f1f1f` | `#cccccc` | `--color-ink` |
| `/Text 4` | `#1f1f1f` | `#ffffff` | `--color-ink-strong` |
| `/Cursor` | `rgba(20,20,20,.24)` | `rgba(255,255,255,.24)` | `--color-cursor` |

- **No accent/brand colour exists**, and by decision **none is added**. The palette stays
  neutral; emphasis comes from weight and `--color-ink-strong`. **No `--color-accent` token.**
  The only saturated colours in the build are the social-icon hover fills (§9).
- `/Border 2` vs `/Border 3` differ by one unit in light (`#d8dbde` / `#d9dbde`) — almost
  certainly a slip. But they are used differently (borders vs rules/button outlines), so
  keep both tokens and let the values converge if desired.
- `/BG 3` is the **hover** surface (§9), hence the token name.

### 7.1 🔴 Two tokens fail WCAG AA as drawn

Body text needs ≥4.5:1, large text ≥3:1.

| Token | Light /BG 1 | Light /BG 2 | Dark /BG 1 | Dark /BG 2 | Verdict |
|---|---|---|---|---|---|
| `/Text 1` | **2.82** | **3.08** | 3.47 | 3.21 | 🔴 fails AA in light; large-only in dark |
| `/Text 2` | **4.25** | 4.64 | 8.77 | 8.12 | 🟡 fails body on the page background in light |
| `/Text 3` | 15.10 | 16.48 | 12.40 | 11.47 | ✅ |
| `/Text 4` | 15.10 | 16.48 | 19.91 | 18.42 | ✅ |

`/Border 2` on `/BG 2` is 1.39:1 (light) / 1.19:1 (dark) — fine decoratively, but never the
sole indicator of a focusable control's bounds.

**`/Text 2` is used for real body copy** — every `/about` paragraph and every
`/work/:slug` meta value. It sits on `/BG 2` cards there (4.64, passes), so the practical
risk is confined to any use on the page background. `/Text 1` has no confirmed usage in the
pages read, which makes option 2 below cheap.

### 7.2 ✅ Resolved — darken both tokens

| Token | Was | Now | on `/BG 1` | on `/BG 2` |
|---|---|---|---|---|
| `/Text 1` light | `#8a949e` (2.82) | **`#667079`** | **4.63** | **5.05** |
| `/Text 1` dark | `#666666` (3.47) | **`#8a8a8a`** | **5.40** | **5.24** |
| `/Text 2` light | `#6b7680` (4.25) | **`#5c6670`** | **5.36** | **5.85** |
| `/Text 2` dark | `#acacac` | unchanged | 8.77 | 8.12 |

All four clear 4.5:1 on every **text-bearing** surface in both themes:
`--color-surface`, `--color-surface-raised`, `--color-surface-hover` and
`--color-surface-sunken`.

> ⚠️ **Corrected in Phase 4.** The first pass checked only `/BG 1` and `/BG 2` and
> concluded "all pass". Against `/BG 3` and `/BG 4` — which *do* carry text, e.g. the work
> card's image placeholder — dark `/Text 1` measured **4.47** and failed. Raised
> `#858585` → **`#8a8a8a`** (worst case 4.77).
>
> **Usage constraint:** neither `/Text 1` nor `/Text 2` clears 4.5:1 on
> `--color-surface-emphasis` (3.63 / 4.21 in light). That surface is for selection and
> pressed states and must not carry body text — use `--color-ink` there.

> ⚠️ **A first pass at `#6e7781` for `/Text 1` was rejected** — it measures 4.17:1 on
> `/BG 1` and fails. Every value in the table above is computed, not estimated. Re-run the
> check if any of them is changed.
>
> **Consequence to accept:** `/Text 1` is meant to be *fainter* than `/Text 2`, but once both
> must clear 4.5:1 the two tiers compress (4.63 vs 5.36 in light). The faint tier cannot be
> as faint as the template draws it. If a genuinely faint tier is needed later it must be
> non-essential decoration only, exempt from the body-text rule.

---

## 8. Text styles → tokens

Family: **DM Sans** throughout (`-500` = weight 500, `-regular` = 400). `@nuxt/fonts`
covers it. The only other family in the project is the **Inter** fallback on CMS rich text
(§5.2), which the rebuild should eliminate.

| Framer | Tag | Weight | Size | Line height | Tracking | Token |
|---|---|---|---|---|---|---|
| `/Heading 1` | h1 | 500 | 32px | 1.4em | -0.4px | `--text-h1` |
| `/Heading 2` | h2 | 500 | 28px | 1.4em | -0.4px | `--text-h2` |
| `/Heading 3` | h3 | 500 | 26px | 1.4em | -0.4px | `--text-h3` |
| `/Heading 4` | h4 | 500 | 22px | 1.4em | -0.4px | `--text-h4` |
| `/Body 1` | p | 400 | 24px | 1.5em | -0.4px | `--text-body-lg` |
| `/Body 2` | p | 400 | 20px | 1.8em | -0.2px | `--text-body-md` |
| `/Body 3` | p | 400 | 18px | 1.5em | -0.2px | `--text-body` |
| `/Body 4` | p | 400 | 16px | 1.4em | -0.2px | `--text-body-sm` |
| `/Label 1` | p | 500 | 16px | 1.2em | 3px, uppercase | `--text-label-lg` |
| `/Label 2` | p | 500 | 14px | 1.2em | 1.2px, uppercase | `--text-label` |

> ✅ **The per-breakpoint ramp, measured 2026-09-16** — this was the open question below,
> and the answer is that Framer sets a genuinely smaller ramp at S. Taken off the published
> design at 390, 810 and 1440, on both `/` and `/about`:
>
> | token | S | M | L / XL |
> |---|---|---|---|
> | `--text-h1` | **24** | 32 | 32 |
> | `--text-h3` | **20** | 26 | 26 |
> | `--text-h4` | **18** (tracking -0.2) | **20** | 22 |
> | `--text-body-lg` | **18** (1.6em) | 24 | 24 |
> | `--text-body-md` | **18** (1.7em) | 20 | 20 |
> | `--text-body` | 18 | 18 | 18 |
> | `--text-body-sm` | 16 | 16 | 16 |
> | `--text-label-lg` | **14** (tracking 2.5px) | 16 | 16 |
> | `--text-label` | **12** | 14 | 14 |
>
> `/Heading 2` never appears on any rendered page, so it has no measured S value and keeps
> its authored one. The overrides live in `main.css` as custom properties, so the utilities
> and every call site follow automatically.
>
> Two more measurements from the same sweep, both of which the build had wrong: the
> `About Section` arrow is a **bare glyph** — its circle is a clip for the hover swap, with
> no fill and no border at any width (48px holding an 18px glyph at S, 48/20 from L, inset
> 16px at S and 32/24 from L) — and the `Noise` overlay is a **256×256 monochrome raster
> tile** of 16 grey levels (mean luminance 75.6, stdev 21.7 at its 64px display size),
> not a procedural filter.

Confirmed usage: `/Heading 1` = page title (one per page ✅). `/Heading 3` = card headings.
`/Heading 4` = work-card title. `/Body 1` = hero tagline, subtitle, 404 message.
`/Body 2` = all long-form prose and meta values. `/Body 3` = button label.
`/Label 1` = section eyebrows ("About", "Experience", "What I Do Best").
`/Label 2` = field labels ("Company", "My story").

- Both `Label` styles are `tag="p"` but uppercase with wide tracking — **eyebrows, not
  paragraphs.** Never render as headings; the wide tracking needs care for screen readers.
- These are the XL sizes and the **only** sizes defined; the responsive type ramp lives in
  breakpoint overrides the MCP does not expose (§6). A 24px `/Body 1` is large for a 390px
  screen and almost certainly shrinks.

---

## 9. Animation and interaction

Now well understood, and **more load-bearing than it first appears**.

| Element | Behaviour | Verdict |
|---|---|---|
| **Work card** | `Info` overlay `opacity: 0`; title + arrow parked at `centerY: 150%` (below frame), slide up and fade in on hover | 🔴 **load-bearing** — see below |
| **About Section** | card `/BG 2` → `/BG 3`; two arrows swap diagonally (one centred, one at `-24,-24`) | decorative |
| **Social Icon** | `/BG 2` + border → **brand-colour fill**, border removed | decorative |
| **Button** | `/BG 2` → `/BG 4` | decorative |
| **Stack I use** | `Ticker` marquee: `speed 40`, `direction left`, `gap 16`, `hoverFactor 0.5` (halves on hover) | decorative, continuous |
| **Email** | copy-to-clipboard, `Copy email` → `Copied!` | **load-bearing** — state feedback |
| **Input Field/(XL)** | `Default` → `Success` variant | **load-bearing** — form status |
| **Theme Toggle** | `defaultTheme: dark`, `saveTheme`, `resetToDeviceTheme`, `setColorScheme` | **load-bearing** — state |
| `Noise`, `Border` | static, locked | decorative |
| `Cursor` | custom cursor at 24% alpha | decorative, pointer-only |

> 🔴 **The work card's project name is invisible until hover** — **confirmed visually in
> Framer Preview at S**, where the cards render as unlabelled images. There is no hover on
> touch, so on mobile they carry no title at all. This needs a non-hover fallback — the
> title visible by default at `S`/`M`, or always. Flagging rather than fixing: it is a real
> departure from the source design.

Implications for Phase 4 — **resolved in the build**:
- **`motion-v` was NOT installed.** Every animation in this design is a transition between
  two states — a hover fill, a sliding arrow, a translating carousel track, a looping
  marquee — all of which CSS does natively. The work-card overlay, the one case that might
  have needed orchestration, became a static always-visible title (§6.2), removing the last
  candidate. The brief's rule is to animate only where Framer animates; adding a motion
  library with nothing to orchestrate would have been a dependency for its own sake.
  Revisit only if a genuinely sequenced animation appears.
- **`prefers-reduced-motion` must pause the ticker**, not just shorten it — a continuous
  marquee is exactly what that media query exists for.
- The `Cursor` component must be suppressed for coarse pointers, not merely reduced.

---

## 10. Dropped scope

The Resources section is a **paid digital-product store** (`Price` required, `Feature 1–4`,
5-image gallery, two purchase links). Haydar sells nothing.

| Removed | Kind |
|---|---|
| `/resource`, `/resource/:slug` | routes |
| `Resources/Section`, `Resources/Item`, `Resources/Gallery` | components |
| `Resource` | CMS collection (schema kept in `design/raw/` for reference) |
| `@nuxt/content` 3.16.0 | package — the blog had no design and is dropped with it |

> 🔴 **Open layout consequence.** In the right column, cell `2Nd` (`qQHkZtc4P`) stacks
> `ResourcesSection` at `1.5fr` above `GetInTouch` at `1fr`. Removing the first leaves
> `GetInTouch` alone in a cell sized for two, in a `0.5fr` column whose other child is the
> social grid. **The design cannot answer what fills the gap.** Candidates: expand
> `GetInTouch`; rebalance `Right` vs `Left`; or promote something from the left column.
> Needs a decision in Phase 4.

---

## 11. Design slot → CV content

| Slot | Design expects | CV / decisions supply | Status |
|---|---|---|---|
| Hero `h1` | greeting + name | "Haydar Yosef" | ✅ |
| Hero tagline | **one short sentence** (`/Body 1`) | CV has a ~45-word paragraph | 🔴 needs a one-liner |
| Profile photo | 235px square | nothing | 🔴 needs a photo |
| Work card ×2 | CMS item + **required cover** | 8 titles, no detail, no imagery | 🟡 TODO placeholders |
| `/work/:slug` | 4 images + 4 rich-text + 9 fields | nothing | 🔴 §5.3 |
| About Section | teaser → `/about` | CV summary | ✅ |
| `/about` — My story | one paragraph | CV profile paragraph fits well here | ✅ |
| `/about` — What I do now | one sentence | TransForat + Health360 (part-time remote) | ✅ |
| `/about` — Experience | **4 rows** (role · rule · date) | CV has **exactly 4 roles** | ✅ excellent fit |
| `/about` — What I Do Best | `Slider/Services` carousel | nothing explicit | 🟡 needs 3–4 service lines |
| `/about` — Gallery slider | `Slider/Gallery` images | nothing | 🔴 needs images |
| Stack I use | 8 marquee tiles | CV lists 19 skills | ✅ ample |
| Newsletter card | email capture | → Web3Forms (heading needs rewriting) | 🟡 needs copy |
| Get in touch | copy-to-clipboard email | `haydarnt8@gmail.com` | ✅ |
| Social grid ×6 | 6 links | GitHub, LinkedIn, email, Telegram, WhatsApp, Instagram | 🟡 URLs pending; §11.1 |
| Theme toggle | light/dark, defaults dark | — | ✅ |

The `/about` Experience card is the strongest fit in the whole design: 4 slots, 4 CV roles,
and the `Current` label handles the two "Present" roles cleanly. The employment-type field
(Health360 part-time/remote) can live in the role text.

### 11.1 ⚠️ WhatsApp conflicts with the "no phone" decision

`HANDOFF.md` records **"Phone on site: No"**. A standard `https://wa.me/964…` link **embeds
the number in the markup**, reversing it. Options, for Haydar:

1. **WhatsApp Business short link** (`wa.me/message/<CODE>`) — number stays out of the markup.
2. **Drop WhatsApp**, ship five icons, reflow the grid.
3. **Publish the number knowingly** — reverses the decision; his call.

All six icons exist in Phosphor (`ph:github-logo`, `ph:linkedin-logo`, `ph:envelope`,
`ph:telegram-logo`, `ph:whatsapp-logo`, `ph:instagram-logo`), so the icon set is settled
either way. **Brand hover colours are still needed** for GitHub, Telegram and WhatsApp —
the template only defines them for the platforms it shipped with (§9).

---

## 12. What is still unread

| Item | Why it matters | Priority |
|---|---|---|
| L/M/S **type ramp** | per-breakpoint font sizes (§6.4) | 🟡 medium — measure in Phase 2 |
| `Slider/Gallery`, `Slider/Services` | both used on `/about` | 🟡 medium — capture at Phase 4 |
| `Toggle`, `Close`, `Arrow`, `Cursor`, `Stack/(S)`, `Input Field/(S)` | small primitives, visible in the rendered design | 🟢 low |
| `/resource*` pages | dropped | n/a |

**MCP note:** the earlier read failures were caused by the **Framer plugin not being
connected**, not by page focus as first suspected. Reopening the plugin (Cmd-K → "MCP") in
the project fixed nearly everything; a couple of components (`Button`, `Input Field/(XL)`)
still needed opening in the editor first.

---

## 13. Open questions

**Resolved this session:** contrast (§7.2) · accent (§7) · `/work/:slug` scope (§5.3) ·
the three S departures (§6.2) · Resources dropped (§10).

**Closed in Phase 2:**

- **Card radius** (§3.1) — resolved as **two tokens**: `--radius-card` (32px) and
  `--radius-card-sm` (24px). `.u-card` uses the small value as its base and steps up at
  `md`, matching the S scaling rule in §6.2.

Still open, blocking Phase 4:

1. **Per-breakpoint type ramp** (§6.4) — still not exposed by the MCP and **not yet
   measured**. Phase 2 ships the XL scale only, which is correct at `md`+ but likely too
   large at S (a 24px `/Body 1`, a 32px `/Heading 1`). Measure off the Framer preview
   before building components, or agree a ramp explicitly. **Nothing is invented in the
   token layer to cover this.**
2. **Motion timings** — the MCP exposes no transition durations or easings. `main.css` §7
   defines `--duration-fast/base/slow` and `--ease-out-soft` as **chosen defaults, clearly
   marked as not-from-Framer**. Confirm or replace before Phase 4 animation work.

Still open, blocking Phase 4:

3. **Right-column rebalance** after Resources is removed (§10).
4. **WhatsApp vs the no-phone decision** (§11.1) — pending the social URLs.

Content still owed (non-blocking): one-line hero tagline · profile photo · six social URLs ·
newsletter heading replacement · 3–4 "What I Do Best" service lines · gallery images.

---

## 14. Corrections to `HANDOFF.md`

| Handoff said | Actually |
|---|---|
| "Blog ON — `@nuxt/content` v3" | No blog in the design. Dropped, with `@nuxt/content`. |
| "Contact form ON — Web3Forms" | No contact form. Web3Forms moves into the newsletter `Input Field/(XL)` slot, which already has Default→Success states. |
| "Add `@nuxtjs/color-mode` **only if** the audit shows dark styles" | **Required.** 13/13 colour styles have dark variants; the toggle sets `defaultTheme: dark`, `saveTheme`, `resetToDeviceTheme`. |
| "if the Framer project has no blog page… stop and ask" | Asked and resolved: dropped. |
| Package list | `@nuxt/icon` is needed (Phosphor via `ph:`); `@nuxt/content` removed. |
