import re
import threading
import urllib.parse
import urllib.robotparser
from datetime import datetime, timezone
from typing import Any

from app.schemas.research import (
    BengaliResearchReport,
    DiseaseResearchRequest,
    DiseaseResearchResponse,
    ResearchSource,
)
from app.services.disease_detection_service import is_healthy_class

_BROWSER_SEMAPHORE = threading.Semaphore(1)
_PAGE_LOAD_TIMEOUT_SEC = 15
_EXPLICIT_WAIT_SEC = 8
_MAX_EXTRACT_PAGES = 2
_LOW_CONFIDENCE_THRESHOLD = 60.0

_BD_GOV_DOMAINS = (
    "dae.gov.bd",
    "bari.gov.bd",
    "brri.gov.bd",
    "bau.edu.bd",
    "bsmrau.edu.bd",
    "sau.edu.bd",
    "barc.gov.bd",
    "ais.gov.bd",
)
_INTL_AGRI_DOMAINS = (
    "irri.org",
    "fao.org",
    "cabi.org",
    "cabidigitallibrary.org",
    "plantwiseplusknowledgebank.org",
    "plantvillage.psu.edu",
    "cipotato.org",
)


def format_readable_disease(raw: str) -> str:
    return re.sub(r"\s+", " ", raw.replace("_", " ")).strip()


def infer_crop_from_disease(disease_name: str, crop_name: str | None) -> str:
    if crop_name and crop_name.strip():
        return crop_name.strip()
    parts = format_readable_disease(disease_name).split(" ")
    return parts[0] if parts else "Crop"


def classify_domain_tier(url: str) -> tuple[str, str]:
    parsed = urllib.parse.urlparse(url)
    domain = (parsed.netloc or "").lower().lstrip("www.")
    if any(domain == d or domain.endswith("." + d) for d in _BD_GOV_DOMAINS):
        return domain, "BANGLADESH_GOV_RESEARCH"
    if any(domain == d or domain.endswith("." + d) for d in _INTL_AGRI_DOMAINS):
        return domain, "INTERNATIONAL_AGRI"
    if domain.endswith(".edu") or domain.endswith(".ac.uk") or ".edu." in domain or ".gov" in domain:
        return domain, "ACADEMIC"
    return domain, "GENERAL"


def _tier_priority(tier: str) -> int:
    return {
        "BANGLADESH_GOV_RESEARCH": 0,
        "INTERNATIONAL_AGRI": 1,
        "ACADEMIC": 2,
        "GENERAL": 3,
    }.get(tier, 4)


def build_google_queries(disease_name: str, crop_name: str | None) -> list[str]:
    readable = format_readable_disease(disease_name)
    crop = infer_crop_from_disease(disease_name, crop_name)
    q1 = f"{readable} {crop} disease management DAE BARI BRRI FAO CABI"
    q2 = f"{readable} symptoms control agricultural extension"
    return [q1, q2]


def _is_google_blocked(current_url: str, page_source: str) -> bool:
    url_low = (current_url or "").lower()
    body_low = (page_source or "").lower()
    if "/sorry/" in url_low or "sorry/index" in url_low:
        return True
    if "unusual traffic" in body_low or "our systems have detected unusual traffic" in body_low:
        return True
    if 'id="captcha-form"' in body_low or "g-recaptcha" in body_low:
        return True
    return False


def _is_valid_external_url(url: str | None) -> bool:
    if not url:
        return False
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False
    host = (parsed.netloc or "").lower()
    if not host or "google." in host or "gstatic." in host or "youtube." in host:
        return False
    return True


def _robots_allows(url: str, user_agent: str = "AgroAIResearchBot") -> bool:
    try:
        parsed = urllib.parse.urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(robots_url)
        rp.read()
        return rp.can_fetch(user_agent, url)
    except Exception:
        # Fail-safe: if robots.txt cannot be fetched/parsed, skip deep page scraping and rely on snippet only.
        return False


def _build_chrome_driver() -> tuple[Any, str, str]:
    import selenium
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options

    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1280,900")
    # Never expose remote debugging ports or use stealth/proxy flags.

    driver = webdriver.Chrome(options=opts)
    driver.set_page_load_timeout(_PAGE_LOAD_TIMEOUT_SEC)
    browser_ver = driver.capabilities.get("browserVersion", "chrome")
    return driver, f"selenium@{selenium.__version__}", f"chrome@{browser_ver}"


