/**
 * Lighthouse as a gate: a median of three runs against the gzipped static build
 * (lib/serve.mjs; uncompressed scores far lower), compared with baseline.json.
 *
 * Usage:
 *   node scripts/verify/lighthouse.mjs --save          # record the baseline (deltas still shown)
 *   node scripts/verify/lighthouse.mjs                 # compare against it
 *   node scripts/verify/lighthouse.mjs --only /,/ar    # a subset
 *   node scripts/verify/lighthouse.mjs --runs 1        # quick look, not a gate
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import { serve } from './lib/serve.mjs'
import { settledConfig } from './lib/settled.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const BASELINE = join(HERE, 'baseline.json')

const ROUTES = ['/', '/about', '/projects', '/projects/gudea-event-dashboard', '/ar']

/** Reported, not enforced: the site does not meet these yet. */
const GOAL = {
  performance: 95,
  accessibility: 100,
  'best-practices': 90,
  seo: 100,
  cls: 0.01,
  tbt: 160,
}

/** Fails a run: worse than the baseline by more than the run-to-run noise measured on this machine. */
const TOLERANCE = {
  performance: 3,
  accessibility: 0,
  'best-practices': 0,
  seo: 0,
  cls: 0.01,
  tbt: 40,
  fcp: 300,
  lcp: 300,
  si: 600,
}

const LOWER_IS_BETTER = new Set(['cls', 'tbt', 'fcp', 'lcp', 'si'])

const METRICS = {
  fcp: 'first-contentful-paint',
  lcp: 'largest-contentful-paint',
  tbt: 'total-blocking-time',
  cls: 'cumulative-layout-shift',
  si: 'speed-index',
}

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : process.argv[i + 1]
}
const flag = name => process.argv.includes(`--${name}`)

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

async function audit(url, preset, chromePort) {
  // The node API ignores `preset: 'desktop'` and runs the mobile default; desktop needs its config module.
  const { lhr } = await lighthouse(
    url,
    { port: chromePort, output: 'json', logLevel: 'error' },
    preset === 'desktop' ? desktopConfig : undefined,
  )

  const out = {
    performance: Math.round(lhr.categories.performance.score * 100),
    accessibility: Math.round(lhr.categories.accessibility.score * 100),
    'best-practices': Math.round(lhr.categories['best-practices'].score * 100),
    seo: Math.round(lhr.categories.seo.score * 100),
  }
  for (const [key, id] of Object.entries(METRICS)) {
    const value = lhr.audits[id]?.numericValue ?? 0
    out[key] = key === 'cls' ? Number(value.toFixed(3)) : Math.round(value)
  }
  return out
}

/** A separate settled pass: axe reads opacity into contrast, and default timing catches mid-entrance. */
async function auditSettled(url, preset, chromePort) {
  const { lhr } = await lighthouse(
    url,
    { port: chromePort, output: 'json', logLevel: 'error' },
    settledConfig(preset),
  )
  return Math.round(lhr.categories.accessibility.score * 100)
}

async function run() {
  const runs = Number(arg('runs', 3))
  const only = arg('only', '')
  const routes = only ? only.split(',') : ROUTES
  const presets = flag('mobile-only') ? ['mobile'] : ['mobile', 'desktop']

  const server = await serve()
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-sandbox'] })
  const results = {}

  try {
    for (const preset of presets) {
      for (const route of routes) {
        const url = server.origin + route
        const takes = []
        for (let i = 0; i < runs; i++) takes.push(await audit(url, preset, chrome.port))

        const merged = {}
        for (const key of Object.keys(takes[0])) merged[key] = median(takes.map(t => t[key]))
        merged.accessibility = await auditSettled(url, preset, chrome.port)
        results[`${preset} ${route}`] = merged
        process.stderr.write(`  ${preset.padEnd(7)} ${route.padEnd(34)} perf ${merged.performance}\n`)
      }
    }
  }
  finally {
    await chrome.kill()
    await server.close()
  }

  return results
}

function table(results, baseline) {
  const head = ['route', 'perf', 'a11y', 'bp', 'seo', 'FCP', 'LCP', 'TBT', 'CLS', 'SI']
  const rows = [head]

  for (const [name, r] of Object.entries(results)) {
    const base = baseline?.[name]
    const cell = (key, value, unit = '') => {
      if (!base || base[key] === undefined) return `${value}${unit}`
      const d = value - base[key]
      if (Math.abs(d) < (key === 'cls' ? 0.001 : 1)) return `${value}${unit}`
      const sign = d > 0 ? '+' : ''
      return `${value}${unit} (${sign}${key === 'cls' ? d.toFixed(3) : Math.round(d)})`
    }
    rows.push([
      name,
      cell('performance', r.performance),
      cell('accessibility', r.accessibility),
      cell('best-practices', r['best-practices']),
      cell('seo', r.seo),
      cell('fcp', r.fcp, 'ms'),
      cell('lcp', r.lcp, 'ms'),
      cell('tbt', r.tbt, 'ms'),
      cell('cls', r.cls),
      cell('si', r.si, 'ms'),
    ])
  }

  const widths = head.map((_, i) => Math.max(...rows.map(row => String(row[i]).length)))
  return rows
    .map((row, i) => {
      const line = row.map((c, j) => String(c).padEnd(widths[j])).join('  ')
      return i === 0 ? `${line}\n${widths.map(w => '-'.repeat(w)).join('  ')}` : line
    })
    .join('\n')
}

function regressions(results, baseline) {
  if (!baseline) return []
  const out = []
  for (const [name, r] of Object.entries(results)) {
    const base = baseline[name]
    if (!base) continue
    for (const [key, slack] of Object.entries(TOLERANCE)) {
      if (base[key] === undefined || r[key] === undefined) continue
      const worse = LOWER_IS_BETTER.has(key) ? r[key] - base[key] : base[key] - r[key]
      if (worse > slack) {
        out.push(`${name}: ${key} ${base[key]} -> ${r[key]} (worse by ${key === 'cls' ? worse.toFixed(3) : Math.round(worse)}, tolerance ${slack})`)
      }
    }
  }
  return out
}

function shortfalls(results) {
  const out = []
  for (const [name, r] of Object.entries(results)) {
    for (const [key, goal] of Object.entries(GOAL)) {
      const missed = LOWER_IS_BETTER.has(key) ? r[key] > goal : r[key] < goal
      if (missed) out.push(`${name}: ${key} ${r[key]} (goal ${LOWER_IS_BETTER.has(key) ? '<=' : '>='} ${goal})`)
    }
  }
  return out
}

const results = await run()
const saving = flag('save')
const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')).results : null

console.log(`\n${table(results, baseline)}\n`)

if (saving) {
  writeFileSync(BASELINE, `${JSON.stringify({ at: new Date().toISOString(), results }, null, 2)}\n`)
  console.log(`baseline written to ${BASELINE}`)
}

const missed = shortfalls(results)
if (missed.length) {
  console.log(`still short of the goal (reported, not fatal):\n${missed.map(f => `  · ${f}`).join('\n')}\n`)
}

const which = saving ? 'previous baseline' : 'baseline'
const worse = regressions(results, baseline)
if (worse.length) {
  console.error(`REGRESSIONS against the ${which}:\n${worse.map(f => `  - ${f}`).join('\n')}`)
  if (!saving) process.exit(1)
}
else if (baseline) {
  console.log(`no regressions against the ${which}`)
}
else {
  console.log('baseline recorded')
}
