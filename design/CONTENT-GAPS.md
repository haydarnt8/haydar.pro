# Content gaps

Slots the site needs that the CV cannot fill. Per the brief, these are **flagged, never
invented**. Each is either awaiting input from Haydar or awaiting the Framer design audit.

Status legend: 🔴 blocking · 🟡 needs confirmation · 🟢 resolved

---

## Phase 3 — gaps are now encoded, not just described

The content layer exists (`app/types/portfolio.ts`, `app/data/*.ts`). Every gap below is a
`todo('...')` call, so it renders visibly and is greppable:

```bash
grep -rn "stub(\|todo(\|ROLE\|DESCRIBE" app/data/   # every unwritten field
grep -rn "TODO:" app/ i18n/                       # the marker, as it renders
```

**The stubs are in both languages (2026-09-23).** They render on the page — a dashed box tagged
"Coming soon" / "قريبًا" — so each is written as `{ en: todo('…'), ar: todo('…') }` through a
small `stub()` helper. Both halves still carry the `TODO:` marker, so nothing reads as real copy
and the grep above still finds every one.

| File | Stubs | What is missing |
|---|---|---|
| `app/data/projects.ts` | 15 | summary + role for 7 of 8 projects (Gudea has a real CV line) |
| `app/data/services.ts` | 8 | all 4 "What I Do Best" slides — the CV has nothing for these |
| `app/data/profile.ts` | 0 | — the hero tagline and the About line were written from the CV on 2026-09-23; the social URLs are in |

**Not stubbed, genuinely absent:** every `Project.image` is `null`, and `Profile.photo` is
`null`. These render as visible placeholders rather than fake imagery.

**What is real and complete:** all 4 experience entries with 9 verbatim CV bullets · both
education entries · all 8 skill groups · 19 stack tiles (every named CV technology, each
with a verified Iconify logo) · GitHub, LinkedIn and email links · the CV summary paragraph.

### The WhatsApp link: resolved (2026-09-30)

It was blocked because a `wa.me/<number>` link puts the phone number in the page, and the
number was private. Haydar published it (+964 7826665785, "for both cv and website"), so the
link now carries the number, and a phone tile took Telegram's place in the social grid.

---

## 🔴 Projects have no detail

The CV lists 8 projects as **name + company only**. No summary, role, stack, highlights, links
or images. The `Project` shape in the brief wants all of them.

| # | Project | Company | Have | Missing |
|---|---|---|---|---|
| 1 | Gudea Event Dashboard | TransForat | title, company | summary, role, stack, highlights, links, image |
| 2 | Landing Page | Health360 | title, company | summary, role, stack, highlights, links, image |
| 3 | Education Platform | Health360 | title, company | summary, role, stack, highlights, links, image |
| 4 | ERP System | AL Muraba | title, company | summary, role, stack, highlights, links, image |
| 5 | DMIS System | AL Muraba | title, company | summary, role, stack, highlights, links, image |
| 6 | CMS System | AL Muraba | title, company | summary, role, stack, highlights, links, image |
| 7 | Market Store Web Design | Freelance | title, company | summary, role, stack, highlights, links, image |
| 8 | QR Code Generator | Freelance | title, company | summary, role, stack, highlights, links, image |

**Decision:** Haydar will supply real detail later and asked for mock data meanwhile.

**2026-09-24:** #2 Landing Page, #7 Market Store Web Design and #8 QR Code Generator were
removed from the site. Haydar asked for the portfolio to show only the projects whose source
he listed, and none of the nine repositories is any of these three. The Freelance role on
`/about` still mentions the store design, because that line is the CV's.

**How the stubs must be written:** an explicit `TODO` marker per field — *not* plausible-sounding
invented prose. A portfolio is a professional representation, and believable fake project
write-ups are precisely the kind of placeholder that ships by accident and misstates someone's
work to an employer. A visible `TODO` cannot.

Titles and companies are real and come from the CV; only the prose is stubbed. Every stubbed
field should be greppable, e.g. `summary: 'TODO: describe this project'`.

Only #1 has any corroborating detail anywhere in the CV — the TransForat bullet mentions the
Gudea Event Dashboard was built with design and backend teams, optimizing for performance and
usability. That is a real CV line and may be used.

---

## 🔴 No project imagery

Nothing to fill `Project.image`. No assets can be exported from Framer until the design is
reachable. If the design's project cards require images, either Haydar supplies screenshots or
the cards need a no-image variant.

---

## ✅ No tagline — resolved 2026-09-23

Written at Haydar's request from CV facts only (role, current employer, stack, city; ERP work
and the event dashboard for the About line) — see `app/data/profile.ts`. What follows is the
original note.

The CV has one profile paragraph (~45 words) and no short tagline. If the Framer hero has a
headline slot *and* a sub-headline slot, only one can be filled from the CV. Options: use the
full paragraph in the larger slot and leave the other out, or ask Haydar for a one-line tagline.
**Resolve during the design audit**, once the hero's actual slots are known.

---

## 🟡 Freelance role has no company or location

The freelance entry (2023/5 – 2023/10) has neither. `Experience.company` and
`Experience.location` must be optional, and the component must render cleanly without them.

---

## 🟡 "Web50x"

Listed under Computiq (Harvard University Course), 2023. Almost certainly CS50W ("CS50's Web
Programming with Python and JavaScript") or CS50x. **Left exactly as written** — it is Haydar's
CV wording and not mine to correct. Worth a one-line confirmation.

---

## 🟡 Blog has no posts

The blog is ON (`@nuxt/content` v3) but the CV contains no writing, so it ships empty.

Larger issue: **if the Framer project has no blog page, there is no design for it** — building
one means inventing layout, which the brief forbids. Check during the audit and **stop and ask**
rather than designing a blog page unprompted.

---

## 🟢 Resolved

- **Social links** — GitHub https://github.com/haydarnt8 · LinkedIn
  https://www.linkedin.com/in/haydar-yosef
- **Overlapping "Present" roles** — not an error. Health360 converted to part-time, fully remote
  when TransForat began (2026/2). The data model needs an employment-type field so the site
  states this rather than showing an unexplained overlap.
- **Phone number** — deliberately not published. Email + contact form only.
- **Contact form backend** — Web3Forms, key `11d92dee-66a5-4357-ab03-b9d8636fcac8` (public by
  design; belongs in `runtimeConfig.public`).
- **Name spelling** — "Haydar Yosef" per the CV on the site; git history spells it
  "Haydar Yousef".
