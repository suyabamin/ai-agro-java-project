import React, { useEffect, useState, useCallback, useId, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { assignmentService } from '../services/assignmentService';
import {
  monitoringService,
  validateCropImageFile,
  type MonitoringRecord,
} from '../services/monitoringService';
import type { Field } from '../types/field';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import {
  DiseaseDetectionCard,
  DiseaseIntelligenceSummaryPanel,
} from '../components/monitoring/DiseaseDetectionCard';
import {
  LeafDiseaseProcessingCard,
  type LeafProcessingStep,
} from '../components/monitoring/LeafDiseaseProcessingCard';
import { UnifiedFieldIntelligencePanel } from '../components/monitoring/UnifiedFieldIntelligencePanel';
import { FieldHistoryTabs } from '../components/monitoring/FieldHistoryTabs';
import heroAgricultureImg from '../assets/landing/hero-agriculture.jpg';

function parseApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const msg = err.response?.data?.message;
    if (status === 401) {
      return 'Your session has expired. Please sign in again.';
    }
    if (status === 403) {
      if (typeof msg === 'string' && msg.trim()) {
        return msg;
      }
      return 'You do not have permission to submit data to this field.';
    }
    if (typeof msg === 'string' && msg.trim()) {
      return msg;
    }
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}

export interface FormMeasurements {
  n: string;
  p: string;
  k: string;
  temperature: string;
  humidity: string;
  ph: string;
  rainfall: string;
  soilMoisture: string;
}

const initialForm: FormMeasurements = {
  n: '',
  p: '',
  k: '',
  temperature: '',
  humidity: '',
  ph: '',
  rainfall: '',
  soilMoisture: '',
};

export function validateTelemetryMeasurements(formData: FormMeasurements): Partial<FormMeasurements> {
  const errors: Partial<FormMeasurements> = {};
  const n = parseFloat(formData.n);
  if (isNaN(n) || n < 0 || n > 1000) errors.n = 'N must be between 0 and 1000 mg/kg';

  const p = parseFloat(formData.p);
  if (isNaN(p) || p < 0 || p > 1000) errors.p = 'P must be between 0 and 1000 mg/kg';

  const k = parseFloat(formData.k);
  if (isNaN(k) || k < 0 || k > 1000) errors.k = 'K must be between 0 and 1000 mg/kg';

  const temp = parseFloat(formData.temperature);
  if (isNaN(temp) || temp < -20 || temp > 60) {
    errors.temperature = 'Temperature must be between -20 and 60 °C';
  }

  const hum = parseFloat(formData.humidity);
  if (isNaN(hum) || hum < 0 || hum > 100) errors.humidity = 'Humidity must be between 0 and 100 %';

  const ph = parseFloat(formData.ph);
  if (isNaN(ph) || ph < 0 || ph > 14) errors.ph = 'pH must be between 0 and 14';

  const rain = parseFloat(formData.rainfall);
  if (isNaN(rain) || rain < 0 || rain > 2000) {
    errors.rainfall = 'Rainfall must be between 0 and 2000 mm';
  }

  const sm = parseFloat(formData.soilMoisture);
  if (isNaN(sm) || sm < 0 || sm > 100) {
    errors.soilMoisture = 'Soil Moisture must be between 0 and 100 %';
  }

  return errors;
}

