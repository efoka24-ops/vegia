"""
Fournisseurs externes (APIs tierces) pour les modules de vérification.

Chaque fonction est *best-effort* : si la clé n'est pas configurée ou si l'appel
échoue, elle renvoie ``None`` et le module appelant retombe sur son heuristique.
Aucune dépendance ML lourde — uniquement des appels HTTP via httpx.
"""
from __future__ import annotations

import json
import os
from typing import Optional

import httpx

TIMEOUT = 10.0

# --------------------------------------------------------------------------- #
# Géolocalisation IP (analytique) — ip-api.com (gratuit, sans clé)
# --------------------------------------------------------------------------- #
_geo_cache: dict[str, dict] = {}


def resolve_geo(ip: Optional[str]) -> dict:
    """Renvoie {country, country_code, city} pour une IP publique, {} sinon. Mis en cache."""
    if not ip:
        return {}
    if ip in ("127.0.0.1", "::1") or ip.startswith(("10.", "192.168.", "172.", "100.64.", "fc", "fe80")):
        return {}
    if ip in _geo_cache:
        return _geo_cache[ip]
    geo: dict = {}
    try:
        with httpx.Client(timeout=4.0) as client:
            resp = client.get(
                f"http://ip-api.com/json/{ip}",
                params={"fields": "status,country,countryCode,city"},
            )
        data = resp.json()
        if data.get("status") == "success":
            geo = {
                "country": data.get("country"),
                "country_code": data.get("countryCode"),
                "city": data.get("city"),
            }
    except Exception:
        geo = {}
    _geo_cache[ip] = geo
    return geo


# --------------------------------------------------------------------------- #
# Vérif-Lien — Google Safe Browsing v4
# --------------------------------------------------------------------------- #
async def safe_browsing_lookup(url: str) -> Optional[dict]:
    """Renvoie {'threat': <type>} si l'URL est signalée, {} si saine, None si indisponible."""
    key = os.getenv("GOOGLE_SAFE_BROWSING_KEY")
    if not key:
        return None

    payload = {
        "client": {"clientId": "vigia", "clientVersion": "1.0"},
        "threatInfo": {
            "threatTypes": [
                "MALWARE",
                "SOCIAL_ENGINEERING",
                "UNWANTED_SOFTWARE",
                "POTENTIALLY_HARMFUL_APPLICATION",
            ],
            "platformTypes": ["ANY_PLATFORM"],
            "threatEntryTypes": ["URL"],
            "threatEntries": [{"url": url}],
        },
    }
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                "https://safebrowsing.googleapis.com/v4/threatMatches:find",
                params={"key": key},
                json=payload,
            )
        resp.raise_for_status()
        data = resp.json()
        matches = data.get("matches")
        if matches:
            return {"threat": matches[0].get("threatType", "MALWARE")}
        return {}
    except Exception:
        return None


# --------------------------------------------------------------------------- #
# Vérif-Média — Sightengine (détection deepfake / contenu généré par IA)
# --------------------------------------------------------------------------- #
async def sightengine_check_image(image_url: str) -> Optional[float]:
    """Renvoie une probabilité [0,1] que l'image soit générée/manipulée par IA, ou None."""
    user = os.getenv("SIGHTENGINE_USER")
    secret = os.getenv("SIGHTENGINE_SECRET")
    if not (user and secret):
        return None

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                "https://api.sightengine.com/1.0/check.json",
                params={
                    "url": image_url,
                    "models": "genai",
                    "api_user": user,
                    "api_secret": secret,
                },
            )
        resp.raise_for_status()
        data = resp.json()
        # Sightengine renvoie type.ai_generated dans [0,1]
        return float(data.get("type", {}).get("ai_generated", 0.0))
    except Exception:
        return None


# --------------------------------------------------------------------------- #
# Vérif-Info — Claude (Anthropic) pour l'analyse de désinformation
# --------------------------------------------------------------------------- #
async def anthropic_classify_text(text: str) -> Optional[dict]:
    """
    Analyse un texte et renvoie {'risk': float, 'label': str, 'reason': str} ou None.
    Utilise l'API Messages d'Anthropic (modèle léger par défaut).
    """
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        return None

    model = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
    system = (
        "Tu es un analyste de désinformation pour le contexte camerounais et africain. "
        "Évalue le texte fourni et réponds UNIQUEMENT en JSON strict, sans markdown, "
        'au format : {"risk": <nombre 0 à 1>, "label": "<résumé court en français>", '
        '"reason": "<justification en une phrase>"}. '
        "risk proche de 1 = forte probabilité de désinformation, arnaque, ou sensationnalisme trompeur ; "
        "proche de 0 = contenu neutre / factuel."
    )
    body = {
        "model": model,
        "max_tokens": 400,
        "system": system,
        "messages": [{"role": "user", "content": text[:4000]}],
    }
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json=body,
            )
        resp.raise_for_status()
        data = resp.json()
        raw = "".join(
            block.get("text", "")
            for block in data.get("content", [])
            if block.get("type") == "text"
        ).strip()
        parsed = json.loads(raw)
        risk = float(parsed.get("risk", 0.0))
        return {
            "risk": max(0.0, min(1.0, risk)),
            "label": str(parsed.get("label", "")),
            "reason": str(parsed.get("reason", "")),
        }
    except Exception:
        return None
