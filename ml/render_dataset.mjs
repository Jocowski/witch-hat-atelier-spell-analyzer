#!/usr/bin/env node
// render_dataset.mjs — Training-image generator for M3 (SPEC-ml-recognizer.md §M3).
//
// Imports the SHARED JS rasterizer (src/draw/glyphRasterizer.js) and uses it to
// render augmented training images from data/training-seed.json.
//
// WHY Node runs the rasterizer here (invariant #6):
//   There is exactly ONE implementation of strokes→pixels: the JS glyphRasterizer.
//   Python does NOT get a second rasterizer; it consumes the PNG files this script emits.
//   This eliminates train/serve pixel skew at the source — no parity test needed.
//
// Output:
//   ml/data/images/<symbol_name>/<N>.png   — augmented rasters (PNG via raw bytes)
//   ml/data/labels.json                    — manifest: { images:[{path,label,role}] }
//
// Coverage note:
//   training-seed.json has 62 of the 85 total symbols (36 signs + 26 sigils).
//   The remaining 23 will get prototypes from real corrected samples via the M4 flywheel.
//   This script reports the gap.
//
// CLI flags (all optional):
//   --perN   <n>    augmented copies per symbol (default 5; use 3 for quick smoke)
//   --seed   <n>    PRNG seed (default 1)
//   --size   <n>    output image side in px (default 32; must match model input)
//   --signRotHalf  <deg>  sign rotation half-range (default 180 = full circle)
//   --sigilRotHalf <deg>  sigil rotation half-range (default 15 = upright wobble)
//   --scaleLo <f>   minimum scale jitter factor (default 0.75)
//   --scaleHi <f>   maximum scale jitter factor (default 1.30)
//   --jitter  <f>   per-point ±jitter in px (default 2)
//   --swLo    <f>   stroke-width-ratio lower bound (default 0.06)
//   --swHi    <f>   stroke-width-ratio upper bound (default 0.12)
//   --out     <dir> output directory (default ml/data)
//
// Usage:
//   node ml/render_dataset.mjs --perN 3 --seed 1          # quick smoke
//   node ml/render_dataset.mjs --perN 50 --seed 42        # full bake

import { createRequire } from 'module'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { rasterizeStrokes } from '../src/draw/glyphRasterizer.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require   = createRequire(import.meta.url)

// ── CLI arg parsing ────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const eqMatch = arg.match(/^--([a-zA-Z][a-zA-Z0-9-]*)=(.*)$/)
    if (eqMatch) {
      args[eqMatch[1]] = eqMatch[2]
    } else if (arg.startsWith('--') && i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      args[arg.slice(2)] = argv[++i]
    } else if (arg.startsWith('--')) {
      args[arg.slice(2)] = true
    }
  }
  return args
}

const cli = parseArgs(process.argv.slice(2))

const PER_N          = Number(cli.perN          ?? 5)
const SEED           = Number(cli.seed          ?? 1)
const SIZE           = Number(cli.size          ?? 32)
const SIGN_ROT_HALF  = Number(cli.signRotHalf   ?? 180)
const SIGIL_ROT_HALF = Number(cli.sigilRotHalf  ?? 15)
const SCALE_LO       = Number(cli.scaleLo       ?? 0.75)
const SCALE_HI       = Number(cli.scaleHi       ?? 1.30)
const JITTER         = Number(cli.jitter        ?? 2)
const SW_LO          = Number(cli.swLo          ?? 0.06)
const SW_HI          = Number(cli.swHi          ?? 0.12)
const OUT_DIR        = cli.out ? resolve(cli.out) : resolve(__dirname, 'data')

// Total catalog size (signs.json: 52, sigils.json: 33)
const TOTAL_CATALOG = 85

// ── Seeded PRNG (mulberry32 — same as recognizer-accuracy.mjs) ────────────────

function mulberry32(seed) {
  let s = seed >>> 0
  return function () {
    s += 0x6d2b79f5
    let z = s
    z = Math.imul(z ^ (z >>> 15), z | 1)
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61)
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000
  }
}

const rng = mulberry32(SEED)

function randRange(lo, hi) {
  return lo + rng() * (hi - lo)
}

// ── PNG encoding (pure JS, no native deps) ─────────────────────────────────────
// Minimal PNG encoder for grayscale (color type 0, 8-bit).
// Uses Node's built-in zlib for deflate.

import { deflateSync } from 'zlib'

function encodePNG(pixels, width, height) {
  // pixels: Uint8Array of length width*height, 0=background 255=ink
  const IHDR = Buffer.alloc(13)
  IHDR.writeUInt32BE(width, 0)
  IHDR.writeUInt32BE(height, 4)
  IHDR.writeUInt8(8, 8)   // bit depth
  IHDR.writeUInt8(0, 9)   // color type: grayscale
  IHDR.writeUInt8(0, 10)  // compression
  IHDR.writeUInt8(0, 11)  // filter
  IHDR.writeUInt8(0, 12)  // interlace: none

  // Build raw image data with filter byte 0 per row.
  const rawData = Buffer.alloc((width + 1) * height)
  for (let y = 0; y < height; y++) {
    rawData[y * (width + 1)] = 0  // filter type: None
    for (let x = 0; x < width; x++) {
      // invert: PNG stores 0=black 255=white, but our raster is 255=ink.
      // Convention: background=white, ink=dark → output 255-val.
      rawData[y * (width + 1) + 1 + x] = 255 - pixels[y * width + x]
    }
  }

  const compressed = deflateSync(rawData)

  function crc32(buf) {
    const table = crc32.table || (crc32.table = (() => {
      const t = new Uint32Array(256)
      for (let n = 0; n < 256; n++) {
        let c = n
        for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
        t[n] = c
      }
      return t
    })())
    let c = 0xffffffff
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii')
    const body = Buffer.concat([typeBytes, data])
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length, 0)
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body), 0)
    return Buffer.concat([len, typeBytes, data, crc])
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),  // PNG signature
    chunk('IHDR', IHDR),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Load training data ─────────────────────────────────────────────────────────

