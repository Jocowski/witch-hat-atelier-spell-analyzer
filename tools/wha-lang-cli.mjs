#!/usr/bin/env node
// wha-lang-cli — compile a .wha.mjs spell file (wha-lang JS-builder source) to wha-spell JSON.
//
// A .wha.mjs file imports from tools/wha-lang.mjs and `export default`s a SPELL (the object
// returned by SPELL(...).stack(...)/.link(...)/etc — anything with an .emit() method). This
// CLI imports it, calls .emit(), and prints the resulting wha-spell@1/@2 JSON to stdout, so it
// pipes straight into the existing engine tools:
//
//   node tools/wha-lang-cli.mjs examples/cloak.wha.mjs                       # JSON to stdout
//   node tools/wha-lang-cli.mjs examples/cloak.wha.mjs | node tools/spell-engine-cli.mjs --facts -
//   node tools/wha-lang-cli.mjs examples/cloak.wha.mjs | node tools/render.mjs - -o cloak.svg
//
// Mirrors the conventions of tools/spell-engine-cli.mjs (ESM, stdin/file, JSON to stdout).

import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

async function main() {
  const args = process.argv.slice(2)
  const fileArg = args.find((a) => !a.startsWith('--'))
  if (!fileArg) {
    console.error('Usage: node tools/wha-lang-cli.mjs path/to/spell.wha.mjs')
    process.exit(2)
  }
  const abs = resolve(process.cwd(), fileArg)
  let mod
  try {
    mod = await import(pathToFileURL(abs).href)
  } catch (e) {
    console.error(`wha-lang: failed to load "${fileArg}": ${e.message}`)
    process.exit(2)
  }
  const spell = mod.default
  if (!spell || typeof spell.emit !== 'function') {
    console.error(`wha-lang: "${fileArg}" must \`export default\` a SPELL(...) (an object with .emit()).`)
    process.exit(2)
  }
  let json
  try {
    json = spell.emit()
  } catch (e) {
    console.error(`wha-lang: compile error: ${e.message}`)
    process.exit(1)
  }
  console.log(JSON.stringify(json, null, 2))
}

main()
