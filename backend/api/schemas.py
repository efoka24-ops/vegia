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