def _run_selenium_google_search(queries: list[str], max_results: int) -> tuple[str, list[ResearchSource], str | None, str | None, str | None]:
    """
    Executes bounded headless Chrome Google Search via Selenium WebDriver.
    Returns (status, sources, error_code, selenium_version, browser_info).
    """
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait

    if not _BROWSER_SEMAPHORE.acquire(timeout=20):
        return "FAILED", [], "BROWSER_BUSY", None, None

    driver = None
    sel_ver = None
    browser_info = None
    try:
        driver, sel_ver, browser_info = _build_chrome_driver()
        collected: dict[str, ResearchSource] = {}

        for query in queries[:2]:
            encoded_q = urllib.parse.quote_plus(query)
            driver.get(f"https://www.google.com/search?q={encoded_q}&hl=en&num=8")
            WebDriverWait(driver, _EXPLICIT_WAIT_SEC).until(
                lambda d: d.execute_script("return document.readyState") == "complete"
            )

            if _is_google_blocked(driver.current_url, driver.page_source):
                return (
                    "BLOCKED",
                    [],
                    "GOOGLE_CAPTCHA_BLOCKED",
                    sel_ver,
                    browser_info,
                )

            anchors = driver.find_elements(By.CSS_SELECTOR, "a h3")
            for h3 in anchors:
                try:
                    title = h3.text.strip()
                    link_el = h3.find_element(By.XPATH, "./ancestor::a[1]")
                    href = link_el.get_attribute("href")
                    if not title or not _is_valid_external_url(href):
                        continue
                    norm_url = href.split("#")[0]
                    if norm_url in collected:
                        continue

                    snippet = ""
                    try:
                        container = link_el.find_element(By.XPATH, "./ancestor::div[contains(@class,'g') or @data-snhf or @data-hveid][1]")
                        raw_txt = container.text.replace(title, "").strip()
                        snippet = re.sub(r"\s+", " ", raw_txt)[:360]
                    except Exception:
                        snippet = ""

                    domain, tier = classify_domain_tier(norm_url)
                    collected[norm_url] = ResearchSource(
                        title=title[:180],
                        url=norm_url,
                        domain=domain,
                        snippet=snippet or title,
                        extractedSummary=None,
                        authoritativeTier=tier,
                        retrievedAt=datetime.now(timezone.utc).isoformat(),
                    )
                except Exception:
                    continue

            if len(collected) >= max_results:
                break

        if not collected:
            return "FAILED", [], "NO_SEARCH_RESULTS", sel_ver, browser_info

        sorted_sources = sorted(
            collected.values(),
            key=lambda s: (_tier_priority(s.authoritativeTier), s.title.lower()),
        )[:max_results]

        # Open up to _MAX_EXTRACT_PAGES permitted pages respecting robots.txt
        extracted_count = 0
        for src in sorted_sources:
            if extracted_count >= _MAX_EXTRACT_PAGES:
                break
            if not _robots_allows(src.url):
                continue
            try:
                driver.get(src.url)
                WebDriverWait(driver, _EXPLICIT_WAIT_SEC).until(
                    lambda d: d.execute_script("return document.readyState") == "complete"
                )
                paragraphs = driver.find_elements(By.CSS_SELECTOR, "main p, article p, p")
                text_parts = [p.text.strip() for p in paragraphs[:6] if len(p.text.strip()) > 40]
                if text_parts:
                    src.extractedSummary = re.sub(r"\s+", " ", " ".join(text_parts))[:600]
                    extracted_count += 1
            except Exception:
                continue

        return "COMPLETED", sorted_sources, None, sel_ver, browser_info
    except Exception as exc:
        return "FAILED", [], f"SELENIUM_ERROR:{type(exc).__name__}", sel_ver, browser_info
    finally:
        if driver is not None:
            try:
                driver.quit()
            except Exception:
                pass
        _BROWSER_SEMAPHORE.release()


