# ml/ — Siamese glyph encoder bake (M3, SPEC-ml-recognizer.md)

Dev-only Python toolchain. **Never imported by the app, tests, or CI.**
`npm install` and `npm run build` succeed with no Python present.

## What this does

Trains a small siamese CNN encoder that turns a glyph image into a compact
fingerprint vector (embedding). Two drawings of the same symbol map to nearby
vectors; different symbols map far apart. The encoder is exported to
`src/draw/ml-assets/model.onnx` for in-browser inference (M4).

## Prerequisites

- Python 3.12 (managed by `uv`)
- `uv` (install: `pip install uv` or https://docs.astral.sh/uv)
- Node.js ≥ 18 (for render_dataset.mjs)
- GPU optional but recommended (RTX 2060+ verified); falls back to CPU

The Python env is isolated in `ml/` and uses the CUDA 12.1 wheel index.
To use CPU-only: remove `[tool.uv.sources]` from `pyproject.toml`.

## Workflow (exact commands)

Run from the **repo root**. All `uv run` commands pin the `ml/` project.

### Step 0 — Install Python deps (one time)

```sh
uv sync --project ml
```

### Step 1 — Render dictionary images (Node, runs the JS rasterizer)

This generates PNG training images from `data/training-seed.json` using the
**same JS rasterizer** (`src/draw/glyphRasterizer.js`) that will be used at
inference time (invariant #6 — one rasterizer, no parity test needed).

```sh
# Smoke (3 images/symbol — fast):
node ml/render_dataset.mjs --perN 3 --seed 1

# Full bake (50 images/symbol):
node ml/render_dataset.mjs --perN 50 --seed 1
```

Output: `ml/data/images/<symbol>/0.png ..N.png` + `ml/data/labels.json`

Coverage note: training-seed.json covers 62 of 85 total symbols. The remaining
23 get prototypes from real corrected samples via the M4 flywheel.

### Step 2 — Pre-train on Omniglot (general shape sense)

Downloads Omniglot (~60 MB) automatically on first run.

```sh
# Smoke (30 steps — proves pipeline, model will be undertrained):
uv run --project ml python ml/train.py --steps 30 --out ml/checkpoints/base.pt

# Full bake (recommended — GPU: ~5 min, CPU: ~40 min):
uv run --project ml python ml/train.py \
    --steps 5000 --embedding-dim 64 --batch-size 64 \
    --out ml/checkpoints/base.pt
```

### Step 3 — Fine-tune on our glyph dictionary

```sh
# Smoke (30 steps):
uv run --project ml python ml/finetune.py \
    --steps 30 \
    --in ml/checkpoints/base.pt \
    --out ml/checkpoints/finetuned.pt

# Full bake (recommended):
uv run --project ml python ml/finetune.py \
    --steps 3000 \
    --in ml/checkpoints/base.pt \
    --out ml/checkpoints/finetuned.pt \
    --classes-per-batch 8
```

Prints top-1 accuracy on a held-out synthetic split at the end.
Expected: smoke ≈ random (poor), full bake ≈ 90–99% synthetic.

### Step 4 — Export to ONNX and verify parity

```sh
uv run --project ml python ml/export_onnx.py \
    --in ml/checkpoints/finetuned.pt
```

Output:
- `src/draw/ml-assets/model.onnx` — the model file
- `src/draw/ml-assets/model.meta.json` — metadata (input size, embedding dim, version, parity diff)

The script verifies torch↔onnxruntime output parity (max abs diff < 1e-5) and
**fails loudly** if parity does not hold — never commit a non-parity model.

### Step 5 — Build per-symbol prototypes (offline fallback for M4)

```sh
uv run --project ml python ml/build_prototypes.py
```

Output: `src/draw/ml-assets/prototypes.json`

Also prints a prototype-vs-prototype cosine similarity summary showing how well
separated the symbol classes are.

## Commit policy

- **Commit** `src/draw/ml-assets/model.onnx`, `model.meta.json`, `prototypes.json`.
- **Do NOT commit** `ml/data/` (generated images) or `ml/checkpoints/` (large binary checkpoints).
- If `model.onnx` grows > 10 MB, set up Git LFS before committing.

## Architecture

```
SiamNet: (batch, 1, 32, 32) → 4× [Conv3×3→BN→ReLU→MaxPool2×2] → AdaptiveAvgPool → FC → L2-norm → (batch, 64)
Loss:    batch-hard triplet with cosine distance
Pre-train: Omniglot (1623 classes × 20 samples) → general shape sense
Finetune:  our 62-symbol rendered dictionary → glyph-specific fingerprints
```

## CLI flag reference (to scale the full bake)

| Script | Key flag | Smoke | Full bake |
|--------|----------|-------|-----------|
| render_dataset.mjs | `--perN` | 3 | 50 |
| train.py | `--steps` | 30 | 5000 |
| finetune.py | `--steps` | 30 | 3000 |
| export_onnx.py | — | — | — |
| build_prototypes.py | — | — | — |
