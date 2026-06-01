/**
 * Cross-reference every unidentified sign (family "unknown", id unknown_NN) against
 * the spell catalog to gather evidence for a possible theory of its function.
 *
 *   node tools/unknown-report.cjs
 *
 * For each unknown sign it lists every spell it appears in, its placement/orientation,
 * the core element, and the sibling signs alongside it. A theory is only worth proposing
 * once a sign shows up in >= 2 spells (so a pattern can emerge); until then it prints
 * "insufficient data". This is the evidence-gathering step behind the "Theories" section
 * in docs/signs.md — read the table, then write the theory by hand.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const signs = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'signs.json'), 'utf8')).signs;
const spells = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'spells.json'), 'utf8')).spells;

const MIN_SPELLS_FOR_THEORY = 2;
const unknownSigns = signs.filter((s) => s.family === 'unknown');

if (!unknownSigns.length) {
  console.log('No unknown-family signs catalogued yet.');
  process.exit(0);
}

for (const sign of unknownSigns) {
  console.log(`\n=== ${sign.name} (${sign.id}) ===`);
  const uses = [];
  for (const spell of spells) {
    const entry = (spell.composition?.signs || []).find((s) => s.id === sign.id);
    if (!entry) continue;
    const siblings = (spell.composition.signs || [])
      .filter((s) => s.id !== sign.id)
      .map((s) => `${s.id}${s.count > 1 ? '×' + s.count : ''}`);
    uses.push({ spell, entry, siblings });
    console.log(
      `  • ${spell.name}: ${entry.count}× at "${entry.placement}" (${entry.orientation})` +
        ` | core: ${spell.composition.core} | siblings: ${siblings.join(', ') || 'none'}`,
    );
  }

  if (!uses.length) {
    console.log('  (not referenced by any catalogued spell yet)');
    continue;
  }

  // Surface anything the sign consistently co-occurs with — the seed of a theory.
  const elements = new Set(uses.map((u) => u.spell.composition.core));
  const siblingCounts = {};
  for (const u of uses) for (const s of u.siblings) {
    const base = s.split('×')[0];
    siblingCounts[base] = (siblingCounts[base] || 0) + 1;
  }
  const alwaysWith = Object.entries(siblingCounts)
    .filter(([, n]) => n === uses.length)
    .map(([id]) => id);

  console.log(`  ─ seen in ${uses.length} spell(s); core element(s): ${[...elements].join(', ')}`);
  if (alwaysWith.length) console.log(`  ─ always appears alongside: ${alwaysWith.join(', ')}`);

  if (uses.length < MIN_SPELLS_FOR_THEORY) {
    console.log('  ─ THEORY: insufficient data (seen in only one spell). Need another appearance.');
  } else {
    console.log('  ─ THEORY: enough appearances to look for a pattern — review the rows above and write it up in docs/signs.md.');
  }
}

console.log('');
