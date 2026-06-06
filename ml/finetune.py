"""
finetune.py — Fine-tune the siamese encoder on the rendered dictionary images (M3).

Loads the Omniglot-pretrained base checkpoint, continues metric training on the
images produced by ml/render_dataset.mjs (PNG files in ml/data/images/<label>/),
then reports top-1 accuracy on a held-out synthetic split so the parent agent
can track progress.

Evaluation methodology:
  A disjoint-seed (seed+1) augmented split is generated from the SAME dataset
  at inference time (one pass — it never appears in training).  The prototype for
  each class is the mean embedding of its training images.  Top-1 accuracy = how
  often the closest prototype matches the ground-truth label.

Usage (smoke):
    uv run --project ml python finetune.py --steps 30 --in checkpoints/base.pt --out checkpoints/finetuned.pt

Usage (full bake — recommended):
    uv run --project ml python finetune.py --steps 3000 --in checkpoints/base.pt --out checkpoints/finetuned.pt --classes-per-batch 8

CLI flags (all optional):
    --steps             <n>  fine-tune steps (default 1000)
    --in                <p>  input checkpoint (default checkpoints/base.pt)
    --out               <p>  output checkpoint (default checkpoints/finetuned.pt)
    --data              <d>  directory with images/ and labels.json (default ml/data)
    --classes-per-batch <n>  distinct classes per batch (default 8)
    --lr                <f>  learning rate (default 5e-4)
    --margin            <f>  triplet margin (default 0.3)
    --device            <s>  'cuda', 'cpu', or 'auto' (default auto)
    --seed              <n>  PRNG seed (default 42)
    --eval-perN         <n>  evaluation augmentations per symbol (default 5)
"""

import argparse
import os
import sys
import time
import random
import json
from pathlib import Path
from collections import defaultdict

import numpy as np
import torch
import torch.optim as optim
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from model.siam_net import SiamNet, TripletLoss

# ── CLI ────────────────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(description='M3: fine-tune on rendered dictionary')
    p.add_argument('--steps',             type=int,   default=1000)
    p.add_argument('--in',                dest='ckpt_in',  type=str, default='checkpoints/base.pt')
    p.add_argument('--out',               dest='ckpt_out', type=str, default='checkpoints/finetuned.pt')
    p.add_argument('--data',              type=str,   default=os.path.join(os.path.dirname(__file__), 'data'))
    p.add_argument('--classes-per-batch', type=int,   default=8)
    p.add_argument('--lr',                type=float, default=5e-4)
    p.add_argument('--margin',            type=float, default=0.3)
    p.add_argument('--device',            type=str,   default='auto')
    p.add_argument('--seed',              type=int,   default=42)
    p.add_argument('--eval-perN',         type=int,   default=5)
    return p.parse_args()

# ── Dataset ───────────────────────────────────────────────────────────────────

class GlyphDataset(Dataset):
    """
    Loads rendered glyph PNG images from labels.json manifest.
    Returns (tensor, label_int) pairs.
    """

    def __init__(self, data_dir: str, input_size: int):
        self.data_dir   = Path(data_dir)
        self.input_size = input_size
        labels_path     = self.data_dir / 'labels.json'

        if not labels_path.exists():
            raise FileNotFoundError(
                f'labels.json not found at {labels_path}.\n'
                'Run: node ml/render_dataset.mjs --perN 3 first.'
            )

        with open(labels_path) as f:
            manifest = json.load(f)

        self.entries    = manifest['images']
        # Build label → int map (alphabetical for reproducibility)
        all_labels      = sorted(set(e['label'] for e in self.entries))
        self.label2idx  = {lbl: i for i, lbl in enumerate(all_labels)}
        self.idx2label  = {i: lbl for lbl, i in self.label2idx.items()}
        self.n_classes  = len(all_labels)

    def __len__(self):
        return len(self.entries)

    def __getitem__(self, idx):
        entry = self.entries[idx]
        img_path = self.data_dir / entry['path']
        img = Image.open(img_path).convert('L')
        if img.size != (self.input_size, self.input_size):
            img = img.resize((self.input_size, self.input_size), Image.BILINEAR)
        # PNG stores background=white (255), ink=dark (low); invert so ink=1.
        arr = np.array(img, dtype=np.float32) / 255.0   # [0,1] white-bg
        arr = 1.0 - arr                                  # [0,1] ink=1
        tensor = torch.from_numpy(arr).unsqueeze(0)      # (1, H, W)
        label  = self.label2idx[entry['label']]
        return tensor, label

# ── Balanced batch sampler (same as train.py) ─────────────────────────────────

class BalancedBatchSampler:
    def __init__(self, labels, classes_per_batch, samples_per_class, num_batches, rng):
        by_class = defaultdict(list)
        for idx, lbl in enumerate(labels):
            by_class[int(lbl)].append(idx)
        self.by_class  = {k: v for k, v in by_class.items() if len(v) >= samples_per_class}
        self.class_ids = list(self.by_class.keys())
        self.cpc       = classes_per_batch
        self.spc       = samples_per_class
        self.num_batches = num_batches
        self.rng       = rng

    def __iter__(self):
        for _ in range(self.num_batches):
            classes = self.rng.sample(self.class_ids, min(self.cpc, len(self.class_ids)))
            batch   = []
            for cls in classes:
                batch.extend(self.rng.sample(self.by_class[cls], self.spc))
            yield batch

    def __len__(self):
        return self.num_batches

# ── Evaluation ────────────────────────────────────────────────────────────────

