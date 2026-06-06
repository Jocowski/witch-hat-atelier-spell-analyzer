"""
build_prototypes.py — Build per-symbol prototype embeddings from the exported ONNX model (M3).

Runs all rendered dictionary images through the ONNX model to compute one mean
embedding per symbol.  Emits src/draw/ml-assets/prototypes.json — the offline
fallback used by M4's mlRecognizer.js when Supabase is unavailable.

Also prints a prototype-vs-prototype cosine similarity matrix summary to characterise
class separation (a quick sanity check that the model has learned something useful).

Usage:
    uv run --project ml python build_prototypes.py
    uv run --project ml python build_prototypes.py --model ../../src/draw/ml-assets/model.onnx --data ml/data

CLI flags (all optional):
    --model  <p>  ONNX model path (default src/draw/ml-assets/model.onnx relative to repo root)
    --data   <d>  rendered data dir with images/ + labels.json (default ml/data)
    --out    <p>  output prototypes JSON (default src/draw/ml-assets/prototypes.json)
    --top-k  <n>  nearest-neighbor pairs to print in the cosine summary (default 10)
"""

import argparse
import json
import os
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

# ── Paths ─────────────────────────────────────────────────────────────────────

ML_DIR   = os.path.dirname(__file__)
REPO_DIR = os.path.abspath(os.path.join(ML_DIR, '..'))

DEFAULT_MODEL_PATH = os.path.join(REPO_DIR, 'src', 'draw', 'ml-assets', 'model.onnx')
DEFAULT_DATA_DIR   = os.path.join(ML_DIR, 'data')
DEFAULT_OUT_PATH   = os.path.join(REPO_DIR, 'src', 'draw', 'ml-assets', 'prototypes.json')

# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(description='M3: build per-symbol prototype embeddings')
    p.add_argument('--model',  type=str, default=DEFAULT_MODEL_PATH)
    p.add_argument('--data',   type=str, default=DEFAULT_DATA_DIR)
    p.add_argument('--out',    type=str, default=DEFAULT_OUT_PATH)
    p.add_argument('--top-k',  type=int, default=10, help='nearest pairs to print')
    return p.parse_args()

# ── ONNX inference helper ─────────────────────────────────────────────────────

def embed_image(sess, img_path: str, input_size: int) -> np.ndarray:
    """Load a PNG and run it through the ONNX session -> embedding (1D array)."""
    img = Image.open(img_path).convert('L')
    if img.size != (input_size, input_size):
        img = img.resize((input_size, input_size), Image.BILINEAR)
    arr = np.array(img, dtype=np.float32) / 255.0  # [0,1] white-bg
    arr = 1.0 - arr                                  # ink=1
    tensor = arr[np.newaxis, np.newaxis, :, :]       # (1,1,H,W)
    out = sess.run(['embedding'], {'image': tensor})[0]
    vec = out[0]
    # L2-normalize (model already does this, but re-normalize for safety)
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 1e-9 else vec

# ── Cosine matrix analysis ─────────────────────────────────────────────────────

