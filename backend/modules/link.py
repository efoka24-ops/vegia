"""
Module Vérif-Lien — détection de phishing et arnaques.

Stratégie : Google Safe Browsing (si clé configurée) → repli sur heuristiques d'URL.
Aucune dépendance ML : 100 % fonctionnel sans modèle entraîné.
"""
from __future__ import annotations

import re
from urllib.parse import urlparse

from modules.providers import safe_browsing_lookup

SHORT_URL_PATTERN = re.compile(r"bit\.ly|tinyurl|ow\.ly|t\.co|goo\.gl|rb\.gy|cutt\.ly", re.I)
IP_PATTERN        = re.compile(r"\d{1,3}(\.\d{1,3}){3}")
SUSPECT_TLD       = re.compile(r"\.(xyz|top|tk|ml|ga|cf|gq|click|loan|work)(/|$|\?)", re.I)
SCAM_PATTERN      = re.compile(
    r"momo|mobile.?money|orange.?money|mtn|verify|confirm|account|secure|"
    r"invest|gratuit|free.?money|bonus|gain|loterie|ponzi|doublez",
    re.I,
)
URGENT_WORDS = {"login", "verify", "account", "secure", "update", "confirm", "bank", "password"}


class LinkModule:
    async def analyze(self, url: str) -> dict:
        try:
            # 1. Fournisseur externe (Google Safe Browsing)
            sb = await safe_browsing_lookup(url)
            if sb is not None and sb.get("threat"):
                return {
                    "score": 0.97,
                    "label": f"lien signalé comme dangereux ({sb['threat'].lower()})",
                    "sources": ["Google Safe Browsing"],
                }

            # 2. Heuristiques (toujours actives, repli si pas de clé / lien sain)
            prob = self._heuristic_score(url)

            if prob >= 0.70:
                label = "lien probablement malveillant"
            elif prob >= 0.35:
                label = "lien douteux — vérifiez avant de cliquer"
            else:
                label = "lien a priori sûr"

            return {"score": round(prob, 3), "label": label}

        except Exception as e:
            return {"score": None, "label": "erreur d'analyse du lien", "error": str(e)}

    def _heuristic_score(self, url: str) -> float:
        parsed = urlparse(url)
        netloc = parsed.netloc or ""
        path   = parsed.path or ""
        lower  = url.lower()

        risk = 0.0
        if IP_PATTERN.search(netloc):              risk += 0.45   # IP brute au lieu d'un domaine
        if SHORT_URL_PATTERN.search(netloc):       risk += 0.25   # raccourcisseur
        if SUSPECT_TLD.search(lower):              risk += 0.30   # TLD à risque
        if SCAM_PATTERN.search(lower):             risk += 0.35   # vocabulaire d'arnaque
        if "@" in netloc:                          risk += 0.30   # leurre userinfo@
        if any(w in lower for w in URGENT_WORDS):  risk += 0.15
        if parsed.scheme != "https":               risk += 0.10
        if netloc.count("-") >= 3:                 risk += 0.10   # domaine truffé de tirets
        if len(path) > 100:                        risk += 0.10

        return min(risk, 1.0)
