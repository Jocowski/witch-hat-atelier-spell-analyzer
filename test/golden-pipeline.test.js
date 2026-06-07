// golden-pipeline.test.js — behavior oracle for the architecture refactor (refactor-plan-spec §6.2).
//
// Runs the REAL engine over the entire assets/spells/*.json corpus through tools/spell-engine-cli.mjs
// (the node-loadable mirror of src/engine/analyze.js — the app's analyze can't load under node --test
// because of Vite-style JSON imports) in BOTH default-JSON and --facts modes, and asserts the output
// is byte-identical to the committed snapshots in test/__golden__/.
//
// This is the primary regression gate for every move/extraction phase of the refactor: any change that
// alters engine output fails here. The CLI imports the pure engine modules, so when those modules move
// (with export-* shims at the old paths during migration) this test proves the move changed nothing.
//
// Regenerate the snapshots ONLY from a known-good tree (e.g. main before the refactor):
//   UPDATE_GOLDENS=1 node --test test/golden-pipeline.test.js
// then commit test/__golden__/. Without the env var, missing/mismatched snapshots FAIL the test.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, basename } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const corpusDir = resolve(root, 'assets/spells')
const goldenDir = resolve(here, '__golden__')
const cli = resolve(root, 'tools/spell-engine-cli.mjs')
const UPDATE = process.env.UPDATE_GOLDENS === '1'

if (!existsSync(goldenDir)) mkdirSync(goldenDir, { recursive: true })

const spells = readdirSync(corpusDir).filter((f) => f.endsWith('.json')).sort()

// Run the CLI over one spell file in the given mode; return stdout (normalised newlines).
function runCli(file, mode) {
  const args = mode === 'facts' ? ['--facts', file] : [file]
  const out = execFileSync('node', [cli, ...args], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return out.replace(/\r\n/g, '\n')
}

function checkOrUpdate(name, mode, actual) {
  const goldenPath = resolve(goldenDir, `${name}.${mode}.txt`)
  if (UPDATE) {
    writeFileSync(goldenPath, actual)
    return
  }
  assert.ok(existsSync(goldenPath), `Missing golden ${goldenPath} — run UPDATE_GOLDENS=1 from a known-good tree`)
  const expected = readFileSync(goldenPath, 'utf8').replace(/\r\n/g, '\n')
  assert.equal(actual, expected, `Engine output drift for ${name} (${mode}). The refactor must not change behavior.`)
}

for (const spellFile of spells) {
  const name = basename(spellFile, '.json')
  const file = resolve(corpusDir, spellFile)
  test(`golden: ${name} (analyze)`, () => { checkOrUpdate(name, 'analyze', runCli(file, 'analyze')) })
  test(`golden: ${name} (facts)`, () => { checkOrUpdate(name, 'facts', runCli(file, 'facts')) })
}
