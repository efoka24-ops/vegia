from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from api.router import router
from db.session import init_db


limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="VigIA API",
    version="0.1.0",
    description="API de vérification de contenus pour l'extension VigIA",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["chrome-extension://*", "moz-extension://*"],
    allow_methods=["POST", "GET"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(router, prefix="/api/v1")
