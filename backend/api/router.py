import json
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from starlette.concurrency import run_in_threadpool

from api.auth import verify_token, verify_admin
from api.limiter import limiter
from api.mailer import send_report
from api import keys as keymgr
from api.schemas import (
    VerifyRequest, VerifyResponse, BlacklistResponse,
    ReportRequest, ReportResponse,
    KeyCreateRequest, KeyCreateResponse, UsageResponse,
    SendReportRequest, BlacklistAddRequest, OfficialAccountRequest,
)
from modules.media import MediaModule
from modules.info import InfoModule
from modules.link import LinkModule
from modules.account import AccountModule
from db.blacklist import get_blacklist_entries, add_to_blacklist
from db import admin as adminmgr
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
async def verify(
    request: Request,
    body: VerifyRequest,
    background_tasks: BackgroundTasks,
    auth: dict = Depends(verify_token),
    x_client_id: str | None = Header(default=None),
):
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

    score = _aggregate_score(modules)
    level = _score_to_level(score)

    # Journalisation enrichie en tâche de fond (géoloc IP non bloquante)
    fwd = request.headers.get("x-forwarded-for", "")
    ip = fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else None)
    ua = request.headers.get("user-agent")
    background_tasks.add_task(
        keymgr.record_event, auth["token"], "verify",
        ip, x_client_id, body.source, body.type.value, level, ua,
    )

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


@router.post("/send-report")
@limiter.limit("5/minute")
async def send_report_endpoint(request: Request, body: SendReportRequest):
    if "@" not in body.to:
        raise HTTPException(status_code=400, detail="Adresse email invalide")
    try:
        await run_in_threadpool(send_report, body.to, body.url, body.date, body.results)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Envoi échoué : {e}")


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


# ---------- Back-office : statistiques, signalements, listes ----------

@router.get("/admin/stats", dependencies=[Depends(verify_admin)])
async def admin_stats():
    return adminmgr.get_stats()


@router.get("/admin/analytics", dependencies=[Depends(verify_admin)])
async def admin_analytics():
    return adminmgr.get_analytics()


@router.get("/admin/users", dependencies=[Depends(verify_admin)])
async def admin_users(limit: int = 200):
    return {"users": adminmgr.list_users(min(limit, 1000))}


@router.get("/admin/users/{uid}", dependencies=[Depends(verify_admin)])
async def admin_user_detail(uid: str):
    return {"events": adminmgr.user_detail(uid)}


@router.get("/admin/providers", dependencies=[Depends(verify_admin)])
async def admin_providers():
    import os

    def on(*keys):
        return all(bool(os.getenv(k)) for k in keys)

    return {
        "providers": {
            "anthropic":      on("ANTHROPIC_API_KEY"),
            "safe_browsing":  on("GOOGLE_SAFE_BROWSING_KEY"),
            "sightengine":    on("SIGHTENGINE_USER", "SIGHTENGINE_SECRET"),
            "smtp":           on("SMTP_HOST", "SMTP_USER", "SMTP_PASS"),
            "database":       on("DATABASE_URL"),
        },
        "model": os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001"),
        "version": "1.0.0",
    }


@router.get("/admin/reports", dependencies=[Depends(verify_admin)])
async def admin_reports(limit: int = 100):
    return {"reports": adminmgr.list_reports(min(limit, 500))}


@router.get("/admin/blacklist", dependencies=[Depends(verify_admin)])
async def admin_blacklist():
    return {"entries": adminmgr.list_blacklist()}


@router.post("/admin/blacklist", dependencies=[Depends(verify_admin)])
async def admin_blacklist_add(body: BlacklistAddRequest):
    await add_to_blacklist(body.url, reason=body.reason or "admin", reported_by="admin")
    return {"ok": True}


@router.delete("/admin/blacklist", dependencies=[Depends(verify_admin)])
async def admin_blacklist_remove(url: str):
    return {"removed": adminmgr.remove_blacklist(url)}


@router.get("/admin/official-accounts", dependencies=[Depends(verify_admin)])
async def admin_official_accounts():
    return {"accounts": adminmgr.list_official_accounts()}


@router.post("/admin/official-accounts", dependencies=[Depends(verify_admin)])
async def admin_official_account_add(body: OfficialAccountRequest):
    adminmgr.add_official_account(body.name, body.title or "", body.source_url or "")
    return {"ok": True}


@router.delete("/admin/official-accounts/{account_id}", dependencies=[Depends(verify_admin)])
async def admin_official_account_remove(account_id: int):
    return {"removed": adminmgr.remove_official_account(account_id)}


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
