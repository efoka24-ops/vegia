"""
Module Vérif-Audio — détection de voix synthétique / clonée (deepfake audio).

Les arnaques par fausse voix (clonage vocal) explosent. Ce module envoie le clip
à un fournisseur de détection audio configurable. Sans fournisseur, il renvoie un
résultat neutre explicite (pas de faux positif).

Configuration (env) :
  AUDIO_DETECT_URL  : endpoint du fournisseur (POST multipart, champ 'media')
  AUDIO_DETECT_KEY  : clé Bearer (optionnel)
  AUDIO_SCORE_FIELD : nom du champ de probabilité dans la réponse (def. 'score')
"""
from __future__ import annotations

import os

import httpx


class AudioModule:
    async def analyze(self, audio_bytes: bytes, filename: str | None, content_type: str | None) -> dict:
        url = os.getenv("AUDIO_DETECT_URL")
        if not url:
            return {"score": None, "label": "analyse audio indisponible (fournisseur non configuré)"}

        key = os.getenv("AUDIO_DETECT_KEY")
        field = os.getenv("AUDIO_SCORE_FIELD", "score")
        try:
            files = {"media": (filename or "audio.m4a", audio_bytes, content_type or "application/octet-stream")}
            headers = {"Authorization": f"Bearer {key}"} if key else {}
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, files=files, headers=headers)
            resp.raise_for_status()
            data = resp.json()

            raw = data.get(field, data.get("ai_probability", data.get("fake", 0.0)))
            prob = float(raw)
            prob = max(0.0, min(1.0, prob))

            if prob >= 0.70:
                label = "voix probablement synthétique / clonée"
            elif prob >= 0.35:
                label = "voix potentiellement artificielle — prudence"
            else:
                label = "voix a priori authentique"

            return {"score": round(prob, 3), "label": label, "sources": ["détection audio"]}

        except Exception as e:
            return {"score": None, "label": "erreur d'analyse audio", "error": str(e)}
