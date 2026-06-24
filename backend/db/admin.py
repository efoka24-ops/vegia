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


def get_dashboard() -> dict:
    out = {"v24": 0, "v24_trend": None, "v7": 0, "v7_trend": None, "v30": 0,
           "users": 0, "alerts": 0, "alert_rate": 0, "donut": [], "series": []}
    try:
        with get_db_connection() as conn:
            def cnt(where):
                return conn.execute(text(f"SELECT COUNT(*) FROM api_usage WHERE endpoint='verify' AND {where}")).scalar() or 0

            out["v24"] = cnt("created_at > NOW() - INTERVAL '24 hours'")
            v24p = cnt("created_at BETWEEN NOW() - INTERVAL '48 hours' AND NOW() - INTERVAL '24 hours'")
            out["v7"] = cnt("created_at > NOW() - INTERVAL '7 days'")
            v7p = cnt("created_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'")
            out["v30"] = cnt("created_at > NOW() - INTERVAL '30 days'")
            out["alerts"] = cnt("level='red'")
            total = cnt("TRUE")
            out["users"] = conn.execute(text(
                "SELECT COUNT(DISTINCT COALESCE(client_id, ip)) FROM api_usage WHERE endpoint='verify'"
            )).scalar() or 0
            out["alert_rate"] = round(100.0 * out["alerts"] / total, 1) if total else 0

            def trend(cur, prev):
                if not prev:
                    return None
                return round(100.0 * (cur - prev) / prev, 0)
            out["v24_trend"] = trend(out["v24"], v24p)
            out["v7_trend"] = trend(out["v7"], v7p)

            out["donut"] = [
                {"level": r[0] or "—", "count": r[1]}
                for r in conn.execute(text(
                    "SELECT level, COUNT(*) c FROM api_usage WHERE endpoint='verify' GROUP BY level"
                )).fetchall()
            ]
            out["series"] = [
                {"day": str(r[0]), "count": r[1], "alerts": r[2]}
                for r in conn.execute(text(
                    "SELECT (created_at AT TIME ZONE 'Africa/Douala')::date d, COUNT(*) c, "
                    "COUNT(*) FILTER (WHERE level='red') a FROM api_usage "
                    "WHERE endpoint='verify' AND created_at > NOW() - INTERVAL '14 days' GROUP BY d ORDER BY d"
                )).fetchall()
            ]
    except Exception:
        pass
    return out


def get_alerts(threshold: int = 3) -> dict:
    out = {"threshold": threshold, "spikes": []}
    try:
        with get_db_connection() as conn:
            rows = conn.execute(text(
                "SELECT city, country, COUNT(*) c FROM api_usage "
                "WHERE endpoint='verify' AND level='red' AND created_at > NOW() - INTERVAL '24 hours' "
                "AND city IS NOT NULL GROUP BY city, country HAVING COUNT(*) >= :t ORDER BY c DESC LIMIT 20"
            ), {"t": threshold}).fetchall()
        out["spikes"] = [{"city": r[0], "country": r[1], "alerts_24h": r[2]} for r in rows]
    except Exception:
        pass
    return out


def get_analytics() -> dict:
    out = {"unique_users": 0, "total_verifs": 0, "by_country": [], "by_platform": [],
           "by_level": [], "by_type": [], "by_city": [], "by_hour": [], "by_day": [], "recent": []}
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
            out["by_type"] = [
                {"type": (r[0] or "").replace("ContentType.", "") or "—", "count": r[1]}
                for r in conn.execute(text(
                    "SELECT ctype, COUNT(*) c FROM api_usage WHERE endpoint='verify' "
                    "GROUP BY ctype ORDER BY c DESC"
                )).fetchall()
            ]
            out["by_city"] = [
                {"city": r[0] or "Inconnu", "count": r[1]}
                for r in conn.execute(text(
                    "SELECT city, COUNT(*) c FROM api_usage WHERE endpoint='verify' "
                    "GROUP BY city ORDER BY c DESC LIMIT 20"
                )).fetchall()
            ]
            out["by_hour"] = [
                {"hour": int(r[0]), "count": r[1]}
                for r in conn.execute(text(
                    "SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'Africa/Douala')::int h, COUNT(*) c "
                    "FROM api_usage WHERE endpoint='verify' GROUP BY h ORDER BY h"
                )).fetchall()
            ]
            out["by_day"] = [
                {"day": str(r[0]), "count": r[1]}
                for r in conn.execute(text(
                    "SELECT (created_at AT TIME ZONE 'Africa/Douala')::date d, COUNT(*) c "
                    "FROM api_usage WHERE endpoint='verify' AND created_at > NOW() - INTERVAL '14 days' "
                    "GROUP BY d ORDER BY d"
                )).fetchall()
            ]
            out["recent"] = [
                {"time": str(r[0]), "country": r[1], "city": r[2], "source": r[3],
                 "ctype": (r[4] or "").replace("ContentType.", ""), "level": r[5]}
                for r in conn.execute(text(
                    "SELECT created_at, country, city, source, ctype, level FROM api_usage "
                    "WHERE endpoint='verify' ORDER BY created_at DESC LIMIT 50"
                )).fetchall()
            ]
    except Exception:
        pass
    return out


