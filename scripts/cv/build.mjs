/**
 * The CV, built from app/data: `pnpm cv`. Generated, so it cannot say anything the
 * site does not. Writes a text PDF (A4) to public/, printed by the test harness's Chromium.
 *
 * Rules, each measured on two résumé parsers (Affinda, OpenResume):
 *  - Arial, not the site's DM Sans: in DM Sans text extraction split runs of capitals
 *    ("SUMM ARY", "E MP"), and scanners find a CV's parts by its headings.
 *  - Headings without letter-spacing: tracked capitals were read as two words.
 *  - Links written out in full: only then were they read as links.
 *  - An employer is never empty ("Self-employed" for freelance): a parser fills an
 *    empty one from the job above.
 *  - A project shows its dates, not a role: a role beside dates was read as a job,
 *    wherever it went. Each project's page on the site says what the part was.
 *  - A title stands alone, over "employer · dates" in runs of their own: on one line,
 *    title and employer were read as one.
 *  - Tight inside an entry, wider between entries: a parser starts a new entry at
 *    1.4x the usual line gap.
 *  - Nothing beyond the data: no proficiency levels, languages section or metrics.
 */
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const require = createRequire(`${root}package.json`)
const { chromium } = require('@playwright/test')

const { experience } = await import(`${root}app/data/experience.ts`)
const { education } = await import(`${root}app/data/education.ts`)
const { skillGroups } = await import(`${root}app/data/skills.ts`)
const { projects } = await import(`${root}app/data/projects.ts`)
const { profile } = await import(`${root}app/data/profile.ts`)

const OUT = `${root}public/Haydar-Yosef-CV.pdf`
/** No trailing slash, as the canonical links write it. */
const SITE = 'https://haydar.pro'

/** Verbatim from the original CV. */
const NAME = 'Haydar Yosef'
const TITLE = 'Frontend Developer'
const SUMMARY = 'Experienced Front-end Developer specializing in building scalable and responsive web applications using Vue.js and modern web technologies. Proficient in API integration with Axios, state management using Pinia, implementing responsive design principles, and optimizing application performance to deliver high-quality solutions.'

const en = v => (v && typeof v === 'object' ? v.en : v) ?? ''
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const month = (ym) => {
  if (!ym) return 'Present'
  const [y, m] = ym.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}
const span = p => `${month(p.start)} – ${month(p.end)}`
const firstSentence = s => (en(s).match(/^.*?[.!?](?=\s|$)/) ?? [en(s)])[0]

const socials = Object.fromEntries(profile.socials.map(s => [s.id, en(s.href)]))
const reach = [
  en(profile.location),
  `<a href="tel:+${profile.phone.replace(/\D/g, '')}">${esc(profile.phone)}</a>`,
  `<a href="mailto:${esc(profile.email)}">${esc(profile.email)}</a>`,
]
// Written out in full: as "github.com/…" a parser kept the text but not the link.
const contacts = [
  `<a href="${SITE}">${SITE}</a>`,
  `<a href="${esc(socials.github)}">${esc(socials.github)}</a>`,
  `<a href="${esc(socials.linkedin)}">${esc(socials.linkedin)}</a>`,
]

const jobs = experience.map((job) => {
  // Never empty: a parser fills an empty employer from the job above.
  const employer = job.company ?? (job.employmentType === 'freelance' ? 'Self-employed' : null)
  const where = [employer, en(job.location)].filter(Boolean).join(', ')
  const kind = [job.employmentType === 'freelance' ? null : job.employmentType, job.arrangement].filter(Boolean).join(', ')
  const note = job.note ? en(job.note) : kind
  return `
    <article class="item">
      <h3>${esc(en(job.role))}</h3>
      <p class="meta"><span>${esc(where)}</span><span>${span(job.period)}</span></p>${note ? `
      <p class="note">${esc(note)}</p>` : ''}
      <ul>${job.highlights.map(h => `<li>${esc(en(h))}</li>`).join('')}</ul>
    </article>`
}).join('')

// No role line: beside the dates, "Frontend developer · …" made parsers invent jobs.
const work = projects.map((p) => {
  const page = `${SITE}/projects/${p.slug}`
  return `
    <article class="item project">
      <h3><a href="${page}">${esc(en(p.title))}</a> <span class="at">· ${esc(p.company)}</span></h3>
      <p class="meta"><span>${span(p.period)}</span><span><a href="${page}">${page}</a></span></p>
      <p>${esc(firstSentence(p.summary))}</p>
      <ul>${p.highlights.slice(0, 2).map(h => `<li>${esc(en(h))}</li>`).join('')}</ul>
      <p class="stack">${p.stack.slice(0, 8).map(esc).join(' · ')}</p>
    </article>`
}).join('')

