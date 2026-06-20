import uuid

from fastapi import APIRouter, Depends, Request
from slowapi.decorator import limits

from api.auth import verify_token
from api.schemas import VerifyRequest, VerifyResponse, BlacklistResponse
from modules.media import MediaModule
from modules.info import InfoModule
from modules.link import LinkModule
from modules.account import AccountModule
from db.blacklist import get_blacklist_entries

router = APIRouter()

# Modules instanciés une seule fois au démarrage
_media   = MediaModule()
_info    = InfoModule()
_link    = LinkModule()
_account = AccountModule()


@router.post("/verify", response_model=VerifyResponse, dependencies=[Depends(verify_token)])
@limits("30/minute")
async def verify(request: Request, body: VerifyRequest):
    modules: dict = {}

    match body.type:
        case "image":
            modules["media"] = await _media.analyze(str(body.content.image_url))
        case "text":
            modules["info"] = await _info.analyze(body.content.text or "")
        case "url":
            modules["link"] = await _link.analyze(str(body.content.url))
        case "account":
            modules["account"] = await _account.analyze(
                str(body.content.profile_image_url),
                body.content.profile_name or "",
            )

    score = _aggregate_score(modules)
    level = _score_to_level(score)

    return VerifyResponse(
        request_id=str(uuid.uuid4()),
        score=score,
        level=level,
        modules=modules,
        explanation=_build_explanation(modules, level),
        sources=_collect_sources(modules),
    )


@router.get("/blacklist", response_model=BlacklistResponse)
async def blacklist():
    entries = await get_blacklist_entries()
    return BlacklistResponse(entries=entries, count=len(entries))


# ---------- Helpers ----------

def _aggregate_score(modules: dict) -> float:
    scores = [
        v["score"] for v in modules.values()
        if v and v.get("score") is not None
    ]
    return round(max(scores), 3) if scores else 0.0


def _score_to_level(score: float) -> str:
    if score < 0.35:
        return "green"
    if score < 0.70:
        return "orange"
    return "red"


def _build_explanation(modules: dict, level: str) -> str:
    labels = {
        "green":  "Ce contenu ne présente pas de signes de manipulation.",
        "orange": "Ce contenu présente des éléments douteux — vérifiez avant de partager.",
        "red":    "Ce contenu est probablement manipulé ou trompeur.",
    }
    base = labels.get(level, "")

    details = [v["label"] for v in modules.values() if v and v.get("label")]
    if details:
        base += " " + "; ".join(details) + "."
    return base


def _collect_sources(modules: dict) -> list[str]:
    sources: list[str] = []
    for v in modules.values():
        if v and v.get("sources"):
            sources.extend(v["sources"])
    return sources
