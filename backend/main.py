# Backend FastAPI VigIA — déployé via le Dockerfile racine (build Python forcé).
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from api.limiter import limiter
from api.router import router
from db.session import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="VigIA API",
    version="1.0.0",
    description=(
        "API de vérification de contenus VigIA : détection de deepfakes, "
        "désinformation, liens malveillants et usurpation de comptes. "
        "Authentification par clé Bearer. Voir /docs pour l'intégration."
    ),
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS : extensions navigateur + origines partenaires (configurables via env)
_extra = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^(chrome-extension|moz-extension)://.*$",
    allow_origins=_extra or ["*"],
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")
