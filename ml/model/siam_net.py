"""
siam_net.py — Small CNN encoder for glyph fingerprinting (M3, SPEC-ml-recognizer.md).

Architecture: 4-layer ConvNet → global avg-pool → FC → L2-normalized embedding.
Keeps the parameter count low so it trains fast on CPU/small GPU and exports to a
compact ONNX that loads quickly in the browser (M4).

Classes exported:
  SiamNet(embedding_dim, input_size) — the encoder
  TripletLoss()                       — metric-learning objective

Usage:
  from model.siam_net import SiamNet, TripletLoss
  net = SiamNet(embedding_dim=64, input_size=32)
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class SiamNet(nn.Module):
    """
    Small CNN encoder: grayscale image → L2-normalized embedding vector.

    input_size  (int): side of the square input image (pixels), e.g. 32.
    embedding_dim (int): dimension of the output embedding, e.g. 64 or 128.

    Input tensor shape:  (batch, 1, input_size, input_size)  — float, [0,1]
    Output tensor shape: (batch, embedding_dim)               — L2-normalized
    """

    def __init__(self, embedding_dim: int = 64, input_size: int = 32):
        super().__init__()
        self.embedding_dim = embedding_dim
        self.input_size    = input_size

        # Conv backbone: 4 blocks of (Conv 3×3 → BN → ReLU → MaxPool 2×2)
        # After 4 poolings: input_size/16 spatial size.
        self.features = nn.Sequential(
            # Block 1: 1 → 32
            nn.Conv2d(1, 32, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
            # Block 2: 32 → 64
            nn.Conv2d(32, 64, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
            # Block 3: 64 → 128
            nn.Conv2d(64, 128, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
            # Block 4: 128 → 128
            nn.Conv2d(128, 128, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
        )

        # Global average pooling (handles any spatial size gracefully)
        self.gap = nn.AdaptiveAvgPool2d(1)

        # Projection head: 128 → embedding_dim
        self.proj = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128, embedding_dim, bias=True),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: (batch, 1, H, W) float tensor in [0, 1]
        Returns:
            (batch, embedding_dim) L2-normalized embedding
        """
        x = self.features(x)
        x = self.gap(x)
        x = self.proj(x)
        return F.normalize(x, p=2, dim=1)


class TripletLoss(nn.Module):
    """
    Batch-hard triplet loss with cosine distance (on L2-normalized embeddings).

    For L2-normalized vectors, cosine distance = (1 - cosine_sim) = ||a-b||^2 / 2.
    We use squared Euclidean distance on unit-norm embeddings (equivalent, numerically stable).

    margin (float): triplet margin (default 0.3).
    """

    def __init__(self, margin: float = 0.3):
        super().__init__()
        self.margin = margin

    def forward(self, embeddings: torch.Tensor, labels: torch.Tensor) -> torch.Tensor:
        """
        Args:
            embeddings: (N, D) L2-normalized
            labels:     (N,)   integer class indices
        Returns:
            scalar loss
        """
        # Pairwise squared Euclidean distance on unit-norm vectors.
        # ||a - b||^2 = 2 - 2 * a·b  (for unit vectors)
        dot    = embeddings @ embeddings.T                    # (N, N)
        dist2  = (2 - 2 * dot).clamp(min=0)                  # (N, N) non-negative

        # Build masks
        N = labels.size(0)
        labels_eq = labels.unsqueeze(0) == labels.unsqueeze(1)   # (N, N) same-class
        labels_ne = ~labels_eq
        eye       = torch.eye(N, dtype=torch.bool, device=embeddings.device)
        pos_mask  = labels_eq & ~eye   # same class, not self
        neg_mask  = labels_ne          # different class

        # Batch-hard: hardest positive (largest distance within class)
        # and hardest negative (smallest distance across classes).
        # Use a large sentinel for absent entries.
        INF = 1e9
        pos_dist = dist2.masked_fill(~pos_mask, -INF).max(dim=1).values
        neg_dist = dist2.masked_fill(~neg_mask,  INF).min(dim=1).values

        # Only keep anchors that have at least one positive.
        valid = (pos_dist > -INF + 1)
        if not valid.any():
            return embeddings.sum() * 0.0   # zero loss, preserve grad

        pos_dist = pos_dist[valid]
        neg_dist = neg_dist[valid]

        loss = F.relu(pos_dist - neg_dist + self.margin).mean()
        return loss
