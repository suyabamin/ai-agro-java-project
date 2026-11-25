from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

import httpx

from app.schemas.research import ResearchPaper, ResearchSource

_BD_GOV_DOMAINS = (
    "dae.gov.bd",
    "bari.gov.bd",
    "brri.gov.bd",
    "barc.gov.bd",
    "bamis.gov.bd",
    "bau.edu.bd",
    "bsmrau.edu.bd",
    "knowledgebank-brri.org",
    "ais.gov.bd",
    "moa.gov.bd",
)

_INTL_AGRI_DOMAINS = (
    "irri.org",
    "fao.org",
    "cabi.org",
    "cabidigitallibrary.org",
    "plantwise.org",
    "cgiar.org",
    "icrisat.org",
    "cimmyt.org",
    "cipotato.org",
    "usda.gov",
)

_ACADEMIC_DOMAINS = (
    "openalex.org",
    "semanticscholar.org",
    "crossref.org",
    "doi.org",
    "nih.gov",
    "ncbi.nlm.nih.gov",
    "pmc.ncbi.nlm.nih.gov",
    "sciencedirect.com",
    "springer.com",
    "nature.com",
    "wiley.com",
    "frontiersin.org",
    "mdpi.com",
    "tandfonline.com",
    "plos.org",
)


@dataclass(slots=True)
class ProviderOutcome:
    """Normalized outcome returned by any research provider."""

    provider: str
    ok: bool
    reason: str
    papers: list[ResearchPaper] = field(default_factory=list)
    sources: list[ResearchSource] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    error_message: str | None = None


def extract_domain(url: str) -> str:
    try:
        host = urlparse(url).netloc.lower().strip()
        return host[4:] if host.startswith("www.") else host
    except Exception:
        return ""


def classify_domain_tier(url: str) -> tuple[str, str]:
    domain = extract_domain(url)
    for d in _BD_GOV_DOMAINS:
        if domain == d or domain.endswith("." + d):
            return domain, "BANGLADESH_GOV_RESEARCH"
    for d in _INTL_AGRI_DOMAINS:
        if domain == d or domain.endswith("." + d):
            return domain, "INTERNATIONAL_AGRI"
    for d in _ACADEMIC_DOMAINS:
        if domain == d or domain.endswith("." + d) or domain.endswith(".edu") or ".edu." in domain or ".gov" in domain:
            return domain, "ACADEMIC"
    return domain, "GENERAL"


def normalize_doi(raw: str | None) -> str | None:
    if not raw:
        return None
    cleaned = raw.strip()
    cleaned = re.sub(r"^https?://(dx\.)?doi\.org/", "", cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.strip().rstrip(".")
    if not cleaned or "/" not in cleaned:
        return None
    return cleaned.lower()


def http_get_with_retry(
    client: httpx.Client,
    url: str,
    *,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    max_retries: int = 2,
) -> httpx.Response:
    """Perform a GET request with bounded exponential backoff respecting Retry-After."""
    last_exc: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            resp = client.get(url, params=params, headers=headers)
            if resp.status_code == 429 and attempt < max_retries:
                retry_after_raw = resp.headers.get("Retry-After", "")
                try:
                    wait_sec = min(3.0, max(0.3, float(retry_after_raw)))
                except ValueError:
                    wait_sec = 0.6 * (attempt + 1)
                time.sleep(wait_sec)
                continue
            if resp.status_code >= 500 and attempt < max_retries:
                time.sleep(0.4 * (attempt + 1))
                continue
            return resp
        except httpx.RequestError as exc:
            last_exc = exc
            if attempt < max_retries:
                time.sleep(0.3 * (attempt + 1))
                continue
            raise
    if last_exc is not None:
        raise last_exc
    raise httpx.RequestError("Request failed after retries")
