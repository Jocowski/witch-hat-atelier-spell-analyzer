"""
train.py — Metric pre-train the siamese encoder on Omniglot (M3, SPEC-ml-recognizer.md).

Uses torchvision.datasets.Omniglot (auto-downloads to ml/data/omniglot/).
Omniglot has 1623 classes × 20 examples = 32,460 grayscale 105×105 images.
We resize them to our model's input_size and train with batch-hard triplet loss
so the encoder learns a general sense of shape similarity before seeing our glyphs.

Usage (smoke — tiny step count):
    uv run --project ml python train.py --steps 30 --out checkpoints/base.pt

Usage (full bake — recommended):
    uv run --project ml python train.py --steps 5000 --embedding-dim 64 --batch-size 64 --out checkpoints/base.pt

CLI flags (all optional):
    --steps          <n>   training steps (default 500)
    --embedding-dim  <n>   encoder output dimension (default 64)
    --input-size     <n>   model input image size in px (default 32; match render_dataset)
    --batch-size     <n>   samples per batch (default 64)
    --lr             <f>   learning rate (default 1e-3)
    --margin         <f>   triplet loss margin (default 0.3)
    --classes-per-batch <n> distinct classes per batch for triplet mining (default 8)
    --out            <path> checkpoint output path (default checkpoints/base.pt)
    --data-root      <dir>  Omniglot download root (default ml/data/omniglot)
    --device         <str>  'cuda', 'cpu', or 'auto' (default auto)
    --seed           <n>   torch random seed (default 42)
"""

import argparse
import os
import sys
import time
import random

import numpy as np
import torch
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import datasets, transforms

# Insert ml/ dir so `from model.siam_net` resolves regardless of cwd.
sys.path.insert(0, os.path.dirname(__file__))
from model.siam_net import SiamNet, TripletLoss

# ── CLI ────────────────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(description='M3: metric pre-train on Omniglot')
    p.add_argument('--steps',             type=int,   default=500,    help='training steps (batches)')
    p.add_argument('--embedding-dim',     type=int,   default=64,     help='embedding dimension')
    p.add_argument('--input-size',        type=int,   default=32,     help='model input image side (px)')
    p.add_argument('--batch-size',        type=int,   default=64,     help='batch size')
    p.add_argument('--lr',                type=float, default=1e-3,   help='learning rate')
    p.add_argument('--margin',            type=float, default=0.3,    help='triplet loss margin')
    p.add_argument('--classes-per-batch', type=int,   default=8,      help='distinct classes per batch')
    p.add_argument('--out',               type=str,   default='checkpoints/base.pt')
    p.add_argument('--data-root',         type=str,   default=os.path.join(os.path.dirname(__file__), 'data', 'omniglot'))
    p.add_argument('--device',            type=str,   default='auto')
    p.add_argument('--seed',              type=int,   default=42)
    return p.parse_args()

# ── Balanced batch sampler for metric learning ─────────────────────────────────

