from __future__ import annotations

from datetime import datetime, timezone

from app.schemas.research import ResearchSource
from app.services.providers.base import ProviderOutcome

BAMIS_STATUS_REPORT = {
    "bamisApiAvailable": False,
    "status": "PORTAL_ONLY_NO_PUBLIC_API",
    "verifiedEndpoint": "https://www.bamis.gov.bd/",
    "apiProbeResult": "https://www.bamis.gov.bd/api/ returned text/html rather than a structured JSON API.",
    "scrapingPerformed": False,
    "note": "BAMIS provides a public Bengali agro-meteorological web portal without a documented public JSON API; official portal attribution is included without unauthorized scraping.",
}

_OFFICIAL_BD_PORTALS = [
    (
        "BAMIS — Bangladesh Agro-Meteorological Information System (DAE)",
        "https://www.bamis.gov.bd/",
        "bamis.gov.bd",
        "Official DAE agro-meteorological advisory portal for Bangladesh farmers (portal reference only; no public JSON disease API).",
    ),
    (
        "Department of Agricultural Extension (DAE) — Official Portal",
        "https://dae.gov.bd/",
        "dae.gov.bd",
        "Official Bangladesh Department of Agricultural Extension portal for field extension advisories and pest/disease guidance.",
    ),
    (
        "Bangladesh Agricultural Research Institute (BARI) — Official Portal",
        "https://bari.gov.bd/",
        "bari.gov.bd",
        "National research institute for vegetables, fruits, pulses, oilseeds, and horticultural crop disease management in Bangladesh.",
    ),
    (
        "Bangladesh Rice Research Institute (BRRI) — Official Portal",
        "https://brri.gov.bd/",
        "brri.gov.bd",
        "National rice research institute publishing official rice disease and pest management guidelines in Bangladesh.",
    ),
]


class BangladeshAgriProvider:
    """Attributed Bangladesh official agricultural reference provider (no scraping)."""

    name = "bangladesh_agri_official"

    def get_references(self, crop_name: str | None = None) -> ProviderOutcome:
        now_iso = datetime.now(timezone.utc).isoformat()
        crop_low = (crop_name or "").strip().lower()
        sources: list[ResearchSource] = []

        for title, url, domain, snippet in _OFFICIAL_BD_PORTALS:
            if domain == "brri.gov.bd" and crop_low and crop_low not in ("rice", "paddy", "general"):
                continue
            sources.append(
                ResearchSource(
                    title=title,
                    url=url,
                    domain=domain,
                    snippet=snippet,
                    authoritativeTier="BANGLADESH_GOV_RESEARCH",
                    retrievedAt=now_iso,
                    provider=self.name,
                )
            )

        return ProviderOutcome(
            provider=self.name,
            ok=True,
            reason="official_portal_attribution",
            papers=[],
            sources=sources,
            metadata={"bamisStatus": dict(BAMIS_STATUS_REPORT)},
        )