def build_bengali_report(
    disease_name: str,
    crop_name: str,
    confidence: float | None,
    is_healthy: bool,
    sources: list[ResearchSource],
) -> BengaliResearchReport:
    readable = format_readable_disease(disease_name)
    low_conf = confidence is not None and confidence < _LOW_CONFIDENCE_THRESHOLD

    if is_healthy:
        return BengaliResearchReport(
            summaryBn=f"{crop_name} ফসলের নমুনাটি সুস্থ হিসেবে চিহ্নিত হয়েছে ({readable})। এই মুহূর্তে কোনো রোগের চিকিৎসার প্রয়োজন নেই।",
            symptomsBn="সক্রিয় রোগের কোনো লক্ষণ শনাক্ত হয়নি।",
            managementBn="নিয়মিত সেচ, সুষম সার এবং জমি পরিচ্ছন্ন রাখুন।",
            preventionBn="আগাম সতর্কতার জন্য সপ্তাহে অন্তত একবার জমির পাতা পর্যবেক্ষণ করুন।",
            cautionBn="এই ফলাফলটি AI-ভিত্তিক প্রাথমিক মূল্যায়ন মাত্র; সন্দেহ হলে কৃষি কর্মকর্তার পরামর্শ নিন।",
            evidenceNoticeBn="সুস্থ শ্রেণি হওয়ায় কোনো রাসায়নিক বা রোগ ব্যবস্থাপনা সুপারিশ করা হয়নি।",
        )

    evidence_lines = []
    for i, s in enumerate(sources[:3], start=1):
        detail = s.extractedSummary or s.snippet
        evidence_lines.append(f"[{i}] {s.domain}: {detail[:220]}")
    joined_evidence = " | ".join(evidence_lines) if evidence_lines else "যাচাইকৃত বিস্তারিত তথ্য সীমিত।"

    conf_note = (
        f" সতর্কতা: মডেলের আত্মবিশ্বাসের হার কম ({confidence:.1f}%) — মাঠে যাচাই জরুরি।"
        if low_conf and confidence is not None
        else ""
    )

    if not sources:
        return BengaliResearchReport(
            summaryBn=f"{crop_name} ফসলে '{readable}' সম্পর্কে পর্যাপ্ত যাচাইকৃত তথ্য পাওয়া যায়নি।{conf_note}",
            overviewBn=f"{crop_name} ফসলের '{readable}' সংক্রান্ত নির্ভরযোগ্য তথ্য সংগ্রহে পর্যাপ্ত প্রমাণ পাওয়া যায়নি।",
            symptomsBn="পর্যাপ্ত যাচাইকৃত উৎস না থাকায় নির্দিষ্ট লক্ষণ তালিকাভুক্ত করা হয়নি।",
            causesBn="সঠিক কারণ নির্ণয়ের জন্য নমুনাটি স্থানীয় কৃষি অফিসে পরীক্ষা করুন।",
            spreadBn="রোগ ছড়ানোর ঝুঁকি এড়াতে আক্রান্ত গাছ আলাদা পর্যবেক্ষণে রাখুন।",
            damageBn="সঠিক তথ্য ছাড়া ক্ষতির মাত্রা অনুমান করা সম্ভব নয়।",
            immediateActionBn="আক্রান্ত পাতা সুস্থ গাছ থেকে আলাদা রাখুন এবং স্থানীয় কৃষি কর্মকর্তার সাথে যোগাযোগ করুন।",
            preventionBn="জমি পরিচ্ছন্ন রাখুন, সুষম সেচ দিন এবং রোগমুক্ত বীজ ব্যবহার করুন।",
            managementBn="নির্ভরযোগ্য কৃষিবিদের পরামর্শ ছাড়া কোনো রাসায়নিক বা কীটনাশক প্রয়োগ করবেন না।",
            whenToConsultBn="উপসর্গ দ্রুত ছড়ালে অবিলম্বে উপজেলা কৃষি কর্মকর্তা বা DAE-এর পরামর্শ নিন।",
            referencesBn="কোনো যাচাইকৃত তথ্যসূত্র পাওয়া যায়নি।",
            cautionBn="প্রমাণ অপ্রতুল থাকায় কোনো অনুমানভিত্তিক চিকিৎসা দেওয়া হয়নি।",
            evidenceNoticeBn="INSUFFICIENT_EVIDENCE: যাচাইকৃত উৎস না থাকায় কোনো ব্র্যান্ড বা মাত্রা সুপারিশ করা হয়নি।",
        )

    ref_list = ", ".join(f"[{i}] {s.domain}" for i, s in enumerate(sources[:5], start=1))

    return BengaliResearchReport(
        summaryBn=f"{crop_name} ফসলে '{readable}' সংক্রান্ত প্রাথমিক তথ্য {len(sources)}টি যাচাইকৃত উৎস থেকে সংগ্রহ করা হয়েছে।{conf_note}",
        overviewBn=f"{crop_name} ফসলের '{readable}' একটি শনাক্তকৃত রোগ/অবস্থা, যা সংগৃহীত কৃষি উৎসে আলোচিত হয়েছে।{conf_note}",
        symptomsBn=f"সংগৃহীত উৎসের প্রাথমিক লক্ষণ ও পর্যবেক্ষণ: {joined_evidence}",
        causesBn="সংগৃহীত উৎস অনুযায়ী অনুকূল আবহাওয়া, আর্দ্রতা, জীবাণু বা পুষ্টির ঘাটতিসহ পরিবেশগত কারণগুলো দায়ী হতে পারে; সুনির্দিষ্ট কারণ জানতে উৎসের মূল প্রতিবেদন দেখুন।",
        spreadBn="আক্রান্ত পাতা, মাটি, সেচের পানি, বাতাস বা কৃষি যন্ত্রপাতির মাধ্যমে রোগটি পাশের গাছে ছড়াতে পারে।",
        damageBn="সময়মতো ব্যবস্থা না নিলে পাতার কার্যকারিতা কমে ফলন ও ফসলের গুণমান হ্রাস পেতে পারে।",
        immediateActionBn="আক্রান্ত পাতা বা অংশ সাবধানে আলাদা করুন, জমিতে অতিরিক্ত আর্দ্রতা বা জলাবদ্ধতা থাকলে নিয়ন্ত্রণ করুন এবং আক্রান্ত অংশের ছবি ও নমুনা সংরক্ষণ করুন।",
        managementBn="সঠিক মাত্রা ও করণীয় নির্ধারণে স্থানীয় কৃষি সম্প্রসারণ অধিদপ্তর (DAE) বা BARI/BRRI-এর অনুমোদিত নির্দেশিকা অনুসরণ করুন। নিচের উৎস লিংকগুলো থেকে বিস্তারিত দেখুন।",
        preventionBn="আক্রান্ত পাতা আলাদা করা, সুষম সেচ ও বায়ু চলাচল বজায় রাখা, ফসল পর্যায় অনুসরণ এবং রোগমুক্ত বীজ/চারা ব্যবহার সাধারণ প্রতিরোধমূলক ব্যবস্থা হিসেবে বিবেচিত।",
        whenToConsultBn="রোগ দ্রুত ছড়িয়ে পড়লে, শনাক্তকরণে নিম্ন আত্মবিশ্বাস থাকলে বা রাসায়নিক ব্যবস্থাপনার প্রয়োজন হলে অবিলম্বে উপজেলা কৃষি কর্মকর্তা বা অনুমোদিত কৃষিবিদের পরামর্শ নিন।",
        referencesBn=ref_list,
        cautionBn="অনলাইন অনুসন্ধান থেকে পাওয়া তথ্য প্রাথমিক সহায়তা মাত্র; যাচাইকৃত কৃষিবিদের পরামর্শ ছাড়া কোনো কীটনাশক, ছত্রাকনাশক বা মাত্রা প্রয়োগ করবেন না।",
        evidenceNoticeBn="এই প্রতিবেদনে কোনো অনুমানভিত্তিক রাসায়নিক মাত্রা বা ব্র্যান্ড যোগ করা হয়নি; সব তথ্য নিচে তালিকাভুক্ত উৎস থেকে সংগৃহীত।",
    )


