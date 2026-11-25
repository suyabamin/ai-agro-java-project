from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx

from app.core.config import settings
from app.schemas.research import ResearchPaper, ResearchSource
from app.services.providers.base import (
    ProviderOutcome,
    classify_domain_tier,
    http_get_with_retry,
    normalize_doi,
)

SEMANTIC_SCHOLAR_SEARCH_URL = "https://api.semanticscholar.org/graph/v1/paper/search"
_FIELDS = "title,abstract,authors,year,externalIds,citationCount,url,venue,isOpenAccess"


class SemanticScholarProvider:
    """Official Semantic Scholar Graph API provider (optional SEMANTIC_SCHOLAR_API_KEY)."""

    name = "semantic_scholar"

    def __init__(
        self,
        api_key: str | None = None,
        timeout_sec: float | None = None,
        endpoint_url: str = SEMANTIC_SCHOLAR_SEARCH_URL,
    ) -> None:
        self._api_key = (api_key if api_key is not None else settings.SEMANTIC_SCHOLAR_API_KEY).strip()
        self._timeout_sec = timeout_sec if timeout_sec is not None else settings.RESEARCH_PROVIDER_TIMEOUT_SEC
        self._endpoint_url = endpoint_url

    def search(self, query: str, max_results: int = 5) -> ProviderOutcome:
        clean_q = (query or "").strip()
        if not clean_q:
            return ProviderOutcome(provider=self.name, ok=False, reason="empty_query", error_message="Empty query")

        limit = max(1, min(max_results, 10))
        params: dict[str, Any] = {
            "query": clean_q,
            "limit": limit,
            "fields": _FIELDS,
        }
        headers: dict[str, str] = {"User-Agent": "AgroAI-Research/1.0"}
        if self._api_key:
            headers["x-api-key"] = self._api_key

        timeout = httpx.Timeout(self._timeout_sec, connect=min(5.0, self._timeout_sec))

        try:
            with httpx.Client(timeout=timeout) as client:
                resp = http_get_with_retry(client, self._endpoint_url, params=params, headers=headers)
        except httpx.TimeoutException:
            return ProviderOutcome(provider=self.name, ok=False, reason="timeout", error_message="Semantic Scholar request timed out")
        except httpx.RequestError:
            return ProviderOutcome(provider=self.name, ok=False, reason="network_error", error_message="Semantic Scholar network error")

        if resp.status_code in (401, 403):
            return ProviderOutcome(
                provider=self.name,
                ok=False,
                reason="invalid_api_key",
                error_message="Semantic Scholar authentication failed.",
            )
        if resp.status_code == 429:
            return ProviderOutcome(
                provider=self.name,
                ok=False,
                reason="rate_limited",
                error_message="Semantic Scholar rate limited (429).",
            )
        if resp.status_code >= 400:
            return ProviderOutcome(
                provider=self.name,
                ok=False,
                reason=f"http_{resp.status_code}",
                error_message=f"Semantic Scholar returned HTTP {resp.status_code}.",
            )

        try:
            payload = resp.json()
        except ValueError:
            return ProviderOutcome(provider=self.name, ok=False, reason="invalid_response", error_message="Invalid JSON from Semantic Scholar")

        rows = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(rows, list) or not rows:
            return ProviderOutcome(provider=self.name, ok=False, reason="zero_results", error_message="Semantic Scholar returned no papers")

        now_iso = datetime.now(timezone.utc).isoformat()
        papers: list[ResearchPaper] = []
        sources: list[ResearchSource] = []

        for item in rows[:limit]:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title") or "").strip()
            if not title:
                continue

            ext_ids = item.get("externalIds") if isinstance(item.get("externalIds"), dict) else {}
            doi = normalize_doi(ext_ids.get("DOI"))
            s2_id = str(item.get("paperId") or "").strip()
            url = str(item.get("url") or "").strip() or (f"https://doi.org/{doi}" if doi else "")
            if not url.startswith(("http://", "https://")):
                continue

            authors = [
                str(a.get("name")).strip()
                for a in (item.get("authors") or [])[:8]
                if isinstance(a, dict) and a.get("name")
            ]
            year_raw = item.get("year")
            pub_year = int(year_raw) if isinstance(year_raw, int) else None
            abstract = str(item.get("abstract") or "").strip()[:900] or None
            journal = str(item.get("venue") or "").strip() or None
            cit_raw = item.get("citationCount")
            citation_count = int(cit_raw) if isinstance(cit_raw, int) else None
            is_oa = item.get("isOpenAccess") if isinstance(item.get("isOpenAccess"), bool) else None

            domain, tier = classify_domain_tier(url)
            if tier == "GENERAL":
                tier = "ACADEMIC"

            paper_id = f"doi:{doi}" if doi else f"s2:{s2_id or len(papers)}"
            papers.append(
                ResearchPaper(
                    paperId=paper_id,
                    title=title[:260],
                    authors=authors,
                    publicationYear=pub_year,
                    doi=doi,
                    journal=journal,
                    abstract=abstract,
                    url=url,
                    domain=domain or "semanticscholar.org",
                    isOpenAccess=is_oa,
                    citationCount=citation_count,
                    sourceProvider=self.name,
                    authoritativeTier=tier,
                    searchResultRetrieved=True,
                    metadataValidated=bool(title and (pub_year or authors)),
                    sourceIdentityVerified=True,
                    scientificEvidenceAssessed=False,
                    doiVerificationStatus="UNVERIFIED" if doi else "NOT_APPLICABLE",
                    retrievedAt=now_iso,
                )
            )
            sources.append(
                ResearchSource(
                    title=title[:220],
                    url=url,
                    domain=domain or "semanticscholar.org",
                    snippet=(abstract or f"Semantic Scholar paper ({pub_year or 'n/a'})")[:600],
                    authoritativeTier=tier,
                    retrievedAt=now_iso,
                    provider=self.name,
                )
            )

        if not papers:
            return ProviderOutcome(provider=self.name, ok=False, reason="zero_results", error_message="No usable Semantic Scholar papers")

        return ProviderOutcome(provider=self.name, ok=True, reason="ok", papers=papers, sources=sources)
