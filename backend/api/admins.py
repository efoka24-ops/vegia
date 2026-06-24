"""Gestion des administrateurs (multi-admins & rôles), avec cache mémoire."""
from __future__ import annotations

import secrets
import time

from sqlalchemy import text

from db.session import get_db_connection

_cache: dict[str, dict] = {}
_ts: float = 0.0
_TTL = 30.0


def _refresh() -> None:
    global _cache, _ts
    try:
        with get_db_connection() as conn:
            rows = conn.execute(text("SELECT token, username, role, active FROM admins")).fetchall()
        _cache = {r[0]: {"username": r[1], "role": r[2], "active": r[3]} for r in rows}
        _ts = time.time()
    except Exception:
        _ts = time.time()


def lookup_admin(token: str) -> dict | None:
    if time.time() - _ts > _TTL:
        _refresh()
    info = _cache.get(token)
    if info and info.get("active"):
        return info
    return None


def create_admin(username: str, role: str = "admin") -> str:
    token = "vgadm_" + secrets.token_urlsafe(24)
    with get_db_connection() as conn:
        conn.execute(text("INSERT INTO admins (username, token, role) VALUES (:u, :t, :r)"),
                     {"u": username, "t": token, "r": role})
        conn.commit()
    _refresh()
    return token


def list_admins() -> list[dict]:
    with get_db_connection() as conn:
        rows = conn.execute(text(
            "SELECT id, username, role, active, created_at FROM admins ORDER BY created_at"
        )).fetchall()
    return [{"id": r[0], "username": r[1], "role": r[2], "active": r[3], "created_at": str(r[4])} for r in rows]


def revoke_admin(admin_id: int) -> bool:
    with get_db_connection() as conn:
        res = conn.execute(text("UPDATE admins SET active = FALSE WHERE id = :id"), {"id": admin_id})
        conn.commit()
    _refresh()
    return res.rowcount > 0