def _validate_and_rank_sources(sources: list[ResearchSource], max_results: int) -> list[ResearchSource]:
    seen: set[str] = set()
    valid: list[ResearchSource] = []
    for src in sources:
        url = (src.url or "").strip()
        if not (url.startswith("http://") or url.startswith("https://")):
            continue
        if not (src.title or "").strip():
            continue
        canonical = url.split("#")[0].rstrip("/")
        if canonical in seen:
            continue
        seen.add(canonical)
        valid.append(src)
    valid.sort(key=lambda s: (_tier_priority(s.authoritativeTier), s.title.lower()))
    return valid[:max_results]


_CACHE_LOCK = threading.Lock()
_RESEARCH_CACHE: dict[tuple[str, str, int], tuple[float, DiseaseResearchResponse]] = {}


def clear_research_cache() -> None:
    with _CACHE_LOCK:
        _RESEARCH_CACHE.clear()


def _query_terms(disease_name: str, crop_name: str) -> set[str]:
    raw = f"{format_readable_disease(disease_name)} {crop_name}".lower()
    return {t for t in re.findall(r"[a-z0-9]+", raw) if len(t) > 2}


def _deduplicate_and_rank_papers(
    papers: list[Any],
    disease_name: str,
    crop_name: str,
    max_results: int,
) -> tuple[list[Any], int]:
    from app.services.providers.base import normalize_doi

    by_key: dict[str, Any] = {}
    duplicates = 0
    for paper in papers:
        doi = normalize_doi(paper.doi)
        norm_title = re.sub(r"[^a-z0-9]+", " ", (paper.title or "").lower()).strip()
        if not norm_title:
            continue
        key = f"doi:{doi}" if doi else f"title:{norm_title[:120]}"
        if key in by_key:
            duplicates += 1
            existing = by_key[key]
            if paper.sourceProvider != existing.sourceProvider and paper.sourceProvider not in existing.additionalProviders:
                existing.additionalProviders.append(paper.sourceProvider)
            if not existing.abstract and paper.abstract:
                existing.abstract = paper.abstract
            if not existing.doi and paper.doi:
                existing.doi = paper.doi
            if not existing.journal and paper.journal:
                existing.journal = paper.journal
            if not existing.authors and paper.authors:
                existing.authors = paper.authors
            if existing.citationCount is None and paper.citationCount is not None:
                existing.citationCount = paper.citationCount
            continue
        by_key[key] = paper

    terms = _query_terms(disease_name, crop_name)
    now_year = datetime.now(timezone.utc).year
    ranked: list[Any] = []
    for paper in by_key.values():
        score = 0.0
        score += max(0.0, 3.0 - _tier_priority(paper.authoritativeTier)) * 2.0
        if paper.metadataValidated:
            score += 3.0
        if paper.doiVerificationStatus == "VERIFIED_MATCH":
            score += 4.0
        elif paper.doiVerificationStatus == "METADATA_MISMATCH":
            score -= 2.5
        elif paper.doiVerificationStatus == "DOI_NOT_FOUND":
            score -= 1.5
        if paper.abstract:
            score += 2.0
        if paper.publicationYear:
            age = max(0, now_year - paper.publicationYear)
            score += max(0.0, 2.0 - (age * 0.1))
        haystack = f"{paper.title} {paper.abstract or ''}".lower()
        matches = sum(1 for t in terms if t in haystack)
        score += min(4.0, matches * 1.0)
        paper.relevanceScore = round(score, 2)
        ranked.append(paper)

    ranked.sort(key=lambda p: (-p.relevanceScore, -(p.publicationYear or 0), p.title.lower()))
    trimmed = ranked[:max_results]
    for idx, p in enumerate(trimmed, start=1):
        p.evidenceRank = idx
    return trimmed, duplicates


