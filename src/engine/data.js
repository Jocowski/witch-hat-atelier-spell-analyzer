// Carrega e indexa os dados de regras/sigils/signs/spells.
// Sigils/signs/grammar agora vêm do symbolStore (baseline JSON ⊕ overlay do DB), então a paleta e o
// engine refletem edições do Admin em runtime. RULES/SPELLS/DYES continuam estáticos (fora de escopo).
import rules from '../../data/rules.json'
import spellsDoc from '../../data/spells.json'
import dyesDoc from '../../data/dyes.json'
import { getSnapshot, subscribe, SIGIL_RENDER_DEFAULTS, SIGN_RENDER_DEFAULTS } from './symbolStore.js'

export const RULES = rules
export const SPELLS = spellsDoc.spells
export const DYES = dyesDoc.dyes

export { SIGIL_RENDER_DEFAULTS, SIGN_RENDER_DEFAULTS }

// Live bindings: re-pointed whenever the overlay changes so importers (palette, engine) see fresh
// data on their next render/call. ES module `let` exports are live, so `import { SIGILS }` tracks
// these reassignments — but read them at call/render time (don't capture into a long-lived const).
export let SIGILS = getSnapshot().sigils
export let SIGNS = getSnapshot().signs
export let SIGIL_MAP = getSnapshot().sigilMap
export let SIGN_MAP = getSnapshot().signMap

subscribe(() => {
  const s = getSnapshot()
  SIGILS = s.sigils
  SIGNS = s.signs
  SIGIL_MAP = s.sigilMap
  SIGN_MAP = s.signMap
})

const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]))
export const SPELL_MAP = byId(SPELLS)
export const DYE_MAP = byId(DYES)

// Lookup unificado (sigil ou sign) — usado pelo render de qualquer componente.
export function getComponentDef(type) {
  return SIGIL_MAP[type] || SIGN_MAP[type] || null
}

export function isSigilType(type) {
  return Boolean(SIGIL_MAP[type])
}

// Signs que podem ocupar o centro (núcleo) como sigil.
export function signCanBeCenter(type) {
  const s = SIGN_MAP[type]
  return Boolean(s && s.canBeCenter)
}

// Núcleo válido = sigil OU sign que pode ser centro.
export function canBeCore(type) {
  return isSigilType(type) || signCanBeCenter(type)
}