const skills = skillGroups.map(g => `
    <p class="skill"><b>${esc(en(g.label))}:</b> ${g.items.map(i => esc(en(i))).join(', ')}</p>`).join('')

const schools = education.map(e => `
    <article class="item">
      <h3>${esc(en(e.credential))}</h3>
      <p class="meta"><span>${esc(en(e.institution))}</span><span>${e.year}</span></p>
    </article>`).join('')

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${NAME} — ${TITLE} — CV</title>
<meta name="author" content="${NAME}">
<style>
  @page { size: A4; margin: 11mm 14mm 10mm; }
  :root { --ink: #111317; --muted: #4a4f57; --faint: #767b83; --rule: #d8dbde; }
  * { box-sizing: border-box; }
  html { font-family: Arial, Helvetica, sans-serif; color: var(--ink); font-size: 9pt; line-height: 1.32; -webkit-print-color-adjust: exact;
    /* Kerning and ligatures OFF, for the scanners. Chromium writes a kerning pair as
       a nudge between two glyphs, and text extraction broke words at every one:
       "E MP", "SUMM ARY", "E DUCATION" (PDFKit, measured). A ligature turns "fi"
       into one glyph a parser may not map back. Invisible at this size. */
    font-kerning: none; font-feature-settings: "kern" 0, "liga" 0, "clig" 0; }
  body { margin: 0; }
  a { color: inherit; text-decoration: none; }
  h1 { font-size: 23pt; line-height: 1.1; font-weight: 700; letter-spacing: -0.01em; margin: 0; }
  .title { font-size: 12pt; color: var(--muted); margin: 2pt 0 5pt; }
  .contacts { color: var(--muted); margin: 0; font-size: 8.8pt; }
  .contacts span { white-space: nowrap; }
  .contacts span + span::before { content: '·'; margin: 0 6pt; color: var(--faint); }
  section { margin-top: 9pt; }
  /* No letter-spacing: tracked capitals were read as two words ("SUM MARY"). */
  h2 { font-size: 7.8pt; font-weight: 700; text-transform: uppercase; color: var(--faint); margin: 0 0 6pt; padding-bottom: 3pt; border-bottom: 0.6pt solid var(--rule); }
  .summary { margin: 0; color: var(--muted); }
  /* Lines inside an entry 13pt apart, entries 20pt: a parser that splits entries
     at 1.4 times the usual gap then splits every one, with a point to spare. */
  .item { break-inside: avoid; margin: 0 0 7pt; }
  h3 { font-size: 10pt; font-weight: 700; margin: 0; }
  .at { color: var(--muted); font-weight: 400; }
  .meta { color: var(--muted); font-size: 8.8pt; }
  .item > p { margin: 1pt 0 0; }
  /* The dot sits in the gap, so employer and dates stay two runs of text. */
  .meta span + span::before { content: '·'; margin: 0 6pt; color: var(--faint); }
  .note { color: var(--muted); }
  ul { margin: 1.5pt 0 0; padding-left: 11pt; }
  li { margin: 1pt 0; }
  li::marker { color: var(--faint); }
  .stack { color: var(--faint); font-size: 8.3pt; margin-top: 1.5pt !important; }
  .skill { margin: 0 0 2.5pt; color: var(--muted); }
  .skill b { color: var(--ink); font-weight: 700; }
</style>
</head>
<body>
  <header>
    <h1>${NAME}</h1>
    <p class="title">${TITLE}</p>
    <p class="contacts">${reach.map(c => `<span>${c}</span>`).join('')}</p>
    <p class="contacts">${contacts.map(c => `<span>${c}</span>`).join('')}</p>
  </header>
  <section><h2>Summary</h2><p class="summary">${esc(SUMMARY)}</p></section>
  <section><h2>Experience</h2>${jobs}</section>
  <section><h2>Projects</h2>${work}</section>
  <section><h2>Skills</h2>${skills}</section>
  <section><h2>Education</h2>${schools}</section>
</body>
</html>`

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setContent(html, { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)
await page.pdf({ path: OUT, format: 'A4', printBackground: true, preferCSSPageSize: true })
await browser.close()
console.log(`CV written to ${OUT.replace(root, '')}`)
