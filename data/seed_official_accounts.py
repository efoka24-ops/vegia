"""
Peuple le registre des comptes officiels.

Usage :
  python data/seed_official_accounts.py

Le script lit accounts.csv (colonnes : name, title, image_url, source_url)
et insère les embeddings CLIP dans la table official_accounts.
"""
import csv
import json
import sys
from io import BytesIO
from pathlib import Path

import httpx
import numpy as np
import torch
from PIL import Image
from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from db.session import engine

try:
    import clip
except ImportError:
    print("Installez CLIP : pip install clip-by-openai")
    sys.exit(1)

model, preprocess = clip.load("ViT-B/32", device="cpu")
model.eval()

CSV_FILE = Path(__file__).parent / "accounts.csv"


def embed_image(url: str) -> list[float]:
    resp = httpx.get(url, timeout=15)
    resp.raise_for_status()
    img = Image.open(BytesIO(resp.content)).convert("RGB")
    tensor = preprocess(img).unsqueeze(0)
    with torch.no_grad():
        emb = model.encode_image(tensor).numpy().flatten().astype(np.float32)
    emb = emb / (np.linalg.norm(emb) + 1e-9)
    return emb.tolist()


def main():
    if not CSV_FILE.exists():
        print(f"Fichier introuvable : {CSV_FILE}")
        sys.exit(1)

    with open(CSV_FILE, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    print(f"{len(rows)} comptes à traiter...")
    with engine.begin() as conn:
        for i, row in enumerate(rows, 1):
            print(f"  [{i}/{len(rows)}] {row['name']}")
            try:
                emb = embed_image(row["image_url"])
                conn.execute(
                    text("""
                        INSERT INTO official_accounts (name, title, embedding, source_url, verified_by)
                        VALUES (:name, :title, :embedding, :source_url, 'MINPOSTEL')
                        ON CONFLICT DO NOTHING
                    """),
                    {
                        "name":       row["name"],
                        "title":      row.get("title", ""),
                        "embedding":  json.dumps(emb),
                        "source_url": row.get("source_url", ""),
                    },
                )
            except Exception as e:
                print(f"    ERREUR : {e}")

    print("Terminé.")


if __name__ == "__main__":
    main()