def _compute_evidence_quality(papers: list[Any], sources: list[ResearchSource]) -> str:
    non_portal_sources = [s for s in sources if s.provider != "bangladesh_agri_official"]
    verified_papers = [
        p for p in papers if p.metadataValidated and (
            p.doiVerificationStatus == "VERIFIED_MATCH"
            or p.authoritativeTier in ("BANGLADESH_GOV_RESEARCH", "INTERNATIONAL_AGRI")
        )
    ]
    if len(verified_papers) >= 2:
        return "HIGH"
    if any(p.metadataValidated for p in papers) or len(non_portal_sources) >= 2:
        return "MODERATE"
    if non_portal_sources or papers:
        return "LIMITED"
    return "INSUFFICIENT"


def _run_web_search_track(queries: list[str], max_results: int) -> dict[str, Any]:
    from app.services.tavily_search_provider import TavilySearchProvider

    attempted: list[str] = ["google_selenium"]
    succeeded: list[str] = []
    failed: list[str] = []
    failure_reasons: dict[str, str] = {}

    status, raw_sources, err_code, sel_ver, browser_info = _run_selenium_google_search(queries, max_results)
    validated_selenium = _validate_and_rank_sources(raw_sources, max_results) if status == "COMPLETED" else []
    if status == "COMPLETED" and validated_selenium:
        succeeded.append("google_selenium")
        return {
            "sources": validated_selenium,
            "raw_count": len(raw_sources),
            "attempted": attempted,
            "succeeded": succeeded,
            "failed": failed,
            "failure_reasons": failure_reasons,
            "successful_provider": "google_selenium",
            "fallback_used": False,
            "fallback_reason": None,
            "selenium_status": status,
            "sel_ver": sel_ver,
            "browser_info": browser_info,
        }

    fallback_reason = err_code or f"SELENIUM_{status}"
    failed.append("google_selenium")
    failure_reasons["google_selenium"] = fallback_reason

    attempted.append("tavily")
    tavily_outcome = TavilySearchProvider().search(
        queries,
        max_results=max_results,
        domain_classifier=classify_domain_tier,
    )
    if tavily_outcome.ok:
        tavily_validated = _validate_and_rank_sources(tavily_outcome.sources, max_results)
        if tavily_validated:
            succeeded.append("tavily")
            return {
                "sources": tavily_validated,
                "raw_count": len(tavily_outcome.sources),
                "attempted": attempted,
                "succeeded": succeeded,
                "failed": failed,
                "failure_reasons": failure_reasons,
                "successful_provider": "tavily",
                "fallback_used": True,
                "fallback_reason": fallback_reason,
                "selenium_status": status,
                "sel_ver": sel_ver,
                "browser_info": browser_info,
            }

    failed.append("tavily")
    failure_reasons["tavily"] = tavily_outcome.reason
    return {
        "sources": [],
        "raw_count": 0,
        "attempted": attempted,
        "succeeded": succeeded,
        "failed": failed,
        "failure_reasons": failure_reasons,
        "successful_provider": None,
        "fallback_used": True,
        "fallback_reason": fallback_reason,
        "selenium_status": status,
        "sel_ver": sel_ver,
        "browser_info": browser_info,
        "tavily_reason": tavily_outcome.reason,
    }