def list_users(limit: int = 200) -> list[dict]:
    """Un enregistrement par utilisateur (identifiant d'installation), avec détails."""
    try:
        with get_db_connection() as conn:
            rows = conn.execute(text(
                """
                SELECT
                    COALESCE(client_id, ip)              AS uid,
                    MIN(created_at)                       AS first_seen,
                    MAX(created_at)                       AS last_seen,
                    COUNT(*)                              AS verifs,
                    COUNT(*) FILTER (WHERE level='red')   AS alerts,
                    MAX(country)                          AS country,
                    MAX(country_code)                     AS country_code,
                    MAX(city)                             AS city,
                    MAX(ip)                               AS ip,
                    MAX(user_agent)                       AS user_agent,
                    STRING_AGG(DISTINCT source, ', ')     AS platforms
                FROM api_usage
                WHERE endpoint = 'verify' AND COALESCE(client_id, ip) IS NOT NULL
                GROUP BY COALESCE(client_id, ip)
                ORDER BY last_seen DESC
                LIMIT :l
                """
            ), {"l": limit}).fetchall()
        return [
            {
                "uid": r[0], "first_seen": str(r[1]), "last_seen": str(r[2]),
                "verifs": r[3], "alerts": r[4], "country": r[5], "country_code": r[6],
                "city": r[7], "ip": r[8], "user_agent": r[9], "platforms": r[10],
            }
            for r in rows
        ]
    except Exception:
        return []


def user_detail(uid: str, limit: int = 50) -> list[dict]:
    try:
        with get_db_connection() as conn:
            rows = conn.execute(text(
                "SELECT created_at, source, ctype, level, city, country FROM api_usage "
                "WHERE endpoint='verify' AND COALESCE(client_id, ip) = :u "
                "ORDER BY created_at DESC LIMIT :l"
            ), {"u": uid, "l": limit}).fetchall()
        return [
            {"time": str(r[0]), "source": r[1], "ctype": (r[2] or "").replace("ContentType.", ""),
             "level": r[3], "city": r[4], "country": r[5]}
            for r in rows
        ]
    except Exception:
        return []


def get_quiz(n: int = 8, domain: str | None = None) -> list[dict]:
    try:
        with get_db_connection() as conn:
            if domain:
                rows = conn.execute(text(
                    "SELECT id, domain, question, options, answer, explain FROM quiz_questions "
                    "WHERE active = TRUE AND domain = :d ORDER BY RANDOM() LIMIT :n"
                ), {"d": domain, "n": n}).fetchall()
            else:
                rows = conn.execute(text(
                    "SELECT id, domain, question, options, answer, explain FROM quiz_questions "
                    "WHERE active = TRUE ORDER BY RANDOM() LIMIT :n"
                ), {"n": n}).fetchall()
        return [
            {"id": r[0], "domain": r[1], "question": r[2], "options": r[3], "answer": r[4], "explain": r[5]}
            for r in rows
        ]
    except Exception:
        return []


def list_quiz() -> list[dict]:
    with get_db_connection() as conn:
        rows = conn.execute(text(
            "SELECT id, domain, question, options, answer, explain, active FROM quiz_questions ORDER BY id DESC"
        )).fetchall()
    return [
        {"id": r[0], "domain": r[1], "question": r[2], "options": r[3], "answer": r[4], "explain": r[5], "active": r[6]}
        for r in rows
    ]


def add_quiz(domain, question, options, answer, explain) -> None:
    import json as _json
    with get_db_connection() as conn:
        conn.execute(text(
            "INSERT INTO quiz_questions (domain, question, options, answer, explain) "
            "VALUES (:d, :q, CAST(:o AS JSONB), :a, :e)"
        ), {"d": domain, "q": question, "o": _json.dumps(options), "a": answer, "e": explain})
        conn.commit()


def delete_quiz(qid: int) -> bool:
    with get_db_connection() as conn:
        res = conn.execute(text("DELETE FROM quiz_questions WHERE id = :id"), {"id": qid})
        conn.commit()
    return res.rowcount > 0


def save_feedback(request_id, level, ctype, source, correct, comment, client_id) -> None:
    try:
        with get_db_connection() as conn:
            conn.execute(text(
                "INSERT INTO feedback (request_id, level, ctype, source, correct, comment, client_id) "
                "VALUES (:r, :l, :c, :s, :ok, :cm, :cid)"
            ), {"r": request_id, "l": level, "c": (ctype or "").replace("ContentType.", ""),
                "s": source, "ok": correct, "cm": comment, "cid": client_id})
            conn.commit()
    except Exception:
        pass


