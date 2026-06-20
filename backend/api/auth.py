import os
from fastapi import Header, HTTPException, status

# Token public pour les requêtes non authentifiées (extension grand public)
PUBLIC_TOKEN = "public"

# Tokens B2B chargés depuis l'env (liste séparée par virgules)
_VALID_TOKENS: set[str] = set(
    filter(None, os.getenv("API_TOKENS", "").split(","))
)
_VALID_TOKENS.add(PUBLIC_TOKEN)


async def verify_token(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token manquant")
    token = authorization.removeprefix("Bearer ").strip()
    if token not in _VALID_TOKENS:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide")
    return token