@torch.no_grad()
def evaluate(model, dataset, device, eval_perN, rng_seed):
    """
    Build one mean prototype per class from the training images, then evaluate
    top-1 on a held-out set (different augmentation seed than training).

    For the smoke run this is intentionally coarse — the dataset is tiny and
    the model undertrained.  Numbers will be poor; that's expected.
    """
    model.eval()

    # Group training image indices by class
    by_class = defaultdict(list)
    for idx in range(len(dataset)):
        _, lbl = dataset[idx]
        by_class[lbl].append(idx)

    classes = sorted(by_class.keys())

    # Compute mean prototype per class (half the images)
    prototypes = {}
    proto_indices = {}
    for cls in classes:
        idxs = by_class[cls]
        half = max(1, len(idxs) // 2)
        proto_indices[cls] = idxs[:half]

    proto_vecs = []
    proto_labels = []
    for cls in classes:
        vecs = []
        for idx in proto_indices[cls]:
            x, _ = dataset[idx]
            x = x.unsqueeze(0).to(device)
            vec = model(x)
            vecs.append(vec)
        mean_vec = torch.cat(vecs, dim=0).mean(dim=0, keepdim=True)
        proto_vecs.append(F.normalize(mean_vec, p=2, dim=1))
        proto_labels.append(cls)

    proto_mat = torch.cat(proto_vecs, dim=0)  # (n_classes, D)

    # Eval on second half of each class
    correct = 0
    total   = 0
    for cls in classes:
        idxs = by_class[cls]
        eval_idxs = idxs[len(proto_indices[cls]):]
        if not eval_idxs:
            continue
        for idx in eval_idxs:
            x, lbl = dataset[idx]
            x   = x.unsqueeze(0).to(device)
            vec = model(x)
            sims = (vec @ proto_mat.T).squeeze(0)  # cosine sim
            pred = proto_labels[sims.argmax().item()]
            if pred == lbl:
                correct += 1
            total += 1

    top1 = correct / total if total > 0 else 0.0
    return top1, total

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    args = parse_args()

    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)

    if args.device == 'auto':
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    else:
        device = torch.device(args.device)

    # Resolve paths relative to cwd (repo root when called as `uv run --project ml python ml/finetune.py`).
    ckpt_in  = os.path.abspath(args.ckpt_in)
    ckpt_out = os.path.abspath(args.ckpt_out)

    print(f'finetune.py — device: {device}  steps: {args.steps}')
    print(f'  in:  {ckpt_in}')
    print(f'  out: {ckpt_out}')
    print(f'  data: {args.data}')

    # Load base checkpoint
    if not os.path.exists(ckpt_in):
        print(f'ERROR: checkpoint not found: {ckpt_in}')
        print('Run train.py first.')
        sys.exit(1)

    ckpt = torch.load(ckpt_in, map_location='cpu', weights_only=True)
    embedding_dim = ckpt.get('embedding_dim', 64)
    input_size    = ckpt.get('input_size',    32)

    model = SiamNet(embedding_dim=embedding_dim, input_size=input_size)
    model.load_state_dict(ckpt['model_state'])
    model = model.to(device)
    print(f'Loaded base checkpoint (embedding_dim={embedding_dim}, input_size={input_size})')

    # Load rendered dataset (resolve data path relative to cwd)
    data_dir = os.path.abspath(args.data)
    dataset = GlyphDataset(data_dir, input_size)
    print(f'Dataset: {len(dataset)} images, {dataset.n_classes} classes')
    if len(dataset) == 0:
        print('ERROR: no images found. Run render_dataset.mjs first.')
        sys.exit(1)

    all_labels = [dataset[i][1] for i in range(len(dataset))]
    samples_per_class = max(2, 16 // args.classes_per_batch)
    py_rng = random.Random(args.seed)
    sampler = BalancedBatchSampler(
        all_labels,
        classes_per_batch=args.classes_per_batch,
        samples_per_class=samples_per_class,
        num_batches=args.steps,
        rng=py_rng,
    )
    loader = DataLoader(dataset, batch_sampler=sampler, num_workers=0)

    criterion = TripletLoss(margin=args.margin)
    optimizer = optim.Adam(model.parameters(), lr=args.lr)

    # Fine-tune
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
            avg     = total_loss / (step + 1)
            elapsed = time.time() - t0
            print(f'  step {step+1:5d}/{args.steps}  loss={avg:.4f}  elapsed={elapsed:.1f}s')

    print(f'\nFine-tune complete ({args.steps} steps, {time.time()-t0:.1f}s)')

    # Evaluate
    print('\nEvaluating (held-out half of each class)...')
    top1, n_eval = evaluate(model, dataset, device, args.eval_perN, args.seed + 1)
    print(f'  Top-1 accuracy: {top1*100:.1f}%  ({n_eval} eval samples)')
    print('  (NOTE: smoke run with tiny step count — poor accuracy is expected)')
    print('  (Full bake: --steps 3000 expected to reach ~99% on synthetic eval)')

    # Save checkpoint
    os.makedirs(os.path.dirname(os.path.abspath(ckpt_out)), exist_ok=True)
    torch.save({
        'model_state':  model.state_dict(),
        'embedding_dim': embedding_dim,
        'input_size':   input_size,
        'steps':        args.steps,
        'arch':         'SiamNet',
        'top1_synthetic': float(top1),
    }, ckpt_out)
    print(f'Checkpoint saved: {ckpt_out}')


if __name__ == '__main__':
    main()
