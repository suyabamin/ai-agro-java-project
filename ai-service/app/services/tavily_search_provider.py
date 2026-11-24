from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable
from urllib.parse import urlparse

import httpx

from app.core.config import settings
from app.schemas.research import ResearchSource


TAVILY_SEARCH_URL = "https://api.tavily.com/search"


@dataclass(slots=True)
class TavilySearchOutcome:
    """Structured result of a Tavily fallback search attempt."""

    ok: bool
    reason: str
    sources: list[ResearchSource] = field(default_factory=list)
    error_message: str | None = None


class TavilySearchProvider:
    """Backend-only Tavily Search API fallback provider.

    Reads ``TAVILY_API_KEY`` from backend settings and never logs or exposes
    the credential in exceptions or returned payloads.
    """

    def __init__(
        self,
        api_key: str | None = None,
        timeout_sec: float | None = None,
        endpoint_url: str = TAVILY_SEARCH_URL,
    ) -> None:
        self._api_key = (api_key if api_key is not None else settings.TAVILY_API_KEY).strip()
        self._timeout_sec = timeout_sec if timeout_sec is not None else settings.TAVILY_TIMEOUT_SEC
        self._endpoint_url = endpoint_url

    def is_configured(self) -> bool:
        return bool(self._api_key)

    def search(
        self,
        queries: list[str],
        max_results: int = 6,
        domain_classifier: Callable[[str], str] | None = None,
    ) -> TavilySearchOutcome:
        if not self._api_key:
            return TavilySearchOutcome(
                ok=False,
                reason="missing_api_key",
                error_message="Tavily fallback is unavailable because TAVILY_API_KEY is not configured.",
            )

        clean_queries = [q.strip() for q in queries if q and q.strip()][:2]
        if not clean_queries:
            return TavilySearchOutcome(
                ok=False,
                reason="empty_query",
                error_message="No search query provided for Tavily fallback.",
            )

        collected: list[ResearchSource] = []
        seen_urls: set[str] = set()
        per_query_limit = max(3, min(max_results, 8))
        timeout = httpx.Timeout(self._timeout_sec, connect=min(5.0, self._timeout_sec))

        try:
            with httpx.Client(timeout=timeout) as client:
                for query in clean_queries:
                    payload = {
                        "api_key": self._api_key,
                        "query": query,
                        "search_depth": "basic",
                        "max_results": per_query_limit,
                        "include_answer": False,
                        "include_raw_content": False,
                    }
                    response = client.post(self._endpoint_url, json=payload)

                    if response.status_code == 401:
                        return TavilySearchOutcome(
                            ok=False,
                            reason="invalid_api_key",
                            error_message="Tavily API authentication failed.",
                        )
                    if response.status_code in (402, 403):
                        return TavilySearchOutcome(
                            ok=False,
                            reason="quota_or_billing_exhausted",
                            error_message="Tavily API quota or billing limit reached.",
                        )
                    if response.status_code == 429:
                        return TavilySearchOutcome(
                            ok=False,
                            reason="rate_limited",
                            error_message="Tavily API rate limit reached.",
                        )
                    if response.status_code >= 400:
                        return TavilySearchOutcome(
                            ok=False,
                            reason=f"http_{response.status_code}",
                            error_message=f"Tavily search returned HTTP {response.status_code}.",
                        )

                    data = response.json()
                    results = data.get("results") if isinstance(data, dict) else None
                    if not isinstance(results, list):
                        continue

                    now_iso = datetime.now(timezone.utc).isoformat()
                    for item in results:
                        if not isinstance(item, dict):
                            continue
                        url = str(item.get("url") or "").strip()
                        title = str(item.get("title") or "").strip()
                        snippet = str(item.get("content") or item.get("snippet") or "").strip()
                        if not url or not title:
                            continue
                        parsed = urlparse(url)
                        if parsed.scheme not in ("http", "https") or not parsed.netloc:
                            continue
                        canonical_url = url.split("#")[0].rstrip("/")
                        if canonical_url in seen_urls:
                            continue
                        seen_urls.add(canonical_url)

                        domain = parsed.netloc.lower()
                        if domain.startswith("www."):
                            domain = domain[4:]
                        if domain_classifier is not None:
                            classified = domain_classifier(url)
                            if isinstance(classified, tuple) and len(classified) == 2:
                                domain, tier = classified
                            else:
                                tier = str(classified)
                        else:
                            tier = "GENERAL"

                        collected.append(
                            ResearchSource(
                                title=title[:220],
                                url=url,
                                domain=domain,
                                snippet=snippet[:600],
                                authoritativeTier=tier,
                                retrievedAt=now_iso,
                                provider="tavily",
                            )
                        )
                        if len(collected) >= max_results:
                            break
                    if len(collected) >= max_results:
                        break
        except httpx.TimeoutException:
            return TavilySearchOutcome(
                ok=False,
                reason="timeout",
                error_message="Tavily search request timed out.",
            )
        except httpx.RequestError:
            return TavilySearchOutcome(
                ok=False,
                reason="network_error",
                error_message="Tavily search request failed due to a network error.",
            )
        except ValueError:
            return TavilySearchOutcome(
                ok=False,
                reason="invalid_response",
                error_message="Tavily search returned an invalid JSON payload.",
            )

        if not collected:
            return TavilySearchOutcome(
                ok=False,
                reason="zero_results",
                sources=[],
                error_message="Tavily search returned no usable sources.",
            )

        return TavilySearchOutcome(
            ok=True,
            reason="ok",
            sources=collected,
        )
