from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, HttpUrl


class ContentType(str, Enum):
    image   = "image"
    text    = "text"
    url     = "url"
    account = "account"


class ContentPayload(BaseModel):
    image_url:         Optional[HttpUrl] = None
    text:              Optional[str]     = None
    url:               Optional[HttpUrl] = None
    profile_image_url: Optional[HttpUrl] = None
    profile_name:      Optional[str]     = None


class VerifyRequest(BaseModel):
    type:    ContentType
    content: ContentPayload
    source:  Optional[str] = None  # facebook | twitter | whatsapp


class ModuleResult(BaseModel):
    score: Optional[float] = None
    label: str
    sources: Optional[list[str]] = None
    error:   Optional[str]       = None


class VerifyResponse(BaseModel):
    request_id:  str
    score:       Optional[float]
    level:       str  # green | orange | red | error
    modules:     dict[str, Optional[ModuleResult]]
    explanation: str
    sources:     list[str] = []


class BlacklistResponse(BaseModel):
    entries: list[str]
    count:   int


class ReportRequest(BaseModel):
    content_url: Optional[str] = None
    result:      Optional[dict] = None
    blacklist:   bool = False   # ajouter content_url à la liste noire
    reason:      Optional[str] = None


class ReportResponse(BaseModel):
    ok: bool


class KeyCreateRequest(BaseModel):
    label:         str
    tier:          str = "pro"
    monthly_quota: Optional[int] = None


class KeyCreateResponse(BaseModel):
    key:   str
    label: str
    tier:  str


class UsageResponse(BaseModel):
    tier:          str
    monthly_quota: Optional[int] = None
    used_30d:      int


class SendReportRequest(BaseModel):
    to:      str
    url:     Optional[str] = None
    date:    Optional[str] = None
    results: dict = {}


class BlacklistAddRequest(BaseModel):
    url:    str
    reason: Optional[str] = None


class OfficialAccountRequest(BaseModel):
    name:       str
    title:      Optional[str] = None
    source_url: Optional[str] = None


class FeedbackRequest(BaseModel):
    request_id: Optional[str] = None
    level:      Optional[str] = None
    ctype:      Optional[str] = None
    source:     Optional[str] = None
    correct:    bool
    comment:    Optional[str] = None


class VerifiedRequest(BaseModel):
    name:         str
    category:     Optional[str] = None
    official_url: Optional[str] = None
    contact:      Optional[str] = None


class QuizQuestionRequest(BaseModel):
    domain:   Optional[str] = None
    question: str
    options:  list[str]
    answer:   int
    explain:  Optional[str] = None


class AdminCreateRequest(BaseModel):
    username: str
    role:     str = "admin"
