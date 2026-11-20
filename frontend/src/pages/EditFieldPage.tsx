import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { fieldService } from '../services/fieldService';
import type { Field, FieldStatus, CropType, SoilType } from '../types/field';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

export const EditFieldPage: React.FC = () => {
  const { fieldId } = useParams<{ fieldId: string }>();
  const { activeFarm } = useFarm();
  const navigate = useNavigate();

  const [field, setField] = useState<Field | null>(null);
  const [name, setName] = useState('');
  const [cropType, setCropType] = useState<CropType>('RICE');
  const [soilType, setSoilType] = useState<SoilType | ''>('');
  const [areaHectares, setAreaHectares] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<FieldStatus>('ACTIVE');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeFarm || !fieldId) return;

    let mounted = true;
    async function loadField() {
      setLoading(true);
      setError(null);
      try {
        const resp = await fieldService.fetchFieldById(activeFarm!.farmId, fieldId!);
        if (mounted && resp.data) {
          const f = resp.data;
          setField(f);
          setName(f.name);
          setCropType(f.cropType);
          setSoilType(f.soilType ?? '');
          setAreaHectares(f.areaHectares);
          setNotes(f.notes || '');
          setStatus(f.status);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load field for editing');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadField();

    return () => {
      mounted = false;
    };
  }, [activeFarm, fieldId]);

  if (!activeFarm) {
    return (
      <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
        <h2 className="text-base font-bold text-on-surface">No Farm Selected</h2>
        <Link to="/dashboard/farms" className="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold">
          Go to My Farms
        </Link>
      </div>
    );
  }

  if (loading) {
    return <LoadingSkeleton type="dashboard" />;
  }

  if (error || !field) {
    return (
      <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
        <h2 className="text-base font-bold text-on-surface">Field Not Found</h2>
        <Link to="/dashboard/fields" className="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold">
          Back to Fields
        </Link>
      </div>
    );
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Field name is required.');
      return;
    }
    if (areaHectares <= 0) {
      setError('Field area must be greater than 0 hectares.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await fieldService.updateField(activeFarm.farmId, field.fieldId, {
        name: name.trim(),
        cropType: cropType as CropType,
        soilType: soilType ? (soilType as SoilType) : undefined,
        areaHectares,
        notes: notes.trim() || undefined,
        status,
        expectedVersion: field.version,
      });

      navigate(`/dashboard/fields/${field.fieldId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update field');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!window.confirm(`Are you sure you want to archive "${field.name}"?`)) return;
    try {
      await fieldService.archiveField(activeFarm.farmId, field.fieldId, field.version);
      navigate('/dashboard/fields');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to archive field');
    }
  };

  return (
    <div className="w-full max-w-[800px] mx-auto space-y-6">
      {/* Breadcrumb Header */}
      <div className="flex items-center justify-between">
        <Link
          to={`/dashboard/fields/${field.fieldId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to Field Console</span>
        </Link>
        <span className="text-xs text-on-surface-variant font-semibold">Version {field.version}</span>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-10 shadow-sm border border-outline-variant/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

        <h1 className="text-2xl font-extrabold text-on-surface tracking-tight mb-1">
          Edit Field Zone: {field.name}
        </h1>
        <p className="text-xs text-on-surface-variant mb-6">
          Update crop rotations, soil classifications, and operational status.
        </p>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-error-container text-error text-xs font-medium border border-error/20 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleUpdate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface" htmlFor="edit-name">
              Field Name *
            </label>
            <input
              id="edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full h-11 px-4 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none border border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface" htmlFor="edit-crop">
                Crop Variety *
              </label>
              <select
                id="edit-crop"
                value={cropType}
                onChange={(e) => setCropType(e.target.value as CropType)}
                className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none border border-transparent cursor-pointer"
              >
                <option value="RICE">Rice (BRRI Dhan)</option>
                <option value="WHEAT">Wheat (Sonalika)</option>
                <option value="MAIZE">Corn / Maize</option>
                <option value="JUTE">Jute</option>
                <option value="POTATO">Potato</option>
                <option value="TEA">Tea</option>
                <option value="VEGETABLES">Vegetables</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface" htmlFor="edit-soil">
                Soil Type *
              </label>
              <select
                id="edit-soil"
                value={soilType}
                onChange={(e) => setSoilType(e.target.value as SoilType)}
                className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none border border-transparent cursor-pointer"
              >
                <option value="">Select Soil Type</option>
                <option value="CLAY">Clay / Alluvial</option>
                <option value="SANDY">Sandy Loam</option>
                <option value="LOAMY">Loamy / Floodplain</option>
                <option value="SILTY">Silty Clay</option>
                <option value="PEATY">Peaty / Organic</option>
                <option value="CHALKY">Chalky</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface" htmlFor="edit-area">
                Area (Hectares) *
              </label>
              <input
                id="edit-area"
                type="number"
                step="0.1"
                min="0.1"
                value={areaHectares}
                onChange={(e) => setAreaHectares(parseFloat(e.target.value) || 0)}
                required
                className="w-full h-11 px-4 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none border border-transparent"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface" htmlFor="edit-status">
                Field Status
              </label>
              <select
                id="edit-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as FieldStatus)}
                className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none border border-transparent cursor-pointer"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="RESTING">RESTING</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface" htmlFor="edit-desc">
              Zone Boundaries & Description
            </label>
            <textarea
              id="edit-desc"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none border border-transparent"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-outline-variant/30">
            <button
              type="button"
              onClick={handleArchive}
              className="px-4 py-2 text-error hover:bg-error-container/40 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Archive Field
            </button>
            <div className="flex items-center gap-3">
              <Link
                to={`/dashboard/fields/${field.fieldId}`}
                className="px-4 py-2 text-xs font-semibold text-on-surface hover:underline"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="h-10 px-5 rounded-lg bg-primary hover:bg-secondary text-on-primary font-bold text-xs shadow-sm disabled:opacity-60 cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
