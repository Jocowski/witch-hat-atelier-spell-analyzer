# SPEC — Visual Effect Renderer

> Status: **proposed** · Scope: **animated spell cast + prepared/active states + failure visuals** · Branch: `feat/spell-studio`
> Cross-refs: [SPEC-spell-ir.md](SPEC-spell-ir.md) (SpellIR contract — **prerequisite**), [APP-PLAN.md](APP-PLAN.md)
> (§2 Studio, react-konva canvas), [SPEC-recognizer-analysis.md](SPEC-recognizer-analysis.md) (recognizer
> confidence/stability inputs), [IMPROVEMENTS.md](IMPROVEMENTS.md). Sibling reference:
> `wha-spell-simulator/src/renderer/` (proven particle loop + per-element effects to port).

This spec covers three items from the visual-renderer work stream:

- **1.1** Animated effect renderer — particle systems driven by SpellIR params, one module per element.
- **1.3** Prepared → Active state machine + activation event — with an **off-by-default config toggle**.
- **1.4** Spell failure from messy drawing — unstable/failed cast with distinct visual feedback.

It does **not** cover the SpellIR compiler itself (see SPEC-spell-ir.md), the recognizer pipeline, or the
existing engine deduction (they are upstream inputs consumed here).

---

## 0. Prerequisites

The renderer consumes a **SpellIR** object whose shape is defined in SPEC-spell-ir.md. Key fields used here:

| SpellIR field     | What the renderer uses it for                                          |
|-------------------|------------------------------------------------------------------------|
| `valid`           | Gate any visual output; invalid → failure flicker only                 |
| `active`          | Cast the full effect (ring closed); see §1.3                           |
| `prepared`        | Prepared-glow ring; see §1.3                                           |
| `activatedAt`     | `performance.now()` timestamp when the spell went active               |
| `element`         | Route to the matching element module (fire/water/wind/earth/light)     |
| `effectScale`     | Overall particle size, count, portal area                              |
| `force`           | Speed, pressure, particle size                                         |
| `spread`          | Source area width, lateral noise                                       |
| `focus`           | Narrows source and jitter                                              |
| `range`           | How far particles travel                                               |
| `duration`        | Active spell lifetime in seconds                                       |
| `gravity`         | 0 = suspension / floating; 1 = normal element motion                  |
| `direction`       | `{ x, y, z, xTiltDeg, yTiltDeg, tiltFromZDeg }` — paper-local 3D dir |
| `stability`       | Resistance to flicker/wobble; low stability → unstable cast visuals    |
| `quality`         | Overall glyph quality; used for failure-mode threshold                 |
| `manifestations`  | Active behavior profiles (column, convergence, levitation…)            |
| `signature`       | Stable string; renderer resets particle state on change                |

The SPEC-spell-ir.md companion spec defines how the engine populates these fields. **This renderer spec
does not re-derive physics — it only maps them to particles.**

Until SPEC-spell-ir.md is implemented, the renderer can accept a minimal shim object built from the
existing `analyze()` result (see §5.1 Phasing, Phase R1).

---

## 1. Canvas technology decision

**Recommendation: a plain 2D `<canvas>` element overlaid on the Konva stage, driven by
`requestAnimationFrame`.**

Rationale:

- The sibling project (`wha-spell-simulator`) proves this architecture: a `SpellEffectRenderer` class
  owns a `<canvas>`, calls `requestAnimationFrame`, clears and redraws every frame, and uses
  `globalCompositeOperation = 'lighter'` for additive blending — a capability that Konva's layer system
  does not expose cleanly.
- Particle effects need `ctx.createRadialGradient`, `ctx.setLineDash`, and compositing modes that are
  trivial on a raw 2D context and awkward inside Konva's retained-mode scene graph.
- A plain canvas is zoom/pan-independent: it covers the full stage wrapper at a fixed pixel size and
  manages its own coordinate origin (canvas centre). The Konva stage and the effect canvas share the same
  wrapper div via absolute positioning; no Konva integration code is needed.
