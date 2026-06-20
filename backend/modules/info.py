"""
Module Vérif-Info — fact-checking par similarité sémantique.

Base vectorielle Qdrant, collection "fact_checks".
Chaque document : { text, verdict, source_url, fact_checker }
"""
from __future__ import annotations

from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
import os

COLLECTION = "fact_checks"
SIMILARITY_THRESHOLD = 0.75
MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"


class InfoModule:
    def __init__(self):
        self._encoder = None
        self._qdrant  = None

    def _init(self):
        if self._encoder:
            return
        self._encoder = SentenceTransformer(MODEL_NAME)
        self._qdrant  = QdrantClient(
            host=os.getenv("QDRANT_HOST", "localhost"),
            port=int(os.getenv("QDRANT_PORT", 6333)),
        )

    async def analyze(self, text: str) -> dict:
        if len(text.strip()) < 20:
            return {"score": 0.0, "label": "texte trop court pour analyse"}

        try:
            self._init()
            embedding = self._encoder.encode(text).tolist()

            results = self._qdrant.search(
                collection_name=COLLECTION,
                query_vector=embedding,
                limit=3,
            )

            if not results or results[0].score < SIMILARITY_THRESHOLD:
                return {"score": 0.0, "label": "aucune correspondance dans la base fact-check"}

            top     = results[0]
            verdict = top.payload.get("verdict", "inconnu")  # "vrai" | "faux" | "trompeur"
            sim     = float(top.score)

            # Score de risque élevé si similaire à un contenu réfuté
            risk = sim if verdict in ("faux", "trompeur") else (1.0 - sim) * 0.2

            return {
                "score":   round(risk, 3),
                "label":   f"similaire à un contenu {verdict} (confiance {sim:.0%})",
                "sources": [top.payload.get("source_url", "")],
            }

        except Exception as e:
            return {"score": None, "label": "erreur fact-checking", "error": str(e)}
