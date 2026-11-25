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

OPENALEX_WORKS_URL = "https://api.openalex.org/works"


def reconstruct_openalex_abstract(inverted_index: dict[str, list[int]] | None) -> str | None:
    if not isinstance(inverted_index, dict) or not inverted_index:
        return None
    positions: dict[int, str] = {}
    for word, idxs in inverted_index.items():
        if not isinstance(idxs, list):
            continue
        for pos in idxs:
            if isinstance(pos, int) and 0 <= pos < 500:
                positions[pos] = word
    if not positions:
        return None
    ordered = [positions[i] for i in sorted(positions.keys())]
    text = " ".join(ordered).strip()
    return text[:900] if text else None


class OpenAlexProvider:
    """Official OpenAlex Works API provider (polite pool via OPENALEX_EMAIL)."""

    name = "openalex"

    def __init__(
        self,
        email: str | None = None,
        timeout_sec: float | None = None,
        endpoint_url: str = OPENALEX_WORKS_URL,
    ) -> None:
        self._email = (email if email is not None else settings.OPENALEX_EMAIL).strip()
        self._timeout_sec = timeout_sec if timeout_sec is not None else settings.RESEARCH_PROVIDER_TIMEOUT_SEC
        self._endpoint_url = endpoint_url

    def search(self, query: str, max_results: int = 5) -> ProviderOutcome:
        clean_q = (query or "").strip()
        if not clean_q:
            return ProviderOutcome(provider=self.name, ok=False, reason="empty_query", error_message="Empty OpenAlex query")

        limit = max(1, min(max_results, 10))
        params: dict[str, Any] = {
            "search": clean_q,
            "per-page": limit,
            "filter": "has_abstract:true",
        }
        if self._email:
            params["mailto"] = self._email

        headers = {"User-Agent": f"AgroAI-Research/1.0 (mailto:{self._email or 'research@agroai.local'})"}
        timeout = httpx.Timeout(self._timeout_sec, connect=min(5.0, self._timeout_sec))

        try:
            with httpx.Client(timeout=timeout) as client:
                resp = http_get_with_retry(client, self._endpoint_url, params=params, headers=headers)
        except httpx.TimeoutException:
            return ProviderOutcome(provider=self.name, ok=False, reason="timeout", error_message="OpenAlex request timed out")
        except httpx.RequestError:
            return ProviderOutcome(provider=self.name, ok=False, reason="network_error", error_message="OpenAlex network error")

        if resp.status_code == 429:
            return ProviderOutcome(provider=self.name, ok=False, reason="rate_limited", error_message="OpenAlex rate limited (429)")
        if resp.status_code >= 400:
            return ProviderOutcome(
                provider=self.name,
                ok=False,
                reason=f"http_{resp.status_code}",
                error_message=f"OpenAlex returned HTTP {resp.status_code}",
            )

        try:
            data = resp.json()
        except ValueError:
            return ProviderOutcome(provider=self.name, ok=False, reason="invalid_response", error_message="OpenAlex returned invalid JSON")

        results = data.get("results") if isinstance(data, dict) else None
        if not isinstance(results, list) or not results:
            return ProviderOutcome(provider=self.name, ok=False, reason="zero_results", error_message="OpenAlex returned no works")

        now_iso = datetime.now(timezone.utc).isoformat()
        papers: list[ResearchPaper] = []
        sources: list[ResearchSource] = []

        for item in results[:limit]:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title") or item.get("display_name") or "").strip()
            if not title:
                continue

            doi = normalize_doi(item.get("doi"))
            primary_loc = item.get("primary_location") if isinstance(item.get("primary_location"), dict) else {}
            source_obj = primary_loc.get("source") if isinstance(primary_loc.get("source"), dict) else {}
            journal = str(source_obj.get("display_name") or "").strip() or None

            landing_url = str(primary_loc.get("landing_page_url") or "").strip()
            oa_info = item.get("open_access") if isinstance(item.get("open_access"), dict) else {}
            oa_url = str(oa_info.get("oa_url") or "").strip()
            openalex_id = str(item.get("id") or "").strip()
            url = landing_url or oa_url or (f"https://doi.org/{doi}" if doi else openalex_id)
            if not url.startswith(("http://", "https://")):
                continue

            authors: list[str] = []
            for authorship in (item.get("authorships") or [])[:8]:
                if isinstance(authorship, dict):
                    author = authorship.get("author")
                    if isinstance(author, dict) and author.get("display_name"):
                        authors.append(str(author["display_name"]).strip())

            year_raw = item.get("publication_year")
            pub_year = int(year_raw) if isinstance(year_raw, int) else None
            abstract = reconstruct_openalex_abstract(item.get("abstract_inverted_index"))
            citation_raw = item.get("cited_by_count")
            citation_count = int(citation_raw) if isinstance(citation_raw, int) else None
            is_oa = oa_info.get("is_oa") if isinstance(oa_info.get("is_oa"), bool) else None

            domain, tier = classify_domain_tier(url)
            if tier == "GENERAL":
                tier = "ACADEMIC"

            paper_id = f"doi:{doi}" if doi else f"openalex:{openalex_id.rsplit('/', 1)[-1] or len(papers)}"
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
                    domain=domain or "openalex.org",
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
                    domain=domain or "openalex.org",
                    snippet=(abstract or f"OpenAlex scholarly work ({pub_year or 'n/a'})")[:600],
                    authoritativeTier=tier,
                    retrievedAt=now_iso,
                    provider=self.name,
                )
            )

        if not papers:
            return ProviderOutcome(provider=self.name, ok=False, reason="zero_results", error_message="No usable OpenAlex papers")

        return ProviderOutcome(provider=self.name, ok=True, reason="ok", papers=papers, sources=sources)
