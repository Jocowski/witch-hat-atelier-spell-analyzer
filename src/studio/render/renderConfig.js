// renderConfig.js — Static default config for the SpellEffectRenderer.
// Injected into EffectCanvas.jsx which can merge overrides from rules.json.
// PURE — no JSON imports. Re-exported so tests can inject it.

export const DEFAULT_RENDERER_CONFIG = {
  renderer: {
    particleBaseCount: 60,
    particleCap: 400,
    preparedActiveGating: false,
    stabilityFailThreshold: 0.25,
    qualityFailThreshold: 0.20,
    // Draw style: 'glow' (additive particles) | 'toon' (cel-shaded ink silhouette).
    // Currently only the water effect honours 'toon' (PoC); other elements fall back to glow.
    style: 'glow',
  },
}

export default DEFAULT_RENDERER_CONFIG
