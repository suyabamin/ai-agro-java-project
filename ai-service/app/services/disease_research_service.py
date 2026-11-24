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


def run_disease_research(req: DiseaseResearchRequest) -> DiseaseResearchResponse:
    from app.services.tavily_search_provider import TavilySearchProvider

    crop = infer_crop_from_disease(req.diseaseName, req.cropName)
    healthy = req.isHealthy if req.isHealthy is not None else is_healthy_class(req.diseaseName)
    low_conf = req.confidence is not None and req.confidence < _LOW_CONFIDENCE_THRESHOLD

    if healthy:
        report = build_bengali_report(req.diseaseName, crop, req.confidence, True, [])
        return DiseaseResearchResponse(
            researchStatus="SKIPPED_HEALTHY",
            analysisId=req.analysisId,
            diseaseName=req.diseaseName,
            cropName=crop,
            isHealthy=True,
            lowConfidenceWarning=low_conf,
            queriesUsed=[],
            sources=[],
            bengaliReport=report,
            searchProvidersAttempted=[],
            successfulProvider=None,
            fallbackUsed=False,
            fallbackReason=None,
            sourceCount=0,
            validatedSourceCount=0,
        )

    queries = build_google_queries(req.diseaseName, crop)
    providers_attempted = ["google_selenium"]
    status, raw_sources, err_code, sel_ver, browser_info = _run_selenium_google_search(queries, req.maxResults)
    validated_sources = _validate_and_rank_sources(raw_sources, req.maxResults) if status == "COMPLETED" else []

    if status == "COMPLETED" and validated_sources:
        report = build_bengali_report(req.diseaseName, crop, req.confidence, False, validated_sources)
        return DiseaseResearchResponse(
            researchStatus="COMPLETED",
            analysisId=req.analysisId,
            diseaseName=req.diseaseName,
            cropName=crop,
            isHealthy=False,
            lowConfidenceWarning=low_conf,
            queriesUsed=queries,
            sources=validated_sources,
            bengaliReport=report,
            seleniumVersion=sel_ver,
            browserInfo=browser_info,
            searchProvidersAttempted=providers_attempted,
            successfulProvider="google_selenium",
            fallbackUsed=False,
            fallbackReason=None,
            sourceCount=len(raw_sources),
            validatedSourceCount=len(validated_sources),
        )

    fallback_reason = err_code or f"SELENIUM_{status}"
    providers_attempted.append("tavily")
    tavily_outcome = TavilySearchProvider().search(
        queries,
        max_results=req.maxResults,
        domain_classifier=classify_domain_tier,
    )

    if tavily_outcome.ok:
        tavily_validated = _validate_and_rank_sources(tavily_outcome.sources, req.maxResults)
        if tavily_validated:
            report = build_bengali_report(req.diseaseName, crop, req.confidence, False, tavily_validated)
            return DiseaseResearchResponse(
                researchStatus="COMPLETED",
                analysisId=req.analysisId,
                diseaseName=req.diseaseName,
                cropName=crop,
                isHealthy=False,
                lowConfidenceWarning=low_conf,
                queriesUsed=queries,
                sources=tavily_validated,
                bengaliReport=report,
                seleniumVersion=sel_ver,
                browserInfo=browser_info,
                searchProvidersAttempted=providers_attempted,
                successfulProvider="tavily",
                fallbackUsed=True,
                fallbackReason=fallback_reason,
                sourceCount=len(tavily_outcome.sources),
                validatedSourceCount=len(tavily_validated),
            )

    if tavily_outcome.reason == "zero_results" or (tavily_outcome.ok and not tavily_outcome.sources):
        insufficient_report = build_bengali_report(req.diseaseName, crop, req.confidence, False, [])
        return DiseaseResearchResponse(
            researchStatus="INSUFFICIENT_EVIDENCE",
            analysisId=req.analysisId,
            diseaseName=req.diseaseName,
            cropName=crop,
            isHealthy=False,
            lowConfidenceWarning=low_conf,
            queriesUsed=queries,
            sources=[],
            bengaliReport=insufficient_report,
            errorCode="INSUFFICIENT_EVIDENCE",
            errorMessage="Neither Selenium Google Search nor Tavily returned usable agricultural sources.",
            seleniumVersion=sel_ver,
            browserInfo=browser_info,
            searchProvidersAttempted=providers_attempted,
            successfulProvider=None,
            fallbackUsed=True,
            fallbackReason=fallback_reason,
            sourceCount=0,
            validatedSourceCount=0,
        )

    final_status = "BLOCKED" if status == "BLOCKED" and tavily_outcome.reason == "missing_api_key" else (
        "BLOCKED" if status == "BLOCKED" else "FAILED"
    )
    msg = (
        f"Primary Google Search ({fallback_reason}) and Tavily fallback ({tavily_outcome.reason}) "
        "could not collect verified agricultural sources. Disease prediction remains valid."
    )
    return DiseaseResearchResponse(
        researchStatus=final_status,
        analysisId=req.analysisId,
        diseaseName=req.diseaseName,
        cropName=crop,
        isHealthy=False,
        lowConfidenceWarning=low_conf,
        queriesUsed=queries,
        sources=[],
        bengaliReport=None,
        errorCode=f"{fallback_reason}+TAVILY_{tavily_outcome.reason.upper()}",
        errorMessage=msg,
        seleniumVersion=sel_ver,
        browserInfo=browser_info,
        searchProvidersAttempted=providers_attempted,
        successfulProvider=None,
        fallbackUsed=True,
        fallbackReason=fallback_reason,
        sourceCount=0,
        validatedSourceCount=0,
    )
