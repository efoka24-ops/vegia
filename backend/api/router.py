import json
import uuid

from fastapi import APIRouter, Depends, Request

from api.auth import verify_token, verify_admin
from api.limiter import limiter
from api import keys as keymgr
from api.schemas import (
    VerifyRequest, VerifyResponse, BlacklistResponse,
    ReportRequest, ReportResponse,
    KeyCreateRequest, KeyCreateResponse, UsageResponse,
)
from modules.media import MediaModule
from modules.info import InfoModule
from modules.link import LinkModule
from modules.account import AccountModule
from db.blacklist import get_blacklist_entries, add_to_blacklist
from db.session import get_db_connection
from sqlalchemy import text

router = APIRouter()

# Modules instanciés une seule fois au démarrage
_media   = MediaModule()
_info    = InfoModule()
_link    = LinkModule()
_account = AccountModule()


@router.get("/health")
async def health():
    return {"status": "ok", "service": "vigia-api", "version": "1.0.0"}


@router.post("/verify", response_model=VerifyResponse)
@limiter.limit("30/minute")
async def verify(request: Request, body: VerifyRequest, auth: dict = Depends(verify_token)):
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
                str(body.content.profile_image_url) if body.content.profile_image_url else "",
                body.content.profile_name or "",
            )

    keymgr.log_usage(auth["token"], "verify")

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


@router.post("/report", response_model=ReportResponse)
@limiter.limit("20/minute")
async def report(request: Request, body: ReportRequest):
    try:
        with get_db_connection() as conn:
            conn.execute(
                text(
                    "INSERT INTO reports (content_url, result, reporter_ip) "
                    "VALUES (:u, CAST(:r AS JSONB), :ip)"
                ),
                {
                    "u": body.content_url,
                    "r": (None if body.result is None else json.dumps(body.result)),
                    "ip": request.client.host if request.client else None,
                },
            )
            conn.commit()
    except Exception:
        pass

    if body.blacklist and body.content_url:
        await add_to_blacklist(body.content_url, reason=body.reason or "signalement", reported_by="report")

    return ReportResponse(ok=True)


@router.get("/me", response_model=UsageResponse)
async def me(auth: dict = Depends(verify_token)):
    return UsageResponse(
        tier=auth.get("tier", "public"),
        monthly_quota=auth.get("monthly_quota"),
        used_30d=keymgr.usage_count(auth["token"]),
    )


# ---------- Administration des clés (ADMIN_TOKEN) ----------

@router.post("/admin/keys", response_model=KeyCreateResponse, dependencies=[Depends(verify_admin)])
async def create_key(body: KeyCreateRequest):
    key = keymgr.create_key(body.label, body.tier, body.monthly_quota)
    return KeyCreateResponse(key=key, label=body.label, tier=body.tier)


@router.get("/admin/keys", dependencies=[Depends(verify_admin)])
async def list_keys():
    return {"keys": keymgr.list_keys()}


@router.delete("/admin/keys/{key}", dependencies=[Depends(verify_admin)])
async def revoke_key(key: str):
    return {"revoked": keymgr.revoke_key(key)}


# ---------- Helpers ----------

def _aggregate_score(modules: dict) -> float:
    scores = [v["score"] for v in modules.values() if v and v.get("score") is not None]
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