def run_disease_research(req: DiseaseResearchRequest) -> DiseaseResearchResponse:
    import time as _time
    from concurrent.futures import ThreadPoolExecutor

    from app.core.config import settings
    from app.schemas.research import ResearchPaper
    from app.services.advisory_synthesizer import (
        synthesize_advisory,
        synthesize_evidence_bengali_report,
    )
    from app.services.providers import (
        BangladeshAgriProvider,
        CrossrefProvider,
        OpenAlexProvider,
        SemanticScholarProvider,
    )

    crop = infer_crop_from_disease(req.diseaseName, req.cropName)
    healthy = req.isHealthy if req.isHealthy is not None else is_healthy_class(req.diseaseName)
    low_conf = req.confidence is not None and req.confidence < _LOW_CONFIDENCE_THRESHOLD

    if healthy:
        report = synthesize_evidence_bengali_report(
            disease_name=req.diseaseName,
            crop_name=crop,
            confidence=req.confidence,
            is_healthy=True,
            papers=[],
            sources=[],
            evidence_quality="INSUFFICIENT",
        )
        advisory = synthesize_advisory(
            disease_name=req.diseaseName,
            crop_name=crop,
            confidence=req.confidence,
            is_healthy=True,
            papers=[],
            sources=[],
            evidence_quality="INSUFFICIENT",
            telemetry_context=req.telemetryContext,
        )
        return DiseaseResearchResponse(
            researchStatus="SKIPPED_HEALTHY",
            analysisId=req.analysisId,
            diseaseName=req.diseaseName,
            cropName=crop,
            isHealthy=True,
            lowConfidenceWarning=low_conf,
            queriesUsed=[],
            sources=[],
            sourceReferences=[],
            researchPapers=[],
            bengaliReport=report,
            advisory=advisory,
            searchProvidersAttempted=[],
            providersAttempted=[],
            successfulProviders=[],
            failedProviders=[],
            successfulProvider=None,
            fallbackUsed=False,
            fallbackReason=None,
            sourceCount=0,
            validatedSourceCount=0,
            duplicateCount=0,
            evidenceQuality="INSUFFICIENT",
        )

    cache_key = (req.diseaseName.strip().lower(), crop.strip().lower(), req.maxResults)
    now_mono = _time.monotonic()
    if settings.RESEARCH_CACHE_TTL_SEC > 0:
        with _CACHE_LOCK:
            cached = _RESEARCH_CACHE.get(cache_key)
            if cached and (now_mono - cached[0]) < settings.RESEARCH_CACHE_TTL_SEC:
                cached_resp = cached[1]
                fresh_adv = synthesize_advisory(
                    disease_name=req.diseaseName,
                    crop_name=crop,
                    confidence=req.confidence,
                    is_healthy=False,
                    papers=cached_resp.researchPapers,
                    sources=cached_resp.sources,
                    evidence_quality=cached_resp.evidenceQuality,
                    telemetry_context=req.telemetryContext,
                )
                return cached_resp.model_copy(update={"analysisId": req.analysisId, "advisory": fresh_adv})

    queries = build_google_queries(req.diseaseName, crop)
    academic_query = f"{format_readable_disease(req.diseaseName)} {crop} crop disease management"
    per_provider_limit = min(req.maxResults, settings.RESEARCH_MAX_RESULTS_PER_PROVIDER)

    bd_outcome = BangladeshAgriProvider().get_references(crop)
    bamis_status = dict(bd_outcome.metadata.get("bamisStatus") or {})

    with ThreadPoolExecutor(max_workers=max(2, min(4, settings.RESEARCH_MAX_WORKERS))) as pool:
        web_fut = pool.submit(_run_web_search_track, queries, req.maxResults)
        oa_fut = pool.submit(OpenAlexProvider().search, academic_query, per_provider_limit)
        s2_fut = pool.submit(SemanticScholarProvider().search, academic_query, per_provider_limit)

        web_res = web_fut.result()
        oa_out = oa_fut.result()
        s2_out = s2_fut.result()

    providers_attempted: list[str] = list(web_res["attempted"]) + ["openalex", "semantic_scholar"]
    successful_providers: list[str] = list(web_res["succeeded"])
    failed_providers: list[str] = list(web_res["failed"])
    failure_reasons: dict[str, str] = dict(web_res["failure_reasons"])

    raw_papers: list[ResearchPaper] = []
    raw_sources: list[ResearchSource] = list(web_res["sources"])

    for acad_out in (oa_out, s2_out):
        if acad_out.ok:
            successful_providers.append(acad_out.provider)
            raw_papers.extend(acad_out.papers)
            raw_sources.extend(acad_out.sources)
        else:
            failed_providers.append(acad_out.provider)
            failure_reasons[acad_out.provider] = acad_out.reason

    # Crossref DOI metadata verification & enrichment on top 4 unique DOIs
    papers_with_doi = [p for p in raw_papers if p.doi][:4]
    if papers_with_doi:
        providers_attempted.append("crossref")
        crossref = CrossrefProvider()
        cr_any_ok = False
        cr_fail_reason: str | None = None
        for p in papers_with_doi:
            ok_cr, cr_reason = crossref.verify_and_enrich(p)
            if ok_cr:
                cr_any_ok = True
            elif cr_fail_reason is None:
                cr_fail_reason = cr_reason
        if cr_any_ok:
            successful_providers.append("crossref")
        else:
            failed_providers.append("crossref")
            failure_reasons["crossref"] = cr_fail_reason or "unavailable"

    ranked_papers, duplicate_count = _deduplicate_and_rank_papers(
        raw_papers, req.diseaseName, crop, req.maxResults
    )

    providers_attempted.append("bangladesh_agri_official")
    if bd_outcome.ok:
        successful_providers.append("bangladesh_agri_official")

    non_portal_sources = _validate_and_rank_sources(raw_sources, req.maxResults)
    if non_portal_sources:
        combined_sources = _validate_and_rank_sources(
            non_portal_sources + bd_outcome.sources[:2], req.maxResults + 2
        )
    else:
        combined_sources = []

    evidence_quality = _compute_evidence_quality(ranked_papers, combined_sources)
    has_real_evidence = bool(non_portal_sources or ranked_papers)

    if not has_real_evidence:
        tavily_reason = web_res.get("tavily_reason", "")
        all_zero = (
            web_res.get("selenium_status") != "BLOCKED"
            and tavily_reason in ("zero_results", "missing_api_key", "")
        )
        if all_zero or (oa_out.reason == "zero_results" or s2_out.reason == "zero_results"):
            insufficient_report = synthesize_evidence_bengali_report(
                disease_name=req.diseaseName,
                crop_name=crop,
                confidence=req.confidence,
                is_healthy=False,
                papers=[],
                sources=[],
                evidence_quality="INSUFFICIENT",
            )
            insufficient_adv = synthesize_advisory(
                disease_name=req.diseaseName,
                crop_name=crop,
                confidence=req.confidence,
                is_healthy=False,
                papers=[],
                sources=[],
                evidence_quality="INSUFFICIENT",
                telemetry_context=req.telemetryContext,
            )
            return DiseaseResearchResponse(
                researchStatus="INSUFFICIENT_EVIDENCE",
                analysisId=req.analysisId,
                diseaseName=req.diseaseName,
                cropName=crop,
                isHealthy=False,
                lowConfidenceWarning=low_conf,
                queriesUsed=queries,
                sources=[],
                sourceReferences=[],
                researchPapers=[],
                bengaliReport=insufficient_report,
                advisory=insufficient_adv,
                errorCode="INSUFFICIENT_EVIDENCE",
                errorMessage="No verified sources or academic papers matched this query across active providers.",
                seleniumVersion=web_res["sel_ver"],
                browserInfo=web_res["browser_info"],
                searchProvidersAttempted=web_res["attempted"],
                successfulProvider=None,
                fallbackUsed=bool(web_res["fallback_used"]),
                fallbackReason=web_res["fallback_reason"],
                sourceCount=0,
                validatedSourceCount=0,
                providersAttempted=providers_attempted,
                successfulProviders=successful_providers,
                failedProviders=failed_providers,
                providerFailureReasons=failure_reasons,
                duplicateCount=duplicate_count,
                evidenceQuality="INSUFFICIENT",
                bamisStatus=bamis_status,
            )

        final_status = "BLOCKED" if web_res.get("selenium_status") == "BLOCKED" else "FAILED"
        fallback_reason = web_res.get("fallback_reason") or "SELENIUM_FAILED"
        err_code = f"{fallback_reason}+TAVILY_{str(tavily_reason).upper()}" if tavily_reason else fallback_reason
        return DiseaseResearchResponse(
            researchStatus=final_status,
            analysisId=req.analysisId,
            diseaseName=req.diseaseName,
            cropName=crop,
            isHealthy=False,
            lowConfidenceWarning=low_conf,
            queriesUsed=queries,
            sources=[],
            sourceReferences=[],
            researchPapers=[],
            bengaliReport=None,
            errorCode=err_code,
            errorMessage="Search and academic providers could not collect usable sources. Disease prediction remains valid.",
            seleniumVersion=web_res["sel_ver"],
            browserInfo=web_res["browser_info"],
            searchProvidersAttempted=web_res["attempted"],
            successfulProvider=None,
            fallbackUsed=bool(web_res["fallback_used"]),
            fallbackReason=fallback_reason,
            sourceCount=0,
            validatedSourceCount=0,
            providersAttempted=providers_attempted,
            successfulProviders=successful_providers,
            failedProviders=failed_providers,
            providerFailureReasons=failure_reasons,
            duplicateCount=duplicate_count,
            evidenceQuality="INSUFFICIENT",
            bamisStatus=bamis_status,
        )

    report = synthesize_evidence_bengali_report(
        disease_name=req.diseaseName,
        crop_name=crop,
        confidence=req.confidence,
        is_healthy=False,
        papers=ranked_papers,
        sources=combined_sources,
        evidence_quality=evidence_quality,
    )
    advisory = synthesize_advisory(
        disease_name=req.diseaseName,
        crop_name=crop,
        confidence=req.confidence,
        is_healthy=False,
        papers=ranked_papers,
        sources=combined_sources,
        evidence_quality=evidence_quality,
        telemetry_context=req.telemetryContext,
    )
    primary_provider = web_res["successful_provider"] or (
        "openalex" if oa_out.ok else ("semantic_scholar" if s2_out.ok else None)
    )
    resp = DiseaseResearchResponse(
        researchStatus="COMPLETED",
        analysisId=req.analysisId,
        diseaseName=req.diseaseName,
        cropName=crop,
        isHealthy=False,
        lowConfidenceWarning=low_conf,
        queriesUsed=queries,
        sources=combined_sources,
        sourceReferences=combined_sources,
        researchPapers=ranked_papers,
        bengaliReport=report,
        advisory=advisory,
        seleniumVersion=web_res["sel_ver"],
        browserInfo=web_res["browser_info"],
        searchProvidersAttempted=web_res["attempted"],
        successfulProvider=primary_provider,
        fallbackUsed=bool(web_res["fallback_used"]),
        fallbackReason=web_res["fallback_reason"],
        sourceCount=len(raw_sources) + len(raw_papers),
        validatedSourceCount=len(combined_sources) + len(ranked_papers),
        providersAttempted=providers_attempted,
        successfulProviders=successful_providers,
        failedProviders=failed_providers,
        providerFailureReasons=failure_reasons,
        duplicateCount=duplicate_count,
        evidenceQuality=evidence_quality,
        bamisStatus=bamis_status,
    )
    if settings.RESEARCH_CACHE_TTL_SEC > 0:
        with _CACHE_LOCK:
            if len(_RESEARCH_CACHE) >= 64:
                _RESEARCH_CACHE.clear()
            _RESEARCH_CACHE[cache_key] = (now_mono, resp)
    return resp
