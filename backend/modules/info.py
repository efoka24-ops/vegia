"""
Module Vérif-Info — détection de désinformation / sensationnalisme.

Stratégie : Claude (Anthropic) si clé configurée → repli sur heuristiques lexicales.
Aucune dépendance ML : 100 % fonctionnel sans modèle local.
"""
from __future__ import annotations

import re

from modules.providers import anthropic_classify_text

ALERT_WORDS = [
    "urgent", "massif", "choc", "exclusif", "partagez", "partager", "investissement",
    "garanti", "doublez", "gratuit", "gagnez", "miracle", "secret", "scandale",
]

AI_PATTERNS = [
    re.compile(r"il est (important|crucial|essentiel) de", re.I),
    re.compile(r"il convient de (noter|souligner|mentionner)", re.I),
    re.compile(r"en (conclusion|résumé|bref)[,\s]", re.I),
    re.compile(r"dans (ce|cet) contexte", re.I),
    re.compile(r"nous (pouvons|allons|devons) (noter|explorer|examiner)", re.I),
]


class InfoModule:
    async def analyze(self, text: str) -> dict:
        text = (text or "").strip()
        if len(text) < 20:
            return {"score": 0.0, "label": "texte trop court pour analyse"}

        # 1. Fournisseur externe (Claude)
        ai = await anthropic_classify_text(text)
        if ai is not None:
            label = ai["label"] or "analyse de désinformation"
            if ai.get("reason"):
                label = f"{label} — {ai['reason']}"
            return {"score": round(ai["risk"], 3), "label": label}

        # 2. Heuristiques (repli)
        return self._heuristic(text)

    def _heuristic(self, text: str) -> dict:
        lower = text.lower()
        alert_hits = [w for w in ALERT_WORDS if w in lower]
        ai_hits = [p for p in AI_PATTERNS if p.search(text)]
        excl = text.count("!")

        score = min(len(alert_hits) * 0.22 + len(ai_hits) * 0.15 + min(excl, 5) * 0.05, 1.0)

        if score >= 0.70:
            label = "contenu à fort potentiel de désinformation"
        elif score >= 0.35:
            label = "ton inhabituel — à vérifier avant de partager"
        else:
            label = "aucun indicateur de désinformation détecté"

        if alert_hits:
            label += f" (termes d'alerte : {', '.join(alert_hits[:3])})"
        return {"score": round(score, 3), "label": label}
