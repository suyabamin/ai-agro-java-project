import React, { useEffect, useState, useCallback, useId, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { assignmentService } from '../services/assignmentService';
import { monitoringService, validateCropImageFile, type MonitoringRecord } from '../services/monitoringService';
import type { Field } from '../types/field';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { DiseaseDetectionCard, formatDiseaseLabel, parseConfidencePercent } from '../components/monitoring/DiseaseDetectionCard';

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

interface FormMeasurements {
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-outline-variant/15 last:border-0">
      <span className="text-xs font-semibold text-on-surface-variant w-44 shrink-0">{label}</span>
      <span className="text-xs text-on-surface text-right font-medium break-all">{value}</span>
    </div>
  );
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
  const [diseaseStep, setDiseaseStep] = useState<'idle' | 'uploading' | 'inferring'>('idle');
  const [diseaseResult, setDiseaseResult] = useState<MonitoringRecord | null>(null);
  const [diseaseAnalyses, setDiseaseAnalyses] = useState<MonitoringRecord[]>([]);
  const [diseaseAvailability, setDiseaseAvailability] = useState<{ available?: boolean; status?: string } | null>(null);
  const [diseaseError, setDiseaseError] = useState<string | null>(null);
  const [researchBusy, setResearchBusy] = useState(false);

  // AI Analysis State
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [analyzingField, setAnalyzingField] = useState(false);
  const [latestAnalysis, setLatestAnalysis] = useState<MonitoringRecord | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const pollTimerRef = useRef<number | null>(null);

  // Clear polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  // History State
  const [recentTelemetry, setRecentTelemetry] = useState<MonitoringRecord[]>([]);
  const [recentAnalyses, setRecentAnalyses] = useState<MonitoringRecord[]>([]);
  const [historyTab, setHistoryTab] = useState<'analyses' | 'disease' | 'telemetry'>('analyses');

  const fileInputId = useId();

  // Load field details and monitoring history
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
        // Fetch telemetry & analyses history concurrently
        const [telRes, analRes, diseaseRes, availRes] = await Promise.allSettled([
          monitoringService.telemetry(farmId, fieldId),
          monitoringService.listAgriculturalAnalyses(farmId, fieldId, null, 10),
          monitoringService.analyses(farmId, fieldId, null, 10),
          monitoringService.diseaseAvailability(farmId, fieldId),
        ]);

        if (telRes.status === 'fulfilled' && telRes.value?.data) {
          setRecentTelemetry(telRes.value.data);
        }
        if (analRes.status === 'fulfilled' && analRes.value?.data?.items) {
          const items = analRes.value.data.items;
          setRecentAnalyses(items);
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
      setError(e instanceof Error ? e.message : 'Failed to load field details. You may not be assigned to this field.');
    } finally {
      setLoading(false);
    }
  }, [fieldId]);

  useEffect(() => {
    loadFieldAndHistory();
  }, [loadFieldAndHistory]);

  // Form Validation
  const validateFieldData = (): boolean => {
    const errors: Partial<FormMeasurements> = {};
    const n = parseFloat(formData.n);
    if (isNaN(n) || n < 0 || n > 1000) errors.n = 'N must be between 0 and 1000 mg/kg';

    const p = parseFloat(formData.p);
    if (isNaN(p) || p < 0 || p > 1000) errors.p = 'P must be between 0 and 1000 mg/kg';

    const k = parseFloat(formData.k);
    if (isNaN(k) || k < 0 || k > 1000) errors.k = 'K must be between 0 and 1000 mg/kg';

    const temp = parseFloat(formData.temperature);
    if (isNaN(temp) || temp < -20 || temp > 60) errors.temperature = 'Temperature must be between -20 and 60 °C';

    const hum = parseFloat(formData.humidity);
    if (isNaN(hum) || hum < 0 || hum > 100) errors.humidity = 'Humidity must be between 0 and 100 %';

    const ph = parseFloat(formData.ph);
    if (isNaN(ph) || ph < 0 || ph > 14) errors.ph = 'pH must be between 0 and 14';

    const rain = parseFloat(formData.rainfall);
    if (isNaN(rain) || rain < 0 || rain > 2000) errors.rainfall = 'Rainfall must be between 0 and 2000 mm';

    const sm = parseFloat(formData.soilMoisture);
    if (isNaN(sm) || sm < 0 || sm > 100) errors.soilMoisture = 'Soil Moisture must be between 0 and 100 %';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Field Data Form
  const handleSubmitData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!field || !validateFieldData()) return;

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

    const targetFarmId = field.farmId || (fieldId && fieldId.includes('--') ? fieldId.split('--')[0] : '');
    const targetFieldId = field.fieldId || fieldId || '';

    try {
      // 1. Submit telemetry batch in a single fast atomic request (<150ms)
      try {
        await monitoringService.submitTelemetryBatch(targetFarmId, targetFieldId, itemsToSubmit.map(item => ({
          measurementType: item.measurementType,
          value: item.value,
          unit: item.unit,
          observedAt: now,
          source: 'MANUAL',
          clientEventId: `${clientBatch}_${item.measurementType}`,
        })));
      } catch (batchErr) {
        // Fallback: submit concurrently if batch endpoint unavailable
        await Promise.all(itemsToSubmit.map(item =>
          monitoringService.submitTelemetry(targetFarmId, targetFieldId, {
            measurementType: item.measurementType,
            value: item.value,
            unit: item.unit,
            observedAt: now,
            source: 'MANUAL',
            clientEventId: `${clientBatch}_${item.measurementType}`,
          })
        ));
      }

      // Refresh telemetry in background non-blockingly
      monitoringService.telemetry(targetFarmId, targetFieldId).then(telRes => {
        if (telRes?.data) setRecentTelemetry(telRes.data);
      }).catch(() => {});

      // 2. Trigger asynchronous AI field analysis lifecycle
      setAnalyzingField(true);
      setDataSuccessMsg('All 8 measurements submitted successfully. Running AI agronomic analysis in background...');

      try {
        const analysisRes = await monitoringService.createAnalysis(targetFarmId, targetFieldId, true);
        const initialRecord = analysisRes?.data;
        if (initialRecord) {
          setLatestAnalysis(initialRecord);
          const analysisId = initialRecord.analysisId || initialRecord.id;

          if (initialRecord.status === 'COMPLETED' || initialRecord.status === 'INSUFFICIENT_DATA') {
            setAnalyzingField(false);
            setDataSuccessMsg('All 8 measurements submitted and field AI analysis completed successfully.');
          } else if (analysisId) {
            let attempts = 0;
            const maxAttempts = 20; // 30s max
            if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);

            pollTimerRef.current = window.setInterval(async () => {
              attempts++;
              try {
                const pollRes = await monitoringService.agriculturalAnalysis(targetFarmId, targetFieldId, String(analysisId));
                if (pollRes?.data) {
                  const updated = pollRes.data;
                  setLatestAnalysis(updated);
                  if (updated.status === 'COMPLETED' || updated.status === 'FAILED' || updated.status === 'INSUFFICIENT_DATA' || attempts >= maxAttempts) {
                    if (pollTimerRef.current) {
                      window.clearInterval(pollTimerRef.current);
                      pollTimerRef.current = null;
                    }
                    setAnalyzingField(false);
                    if (updated.status === 'COMPLETED') {
                      setDataSuccessMsg('AI field analysis complete: Water Need and Field Status evaluated.');
                    } else if (updated.status === 'FAILED') {
                      setDataSuccessMsg('Measurements recorded. AI model evaluation encountered a transient issue.');
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

  // Image Selection Handler
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    processSelectedFile(e.target.files?.[0]);
  };

  const handleClearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageFileError(null);
    setDiseaseError(null);
  };

  // Upload Leaf Image & Disease Detection
  const handleUploadAndDetectDisease = async () => {
    if (!field || !imageFile) return;
    setAnalyzingDisease(true);
    setDiseaseStep('uploading');
    setDiseaseError(null);

    const targetFarmId = field.farmId || (fieldId && fieldId.includes('--') ? fieldId.split('--')[0] : '');
    const targetFieldId = field.fieldId || fieldId || '';

    try {
      // 1. Upload image
      const uploadRes = await monitoringService.uploadImage(targetFarmId, targetFieldId, imageFile);
      const imageId = String(uploadRes.data?.imageId || uploadRes.data?.id || '');
      if (!imageId) throw new Error('Image uploaded but server did not return an image ID.');

      // 2. Submit disease analysis
      setDiseaseStep('inferring');
      const analysisRes = await monitoringService.analyzeDisease(targetFarmId, targetFieldId, imageId);
      setDiseaseResult(analysisRes.data || null);

      // Refresh disease analyses history
      const diseaseRes = await monitoringService.analyses(targetFarmId, targetFieldId, null, 10);
      if (diseaseRes?.data?.items) {
        setDiseaseAnalyses(diseaseRes.data.items);
      }
    } catch (err: unknown) {
      setDiseaseError(parseApiErrorMessage(err, 'Disease analysis request failed.'));
    } finally {
      setAnalyzingDisease(false);
      setDiseaseStep('idle');
    }
  };

  const handleTriggerResearch = async (analysisId: string) => {
    if (!field || !analysisId) return;
    const targetFarmId = field.farmId || (fieldId && fieldId.includes('--') ? fieldId.split('--')[0] : '');
    const targetFieldId = field.fieldId || fieldId || '';
    setResearchBusy(true);
    try {
      await monitoringService.triggerDiseaseResearch(targetFarmId, targetFieldId, analysisId);
      const updated = await monitoringService.analysis(targetFarmId, targetFieldId, analysisId);
      if (updated.data) setDiseaseResult(updated.data);
    } catch (err: unknown) {
      setDiseaseError(parseApiErrorMessage(err, 'Could not trigger disease research.'));
    } finally {
      setResearchBusy(false);
    }
  };

  // Poll diseaseResult while background Selenium research is PENDING or PROCESSING
  useEffect(() => {
    if (!field || !diseaseResult) return;
    const rStatus = String(diseaseResult.researchStatus || '').toUpperCase();
    const analysisId = String(diseaseResult.analysisId || diseaseResult.id || '');
    if (!analysisId || (rStatus !== 'PENDING' && rStatus !== 'PROCESSING')) return;

    const targetFarmId = field.farmId || (fieldId && fieldId.includes('--') ? fieldId.split('--')[0] : '');
    const targetFieldId = field.fieldId || fieldId || '';
    const timer = window.setInterval(async () => {
      try {
        const res = await monitoringService.analysis(targetFarmId, targetFieldId, analysisId);
        if (res.data) {
          setDiseaseResult(res.data);
          const nextStatus = String(res.data.researchStatus || '').toUpperCase();
          if (nextStatus !== 'PENDING' && nextStatus !== 'PROCESSING') {
            window.clearInterval(timer);
          }
        }
      } catch {
        // Keep polling silently until terminal state or unmount
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [field, fieldId, diseaseResult]);

  // Run AI Field Status & Water Need Analysis
  const handleRunAiAnalysis = async () => {
    if (!field) return;
    setRunningAnalysis(true);
    setAnalysisError(null);

    const targetFarmId = field.farmId || (fieldId && fieldId.includes('--') ? fieldId.split('--')[0] : '');
    const targetFieldId = field.fieldId || fieldId || '';

    try {
      const res = await monitoringService.createAnalysis(targetFarmId, targetFieldId);
      setLatestAnalysis(res.data || null);

      // Refresh analyses history
      const analRes = await monitoringService.analyses(targetFarmId, targetFieldId, null, 10);
      if (analRes?.data?.items) {
        setRecentAnalyses(analRes.data.items);
      }
    } catch (err: unknown) {
      setAnalysisError(parseApiErrorMessage(err, 'AI analysis invocation failed.'));
    } finally {
      setRunningAnalysis(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-12">
      {/* Top Breadcrumbs */}
      <div className="flex items-center gap-2">
        <Link
          to="/farmer/fields"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Assigned Fields
        </Link>
        <span className="text-on-surface-variant text-xs">/</span>
        <span className="text-xs font-semibold text-on-surface-variant font-mono">
          {fieldId}
        </span>
      </div>

      {loading && <LoadingSkeleton type="dashboard" />}

      {!loading && error && (
        <div className="p-8 rounded-2xl bg-error/10 border border-error/30 text-center space-y-3">
          <span className="material-symbols-outlined text-[48px] text-error">lock_clock</span>
          <h2 className="text-base font-bold text-error">Access Restricted</h2>
          <p className="text-xs text-on-surface-variant max-w-md mx-auto">{error}</p>
          <Link
            to="/farmer/fields"
            className="inline-block mt-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold shadow-sm"
          >
            Return to Authorized Fields
          </Link>
        </div>
      )}

      {!loading && !error && field && (
        <>
          {/* Header Banner */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    Field Operational Dashboard
                  </span>
                  <StatusBadge status={field.status || 'ACTIVE'} />
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
                  {field.name}
                </h1>
                <p className="text-xs text-on-surface-variant mt-1">
                  Holding Farm: <span className="font-mono font-bold text-on-surface">{field.farmId}</span> • Sector ID: <span className="font-mono">{field.fieldId}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={handleRunAiAnalysis}
                disabled={runningAnalysis}
                className="h-10 px-5 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95 transition-all disabled:opacity-50 shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {runningAnalysis ? 'progress_activity' : 'psychology'}
                </span>
                <span>{runningAnalysis ? 'Running AI Engine...' : 'Run Field AI Analysis'}</span>
              </button>
            </div>
          </div>

          {/* Section 1: Field Overview */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[20px] text-primary">analytics</span>
              <h2 className="text-sm font-bold text-on-surface uppercase tracking-wide">
                1. Field Overview & Parameters
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
              <DetailRow label="Designated Crop" value={field.cropType || 'Not specified'} />
              <DetailRow label="Soil Classification" value={field.soilType || 'Loam'} />
              <DetailRow
                label="Surface Area"
                value={field.areaHectares !== undefined ? `${field.areaHectares} hectares` : '—'}
              />
              <DetailRow label="Irrigation System" value={field.irrigationType || 'DRIP'} />
              <DetailRow label="Local Field Reference" value={field.localFieldId || '—'} />
              <DetailRow
                label="Registered At"
                value={field.createdAt ? new Date(field.createdAt).toLocaleDateString() : '—'}
              />
            </div>
            {field.notes && (
              <div className="mt-4 p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs">
                <span className="font-bold text-on-surface block mb-1">Agronomic Guidelines & Notes</span>
                <p className="text-on-surface-variant leading-relaxed">{field.notes}</p>
              </div>
            )}
          </div>

          {/* AI Agronomic Decision Section (High Visibility) */}
          <div id="ai-decision" className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px] text-primary">psychiatry</span>
                <h2 className="text-base font-bold text-on-surface uppercase tracking-wide">
                  AI Agronomic Decision
                </h2>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-on-surface-variant">
                {Boolean(latestAnalysis?.analysisId) && (
                  <span className="font-mono bg-surface-container px-2 py-0.5 rounded text-[10px]">
                    ID: {String(latestAnalysis?.analysisId).substring(0, 16)}...
                  </span>
                )}
                {Boolean(latestAnalysis?.createdAt) && (
                  <span>
                    Evaluated: {new Date(String(latestAnalysis?.createdAt)).toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            {analysisError && (
              <div className="p-3.5 rounded-xl bg-error/10 border border-error/30 text-xs text-error mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{analysisError}</span>
              </div>
            )}

            {latestAnalysis ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Water Need Card */}
                  <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
                        Predicted Water Need
                      </span>
                      <div className="text-xl font-extrabold text-primary">
                        {String(latestAnalysis.predictedWaterNeed || latestAnalysis.waterNeed || 'Sufficient')}
                      </div>
                    </div>
                    {latestAnalysis.waterNeedConfidence !== undefined && (
                      <div className="mt-2 text-[10px] text-on-surface-variant">
                        Confidence: {(Number(latestAnalysis.waterNeedConfidence) * 100).toFixed(1)}%
                      </div>
                    )}
                  </div>

                  {/* Field Status Card */}
                  <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
                        Field Agronomic Status
                      </span>
                      <div className="text-xl font-extrabold text-on-surface">
                        {String(latestAnalysis.predictedFieldStatus || latestAnalysis.fieldStatus || 'Normal')}
                      </div>
                    </div>
                    {latestAnalysis.fieldStatusConfidence !== undefined && (
                      <div className="mt-2 text-[10px] text-on-surface-variant">
                        Confidence: {(Number(latestAnalysis.fieldStatusConfidence) * 100).toFixed(1)}%
                      </div>
                    )}
                  </div>

                  {/* Recommended Crop Card */}
                  <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
                        AI Recommended Crop
                      </span>
                      <div className="text-xl font-extrabold text-secondary capitalize">
                        {String(latestAnalysis.recommendedCrop || field.cropType || 'Optimal Match')}
                      </div>
                    </div>
                    {latestAnalysis.cropConfidence !== undefined && (
                      <div className="mt-2 text-[10px] text-on-surface-variant">
                        Match Confidence: {(Number(latestAnalysis.cropConfidence) * 100).toFixed(1)}%
                      </div>
                    )}
                  </div>

                  {/* Disease Detection Status Card */}
                  <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
                        Disease Detection Engine
                      </span>
                      <div className="text-base font-bold text-on-surface">
                        {diseaseResult?.status === 'COMPLETED'
                          ? 'COMPLETED'
                          : diseaseResult?.status
                            ? String(diseaseResult.status)
                            : diseaseAvailability?.available
                              ? 'AVAILABLE'
                              : String(latestAnalysis.diseaseDetectionStatus || 'MODEL_UNAVAILABLE')}
                      </div>
                    </div>
                    <div className="mt-2 text-[10px] text-on-surface-variant">
                      {diseaseResult?.status === 'COMPLETED' && (diseaseResult.diseaseName || diseaseResult.predictedClass)
                        ? `${String(diseaseResult.diseaseName || diseaseResult.predictedClass).replace(/_/g, ' ')}${
                            typeof diseaseResult.confidence === 'number' ? ` (${diseaseResult.confidence.toFixed(1)}%)` : ''
                          }`
                        : latestAnalysis.predictedDisease
                          ? String(latestAnalysis.predictedDisease)
                          : diseaseAvailability?.available
                            ? 'TFLite 94-class engine ready — upload a leaf image below'
                            : 'No unverified diagnosis fabricated'}
                    </div>
                  </div>
                </div>

                {/* Agronomic Disclaimer */}
                <div className="p-3.5 rounded-xl bg-secondary-container/20 border border-secondary/30 text-xs text-on-surface-variant flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-secondary shrink-0 mt-0.5">info</span>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="font-semibold text-on-surface text-[11px]">
                        Agronomic Rule-Derived Model Notice (label_method=agronomic_rule_v1)
                      </p>
                      {Boolean(latestAnalysis.tabularModelVersion) && (
                        <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-mono text-[10px]">
                          Model: {String(latestAnalysis.tabularModelVersion)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      Water Need and Field Status are predicted using machine learning models trained on agronomic rule-derived labels.
                      They provide operational stewardship guidance and are not independently validated agronomic ground truth.
                    </p>
                  </div>
                </div>

                {/* Submitted Field Measurements Evaluated */}
                {Array.isArray(latestAnalysis.measurements) && (latestAnalysis.measurements as Record<string, unknown>[]).length > 0 && (
                  <div className="pt-2">
                    <span className="text-[11px] font-bold text-on-surface uppercase tracking-wider block mb-2">
                      Underlying Physical Telemetry Evaluated
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(latestAnalysis.measurements as Record<string, unknown>[]).slice(0, 8).map((m, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/15 text-xs">
                          <span className="text-[10px] text-on-surface-variant block font-medium">
                            {String(m.measurementType || 'MEASUREMENT')}
                          </span>
                          <span className="font-bold text-on-surface text-xs">
                            {String(m.value ?? m.rawValue ?? '—')} {String(m.unit || '')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-surface-container-low text-center space-y-2">
                <span className="material-symbols-outlined text-[36px] text-on-surface-variant">monitoring</span>
                <p className="text-xs font-semibold text-on-surface">No Field Status Evaluations Recorded Yet</p>
                <p className="text-[11px] text-on-surface-variant">
                  Upload field measurements below and click &quot;Run Field AI Analysis&quot; to compute Water Need and Field Status.
                </p>
              </div>
            )}
          </div>

          {/* Section 2: Upload Agricultural Field Data Form */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary">upload_file</span>
              <h2 className="text-sm font-bold text-on-surface uppercase tracking-wide">
                2. Upload Agricultural Field Data
              </h2>
            </div>
            <p className="text-xs text-on-surface-variant">
              Submit physical and soil telemetry collected from this field sector. Each value is validated against agronomic domain thresholds.
            </p>

            {dataSuccessMsg && (
              <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/30 text-xs font-semibold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>{dataSuccessMsg}</span>
              </div>
            )}

            {dataErrorMsg && (
              <div className="p-3.5 rounded-xl bg-error/10 border border-error/30 text-xs font-semibold text-error flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{dataErrorMsg}</span>
              </div>
            )}

            {analyzingField && (
              <div className="p-3.5 rounded-xl bg-secondary/10 border border-secondary/30 text-xs text-on-surface flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px] text-secondary animate-spin">sync</span>
                <div className="flex-1">
                  <p className="font-bold text-secondary">AI Agronomic Analysis in Progress</p>
                  <p className="text-[11px] text-on-surface-variant">Evaluating soil chemistry, water requirements, and field health status. You can navigate away at any time.</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitData} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Nitrogen */}
                <div className="space-y-1">
                  <label htmlFor="field-n" className="text-xs font-bold text-on-surface flex items-center justify-between">
                    <span>Nitrogen (N)</span>
                    <span className="text-[10px] font-normal text-on-surface-variant">mg/kg</span>
                  </label>
                  <input
                    id="field-n"
                    type="number"
                    step="0.01"
                    placeholder="e.g. 90"
                    value={formData.n}
                    onChange={(e) => setFormData({ ...formData, n: e.target.value })}
                    className={`w-full h-10 px-3 rounded-xl bg-surface-container-low border text-xs text-on-surface focus:outline-none focus:border-primary ${
                      formErrors.n ? 'border-error' : 'border-outline-variant/40'
                    }`}
                  />
                  {formErrors.n && <p className="text-[10px] text-error">{formErrors.n}</p>}
                </div>

                {/* Phosphorus */}
                <div className="space-y-1">
                  <label htmlFor="field-p" className="text-xs font-bold text-on-surface flex items-center justify-between">
                    <span>Phosphorus (P)</span>
                    <span className="text-[10px] font-normal text-on-surface-variant">mg/kg</span>
                  </label>
                  <input
                    id="field-p"
                    type="number"
                    step="0.01"
                    placeholder="e.g. 42"
                    value={formData.p}
                    onChange={(e) => setFormData({ ...formData, p: e.target.value })}
                    className={`w-full h-10 px-3 rounded-xl bg-surface-container-low border text-xs text-on-surface focus:outline-none focus:border-primary ${
                      formErrors.p ? 'border-error' : 'border-outline-variant/40'
                    }`}
                  />
                  {formErrors.p && <p className="text-[10px] text-error">{formErrors.p}</p>}
                </div>

                {/* Potassium */}
                <div className="space-y-1">
                  <label htmlFor="field-k" className="text-xs font-bold text-on-surface flex items-center justify-between">
                    <span>Potassium (K)</span>
                    <span className="text-[10px] font-normal text-on-surface-variant">mg/kg</span>
                  </label>
                  <input
                    id="field-k"
                    type="number"
                    step="0.01"
                    placeholder="e.g. 43"
                    value={formData.k}
                    onChange={(e) => setFormData({ ...formData, k: e.target.value })}
                    className={`w-full h-10 px-3 rounded-xl bg-surface-container-low border text-xs text-on-surface focus:outline-none focus:border-primary ${
                      formErrors.k ? 'border-error' : 'border-outline-variant/40'
                    }`}
                  />
                  {formErrors.k && <p className="text-[10px] text-error">{formErrors.k}</p>}
                </div>

                {/* Temperature */}
                <div className="space-y-1">
                  <label htmlFor="field-temp" className="text-xs font-bold text-on-surface flex items-center justify-between">
                    <span>Temperature</span>
                    <span className="text-[10px] font-normal text-on-surface-variant">°C</span>
                  </label>
                  <input
                    id="field-temp"
                    type="number"
                    step="0.1"
                    placeholder="e.g. 24.5"
                    value={formData.temperature}
                    onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                    className={`w-full h-10 px-3 rounded-xl bg-surface-container-low border text-xs text-on-surface focus:outline-none focus:border-primary ${
                      formErrors.temperature ? 'border-error' : 'border-outline-variant/40'
                    }`}
                  />
                  {formErrors.temperature && <p className="text-[10px] text-error">{formErrors.temperature}</p>}
                </div>

                {/* Humidity */}
                <div className="space-y-1">
                  <label htmlFor="field-hum" className="text-xs font-bold text-on-surface flex items-center justify-between">
                    <span>Relative Humidity</span>
                    <span className="text-[10px] font-normal text-on-surface-variant">%</span>
                  </label>
                  <input
                    id="field-hum"
                    type="number"
                    step="0.1"
                    placeholder="e.g. 78.0"
                    value={formData.humidity}
                    onChange={(e) => setFormData({ ...formData, humidity: e.target.value })}
                    className={`w-full h-10 px-3 rounded-xl bg-surface-container-low border text-xs text-on-surface focus:outline-none focus:border-primary ${
                      formErrors.humidity ? 'border-error' : 'border-outline-variant/40'
                    }`}
                  />
                  {formErrors.humidity && <p className="text-[10px] text-error">{formErrors.humidity}</p>}
                </div>

                {/* Soil pH */}
                <div className="space-y-1">
                  <label htmlFor="field-ph" className="text-xs font-bold text-on-surface flex items-center justify-between">
                    <span>Soil pH</span>
                    <span className="text-[10px] font-normal text-on-surface-variant">0 - 14</span>
                  </label>
                  <input
                    id="field-ph"
                    type="number"
                    step="0.01"
                    placeholder="e.g. 6.5"
                    value={formData.ph}
                    onChange={(e) => setFormData({ ...formData, ph: e.target.value })}
                    className={`w-full h-10 px-3 rounded-xl bg-surface-container-low border text-xs text-on-surface focus:outline-none focus:border-primary ${
                      formErrors.ph ? 'border-error' : 'border-outline-variant/40'
                    }`}
                  />
                  {formErrors.ph && <p className="text-[10px] text-error">{formErrors.ph}</p>}
                </div>

                {/* Rainfall */}
                <div className="space-y-1">
                  <label htmlFor="field-rain" className="text-xs font-bold text-on-surface flex items-center justify-between">
                    <span>Rainfall</span>
                    <span className="text-[10px] font-normal text-on-surface-variant">mm</span>
                  </label>
                  <input
                    id="field-rain"
                    type="number"
                    step="0.1"
                    placeholder="e.g. 150.0"
                    value={formData.rainfall}
                    onChange={(e) => setFormData({ ...formData, rainfall: e.target.value })}
                    className={`w-full h-10 px-3 rounded-xl bg-surface-container-low border text-xs text-on-surface focus:outline-none focus:border-primary ${
                      formErrors.rainfall ? 'border-error' : 'border-outline-variant/40'
                    }`}
                  />
                  {formErrors.rainfall && <p className="text-[10px] text-error">{formErrors.rainfall}</p>}
                </div>

                {/* Soil Moisture */}
                <div className="space-y-1">
                  <label htmlFor="field-moist" className="text-xs font-bold text-on-surface flex items-center justify-between">
                    <span>Soil Moisture</span>
                    <span className="text-[10px] font-normal text-on-surface-variant">%</span>
                  </label>
                  <input
                    id="field-moist"
                    type="number"
                    step="0.1"
                    placeholder="e.g. 45.2"
                    value={formData.soilMoisture}
                    onChange={(e) => setFormData({ ...formData, soilMoisture: e.target.value })}
                    className={`w-full h-10 px-3 rounded-xl bg-surface-container-low border text-xs text-on-surface focus:outline-none focus:border-primary ${
                      formErrors.soilMoisture ? 'border-error' : 'border-outline-variant/40'
                    }`}
                  />
                  {formErrors.soilMoisture && <p className="text-[10px] text-error">{formErrors.soilMoisture}</p>}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submittingData}
                  className="h-10 px-6 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm active:scale-95 transition-all disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {submittingData ? 'progress_activity' : 'send'}
                  </span>
                  <span>{submittingData ? 'Submitting Measurements...' : 'Submit Field Telemetry'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Section 3: Leaf Image Upload — Disease Detection */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary">image_search</span>
              <h2 className="text-sm font-bold text-on-surface uppercase tracking-wide">
                3. Leaf Disease Detection Upload
              </h2>
            </div>
            <p className="text-xs text-on-surface-variant">
              Upload clear leaf photographs (PNG or JPEG, maximum 8 MiB) collected from this field zone for inspection.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* File Dropzone */}
              <div className="space-y-3">
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
                  className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    dragActive
                      ? 'border-primary bg-primary/5'
                      : 'border-outline-variant/40 hover:border-primary hover:bg-surface-container-low'
                  }`}
                >
                  <span className="material-symbols-outlined text-[36px] text-on-surface-variant mb-2">add_photo_alternate</span>
                  <span className="text-xs font-bold text-on-surface">Drag & drop or click to select leaf image</span>
                  <span className="text-[10px] text-on-surface-variant mt-1">PNG or JPEG format (max 8 MiB)</span>
                  <input
                    id={fileInputId}
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </label>

                {imageFileError && (
                  <p className="text-xs text-error font-medium">{imageFileError}</p>
                )}

                {imageFile && (
                  <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-surface-container-low text-xs">
                    <span className="font-semibold text-on-surface truncate max-w-[180px]">{imageFile.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-on-surface-variant">{(imageFile.size / 1024).toFixed(1)} KB</span>
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

                <button
                  type="button"
                  onClick={handleUploadAndDetectDisease}
                  disabled={!imageFile || analyzingDisease}
                  className="w-full h-10 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 transition-all disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-[16px] ${analyzingDisease ? 'animate-spin' : ''}`}>
                    {analyzingDisease ? 'progress_activity' : 'cloud_upload'}
                  </span>
                  <span>
                    {diseaseStep === 'uploading'
                      ? 'Uploading Leaf Image...'
                      : diseaseStep === 'inferring'
                        ? 'Running Disease Model...'
                        : 'Upload & Analyze Leaf'}
                  </span>
                </button>
              </div>

              {/* Preview & Result */}
              <div className="space-y-3">
                {imagePreview ? (
                  <div className="rounded-2xl overflow-hidden border border-outline-variant/30 bg-surface-container-low h-48 flex items-center justify-center">
                    <img src={imagePreview} alt="Leaf Preview" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low h-48 flex flex-col items-center justify-center text-on-surface-variant text-xs">
                    <span className="material-symbols-outlined text-[32px] mb-1">preview</span>
                    <span>No image selected</span>
                  </div>
                )}

                {diseaseError && (
                  <div className="p-3 rounded-xl bg-error/10 border border-error/30 text-xs text-error flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">error</span>
                      <span>{diseaseError}</span>
                    </div>
                    {imageFile && (
                      <button
                        type="button"
                        onClick={handleUploadAndDetectDisease}
                        className="px-2.5 py-1 rounded-lg bg-primary text-on-primary text-[11px] font-bold cursor-pointer shrink-0"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                )}

                <DiseaseDetectionCard
                  analysis={diseaseResult}
                  onRetry={imageFile ? handleUploadAndDetectDisease : undefined}
                  onTriggerResearch={handleTriggerResearch}
                  researchBusy={researchBusy}
                />
              </div>
            </div>
          </div>

          {/* Section 6: Previous Submissions & Analysis History */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">history</span>
                <h2 className="text-sm font-bold text-on-surface uppercase tracking-wide">
                  6. Submissions & Diagnostic History
                </h2>
              </div>
              <div className="flex items-center gap-1 p-1 bg-surface-container-low rounded-xl">
                <button
                  type="button"
                  onClick={() => setHistoryTab('analyses')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    historyTab === 'analyses'
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  AI Analyses ({recentAnalyses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryTab('disease')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    historyTab === 'disease'
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Disease Detections ({diseaseAnalyses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryTab('telemetry')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    historyTab === 'telemetry'
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Telemetry Log ({recentTelemetry.length})
                </button>
              </div>
            </div>

            {historyTab === 'disease' && (
              <div className="space-y-3">
                {diseaseAnalyses.length === 0 ? (
                  <p className="text-xs text-on-surface-variant text-center py-6">No crop leaf disease detections recorded.</p>
                ) : (
                  <div className="divide-y divide-outline-variant/15">
                    {diseaseAnalyses.map((item, idx) => {
                      const conf = parseConfidencePercent(item);
                      const dName = item.diseaseName || item.predictedClass;
                      return (
                        <div key={String(item.id || item.analysisId || idx)} className="py-3 flex flex-wrap items-center justify-between gap-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-on-surface font-mono">
                                {String(item.id || item.analysisId || 'Analysis').substring(0, 18)}...
                              </span>
                              <StatusBadge status={String(item.status || 'COMPLETED')} />
                              {item.status === 'COMPLETED' && typeof item.isHealthy === 'boolean' && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  item.isHealthy
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                }`}>
                                  {item.isHealthy ? 'Healthy' : 'Disease Detected'}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-on-surface-variant">
                              {item.createdAt ? new Date(String(item.createdAt)).toLocaleString() : 'Recent'}
                              {item.modelVersion ? ` • ${String(item.modelVersion)}` : ''}
                            </p>
                          </div>
                          <div className="text-right text-xs">
                            {item.status === 'COMPLETED' && dName ? (
                              <span className="font-bold text-primary">
                                {formatDiseaseLabel(String(dName))}
                                {conf !== null ? ` (${conf.toFixed(1)}%)` : ''}
                              </span>
                            ) : (
                              <span className="text-on-surface-variant">{String(item.errorMessage || item.status || '—')}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {historyTab === 'analyses' && (
              <div className="space-y-3">
                {recentAnalyses.length === 0 ? (
                  <p className="text-xs text-on-surface-variant text-center py-6">No previous AI analyses recorded.</p>
                ) : (
                  <div className="divide-y divide-outline-variant/15">
                    {recentAnalyses.map((item, idx) => (
                      <div key={String(item.id || item.analysisId || idx)} className="py-3 flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-on-surface font-mono">
                              {String(item.id || item.analysisId || 'Analysis').substring(0, 16)}...
                            </span>
                            <StatusBadge status={String(item.status || 'COMPLETED')} />
                          </div>
                          <p className="text-[11px] text-on-surface-variant">
                            {item.createdAt ? new Date(String(item.createdAt)).toLocaleString() : 'Recent'} • Type: {String(item.analysisType || 'AGRICULTURAL')}
                          </p>
                        </div>
                        <div className="text-right text-xs">
                          {item.predictedWaterNeed ? (
                            <span className="font-semibold text-primary">Water: {String(item.predictedWaterNeed)}</span>
                          ) : (
                            <span className="text-on-surface-variant">Summary</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {historyTab === 'telemetry' && (
              <div className="space-y-3">
                {recentTelemetry.length === 0 ? (
                  <p className="text-xs text-on-surface-variant text-center py-6">No telemetry readings recorded.</p>
                ) : (
                  <div className="divide-y divide-outline-variant/15">
                    {recentTelemetry.map((item, idx) => (
                      <div key={String(item.id || item.telemetryId || idx)} className="py-2.5 flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <span className="text-xs font-semibold text-on-surface">
                            {String(item.measurementType || 'MEASUREMENT')}
                          </span>
                          <p className="text-[11px] text-on-surface-variant">
                            Observed: {item.observedAt ? new Date(String(item.observedAt)).toLocaleString() : '—'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-primary">
                            {String(item.rawValue ?? item.value ?? '—')} {String(item.unit || '')}
                          </span>
                          <span className={`block text-[10px] font-semibold ${
                            item.validationStatus === 'VALID' ? 'text-primary' : 'text-error'
                          }`}>
                            {String(item.validationStatus || 'RECORDED')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
