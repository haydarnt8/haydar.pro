#!/usr/bin/env node
/**
 * Favicons and portrait copies from design/logo/haydar-portrait.svg: `node scripts/generate-icons.mjs`.
 * The apple-touch icon is a full square: iOS rounds it itself and paints clear pixels black.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = path.join(ROOT, 'design/logo/haydar-portrait.svg')
const PUBLIC = path.join(ROOT, 'public')

// Site tokens: --color-surface (dark) and --color-lamp.
const TILE = '#090909'
const LAMP = '#fee3a4'
const RADIUS = 0.219 // the tile's corner, as a share of its side
const DISC = 0.43 // the disc's radius, as a share of the side

const R = 2048
const rendered = new Resvg(fs.readFileSync(SOURCE, 'utf8'), { fitTo: { mode: 'width', value: R } }).render()
// One copy: the binding builds a new buffer on every read of `pixels`.
const pixels = rendered.pixels
const opaque = (x, y) => pixels[(y * R + x) * 4 + 3] > 128

let top = R
for (let y = 0; y < R && top === R; y++) for (let x = 0; x < R; x++) if (opaque(x, y)) { top = y; break }
// The head: the widest opaque run between 25% and 40% of the height, above the shoulders.
let left = R, right = 0
for (let y = Math.round(R * 0.25); y < R * 0.4; y++) {
  for (let x = 0; x < R; x++) if (opaque(x, y)) { left = Math.min(left, x); right = Math.max(right, x) }
}
const side = (right - left) * 1.47
const cut = {
  left: Math.round((left + right) / 2 - side / 2),
  top: Math.round(Math.max(0, top - side * 0.006)),
  width: Math.round(side),
  height: Math.round(side),
}
const head = await sharp(Buffer.from(rendered.asPng())).extract(cut).resize(1024, 1024).png().toBuffer()

async function icon(size, { rounded }) {
  const T = 1024, r = rounded ? Math.round(T * RADIUS) : 0
  const svg = (inner) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${T}" height="${T}">${inner}</svg>`)
  const layers = [{ input: head }]
  if (rounded) layers.push({ input: svg(`<rect width="${T}" height="${T}" rx="${r}" fill="#fff"/>`), blend: 'dest-in' })
  const big = await sharp(svg(`<rect width="${T}" height="${T}" rx="${r}" fill="${TILE}"/><circle cx="${T / 2}" cy="${T / 2}" r="${T * DISC}" fill="${LAMP}"/>`))
    .composite(layers).png().toBuffer()
  const small = sharp(big).resize(size, size, { kernel: 'lanczos3' })
  return (rounded ? small : small.flatten({ background: TILE }))
    .png({ compressionLevel: 9, palette: true, quality: 92, effort: 10, dither: 0.6 }).toBuffer()
}

function ico(frames) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(frames.length, 4)
  const directory = Buffer.alloc(16 * frames.length)
  let offset = header.length + directory.length
  frames.forEach(({ size, png }, i) => {
    const o = i * 16
    directory.writeUInt8(size >= 256 ? 0 : size, o)
    directory.writeUInt8(size >= 256 ? 0 : size, o + 1)
    directory.writeUInt16LE(1, o + 4) // colour planes
    directory.writeUInt16LE(32, o + 6) // bits per pixel
    directory.writeUInt32LE(png.length, o + 8)
    directory.writeUInt32LE(offset, o + 12)
    offset += png.length
  })
  return Buffer.concat([header, directory, ...frames.map(f => f.png)])
}

const frames = []
for (const size of [16, 32, 48, 64]) frames.push({ size, png: await icon(size, { rounded: true }) })
fs.writeFileSync(path.join(PUBLIC, 'favicon.ico'), ico(frames))
fs.writeFileSync(path.join(PUBLIC, 'apple-touch-icon.png'), await icon(180, { rounded: false }))
fs.writeFileSync(path.join(PUBLIC, 'icon-192.png'), await icon(192, { rounded: true }))
fs.writeFileSync(path.join(PUBLIC, 'icon-512.png'), await icon(512, { rounded: true }))

const PORTRAIT = path.join(PUBLIC, 'portrait')
const EXPORTS = path.join(ROOT, 'design/logo/exports')
fs.mkdirSync(PORTRAIT, { recursive: true })
fs.mkdirSync(EXPORTS, { recursive: true })
const whole = Buffer.from(rendered.asPng())
fs.rmSync(path.join(PORTRAIT, 'bust.webp'), { force: true })

async function onLamp(size) {
  const T = 1024
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${T}" height="${T}"><rect width="${T}" height="${T}" fill="${LAMP}"/></svg>`))
    .composite([{ input: head }]).png().toBuffer()
    .then(b => sharp(b).resize(size, size, { kernel: 'lanczos3' }))
}
// 256: the 404 badge is 8rem, so 2x screens get every pixel.
await (await onLamp(256)).webp({ quality: 84, effort: 6 }).toFile(path.join(PORTRAIT, 'avatar.webp'))
await (await onLamp(1024)).png({ compressionLevel: 9 }).toFile(path.join(EXPORTS, 'avatar-1024.png'))
await (await onLamp(400)).png({ compressionLevel: 9 }).toFile(path.join(EXPORTS, 'avatar-400.png'))

{
  const headW = right - left, cx = (left + right) / 2
  // Padded above the hair so the disc is never cut flat.
  const w = Math.round(headW * 2.1), pad = Math.round(headW * 0.26), y = top, h = R - y
  const x = Math.round(cx - w / 2)
  const disc = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h + pad}"><circle cx="${w / 2}" cy="${Math.round(pad + headW * 0.62)}" r="${Math.round(headW * 0.84)}" fill="${LAMP}"/></svg>`
  const part = await sharp(whole).extract({ left: x, top: y, width: w, height: h }).png().toBuffer()
  const big = await sharp(Buffer.from(disc)).composite([{ input: part, top: pad, left: 0 }]).png().toBuffer()
  // PNG, not WebP: satori's renderer is surest of PNG.
  await sharp(big).resize(400, Math.round(400 * (h + pad) / w), { kernel: 'lanczos3' })
    .png({ compressionLevel: 9, palette: true, quality: 92, effort: 10, dither: 0.6 }).toFile(path.join(PORTRAIT, 'og.png'))
}

for (const f of ['favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'portrait/avatar.webp', 'portrait/og.png']) {
  console.log(`${f.padEnd(22)}${(fs.statSync(path.join(PUBLIC, f)).size / 1024).toFixed(1)} KB`)
}
for (const f of ['avatar-1024.png', 'avatar-400.png']) console.log(`exports/${f.padEnd(14)}${(fs.statSync(path.join(EXPORTS, f)).size / 1024).toFixed(1)} KB`)
