export type DiseaseUiLang = 'bn' | 'en';

export const DISEASE_UI_LANG_KEY = 'agroai_disease_ui_lang';

export function getInitialDiseaseUiLang(): DiseaseUiLang {
  try {
    const storage =
      typeof window !== 'undefined' && window.localStorage
        ? window.localStorage
        : typeof localStorage !== 'undefined'
          ? localStorage
          : null;
    const saved = storage?.getItem(DISEASE_UI_LANG_KEY);
    if (saved === 'en' || saved === 'bn') return saved;
  } catch {
    // Ignore storage access errors in SSR/tests
  }
  return 'bn';
}

export interface DiseaseClassificationInfo {
  pathogenName: string | null;
  classificationBn: string;
  classificationEn: string;
}

export function extractDiseaseClassification(
  diseaseRaw: string | null | undefined,
  evidenceTexts: string[] = []
): DiseaseClassificationInfo {
  const combined = `${diseaseRaw || ''} ${evidenceTexts.join(' ')}`.toLowerCase();

  if (combined.includes('phytophthora') || combined.includes('late_blight') || combined.includes('late blight')) {
    return {
      pathogenName: 'Phytophthora infestans',
      classificationBn: 'ওমাইসিট (Oomycete — সত্যিকারের ছত্রাক নয়)',
      classificationEn: 'Oomycete (water mold, not a true fungus)',
    };
  }
  if (combined.includes('alternaria') || combined.includes('early_blight') || combined.includes('early blight')) {
    return {
      pathogenName: 'Alternaria solani',
      classificationBn: 'ছত্রাকজনিত রোগ (Fungus)',
      classificationEn: 'Fungal disease (Fungus)',
    };
  }
  if (combined.includes('magnaporthe') || combined.includes('rice_blast') || combined.includes('blast')) {
    return {
      pathogenName: 'Magnaporthe oryzae',
      classificationBn: 'ছত্রাকজনিত রোগ (Fungus)',
      classificationEn: 'Fungal disease (Fungus)',
    };
  }
  if (combined.includes('xanthomonas') || combined.includes('bacterial')) {
    return {
      pathogenName: combined.includes('xanthomonas') ? 'Xanthomonas spp.' : null,
      classificationBn: 'ব্যাকটেরিয়াজনিত রোগ (Bacterium)',
      classificationEn: 'Bacterial disease (Bacterium)',
    };
  }
  if (combined.includes('virus') || combined.includes('mosaic') || combined.includes('curl')) {
    return {
      pathogenName: null,
      classificationBn: 'ভাইরাসজনিত রোগ (Virus)',
      classificationEn: 'Viral disease (Virus)',
    };
  }
  if (combined.includes('healthy') || combined.includes('normal')) {
    return {
      pathogenName: null,
      classificationBn: 'সুস্থ অবস্থা (কোনো রোগ শনাক্ত হয়নি)',
      classificationEn: 'Healthy (no disease detected)',
    };
  }
  return {
    pathogenName: null,
    classificationBn: 'শ্রেণিবিন্যাস সংগৃহীত প্রমাণের ওপর নির্ভরশীল',
    classificationEn: 'Classification depends on retrieved evidence',
  };
}

export interface ParsedEvidenceBlock {
  citationId: string | null;
  bnText: string | null;
  enText: string | null;
  isFallbackOnly: boolean;
}

export function parseEvidenceBlocks(rawText: string | undefined | null): ParsedEvidenceBlock[] {
  if (!rawText || !rawText.trim()) return [];
  const segments = rawText.split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean);

  return segments.map((seg) => {
    let working = seg;
    let citationId: string | null = null;

    const citeStartMatch = working.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (citeStartMatch && !citeStartMatch[1].startsWith('ইংরেজি প্রমাণ') && !citeStartMatch[1].startsWith('মূল উৎস')) {
      citationId = citeStartMatch[1];
      working = citeStartMatch[2].trim();
    } else {
      const citeEndMatch = working.match(/^(.*?)\s*\[([a-zA-Z0-9_.:-]+)\]\s*$/);
      if (citeEndMatch) {
        const prefix = citeEndMatch[1];
        const openCount = (prefix.match(/\[/g) || []).length;
        const closeCount = (prefix.match(/\]/g) || []).length;
        if (openCount === closeCount) {
          working = prefix.trim();
          citationId = citeEndMatch[2];
        }
      }
    }

    const fallbackMatch = working.match(/^\[ইংরেজি প্রমাণ \/ Evidence EN\]:?\s*(.*)$/);
    if (fallbackMatch) {
      return {
        citationId,
        bnText: null,
        enText: fallbackMatch[1].trim() || null,
        isFallbackOnly: true,
      };
    }

    const origMatch = working.match(/^(.*?)\s*\[মূল উৎস \(EN\):\s*(.+)\]$/);
    if (origMatch) {
      return {
        citationId,
        bnText: origMatch[1].trim() || null,
        enText: origMatch[2].trim() || null,
        isFallbackOnly: false,
      };
    }

    const hasBengali = /[\u0980-\u09FF]/.test(working);
    return {
      citationId,
      bnText: hasBengali ? working : null,
      enText: hasBengali ? null : working,
      isFallbackOnly: !hasBengali,
    };
  });
}

