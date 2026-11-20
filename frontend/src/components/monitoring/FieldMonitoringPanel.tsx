import React, { useCallback, useEffect, useState } from 'react';
import { fieldService } from '../../services/fieldService';
import { monitoringService, validateCropImageFile, type MonitoringRecord } from '../../services/monitoringService';
import type { Field } from '../../types/field';
import './FieldMonitoringPanel.css';

interface Props { farmId: string; fieldId?: string; compact?: boolean; canManage?: boolean }

const appendUnique = (current: MonitoringRecord[], incoming: MonitoringRecord[], fallbackKey: string) => {
  const seen = new Set(current.map(item => String(item.id ?? item[fallbackKey] ?? '')));
  return [...current, ...incoming.filter(item => {
    const id = String(item.id ?? item[fallbackKey] ?? '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  })];
};

export const FieldMonitoringPanel: React.FC<Props> = ({ farmId, fieldId: fixedFieldId, compact = false, canManage = false }) => {
  const [fields, setFields] = useState<Field[]>([]);
  const [selected, setSelected] = useState(fixedFieldId || '');
  const [readings, setReadings] = useState<MonitoringRecord[]>([]);
  const [images, setImages] = useState<MonitoringRecord[]>([]);
  const [history, setHistory] = useState<MonitoringRecord[]>([]);
  const [telemetryHistory, setTelemetryHistory] = useState<MonitoringRecord[]>([]);
  const [analyses, setAnalyses] = useState<MonitoringRecord[]>([]);
  const [plans, setPlans] = useState<MonitoringRecord[]>([]);
  const [imageCursor, setImageCursor] = useState<string | null>(null);
  const [imageHasMore, setImageHasMore] = useState(false);
  const [analysisCursor, setAnalysisCursor] = useState<string | null>(null);
  const [analysisHasMore, setAnalysisHasMore] = useState(false);
  const [planCursor, setPlanCursor] = useState<string | null>(null);
  const [planHasMore, setPlanHasMore] = useState(false);
  const [loadingPage, setLoadingPage] = useState<string | null>(null);
  const [modelAvailability, setModelAvailability] = useState<MonitoringRecord | null>(null);
  const [recordDetails, setRecordDetails] = useState<Record<string, MonitoringRecord>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [value, setValue] = useState('');
  const [measurementFilter, setMeasurementFilter] = useState('SOIL_MOISTURE');
  const [telemetryFrom, setTelemetryFrom] = useState('');
  const [telemetryTo, setTelemetryTo] = useState('');
  const [telemetryCursor, setTelemetryCursor] = useState<string | null>(null);
  const [telemetryHasMore, setTelemetryHasMore] = useState(false);
  const [eventFilter, setEventFilter] = useState('');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);

  const refresh = useCallback(async () => {
    if (!selected) return;
    const [soil, imagePage, historyPage, telemetryPage, analysisPage, planPage, availability] = await Promise.all([
      monitoringService.telemetry(farmId, selected), monitoringService.listImages(farmId, selected), monitoringService.history(
        farmId, selected, undefined, eventFilter || undefined,
        historyFrom ? Date.parse(`${historyFrom}T00:00:00Z`) : undefined,
        historyTo ? Date.parse(`${historyTo}T23:59:59Z`) : undefined),
      monitoringService.telemetryHistory(farmId, selected, measurementFilter, undefined,
        telemetryFrom ? Date.parse(`${telemetryFrom}T00:00:00Z`) : undefined,
        telemetryTo ? Date.parse(`${telemetryTo}T23:59:59Z`) : undefined),
      monitoringService.analyses(farmId, selected), monitoringService.irrigationPlans(farmId, selected),
      monitoringService.diseaseAvailability(farmId, selected),
    ]);
    setReadings(soil.data || []); setImages(imagePage.data?.items || []); setHistory(historyPage.data?.items || []);
    setTelemetryHistory(telemetryPage.data?.items || []); setAnalyses(analysisPage.data?.items || []); setPlans(planPage.data?.items || []);
    setImageCursor(imagePage.data?.nextCursor || null); setImageHasMore(Boolean(imagePage.data?.hasNext));
    setAnalysisCursor(analysisPage.data?.nextCursor || null); setAnalysisHasMore(Boolean(analysisPage.data?.hasNext));
    setPlanCursor(planPage.data?.nextCursor || null); setPlanHasMore(Boolean(planPage.data?.hasNext));
    setHistoryCursor(historyPage.data?.nextCursor || null); setHistoryHasMore(Boolean(historyPage.data?.hasNext));
    setModelAvailability(availability.data || null);
    setTelemetryCursor(telemetryPage.data?.nextCursor || null); setTelemetryHasMore(Boolean(telemetryPage.data?.hasNext));
  }, [farmId, selected, eventFilter, historyFrom, historyTo, measurementFilter, telemetryFrom, telemetryTo]);
  useEffect(() => {
    if (!fixedFieldId) fieldService.fetchFields(farmId).then(resp => {
      const available = resp.data || []; setFields(available); if (available[0]) setSelected(available[0].fieldId);
    }).catch(error => setMessage(error instanceof Error ? error.message : 'Could not load fields'));
  }, [farmId, fixedFieldId]);
  useEffect(() => { refresh().catch(error => setMessage(error instanceof Error ? error.message : 'Could not load monitoring data')); }, [refresh]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true); setMessage('');
    try { await action(); await refresh(); setMessage(done); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Action failed'); }
    finally { setBusy(false); }
  };
  const uploadAndAnalyze = async () => {
    if (!file || !selected) return;
    setBusy(true); setMessage('');
    try {
      const uploaded = await monitoringService.uploadImage(farmId, selected, file);
      const id = String(uploaded.data?.imageId || uploaded.data?.id || '');
      if (id) {
        const result = await monitoringService.analyzeDisease(farmId, selected, id);
        const status = String(result.data?.status || 'UNKNOWN');
        setMessage(status === 'MODEL_UNAVAILABLE'
          ? 'Disease detection is unavailable: the trained model has not been supplied. No diagnosis or confidence was produced.'
          : `Analysis status: ${status}`);
      } else setMessage('Image uploaded; no image identifier was returned.');
      setFile(null); setPreview(''); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Image processing failed'); }
    finally { setBusy(false); }
  };

  const downloadImage = async (imageId: string) => {
    try {
      const blob = await monitoringService.getImageContent(farmId, selected, imageId);
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = imageId; link.click(); URL.revokeObjectURL(url);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Image retrieval failed'); }
  };
  const loadMoreHistory = async () => {
    if (!historyCursor) return;
    try {
      const page = await monitoringService.history(farmId, selected, historyCursor, eventFilter || undefined,
        historyFrom ? Date.parse(`${historyFrom}T00:00:00Z`) : undefined,
        historyTo ? Date.parse(`${historyTo}T23:59:59Z`) : undefined);
      setHistory(current => [...current, ...(page.data?.items || [])]);
      setHistoryCursor(page.data?.nextCursor || null); setHistoryHasMore(Boolean(page.data?.hasNext));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load more history'); }
  };
  const loadMoreTelemetry = async () => {
    if (!telemetryCursor) return;
    try {
      const page = await monitoringService.telemetryHistory(farmId, selected, measurementFilter, telemetryCursor,
        telemetryFrom ? Date.parse(`${telemetryFrom}T00:00:00Z`) : undefined,
        telemetryTo ? Date.parse(`${telemetryTo}T23:59:59Z`) : undefined);
      setTelemetryHistory(current => [...current, ...(page.data?.items || [])]);
      setTelemetryCursor(page.data?.nextCursor || null); setTelemetryHasMore(Boolean(page.data?.hasNext));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load more readings'); }
  };
  const loadMoreImages = async () => {
    if (!imageCursor || loadingPage) return;
    setLoadingPage('images'); setMessage('');
    try {
      const page = await monitoringService.listImages(farmId, selected, imageCursor);
      setImages(current => appendUnique(current, page.data?.items || [], 'imageId'));
      setImageCursor(page.data?.nextCursor || null); setImageHasMore(Boolean(page.data?.hasNext));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load more images'); }
    finally { setLoadingPage(null); }
  };
  const loadMoreAnalyses = async () => {
    if (!analysisCursor || loadingPage) return;
    setLoadingPage('analyses'); setMessage('');
    try {
      const page = await monitoringService.analyses(farmId, selected, analysisCursor);
      setAnalyses(current => appendUnique(current, page.data?.items || [], 'analysisId'));
      setAnalysisCursor(page.data?.nextCursor || null); setAnalysisHasMore(Boolean(page.data?.hasNext));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load more analyses'); }
    finally { setLoadingPage(null); }
  };
  const loadMorePlans = async () => {
    if (!planCursor || loadingPage) return;
    setLoadingPage('plans'); setMessage('');
    try {
      const page = await monitoringService.irrigationPlans(farmId, selected, planCursor);
      setPlans(current => appendUnique(current, page.data?.items || [], 'planId'));
      setPlanCursor(page.data?.nextCursor || null); setPlanHasMore(Boolean(page.data?.hasNext));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load more irrigation plans'); }
    finally { setLoadingPage(null); }
  };
  const showDetails = async (key: string, load: () => Promise<{ data: MonitoringRecord | null }>) => {
    try { const response = await load(); if (response.data) setRecordDetails(current => ({ ...current, [key]: response.data! })); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load record details'); }
  };
  const trend = telemetryHistory.slice().reverse();
  const trendValues = trend.map(item => Number(item.value));
  const trendMin = Math.min(...trendValues); const trendMax = Math.max(...trendValues);
  return <section className="field-monitoring-panel" style={{ marginTop: 20, padding: 18, border: '1px solid #D1D5DB', borderRadius: 8, background: '#fff' }}>
    <h3 style={{ marginTop: 0, color: '#1B4332' }}>Field monitoring</h3>
    {!fixedFieldId && <label>Field <select value={selected} onChange={event => setSelected(event.target.value)}>
      {fields.map(field => <option key={field.fieldId} value={field.fieldId}>{field.name}</option>)}
    </select></label>}
    <p role="status" style={{ padding: 10, background: modelAvailability?.status === 'AVAILABLE' ? '#DCFCE7' : '#FEF3C7', color: '#78350F', borderRadius: 5 }}>
      {modelAvailability?.status === 'AVAILABLE'
        ? `Disease inference model available: ${String(modelAvailability.model_name)}@${String(modelAvailability.model_version)}. Results are still decision support and are not a verified field diagnosis.`
        : `Disease detection status: ${String(modelAvailability?.status || 'CHECKING')}. ${String(modelAvailability?.message || 'Checking model availability.')}`}
    </p>
    {message && <p role="status" style={{ color: message.toLowerCase().includes('failed') || message.toLowerCase().includes('could not') ? '#991B1B' : '#166534' }}>{message}</p>}
    {!compact && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '12px 0' }}>
      <input aria-label="Crop image" type="file" accept="image/png,image/jpeg" onChange={e => {
        const candidate = e.target.files?.[0] || null;
        if (!candidate) { setFile(null); setPreview(''); return; }
        const validationMessage = validateCropImageFile(candidate);
        if (validationMessage) { setFile(null); setPreview(''); setMessage(validationMessage); return; }
        setMessage(''); setFile(candidate); setPreview(URL.createObjectURL(candidate));
      }} />
      <button disabled={busy || !file || !selected} onClick={uploadAndAnalyze}>Upload image and check model status</button>
    </div>}
    {preview && <img src={preview} alt="Selected crop upload preview" style={{ display: 'block', maxWidth: 240, maxHeight: 180, objectFit: 'contain', margin: '8px 0' }} />}
    <div className="monitoring-soil-controls" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <label>Soil moisture (%) <input type="number" min="0" max="100" value={value} onChange={e => setValue(e.target.value)} /></label>
      <button disabled={busy || !selected || value === ''} onClick={() => run(() => monitoringService.submitTelemetry(farmId, selected, {
        measurementType: 'SOIL_MOISTURE', value: Number(value), unit: '%', observedAt: new Date().toISOString(), source: 'MANUAL',
      }), 'Soil reading saved.')}>Save reading</button>
      <button disabled={busy || !selected} onClick={() => run(() => monitoringService.createAnalysis(farmId, selected), 'Evidence summary saved.')}>Create evidence summary</button>
      <button disabled={busy || !selected} onClick={() => run(() => monitoringService.createIrrigationPlan(farmId, selected), 'Irrigation plan saved.')}>Create irrigation plan</button>
    </div>
    <h4>Latest stored soil readings</h4>
    {readings.length === 0 ? <p>No readings recorded.</p> : <ul>{readings.map(r => <li key={String(r.id || r.telemetryId)}>
      {String(r.measurementType)}: {String(r.value)} {String(r.unit)} ({String(r.observedAt)}) · source {String(r.source)}{r.sensorId ? ` · sensor ${String(r.sensorId)}` : ''}
      {r.validationStatus === 'OUT_OF_RANGE' ? ` · WARNING: ${Array.isArray(r.warnings) ? r.warnings.map(String).join('; ') : 'out-of-range reading'}` : ''}
    </li>)}</ul>}
    <div className="monitoring-filter-controls">
      <label>Trend measurement <select value={measurementFilter} onChange={event => setMeasurementFilter(event.target.value)}>
        {['SOIL_MOISTURE', 'SOIL_TEMPERATURE', 'SOIL_PH', 'ELECTRICAL_CONDUCTIVITY', 'NITROGEN', 'PHOSPHORUS', 'POTASSIUM'].map(type => <option key={type}>{type}</option>)}
      </select></label>
      <label>From <input type="date" value={telemetryFrom} onChange={event => setTelemetryFrom(event.target.value)} /></label>
      <label>To <input type="date" value={telemetryTo} onChange={event => setTelemetryTo(event.target.value)} /></label>
    </div>
    {telemetryHistory.length > 0 && <svg role="img" aria-label={`${measurementFilter} persisted history`} viewBox="0 0 320 110" width="320" height="110">
      <text x="4" y="14" fontSize="11">Persisted {measurementFilter} · newest 50</text>
      {trend.map((reading, index) => {
        const x = 8 + index * (300 / Math.max(1, trend.length - 1));
        const y = 86 - (trendMax === trendMin ? 0.5 : (Number(reading.value) - trendMin) / (trendMax - trendMin)) * 60;
        return <circle key={String(reading.id || reading.telemetryId)} cx={x} cy={y} r="3" fill="#2D6A4F"><title>{`${String(reading.value)} ${String(reading.unit)} at ${String(reading.observedAt)}`}</title></circle>;
      })}
    </svg>}
    {telemetryHasMore && <button onClick={loadMoreTelemetry}>Load more readings</button>}
    <h4>Crop images ({images.length})</h4>
    {images.filter(item => item.deleted !== true).map(item => <div className="monitoring-record-row" key={String(item.id || item.imageId)} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
      <span>{String(item.originalFilename || item.imageId)} — {String(item.processingStatus || 'UPLOADED')}</span>
      <button onClick={() => showDetails(`image:${String(item.imageId || item.id)}`, () => monitoringService.imageMetadata(farmId, selected, String(item.imageId || item.id)))}>Details</button>
      <button onClick={() => downloadImage(String(item.imageId || item.id))}>Download</button>
      <button disabled={busy} onClick={() => run(() => monitoringService.analyzeDisease(farmId, selected, String(item.imageId || item.id)), 'Disease analysis status refreshed.')}>Check disease status</button>
      {canManage && <button disabled={busy} onClick={() => run(() => monitoringService.deleteImage(farmId, selected, String(item.imageId || item.id)), 'Image deleted.')}>Delete image</button>}
      {recordDetails[`image:${String(item.imageId || item.id)}`] && <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(recordDetails[`image:${String(item.imageId || item.id)}`], null, 2)}</pre>}
    </div>)}
    {imageHasMore ? <button disabled={loadingPage !== null} onClick={loadMoreImages}>{loadingPage === 'images' ? 'Loading images…' : 'Load more images'}</button> : <p>End of image list.</p>}
    <h4>Disease analyses ({analyses.length})</h4>
    {analyses.map(item => <div className="monitoring-record-row" key={String(item.id || item.analysisId)}>{String(item.analysisType || 'DISEASE_DETECTION')}: <strong>{String(item.status)}</strong>{item.status === 'MODEL_UNAVAILABLE' ? ' — no diagnosis or confidence was produced.' : ''}{item.status === 'COMPLETED' ? ` — ${String(item.predictedClass)} · score ${String(item.confidenceScore)} (${String(item.confidenceSemantics || 'model output')})` : ''}{item.errorMessage ? ` — ${String(item.errorMessage)}` : ''}
      <button onClick={() => showDetails(`analysis:${String(item.analysisId || item.id)}`, () => monitoringService.analysis(farmId, selected, String(item.analysisId || item.id)))}>Details</button>
      {recordDetails[`analysis:${String(item.analysisId || item.id)}`] && <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(recordDetails[`analysis:${String(item.analysisId || item.id)}`], null, 2)}</pre>}
    </div>)}
    {analysisHasMore ? <button disabled={loadingPage !== null} onClick={loadMoreAnalyses}>{loadingPage === 'analyses' ? 'Loading analyses…' : 'Load more analyses'}</button> : <p>End of analysis history.</p>}
    <h4>Irrigation plans ({plans.length})</h4>
    {plans.map(item => <div className="monitoring-record-row" key={String(item.id || item.planId)}>{String(item.recommendationStatus)} · {String(item.status)} — {String(item.rationale)}
      <button onClick={() => showDetails(`plan:${String(item.planId || item.id)}`, () => monitoringService.irrigationPlan(farmId, selected, String(item.planId || item.id)))}>Details</button>
      {recordDetails[`plan:${String(item.planId || item.id)}`] && <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(recordDetails[`plan:${String(item.planId || item.id)}`], null, 2)}</pre>}
      {canManage && item.status === 'DRAFT' && <><button disabled={busy} onClick={() => run(() => monitoringService.updatePlanStatus(farmId, selected, String(item.planId || item.id), 'SCHEDULED'), 'Plan scheduled.')}>Mark scheduled</button><button disabled={busy} onClick={() => run(() => monitoringService.updatePlanStatus(farmId, selected, String(item.planId || item.id), 'CANCELLED'), 'Plan cancelled.')}>Cancel</button></>}
      {canManage && item.status === 'SCHEDULED' && <><button disabled={busy} onClick={() => run(() => monitoringService.updatePlanStatus(farmId, selected, String(item.planId || item.id), 'COMPLETED'), 'Plan completed.')}>Mark completed</button><button disabled={busy} onClick={() => run(() => monitoringService.updatePlanStatus(farmId, selected, String(item.planId || item.id), 'CANCELLED'), 'Plan cancelled.')}>Cancel</button></>}
    </div>)}
    {planHasMore ? <button disabled={loadingPage !== null} onClick={loadMorePlans}>{loadingPage === 'plans' ? 'Loading irrigation plans…' : 'Load more irrigation plans'}</button> : <p>End of irrigation plan history.</p>}
    <details><summary>Field activity ({history.length})</summary>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label>Event type <select value={eventFilter} onChange={event => setEventFilter(event.target.value)}><option value="">All events</option>{['CROP_IMAGE_UPLOADED', 'CROP_IMAGE_DELETED', 'SOIL_TELEMETRY_RECORDED', 'DISEASE_ANALYSIS_REQUESTED', 'IRRIGATION_PLAN_CREATED'].map(type => <option key={type}>{type}</option>)}</select></label>
        <label>From <input type="date" value={historyFrom} onChange={event => setHistoryFrom(event.target.value)} /></label>
        <label>To <input type="date" value={historyTo} onChange={event => setHistoryTo(event.target.value)} /></label>
      </div>
      <ul>{history.map(item => <li key={String(item.id || item.activityId)}>{String(item.eventType)} — {String(item.createdAt)}
        <button onClick={() => showDetails(`activity:${String(item.eventId || item.id)}`, () => monitoringService.historyItem(farmId, selected, String(item.eventId || item.id)))}>Details</button>
        {recordDetails[`activity:${String(item.eventId || item.id)}`] && <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(recordDetails[`activity:${String(item.eventId || item.id)}`], null, 2)}</pre>}
      </li>)}</ul>
      {historyHasMore && <button onClick={loadMoreHistory}>Load more activity</button>}
    </details>
  </section>;
};
