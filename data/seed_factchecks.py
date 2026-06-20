"""
Importe des articles fact-checkés dans la base vectorielle Qdrant.

Usage :
  python data/seed_factchecks.py

Lit factchecks.csv (colonnes : text, verdict, source_url, fact_checker)
verdict attendu : "vrai" | "faux" | "trompeur"
"""
import csv
import sys
import uuid
from pathlib import Path

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams
from sentence_transformers import SentenceTransformer

COLLECTION  = "fact_checks"
MODEL_NAME  = "paraphrase-multilingual-MiniLM-L12-v2"
CSV_FILE    = Path(__file__).parent / "factchecks.csv"

encoder = SentenceTransformer(MODEL_NAME)
client  = QdrantClient(host="localhost", port=6333)


def ensure_collection():
    existing = [c.name for c in client.get_collections().collections]
    if COLLECTION not in existing:
        client.create_collection(
            collection_name=COLLECTION,
            vectors_config=VectorParams(size=384, distance=Distance.COSINE),
        )
        print(f"Collection '{COLLECTION}' créée.")


def main():
    if not CSV_FILE.exists():
        print(f"Fichier introuvable : {CSV_FILE}")
        sys.exit(1)

    ensure_collection()

    with open(CSV_FILE, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    print(f"{len(rows)} articles à indexer...")
    texts = [row["text"] for row in rows]
    embeddings = encoder.encode(texts, show_progress_bar=True).tolist()

    points = [
        PointStruct(
            id=str(uuid.uuid4()),
            vector=emb,
            payload={
                "text":         row["text"],
                "verdict":      row["verdict"],
                "source_url":   row.get("source_url", ""),
                "fact_checker": row.get("fact_checker", ""),
            },
        )
        for row, emb in zip(rows, embeddings)
    ]

    client.upsert(collection_name=COLLECTION, points=points)
    print(f"{len(points)} points insérés dans Qdrant.")


if __name__ == "__main__":
    main()
