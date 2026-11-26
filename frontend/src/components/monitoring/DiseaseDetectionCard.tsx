import React, { useState } from 'react';
import type { MonitoringRecord } from '../../services/monitoringService';
import { StatusBadge } from '../ui/StatusBadge';
import {
  DISEASE_UI_LANG_KEY,
  DISEASE_UI_STRINGS,
  extractDiseaseClassification,
  getInitialDiseaseUiLang,
  parseEvidenceBlocks,
  type DiseaseUiLang,
  type ParsedEvidenceBlock,
} from './diseaseIntelligenceI18n';

export interface TopPredictionItem {
  classIndex?: number;
  className?: string;
  confidence?: number;
}

export interface ResearchSourceItem {
  title?: string;
  url?: string;
  domain?: string;
  snippet?: string;
  extractedSummary?: string;
  authoritativeTier?: string;
  retrievedAt?: string;
  provider?: string;
}

export interface ResearchPaperItem {
  paperId?: string;
  title?: string;
  authors?: string[];
  publicationYear?: number;
  doi?: string;
  journal?: string;
  abstract?: string;
  url?: string;
  domain?: string;
  isOpenAccess?: boolean;
  citationCount?: number;
  sourceProvider?: string;
  additionalProviders?: string[];
  authoritativeTier?: string;
  metadataValidated?: boolean;
  sourceIdentityVerified?: boolean;
  scientificEvidenceAssessed?: boolean;
  doiVerificationStatus?: string;
  evidenceRank?: number;
}

export interface BengaliResearchReportItem {
  summaryBn?: string;
  overviewBn?: string;
  symptomsBn?: string;
  causesBn?: string;
  spreadBn?: string;
  damageBn?: string;
  immediateActionBn?: string;
  managementBn?: string;
  preventionBn?: string;
  whenToConsultBn?: string;
  referencesBn?: string;
  cautionBn?: string;
  evidenceNoticeBn?: string;
}

export interface AdvisoryActionStepItem {
  priority?: 'IMMEDIATE' | 'SHORT_TERM' | 'PREVENTIVE' | string;
  titleEn?: string;
  titleBn?: string;
  detailEn?: string;
  detailBn?: string;
  citationIds?: string[];
}

export interface AdvisoryPayloadItem {
  advisoryStatus?: string;
  severityLevel?: string;
  confidenceBand?: string;
  evidenceQuality?: string;
  escalationRequired?: boolean;
  escalationReasonBn?: string;
  escalationReasonEn?: string;
  telemetryContextNotes?: string[];
  actionableSteps?: AdvisoryActionStepItem[];
  citedPaperIds?: string[];
  citedSourceDomains?: string[];
  disclaimerBn?: string;
  disclaimerEn?: string;
}

