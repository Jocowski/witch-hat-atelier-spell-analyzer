#!/usr/bin/env node
// render.mjs — the AI→human half of the "compiler". Turns a wha-spell composition
// (v1 single-circle or v2 multi-circle) into a standalone SVG of the seal, WITHOUT the
// React app. This lets the agent hand the user a viewable picture of a spell it designed
// or reconstructed, closing the loop the GUI's "Copy image" only covered interactively.
//
// It mirrors the SVG that src/components/GlyphCanvas.jsx draws (ring + guide rings/axes +
// glyphs), reading the same svgPath/text/render fields from data/{sigils,signs}.json, so a
// rendered seal looks like the one in the app. Geometry is read through the pure
// compose/geometry modules so coordinates stay consistent with the engine.
//
// Usage:
//   node tools/render.mjs path/to/spell.json                 # SVG to stdout
//   node tools/render.mjs path/to/spell.json -o out.svg      # SVG to a file
//   echo '<json>' | node tools/render.mjs > out.svg          # read stdin
//   node tools/render.mjs spell.json --no-guides             # hide guide rings/axes
//
// Output is dependency-free SVG (open it in a browser / VS Code). PNG conversion is left
// to the caller (e.g. an SVG→PNG tool), since the repo has no raster rasterizer.

import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const sigilsDoc = require(resolve(root, 'data/sigils.json'))
const signsDoc = require(resolve(root, 'data/signs.json'))

const importLocal = (rel) => import(pathToFileURL(resolve(root, rel)).href)
const { toComposition } = await importLocal('src/engine/compose.js')
const { anchorToXY } = await importLocal('src/engine/geometry.js')

const SIGIL_MAP = Object.fromEntries(sigilsDoc.sigils.map((s) => [s.id, s]))
const SIGN_MAP = Object.fromEntries(signsDoc.signs.map((s) => [s.id, s]))
const getDef = (type) => SIGIL_MAP[type] || SIGN_MAP[type] || null

// Visual ring radius per size (mirror GlyphCanvas.RING_RADII / OUTER_MAX_FRAC).
const RING_RADII = { small: 110, medium: 170, big: 240 }
const OUTER_MAX_FRAC = 1.7
const ringRadiusOf = (c) => c.radius ?? RING_RADII[c.ring?.size] ?? RING_RADII.medium

const COLOR = { sign: '#3a2a16', sigil: '#c0521f', ringClosed: '#5a3b1e', ringOpen: '#9c7a4a', bg: '#f4ead2', guide: 'rgba(90,60,30,.16)', axis: 'rgba(90,60,30,.10)', label: 'rgba(90,60,30,.55)' }

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// SVG arc for the open ring (angles deg, 0=north clockwise) — mirrors GlyphCanvas.describeArc.
function describeArc(cx, cy, r, startDeg, endDeg) {
  const p = (deg) => {
    const rad = (deg * Math.PI) / 180
    return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) }
  }
  const a = p(startDeg)
  const b = p(endDeg)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`
}

// One glyph (core or component), mirroring GlyphCanvas.ComponentGlyph's transform.
function glyph(comp, role) {
  const def = getDef(comp.type)
  if (!def) {
    // Unknown id: draw a dashed placeholder ring + the id so the picture still shows it.
    return `<g transform="translate(${comp.x || 0} ${comp.y || 0})"><circle r="22" fill="none" stroke="#b03a3a" stroke-width="2" stroke-dasharray="3 3"/><text y="4" text-anchor="middle" font-size="11" fill="#b03a3a">${esc(comp.type)}</text></g>`
  }
  const size = 56 * (comp.scale ?? 1)
  const s = size / 100
  const sx = (comp.mirrored ? -s : s).toFixed(4)
  const sy = (comp.inverted ? -s : s).toFixed(4)
  const t = `translate(${comp.x || 0} ${comp.y || 0}) rotate(${comp.rotation || 0}) scale(${sx} ${sy})`
  const color = comp.color || (role === 'sign' ? COLOR.sign : COLOR.sigil)
  let inner
  if (def.text) {
    inner = `<text x="0" y="15" text-anchor="middle" font-size="58" font-weight="700" fill="${color}">${esc(def.text)}</text>`
  } else if (def.render === 'fill') {
    inner = `<path d="${def.svgPath}" fill="${color}" fill-rule="evenodd" stroke="none"/>`
  } else {
    inner = `<path d="${def.svgPath}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`
  }
  return `<g transform="${t}">${inner}</g>`
}