class BalancedBatchSampler:
    """
    Yields batches of indices such that each batch contains exactly
    `classes_per_batch` distinct classes and `samples_per_class` samples each.

    batch_size must equal classes_per_batch * samples_per_class.
    """

    def __init__(self, labels, classes_per_batch: int, samples_per_class: int, num_batches: int, rng):
        from collections import defaultdict
        by_class = defaultdict(list)
        for idx, lbl in enumerate(labels):
            by_class[int(lbl)].append(idx)
        # Keep only classes with enough samples.
        self.by_class = {k: v for k, v in by_class.items() if len(v) >= samples_per_class}
        self.class_ids = list(self.by_class.keys())
        self.cpc = classes_per_batch
        self.spc = samples_per_class
        self.num_batches = num_batches
        self.rng = rng

    def __iter__(self):
        for _ in range(self.num_batches):
            classes = self.rng.sample(self.class_ids, min(self.cpc, len(self.class_ids)))
            batch = []
            for cls in classes:
                samples = self.rng.sample(self.by_class[cls], self.spc)
                batch.extend(samples)
            yield batch

    def __len__(self):
        return self.num_batches

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    args = parse_args()

    # Reproducibility
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)

    # Device
    if args.device == 'auto':
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    else:
        device = torch.device(args.device)
    print(f'train.py — device: {device}  steps: {args.steps}  embedding-dim: {args.embedding_dim}')

    # Output dir — resolve relative to cwd (the repo root when called as `node ml/train.py`).
    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    # Transform: resize to input_size, invert (Omniglot is white-on-black; our glyphs are black-on-white)
    tfm = transforms.Compose([
        transforms.Grayscale(num_output_channels=1),
        transforms.Resize((args.input_size, args.input_size)),
        transforms.ToTensor(),          # [0,1]
        transforms.Lambda(lambda x: 1.0 - x),   # invert: make ink=bright (matches our raster convention)
    ])

    print(f'Loading Omniglot from {args.data_root} (auto-downloads if absent)...')
    try:
        ds_bg = datasets.Omniglot(root=args.data_root, background=True,  download=True, transform=tfm)
        ds_ev = datasets.Omniglot(root=args.data_root, background=False, download=True, transform=tfm)
    except Exception as e:
        print(f'ERROR loading Omniglot: {e}')
        print('Tip: ensure you have internet access for the first download (~60 MB).')
        sys.exit(1)

    # Merge background + evaluation splits (re-index labels for the merged set).
    from torch.utils.data import ConcatDataset
    n_bg = len(set(ds_bg._flat_character_images[i][1] for i in range(len(ds_bg))))

    # Re-label evaluation classes to not overlap with background classes.
    class OffsetLabelDataset(torch.utils.data.Dataset):
        def __init__(self, ds, offset):
            self.ds = ds
            self.offset = offset
        def __len__(self): return len(self.ds)
        def __getitem__(self, idx):
            x, y = self.ds[idx]
            return x, y + self.offset

    ds_ev_offset = OffsetLabelDataset(ds_ev, n_bg)
    dataset = ConcatDataset([ds_bg, ds_ev_offset])

    # Extract all labels (needed for the balanced sampler).
    print('Extracting labels...')
    labels = []
    for i in range(len(ds_bg)):
        _, y = ds_bg._flat_character_images[i]
        labels.append(int(y))
    for i in range(len(ds_ev)):
        _, y = ds_ev._flat_character_images[i]
        labels.append(int(y) + n_bg)

    # Balanced batch sampler
    samples_per_class = max(2, args.batch_size // args.classes_per_batch)
    py_rng = random.Random(args.seed)
    sampler = BalancedBatchSampler(
        labels,
        classes_per_batch=args.classes_per_batch,
        samples_per_class=samples_per_class,
        num_batches=args.steps,
        rng=py_rng,
    )

    loader = DataLoader(dataset, batch_sampler=sampler, num_workers=0, pin_memory=(device.type == 'cuda'))

    # Model + optimizer
    model = SiamNet(embedding_dim=args.embedding_dim, input_size=args.input_size).to(device)
    criterion = TripletLoss(margin=args.margin)
    optimizer = optim.Adam(model.parameters(), lr=args.lr)

    print(f'Model: {sum(p.numel() for p in model.parameters()):,} parameters')
    print(f'Dataset: {len(dataset):,} samples, {len(set(labels)):,} classes')
    print()

    # Training loop
    model.train()
    total_loss = 0.0
    log_every  = max(1, args.steps // 10)
    t0 = time.time()

    for step, (imgs, lbls) in enumerate(loader):
        imgs = imgs.to(device)
        lbls = lbls.to(device)

        optimizer.zero_grad()
        embeddings = model(imgs)
        loss = criterion(embeddings, lbls)
        loss.backward()
        optimizer.step()

        total_loss += loss.item()
        if (step + 1) % log_every == 0 or step == 0:
            avg = total_loss / (step + 1)
            elapsed = time.time() - t0
            print(f'  step {step+1:5d}/{args.steps}  loss={avg:.4f}  elapsed={elapsed:.1f}s')

    print(f'\nTraining complete ({args.steps} steps, {time.time()-t0:.1f}s total)')

    # Save checkpoint
    torch.save({
        'model_state': model.state_dict(),
        'embedding_dim': args.embedding_dim,
        'input_size': args.input_size,
        'steps': args.steps,
        'arch': 'SiamNet',
    }, out_path)
    print(f'Checkpoint saved: {out_path}')


if __name__ == '__main__':
    main()
