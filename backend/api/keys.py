"""
Gestion des clés API pour l'intégration partenaires.

- Le jeton "public" reste valable pour l'extension grand public (quota IP).
- Les partenaires utilisent une clé `vig_...` créée en base (table api_keys),
  avec un palier (tier) et un quota mensuel.
- Chaque appel est journalisé dans api_usage (best-effort).

Les clés valides sont mises en cache mémoire (TTL court) pour éviter un appel
DB à chaque requête.
"""
from __future__ import annotations

import secrets
import time
from typing import Optional

from sqlalchemy import text

from db.session import get_db_connection

PUBLIC_TOKEN = "public"
_CACHE_TTL = 30.0  # secondes
_cache: dict[str, dict] = {}
_cache_ts: float = 0.0


def generate_key() -> str:
    return "vig_" + secrets.token_urlsafe(32)


def _refresh_cache() -> None:
    global _cache, _cache_ts
    try:
        with get_db_connection() as conn:
            rows = conn.execute(
                text("SELECT key, label, tier, monthly_quota, active FROM api_keys")
            ).fetchall()
        _cache = {
            r[0]: {"label": r[1], "tier": r[2], "monthly_quota": r[3], "active": r[4]}
            for r in rows
        }
        _cache_ts = time.time()
    except Exception:
        # DB indisponible : on garde le cache existant (au pire vide)
        _cache_ts = time.time()


def lookup_key(token: str) -> Optional[dict]:
    """Renvoie les infos de la clé si valide et active, sinon None."""
    if token == PUBLIC_TOKEN:
        return {"label": "public", "tier": "public", "monthly_quota": None, "active": True}

    if time.time() - _cache_ts > _CACHE_TTL:
        _refresh_cache()

    info = _cache.get(token)
    if info and info.get("active"):
        return info
    return None


def create_key(label: str, tier: str = "pro", monthly_quota: Optional[int] = None) -> str:
    key = generate_key()
    with get_db_connection() as conn:
        conn.execute(
            text(
                "INSERT INTO api_keys (key, label, tier, monthly_quota, active) "
                "VALUES (:k, :l, :t, :q, TRUE)"
            ),
            {"k": key, "l": label, "t": tier, "q": monthly_quota},
        )
        conn.commit()
    _refresh_cache()
    return key


def list_keys() -> list[dict]:
    with get_db_connection() as conn:
        rows = conn.execute(
            text(
                "SELECT key, label, tier, monthly_quota, active, created_at "
                "FROM api_keys ORDER BY created_at DESC"
            )
        ).fetchall()
    return [
        {
            "key": r[0][:10] + "…",  # masqué
            "label": r[1],
            "tier": r[2],
            "monthly_quota": r[3],
            "active": r[4],
            "created_at": str(r[5]),
        }
        for r in rows
    ]


def revoke_key(key: str) -> bool:
    with get_db_connection() as conn:
        res = conn.execute(
            text("UPDATE api_keys SET active = FALSE WHERE key = :k"), {"k": key}
        )
        conn.commit()
    _refresh_cache()
    return res.rowcount > 0


def log_usage(token: str, endpoint: str) -> None:
    """Journalise un appel (best-effort, ne lève jamais)."""
    try:
        with get_db_connection() as conn:
            conn.execute(
                text("INSERT INTO api_usage (api_key, endpoint) VALUES (:k, :e)"),
                {"k": token, "e": endpoint},
            )
            conn.commit()
    except Exception:
        pass


def usage_count(token: str, since_days: int = 30) -> int:
    try:
        with get_db_connection() as conn:
            row = conn.execute(
                text(
                    "SELECT COUNT(*) FROM api_usage "
                    "WHERE api_key = :k AND created_at > NOW() - (:d || ' days')::interval"
                ),
                {"k": token, "d": since_days},
            ).fetchone()
        return int(row[0]) if row else 0
    except Exception:
        return 0
