"""
Fine-tuning d'EfficientNet-B4 pour la détection de deepfakes.

Pipeline :
  1. Charge les frames extraites par data/extract_frames.py
  2. Fine-tune EfficientNet-B4 (classifieur binaire : réel=0, fake=1)
  3. Sauvegarde le meilleur modèle dans models/deepfake_efficientnet.pth

Usage :
  python backend/train_deepfake.py \
    --frames-dir data/frames \
    --output     backend/models/deepfake_efficientnet.pth \
    --epochs     10 \
    --batch-size 16

Matériel recommandé : GPU CUDA ≥ 8 Go VRAM (fonctionne aussi sur CPU, ~5× plus lent)
"""

import argparse
import json
import random
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms
from PIL import Image
from tqdm import tqdm

try:
    from efficientnet_pytorch import EfficientNet
except ImportError:
    raise SystemExit("Installez efficientnet_pytorch : pip install efficientnet_pytorch")


# ---------- Dataset ----------

class DeepfakeDataset(Dataset):
    IMG_SIZE = 380

    TRAIN_TRANSFORM = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(brightness=0.2, contrast=0.2),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    VAL_TRANSFORM = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    def __init__(self, paths: list[str], labels: list[int], train: bool = True):
        self.paths   = paths
        self.labels  = labels
        self.transform = self.TRAIN_TRANSFORM if train else self.VAL_TRANSFORM

    def __len__(self):
        return len(self.paths)

    def __getitem__(self, idx):
        img = Image.open(self.paths[idx]).convert("RGB")
        return self.transform(img), self.labels[idx]


def load_splits(frames_dir: Path, val_ratio: float = 0.15):
    manifest_path = frames_dir / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"Manifest introuvable : {manifest_path}\nLancez d'abord data/extract_frames.py")

    manifest = json.loads(manifest_path.read_text())
    real_paths = manifest["real"]
    fake_paths = manifest["fake"]

    random.shuffle(real_paths)
    random.shuffle(fake_paths)

    def split(paths):
        n = int(len(paths) * val_ratio)
        return paths[n:], paths[:n]

    real_train, real_val = split(real_paths)
    fake_train, fake_val = split(fake_paths)

    train_paths  = real_train + fake_train
    train_labels = [0] * len(real_train) + [1] * len(fake_train)
    val_paths    = real_val + fake_val
    val_labels   = [0] * len(real_val)   + [1] * len(fake_val)

    return (train_paths, train_labels), (val_paths, val_labels)


# ---------- Modèle ----------

def build_model() -> nn.Module:
    model = EfficientNet.from_pretrained("efficientnet-b4")
    # Gèle les premières couches (feature extraction), fine-tune le head seulement
    for name, param in model.named_parameters():
        if "_fc" not in name and "_bn" not in name:
            param.requires_grad = False
    model._fc = nn.Linear(model._fc.in_features, 1)
    return model


# ---------- Boucle d'entraînement ----------

def train_epoch(model, loader, optimizer, criterion, device):
    model.train()
    total_loss, correct, total = 0.0, 0, 0
    for imgs, labels in tqdm(loader, leave=False, desc="train"):
        imgs, labels = imgs.to(device), labels.float().unsqueeze(1).to(device)
        optimizer.zero_grad()
        preds = model(imgs)
        loss  = criterion(preds, labels)
        loss.backward()
        optimizer.step()
        total_loss += loss.item() * len(imgs)
        correct    += ((torch.sigmoid(preds) > 0.5).float() == labels).sum().item()
        total      += len(imgs)
    return total_loss / total, correct / total


@torch.no_grad()
def eval_epoch(model, loader, criterion, device):
    model.eval()
    total_loss, correct, total = 0.0, 0, 0
    for imgs, labels in tqdm(loader, leave=False, desc="val"):
        imgs, labels = imgs.to(device), labels.float().unsqueeze(1).to(device)
        preds = model(imgs)
        loss  = criterion(preds, labels)
        total_loss += loss.item() * len(imgs)
        correct    += ((torch.sigmoid(preds) > 0.5).float() == labels).sum().item()
        total      += len(imgs)
    return total_loss / total, correct / total


# ---------- Main ----------

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--frames-dir",  default="data/frames")
    parser.add_argument("--output",      default="backend/models/deepfake_efficientnet.pth")
    parser.add_argument("--epochs",      type=int,   default=10)
    parser.add_argument("--batch-size",  type=int,   default=16)
    parser.add_argument("--lr",          type=float, default=1e-4)
    parser.add_argument("--val-ratio",   type=float, default=0.15)
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device : {device}")

    # Données
    (train_p, train_l), (val_p, val_l) = load_splits(Path(args.frames_dir), args.val_ratio)
    print(f"Train : {len(train_p)} images | Val : {len(val_p)} images")

    train_ds = DeepfakeDataset(train_p, train_l, train=True)
    val_ds   = DeepfakeDataset(val_p,   val_l,   train=False)

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True,  num_workers=4, pin_memory=True)
    val_loader   = DataLoader(val_ds,   batch_size=args.batch_size, shuffle=False, num_workers=4, pin_memory=True)

    # Modèle
    model     = build_model().to(device)
    criterion = nn.BCEWithLogitsLoss()
    optimizer = torch.optim.Adam(filter(lambda p: p.requires_grad, model.parameters()), lr=args.lr)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)

    # Entraînement
    best_val_acc = 0.0
    output_path  = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    for epoch in range(1, args.epochs + 1):
        train_loss, train_acc = train_epoch(model, train_loader, optimizer, criterion, device)
        val_loss,   val_acc   = eval_epoch(model, val_loader, criterion, device)
        scheduler.step()

        print(f"Epoch {epoch:02d}/{args.epochs} | "
              f"train loss={train_loss:.4f} acc={train_acc:.3f} | "
              f"val loss={val_loss:.4f} acc={val_acc:.3f}")

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), output_path)
            print(f"  ✓ Meilleur modèle sauvegardé ({val_acc:.3f})")

    print(f"\nEntraînement terminé. Meilleure val acc : {best_val_acc:.3f}")
    print(f"Modèle : {output_path}")


if __name__ == "__main__":
    main()
