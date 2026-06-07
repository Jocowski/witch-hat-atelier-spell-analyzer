// templates.js — persistence for the drawn-symbol training set. Phase-1 storage is localStorage
// (per-browser) with JSON export/import; a central DB (Supabase) only enters once multiple people
// contribute. See docs/app/DRAWING-APP.md. Each template: { name, role:'sign'|'sigil', points:[{X,Y,ID}] }.

const KEY = 'wha-draw-templates-v1'

export function loadTemplates() {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] }
}
export function saveTemplates(templates) {
  localStorage.setItem(KEY, JSON.stringify(templates))
}
export function addTemplate(template) {
  const all = loadTemplates(); all.push(template); saveTemplates(all); return all
}
export function removeByName(name) {
  const all = loadTemplates().filter((t) => t.name !== name); saveTemplates(all); return all
}
// Count of stored examples grouped by label (for the trainer UI).
export function templateSummary(templates) {
  const g = {}
  for (const t of templates) (g[t.name] = g[t.name] || { role: t.role, n: 0 }).n++
  return g
}
export function exportTemplates(templates) {
  return JSON.stringify(templates, null, 2)
}