const seedPath = resolve(__dirname, '..', 'data', 'training-seed.json')
const seedData = require(seedPath)

// ── Point jitter ──────────────────────────────────────────────────────────────

function jitterStrokes(strokes, jitterAmt) {
  return strokes.map((stroke) =>
    stroke.map((pt) => ({
      X: (pt.X ?? pt.x ?? 0) + randRange(-jitterAmt, jitterAmt),
      Y: (pt.Y ?? pt.y ?? 0) + randRange(-jitterAmt, jitterAmt),
    }))
  )
}

// ── Scale strokes about their centroid ────────────────────────────────────────

function scaleStrokes(strokes, factor) {
  const allPts = strokes.flat()
  if (allPts.length === 0) return strokes
  const cx = allPts.reduce((s, p) => s + (p.X ?? p.x ?? 0), 0) / allPts.length
  const cy = allPts.reduce((s, p) => s + (p.Y ?? p.y ?? 0), 0) / allPts.length
  return strokes.map((stroke) =>
    stroke.map((pt) => ({
      X: cx + ((pt.X ?? pt.x ?? 0) - cx) * factor,
      Y: cy + ((pt.Y ?? pt.y ?? 0) - cy) * factor,
    }))
  )
}

// ── Convert training-seed points → strokes (group by ID) ──────────────────────

function pointsToStrokes(points) {
  // Points have {X, Y, ID} where ID is the stroke index.
  const groups = {}
  for (const pt of points) {
    const id = pt.ID ?? 0
    if (!groups[id]) groups[id] = []
    groups[id].push({ X: pt.X, Y: pt.Y })
  }
  const ids = Object.keys(groups).map(Number).sort((a, b) => a - b)
  return ids.map((id) => groups[id])
}

// ── Main ───────────────────────────────────────────────────────────────────────

const imgDir = join(OUT_DIR, 'images')
mkdirSync(imgDir, { recursive: true })

const manifest = []
let totalImages = 0

console.log(`render_dataset.mjs — size=${SIZE}px perN=${PER_N} seed=${SEED}`)
console.log(`  signRotHalf=${SIGN_ROT_HALF}° sigilRotHalf=${SIGIL_ROT_HALF}°  scaleLo=${SCALE_LO} scaleHi=${SCALE_HI}`)
console.log(`  jitter=${JITTER}px  sw=[${SW_LO},${SW_HI}]  out=${OUT_DIR}`)
console.log()

for (const entry of seedData) {
  const { name, role, points } = entry
  const strokes = pointsToStrokes(points)
  const symbolDir = join(imgDir, name)
  mkdirSync(symbolDir, { recursive: true })

  // Rotation half-range depends on role (mirrors recognizer-accuracy.mjs convention).
  const rotHalf = role === 'sign' ? SIGN_ROT_HALF : SIGIL_ROT_HALF

  for (let i = 0; i < PER_N; i++) {
    const rotDeg      = randRange(-rotHalf, rotHalf)
    const scaleFactor = randRange(SCALE_LO, SCALE_HI)
    const sw          = randRange(SW_LO, SW_HI)

    let s = strokes
    s = scaleStrokes(s, scaleFactor)
    s = jitterStrokes(s, JITTER)

    const raster = rasterizeStrokes(s, {
      size: SIZE,
      rotationDeg: rotDeg,
      strokeWidthRatio: sw,
    })

    const pngBuf = encodePNG(raster, SIZE, SIZE)
    const fileName = `${i}.png`
    const filePath = join(symbolDir, fileName)
    writeFileSync(filePath, pngBuf)

    // Relative path from OUT_DIR for the manifest
    const relPath = `images/${name}/${fileName}`
    manifest.push({ path: relPath, label: name, role })
    totalImages++
  }
}

// ── Write manifest ─────────────────────────────────────────────────────────────

const labelsPath = join(OUT_DIR, 'labels.json')
writeFileSync(labelsPath, JSON.stringify({ images: manifest }, null, 2))

// ── Coverage report ───────────────────────────────────────────────────────────

const coveredSymbols = new Set(seedData.map((e) => e.name))
const covered        = coveredSymbols.size
const gap            = TOTAL_CATALOG - covered

console.log(`Coverage: ${covered}/${TOTAL_CATALOG} symbols in training-seed.json`)
console.log(`  (${gap} symbols have no seed template; they get prototypes from real samples via M4 flywheel)`)
console.log()
console.log(`Generated ${totalImages} images (${PER_N} per symbol × ${covered} symbols)`)
console.log(`Labels manifest: ${labelsPath}`)

const signCount  = seedData.filter((e) => e.role === 'sign').length
const sigilCount = seedData.filter((e) => e.role === 'sigil').length
console.log(`  signs: ${signCount} symbols × ${PER_N} = ${signCount * PER_N} images`)
console.log(`  sigils: ${sigilCount} symbols × ${PER_N} = ${sigilCount * PER_N} images`)
