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

// Rotate a path's coordinates about the origin by `deg` degrees. Positive = clockwise
// as drawn on screen (y-down), so 90 sends the art's top edge to its right edge.
function rotate(d, deg) {
  const r = (deg * Math.PI) / 180, cos = Math.cos(r), sin = Math.sin(r);
  const toks = d.match(/[A-Za-z]|-?\d*\.?\d+/g) || [];
  const out = []; let cmd = '', buf = [];
  const flush = () => {
    for (let k = 0; k + 1 < buf.length; k += 2) {
      const x = buf[k], y = buf[k + 1];
      out.push((x * cos - y * sin).toFixed(2), (x * sin + y * cos).toFixed(2));
    }
    buf = [];
  };
  for (const t of toks) {
    if (/[A-Za-z]/.test(t)) { flush(); cmd = t; out.push(t); continue; }
    if (/[MLCSQT]/.test(cmd)) buf.push(parseFloat(t));
    else out.push(t);
  }
  flush();
  return out.join(' ').replace(/([A-Za-z]) /g, '$1');
}

// Uniformly scale a path's coordinates (used to fit odd-sized crops into the viewBox).
function scale(d, k) {
  const toks = d.match(/[A-Za-z]|-?\d*\.?\d+/g) || [];
  const out = []; let cmd = '';
  for (const t of toks) {
    if (/[A-Za-z]/.test(t)) { cmd = t; out.push(t); continue; }
    if (/[MLCSQT]/.test(cmd)) out.push((parseFloat(t) * k).toFixed(2));
    else out.push(t);
  }
  return out.join(' ').replace(/([A-Za-z]) /g, '$1');
}

// Largest half-extent of a path already centered on the origin.
function maxHalfExtent(d) {
  const t = d.match(/[A-Za-z]|-?\d*\.?\d+/g) || [];
  let i = 0, x = 0, y = 0, cmd = '', m = 0;
  const num = () => parseFloat(t[i++]);
  const hit = (px, py) => { m = Math.max(m, Math.abs(px), Math.abs(py)); };
  while (i < t.length) {
    if (/[A-Za-z]/.test(t[i])) cmd = t[i++];
    const C = cmd.toUpperCase();
    if (C === 'M' || C === 'L') { x = num(); y = num(); hit(x, y); cmd = C === 'M' ? 'L' : cmd; }
    else if (C === 'C') { const a1 = num(), b1 = num(), c1 = num(), e1 = num(), f = num(), g = num();
      for (let k = 1; k <= 12; k++) { const u = k / 12, mm = 1 - u; hit(mm*mm*mm*x + 3*mm*mm*u*a1 + 3*mm*u*u*c1 + u*u*u*f, mm*mm*mm*y + 3*mm*mm*u*b1 + 3*mm*u*u*e1 + u*u*u*g); } x = f; y = g; }
    else if (C === 'Z') { /* */ }
    else num();
  }
  return m;
}

// Recenter on the bbox, then shrink to fit within a half-extent margin of the viewBox.
// Known signs come pre-sized (~70px squares); arbitrary unknown-sign crops may not, so
// this keeps them from overflowing the -50..50 box.
const FIT_HALF = 42;
function recenterAndFit(d, deg = 0) {
  const { cx, cy } = bboxCenter(d);
  let out = translate(d, cx, cy);
  if (deg) out = rotate(out, deg);
  const half = maxHalfExtent(out);
  if (half > FIT_HALF) out = scale(out, FIT_HALF / half);
  return out;
}

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

// Unknown signs live in assets/images/signs/unknown/ and are auto-discovered, so
// adding a new one needs no edit here: drop Unknown_NN.png in that folder and its
// id becomes unknown_NN (the matching entry must already exist in signs.json).
const UNKNOWN_DIR = path.join(IMG_DIR, 'unknown');
function unknownJobs() {
  if (!fs.existsSync(UNKNOWN_DIR)) return [];
  return fs.readdirSync(UNKNOWN_DIR)
    .map((file) => {
      const m = /^Unknown_(\d+)\.png$/i.exec(file);
      return m ? { file: path.join('unknown', file), id: `unknown_${m[1]}`, fit: true } : null;
    })
    .filter(Boolean);
}

(async () => {
  const data = JSON.parse(fs.readFileSync(SIGNS_JSON, 'utf8'));
  let n = 0;
  const jobs = [...Object.entries(MAP).map(([file, id]) => ({ file, id })), ...unknownJobs()];
  for (const { file, id, fit } of jobs) {
    const sign = data.signs.find((s) => s.id === id);
    if (!sign) { console.warn('! no sign with id', id); continue; }
    const svg = await trace(path.join(IMG_DIR, file));
    const raw = (svg.match(/ d="([^"]+)"/) || [])[1] || '';
    if (!raw) { console.warn('! empty trace for', file); continue; }
    let d = center(raw);
    if (fit) {
      d = recenterAndFit(d, sign.sourceRotation || 0);
    } else {
      const { cx, cy } = bboxCenter(d);
      d = translate(d, cx, cy);
    }
    sign.svgPath = d;
    sign.render = 'fill';
    n++;
  }
  fs.writeFileSync(SIGNS_JSON, JSON.stringify(data, null, 2) + '\n');
  console.log(`vectorized ${n} signs in data/signs.json`);
})();
