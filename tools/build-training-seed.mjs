/**
 * build-training-seed.mjs — turn the SQL training snapshot in supabase/seed.sql into a static JSON
 * asset (data/training-seed.json) that the web prototype bundles, so the recognizer is "trained"
 * with no database. See docs/app/SPEC-web-prototype.md §3.
 *
 *   node tools/build-training-seed.mjs        (or: npm run build:seed)
 *
 * Reads the `insert into public.training_samples … select id, '<points>'::jsonb, '<role>', '<source>',
 * '<app>' … where engine_id = '<id>';` rows from the generated seed block and writes:
 *   [ { name: <engine_id>, role, source, points: [{X,Y,ID}] }, … ]
 *
 * Author-time tool: parsing happens here, not in the browser build. Re-run after `npm run seed:training`
 * refreshes seed.sql. Validates every name against the canon sign/sigil ids and warns on misses.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SEED = path.join(ROOT, 'supabase', 'seed.sql')
const OUT = path.join(ROOT, 'data', 'training-seed.json')

const require = createRequire(import.meta.url)
const sigils = require('../data/sigils.json').sigils ?? []
const signs = require('../data/signs.json').signs ?? []
const knownIds = new Set([...sigils.map((s) => s.id), ...signs.map((s) => s.id)])

const sql = fs.readFileSync(SEED, 'utf8')

// points JSON is purely numeric → contains no single quotes, so `'([^']*)'` captures it cleanly.
const RE =
  /select id, '([^']*)'::jsonb, '([^']*)', '([^']*)', '([^']*)' from public\.symbols where engine_id = '([^']*)';/g

const records = []
const unknown = new Set()
let m
while ((m = RE.exec(sql)) !== null) {
  const [, pointsJson, role, source, , name] = m
  let points
  try {
    points = JSON.parse(pointsJson)
  } catch {
    console.warn(`skip ${name}: points JSON did not parse`)
    continue
  }
  if (!Array.isArray(points) || points.length < 2) {
    console.warn(`skip ${name}: < 2 points`)
    continue
  }
  if (!knownIds.has(name)) unknown.add(name)
  records.push({ name, role, source, points })
}

if (records.length === 0) {
  console.error('build:seed: no training rows found in seed.sql — aborting (nothing written).')
  process.exit(1)
}
if (unknown.size) {
  console.warn(`build:seed: ${unknown.size} sample name(s) not in sigils.json/signs.json: ${[...unknown].join(', ')}`)
}

fs.writeFileSync(OUT, JSON.stringify(records, null, 0) + '\n')
console.log(`build:seed: wrote ${records.length} training samples → ${path.relative(ROOT, OUT)}`)
