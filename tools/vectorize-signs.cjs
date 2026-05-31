/**
 * Vectorize the sign artwork into SVG paths and write them into data/signs.json.
 *
 *   node tools/vectorize-signs.cjs   (or: npm run vectorize:signs)
 *
 * Same approach as tools/vectorize-sigils.cjs: potrace traces the line-art,
 * coordinates are translated into the engine's "-50 -50 100 100" viewBox, and
 * each sign is re-centered on its bounding box (signs are standalone marks).
 * Traced signs are marked render:"fill" (drawn filled with fill-rule:evenodd).
 *
 * Re-run whenever the source PNGs change.
 */
const fs = require('fs');
const path = require('path');
const potrace = require('potrace');

// reference image filename -> sign id in signs.json
const MAP = {
  'Column.png': 'column', 'Dispersion.png': 'dispersion', 'Levitation.png': 'levitation',
  'Pull.png': 'pull', 'Region.png': 'direction', 'Collection.png': 'collection',
  'Sights_Set.png': 'sights_set', 'Gather.png': 'gather',
  'Crush.png': 'crush', 'Convergence.png': 'convergence', 'Weave.png': 'weave',
  'Enlarge.png': 'enlarge', 'Radial.png': 'radial', 'Rain.png': 'rain',
  'Puppet.png': 'dancing_puppet', 'Strengthen.png': 'strengthen', 'Entwine.png': 'entwine',
  'Aeriforms_Defined.png': 'aeriforms_defined', 'Glaives.png': 'glaives', 'Bind.png': 'bind', 'Link.png': 'link',
  'Float.png': 'float', 'Billowing.png': 'billowing', 'Repetition.png': 'repetition',
  'Diamond.png': 'diamond', 'Window.png': 'window', 'Crosshair.png': 'crosshair',
  'Bolt.png': 'bolt', 'Eye.png': 'eye', 'Vision.png': 'vision', 'Bend.png': 'bend',
  'Cooling.png': 'cool', 'Orb.png': 'orb',
  'Sign_of_Wind.png': 'sign_of_wind', 'Purify.png': 'purify',
};

const TRACE_OPTS = { threshold: 170, turdSize: 2, optTolerance: 0.2, turnPolicy: 'minority' };
const ROOT = path.resolve(__dirname, '..');
const IMG_DIR = path.join(ROOT, 'assets', 'images', 'signs');
const SIGNS_JSON = path.join(ROOT, 'data', 'signs.json');

const trace = (file) => new Promise((res, rej) => potrace.trace(file, TRACE_OPTS, (e, svg) => (e ? rej(e) : res(svg))));

function translate(d, dx, dy) {
  const toks = d.match(/[A-Za-z]|-?\d*\.?\d+/g) || [];
  const out = []; let cmd = '', idx = 0;
  for (const t of toks) {
    if (/[A-Za-z]/.test(t)) { cmd = t; idx = 0; out.push(t); continue; }
    if (/[MLCSQT]/.test(cmd)) { out.push((parseFloat(t) - (idx % 2 === 0 ? dx : dy)).toFixed(2)); idx++; }
    else out.push(t);
  }
  return out.join(' ').replace(/([A-Za-z]) /g, '$1');
}
const center = (d) => translate(d, 50, 50);

function bboxCenter(d) {
  const t = d.match(/[A-Za-z]|-?\d*\.?\d+/g) || [];
  let i = 0, x = 0, y = 0, cmd = '', a = 1e9, b = 1e9, c = -1e9, e = -1e9;
  const num = () => parseFloat(t[i++]);
  const hit = (px, py) => { a = Math.min(a, px); b = Math.min(b, py); c = Math.max(c, px); e = Math.max(e, py); };
  while (i < t.length) {
    if (/[A-Za-z]/.test(t[i])) cmd = t[i++];
    const C = cmd.toUpperCase();
    if (C === 'M' || C === 'L') { x = num(); y = num(); hit(x, y); cmd = C === 'M' ? 'L' : cmd; }
    else if (C === 'C') { const a1 = num(), b1 = num(), c1 = num(), e1 = num(), f = num(), g = num();
      for (let k = 1; k <= 12; k++) { const u = k / 12, m = 1 - u; hit(m*m*m*x + 3*m*m*u*a1 + 3*m*u*u*c1 + u*u*u*f, m*m*m*y + 3*m*m*u*b1 + 3*m*u*u*e1 + u*u*u*g); } x = f; y = g; }
    else if (C === 'Z') { /* */ }
    else num();
  }
  return { cx: (a + c) / 2, cy: (b + e) / 2 };
}

(async () => {
  const data = JSON.parse(fs.readFileSync(SIGNS_JSON, 'utf8'));
  let n = 0;
  for (const [file, id] of Object.entries(MAP)) {
    const sign = data.signs.find((s) => s.id === id);
    if (!sign) { console.warn('! no sign with id', id); continue; }
    const svg = await trace(path.join(IMG_DIR, file));
    const raw = (svg.match(/ d="([^"]+)"/) || [])[1] || '';
    if (!raw) { console.warn('! empty trace for', file); continue; }
    let d = center(raw);
    const { cx, cy } = bboxCenter(d);
    d = translate(d, cx, cy);
    sign.svgPath = d;
    sign.render = 'fill';
    n++;
  }
  fs.writeFileSync(SIGNS_JSON, JSON.stringify(data, null, 2) + '\n');
  console.log(`vectorized ${n} signs in data/signs.json`);
})();
