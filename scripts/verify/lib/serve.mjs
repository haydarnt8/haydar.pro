// Static server for the verify harness. It gzips like the host does: uncompressed, Lighthouse scores are far lower.
// Usage: node scripts/verify/lib/serve.mjs [--root dir] [--port 4173]
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { createGzip } from 'node:zlib'

const DEFAULT_ROOT = '.vercel/output/static'
const DEFAULT_PORT = 4173

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.pdf': 'application/pdf',
}

const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.xml', '.webmanifest'])

/** Mirrors `.vercel/output/config.json` — Lighthouse audits cache policy. */
function cacheControl(pathname) {
  if (/^\/(_nuxt|_fonts|_og-static-fonts)\//.test(pathname)) return 'public, max-age=31536000, immutable'
  if (/^\/_og\//.test(pathname)) return 'public, max-age=259200'
  return 'public, max-age=0, must-revalidate'
}

function resolveFile(root, pathname) {
  let rel = decodeURIComponent(pathname.split('?')[0])
  if (rel.endsWith('/')) rel += 'index.html'
  const full = resolve(root, `.${normalize(rel)}`)
  if (full !== root && !full.startsWith(root + sep)) return null

  if (existsSync(full) && statSync(full).isFile()) return full
  const indexed = join(full, 'index.html')
  if (existsSync(indexed)) return indexed
  const htmlised = `${full}.html`
  if (existsSync(htmlised)) return htmlised
  return null
}

export function serve({ root = DEFAULT_ROOT, port = DEFAULT_PORT } = {}) {
  const base = resolve(root)
  if (!existsSync(base)) {
    throw new Error(`[serve] ${base} does not exist — run \`pnpm run generate\` first.`)
  }

  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    let file = resolveFile(base, url.pathname)
    let status = 200

    if (!file) {
      // A real 404 status, not the SPA shell: the curtain's cold-404 path depends on it.
      file = join(base, '404.html')
      status = 404
      if (!existsSync(file)) {
        res.writeHead(404, { 'content-type': 'text/plain' })
        res.end('not found')
        return
      }
    }

    const ext = extname(file)
    const accepts = String(req.headers['accept-encoding'] ?? '').includes('gzip')
    const zip = accepts && COMPRESSIBLE.has(ext)

    const headers = {
      'content-type': TYPES[ext] ?? 'application/octet-stream',
      'cache-control': cacheControl(url.pathname),
      'x-content-type-options': 'nosniff',
    }
    if (zip) {
      headers['content-encoding'] = 'gzip'
      headers.vary = 'accept-encoding'
    }
    else {
      headers['content-length'] = statSync(file).size
    }

    res.writeHead(status, headers)
    if (req.method === 'HEAD') { res.end(); return }

    const stream = createReadStream(file)
    stream.on('error', () => { res.destroy() })
    if (zip) stream.pipe(createGzip()).pipe(res)
    else stream.pipe(res)
  })

  return new Promise((ready, fail) => {
    server.once('error', fail)
    server.listen(port, '127.0.0.1', () => {
      ready({
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise(done => server.close(done)),
      })
    })
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`)
    return i === -1 ? fallback : process.argv[i + 1]
  }
  const s = await serve({ root: arg('root', DEFAULT_ROOT), port: Number(arg('port', DEFAULT_PORT)) })
  console.log(`[serve] ${s.origin} (gzip on)`)
  process.on('SIGINT', async () => { await s.close(); process.exit(0) })
  process.on('SIGTERM', async () => { await s.close(); process.exit(0) })
}
