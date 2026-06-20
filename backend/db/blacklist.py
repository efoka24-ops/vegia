from sqlalchemy import text
from db.session import get_db_connection


async def get_blacklist_entries() -> list[str]:
    with get_db_connection() as conn:
        rows = conn.execute(text("SELECT url FROM blacklist_urls")).fetchall()
    return [row[0] for row in rows]


async def add_to_blacklist(url: str, reason: str = "", reported_by: str = "") -> None:
    with get_db_connection() as conn:
        conn.execute(
            text("INSERT INTO blacklist_urls (url, reason, reported_by) VALUES (:url, :reason, :by) ON CONFLICT DO NOTHING"),
            {"url": url, "reason": reason, "by": reported_by},
        )
        conn.commit()