def get_feedback(limit: int = 100) -> dict:
    out = {"total": 0, "correct": 0, "incorrect": 0, "accuracy": None, "recent": []}
    try:
        with get_db_connection() as conn:
            out["total"] = conn.execute(text("SELECT COUNT(*) FROM feedback")).scalar() or 0
            out["correct"] = conn.execute(text("SELECT COUNT(*) FROM feedback WHERE correct = TRUE")).scalar() or 0
            out["incorrect"] = out["total"] - out["correct"]
            if out["total"]:
                out["accuracy"] = round(100.0 * out["correct"] / out["total"], 1)
            out["recent"] = [
                {"time": str(r[0]), "level": r[1], "ctype": r[2], "source": r[3], "correct": r[4], "comment": r[5]}
                for r in conn.execute(text(
                    "SELECT created_at, level, ctype, source, correct, comment FROM feedback "
                    "ORDER BY created_at DESC LIMIT :l"
                ), {"l": limit}).fetchall()
            ]
    except Exception:
        pass
    return out


# ---------- Carte publique des menaces (agrégée, anonymisée) ----------

def get_threat_map() -> dict:
    out = {"by_city": [], "by_country": [], "recent_scams": [], "total_alerts": 0}
    try:
        with get_db_connection() as conn:
            out["total_alerts"] = conn.execute(text(
                "SELECT COUNT(*) FROM api_usage WHERE endpoint='verify' AND level='red'"
            )).scalar() or 0
            out["by_city"] = [
                {"city": r[0] or "Inconnu", "country": r[1], "code": r[2],
                 "lat": float(r[3]) if r[3] is not None else None,
                 "lon": float(r[4]) if r[4] is not None else None, "alerts": r[5]}
                for r in conn.execute(text(
                    "SELECT city, country, country_code, AVG(lat), AVG(lon), COUNT(*) c FROM api_usage "
                    "WHERE endpoint='verify' AND level='red' GROUP BY city, country, country_code "
                    "ORDER BY c DESC LIMIT 50"
                )).fetchall()
            ]
            out["by_country"] = [
                {"country": r[0] or "Inconnu", "code": r[1], "alerts": r[2]}
                for r in conn.execute(text(
                    "SELECT country, country_code, COUNT(*) c FROM api_usage "
                    "WHERE endpoint='verify' AND level='red' GROUP BY country, country_code ORDER BY c DESC LIMIT 30"
                )).fetchall()
            ]
            # Types de menaces récentes (agrégées, sans contenu personnel)
            out["recent_scams"] = [
                {"type": (r[0] or "").replace("ContentType.", ""), "source": r[1], "city": r[2], "time": str(r[3])}
                for r in conn.execute(text(
                    "SELECT ctype, source, city, created_at FROM api_usage "
                    "WHERE endpoint='verify' AND level='red' ORDER BY created_at DESC LIMIT 30"
                )).fetchall()
            ]
    except Exception:
        pass
    return out


# ---------- VigIA Verified ----------

def save_verified_request(name, category, official_url, contact) -> None:
    with get_db_connection() as conn:
        conn.execute(text(
            "INSERT INTO verified_requests (name, category, official_url, contact) "
            "VALUES (:n, :c, :u, :ct)"
        ), {"n": name, "c": category, "u": official_url, "ct": contact})
        conn.commit()


def list_verified_requests() -> list[dict]:
    with get_db_connection() as conn:
        rows = conn.execute(text(
            "SELECT id, name, category, official_url, contact, status, created_at "
            "FROM verified_requests ORDER BY created_at DESC"
        )).fetchall()
    return [
        {"id": r[0], "name": r[1], "category": r[2], "official_url": r[3],
         "contact": r[4], "status": r[5], "created_at": str(r[6])}
        for r in rows
    ]


def approve_verified_request(req_id: int) -> bool:
    with get_db_connection() as conn:
        row = conn.execute(text(
            "SELECT name, category, official_url FROM verified_requests WHERE id = :id"
        ), {"id": req_id}).fetchone()
        if not row:
            return False
        conn.execute(text(
            "INSERT INTO official_accounts (name, title, embedding, source_url, verified_by) "
            "VALUES (:n, :t, '', :u, 'VigIA Verified')"
        ), {"n": row[0], "t": row[1] or "", "u": row[2] or ""})
        conn.execute(text("UPDATE verified_requests SET status='approved' WHERE id = :id"), {"id": req_id})
        conn.commit()
    return True


def reject_verified_request(req_id: int) -> bool:
    with get_db_connection() as conn:
        res = conn.execute(text("UPDATE verified_requests SET status='rejected' WHERE id = :id"), {"id": req_id})
        conn.commit()
    return res.rowcount > 0


def check_verified(name: str) -> dict:
    try:
        with get_db_connection() as conn:
            row = conn.execute(text(
                "SELECT name, title FROM official_accounts WHERE LOWER(name) = LOWER(:n) LIMIT 1"
            ), {"n": name}).fetchone()
        if row:
            return {"verified": True, "name": row[0], "title": row[1]}
    except Exception:
        pass
    return {"verified": False}


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
