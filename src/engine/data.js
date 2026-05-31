// Carrega e indexa os JSONs de regras/sigils/signs/spells.
// Vite importa JSON nativamente; data/ está na raiz do projeto.
import rules from '../../data/rules.json'
import sigilsDoc from '../../data/sigils.json'
import signsDoc from '../../data/signs.json'
import spellsDoc from '../../data/spells.json'
import dyesDoc from '../../data/dyes.json'

export const RULES = rules
export const SIGILS = sigilsDoc.sigils
export const SIGNS = signsDoc.signs
export const SPELLS = spellsDoc.spells
export const DYES = dyesDoc.dyes

export const SIGIL_RENDER_DEFAULTS = sigilsDoc.renderDefaults
export const SIGN_RENDER_DEFAULTS = signsDoc.renderDefaults

const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]))
export const SIGIL_MAP = byId(SIGILS)
export const SIGN_MAP = byId(SIGNS)
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