export interface DiseaseUiStrings {
  langBn: string;
  langEn: string;
  sectionSummary: string;
  sectionOverview: string;
  sectionSymptoms: string;
  sectionCausesSpread: string;
  sectionImpact: string;
  sectionActions: string;
  sectionAgronomist: string;
  sectionPapers: string;
  sectionSources: string;
  sectionAdvisory: string;
  cropLabel: string;
  predictedDiseaseLabel: string;
  scientificNameLabel: string;
  classificationLabel: string;
  modelLabel: string;
  confidenceLabel: string;
  timestampLabel: string;
  rawClassLabel: string;
  topPredictionsLabel: string;
  healthyBadge: string;
  diseaseBadge: string;
  pendingModelText: string;
  retryAnalysis: string;
  modelUnavailableFallback: string;
  aiDisclaimer: string;
  researchHeading: string;
  fetchResearch: string;
  retryResearch: string;
  startingResearch: string;
  researchRunning: string;
  researchBlockedFallback: string;
  evidenceQualityLabel: string;
  primaryProviderLabel: string;
  providersAttemptedLabel: string;
  unavailableProvidersLabel: string;
  lowConfidenceWarning: string;
  originalEvidenceToggle: string;
  translationUnavailableNotice: string;
  noEvidenceFound: string;
  causalOrganismLabel: string;
  spreadLabel: string;
  environmentLabel: string;
  immediateGroup: string;
  shortTermGroup: string;
  preventiveGroup: string;
  uncitedGuidance: string;
  citationsLabel: string;
  authorsLabel: string;
  yearLabel: string;
  journalLabel: string;
  doiLabel: string;
  doiStatusLabel: string;
  openAccessLabel: string;
  restrictedAccessLabel: string;
  abstractAvailable: string;
  abstractUnavailable: string;
  expandAbstract: string;
  openSourceLink: string;
  portalReferenceBadge: string;
  retrievedContentBadge: string;
  academicBadge: string;
  portalNotice: string;
  advisoryStatusLabel: string;
  severityLabel: string;
  confidenceBandLabel: string;
  escalationAlertLabel: string;
  telemetryContextLabel: string;
  noTelemetryNotice: string;
  attemptsRecordedLabel: string;
}

