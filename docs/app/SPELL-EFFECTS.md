# Spell Effects — rendering guide

How the **Spell Trial** cast animation works, and how to add a new **element** or a new **draw style**.
This is the visual layer only (the canvas particle/ink effects). The magic *reasoning* lives in the
engine (`src/engine/`); this doc is about turning an analyzed spell into pixels.

All effect code is pure-ish Canvas 2D (no WebGL, no deps). The "3D" is a fake: a tilted **portal
plane** + screen-space particles (see [§4](#4-coordinate-system--the-25d-portal-plane)).

---

## 1. Pipeline at a glance

```
Analyze (engine)                 StudioPage.castFrom                EffectCanvas (rAF loop)
─────────────────                ──────────────────                ──────────────────────
analyze(composition)  ──result─▶ buildSpellIRShim(result, …, {     each frame:
                                   direction: einlairDirection(comp),  renderer.render(spellIR, ring,
                                   duration, power })                              timestamp, opts)
                                 = spellIR  ───────────────────────────▶ SpellEffectRenderer
                                                                          ├─ state machine
                                                                          └─ EFFECTS[spellIR.element]
                                                                             (ctx, state, spellIR,
                                                                              ring, dt, config)
```

- **`spellIR`** is the contract between StudioPage and the renderer — a flat object of numeric params
  (see [§3](#3-the-spellir-contract)). It is NOT the engine's analysis; it's a *render shim*
  (`spellIRShim.js`) built from it.
- **`element`** (`spellIR.element`) selects which effect module runs, via the `EFFECTS` map.
- The renderer owns **particle state** across frames and resets it when the spell changes.

---

## 2. File map (`src/studio/render/`)

| File | Role |
|---|---|
| `EffectCanvas.jsx` | React host. Owns the `<canvas>`, the `requestAnimationFrame` loop, sizing, and the per-cast restart. Reads props via refs so the loop never re-subscribes. |
| `SpellEffectRenderer.js` | Per-frame orchestrator: delta-time, signature-based particle reset, the idle/prepared/active/failed **state machine**, and dispatch to the element effect. |
| `effects/{fire,water,wind,earth,light}Effect.js` | One module per element. Each exports `draw<Element>Effect(ctx, state, spellIR, ring, dt, config)`. |
| `effectUtils.js` | Shared pure helpers: the **portal plane**, particle spawn/lifecycle, SpellIR accessors, the direction→screen mapping. |
| `toonLiquid.js` | The cel-shaded "anime ink" renderer (metaball → flat fill → black outline → highlights). A *draw style*, reused by effects. |
| `spellIRShim.js` | Builds `spellIR` from the engine result (+ caller overrides: direction, duration, power). |
| `renderConfig.js` | Default `config.renderer` (particle caps, thresholds, `style`). |
| `../SpellTrial.jsx` | The trial UI: backdrop, glow overlay, timer, Re-run/Loop/Toon/3D toggles, and the stage-relative `ringGeom`. |

---

## 3. The SpellIR contract

`spellIR` is what every effect reads. Built in `spellIRShim.js`; all numbers are **0..1 unless noted**.

| Field | Meaning / range | Set by |
|---|---|---|
| `element` | which effect runs: `fire \| water \| wind \| earth \| air \| light` | primary sigil **family** (`result.sigils[0].family`) |
| `valid` | spell validity (drives failed flicker) | engine |
| `active` / `prepared` | ring closed vs open (gating) | `ringClosed` |
| `activatedAt` | run-start timestamp (`performance.now()`); drives the emission/end fade | EffectCanvas re-stamps on each new spell |
| `force` | how hard it pushes (speed, particle count) — up to ~2.2 when boosted | engine; **Blood dye ×3** |
| `spread` | fan width | engine; Blood widens |
| `focus` | narrows the source | engine |
| `range` | how far it travels | engine; Blood farther |
| `duration` | run length in **seconds** | trial default 5s; **Azuremoon dye ×2** |
| `stability` | low → jitter/flicker | engine |
| `gravity` | 1 = falls, 0 = floats (suspended) | engine |
| `direction` | `{x, y, z}` — where it goes (see [§8](#8-direction-einlair--screen)) | `einlairDirection(comp)` |
| `effectScale` | overall size multiplier (droplet/blob size) | 1; **Blood = 2.6** |
| `emission` | 0..1 fade factor injected each frame (`renderSpellIR.emission`) | renderer (`spellEmission`) |
| `signature` | stable string; changes → particle flush | composition |
| `quality`, `dirCoherence`, `sustain` | partial-failure threshold / coherence / keep-emitting | engine / opts |
| `contained` | `true` when an orb-type container form is present; absent/`false` otherwise | engine |
| `containRadius` | 0..1 — normalized sphere radius (grows with orb count and size) | engine |
| `fillRate` | 0..1 — fraction of the seal's upward einlair flow `U` that fills the vessel (higher with balanced/opposed columns) | engine |
| `capacity` | > 0 — total vessel capacity (Σ orb sign magnitudes); scales sphere size and fill limit | engine |

Read these via the `effectUtils` accessors (`effectScale`, `effectOpacity`, `effectGravity`,
`effectFocus`, `effectSuspension`) rather than touching the fields directly — they clamp/default.

---

## 4. Coordinate system & the 2.5D portal plane

The canvas is plain screen space (x→right, y→**down**). The seal lies on a **floor plane** tilted away
from the camera. Effects emit from an ellipse on that plane — the **portal**:

```js
const portal = activePortalPlane(ctx.canvas, ring)
// → { center:{x,y}, radiusX, radiusY, scaleY }
```

- `center` = seal centre on screen (x from `ring.center.x`, y = `canvas.height * PORTAL_ANCHOR_FRAC`).
- `radiusX` = `ring.radius`; `radiusY` = `radiusX * PORTAL_SCALE_Y` (foreshortened).
- `PORTAL_TILT_DEG = 60`, `PORTAL_ANCHOR_FRAC = 0.62`, `PORTAL_SCALE_Y = cos(60°) = 0.5`.

**These constants are shared with the CSS backdrop tilt** in `studio.css`
(`.spell-trial-bg { transform: rotateX(60deg) … transform-origin 50% 62% }`). If you change the tilt,
change both so the particles keep rising out of where the seal visually sits.

Helpers for emitting on the plane: `randomPortalPoint(portal, …)` (a random point in the ellipse),
`portalOutDirection(spellIR)` (the screen direction the spell travels — see [§8](#8-direction-einlair--screen)).

---

## 5. The render loop & state machine

`SpellEffectRenderer.render(spellIR, ring, timestamp, opts)` each frame:

1. `clearRect`. Bail if `!ring.found || !spellIR`.
2. **delta-time** `dt` (≈ frames at 60fps, clamped 0.4..2.5) so motion is frame-rate independent.
3. **signature reset**: if `spellIR.signature` changed → `resetParticleState(this.state)` (flush).
4. **state** = `resolveRendererState(spellIR, gating)` → `idle | prepared | active | failed`.
   With gating off (default), a valid spell is always `active`.
5. `failed` → red flicker, return. `prepared`/`idle` → glow/nothing, return.
6. `active`: compute `emission` (`spellEmission`: 1 during `duration`, fades over ~0.42s after, or 1 if
   `sustain`). Dispatch `EFFECTS[element](ctx, state, {…spellIR, emission}, ring, dt, config)` under
   `globalCompositeOperation = 'lighter'` (additive glow).

`this.state` is a plain object the renderer owns (`{ particles: [], <element>Frame: n, … }`). It persists
across frames and is reset on signature change.

---

## 6. Anatomy of an element effect

Every effect module follows the same **spawn → update → project → draw → prune** loop. Skeleton:

```js
// effects/myElementEffect.js  — PURE, no JSON imports
import {
  activePortalPlane, portalOutDirection, perpendicularVector, randomPortalPoint,
  effectScale, effectOpacity, particleAlpha, scaledParticleCount, pruneParticles, randomBetween,
} from '../effectUtils.js'

export function drawMyElementEffect(ctx, state, spellIR, ring, dt, config) {
  const portal = activePortalPlane(ctx.canvas, ring)
  state.myFrame = (state.myFrame ?? 0) + dt
  const dir = portalOutDirection(spellIR)          // where it travels (screen units)
  const side = perpendicularVector(dir)
  const scale = effectScale(spellIR)
  const opacity = effectOpacity(spellIR)            // = emission fade

  // 1) keep the pool topped up to a param-scaled, capped count
  const baseCount = config.renderer.particleBaseCount + spellIR.force * 90
  const target = scaledParticleCount(baseCount * (0.7 + scale * 0.3), spellIR, config)
  while (state.particles.length < target) {
    const src = randomPortalPoint(portal, 0.5)
    const speed = randomBetween(1.5, 3.5) * (0.5 + spellIR.force)
    state.particles.push({
      x: src.x, y: src.y,
      vx: dir.x * speed + side.x * randomBetween(-1, 1) * (1 - spellIR.stability),
      vy: dir.y * speed + side.y * randomBetween(-1, 1) * (1 - spellIR.stability),
      radius: randomBetween(4, 10) * scale,
      age: 0, life: randomBetween(40, 80),
    })
  }

  // 2) integrate + 3) draw
  for (const p of state.particles) {
    p.age += dt
    p.x += p.vx * dt; p.y += p.vy * dt
    const a = particleAlpha(p) * opacity            // fade by age, scaled by emission
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius)
    g.addColorStop(0, `rgba(180, 90, 255, ${a})`)
    g.addColorStop(1, 'rgba(120, 40, 200, 0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill()
  }

  // 4) drop dead particles (age >= life)
  pruneParticles(state)
}
```

Conventions worth copying from `fireEffect`/`waterEffect`:
- Put per-frame derived numbers in a `…FlowConfig(spellIR, ring, portal, frame)` object once, not
  per-particle.
- Use `spellIR.force/spread/focus/stability/range` to modulate count, speed, jitter, spread.
- A `suspended` mode (when `effectSuspension(spellIR) >= 0.55`, i.e. low gravity): particles hover/orbit
  a home point instead of streaming. See `fireEffect` for the pattern.
- `state.<element>Frame` is your local clock; increment by `dt`.

---

## 7. Two draw styles: glow vs toon

The simulation (particle positions) is independent of how you *paint* them. Effects branch on
`config.renderer.style`:

- **`glow`** (default) — additive radial gradients (the skeleton above). Soft, energy-like.
- **`toon`** — cel-shaded ink via `drawToonLiquid` (metaball silhouette → flat fill → black outline →
  highlights). This is the Witch-Hat look.

`waterEffect` shows the branch — collect the projected particles as **blobs** and hand them to the toon
renderer:

```js
if (config.renderer?.style === 'toon') {
  const blobs = visibleParticles.map(({ particle, projected }) => ({
    x: projected.x, y: projected.y, r: particle.radius, hl: /* sparse highlight flag */ true,
  }))
  drawToonLiquid(ctx, blobs, {
    cell: 9, threshold: 0.95, innerThreshold: 2.6, influence: 2.4,
    baseColor: '#2f8fd6', innerColor: '#7cc4f2', outlineColor: '#0a2238',
    outlineWidth: 3, highlightColor: 'rgba(236,248,255,0.95)',
  })
  pruneParticles(state); return
}
// …else the glow draw…
```

`drawToonLiquid(ctx, blobs, opts)` builds a metaball field (`f = Σ rᵢ²/d²`), traces it with filled
marching squares, and paints fill + a higher-threshold inner tone + the iso-contour as a black stroke +
sparse white highlights. Tuning knobs are in `opts` (cell size, thresholds, colours, outline width).
For fire you'd use spikier thresholds + warm colours; for earth, angular/chunky; etc.

---

## 8. Direction (einlair) → screen

`spellIR.direction = {x, y, z}` is built by `StudioPage.einlairDirection(comp)` from the einlair flow
model (`computeColumnFlow`, see `docs/theories/einlair-vector-analisys/`):

- `x` = east component, `y` = **south-positive** in-plane component, `z` = upward (out-of-plane) share.
- For a single column facing east → `(1, 0, 0)`; balanced columns ("T") → `(0, 0, 1)` (straight up).

`portalOutDirection(spellIR)` converts that to the screen vector your particles travel along:

```
screen = normalize( x,  y * PORTAL_SCALE_Y − z )   // y-down screen
```

So `z` (up) becomes screen-up, in-plane `y` is foreshortened by the tilt, `x` is straight across. Drive
your particles' velocity with `portalOutDirection(spellIR)` and they'll respect both the einlair steer
and the 2.5D plane automatically. (Water also splits speed into `horizontalShare`/`verticalShare` from
the direction so a horizontal jet stays low and a "T" shoots up — copy that if your element should too.)

---

## 9. Dyes

Dye effects are applied **before** the renderer, in `StudioPage.castFrom`, by inspecting
`compositionDyes(comp)`:

| Dye id | Effect | How |
|---|---|---|
| `azuremoon_flower` | longer cast | `duration ×2` |
| `blood` | bigger/faster/farther/more | `power` → `force ×3`, `effectScale 2.6`, `spread`/`range` up |
| `blushing_bride_scales` | hide those strokes in the render | backdrop captured with `hideDyeIds` |
| `golden_blaze_wyrm_scales` | those strokes glow | separate `soloDyeIds` capture → pulsing overlay |

The first two are **render params** (reach effects via `spellIR`); the last two are **backdrop image**
tricks in `SpellTrial`/`DrawingSurface.toDataURL`, independent of the particle code. Dyes are derived
from the *current* drawing content (`buildModel`), so erasing a dyed stroke drops its effect.

---

## 10. How to add a NEW element  ✅ checklist

1. **Create the effect module** `src/studio/render/effects/<name>Effect.js` exporting
   `draw<Name>Effect(ctx, state, spellIR, ring, dt, config)` (use the [§6](#6-anatomy-of-an-element-effect)
   skeleton). Pure module — no JSON imports.
2. **Register it** in `SpellEffectRenderer.js`:
   ```js
   import { drawIceEffect } from './effects/iceEffect.js'
   const EFFECTS = { … , ice: drawIceEffect }   // + any alias, e.g. frost: drawIceEffect
   ```
3. **Make the element resolve to your key.** `spellIR.element` = the primary sigil's `family`
   (`spellIRShim.js`). So the sigil(s) for your element must have `family: "ice"` in `sigils.json`
   (or `data` DB overlay). If the family name differs from your effect key, add an alias in `EFFECTS`.
4. **(Optional) toon support** — branch on `config.renderer.style === 'toon'` and call `drawToonLiquid`
   with element-appropriate colours/thresholds.
5. **Tune** with `spellIR` params; verify with `npm run dev` → draw an `<element>` sigil + a sign,
   Analyze, watch the Spell Trial. There are no unit tests for effects (browser-only); the engine tests
   still cover the analysis that feeds them.

That's it — no engine changes are needed for the *visual* (the engine already classifies the element).
If the element is genuinely new to the magic system, that's a separate, larger change in `data/` + the
engine; this doc is only the render side.

## 11. How to add a new draw STYLE (like toon)

1. Add a `style` value to `config.renderer.style` (default lives in `renderConfig.js`); surface a toggle
   in `SpellTrial.jsx` (mirror the Toon/Glow button) that passes it through `rulesRenderer`.
2. In each effect's **draw** stage, branch on `config.renderer.style` and paint the same particles
   differently (the simulation stays shared). Factor reusable painters like `toonLiquid.js`.

---

## 12. Performance & gotchas

- **Bounded by design.** Particle count is capped (`config.renderer.particleCap`, default 400) and dead
  particles are pruned every frame, so the pool is steady-state — it can't grow unbounded. Keep your
  `target` count reasonable and always call `pruneParticles(state)`.
- **Don't allocate per particle per frame** beyond what you must (gradients are the main cost). For big
  counts prefer the toon metaball pass (one field, one fill) over thousands of gradients.
- **Memoize EffectCanvas props.** `EffectCanvas` rebuilds its renderer (flushing particles) when its
  `rulesRenderer`/`ringGeom` prop *identity* changes. `SpellTrial`/`StudioPage` `useMemo` these so the
  per-frame timer re-render doesn't restart the animation. If you add props, keep them stable.
- **Run restart** is driven by `activatedAt`, which `EffectCanvas` re-stamps on every new `spellIR`
  object. A new cast = a new shim object = a fresh run. Don't reuse a shim across casts.
- **Single-run vs loop.** A cast emits for `duration` then fades (`spellEmission`). `SpellTrial`'s Loop
  toggle re-mounts via `runKey` after `duration + buffer`. Set `spellIR.sustain` to keep emitting forever
  (currently unused).

---

## 13. Tuning knobs cheat-sheet

| Want… | Change |
|---|---|
| more/less particles globally | `renderConfig.js` `particleBaseCount` / `particleCap` |
| where the seal sits / how flat | `effectUtils` `PORTAL_ANCHOR_FRAC` / `PORTAL_TILT_DEG` (+ `studio.css` tilt) |
| default cast length | `StudioPage` `TRIAL_BASE_SECONDS` |
| Blood strength | `StudioPage` `BLOOD_POWER` + the `power` mapping in `spellIRShim.js` |
| an element's look | its `effects/<name>Effect.js` (colours, speeds, counts) + `toonLiquid` opts |
| failure thresholds | `renderConfig.js` `stabilityFailThreshold` / `qualityFailThreshold` |

See also: [`docs/theories/einlair-vector-analisys/analysis.md`](../theories/einlair-vector-analisys/analysis.md)
(the direction model) and `docs/app/APP-PLAN.md` (overall architecture).
