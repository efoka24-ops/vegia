"""
Authentification par clé API (Bearer).

- "public"          → extension grand public (quota par IP via le rate-limiter)
- "vig_..."         → partenaire (clé en base, quota mensuel optionnel)
- ADMIN_TOKEN (env) → endpoints d'administration des clés
"""
import os

from fastapi import Header, HTTPException, status

from api.keys import lookup_key, usage_count


async def verify_token(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token manquant")

    token = authorization.removeprefix("Bearer ").strip()
    info = lookup_key(token)
    if info is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide")

    # Quota mensuel (clés partenaires uniquement)
    quota = info.get("monthly_quota")
    if quota is not None and usage_count(token) >= quota:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Quota mensuel dépassé",
        )

    return {"token": token, **info}


async def verify_admin(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès administrateur requis")
    token = authorization.removeprefix("Bearer ").strip()

    # Super-admin via variable d'environnement
    env = os.getenv("ADMIN_TOKEN")
    if env and token == env:
        return {"username": "superadmin", "role": "superadmin"}

    # Admins en base (multi-admins & rôles)
    from api.admins import lookup_admin
    info = lookup_admin(token)
    if info:
        return {"username": info["username"], "role": info["role"]}

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès administrateur requis")

