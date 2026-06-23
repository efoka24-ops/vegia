import os
from contextlib import contextmanager

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://vigia:pass@localhost/vigia")

# Railway/Heroku fournissent parfois "postgres://" que SQLAlchemy 2.0 ne reconnaît pas
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


@contextmanager
def get_db_connection():
    with engine.connect() as conn:
        yield conn


async def init_db():
    """Crée les tables si elles n'existent pas (dev/MVP).

    Résilient : si la base est injoignable au démarrage (PostgreSQL non encore
    ajouté), on journalise un avertissement et l'application démarre quand même.
    /health et /verify (heuristique, jeton public) restent fonctionnels ; les
    fonctions dépendant de la base se réactivent dès qu'elle est disponible.
    """
    try:
        _create_tables()
    except Exception as e:
        print(f"[VigIA] ⚠ Base de données indisponible au démarrage : {e}. "
              f"L'API démarre en mode dégradé (sans persistance).")


def _create_tables():
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS official_accounts (
                id          SERIAL PRIMARY KEY,
                name        TEXT NOT NULL,
                title       TEXT,
                embedding   TEXT NOT NULL,
                source_url  TEXT,
                verified_by TEXT,
                created_at  TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS blacklist_urls (
                id         SERIAL PRIMARY KEY,
                url        TEXT NOT NULL UNIQUE,
                reason     TEXT,
                reported_by TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS reports (
                id          SERIAL PRIMARY KEY,
                content_url TEXT,
                result      JSONB,
                reporter_ip TEXT,
                created_at  TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS api_keys (
                id            SERIAL PRIMARY KEY,
                key           TEXT NOT NULL UNIQUE,
                label         TEXT,
                tier          TEXT DEFAULT 'pro',
                monthly_quota INTEGER,
                active        BOOLEAN DEFAULT TRUE,
                created_at    TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS api_usage (
                id         SERIAL PRIMARY KEY,
                api_key    TEXT NOT NULL,
                endpoint   TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_api_usage_key_time ON api_usage (api_key, created_at)"
        ))
        # Colonnes analytiques (idempotent) — suivi d'usage / géolocalisation
        for col, typ in [
            ("client_id", "TEXT"), ("ip", "TEXT"), ("country", "TEXT"),
            ("country_code", "TEXT"), ("city", "TEXT"),
            ("source", "TEXT"), ("ctype", "TEXT"), ("level", "TEXT"),
        ]:
            conn.execute(text(f"ALTER TABLE api_usage ADD COLUMN IF NOT EXISTS {col} {typ}"))