def cosine_summary(prototypes: dict, top_k: int):
    """
    Print:
      - Mean intra-class similarity (prototype vs itself = 1, so skip)
      - The top_k nearest inter-class prototype pairs (potential confusers)
      - Min inter-class similarity (best separation)
    """
    names = list(prototypes.keys())
    n     = len(names)
    vecs  = np.stack([prototypes[nm] for nm in names])   # (n, D)

    # Cosine similarity matrix
    cos = vecs @ vecs.T   # already L2-normalized -> dot product = cosine sim

    # Collect all off-diagonal pairs
    pairs = []
    for i in range(n):
        for j in range(i + 1, n):
            pairs.append((float(cos[i, j]), names[i], names[j]))
    pairs.sort(reverse=True)

    print(f'\nPrototype cosine-similarity summary ({n} symbols):')
    print(f'  Mean inter-class similarity: {np.mean([p[0] for p in pairs]):.4f}')
    print(f'  Min  inter-class similarity: {np.min([p[0] for p in pairs]):.4f}')
    print(f'  Max  inter-class similarity: {pairs[0][0]:.4f}  ({pairs[0][1]} <-> {pairs[0][2]})')
    print(f'\n  Top-{top_k} nearest pairs (potential confusers):')
    for sim, a, b in pairs[:top_k]:
        print(f'    {sim:.4f}  {a} <-> {b}')
    print()

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    args = parse_args()

    # Resolve paths relative to cwd (repo root when called as `uv run --project ml python ml/build_prototypes.py`).
    model_path = os.path.abspath(args.model)
    data_dir   = os.path.abspath(args.data)
    out_path   = os.path.abspath(args.out)

    print(f'build_prototypes.py')
    print(f'  model: {model_path}')
    print(f'  data:  {data_dir}')
    print(f'  out:   {out_path}')

    # Load ONNX model
    if not os.path.exists(model_path):
        print(f'ERROR: model not found: {model_path}')
        print('Run export_onnx.py first.')
        sys.exit(1)

    sess = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
    # Infer input size from the model's input shape
    input_info  = sess.get_inputs()[0]
    input_shape = input_info.shape
    input_size  = int(input_shape[2]) if len(input_shape) >= 3 and isinstance(input_shape[2], int) else 32
    print(f'  ONNX input: {input_shape}  (using input_size={input_size})')

    # Also read embedding dim from meta if available
    meta_path = os.path.join(os.path.dirname(model_path), 'model.meta.json')
    model_version = '1'
    if os.path.exists(meta_path):
        with open(meta_path) as f:
            meta = json.load(f)
        model_version = meta.get('version', '1')

    # Load labels manifest
    labels_path = os.path.join(data_dir, 'labels.json')
    if not os.path.exists(labels_path):
        print(f'ERROR: labels.json not found: {labels_path}')
        print('Run render_dataset.mjs first.')
        sys.exit(1)

    with open(labels_path) as f:
        manifest = json.load(f)

    # Group image paths by label
    by_label = defaultdict(list)
    for entry in manifest['images']:
        img_path = os.path.join(data_dir, entry['path'])
        by_label[entry['label']].append((img_path, entry.get('role', 'unknown')))

    print(f'  Labels: {len(by_label)} symbols, {sum(len(v) for v in by_label.values())} images total')

    # Embed all images and compute mean prototype per symbol
    prototypes     = {}   # label -> ndarray (embedding_dim,)
    prototype_roles = {}  # label -> role (for the JSON output)
    total_embedded = 0

    for label, entries in sorted(by_label.items()):
        vecs = []
        role = entries[0][1]
        for img_path, _ in entries:
            if not os.path.exists(img_path):
                continue
            try:
                vec = embed_image(sess, img_path, input_size)
                vecs.append(vec)
                total_embedded += 1
            except Exception as e:
                print(f'  WARNING: failed to embed {img_path}: {e}')

        if not vecs:
            print(f'  WARNING: no embeddings for {label}, skipping.')
            continue

        mean_vec = np.mean(np.stack(vecs), axis=0)
        # Re-normalize the mean
        norm = np.linalg.norm(mean_vec)
        if norm > 1e-9:
            mean_vec = mean_vec / norm

        prototypes[label]      = mean_vec
        prototype_roles[label] = role

    print(f'  Embedded {total_embedded} images -> {len(prototypes)} prototypes')

    # Cosine separation summary
    cosine_summary(prototypes, args.top_k)

    # Emit prototypes.json
    # Format: { modelVersion, symbols: [{ name, role, embedding: [float,...] }] }
    out_symbols = []
    for label in sorted(prototypes.keys()):
        out_symbols.append({
            'name':      label,
            'role':      prototype_roles[label],
            'embedding': prototypes[label].tolist(),
        })

    out_data = {
        'modelVersion': model_version,
        'inputSize':    input_size,
        'symbols':      out_symbols,
    }

    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, 'w') as f:
        json.dump(out_data, f, separators=(',', ':'))  # compact — no indent (smaller file)

    out_size = os.path.getsize(out_path)
    print(f'Prototypes written: {out_path}  ({out_size/1024:.1f} KB)')
    print(f'build_prototypes.py: done.')


if __name__ == '__main__':
    main()