export const FarmerFieldDetailsPage: React.FC = () => {
  const { fieldId } = useParams<{ fieldId: string }>();

  const [field, setField] = useState<Field | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabular Form State
  const [formData, setFormData] = useState<FormMeasurements>(initialForm);
  const [formErrors, setFormErrors] = useState<Partial<FormMeasurements>>({});
  const [submittingData, setSubmittingData] = useState(false);
  const [dataSuccessMsg, setDataSuccessMsg] = useState<string | null>(null);
  const [dataErrorMsg, setDataErrorMsg] = useState<string | null>(null);

  // Leaf Image Upload & Disease Detection State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFileError, setImageFileError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [analyzingDisease, setAnalyzingDisease] = useState(false);
  const [diseaseStep, setDiseaseStep] = useState<LeafProcessingStep>('idle');
  const [diseaseResult, setDiseaseResult] = useState<MonitoringRecord | null>(null);
  const [diseaseAnalyses, setDiseaseAnalyses] = useState<MonitoringRecord[]>([]);
  const [diseaseAvailability, setDiseaseAvailability] = useState<{
    available?: boolean;
    status?: string;
  } | null>(null);
  const [diseaseError, setDiseaseError] = useState<string | null>(null);
  const [researchBusy, setResearchBusy] = useState(false);

  // AI Analysis State
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [analyzingField, setAnalyzingField] = useState(false);
  const [latestAnalysis, setLatestAnalysis] = useState<MonitoringRecord | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const pollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  const fileInputId = useId();

  const loadFieldAndHistory = useCallback(async () => {
    if (!fieldId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await assignmentService.fetchMyAssignedField(fieldId);
      const fieldData = res.data || null;
      setField(fieldData);

      if (fieldData) {
        const farmId = fieldData.farmId;
        const [analRes, diseaseRes, availRes] = await Promise.allSettled([
          monitoringService.listAgriculturalAnalyses(farmId, fieldId, null, 10),
          monitoringService.analyses(farmId, fieldId, null, 10),
          monitoringService.diseaseAvailability(farmId, fieldId),
        ]);

        if (analRes.status === 'fulfilled' && analRes.value?.data?.items) {
          const items = analRes.value.data.items;
          if (items.length > 0) {
            setLatestAnalysis(items[0]);
          }
        }
        if (diseaseRes.status === 'fulfilled' && diseaseRes.value?.data?.items) {
          const dItems = diseaseRes.value.data.items;
          setDiseaseAnalyses(dItems);
          if (dItems.length > 0) {
            setDiseaseResult(dItems[0]);
          }
        }
        if (availRes.status === 'fulfilled' && availRes.value?.data) {
          setDiseaseAvailability(availRes.value.data as { available?: boolean; status?: string });
        }
      }
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : 'Failed to load field details. You may not be assigned to this field.'
      );
    } finally {
      setLoading(false);
    }
  }, [fieldId]);

  useEffect(() => {
    loadFieldAndHistory();
  }, [loadFieldAndHistory]);

  const validateFieldData = (): boolean => {
    const errors = validateTelemetryMeasurements(formData);
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!field || submittingData || !validateFieldData()) return;

    setSubmittingData(true);
    setDataSuccessMsg(null);
    setDataErrorMsg(null);

    const now = new Date().toISOString();
    const clientBatch = `batch_${Date.now()}`;

    const itemsToSubmit = [
      { measurementType: 'NITROGEN', value: parseFloat(formData.n), unit: 'mg/kg' },
      { measurementType: 'PHOSPHORUS', value: parseFloat(formData.p), unit: 'mg/kg' },
      { measurementType: 'POTASSIUM', value: parseFloat(formData.k), unit: 'mg/kg' },
      { measurementType: 'AIR_TEMPERATURE', value: parseFloat(formData.temperature), unit: 'C' },
      { measurementType: 'RELATIVE_HUMIDITY', value: parseFloat(formData.humidity), unit: '%' },
      { measurementType: 'SOIL_PH', value: parseFloat(formData.ph), unit: 'pH' },
      { measurementType: 'RAINFALL', value: parseFloat(formData.rainfall), unit: 'mm' },
      { measurementType: 'SOIL_MOISTURE', value: parseFloat(formData.soilMoisture), unit: '%' },
    ];

    const targetFarmId =
      field.farmId || (fieldId && fieldId.includes('--') ? fieldId.split('--')[0] : '');
    const targetFieldId = field.fieldId || fieldId || '';

    try {
      try {
        await monitoringService.submitTelemetryBatch(
          targetFarmId,
          targetFieldId,
          itemsToSubmit.map((item) => ({
            measurementType: item.measurementType,
            value: item.value,
            unit: item.unit,
            observedAt: now,
            source: 'MANUAL',
            clientEventId: `${clientBatch}_${item.measurementType}`,
          }))
        );
      } catch {
        await Promise.all(
          itemsToSubmit.map((item) =>
            monitoringService.submitTelemetry(targetFarmId, targetFieldId, {
              measurementType: item.measurementType,
              value: item.value,
              unit: item.unit,
              observedAt: now,
              source: 'MANUAL',
              clientEventId: `${clientBatch}_${item.measurementType}`,
            })
          )
        );
      }

      setHistoryRefreshKey((k) => k + 1);
      setAnalyzingField(true);
      setDataSuccessMsg(
        'All 8 measurements submitted successfully. Running AI agronomic analysis in background...'
      );

      try {
        const analysisRes = await monitoringService.createAnalysis(
          targetFarmId,
          targetFieldId,
          true
        );
        const initialRecord = analysisRes?.data;
        if (initialRecord) {
          setLatestAnalysis(initialRecord);
          const analysisId = initialRecord.analysisId || initialRecord.id;

          if (
            initialRecord.status === 'COMPLETED' ||
            initialRecord.status === 'INSUFFICIENT_DATA'
          ) {
            setAnalyzingField(false);
            setHistoryRefreshKey((k) => k + 1);
            setDataSuccessMsg(
              'All 8 measurements submitted and field AI analysis completed successfully.'
            );
          } else if (analysisId) {
            let attempts = 0;
            const maxAttempts = 20;
            if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);

            pollTimerRef.current = window.setInterval(async () => {
              attempts++;
              try {
                const pollRes = await monitoringService.agriculturalAnalysis(
                  targetFarmId,
                  targetFieldId,
                  String(analysisId)
                );
                if (pollRes?.data) {
                  const updated = pollRes.data;
                  setLatestAnalysis(updated);
                  if (
                    updated.status === 'COMPLETED' ||
                    updated.status === 'FAILED' ||
                    updated.status === 'INSUFFICIENT_DATA' ||
                    attempts >= maxAttempts
                  ) {
                    if (pollTimerRef.current) {
                      window.clearInterval(pollTimerRef.current);
                      pollTimerRef.current = null;
                    }
                    setAnalyzingField(false);
                    setHistoryRefreshKey((k) => k + 1);
                    if (updated.status === 'COMPLETED') {
                      setDataSuccessMsg(
                        'AI field analysis complete: Water Need and Field Status evaluated.'
                      );
                    } else if (updated.status === 'FAILED') {
                      setDataSuccessMsg(
                        'Measurements recorded. AI model evaluation encountered a transient issue.'
                      );
                    }
                  }
                }
              } catch {
                if (attempts >= maxAttempts && pollTimerRef.current) {
                  window.clearInterval(pollTimerRef.current);
                  pollTimerRef.current = null;
                  setAnalyzingField(false);
                }
              }
            }, 1500);
          }
        }
      } catch {
        setAnalyzingField(false);
        setDataSuccessMsg('All 8 measurements recorded successfully.');
      }
    } catch (err: unknown) {
      setDataErrorMsg(parseApiErrorMessage(err, 'Failed to record telemetry measurements.'));
    } finally {
      setSubmittingData(false);
    }
  };

  const processSelectedFile = (selectedFile: File | null | undefined) => {
    setImageFileError(null);
    setDiseaseError(null);
    if (!selectedFile) return;

    const validationErr = validateCropImageFile(selectedFile);
    if (validationErr) {
      setImageFileError(validationErr);
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    setImageFile(selectedFile);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    processSelectedFile(e.target.files?.[0]);
  };

  const handleClearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageFileError(null);
    setDiseaseError(null);
  };

  const handleUploadAndDetectDisease = async () => {
    if (!field || !imageFile || analyzingDisease) return;
    setAnalyzingDisease(true);
    setDiseaseStep('uploading');
    setDiseaseError(null);

    const targetFarmId =
      field.farmId || (fieldId && fieldId.includes('--') ? fieldId.split('--')[0] : '');
    const targetFieldId = field.fieldId || fieldId || '';

    try {
      const uploadRes = await monitoringService.uploadImage(targetFarmId, targetFieldId, imageFile);
      const imageId = String(uploadRes.data?.imageId || uploadRes.data?.id || '');
      if (!imageId) throw new Error('Image uploaded but server did not return an image ID.');

      setDiseaseStep('inferring');
      const analysisRes = await monitoringService.analyzeDisease(
        targetFarmId,
        targetFieldId,
        imageId
      );
      setDiseaseResult(analysisRes.data || null);

      const diseaseRes = await monitoringService.analyses(targetFarmId, targetFieldId, null, 10);
      if (diseaseRes?.data?.items) {
        setDiseaseAnalyses(diseaseRes.data.items);
      }
      setHistoryRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      setDiseaseError(parseApiErrorMessage(err, 'Disease analysis request failed.'));
    } finally {
      setAnalyzingDisease(false);
      setDiseaseStep('idle');
    }
  };

  const handleTriggerResearch = async (analysisId: string) => {
    if (!field || !analysisId) return;
    const targetFarmId =
      field.farmId || (fieldId && fieldId.includes('--') ? fieldId.split('--')[0] : '');
    const targetFieldId = field.fieldId || fieldId || '';
    setResearchBusy(true);
    try {
      await monitoringService.triggerDiseaseResearch(targetFarmId, targetFieldId, analysisId);
      const updated = await monitoringService.analysis(targetFarmId, targetFieldId, analysisId);
      if (updated.data) setDiseaseResult(updated.data);
      setHistoryRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      setDiseaseError(parseApiErrorMessage(err, 'Could not trigger disease research.'));
    } finally {
      setResearchBusy(false);
    }
  };

  useEffect(() => {
    if (!field || !diseaseResult) return;
    const rStatus = String(diseaseResult.researchStatus || '').toUpperCase();
    const analysisId = String(diseaseResult.analysisId || diseaseResult.id || '');
    if (!analysisId || (rStatus !== 'PENDING' && rStatus !== 'PROCESSING')) return;

    const targetFarmId =
      field.farmId || (fieldId && fieldId.includes('--') ? fieldId.split('--')[0] : '');
    const targetFieldId = field.fieldId || fieldId || '';
    const timer = window.setInterval(async () => {
      try {
        const res = await monitoringService.analysis(targetFarmId, targetFieldId, analysisId);
        if (res.data) {
          setDiseaseResult(res.data);
          const nextStatus = String(res.data.researchStatus || '').toUpperCase();
          if (nextStatus !== 'PENDING' && nextStatus !== 'PROCESSING') {
            window.clearInterval(timer);
            setHistoryRefreshKey((k) => k + 1);
          }
        }
      } catch {
        // Keep polling silently until terminal state or unmount
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [field, fieldId, diseaseResult]);

  const handleRunAiAnalysis = async () => {
    if (!field || runningAnalysis) return;
    setRunningAnalysis(true);
    setAnalysisError(null);

    const targetFarmId =
      field.farmId || (fieldId && fieldId.includes('--') ? fieldId.split('--')[0] : '');
    const targetFieldId = field.fieldId || fieldId || '';

    try {
      const res = await monitoringService.createAnalysis(targetFarmId, targetFieldId);
      setLatestAnalysis(res.data || null);
      setHistoryRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      setAnalysisError(parseApiErrorMessage(err, 'AI analysis invocation failed.'));
    } finally {
      setRunningAnalysis(false);
    }
  };

  const scrollToFullIntelligence = () => {
    document.getElementById('full-disease-intelligence')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const fieldOverviewCards = field
    ? [
        {
          icon: 'eco',
          label: 'Designated Crop',
          value: field.cropType || 'Not specified',
          tone: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/15',
        },
        {
          icon: 'terrain',
          label: 'Soil Classification',
          value: field.soilType || 'Loam',
          tone: 'text-amber-700 dark:text-amber-300 bg-amber-500/15',
        },
        {
          icon: 'square_foot',
          label: 'Surface Area',
          value: field.areaHectares !== undefined ? `${field.areaHectares} hectares` : '—',
          tone: 'text-primary bg-primary/15',
        },
        {
          icon: 'water_drop',
          label: 'Irrigation System',
          value: field.irrigationType || 'DRIP',
          tone: 'text-sky-700 dark:text-sky-300 bg-sky-500/15',
        },
        {
          icon: 'tag',
          label: 'Local Field Reference',
          value: field.localFieldId || '—',
          tone: 'text-violet-700 dark:text-violet-300 bg-violet-500/15',
        },
        {
          icon: 'calendar_today',
          label: 'Registered At',
          value: field.createdAt ? new Date(field.createdAt).toLocaleDateString() : '—',
          tone: 'text-on-surface-variant bg-surface-container',
        },
      ]
    : [];

  return (
    <div className="space-y-5 max-w-[1520px] mx-auto pb-12">
      {loading && <LoadingSkeleton type="dashboard" />}

      {!loading && error && (
        <div className="p-8 rounded-3xl bg-error/10 border border-error/30 text-center space-y-3">
          <span className="material-symbols-outlined text-[48px] text-error">lock_clock</span>
          <h2 className="text-base font-bold text-error">Access Restricted</h2>
          <p className="text-xs text-on-surface-variant max-w-md mx-auto">{error}</p>
          <Link
            to="/farmer/fields"
            className="inline-block mt-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold shadow-sm no-underline"
          >
            Return to Authorized Fields
          </Link>
        </div>
      )}

      {!loading && !error && field && (
        <>
          {/* C. Wide Field Hero Banner */}
          <div className="agro-hero-enter relative rounded-3xl overflow-hidden shadow-md border border-outline-variant/30 bg-[#103823] text-white">
            <img
              src={heroAgricultureImg}
              alt="Agricultural field landscape"
              className="absolute inset-0 w-full h-full object-cover object-center opacity-55"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-[#0b2b1a]/95 via-[#103823]/80 to-[#103823]/40"
            />

            <div className="relative px-6 py-5 sm:px-8 sm:py-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-2 min-w-0">
                <Link
                  to="/farmer/fields"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold no-underline transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">arrow_back</span>
                  <span>Assigned Fields</span>
                </Link>

                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white break-words">
                    {field.name}
                  </h1>
                  <StatusBadge status={field.status || 'ACTIVE'} />
                </div>

                <p className="text-xs text-emerald-100/90 break-all">
                  Holding Farm: <span className="font-mono font-bold text-white">{field.farmId}</span>{' '}
                  <span className="mx-1.5 opacity-60">|</span>
                  Sector ID: <span className="font-mono">{field.fieldId}</span>
                </p>
              </div>

              <div className="hidden lg:flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-white/85 dark:bg-black/45 backdrop-blur-md border border-white/40 text-on-surface dark:text-white shadow-lg shrink-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-primary dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">eco</span>
                </div>
                <p className="text-xs font-extrabold leading-snug max-w-[165px]">
                  &ldquo;Healthy Fields, Prosperous Harvest&rdquo;
                </p>
              </div>
            </div>
          </div>

          {/* D. 1. Field Overview & Parameters + E. AI Agronomic Decision Alert */}
          <div className="agro-hero-enter-delay-1 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">eco</span>
                <h2 className="text-sm sm:text-base font-extrabold text-on-surface">
                  1. Field Overview &amp; Parameters
                </h2>
              </div>

              <button
                type="button"
                onClick={handleRunAiAnalysis}
                disabled={runningAnalysis}
                className="h-9 px-4 rounded-full bg-[#0e3b24] hover:bg-[#175534] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all disabled:opacity-50"
              >
                <span
                  className={`material-symbols-outlined text-[16px] ${
                    runningAnalysis ? 'animate-spin' : ''
                  }`}
                >
                  {runningAnalysis ? 'progress_activity' : 'play_circle'}
                </span>
                <span>{runningAnalysis ? 'Running AI Engine...' : 'Run Field AI Analysis'}</span>
              </button>
            </div>

            {/* 6 Horizontally Aligned Parameter Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {fieldOverviewCards.map((item) => (
                <div
                  key={item.label}
                  className="p-3.5 rounded-2xl bg-surface-container-low/70 border border-outline-variant/25 flex flex-col items-center text-center gap-1.5"
                >
                  <div
                    className={`w-8 h-8 rounded-xl ${item.tone} flex items-center justify-center`}
                  >
                    <span className="material-symbols-outlined text-[17px]">{item.icon}</span>
                  </div>
                  <span className="text-[11px] font-medium text-on-surface-variant leading-tight">
                    {item.label}
                  </span>
                  <span className="text-xs sm:text-sm font-extrabold text-on-surface break-words">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            {field.notes && (
              <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-xs">
                <span className="font-bold text-on-surface">Agronomic Notes: </span>
                <span className="text-on-surface-variant">{field.notes}</span>
              </div>
            )}

            {/* E. AI Agronomic Decision Panel */}
            {analysisError && (
              <div
                role="alert"
                className="p-3.5 rounded-2xl bg-error/10 border border-error/30 text-xs text-error flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{analysisError}</span>
              </div>
            )}

            {runningAnalysis || analyzingField ? (
              <div
                role="status"
                aria-live="polite"
                className="p-4 rounded-2xl bg-secondary/10 border border-secondary/30 text-xs text-on-surface flex items-center gap-3"
              >
                <span className="material-symbols-outlined text-[20px] text-secondary animate-spin">
                  sync
                </span>
                <div>
                  <p className="font-bold text-secondary">AI Agronomic Analysis in Progress</p>
                  <p className="text-[11px] text-on-surface-variant">
                    Evaluating soil chemistry, water requirements, and field health status.
                  </p>
                </div>
              </div>
            ) : latestAnalysis ? (
              <div id="ai-decision" className="space-y-3 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-on-surface uppercase tracking-wider">
                    AI Agronomic Decision
                  </span>
                  <div className="flex items-center gap-2 text-[11px] text-on-surface-variant">
                    {Boolean(latestAnalysis.analysisId) && (
                      <span className="font-mono bg-surface-container px-2 py-0.5 rounded text-[10px]">
                        ID: {String(latestAnalysis.analysisId).substring(0, 16)}...
                      </span>
                    )}
                    {Boolean(latestAnalysis.createdAt) && (
                      <span>
                        Evaluated: {new Date(String(latestAnalysis.createdAt)).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/25">
                    <span className="text-[10px] font-bold uppercase text-on-surface-variant block">
                      Predicted Water Need
                    </span>
                    <span className="text-lg font-extrabold text-primary">
                      {String(
                        latestAnalysis.predictedWaterNeed || latestAnalysis.waterNeed || 'Sufficient'
                      )}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/25">
                    <span className="text-[10px] font-bold uppercase text-on-surface-variant block">
                      Field Agronomic Status
                    </span>
                    <span className="text-lg font-extrabold text-on-surface">
                      {String(
                        latestAnalysis.predictedFieldStatus ||
                          latestAnalysis.fieldStatus ||
                          'Normal'
                      )}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/25">
                    <span className="text-[10px] font-bold uppercase text-on-surface-variant block">
                      AI Recommended Crop
                    </span>
                    <span className="text-lg font-extrabold text-secondary capitalize">
                      {String(latestAnalysis.recommendedCrop || field.cropType || 'Optimal Match')}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/25">
                    <span className="text-[10px] font-bold uppercase text-on-surface-variant block">
                      Disease Detection Engine
                    </span>
                    <span className="text-sm font-extrabold text-on-surface">
                      {diseaseResult?.status
                        ? String(diseaseResult.status)
                        : diseaseAvailability?.available
                          ? 'AVAILABLE'
                          : String(latestAnalysis.diseaseDetectionStatus || 'MODEL_UNAVAILABLE')}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Pale-Yellow Alert Panel Matching Reference */
              <div
                id="ai-decision"
                className="px-4 py-3 rounded-2xl bg-[#fef9e7] dark:bg-[#2a2410] border border-[#f4e3a1] dark:border-[#5c4d18] flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-400/25 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-on-surface">AI Agronomic Decision</p>
                    <p className="text-[11px] text-on-surface-variant">
                      No Field Status Evaluations Recorded Yet
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-on-surface-variant md:text-right">
                  Upload field measurements below and click{' '}
                  <strong className="text-on-surface">&ldquo;Run Field AI Analysis&rdquo;</strong>{' '}
                  to compute Water Need and Field Status.
                </p>
              </div>
            )}
          </div>

          {/* F. MAIN TWO-COLUMN ROW: Left Telemetry Form + Right Disease Intelligence */}
          <div className="agro-hero-enter-delay-2 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* LEFT COLUMN: 2. Upload Agricultural Field Data */}
            <div className="lg:col-span-6 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 p-5 sm:p-6 shadow-sm flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-on-surface">
                      2. Upload Agricultural Field Data
                    </h2>
                    <p className="text-[11px] text-on-surface-variant">
                      Submit physical and soil telemetry collected from this field sector. Each
                      value is validated against agronomic domain thresholds.
                    </p>
                  </div>
                </div>

                {dataSuccessMsg && (
                  <div
                    role="status"
                    className="p-3 rounded-xl bg-primary/10 border border-primary/30 text-xs font-semibold text-primary flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    <span>{dataSuccessMsg}</span>
                  </div>
                )}

                {dataErrorMsg && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-error/10 border border-error/30 text-xs font-semibold text-error flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">error</span>
                    <span>{dataErrorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleSubmitData} className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(
                      [
                        {
                          id: 'field-n',
                          key: 'n',
                          label: 'Nitrogen (N)',
                          unit: 'mg/kg',
                          step: '0.01',
                          placeholder: 'e.g. 90',
                        },
                        {
                          id: 'field-p',
                          key: 'p',
                          label: 'Phosphorus (P)',
                          unit: 'mg/kg',
                          step: '0.01',
                          placeholder: 'e.g. 42',
                        },
                        {
                          id: 'field-k',
                          key: 'k',
                          label: 'Potassium (K)',
                          unit: 'mg/kg',
                          step: '0.01',
                          placeholder: 'e.g. 43',
                        },
                        {
                          id: 'field-temp',
                          key: 'temperature',
                          label: 'Temperature',
                          unit: '°C',
                          step: '0.1',
                          placeholder: 'e.g. 24.5',
                        },
                        {
                          id: 'field-hum',
                          key: 'humidity',
                          label: 'Relative Humidity',
                          unit: '%',
                          step: '0.1',
                          placeholder: 'e.g. 78.0',
                        },
                        {
                          id: 'field-ph',
                          key: 'ph',
                          label: 'Soil pH',
                          unit: '0 - 14',
                          step: '0.01',
                          placeholder: 'e.g. 6.5',
                        },
                        {
                          id: 'field-rain',
                          key: 'rainfall',
                          label: 'Rainfall',
                          unit: 'mm',
                          step: '0.1',
                          placeholder: 'e.g. 150.0',
                        },
                        {
                          id: 'field-moist',
                          key: 'soilMoisture',
                          label: 'Soil Moisture',
                          unit: '%',
                          step: '0.1',
                          placeholder: 'e.g. 45.2',
                        },
                      ] as const
                    ).map((inp) => (
                      <div key={inp.id} className="space-y-1">
                        <label
                          htmlFor={inp.id}
                          className="text-[11px] font-bold text-on-surface block truncate"
                        >
                          {inp.label}
                        </label>
                        <div className="relative flex items-center">
                          <input
                            id={inp.id}
                            type="number"
                            step={inp.step}
                            placeholder={inp.placeholder}
                            value={formData[inp.key]}
                            onChange={(e) =>
                              setFormData({ ...formData, [inp.key]: e.target.value })
                            }
                            className={`w-full h-9 pl-2.5 pr-11 rounded-xl bg-surface-container-low border text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                              formErrors[inp.key] ? 'border-error' : 'border-outline-variant/40'
                            }`}
                          />
                          <span className="absolute right-2.5 text-[10px] font-semibold text-on-surface-variant pointer-events-none">
                            {inp.unit}
                          </span>
                        </div>
                        {formErrors[inp.key] && (
                          <p className="text-[10px] text-error font-medium">
                            {formErrors[inp.key]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={submittingData}
                    className="w-full h-11 rounded-full bg-gradient-to-r from-[#155a36] to-[#1e7346] hover:from-[#1b6e42] hover:to-[#248552] text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    <span
                      className={`material-symbols-outlined text-[16px] ${
                        submittingData ? 'animate-spin' : ''
                      }`}
                    >
                      {submittingData ? 'progress_activity' : 'send'}
                    </span>
                    <span>
                      {submittingData ? 'Submitting Measurements...' : 'Submit Field Telemetry'}
                    </span>
                  </button>
                </form>
              </div>
            </div>

            {/* RIGHT COLUMN: Disease Intelligence Summary Card (or Animated Processing) */}
            <div className="lg:col-span-6 flex flex-col">
              {analyzingDisease ? (
                <LeafDiseaseProcessingCard
                  imagePreview={imagePreview}
                  fileName={imageFile?.name}
                  step={diseaseStep}
                />
              ) : (
                <DiseaseIntelligenceSummaryPanel
                  analysis={diseaseResult}
                  fieldCropType={field.cropType}
                  imagePreview={imagePreview}
                  onViewFullAnalysis={scrollToFullIntelligence}
                  onRetry={imageFile ? handleUploadAndDetectDisease : undefined}
                />
              )}
            </div>
          </div>

          {/* G & H. BOTTOM TWO-COLUMN ROW: Left Leaf Upload + Right Chronological History */}
          <div className="agro-hero-enter-delay-3 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* LEFT COLUMN: 3. Leaf Disease Detection Upload */}
            <div className="lg:col-span-5 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 p-5 sm:p-6 shadow-sm space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[19px] text-primary">
                    image_search
                  </span>
                  <h2 className="text-sm sm:text-base font-extrabold text-on-surface">
                    3. Leaf Disease Detection Upload
                  </h2>
                </div>
                <p className="text-[11px] text-on-surface-variant mt-1">
                  Upload clear leaf photographs (PNG or JPEG, maximum 8 MiB) collected from this
                  field zone for inspection.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-stretch">
                {/* Dropzone */}
                <div className="sm:col-span-7 flex flex-col gap-2">
                  <label
                    htmlFor={fileInputId}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      processSelectedFile(e.dataTransfer.files?.[0]);
                    }}
                    className={`flex-1 min-h-[150px] border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                      dragActive
                        ? 'border-primary bg-primary/5 scale-[1.01]'
                        : 'border-outline-variant/50 hover:border-primary hover:bg-surface-container-low'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
                      <span className="material-symbols-outlined text-[24px]">
                        add_photo_alternate
                      </span>
                    </div>
                    <span className="text-xs font-bold text-on-surface">
                      Drag &amp; drop or click to select leaf image
                    </span>
                    <span className="text-[10px] text-on-surface-variant mt-1">
                      PNG or JPEG format (max 8 MiB)
                    </span>
                    <input
                      id={fileInputId}
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Upload Button + Preview */}
                <div className="sm:col-span-5 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={handleUploadAndDetectDisease}
                    disabled={!imageFile || analyzingDisease}
                    className="w-full h-10 rounded-full bg-[#155a36] hover:bg-[#1b6e42] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all disabled:opacity-50"
                  >
                    <span
                      className={`material-symbols-outlined text-[16px] ${
                        analyzingDisease ? 'animate-spin' : ''
                      }`}
                    >
                      {analyzingDisease ? 'progress_activity' : 'cloud_upload'}
                    </span>
                    <span>
                      {diseaseStep === 'uploading'
                        ? 'Uploading...'
                        : diseaseStep === 'inferring'
                          ? 'Analyzing...'
                          : 'Upload & Analyze'}
                    </span>
                  </button>

                  {imagePreview ? (
                    <div className="flex-1 min-h-[104px] rounded-2xl overflow-hidden border border-outline-variant/30 bg-surface-container-low flex items-center justify-center p-1">
                      <img
                        src={imagePreview}
                        alt="Leaf Preview"
                        className="max-h-28 max-w-full object-contain rounded-xl"
                      />
                    </div>
                  ) : (
                    <div className="flex-1 min-h-[104px] rounded-2xl border border-outline-variant/25 bg-surface-container-low flex flex-col items-center justify-center text-on-surface-variant text-[11px] p-2 text-center">
                      <span className="material-symbols-outlined text-[24px] mb-0.5">preview</span>
                      <span>No image selected</span>
                    </div>
                  )}
                </div>
              </div>

              {imageFileError && (
                <p role="alert" className="text-xs text-error font-semibold">
                  {imageFileError}
                </p>
              )}

              {imageFile && (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/25 text-xs">
                  <span className="font-semibold text-on-surface truncate max-w-[180px]">
                    {imageFile.name}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-on-surface-variant">
                      {(imageFile.size / 1024).toFixed(1)} KB
                    </span>
                    <button
                      type="button"
                      onClick={handleClearImage}
                      disabled={analyzingDisease}
                      className="text-[11px] font-bold text-error hover:underline cursor-pointer disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              {diseaseError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-error/10 border border-error/30 text-xs text-error flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">error</span>
                    <span>{diseaseError}</span>
                  </div>
                  {imageFile && (
                    <button
                      type="button"
                      onClick={handleUploadAndDetectDisease}
                      disabled={analyzingDisease}
                      className="px-2.5 py-1 rounded-lg bg-primary text-on-primary text-[11px] font-bold cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: 6. Submissions & Diagnostic History (Preserved Chronological Records) */}
            <div className="lg:col-span-7">
              <FieldHistoryTabs
                farmId={field.farmId}
                fieldId={field.fieldId}
                refreshKey={historyRefreshKey}
              />
            </div>
          </div>

          {/* FULL DETAILED DISEASE INTELLIGENCE (Sections ক–ঝ, Research Papers, Portals, Advisory) */}
          <div id="full-disease-intelligence" className="space-y-4 pt-2">
            <DiseaseDetectionCard
              analysis={diseaseResult}
              fieldCropType={field.cropType}
              onRetry={imageFile ? handleUploadAndDetectDisease : undefined}
              onTriggerResearch={handleTriggerResearch}
              researchBusy={researchBusy}
              researchHistory={diseaseAnalyses}
            />
            <UnifiedFieldIntelligencePanel farmId={field.farmId} fieldId={field.fieldId} />
          </div>
        </>
      )}
    </div>
  );
};
