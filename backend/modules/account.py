"""
Module Vérif-Compte — détection de faux comptes officiels.

Compare l'image de profil d'un compte à un registre d'embeddings de comptes officiels
(figures publiques, institutions) constitué en partenariat avec MINPOSTEL/ANTIC.
Limité volontairement aux figures publiques (pas de matching sur des particuliers).
"""
from __future__ import annotations

from io import BytesIO

import httpx
import numpy as np
from PIL import Image
from sqlalchemy import text

from db.session import get_db_connection

MATCH_THRESHOLD   = 0.92   # correspondance quasi-certaine
PARTIAL_THRESHOLD = 0.80   # ressemblance partielle

try:
    import clip
    import torch
    _clip_available = True
except ImportError:
    _clip_available = False


class AccountModule:
    def __init__(self):
        self._model     = None
        self._preprocess = None
        self._registry: dict[str, np.ndarray] = {}

    def _init(self):
        if self._model:
            return
        if not _clip_available:
            raise RuntimeError("CLIP non installé — pip install clip-by-openai")

        import clip, torch
        self._model, self._preprocess = clip.load("ViT-B/32", device="cpu")
        self._model.eval()
        self._load_registry()

    def _load_registry(self):
        """Charge les embeddings depuis PostgreSQL au démarrage."""
        import json
        with get_db_connection() as conn:
            rows = conn.execute(
                text("SELECT name, embedding FROM official_accounts")
            ).fetchall()
        self._registry = {
            row[0]: np.array(json.loads(row[1]), dtype=np.float32)
            for row in rows
        }

    async def analyze(self, profile_image_url: str, profile_name: str) -> dict:
        try:
            self._init()

            import torch
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(profile_image_url)
            resp.raise_for_status()

            img    = Image.open(BytesIO(resp.content)).convert("RGB")
            tensor = self._preprocess(img).unsqueeze(0)

            with torch.no_grad():
                emb = self._model.encode_image(tensor).numpy().flatten().astype(np.float32)
                emb = emb / (np.linalg.norm(emb) + 1e-9)

            best_name, best_score = self._find_best_match(emb)

            if best_score >= MATCH_THRESHOLD:
                return {
                    "score": round(1.0 - best_score, 3),
                    "label": f"correspond au compte officiel de {best_name}",
                }
            if best_score >= PARTIAL_THRESHOLD:
                return {
                    "score": 0.6,
                    "label": f"ressemblance partielle avec {best_name} — vérifiez",
                }
            return {
                "score": 0.0,
                "label": "aucun compte officiel correspondant",
            }

        except Exception as e:
            return {"score": None, "label": "erreur analyse du compte", "error": str(e)}

    def _find_best_match(self, emb: np.ndarray) -> tuple[str, float]:
        best_name, best_score = "", 0.0
        for name, ref in self._registry.items():
            sim = float(np.dot(emb, ref))
            if sim > best_score:
                best_score, best_name = sim, name
        return best_name, best_score
