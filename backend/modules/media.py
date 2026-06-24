"""
Module Vérif-Média — détection de deepfakes / images générées par IA.

Stratégie : API Sightengine (modèle 'genai') si configurée. Sans fournisseur,
l'analyse média n'est pas fiable : on renvoie un résultat neutre explicite plutôt
qu'un faux positif.
"""
from __future__ import annotations

from modules.providers import sightengine_check_image, sightengine_check_image_bytes


def _label(prob: float) -> str:
    if prob >= 0.70:
        return "image probablement générée ou manipulée par IA"
    if prob >= 0.35:
        return "image potentiellement modifiée — vérification conseillée"
    return "aucune manipulation IA détectée"


class MediaModule:
    async def analyze(self, image_url: str) -> dict:
        try:
            prob = await sightengine_check_image(image_url)
            if prob is None:
                return {"score": None, "label": "analyse média indisponible (fournisseur non configuré)"}
            return {"score": round(prob, 3), "label": _label(prob), "sources": ["Sightengine"]}
        except Exception as e:
            return {"score": None, "label": "erreur d'analyse image", "error": str(e)}

    async def analyze_frames(self, frames: list[tuple[bytes, str, str]]) -> dict:
        """Analyse plusieurs frames (vidéo) et agrège : score = max des frames."""
        probs = []
        for data, name, ctype in frames:
            p = await sightengine_check_image_bytes(data, name, ctype)
            if p is not None:
                probs.append(p)
        if not probs:
            return {"score": None, "label": "analyse vidéo indisponible (fournisseur non configuré)"}
        prob = max(probs)
        label = _label(prob).replace("image", "vidéo")
        return {"score": round(prob, 3), "label": f"{label} (sur {len(probs)} image(s))", "sources": ["Sightengine"]}
