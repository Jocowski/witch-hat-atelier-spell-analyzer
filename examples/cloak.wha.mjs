// The Cloak Spell, authored in wha-lang (spec docs/wha-lang.md §10).
//
// ~15 lines of intent, zero coordinates: a vision core ringed by winds and shadow-arm units,
// a puppet/region body band, and two channelway bands (region + bend) braided around the rim.
// Emitting it reproduces the four-ring wha-spell@2 device the engine validates.
//
//   node tools/wha-lang-cli.mjs examples/cloak.wha.mjs | node tools/spell-engine-cli.mjs --facts

import { SPELL, CIRCLE, GROUP, SIGIL, SIGN, CARDINAL, DIAGONAL, IN, OUT, AROUND, OUT_R } from '../tools/wha-lang.mjs'

// One diagonal arm: an eye (innermost), a bend further out, two columns aimed outward at the bend.
const shadowArm = GROUP('shadow_arm',
  SIGN('EYE'),
  SIGN('ENVELOPMENT', { radius: OUT_R }),
  SIGN('COLUMN', 2, { face: OUT, spread: 24 }),
)

const inner = CIRCLE('inner', { radius: 140, core: SIGN('VISION') },
  SIGIL('WIND', 4, { at: CARDINAL }), // one wind per cardinal
  GROUP(shadowArm, 4, { at: DIAGONAL }), // the eye→bend→columns unit, ×4
)

const body = CIRCLE('body', { radius: 172 },
  SIGN('PUPPET', 4, { at: CARDINAL }), // mind-pilot wheels on the cardinals
  SIGN('REGION', 8, { at: CARDINAL, face: IN }), // 2 per cardinal (auto-flank), aimed inward
)

const chanRegion = CIRCLE('chan_region', { radius: 205 },
  SIGN('REGION', 18, { face: AROUND }), // channelway, inner band
)

const chanBend = CIRCLE('chan_bend', { radius: 235 },
  SIGN('ENVELOPMENT', 24, { face: AROUND }), // channelway, braided rim
)

export default SPELL('Cloak Spell').stack(inner, body, chanRegion, chanBend)
