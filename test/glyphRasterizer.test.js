// glyphRasterizer.test.js — smoke tests for the shared JS rasterizer (M3/M4).
//
// These tests run under plain `node --test` — no DOM, no canvas, no JSON import.
// The rasterizer is PURE (no imports), so these tests also validate the purity contract.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rasterizeStrokes, rasterToModelInput } from '../src/draw/glyphRasterizer.js'

// ── helpers ───────────────────────────────────────────────────────────────────

function lineStrokes(x0, y0, x1, y1, steps = 20) {
  const pts = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    pts.push({ X: x0 + (x1 - x0) * t, Y: y0 + (y1 - y0) * t })
  }
  return [pts]
}

// ── tests ─────────────────────────────────────────────────────────────────────

test('rasterizeStrokes — empty strokes returns zero buffer', () => {
  const out = rasterizeStrokes([], { size: 16 })
  assert.ok(out instanceof Uint8Array, 'returns Uint8Array')
  assert.equal(out.length, 16 * 16)
  assert.ok(out.every((v) => v === 0), 'all zeros for empty input')
})

test('rasterizeStrokes — output length matches size*size', () => {
  const strokes = lineStrokes(-10, 0, 10, 0)
  for (const size of [16, 32, 64]) {
    const out = rasterizeStrokes(strokes, { size })
    assert.equal(out.length, size * size, `size=${size}`)
  }
})

test('rasterizeStrokes — a horizontal line produces ink pixels', () => {
  const strokes = lineStrokes(-20, 0, 20, 0, 50)
  const out = rasterizeStrokes(strokes, { size: 32 })
  const inkPixels = out.filter((v) => v > 0).length
  assert.ok(inkPixels > 0, 'at least one ink pixel')
  // Middle row(s) should have ink; extreme corners should be background.
  // (Just sanity — not pixel-perfect, the exact count varies by stroke width.)
  assert.ok(inkPixels < 32 * 32, 'not all pixels are ink')
})

test('rasterizeStrokes — rotation produces different but non-empty output', () => {
  const strokes = lineStrokes(-20, 0, 20, 0, 50)
  const out0   = rasterizeStrokes(strokes, { size: 32, rotationDeg: 0   })
  const out90  = rasterizeStrokes(strokes, { size: 32, rotationDeg: 90  })
  // The rotated raster should differ from the original.
  let differ = false
  for (let i = 0; i < out0.length; i++) {
    if (out0[i] !== out90[i]) { differ = true; break }
  }
  assert.ok(differ, 'rotated raster differs from original')
  assert.ok(out90.some((v) => v > 0), 'rotated raster has ink pixels')
})

test('rasterizeStrokes — deterministic: same input same output', () => {
  const strokes = lineStrokes(-10, -10, 10, 10, 30)
  const a = rasterizeStrokes(strokes, { size: 32, rotationDeg: 45 })
  const b = rasterizeStrokes(strokes, { size: 32, rotationDeg: 45 })
  assert.deepEqual(Array.from(a), Array.from(b), 'identical outputs for identical inputs')
})

test('rasterizeStrokes — accepts {X,Y} points (training-seed format)', () => {
  // training-seed.json uses {X, Y, ID}; strokes here use {X, Y}.
  const strokes = [[
    { X: -10, Y: 0 },
    { X:   0, Y: 5 },
    { X:  10, Y: 0 },
  ]]
  const out = rasterizeStrokes(strokes, { size: 16 })
  assert.equal(out.length, 256)
  assert.ok(out.some((v) => v > 0), 'ink pixels present')
})

test('rasterizeStrokes — multi-stroke input', () => {
  const stroke1 = lineStrokes(-10, -10, 10, 10, 20)
  const stroke2 = lineStrokes(-10,  10, 10, -10, 20)
  const out = rasterizeStrokes([...stroke1, ...stroke2], { size: 32 })
  assert.ok(out.some((v) => v > 0), 'ink pixels present for multi-stroke input')
})

test('rasterToModelInput — converts Uint8Array to Float32Array in [0,1]', () => {
  const raster = new Uint8Array([0, 128, 255, 64])
  const inp = rasterToModelInput(raster)
  assert.ok(inp instanceof Float32Array, 'returns Float32Array')
  assert.equal(inp.length, 4)
  assert.ok(Math.abs(inp[0] - 0)     < 1e-6, 'value 0 → 0.0')
  assert.ok(Math.abs(inp[2] - 1)     < 1e-6, 'value 255 → 1.0')
  assert.ok(inp[1] > 0 && inp[1] < 1,        'intermediate value in (0,1)')
})

test('rasterToModelInput — pipeline: rasterize then convert', () => {
  const strokes = lineStrokes(-15, -15, 15, 15, 40)
  const raster = rasterizeStrokes(strokes, { size: 32 })
  const inp    = rasterToModelInput(raster)
  assert.equal(inp.length, 32 * 32)
  assert.ok(inp.every((v) => v >= 0 && v <= 1), 'all values in [0,1]')
  assert.ok(inp.some((v) => v > 0), 'has non-zero (ink) values')
})