- Adding a new Konva layer would force every particle through Konva's scene graph, sacrificing the
  fine-grained `ctx.save/restore` control the effects need.

**Placement:** the effect canvas is a `<canvas>` absolutely positioned inside `.ds-stage-wrap`
(the existing wrapper in `DrawingSurface.jsx`), stacked above the Konva `<Stage>` via `z-index`,
with `pointer-events: none` so it never intercepts input.

---

## 2. Component / file layout

```
src/studio/
  render/
    EffectCanvas.jsx          — React component: mounts the overlay <canvas>, owns the rAF loop,
                                 instantiates SpellEffectRenderer, re-triggers on SpellIR change.
    SpellEffectRenderer.js    — Class: render(spellIR, ring, timestamp) → clears + draws one frame.
                                 Manages particle state, delta-time, signature-based reset,
                                 prepared-glow / failure-flicker / active-effect dispatch.
    renderConfig.js           — Static config object (particleBaseCount, particleCap, quality presets).
                                 Re-exported so tests can inject it.
    effectUtils.js            — Pure helpers shared across element modules: activePortalPlane(),
                                 portalOutDirection(), effectScale/focus/gravity/opacity/suspension(),
                                 convergenceFlow(), convergePoint(), scaledParticleCount(),
                                 pruneParticles(), spellLifetimeFrames(), resetParticleState(),
                                 randomBetween(), perpendicularVector(), clamp(). No JSON imports.
    effects/
      fireEffect.js           — drawFireEffect(ctx, state, spellIR, ring, dt, config)
      waterEffect.js          — drawWaterEffect(...)
      windEffect.js           — drawWindEffect(...)
      earthEffect.js          — drawEarthEffect(...)
      lightEffect.js          — drawLightEffect(...)
      (add <element>Effect.js for each new element — no changes elsewhere)
```

`SpellEffectRenderer.js` and all `effects/*.js` are **pure modules** — they import no JSON and accept
all data-driven config as injected arguments, consistent with the project's `geometry.js`/`deduce.js`
purity rule. `renderConfig.js` holds the default config object; `EffectCanvas.jsx` reads
`rules.json` for renderer overrides (e.g. particle cap) and passes them into the renderer.

---

## 3. The render loop

### 3.1 `EffectCanvas.jsx` — lifecycle and wiring

```
Props:
  spellIR   : SpellIR | null     — updated after each Analyze; null = no spell loaded
  ringGeom  : { center:{x,y}, radius:number, found:boolean } | null
              — detected ring geometry in canvas px (centre-origin); from the recognizer result
  enabled   : boolean            — master switch (false = canvas is hidden, rAF stopped)
```

On mount: create the `<canvas>`, size it to match the stage wrapper via `ResizeObserver`, instantiate
`SpellEffectRenderer`. Start `requestAnimationFrame`.

On `spellIR` change: pass the new value to the renderer on the next frame (the renderer handles
signature-based particle reset internally).

On unmount / `enabled = false`: cancel rAF, clear canvas.

The rAF callback:
```js
function tick(timestamp) {
  renderer.render(spellIR, ringGeom, timestamp, { showGuides })
  rafId = requestAnimationFrame(tick)
}
```

### 3.2 `SpellEffectRenderer.js` — per-frame logic (ported from sibling)

Mirrors `wha-spell-simulator/src/renderer/spellEffectRenderer.js` with these adaptations:

1. **Signature reset:** if `spellIR.signature !== lastSignature`, call `resetParticleState(state)`.
   This ensures particle pools flush whenever the spell composition changes.
2. **Delta-time normalisation:** `dt = clamp((timestamp - lastTime) / 16.67, 0.4, 2.5)` — frames are
   60-FPS-relative units. Guards against tab-hidden long pauses.
