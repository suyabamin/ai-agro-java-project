from __future__ import annotations

import re
from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import settings
from app.schemas.research import ResearchPaper
from app.services.providers.base import http_get_with_retry, normalize_doi

CROSSREF_WORK_URL = "https://api.crossref.org/works/"


def _title_tokens(title: str | None) -> set[str]:
    if not title:
        return set()
    return {t for t in re.findall(r"[a-z0-9]+", title.lower()) if len(t) > 2}


class CrossrefProvider:
    """Official Crossref REST API client for DOI metadata verification & enrichment."""

    name = "crossref"

    def __init__(
        self,
        mailto: str | None = None,
        timeout_sec: float | None = None,
        base_url: str = CROSSREF_WORK_URL,
    ) -> None:
        self._mailto = (mailto if mailto is not None else settings.OPENALEX_EMAIL).strip()
        self._timeout_sec = timeout_sec if timeout_sec is not None else settings.RESEARCH_PROVIDER_TIMEOUT_SEC
        self._base_url = base_url.rstrip("/") + "/"

    def verify_and_enrich(self, paper: ResearchPaper) -> tuple[bool, str]:
        """Verify DOI metadata against Crossref and enrich missing fields.

        Returns ``(attempted_ok, status_reason)``.
        Never treats Crossref metadata match as proof of scientific validity.
        """
        doi = normalize_doi(paper.doi)
        if not doi:
            paper.doiVerificationStatus = "NOT_APPLICABLE"
            return True, "no_doi"

        headers = {"User-Agent": f"AgroAI-Research/1.0 (mailto:{self._mailto or 'research@agroai.local'})"}
        timeout = httpx.Timeout(self._timeout_sec, connect=min(5.0, self._timeout_sec))
        url = f"{self._base_url}{quote(doi, safe='/')}"

        try:
            with httpx.Client(timeout=timeout) as client:
                resp = http_get_with_retry(client, url, headers=headers, max_retries=1)
        except httpx.TimeoutException:
            paper.doiVerificationStatus = "UNVERIFIED"
            paper.doiVerificationNote = "Crossref verification timed out."
            return False, "timeout"
        except httpx.RequestError:
            paper.doiVerificationStatus = "UNVERIFIED"
            paper.doiVerificationNote = "Crossref network error."
            return False, "network_error"

        if resp.status_code == 404:
            paper.doiVerificationStatus = "DOI_NOT_FOUND"
            paper.doiVerificationNote = "DOI was not found in Crossref."
            paper.metadataValidated = False
            return True, "doi_not_found"
        if resp.status_code == 429:
            paper.doiVerificationStatus = "UNVERIFIED"
            paper.doiVerificationNote = "Crossref rate limited (429)."
            return False, "rate_limited"
        if resp.status_code >= 400:
            paper.doiVerificationStatus = "UNVERIFIED"
            paper.doiVerificationNote = f"Crossref returned HTTP {resp.status_code}."
            return False, f"http_{resp.status_code}"

        try:
            payload = resp.json()
        except ValueError:
            paper.doiVerificationStatus = "UNVERIFIED"
            paper.doiVerificationNote = "Crossref returned invalid JSON."
            return False, "invalid_response"

        msg = payload.get("message") if isinstance(payload, dict) else None
        if not isinstance(msg, dict):
            paper.doiVerificationStatus = "UNVERIFIED"
            return False, "invalid_response"

        cr_titles = msg.get("title") if isinstance(msg.get("title"), list) else []
        cr_title = str(cr_titles[0]).strip() if cr_titles else ""
        if not cr_title:
            paper.doiVerificationStatus = "METADATA_MISMATCH"
            paper.doiVerificationNote = "Crossref record missing title metadata."
            paper.metadataValidated = False
            return True, "missing_title"

        paper_tokens = _title_tokens(paper.title)
        cr_tokens = _title_tokens(cr_title)
        overlap = len(paper_tokens & cr_tokens) / max(1, min(len(paper_tokens), len(cr_tokens)))

        # Enrich missing journal/authors/year from Crossref when available
        if not paper.journal:
            containers = msg.get("container-title") if isinstance(msg.get("container-title"), list) else []
            if containers and str(containers[0]).strip():
                paper.journal = str(containers[0]).strip()

        if not paper.authors:
            cr_authors: list[str] = []
            for a in (msg.get("author") or [])[:8]:
                if isinstance(a, dict):
                    full = f"{a.get('given', '')} {a.get('family', '')}".strip()
                    if full:
                        cr_authors.append(full)
            if cr_authors:
                paper.authors = cr_authors

        cr_year: int | None = None
        for date_key in ("published-print", "published-online", "issued", "created"):
            date_obj = msg.get(date_key)
            if isinstance(date_obj, dict):
                parts = date_obj.get("date-parts")
                if isinstance(parts, list) and parts and isinstance(parts[0], list) and parts[0]:
                    try:
                        cr_year = int(parts[0][0])
                        break
                    except (TypeError, ValueError):
                        pass
        if paper.publicationYear is None and cr_year is not None:
            paper.publicationYear = cr_year

        year_mismatch = (
            paper.publicationYear is not None
            and cr_year is not None
            and abs(paper.publicationYear - cr_year) > 1
        )
        if overlap < 0.45 or year_mismatch:
            paper.doiVerificationStatus = "METADATA_MISMATCH"
            paper.doiVerificationNote = (
                "Crossref title or publication year differs from retrieved record."
            )
            paper.metadataValidated = False
            return True, "metadata_mismatch"

        paper.doiVerificationStatus = "VERIFIED_MATCH"
        paper.doiVerificationNote = "DOI metadata matched Crossref record (does not imply clinical efficacy)."
        paper.metadataValidated = True
        if "crossref" not in paper.additionalProviders and paper.sourceProvider != "crossref":
            paper.additionalProviders.append("crossref")
        return True, "verified_match"
