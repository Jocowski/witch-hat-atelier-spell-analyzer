/**
 * Vectorize the reference sigil artwork into SVG paths and write them into
 * data/sigils.json.
 *
 *   node tools/vectorize-sigils.cjs
 *
 * Each PNG in assets/images/sigils/ is auto-traced with potrace (outline
 * tracing of the dark line-art). potrace emits absolute M/L/C in the image's
 * 0..100 pixel space; we translate every coordinate by -50 so the path is
 * centered on the origin, matching the engine's "-50 -50 100 100" viewBox.
 *
 * Traced sigils get `render: "fill"` (the path is a filled outline of the
 * strokes, drawn with fill-rule:evenodd) — see GlyphCanvas/Palette. Sigils
 * without a reference image keep their hand-authored stroke `svgPath`.
 *
 * Re-run this whenever the source PNGs change.
 */
const fs = require('fs');
const path = require('path');
const potrace = require('potrace');

// reference image filename -> sigil id in sigils.json
const MAP = {
  'Fire.png': 'fire', 'Unburning_Flame.png': 'unburning_flame', 'Light.png': 'light',
  'Water.png': 'water', 'Earth.png': 'earth',
  'Wind.png': 'wind', 'Aeriforms.png': 'aeriforms', 'Wind_Underfoot.png': 'wind_underfoot', 'Whorling_Winds.png': 'whorling_wind',
  'Repetition.png': 'repetition_sigil', 'Time_Stop.jpg': 'stop',
  'Bird_A.png': 'bird_a', 'Bird_B.png': 'bird_b', 'Dragon.png': 'dragon', 'Flower.png': 'flower', 'Flower_Water.png': 'flower_water',
  'Horse.png': 'horse', 'Owlcat.png': 'owlcat', 'Owlcat_Head.png': 'owlcat_head', 'Scalewolf.png': 'scalewolf',
  'Torchstag.png': 'torchstag', 'Liongoat.png': 'liongoat', 'Valance_Leech.png': 'valance_leech',
  'Crystal.png': 'crystal', 'Smoke.png': 'smoke',
  'Sand_Bridge.png': 'sand_bridge',
  'Warding_Pillar.png': 'warding_pillar',
};

const TRACE_OPTS = { threshold: 170, turdSize: 2, optTolerance: 0.2, turnPolicy: 'minority' };

const ROOT = path.resolve(__dirname, '..');
const IMG_DIR = path.join(ROOT, 'assets', 'images', 'sigils');
const SIGILS_JSON = path.join(ROOT, 'data', 'sigils.json');

// Sigils whose source art is NOT centered in its 100x100 image: re-center them
// on their actual bounding box instead of the image center.
const BBOX_CENTER = new Set(['repetition_sigil', 'bird_a']);

// Sigils whose source PNG is NOT 100x100 (arbitrary crop): recenter on the bbox
// and scale to fit the viewBox, like the unknown-sign vectorizer (no -50 center).
const FIT = new Set(['flower_water', 'sand_bridge', 'warding_pillar']);
const FIT_HALF = 42;

function trace(file) {
  return new Promise((res, rej) => potrace.trace(file, TRACE_OPTS, (e, svg) => (e ? rej(e) : res(svg))));
}

// Translate every absolute coordinate by (dx,dy). potrace emits only M/L/C/Z
// (all absolute); numbers alternate x,y inside each command.
function translate(d, dx, dy) {
  const toks = d.match(/[A-Za-z]|-?\d*\.?\d+/g) || [];
  const out = [];
  let cmd = '', idx = 0;
  for (const t of toks) {
    if (/[A-Za-z]/.test(t)) { cmd = t; idx = 0; out.push(t); continue; }
    if (/[MLCSQT]/.test(cmd)) { out.push((parseFloat(t) - (idx % 2 === 0 ? dx : dy)).toFixed(2)); idx++; }
    else out.push(t);
  }
  return out.join(' ').replace(/([A-Za-z]) /g, '$1');
}

// Center on the image center (the art usually sits centered in its 100x100 box).
const center = (d) => translate(d, 50, 50);

// Uniformly scale a path's coordinates (to fit odd-sized crops into the viewBox).
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
    else if (C === 'Z') { /* no coords */ }
    else num();
  }
  return m;
}

// For arbitrary-sized crops: recenter on the bbox, then shrink to fit the viewBox.
function recenterAndFit(d) {
  const { cx, cy } = bboxCenter(d);
  let out = translate(d, cx, cy);
  const half = maxHalfExtent(out);
  if (half > FIT_HALF) out = scale(out, FIT_HALF / half);
  return out;
}

// Bounding-box center of a path (flattening cubic segments).
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
    else if (C === 'Z') { /* no coords */ }
    else num();
  }
  return { cx: (a + c) / 2, cy: (b + e) / 2 };
}

(async () => {
  const data = JSON.parse(fs.readFileSync(SIGILS_JSON, 'utf8'));
  let n = 0;
  for (const [file, id] of Object.entries(MAP)) {
    const sigil = data.sigils.find((s) => s.id === id);
    if (!sigil) { console.warn('! no sigil with id', id); continue; }
    const svg = await trace(path.join(IMG_DIR, file));
    const raw = (svg.match(/ d="([^"]+)"/) || [])[1] || '';
    if (!raw) { console.warn('! empty trace for', file); continue; }
    let d = FIT.has(id) ? recenterAndFit(raw) : center(raw);
    if (BBOX_CENTER.has(id)) { const { cx, cy } = bboxCenter(d); d = translate(d, cx, cy); }
    sigil.svgPath = d;
    sigil.render = 'fill';
    if (id === 'earth') delete sigil.satellites; // dots are part of the traced path
    n++;
    console.log('traced', file, '->', id, `(${sigil.svgPath.length} chars)`);
  }
  fs.writeFileSync(SIGILS_JSON, JSON.stringify(data, null, 2) + '\n');
  console.log(`\nupdated ${n} sigils in data/sigils.json`);
})();