3. **Dispatch order** (matches the sibling's `render()` method):
   - If no ring found or no spellIR → clear canvas, return.
   - If `!spellIR.valid` → `drawFailedFlicker(ring, timestamp)` (see §5).
   - Else if `prepared` state active (see §4) → `drawPreparedGlow(ring, timestamp)`.
   - Else (active spell, `spellIR.active`) → `drawEffect(ctx, state, spellIR, ring, dt, config)`.
   - `emission` fade: as the spell nears end-of-life (`elapsed > duration * 1000`),
     `emission = clamp(1 - (elapsed - durationMs) / SPELL_END_FADE_MS)`.
   - Use `globalCompositeOperation = 'lighter'` inside the element draw call for additive blending.

### 3.3 Ring geometry

`ringGeom` is derived from the recognizer's ring detection result (`analyzeStrokes` → `r.ring`) and
the Konva stage dimensions. The conversion: the recognizer returns ring data in world coords
(centre-origin); `EffectCanvas.jsx` converts to canvas pixel coords by adding `(canvasW/2, canvasH/2)`
and multiplying by the current zoom (or passing the known stage center and zoom).

If no ring was detected, `ringGeom.found = false` and the renderer draws nothing.

---

## 4. Per-element effect parameterisation

Each element module receives `(ctx, state, spellIR, ring, dt, config)` and is entirely self-contained.
The table below maps SpellIR fields to the primary visual knobs; the exact formulae live in each module
(ported from the sibling, with the confirmed constants listed in `effect-rendering.md`).

| Element | Primary particle type       | `force` effect           | `spread` effect         | `gravity` effect                        | `stability` effect                  | `focus` effect          | `direction` effect                      |
|---------|-----------------------------|--------------------------|-------------------------|-----------------------------------------|-------------------------------------|-------------------------|-----------------------------------------|
| fire    | Radial gradient discs       | Speed + particle radius  | Source area width       | 0 = suspended flame cloud; 1 = stream   | Low = flicker + wander              | Narrows source + jitter | Portal out-direction for stream         |
| water   | 3D-projected mass + droplets| Pressure + stream length | Source width            | 0 = suspended blob; 1 = free stream     | Low = turbulence                    | Narrows stream          | Forward/lateral split via local coords  |
| wind    | Curved line particles       | Speed                    | Lateral noise           | Minimal (wind mostly ignores gravity)   | Low = high curl                     | Narrows source          | Main travel direction                   |
| earth   | Square particles (slower)   | Speed + mass             | Source area             | Low = gentle float; 1 = heavy stream    | Low = drift + separation            | Narrows source          | Direction of travel                     |
| light   | Trail-steered beam particles| Deterministic lane speed | Lane separation         | Minimal                                 | Low = shorter trails, higher spread | Narrow lane cohesion    | Beam axis                               |

All elements share the `effectUtils.js` helpers for portal plane projection, convergence flow,
particle count scaling, and opacity. To add a new element (e.g. `time` or `void`): create
`effects/<element>Effect.js`, export `draw<Element>Effect`, register it in `SpellEffectRenderer.js`'s
`EFFECTS` map.

---

## 5. Failure-mode visuals (Item 1.4)

### 5.1 Trigger conditions

A cast is considered **unstable or failed** when any of the following hold:

- `spellIR.valid === false` — invalid composition (blocking engine issue).
- `spellIR.stability < STABILITY_FAIL_THRESHOLD` (default `0.25`, tunable in `renderConfig.js`).
- `spellIR.quality < QUALITY_FAIL_THRESHOLD` (default `0.20`, tunable in `renderConfig.js`).
- Recognizer-side: low overall detection confidence (conveyed via `spellIR.quality` after the
  SpellIR compiler maps recognizer confidence → quality; or, pre-SpellIR-compiler, via the
  `result.issues` list filtered for confidence-gate warnings).

Partial failure (low stability / low quality but still `valid`) produces a **degraded** cast — the
correct element effect fires but with failure overlays. Full failure (`valid === false`) skips the
element effect entirely.

### 5.2 Failure visual: ring flicker

Ported from the sibling's `drawFailedFlicker()`:

- A dashed arc at `ring.radius * FAILED_FLICKER_RADIUS_SCALE` (≈ 0.92 × radius).
- Stroke color: `rgba(184, 69, 49, alpha)` — red-orange, matching an unstable sigil glow.
- Alpha pulsed by `Math.max(0, Math.sin(timestamp / FAILED_FLICKER_PERIOD_MS))` at ≈ 70 ms period —
  gives a rapid, nervous flicker distinct from the slow prepared-glow pulse.
- Dashed pattern: `[10px, 14px]` (screen-independent in world units).
- Radius pulses slightly: `radius * (scale + pulse * 0.02)` for a breathing/sputter effect.

### 5.3 Degraded cast overlay (partial failure)

When the spell is `valid` but stability or quality is low, the element effect **still fires** but the
renderer adds:

- The failure-flicker ring at reduced alpha (`× 0.5`) superimposed on the particle effect.
- `stability` drives particle-level instability already (more wander, less damping per element module);
  no extra renderer code is needed for that — it comes from the per-element parameterisation.

### 5.4 UI callout (outside the renderer)

The renderer is **visual-only**. The existing engine `result.issues[]` and `ResultPanel.jsx` already
surface validity/blocking warnings in text. No new text copy is added by the renderer; the visual flicker
is purely an atmospheric cue.

---

## 6. Prepared → Active state machine + activation event (Item 1.3)

> **This entire feature is behind a config toggle, OFF by default.** See §6.4.

### 6.1 States

```
               ┌──────────┐
  (no spell)   │  IDLE    │  canvas clear, rAF running, no effect
               └────┬─────┘
                    │ Analyze completes, SpellIR produced
                    ▼
               ┌──────────┐
               │ DECODED  │  SpellIR available; renderer inspects valid + ring state
               └────┬─────┘
         ┌──────────┴──────────┐
  ring   │                     │ ring
  open   ▼                     ▼ closed
   ┌──────────┐           ┌──────────┐
   │ PREPARED │           │  ACTIVE  │  element effect fires
   └────┬─────┘           └────┬─────┘
        │ ring closes           │ spell lifetime expires
        │ (activation event)    │ (duration + fade)
        └──────────────────────►┌──────────┐
                                │  FADED   │  particles exhaust, canvas clears
                                └──────────┘
```

At any state: `valid === false` → **FAILED** (failure flicker, return to IDLE on Clear).

### 6.2 Ring open/closed detection

The Studio detects `ringClosed` during `handleDetect` via `analyzeStrokes` → `r.ring` (boolean).
This value is already present in `detection.ringClosed` (StudioPage.jsx line 136) and flows into
`composition.ring.closed`.

**Activation event:** the transition `PREPARED → ACTIVE` occurs when a new Detect/Analyze run
produces `ringClosed: true` after a prior run had `ringClosed: false`. `EffectCanvas.jsx` watches the
`spellIR.active` prop; when it flips from `false` → `true`, it stamps `activatedAt = performance.now()`
and resets particle state — mirroring how the sibling sets `activatedAt` in `SpellIR`.

### 6.3 Prepared glow (ring open)

Ported from the sibling's `drawPreparedGlow()`:

- Filled arc at `ring.radius * PREPARED_GLOW_RADIUS_SCALE` (≈ 0.7 × radius).
- Color: `rgba(88, 171, 174, alpha)` — a muted teal that reads as "held/ready" vs the warm amber
  of the cast effect.
- Alpha = `PREPARED_GLOW_BASE_ALPHA + pulse * PREPARED_GLOW_PULSE_ALPHA` where
  `pulse = 0.5 + sin(timestamp / 520) * 0.5` — slow, calm breath (520 ms period).

Additionally, `drawRingGlow()` draws a faint ambient ring:
- `isPrepared` → `rgba(255, 217, 114, 0.12)`; idle → `rgba(255, 217, 114, 0.06)`.
- Only rendered when `showGuides` is true (i.e., the toggle is ON; see §6.4).

### 6.4 Config toggle — OFF by default

**Why off by default:** ring open/closed as a prepared/active gate assumes a single-ring spell. The
future multi-ring / nested spell architecture (linked spells, contraptions per
`docs/contraptions.md`) will need to redefine what "activation" means per ring. Leaving the toggle off
lets the renderer cast immediately on Analyze without any prepared/active gating, preserving compatibility
with future work.

**Config key:** `rules.json`, section `renderer`:

```json
"renderer": {
  "preparedActiveGating": false,
  "stabilityFailThreshold": 0.25,
  "qualityFailThreshold": 0.20,
  "particleBaseCount": 60,
  "particleCap": 400
}
```

**UI affordance:** a small labeled toggle in the Studio results drawer (or the settings panel if one is
added), labeled **"Ring gating (prepared/active)"**. Reads from `rules.json` as default; overridable
per-session via `localStorage` key `studio.renderer.preparedActiveGating`. The toggle is hidden by
default — only shown when `rules.json.renderer.preparedActiveGating` is `true` OR when the user
opens a developer/debug settings panel. (The intent: it is a feature you turn on deliberately, not
something a casual user should accidentally toggle.)

**Behaviour when toggle is OFF (default):**

- `EffectCanvas.jsx` ignores `spellIR.prepared` and `spellIR.active`.
- The renderer calls `drawEffect` immediately when `spellIR.valid === true`, regardless of ring state.
- `activatedAt` is set to `performance.now()` at the moment Analyze completes.
- No prepared-glow or ring-glow is shown.
- `SpellEffectRenderer.render()` receives `options = { showGuides: false }` (no guide rings / glow).

**Behaviour when toggle is ON:**

- The full PREPARED → ACTIVE state machine (§6.1–6.3) is in effect.
- The ring-glow and prepared-glow are shown.
- `options = { showGuides: true }`.

---

## 7. Integration with StudioPage / DrawingSurface

`EffectCanvas.jsx` is mounted **inside** `DrawingSurface.jsx`'s `ds-stage-wrap` div, after the Konva
`<Stage>`, with absolute positioning:

```jsx
// DrawingSurface.jsx (addition inside the ds-stage-wrap div, after <Stage>)
{effectsEnabled && (
  <EffectCanvas
    spellIR={spellIR}
    ringGeom={ringGeom}
    enabled={effectsEnabled}
  />
)}
```

`StudioPage.jsx` holds the `spellIR` and `ringGeom` state (derived from the engine `result` and the
recognizer's ring detection), and passes them down as props. An additional imperative ref method
`getStageSize()` (or the existing `stageSz` already available inside `DrawingSurface`) is exposed so
`EffectCanvas.jsx` can size itself correctly.

`ringGeom` is produced in `handleDetect`:

```js
const ringGeom = r.ring
  ? { found: true, center: { x: stageSz.width / 2, y: stageSz.height / 2 },
      radius: r.ring.radius * zoom }   // recognizer radius is in world px → scale by zoom
  : { found: false, center: { x: stageSz.width / 2, y: stageSz.height / 2 }, radius: 180 }
```

(The guide ring is already drawn at `RING_RADIUS = 180` world units, so `180 * zoom` is a reasonable
fallback when no ring was detected by the recognizer.)

---

## 8. Phasing and effort

### Phase R1 — Core infrastructure (M)
- `EffectCanvas.jsx`: canvas mount, rAF loop, resize observer, spellIR prop wiring.
- `SpellEffectRenderer.js`: signature reset, dt normalisation, dispatch skeleton.
- `effectUtils.js`: all shared helpers (port from sibling `effectUtils.js`).
- `renderConfig.js`: static default config.
- `effects/fireEffect.js`: first working element (port from sibling — proves the architecture).
- Wire into `DrawingSurface.jsx` + `StudioPage.jsx` (props only; no state machine yet).
- Toggle OFF, immediate cast on Analyze.
- **Deliverable:** fire particle effect appears on Analyze for fire-element spells.

### Phase R2 — Remaining elements (M)
- `effects/waterEffect.js`, `windEffect.js`, `earthEffect.js`, `lightEffect.js` — port from sibling.
- Route all elements through the `EFFECTS` map.
- **Deliverable:** all five elements render correctly.

### Phase R3 — Failure visuals (S)
- `drawFailedFlicker()` in `SpellEffectRenderer.js`.
- Degraded-cast overlay for low-stability/quality valid spells.
- Stability + quality thresholds in `renderConfig.js` / `rules.json`.
- **Deliverable:** invalid spells flicker red; low-quality casts look unstable.

### Phase R4 — Prepared/Active toggle (S, off-by-default)
- `drawPreparedGlow()`, `drawRingGlow()` in `SpellEffectRenderer.js`.
- `options.showGuides` path in the renderer.
- `localStorage` session override + `rules.json` config key.
- UI toggle (hidden unless explicitly enabled in config).
- **Deliverable:** opt-in prepared glow; activation event on ring close.

### Phase R5 — SpellIR compiler integration (M, depends on SPEC-spell-ir.md)
- Replace the shim object with the real SpellIR from SPEC-spell-ir.md.
- All SpellIR fields flow correctly into the renderer.
- `signature` field enables instant particle reset on composition change.
- **Deliverable:** renderer is fully driven by the compiled SpellIR, not a heuristic shim.

---

## 9. Acceptance criteria

### 9.1 Core renderer (R1–R2)
- [ ] Analyzing a fire-element spell shows a particle effect overlaid on the canvas within one frame.
- [ ] Analyzing a water/wind/earth/light spell shows the corresponding effect.
- [ ] The effect canvas never intercepts pointer events (all tools remain usable while the effect plays).
- [ ] Clearing the canvas (`handleClear`) stops the effect and clears the canvas.
- [ ] Re-analyzing with a different composition resets particles (no bleed from the prior spell).
- [ ] The effect canvas resizes correctly when the window or drawer resizes.
- [ ] No effect is shown when `spellIR` is null or `ringGeom.found` is false.

### 9.2 Failure visuals (R3)
- [ ] An invalid composition (`valid: false`) shows a red-dashed flickering ring, no element particles.
- [ ] A low-stability valid spell shows the element effect AND the failure-flicker ring at half alpha.
- [ ] A high-quality, high-stability spell shows no flicker.
- [ ] The flicker thresholds are config values in `rules.json.renderer`; changing them changes behavior
      without code edits.

### 9.3 Prepared/Active toggle (R4)
- [ ] With toggle OFF (default): Analyze immediately casts the effect regardless of ring state.
- [ ] With toggle ON: open ring → prepared glow only; close ring + re-Analyze → full effect fires.
- [ ] The session override via `localStorage` takes precedence over `rules.json` default.
- [ ] The UI toggle is not visible in the default configuration.
- [ ] With toggle ON, the activation event (open → closed) resets particle state and sets `activatedAt`.

### 9.4 SpellIR fidelity (R5)
- [ ] Each SpellIR behavior field (force/spread/focus/range/duration/gravity/direction/stability) visibly
      affects the effect in the expected direction (documented in the element parameterisation table §4).
- [ ] Duration expiration triggers the emission fade and particle exhaust, then the canvas clears.
- [ ] Changing `direction` rotates the effect stream; `gravity: 0` produces a suspension/cloud shape.

---

## 10. Testing notes

Animation is hard to unit-test because correctness is visual. These are the boundaries that ARE testable:

### 10.1 Pure-function tests (`node --test`, no canvas)

**SpellIR → effect-config mapping** (pure, injectable):

Each element module's `*FlowConfig(spellIR, ring, ...)` (e.g. `fireFlowConfig`) is a pure function that
takes a SpellIR and returns a numeric config struct. Test it with injected SpellIR objects:

```js
// test/renderer.test.js
import { fireFlowConfig } from '../src/studio/render/effects/fireEffect.js'
// high-force fire: stream should be fast, not suspended
const flow = fireFlowConfig({ force: 0.9, spread: 0.2, stability: 0.8, gravity: 1.0, ... }, ring, portal, 0)
assert.strictEqual(flow.suspended, false)
assert.ok(flow.suspendedHeight === undefined || flow.direction.speed > 2)
```

**State-machine transitions** (pure logic extracted to a helper):

Extract a pure `resolveRendererState(spellIR, preparedActiveGating)` → `'idle'|'prepared'|'active'|'failed'`.
Test all combinations of `{ valid, active, prepared, preparedActiveGating }`.

**Threshold gating** (pure):

Extract `isFailedCast(spellIR, config)` → boolean. Test with spells at/below/above the stability and
quality thresholds.

**effectUtils helpers** (pure):

`clamp`, `randomBetween` (with a seeded RNG), `portalOutDirection`, `effectScale`, `effectFocus`,
`scaledParticleCount` — all pure, all testable.

### 10.2 What NOT to unit-test

- Pixel-level output of `drawFireEffect` etc. — visual regression tests (screenshot diffs) are the right
  tool for these, but are not required at this stage.
- rAF timing and frame pacing — test manually by watching the effect in the browser.
- Canvas resize — test manually by resizing the window / drawer while an effect is playing.

### 10.3 Manual smoke-test checklist (complement to unit tests)

1. Fire sigil + direction sign: stream points in the correct direction and rotates when the sign is rotated.
2. Fire sigil + levitation sign(s): gravity drops and the effect suspends into a cloud.
3. Water sigil: mass + droplet separation visually distinct from fire.
4. Invalid composition (no sigil, ring open, only signs): red flicker ring, no element particles.
5. Very messy scribble (expected to produce low quality/stability): degraded flicker over the effect.
6. Switch between two different spells rapidly: no particle bleed between casts.
7. Clear button: effect stops immediately.
8. With prepared/active toggle ON: draw ring open → glow appears; draw ring closed + re-Analyze →
   full cast effect fires.

---

## 11. Open items

- **SpellIR shim (R1–R4):** Until SPEC-spell-ir.md is implemented, `EffectCanvas.jsx` builds a
  minimal SpellIR from the existing `analyze()` result: `element` from the deduction's primary sigil
  family, `force/spread/stability/quality` as sensible constants or engine-derived proxies, `duration = 3`,
  `valid` from `result.valid`, `active = result.ring?.closed ?? true`. The shim lives in
  `src/studio/render/spellIRShim.js` and is deleted in R5.
- **Zoom/pan sync:** the effect canvas is fixed-size; it doesn't zoom/pan with the Konva stage.
  Particles always emit from the canvas-pixel position of the guide ring center
  (`canvasW/2, canvasH/2`). If deep zoom or pan are in use, the particles visually detach from the
  drawing. Acceptable for now; a future fix would transform `ringGeom` through the active pan/zoom
  offset and pass the corrected center.
- **Mobile / touch:** the rAF loop runs on mobile but particle count may need a lower cap. Add a
  `reducedMotion` path (check `prefers-reduced-motion`) that skips particle effects and shows only
  the static ring glow.
- **Multiple rings (contraptions):** when multi-ring compositions are supported, each ring may
  independently be prepared or active. The renderer will need a `rings: SpellIR[]` prop and should
  run one effect pass per ring. This is explicitly deferred; the toggle-off default (§6.4) ensures
  the current single-ring path doesn't bake assumptions the multi-ring work must undo.
