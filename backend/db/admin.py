"""Helpers du back-office (statistiques, signalements, liste noire, comptes officiels)."""
from __future__ import annotations

from sqlalchemy import text

from db.session import get_db_connection


def get_stats() -> dict:
    out = {"verifications_30d": 0, "active_keys": 0, "reports": 0, "blacklist": 0, "official_accounts": 0}
    try:
        with get_db_connection() as conn:
            out["verifications_30d"] = conn.execute(text(
                "SELECT COUNT(*) FROM api_usage WHERE endpoint = 'verify' "
                "AND created_at > NOW() - INTERVAL '30 days'"
            )).scalar() or 0
            out["active_keys"] = conn.execute(text(
                "SELECT COUNT(*) FROM api_keys WHERE active = TRUE"
            )).scalar() or 0
            out["reports"] = conn.execute(text("SELECT COUNT(*) FROM reports")).scalar() or 0
            out["blacklist"] = conn.execute(text("SELECT COUNT(*) FROM blacklist_urls")).scalar() or 0
            out["official_accounts"] = conn.execute(text("SELECT COUNT(*) FROM official_accounts")).scalar() or 0
    except Exception:
        pass
    return out


def get_analytics() -> dict:
    out = {"unique_users": 0, "total_verifs": 0, "by_country": [], "by_platform": [], "by_level": [], "recent": []}
    try:
        with get_db_connection() as conn:
            out["unique_users"] = conn.execute(text(
                "SELECT COUNT(DISTINCT COALESCE(client_id, ip)) FROM api_usage WHERE endpoint = 'verify'"
            )).scalar() or 0
            out["total_verifs"] = conn.execute(text(
                "SELECT COUNT(*) FROM api_usage WHERE endpoint = 'verify'"
            )).scalar() or 0
            out["by_country"] = [
                {"country": r[0] or "Inconnu", "code": r[1], "count": r[2]}
                for r in conn.execute(text(
                    "SELECT country, country_code, COUNT(*) c FROM api_usage WHERE endpoint='verify' "
                    "GROUP BY country, country_code ORDER BY c DESC LIMIT 30"
                )).fetchall()
            ]
            out["by_platform"] = [
                {"source": r[0] or "inconnu", "count": r[1]}
                for r in conn.execute(text(
                    "SELECT source, COUNT(*) c FROM api_usage WHERE endpoint='verify' "
                    "GROUP BY source ORDER BY c DESC"
                )).fetchall()
            ]
            out["by_level"] = [
                {"level": r[0] or "—", "count": r[1]}
                for r in conn.execute(text(
                    "SELECT level, COUNT(*) c FROM api_usage WHERE endpoint='verify' "
                    "GROUP BY level ORDER BY c DESC"
                )).fetchall()
            ]
            out["recent"] = [
                {"time": str(r[0]), "country": r[1], "city": r[2], "source": r[3], "ctype": r[4], "level": r[5]}
                for r in conn.execute(text(
                    "SELECT created_at, country, city, source, ctype, level FROM api_usage "
                    "WHERE endpoint='verify' ORDER BY created_at DESC LIMIT 50"
                )).fetchall()
            ]
    except Exception:
        pass
    return out


def list_reports(limit: int = 100) -> list[dict]:
    with get_db_connection() as conn:
        rows = conn.execute(text(
            "SELECT id, content_url, result, reporter_ip, created_at "
            "FROM reports ORDER BY created_at DESC LIMIT :l"
        ), {"l": limit}).fetchall()
    return [
        {"id": r[0], "content_url": r[1], "result": r[2], "reporter_ip": r[3], "created_at": str(r[4])}
        for r in rows
    ]


def list_blacklist() -> list[dict]:
    with get_db_connection() as conn:
        rows = conn.execute(text(
            "SELECT id, url, reason, reported_by, created_at FROM blacklist_urls ORDER BY created_at DESC"
        )).fetchall()
    return [
        {"id": r[0], "url": r[1], "reason": r[2], "reported_by": r[3], "created_at": str(r[4])}
        for r in rows
    ]


def remove_blacklist(url: str) -> bool:
    with get_db_connection() as conn:
        res = conn.execute(text("DELETE FROM blacklist_urls WHERE url = :u"), {"u": url})
        conn.commit()
    return res.rowcount > 0


def list_official_accounts() -> list[dict]:
    with get_db_connection() as conn:
        rows = conn.execute(text(
            "SELECT id, name, title, source_url, verified_by, created_at "
            "FROM official_accounts ORDER BY name"
        )).fetchall()
    return [
        {"id": r[0], "name": r[1], "title": r[2], "source_url": r[3], "verified_by": r[4], "created_at": str(r[5])}
        for r in rows
    ]


def add_official_account(name: str, title: str = "", source_url: str = "", verified_by: str = "admin") -> None:
    with get_db_connection() as conn:
        conn.execute(text(
            "INSERT INTO official_accounts (name, title, embedding, source_url, verified_by) "
            "VALUES (:n, :t, '', :s, :v)"
        ), {"n": name, "t": title, "s": source_url, "v": verified_by})
        conn.commit()


def remove_official_account(account_id: int) -> bool:
    with get_db_connection() as conn:
        res = conn.execute(text("DELETE FROM official_accounts WHERE id = :id"), {"id": account_id})
        conn.commit()
    return res.rowcount > 0