export function formatDiseaseLabel(raw: string | undefined | null): string {
  if (!raw) return 'Unknown';
  return raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parseConfidencePercent(record: MonitoringRecord | null | undefined): number | null {
  if (!record) return null;
  const status = String(record.status || '').toUpperCase();
  if (status !== 'COMPLETED') return null;

  const direct = record.confidence;
  if (typeof direct === 'number' && Number.isFinite(direct)) {
    return direct <= 1 ? direct * 100 : direct;
  }
  const score = record.confidenceScore;
  if (typeof score === 'number' && Number.isFinite(score)) {
    return score <= 1 ? score * 100 : score;
  }
  return null;
}

function inferCropLabel(diseaseRaw: string | null | undefined, record: MonitoringRecord): string {
  if (record.cropName) return String(record.cropName);
  const raw = String(diseaseRaw || '');
  const idx = raw.indexOf('_');
  return idx > 0 ? raw.slice(0, idx) : 'Crop';
}

interface EvidenceBlockListProps {
  blocks: ParsedEvidenceBlock[];
  lang: DiseaseUiLang;
  emptyText: string;
  toggleLabel: string;
  translationUnavailableNotice: string;
}

const EvidenceBlockList: React.FC<EvidenceBlockListProps> = ({
  blocks,
  lang,
  emptyText,
  toggleLabel,
  translationUnavailableNotice,
}) => {
  if (blocks.length === 0) {
    return <p className="text-[11px] text-on-surface-variant">{emptyText}</p>;
  }
  return (
    <div className="space-y-2.5">
      {blocks.map((blk, i) => {
        const primaryText =
          lang === 'bn'
            ? blk.bnText || translationUnavailableNotice
            : blk.enText || blk.bnText || emptyText;
        const showExpandableOriginal = Boolean(blk.enText && (lang === 'bn' || blk.enText !== primaryText));
        return (
          <div
            key={`${blk.citationId || 'blk'}-${i}`}
            className="w-full min-w-0 p-3 rounded-lg bg-surface-container border border-outline-variant/20 space-y-2"
          >
            {blk.citationId && (
              <div className="flex flex-wrap items-center gap-1.5 w-full min-w-0">
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary max-w-full break-all">
                  {blk.citationId}
                </span>
              </div>
            )}
            <p className="w-full min-w-0 text-xs text-on-surface leading-relaxed break-words">
              {primaryText}
            </p>
            {showExpandableOriginal && blk.enText && (
              <details className="w-full min-w-0 text-[11px] text-on-surface-variant">
                <summary className="cursor-pointer font-semibold text-primary hover:underline select-none">
                  {toggleLabel}
                </summary>
                <p className="mt-1.5 w-full min-w-0 p-2.5 rounded bg-surface-container-lowest border border-outline-variant/20 font-normal leading-relaxed break-words">
                  {blk.enText}
                </p>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
};

interface DiseaseDetectionCardProps {
  title?: string;
  analysis: MonitoringRecord | null;
  fieldCropType?: string | null;
  onRetry?: () => void;
  onTriggerResearch?: (analysisId: string) => void;
  researchBusy?: boolean;
  researchHistory?: MonitoringRecord[];
}

export const DiseaseDetectionCard: React.FC<DiseaseDetectionCardProps> = ({
  title = 'Disease Intelligence',
  analysis,
  fieldCropType,
  onRetry,
  onTriggerResearch,
  researchBusy = false,
  researchHistory = [],
}) => {
  const [lang, setLang] = useState<DiseaseUiLang>(() => getInitialDiseaseUiLang());
  const ui = DISEASE_UI_STRINGS[lang];

  const handleLangChange = (next: DiseaseUiLang) => {
    setLang(next);
    try {
      localStorage.setItem(DISEASE_UI_LANG_KEY, next);
    } catch {
      // Ignore storage errors
    }
  };

  if (!analysis) {
    return null;
  }

  const status = String(analysis.status || 'UNKNOWN').toUpperCase();
  const analysisId = String(analysis.analysisId || analysis.id || '');
  const diseaseRaw = analysis.diseaseName || analysis.predictedClass;
  const diseaseName = diseaseRaw ? formatDiseaseLabel(String(diseaseRaw)) : null;
  const cropLabel = inferCropLabel(diseaseRaw ? String(diseaseRaw) : null, analysis);
  const confidencePct = parseConfidencePercent(analysis);
  const isHealthy = typeof analysis.isHealthy === 'boolean' ? analysis.isHealthy : null;
  const modelName = analysis.modelName ? String(analysis.modelName) : 'crop_disease_model';
  const modelVersion = analysis.modelVersion ? String(analysis.modelVersion) : null;
  const timestamp = analysis.completedAt || analysis.updatedAt || analysis.createdAt;
  const topPredictions = Array.isArray(analysis.topPredictions)
    ? (analysis.topPredictions as TopPredictionItem[])
    : [];

  const researchStatus = analysis.researchStatus ? String(analysis.researchStatus).toUpperCase() : null;
  const researchSnapshot = (analysis.researchReport as Record<string, unknown> | undefined) || undefined;
  const bengaliReport = (researchSnapshot?.bengaliReport as BengaliResearchReportItem | undefined) || undefined;
  const advisory = (researchSnapshot?.advisory as AdvisoryPayloadItem | undefined) || undefined;
  const researchSources = Array.isArray(researchSnapshot?.sources)
    ? (researchSnapshot?.sources as ResearchSourceItem[])
    : [];
  const researchPapers = Array.isArray(researchSnapshot?.researchPapers)
    ? (researchSnapshot?.researchPapers as ResearchPaperItem[])
    : [];
  const lowConfWarning = Boolean(researchSnapshot?.lowConfidenceWarning);
  const successfulProvider = researchSnapshot?.successfulProvider ? String(researchSnapshot.successfulProvider) : null;
  const fallbackUsed = Boolean(researchSnapshot?.fallbackUsed);
  const successfulProviders = Array.isArray(researchSnapshot?.successfulProviders)
    ? (researchSnapshot?.successfulProviders as string[])
    : [];
  const failedProviders = Array.isArray(researchSnapshot?.failedProviders)
    ? (researchSnapshot?.failedProviders as string[])
    : [];
  const evidenceQuality = researchSnapshot?.evidenceQuality ? String(researchSnapshot.evidenceQuality) : null;

  const classification = extractDiseaseClassification(
    diseaseRaw ? String(diseaseRaw) : null,
    [
      bengaliReport?.causesBn || '',
      bengaliReport?.symptomsBn || '',
      ...researchPapers.map((p) => `${p.title || ''} ${p.abstract || ''}`),
    ]
  );

  const symptomBlocks = parseEvidenceBlocks(bengaliReport?.symptomsBn);
  const causeBlocks = parseEvidenceBlocks(bengaliReport?.causesBn);
  const spreadBlocks = parseEvidenceBlocks(bengaliReport?.spreadBn);
  const managementBlocks = parseEvidenceBlocks(bengaliReport?.managementBn);

  const actionSteps = Array.isArray(advisory?.actionableSteps) ? advisory.actionableSteps : [];
  const immediateSteps = actionSteps.filter((s) => s.priority === 'IMMEDIATE');
  const shortTermSteps = actionSteps.filter((s) => s.priority === 'SHORT_TERM');
  const preventiveSteps = actionSteps.filter((s) => s.priority === 'PREVENTIVE');
  const telemetryNotes = Array.isArray(advisory?.telemetryContextNotes) ? advisory.telemetryContextNotes : [];

  const portalSources = researchSources.filter((s) => s.provider === 'bangladesh_agri_official');
  const contentSources = researchSources.filter((s) => s.provider !== 'bangladesh_agri_official');

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-surface-container-low border border-outline-variant/30 space-y-4">
      {/* Header + Bilingual Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-primary">biotech</span>
          <span className="text-sm font-extrabold text-on-surface">{title}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Language switch"
            className="inline-flex rounded-lg bg-surface-container border border-outline-variant/30 p-0.5"
          >
            <button
              type="button"
              onClick={() => handleLangChange('bn')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                lang === 'bn'
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {ui.langBn}
            </button>
            <button
              type="button"
              onClick={() => handleLangChange('en')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                lang === 'en'
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {ui.langEn}
            </button>
          </div>
          {analysisId && (
            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
              {analysisId.length > 20 ? `${analysisId.substring(0, 20)}...` : analysisId}
            </span>
          )}
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Pending / Processing */}
      {(status === 'PENDING' || status === 'PROCESSING') && (
        <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20 flex items-center gap-2.5 text-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-[18px] text-primary animate-spin">progress_activity</span>
          <span>{ui.pendingModelText}</span>
        </div>
      )}

      {/* Unavailable / Failed */}
      {(status === 'MODEL_UNAVAILABLE' || status === 'FAILED') && (
        <div className="p-3.5 rounded-xl bg-error/10 border border-error/30 space-y-2">
          <p className="text-xs text-error font-medium leading-relaxed">
            {String(analysis.errorMessage || analysis.failureReason || ui.modelUnavailableFallback)}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-[11px] font-bold hover:bg-secondary transition-colors cursor-pointer"
            >
              {ui.retryAnalysis}
            </button>
          )}
        </div>
      )}

      {/* Completed Result */}
      {status === 'COMPLETED' && diseaseName && confidencePct !== null && (
        <div className="space-y-4">
          {/* A. Disease Summary */}
          <section className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/25 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-primary">
                {ui.sectionSummary}
              </h4>
              {isHealthy === true ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  {ui.healthyBadge}
                </span>
              ) : isHealthy === false ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  {ui.diseaseBadge}
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-surface-container-low">
                <span className="text-[10px] font-bold text-on-surface-variant block">{ui.cropLabel}</span>
                <span className="font-bold text-on-surface">{cropLabel}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface-container-low">
                <span className="text-[10px] font-bold text-on-surface-variant block">{ui.predictedDiseaseLabel}</span>
                <span className="font-extrabold text-on-surface">{diseaseName}</span>
                <span className="block font-mono text-[10px] text-on-surface-variant mt-0.5">
                  {ui.rawClassLabel}: {String(diseaseRaw)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface-container-low">
                <span className="text-[10px] font-bold text-on-surface-variant block">{ui.scientificNameLabel}</span>
                <span className="font-semibold italic text-on-surface">
                  {classification.pathogenName || '—'}
                </span>
                <span className="block text-[10px] text-on-surface-variant mt-0.5">
                  {lang === 'bn' ? classification.classificationBn : classification.classificationEn}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface-container-low">
                <span className="text-[10px] font-bold text-on-surface-variant block">{ui.confidenceLabel}</span>
                <span className="text-lg font-extrabold text-primary">{confidencePct.toFixed(1)}%</span>
                <span className="block font-mono text-[10px] text-on-surface-variant">
                  {modelName}{modelVersion ? `@${modelVersion}` : ''}
                </span>
              </div>
            </div>

            {/* Top 3 Predictions */}
            {topPredictions.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block">
                  {ui.topPredictionsLabel}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {topPredictions.slice(0, 3).map((pred, idx) => {
                    const pct = typeof pred.confidence === 'number' ? pred.confidence : 0;
                    return (
                      <div
                        key={`${pred.classIndex ?? idx}-${pred.className ?? idx}`}
                        className="p-2 rounded-lg bg-surface-container border border-outline-variant/20 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px] gap-1">
                          <span className="font-semibold text-on-surface truncate">
                            {idx + 1}. {formatDiseaseLabel(pred.className)}
                          </span>
                          <span className="font-mono font-bold text-primary shrink-0">{pct.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-surface-container-lowest overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-outline-variant/20 text-[10px] text-on-surface-variant">
              <span>{ui.aiDisclaimer}</span>
              <span>
                {ui.timestampLabel}: {timestamp ? new Date(String(timestamp)).toLocaleString() : '—'}
              </span>
            </div>

            {fieldCropType &&
              cropLabel &&
              cropLabel.toLowerCase() !== 'crop' &&
              fieldCropType.trim().toLowerCase() !== cropLabel.trim().toLowerCase() && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/35 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5"
                >
                  <span className="material-symbols-outlined text-[18px] text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                    warning
                  </span>
                  <div className="space-y-0.5">
                    <p className="font-bold">
                      {lang === 'bn'
                        ? `ফসলের সাথে শনাক্তকৃত ফলাফলের অমিল: এই জমি "${fieldCropType}" হিসেবে নিবন্ধিত, কিন্তু মডেল "${cropLabel}" শনাক্ত করেছে।`
                        : `Crop/Detection Mismatch: This field is registered as "${fieldCropType}", while the model detected "${cropLabel}".`}
                    </p>
                    <p className="text-[11px] opacity-90">
                      {lang === 'bn'
                        ? 'মূল মডেলের ফলাফল অপরিবর্তিত রাখা হয়েছে। সঠিক পাতার ছবি যাচাই করুন অথবা কৃষি কর্মকর্তার পরামর্শ নিন।'
                        : 'Original model output is preserved below. Verify the uploaded leaf photo or consult an extension officer.'}
                    </p>
                  </div>
                </div>
              )}
          </section>

          {/* Research & Advisory Section */}
          <section className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/25 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-primary">travel_explore</span>
                <span className="text-xs font-extrabold uppercase tracking-wider text-on-surface">
                  {ui.researchHeading}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={researchStatus || 'NOT_REQUESTED'} />
                {onTriggerResearch && analysisId && researchStatus !== 'PENDING' && researchStatus !== 'PROCESSING' && (
                  <button
                    type="button"
                    disabled={researchBusy}
                    onClick={() => onTriggerResearch(analysisId)}
                    className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-[10px] font-bold border border-outline-variant/40 cursor-pointer disabled:opacity-50"
                  >
                    {researchBusy ? ui.startingResearch : researchStatus ? ui.retryResearch : ui.fetchResearch}
                  </button>
                )}
              </div>
            </div>

            {(researchStatus === 'PENDING' || researchStatus === 'PROCESSING') && (
              <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                <span className="material-symbols-outlined text-[16px] text-primary animate-spin">progress_activity</span>
                <span>{ui.researchRunning}</span>
              </div>
            )}

            {(researchStatus === 'BLOCKED' || researchStatus === 'FAILED') && (
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                {String(researchSnapshot?.errorMessage || ui.researchBlockedFallback)}
              </p>
            )}

            {/* Provider & Evidence Quality Badges (Independent from Model Confidence) */}
            {(evidenceQuality || successfulProvider || successfulProviders.length > 0) && (
              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                {evidenceQuality && (
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono font-bold">
                    {ui.evidenceQualityLabel}: {evidenceQuality}
                  </span>
                )}
                {successfulProvider && (
                  <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-semibold">
                    {ui.primaryProviderLabel}: {successfulProvider}
                  </span>
                )}
                {successfulProviders.length > 0 && (
                  <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
                    {ui.providersAttemptedLabel}: {successfulProviders.join(', ')}
                  </span>
                )}
                {fallbackUsed && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold">
                    Fallback Active
                  </span>
                )}
                {failedProviders.length > 0 && (
                  <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
                    {ui.unavailableProvidersLabel}: {failedProviders.join(', ')}
                  </span>
                )}
              </div>
            )}

            {lowConfWarning && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 font-medium">
                {ui.lowConfidenceWarning}
              </div>
            )}

            {(researchStatus === 'COMPLETED' || researchStatus === 'SKIPPED_HEALTHY' || researchStatus === 'INSUFFICIENT_EVIDENCE') &&
              (bengaliReport || advisory) && (
                <div className="space-y-4">
                  {/* B. Disease Overview */}
                  {bengaliReport && (
                    <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-1.5">
                      <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-primary">
                        {ui.sectionOverview}
                      </h5>
                      <p className="text-xs text-on-surface leading-relaxed">
                        {lang === 'bn'
                          ? bengaliReport.overviewBn || bengaliReport.summaryBn
                          : `${diseaseName} (${cropLabel}) — ${
                              classification.pathogenName ? `${classification.pathogenName}; ` : ''
                            }${classification.classificationEn}.`}
                      </p>
                      <div className="flex flex-wrap gap-2 text-[10px] text-on-surface-variant">
                        <span><strong>{ui.cropLabel}:</strong> {cropLabel}</span>
                        {classification.pathogenName && (
                          <span><strong>{ui.scientificNameLabel}:</strong> <em>{classification.pathogenName}</em></span>
                        )}
                        <span>
                          <strong>{ui.classificationLabel}:</strong>{' '}
                          {lang === 'bn' ? classification.classificationBn : classification.classificationEn}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* C. Symptoms */}
                  <div className="space-y-1.5">
                    <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-primary">
                      {ui.sectionSymptoms}
                    </h5>
                    <EvidenceBlockList
                      blocks={symptomBlocks}
                      lang={lang}
                      emptyText={lang === 'bn' && bengaliReport?.symptomsBn ? bengaliReport.symptomsBn : ui.noEvidenceFound}
                      toggleLabel={ui.originalEvidenceToggle}
                      translationUnavailableNotice={ui.translationUnavailableNotice}
                    />
                  </div>

                  {/* D. Causes & Spread */}
                  <div className="space-y-2">
                    <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-primary">
                      {ui.sectionCausesSpread}
                    </h5>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div className="min-w-0 space-y-1.5">
                        <span className="text-[10px] font-bold text-on-surface-variant block">
                          {ui.causalOrganismLabel}
                        </span>
                        <EvidenceBlockList
                          blocks={causeBlocks}
                          lang={lang}
                          emptyText={lang === 'bn' && bengaliReport?.causesBn ? bengaliReport.causesBn : ui.noEvidenceFound}
                          toggleLabel={ui.originalEvidenceToggle}
                          translationUnavailableNotice={ui.translationUnavailableNotice}
                        />
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <span className="text-[10px] font-bold text-on-surface-variant block">
                          {ui.spreadLabel}
                        </span>
                        <EvidenceBlockList
                          blocks={spreadBlocks}
                          lang={lang}
                          emptyText={lang === 'bn' && bengaliReport?.spreadBn ? bengaliReport.spreadBn : ui.noEvidenceFound}
                          toggleLabel={ui.originalEvidenceToggle}
                          translationUnavailableNotice={ui.translationUnavailableNotice}
                        />
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-surface-container border border-outline-variant/20 space-y-1">
                      <span className="text-[10px] font-bold text-on-surface-variant block">
                        {ui.environmentLabel}
                      </span>
                      {telemetryNotes.length > 0 ? (
                        <ul className="text-[11px] text-on-surface-variant list-disc list-inside space-y-0.5">
                          {telemetryNotes.map((note, idx) => (
                            <li key={idx}>{note}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] text-on-surface-variant">{ui.noTelemetryNotice}</p>
                      )}
                    </div>
                  </div>

                  {/* E. Potential Impact */}
                  {bengaliReport?.damageBn && (
                    <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-1">
                      <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-primary">
                        {ui.sectionImpact}
                      </h5>
                      <p className="text-xs text-on-surface leading-relaxed">
                        {lang === 'bn'
                          ? bengaliReport.damageBn
                          : 'Untreated foliar lesions can reduce photosynthetic area, vigor, and marketable yield depending on field conditions.'}
                      </p>
                    </div>
                  )}

                  {/* F. Recommended Actions + Advisory Status */}
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-primary">
                        {ui.sectionActions} — {ui.sectionAdvisory}
                      </h5>
                      {advisory && (
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                          {advisory.advisoryStatus && (
                            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                              {ui.advisoryStatusLabel}: {advisory.advisoryStatus}
                            </span>
                          )}
                          {advisory.severityLevel && (
                            <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface">
                              {ui.severityLabel}: {advisory.severityLevel}
                            </span>
                          )}
                          {advisory.confidenceBand && (
                            <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
                              {ui.confidenceBandLabel}: {advisory.confidenceBand}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {actionSteps.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                        {[
                          { label: ui.immediateGroup, items: immediateSteps },
                          { label: ui.shortTermGroup, items: shortTermSteps },
                          { label: ui.preventiveGroup, items: preventiveSteps },
                        ].map((group) => (
                          <div
                            key={group.label}
                            className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-2"
                          >
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-on-surface-variant block">
                              {group.label}
                            </span>
                            {group.items.length === 0 ? (
                              <p className="text-[11px] text-on-surface-variant">—</p>
                            ) : (
                              group.items.map((step, sIdx) => (
                                <div key={sIdx} className="space-y-1 text-xs">
                                  <p className="font-bold text-on-surface">
                                    {lang === 'bn' ? step.titleBn || step.titleEn : step.titleEn || step.titleBn}
                                  </p>
                                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                                    {lang === 'bn' ? step.detailBn || step.detailEn : step.detailEn || step.detailBn}
                                  </p>
                                  <p className="font-mono text-[10px] text-primary">
                                    {Array.isArray(step.citationIds) && step.citationIds.length > 0
                                      ? `${ui.citationsLabel}: ${step.citationIds.join(', ')}`
                                      : ui.uncitedGuidance}
                                  </p>
                                </div>
                              ))
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EvidenceBlockList
                        blocks={managementBlocks}
                        lang={lang}
                        emptyText={lang === 'bn' && bengaliReport?.managementBn ? bengaliReport.managementBn : ui.noEvidenceFound}
                        toggleLabel={ui.originalEvidenceToggle}
                        translationUnavailableNotice={ui.translationUnavailableNotice}
                      />
                    )}
                  </div>

                  {/* G. When to Contact an Agronomist */}
                  {(advisory?.escalationRequired || bengaliReport?.whenToConsultBn) && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
                      <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                        {ui.sectionAgronomist}
                      </h5>
                      {advisory?.escalationRequired && (
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                          {ui.escalationAlertLabel}:{' '}
                          {lang === 'bn'
                            ? advisory.escalationReasonBn || advisory.escalationReasonEn
                            : advisory.escalationReasonEn || advisory.escalationReasonBn}
                        </p>
                      )}
                      {bengaliReport?.whenToConsultBn && (
                        <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                          {lang === 'bn'
                            ? bengaliReport.whenToConsultBn
                            : 'Consult a qualified Upazila Agriculture Officer (DAE / BARI / BRRI) immediately if symptoms spread rapidly, confidence is below 60%, or before any chemical application.'}
                        </p>
                      )}
                    </div>
                  )}

                  {/* H. Research Evidence (Papers) */}
                  {researchPapers.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-outline-variant/20">
                      <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-primary">
                        {ui.sectionPapers} ({researchPapers.length})
                      </h5>
                      <div className="space-y-2">
                        {researchPapers.map((paper, pIdx) => (
                          <div
                            key={`${paper.paperId || pIdx}`}
                            className="p-3 rounded-xl bg-surface-container border border-outline-variant/20 space-y-1.5 text-xs"
                          >
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-surface-container-lowest text-on-surface-variant max-w-full break-words">
                                  {paper.sourceProvider}
                                  {paper.doiVerificationStatus && paper.doiVerificationStatus !== 'NOT_APPLICABLE'
                                    ? ` • ${ui.doiStatusLabel}: ${paper.doiVerificationStatus}`
                                    : ''}
                                </span>
                              </div>
                              <a
                                href={paper.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block w-full min-w-0 font-bold text-primary hover:underline break-words"
                              >
                                {paper.title}
                              </a>
                            </div>
                            <div className="text-[11px] text-on-surface-variant flex flex-wrap gap-x-3 gap-y-0.5">
                              {paper.authors && paper.authors.length > 0 && (
                                <span className="break-words"><strong>{ui.authorsLabel}:</strong> {paper.authors.slice(0, 3).join(', ')}</span>
                              )}
                              {paper.publicationYear && (
                                <span><strong>{ui.yearLabel}:</strong> {paper.publicationYear}</span>
                              )}
                              {paper.journal && (
                                <span className="break-words"><strong>{ui.journalLabel}:</strong> {paper.journal}</span>
                              )}
                              {paper.doi && (
                                <span className="font-mono break-all"><strong>{ui.doiLabel}:</strong> {paper.doi}</span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[10px]">
                              <span className="px-1.5 py-0.5 rounded bg-surface-container-lowest text-on-surface-variant">
                                {paper.isOpenAccess === true ? ui.openAccessLabel : ui.restrictedAccessLabel}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-surface-container-lowest text-on-surface-variant">
                                {paper.abstract ? ui.abstractAvailable : ui.abstractUnavailable}
                              </span>
                              <a
                                href={paper.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary font-semibold hover:underline"
                              >
                                {ui.openSourceLink} ↗
                              </a>
                            </div>
                            {paper.abstract && (
                              <details className="text-[11px] text-on-surface-variant pt-1">
                                <summary className="cursor-pointer font-semibold text-primary hover:underline select-none">
                                  {ui.expandAbstract}
                                </summary>
                                <p className="mt-1 p-2 rounded bg-surface-container-lowest border border-outline-variant/20 leading-relaxed break-words">
                                  {paper.abstract}
                                </p>
                              </details>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* I. Agricultural Sources & Portals */}
                  {researchSources.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-outline-variant/20">
                      <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-primary">
                        {ui.sectionSources} ({researchSources.length})
                      </h5>
                      {portalSources.length > 0 && (
                        <p className="text-[10px] text-on-surface-variant italic">{ui.portalNotice}</p>
                      )}
                      <ul className="space-y-1.5">
                        {[...contentSources, ...portalSources].map((src, sIdx) => {
                          const isPortal = src.provider === 'bangladesh_agri_official';
                          const typeBadge = isPortal
                            ? ui.portalReferenceBadge
                            : src.provider === 'openalex' || src.provider === 'semantic_scholar'
                              ? ui.academicBadge
                              : ui.retrievedContentBadge;
                          return (
                            <li
                              key={`${src.url || sIdx}`}
                              className="p-2 rounded-lg bg-surface-container border border-outline-variant/20 text-[11px] flex flex-wrap items-center justify-between gap-2"
                            >
                              <a
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary font-semibold hover:underline truncate max-w-full sm:max-w-[320px]"
                              >
                                {src.title || src.domain}
                              </a>
                              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                <span className="px-1.5 py-0.5 rounded bg-surface-container-lowest text-on-surface-variant">
                                  {typeBadge}
                                </span>
                                <span className="font-mono text-on-surface-variant">
                                  {src.domain} • {src.authoritativeTier}
                                </span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {/* Safety Disclaimer */}
                  {(advisory?.disclaimerBn || advisory?.disclaimerEn || bengaliReport?.cautionBn) && (
                    <p className="text-[10px] text-on-surface-variant italic pt-1 border-t border-outline-variant/20">
                      {lang === 'bn'
                        ? advisory?.disclaimerBn || bengaliReport?.cautionBn
                        : advisory?.disclaimerEn || ui.aiDisclaimer}
                    </p>
                  )}
                </div>
              )}

            {researchHistory.length > 1 && (
              <div className="pt-2 border-t border-outline-variant/20 text-[10px] text-on-surface-variant">
                {ui.attemptsRecordedLabel}: {researchHistory.length}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
