"""
Module Vérif-Média — détection de deepfakes / images générées par IA.

Stratégie : API Sightengine (modèle 'genai') si configurée. Sans fournisseur,
l'analyse média n'est pas fiable : on renvoie un résultat neutre explicite plutôt
qu'un faux positif.
"""
from __future__ import annotations

from modules.providers import sightengine_check_image


class MediaModule:
    async def analyze(self, image_url: str) -> dict:
        try:
            prob = await sightengine_check_image(image_url)

            if prob is None:
                # Aucun fournisseur configuré — on reste honnête
                return {
                    "score": None,
                    "label": "analyse média indisponible (fournisseur non configuré)",
                }

            if prob >= 0.70:
                label = "image probablement générée ou manipulée par IA"
            elif prob >= 0.35:
                label = "image potentiellement modifiée — vérification conseillée"
            else:
                label = "aucune manipulation IA détectée"

            return {"score": round(prob, 3), "label": label, "sources": ["Sightengine"]}

        except Exception as e:
            return {"score": None, "label": "erreur d'analyse image", "error": str(e)}
