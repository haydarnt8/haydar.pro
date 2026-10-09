import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import { serve } from './lib/serve.mjs'
import { settledConfig } from './lib/settled.mjs'

// Lists every failing accessibility audit per route, with the elements it names.
// Usage: node scripts/verify/a11y.mjs [--only /about]
const ROUTES = ['/', '/about', '/projects', '/projects/gudea-event-dashboard', '/ar']

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : process.argv[i + 1]
}

const routes = arg('only', '') ? arg('only', '').split(',') : ROUTES
const server = await serve()
const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-sandbox'] })

try {
  for (const route of routes) {
    const { lhr } = await lighthouse(
      server.origin + route,
      { port: chrome.port, output: 'json', logLevel: 'error' },
      settledConfig('desktop'),
    )
    const score = Math.round(lhr.categories.accessibility.score * 100)
    const failing = Object.values(lhr.audits).filter(a => a.score !== null && a.score < 1)
    console.log(`\n${route}  accessibility ${score}${failing.length ? '' : '  — nothing failing'}`)
    for (const a of failing) {
      console.log(`  ✗ ${a.id}: ${a.title}`)
      for (const item of (a.details?.items ?? []).slice(0, 4)) {
        const node = item.node ?? {}
        console.log(`      ${node.selector ?? ''}  ${(node.snippet ?? '').replace(/\s+/g, ' ').slice(0, 110)}`)
        if (node.explanation) console.log(`      ${node.explanation.replace(/\s+/g, ' ').slice(0, 160)}`)
      }
    }
  }
}
finally {
  await chrome.kill()
  await server.close()
}
