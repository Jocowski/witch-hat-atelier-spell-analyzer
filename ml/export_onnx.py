"""
export_onnx.py — Export a fine-tuned checkpoint to ONNX and verify parity (M3).

Steps:
  1. Load the fine-tuned checkpoint.
  2. Export to ONNX (opset 17, dynamic batch axis).
  3. Run torch↔onnxruntime parity check on a random batch — FAIL LOUDLY if max abs
     diff > threshold (default 1e-5).
  4. Write src/draw/ml-assets/model.onnx and src/draw/ml-assets/model.meta.json.

Usage (smoke):
    uv run --project ml python export_onnx.py --in checkpoints/finetuned.pt

Usage (production):
    uv run --project ml python export_onnx.py --in checkpoints/finetuned.pt --out ../../src/draw/ml-assets/model.onnx

CLI flags (all optional):
    --in       <p>  input checkpoint (default checkpoints/finetuned.pt)
    --out      <p>  output ONNX path (default src/draw/ml-assets/model.onnx relative to repo root)
    --parity-tol <f> max abs diff allowed for parity check (default 1e-5)
    --opset    <n>  ONNX opset version (default 17)
    --batch    <n>  batch size for parity check (default 4)
    --device   <s>  'cuda', 'cpu', or 'auto'
"""

import argparse
import json
import os
import sys
import datetime

import numpy as np
import torch
import onnx
import onnxruntime as ort

sys.path.insert(0, os.path.dirname(__file__))
from model.siam_net import SiamNet

# ── Paths ─────────────────────────────────────────────────────────────────────

ML_DIR   = os.path.dirname(__file__)
REPO_DIR = os.path.abspath(os.path.join(ML_DIR, '..'))

DEFAULT_CKPT_IN  = os.path.join(ML_DIR, 'checkpoints', 'finetuned.pt')
DEFAULT_ONNX_OUT = os.path.join(REPO_DIR, 'src', 'draw', 'ml-assets', 'model.onnx')
DEFAULT_META_OUT = os.path.join(REPO_DIR, 'src', 'draw', 'ml-assets', 'model.meta.json')

# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(description='M3: export checkpoint to ONNX + parity check')
    p.add_argument('--in',         dest='ckpt_in',     type=str, default=DEFAULT_CKPT_IN)
    p.add_argument('--out',        dest='onnx_out',    type=str, default=DEFAULT_ONNX_OUT)
    p.add_argument('--parity-tol', dest='parity_tol',  type=float, default=1e-5)
    p.add_argument('--opset',      type=int,  default=17)
    p.add_argument('--batch',      type=int,  default=4)
    p.add_argument('--device',     type=str,  default='auto')
    return p.parse_args()

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    args = parse_args()

    if args.device == 'auto':
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    else:
        device = torch.device(args.device)

    # Resolve paths relative to cwd (repo root when called as `uv run --project ml python ml/export_onnx.py`).
    ckpt_in  = os.path.abspath(args.ckpt_in)
    onnx_out = os.path.abspath(args.onnx_out)
    meta_out = os.path.join(os.path.dirname(onnx_out), 'model.meta.json')

    print(f'export_onnx.py')
    print(f'  in:     {ckpt_in}')
    print(f'  out:    {onnx_out}')
    print(f'  device: {device}')

    # 1. Load checkpoint
    if not os.path.exists(ckpt_in):
        print(f'ERROR: checkpoint not found: {ckpt_in}')
        print('Run finetune.py (or train.py) first.')
        sys.exit(1)

    ckpt = torch.load(ckpt_in, map_location='cpu', weights_only=True)
    embedding_dim = ckpt.get('embedding_dim', 64)
    input_size    = ckpt.get('input_size',    32)

    model = SiamNet(embedding_dim=embedding_dim, input_size=input_size)
    model.load_state_dict(ckpt['model_state'])
    model = model.to(device).eval()

    print(f'  Model: embedding_dim={embedding_dim} input_size={input_size}')
    print(f'  Params: {sum(p.numel() for p in model.parameters()):,}')

    # 2. Export to ONNX
    os.makedirs(os.path.dirname(os.path.abspath(onnx_out)), exist_ok=True)
    dummy = torch.randn(1, 1, input_size, input_size, device=device)

    torch.onnx.export(
        model,
        dummy,
        onnx_out,
        opset_version=args.opset,
        input_names=['image'],
        output_names=['embedding'],
        dynamic_axes={
            'image':     {0: 'batch'},
            'embedding': {0: 'batch'},
        },
        do_constant_folding=True,
    )
    print(f'\nONNX export: {onnx_out}')

    # 3. ONNX model validity check
    model_proto = onnx.load(onnx_out)
    onnx.checker.check_model(model_proto)
    print('ONNX model check: PASSED')

    # 4. Torch↔onnxruntime parity check
    print(f'\nParity check (batch={args.batch}, tolerance={args.parity_tol:.0e}):')
    test_input = torch.randn(args.batch, 1, input_size, input_size, device=device)

    with torch.no_grad():
        torch_out = model(test_input).cpu().numpy()

    sess = ort.InferenceSession(onnx_out, providers=['CPUExecutionProvider'])
    ort_out = sess.run(['embedding'], {'image': test_input.cpu().numpy()})[0]

    max_diff  = float(np.abs(torch_out - ort_out).max())
    mean_diff = float(np.abs(torch_out - ort_out).mean())
    print(f'  Max abs diff:  {max_diff:.2e}')
    print(f'  Mean abs diff: {mean_diff:.2e}')

    if max_diff > args.parity_tol:
        print(f'\nFAIL: parity check exceeded tolerance ({max_diff:.2e} > {args.parity_tol:.2e})')
        print('The exported ONNX does not match the PyTorch model — do NOT commit.')
        sys.exit(1)

    print('Parity check: PASSED')

    # 5. Write model.meta.json
    meta = {
        'version':       '1',
        'arch':          'SiamNet',
        'inputSize':     input_size,
        'inputChannels': 1,
        'embeddingDim':  embedding_dim,
        'opset':         args.opset,
        'normalization': {
            'description': 'pixel values divided by 255, background=0, ink=1',
            'inputRange':  [0.0, 1.0],
        },
        'parityMaxAbsDiff': max_diff,
        'createdAt': datetime.datetime.utcnow().isoformat() + 'Z',
        'sourceCheckpoint': os.path.basename(ckpt_in),
    }
    with open(meta_out, 'w') as f:
        json.dump(meta, f, indent=2)
    print(f'\nMeta written: {meta_out}')

    # Report size
    onnx_size = os.path.getsize(onnx_out)
    print(f'ONNX file size: {onnx_size/1024:.1f} KB')
    if onnx_size > 10 * 1024 * 1024:
        print('WARNING: model is >10 MB — consider Git LFS before committing.')

    print('\nexport_onnx.py: done.')


if __name__ == '__main__':
    main()