export const DISEASE_UI_STRINGS: Record<DiseaseUiLang, DiseaseUiStrings> = {
  bn: {
    langBn: 'বাংলা',
    langEn: 'English',
    sectionSummary: 'ক. রোগের সারসংক্ষেপ',
    sectionOverview: 'খ. রোগের পরিচিতি',
    sectionSymptoms: 'গ. লক্ষণসমূহ',
    sectionCausesSpread: 'ঘ. কারণ ও রোগ ছড়ানোর উপায়',
    sectionImpact: 'ঙ. সম্ভাব্য ক্ষতি ও ফলনের ওপর প্রভাব',
    sectionActions: 'চ. করণীয় পদক্ষেপ',
    sectionAgronomist: 'ছ. কখন কৃষি কর্মকর্তার পরামর্শ নেবেন',
    sectionPapers: 'জ. গবেষণাপত্র ভিত্তিক প্রমাণ',
    sectionSources: 'ঝ. কৃষি তথ্যসূত্র ও সরকারি পোর্টাল',
    sectionAdvisory: 'প্রমাণভিত্তিক কৃষি পরামর্শ',
    cropLabel: 'ফসল',
    predictedDiseaseLabel: 'শনাক্তকৃত অবস্থা/রোগ',
    scientificNameLabel: 'বৈজ্ঞানিক নাম / জীবাণু',
    classificationLabel: 'জীবাণুর শ্রেণি',
    modelLabel: 'মডেল',
    confidenceLabel: 'মডেলের আত্মবিশ্বাস',
    timestampLabel: 'মূল্যায়নের সময়',
    rawClassLabel: 'মডেল শ্রেণি',
    topPredictionsLabel: 'শীর্ষ ৩টি মডেল পূর্বাভাস',
    healthyBadge: 'সুস্থ',
    diseaseBadge: 'রোগ শনাক্ত',
    pendingModelText: 'আপলোড করা পাতার ছবিতে TFLite রোগ শনাক্তকরণ মডেল চালানো হচ্ছে...',
    retryAnalysis: 'পুনরায় বিশ্লেষণ করুন',
    modelUnavailableFallback: 'রোগ শনাক্তকরণ সম্পন্ন করা যায়নি; কোনো অনুমানভিত্তিক ফলাফল তৈরি করা হয়নি।',
    aiDisclaimer: 'এটি AI-ভিত্তিক প্রাথমিক মূল্যায়ন মাত্র; চূড়ান্ত রোগ নির্ণয় নয়।',
    researchHeading: 'গবেষণা ও দ্বিভাষিক পরামর্শ',
    fetchResearch: 'গবেষণা সংগ্রহ করুন',
    retryResearch: 'পুনরায় গবেষণা করুন',
    startingResearch: 'শুরু হচ্ছে...',
    researchRunning: 'বহুমুখী কৃষি গবেষণা উৎস অনুসন্ধান চলছে...',
    researchBlockedFallback: 'অনুসন্ধান সেবা সাময়িকভাবে সীমিত বা ব্যর্থ হয়েছে; উপরের রোগ শনাক্তকরণ ফলাফল অপরিবর্তিত রয়েছে।',
    evidenceQualityLabel: 'প্রমাণের মান',
    primaryProviderLabel: 'প্রধান উৎস',
    providersAttemptedLabel: 'সফল উৎসসমূহ',
    unavailableProvidersLabel: 'অনুপলব্ধ উৎস',
    lowConfidenceWarning: 'সতর্কতা: মডেলের আত্মবিশ্বাস ৬০%-এর কম — মাঠ পর্যায়ে কৃষি কর্মকর্তার সাথে যাচাই করুন।',
    originalEvidenceToggle: 'মূল প্রমাণ দেখুন (EN)',
    translationUnavailableNotice: 'এই অংশের নির্ভরযোগ্য বাংলা অনুবাদ পাওয়া যায়নি; নিচের মূল ইংরেজি প্রমাণ দেখুন।',
    noEvidenceFound: 'এই অংশের জন্য সংগৃহীত উৎসে নির্দিষ্ট প্রমাণ পাওয়া যায়নি।',
    causalOrganismLabel: 'রোগের কারণ / জীবাণু',
    spreadLabel: 'রোগ ছড়ানোর মাধ্যম',
    environmentLabel: 'পরিবেশগত ও মাঠের অবস্থা',
    immediateGroup: 'তাৎক্ষণিক করণীয়',
    shortTermGroup: 'স্বল্পমেয়াদী করণীয়',
    preventiveGroup: 'প্রতিরোধমূলক ব্যবস্থাপনা',
    uncitedGuidance: 'সাধারণ সতর্কতা (সরাসরি গবেষণাপত্রের উদ্ধৃতি অনুপস্থিত)',
    citationsLabel: 'তথ্যসূত্র',
    authorsLabel: 'লেখক',
    yearLabel: 'বছর',
    journalLabel: 'জার্নাল',
    doiLabel: 'DOI',
    doiStatusLabel: 'DOI যাচাই',
    openAccessLabel: 'উন্মুক্ত প্রবেশাধিকার (Open Access)',
    restrictedAccessLabel: 'সীমিত প্রবেশাধিকার',
    abstractAvailable: 'সারাংশ সংযুক্ত',
    abstractUnavailable: 'সারাংশ অনুপলব্ধ',
    expandAbstract: 'সারাংশ দেখুন',
    openSourceLink: 'মূল লিংক খুলুন',
    portalReferenceBadge: 'সরকারি পোর্টাল রেফারেন্স (বিষয়বস্তু সংগ্রহ করা হয়নি)',
    retrievedContentBadge: 'সংগৃহীত সম্প্রসারণ তথ্য',
    academicBadge: 'গবেষণা প্রকাশনা',
    portalNotice: 'BAMIS, DAE, BARI ও BRRI পোর্টালগুলো কেবল অনুমোদিত রেফারেন্স হিসেবে দেখানো হয়েছে; ওয়েব স্ক্র্যাপিং করা হয়নি।',
    advisoryStatusLabel: 'পরামর্শের অবস্থা',
    severityLabel: 'তীব্রতা',
    confidenceBandLabel: 'আত্মবিশ্বাসের স্তর',
    escalationAlertLabel: 'কৃষিবিদের পরামর্শ প্রয়োজন',
    telemetryContextLabel: 'মাঠের সর্বশেষ টেলিমেট্রি প্রেক্ষাপট',
    noTelemetryNotice: 'সর্বশেষ টেলিমেট্রি তথ্য পাওয়া যায়নি বা অসম্পূর্ণ।',
    attemptsRecordedLabel: 'নথিভুক্ত গবেষণা প্রচেষ্টা',
  },
  en: {
    langBn: 'বাংলা',
    langEn: 'English',
    sectionSummary: 'A. Disease Summary',
    sectionOverview: 'B. Disease Overview',
    sectionSymptoms: 'C. Symptoms',
    sectionCausesSpread: 'D. Causes & Spread',
    sectionImpact: 'E. Potential Impact',
    sectionActions: 'F. Recommended Actions',
    sectionAgronomist: 'G. When to Contact an Agronomist',
    sectionPapers: 'H. Research Evidence (Papers)',
    sectionSources: 'I. Agricultural Sources & Portals',
    sectionAdvisory: 'Evidence-Based Agronomic Advisory',
    cropLabel: 'Crop',
    predictedDiseaseLabel: 'Predicted Condition / Disease',
    scientificNameLabel: 'Scientific / Pathogen Name',
    classificationLabel: 'Organism Classification',
    modelLabel: 'Model',
    confidenceLabel: 'Model Confidence',
    timestampLabel: 'Evaluated At',
    rawClassLabel: 'Raw class',
    topPredictionsLabel: 'Top 3 Model Predictions',
    healthyBadge: 'Healthy',
    diseaseBadge: 'Disease Detected',
    pendingModelText: 'Running TFLite disease model on uploaded leaf image...',
    retryAnalysis: 'Retry Analysis',
    modelUnavailableFallback: 'Disease inference could not be completed. No diagnosis or healthy status was fabricated.',
    aiDisclaimer: 'AI-assisted screening only; not a confirmed laboratory or agronomic diagnosis.',
    researchHeading: 'Research Evidence & Bilingual Guidance',
    fetchResearch: 'Fetch Research',
    retryResearch: 'Retry Research',
    startingResearch: 'Starting...',
    researchRunning: 'Searching multi-source agricultural evidence in background...',
    researchBlockedFallback: 'Search providers were temporarily blocked or unavailable. Disease prediction above remains valid.',
    evidenceQualityLabel: 'Evidence Quality',
    primaryProviderLabel: 'Primary Provider',
    providersAttemptedLabel: 'Successful Providers',
    unavailableProvidersLabel: 'Unavailable Providers',
    lowConfidenceWarning: 'Low model confidence (<60%): verify in the field with an agricultural officer.',
    originalEvidenceToggle: 'Original evidence (EN)',
    translationUnavailableNotice: 'Reliable translation unavailable; inspect the preserved original evidence below.',
    noEvidenceFound: 'No specific evidence found for this section in the retrieved sources.',
    causalOrganismLabel: 'Causal Organism / Factors',
    spreadLabel: 'Spread Mechanisms',
    environmentLabel: 'Environmental & Field Context',
    immediateGroup: 'Immediate Actions',
    shortTermGroup: 'Short-Term Actions',
    preventiveGroup: 'Preventive Management',
    uncitedGuidance: 'Uncited general guidance (no direct abstract match)',
    citationsLabel: 'Citations',
    authorsLabel: 'Authors',
    yearLabel: 'Year',
    journalLabel: 'Journal',
    doiLabel: 'DOI',
    doiStatusLabel: 'DOI Verification',
    openAccessLabel: 'Open Access',
    restrictedAccessLabel: 'Full text restricted',
    abstractAvailable: 'Abstract available',
    abstractUnavailable: 'Abstract unavailable',
    expandAbstract: 'View abstract',
    openSourceLink: 'Open source',
    portalReferenceBadge: 'Official Portal Reference (content not retrieved)',
    retrievedContentBadge: 'Retrieved Extension Content',
    academicBadge: 'Academic Publication',
    portalNotice: 'BAMIS, DAE, BARI, and BRRI links are shown strictly as attributed official portal references without scraping.',
    advisoryStatusLabel: 'Advisory Status',
    severityLabel: 'Severity',
    confidenceBandLabel: 'Confidence Band',
    escalationAlertLabel: 'Agronomist Escalation Required',
    telemetryContextLabel: 'Latest Field Telemetry Context',
    noTelemetryNotice: 'No recent field telemetry context available.',
    attemptsRecordedLabel: 'Research attempts recorded',
  },
};