function circleSvg(circle, { guides }) {
  const R = ringRadiusOf(circle)
  const out = [`<g transform="translate(${circle.center.x} ${circle.center.y})">`]
  if (guides) {
    out.push(`<circle r="${(R * 0.45).toFixed(1)}" fill="none" stroke="${COLOR.guide}" stroke-width="1" stroke-dasharray="3 5"/>`)
    out.push(`<circle r="${(R * 0.75).toFixed(1)}" fill="none" stroke="${COLOR.guide}" stroke-width="1" stroke-dasharray="3 5"/>`)
    out.push(`<line x1="0" y1="${-R}" x2="0" y2="${R}" stroke="${COLOR.axis}"/>`)
    out.push(`<line x1="${-R}" y1="0" x2="${R}" y2="0" stroke="${COLOR.axis}"/>`)
  }
  // Activation ring (closed circle or open arc).
  if (circle.ring?.closed) {
    out.push(`<circle r="${R}" fill="none" stroke="${COLOR.ringClosed}" stroke-width="6"/>`)
  } else {
    out.push(`<path d="${describeArc(0, 0, R, 18, 342)}" fill="none" stroke="${COLOR.ringOpen}" stroke-width="6"/>`)
  }
  // Circle name (above the ring).
  if (circle.name) out.push(`<text x="0" y="${-R - 12}" text-anchor="middle" font-size="13" fill="${COLOR.label}">${esc(circle.name)}${circle.ring?.closed ? '' : ' · open'}</text>`)
  // Core, then components (ring-anchored parts resolved to x,y).
  if (circle.core) out.push(glyph({ ...circle.core }, 'core'))
  for (const p of circle.components || []) {
    const resolved = p.anchor?.ring ? { ...p, ...anchorToXY(p.anchor.angle || 0, p.anchor.offset || 0, R) } : p
    out.push(glyph(resolved, p.role === 'sigil' ? 'sigil' : p.role === 'sign' ? 'sign' : 'sigil'))
  }
  out.push('</g>')
  return out.join('\n')
}

function renderSpell(input, { guides = true } = {}) {
  const { name, circles, relations } = toComposition(input)
  // Auto-fit viewBox to all circles (mirror GlyphCanvas.fit).
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const c of circles) {
    let reach = ringRadiusOf(c)
    for (const p of c.components || []) reach = Math.max(reach, Math.hypot(p.x || 0, p.y || 0))
    minX = Math.min(minX, c.center.x - reach); minY = Math.min(minY, c.center.y - reach)
    maxX = Math.max(maxX, c.center.x + reach); maxY = Math.max(maxY, c.center.y + reach)
  }
  if (!isFinite(minX)) { minX = -200; minY = -200; maxX = 200; maxY = 200 }
  const pad = 60
  const banner = name ? 48 : 0
  const vx = minX - pad
  const vy = minY - pad - banner
  const vw = (maxX - minX) + pad * 2
  const vh = (maxY - minY) + pad * 2 + banner

  const body = []
  // Relation lines (rim-to-center, behind circles) — light, just to show structure.
  const centerOf = Object.fromEntries(circles.map((c) => [c.id, c.center]))
  for (const rel of relations || []) {
    const aId = rel.type === 'nest' ? rel.outer : rel.a
    const bId = rel.type === 'nest' ? rel.inner : rel.b
    const a = centerOf[aId]; const b = centerOf[bId]
    if (!a || !b) continue
    body.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${rel.type === 'nest' ? 'rgba(90,60,30,.30)' : '#7a5a2a'}" stroke-width="${rel.type === 'nest' ? 1.5 : 3}" ${rel.type === 'nest' ? 'stroke-dasharray="4 4"' : ''}/>`)
  }
  // Larger circles first so smaller nested ones sit on top.
  for (const c of [...circles].sort((p, q) => ringRadiusOf(q) - ringRadiusOf(p))) body.push(circleSvg(c, { guides }))

  const title = name ? `<text x="${(minX + maxX) / 2}" y="${vy + 30}" text-anchor="middle" font-size="24" font-weight="700" fill="#5a3b1e">${esc(name)}</text>` : ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}" width="${Math.round(vw)}" height="${Math.round(vh)}" font-family="Georgia, serif">
<rect x="${vx.toFixed(1)}" y="${vy.toFixed(1)}" width="${vw.toFixed(1)}" height="${vh.toFixed(1)}" fill="${COLOR.bg}"/>
${title}
${body.join('\n')}
</svg>`
}

function main() {
  const args = process.argv.slice(2)
  const guides = !args.includes('--no-guides')
  const oIdx = args.findIndex((a) => a === '-o' || a === '--out')
  const outPath = oIdx >= 0 ? args[oIdx + 1] : null
  // The input file is the first positional arg that isn't a flag or the -o value.
  const fileArg = args.find((a, i) => !a.startsWith('-') && i !== oIdx + 1)
  let raw
  if (fileArg) raw = readFileSync(resolve(process.cwd(), fileArg), 'utf8')
  else raw = readFileSync(0, 'utf8')

  let parsed
  try { parsed = JSON.parse(raw) } catch (e) { console.error('Invalid JSON input:', e.message); process.exit(2) }
  const composition = parsed.composition || parsed
  const svg = renderSpell(composition, { guides })
  if (outPath) { writeFileSync(resolve(process.cwd(), outPath), svg); console.error(`Wrote ${outPath}`) }
  else process.stdout.write(svg + '\n')
}

main()
