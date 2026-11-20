import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { fieldService } from '../services/fieldService';
import { monitoringService, validateCropImageFile } from '../services/monitoringService';
import type { Field } from '../types/field';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';

export const UploadCropImagePage: React.FC = () => {
  const { activeFarm } = useFarm();
  const navigate = useNavigate();

  const [fields, setFields] = useState<Field[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeFarm) return;
    let mounted = true;
    async function loadFields() {
      setLoading(true);
      try {
        const resp = await fieldService.fetchFields(activeFarm!.farmId);
        if (mounted) {
          const list = resp.data || [];
          setFields(list);
          if (list.length > 0) setSelectedFieldId(list[0].fieldId);
        }
      } catch (err: unknown) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load fields');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadFields();
    return () => {
      mounted = false;
    };
  }, [activeFarm]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const validationErr = validateCropImageFile(file);
    if (validationErr) {
      setError(validationErr);
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFarm || !selectedFieldId || !selectedFile) return;

    setUploading(true);
    setError(null);
    try {
      const res = await monitoringService.uploadImage(activeFarm.farmId, selectedFieldId, selectedFile);
      const imgId = String(res.data?.id || res.data?.imageId || 'latest');
      navigate(`/dashboard/ai/processing/${encodeURIComponent(imgId)}?fieldId=${encodeURIComponent(selectedFieldId)}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload crop foliage image');
      setUploading(false);
    }
  };

  if (!activeFarm) {
    return (
      <EmptyState
        icon="warehouse"
        title="No Farm Selected"
        description="Select an active farm before uploading crop diagnostic imagery."
        actionText="My Farms"
        onAction={() => navigate('/dashboard/farms')}
      />
    );
  }

  if (loading) {
    return <LoadingSkeleton type="dashboard" />;
  }

  return (
    <div className="w-full max-w-[800px] mx-auto space-y-6">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard/ai"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to AI Studio</span>
        </Link>
        <span className="px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-bold uppercase tracking-wider">
          {activeFarm.name}
        </span>
      </div>

      {/* Main Upload Card */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-10 shadow-sm border border-outline-variant/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-0.5 rounded-full bg-surface-container-low text-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">add_a_photo</span>
            Foliage Ingestion
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
          Upload Crop Image for Disease Inference
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant mt-1 mb-8 leading-relaxed">
          Submit high-resolution leaf or canopy photographs to trigger multispectral edge convolutional neural inference.
        </p>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-error-container text-error text-xs font-medium border border-error/20 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleUpload} className="space-y-6">
          {/* Field Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface" htmlFor="crop-field">
              Target Field Zone *
            </label>
            {fields.length === 0 ? (
              <p className="text-xs text-on-surface-variant">No fields available.</p>
            ) : (
              <select
                id="crop-field"
                value={selectedFieldId}
                onChange={(e) => setSelectedFieldId(e.target.value)}
                className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner cursor-pointer"
              >
                {fields.map((f) => (
                  <option key={f.fieldId} value={f.fieldId}>
                    {f.name} — {f.cropType} ({f.areaHectares} ha)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Drag & Drop Upload Zone */}
          <div className="border-2 border-dashed border-outline-variant/60 hover:border-primary/50 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-surface-container-low/40">
            <input
              type="file"
              id="foliage-file"
              accept="image/png,image/jpeg"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="foliage-file" className="cursor-pointer space-y-3 block">
              {previewUrl ? (
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={previewUrl}
                    alt="Crop Preview"
                    className="max-h-48 rounded-xl object-contain shadow-md border border-outline-variant/30"
                  />
                  <span className="text-xs font-bold text-primary">Click to choose a different photo</span>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[32px]">add_photo_alternate</span>
                  </div>
                  <div>
                    <span className="text-sm font-bold text-on-surface block">
                      Drop leaf foliage photograph here, or browse
                    </span>
                    <span className="text-xs text-on-surface-variant mt-1 block">
                      PNG or JPEG format up to 8 MiB with matching extension.
                    </span>
                  </div>
                </>
              )}
            </label>
          </div>

          {/* Agronomic Observation Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface" htmlFor="crop-notes">
              Visual Symptoms & Observation Notes (Optional)
            </label>
            <textarea
              id="crop-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Chlorosis visible on lower canopy leaves, brown lesions on stem nodes..."
              className="w-full p-3 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/30">
            <Link
              to="/dashboard/ai"
              className="h-11 px-5 rounded-xl border border-outline-variant/40 hover:bg-surface-container-low text-on-surface font-semibold text-xs transition-colors flex items-center justify-center no-underline"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!selectedFile || uploading}
              className="h-11 px-6 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 active:scale-95"
            >
              {uploading ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
                  <span>Uploading Image...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">psychiatry</span>
                  <span>Upload & Run Pipeline</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
