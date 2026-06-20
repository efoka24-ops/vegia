"""
Module Vérif-Lien — détection de phishing et arnaques.

Classifieur scikit-learn (RandomForest) entraîné sur des features heuristiques d'URL.
Modèle attendu : models/phishing_classifier.pkl
"""
from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urlparse

import joblib
import redis
import os

MODEL_PATH = Path("models/phishing_classifier.pkl")

SHORT_URL_PATTERN = re.compile(r"bit\.ly|tinyurl|ow\.ly|t\.co|goo\.gl|rb\.gy", re.I)
IP_PATTERN        = re.compile(r"\d{1,3}(\.\d{1,3}){3}")
URGENT_WORDS      = {"login", "verify", "account", "secure", "update", "confirm", "bank", "password"}


class LinkModule:
    def __init__(self):
        self._clf   = None
        self._redis = redis.Redis(
            host=os.getenv("REDIS_HOST", "localhost"),
            port=int(os.getenv("REDIS_PORT", 6379)),
            db=0,
            decode_responses=True,
        )

    def _load_model(self):
        if self._clf:
            return
        if MODEL_PATH.exists():
            self._clf = joblib.load(MODEL_PATH)

    async def analyze(self, url: str) -> dict:
        try:
            # 1. Liste noire Redis
            if self._redis.sismember("blacklist:urls", url):
                return {"score": 1.0, "label": "lien présent dans la liste noire"}

            # 2. Classifieur ML
            self._load_model()
            features = self._extract_features(url)

            if self._clf:
                prob = float(self._clf.predict_proba([features])[0][1])
            else:
                # Fallback heuristique si le modèle n'est pas encore entraîné
                prob = self._heuristic_score(features)

            if prob >= 0.70:
                label = "lien probablement malveillant"
            elif prob >= 0.35:
                label = "lien douteux — vérifiez avant de cliquer"
            else:
                label = "lien a priori sûr"

            return {"score": round(prob, 3), "label": label}

        except Exception as e:
            return {"score": None, "label": "erreur d'analyse du lien", "error": str(e)}

    def _extract_features(self, url: str) -> list:
        parsed = urlparse(url)
        netloc = parsed.netloc or ""
        path   = parsed.path   or ""
        lower  = url.lower()

        return [
            len(url),                                                       # longueur totale
            lower.count("."),                                               # nb de points
            lower.count("-"),                                               # nb de tirets
            lower.count("@"),                                               # présence @
            1 if IP_PATTERN.search(netloc) else 0,                         # IP brute
            1 if any(w in lower for w in URGENT_WORDS) else 0,             # mots urgence
            1 if parsed.scheme == "https" else 0,                          # HTTPS
            len(netloc),                                                    # longueur domaine
            lower.count("/"),                                               # profondeur chemin
            1 if SHORT_URL_PATTERN.search(netloc) else 0,                  # raccourcisseur
            lower.count("="),                                               # nb de paramètres
            1 if len(path) > 100 else 0,                                   # chemin très long
        ]

    def _heuristic_score(self, features: list) -> float:
        # features[4]=IP, [5]=mots urgence, [9]=raccourcisseur, [3]=@
        risk = features[4] * 0.4 + features[5] * 0.3 + features[9] * 0.2 + features[3] * 0.1
        return min(risk, 1.0)
