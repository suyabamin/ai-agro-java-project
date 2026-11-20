import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { fieldService } from '../services/fieldService';
import type { CropType, SoilType } from '../types/field';

export const AddFieldPage: React.FC = () => {
  const { activeFarm } = useFarm();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [cropType, setCropType] = useState<CropType>('RICE');
  const [soilType, setSoilType] = useState<SoilType>('CLAY');
  const [areaHectares, setAreaHectares] = useState<number>(2.5);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const CROP_PRESETS: { value: CropType; label: string }[] = [
    { value: 'RICE', label: 'Rice (BRRI Dhan 28)' },
    { value: 'WHEAT', label: 'Wheat (Sonalika)' },
    { value: 'MAIZE', label: 'Corn / Maize (Zea Mays)' },
    { value: 'JUTE', label: 'Jute (Corchorus)' },
    { value: 'POTATO', label: 'Potato (Diamant)' },
    { value: 'TEA', label: 'Tea (Camellia Sinensis)' },
    { value: 'VEGETABLES', label: 'Vegetable Polyhouse' },
    { value: 'OTHER', label: 'Other / Mixed Crop' },
  ];

  const SOIL_PRESETS: { value: SoilType; label: string }[] = [
    { value: 'CLAY', label: 'Clay / Alluvial Clay Loam' },
    { value: 'SANDY', label: 'Sandy Loam' },
    { value: 'SILTY', label: 'Silty Clay' },
    { value: 'LOAMY', label: 'Loamy / Floodplain' },
    { value: 'PEATY', label: 'Peaty / Organic' },
    { value: 'CHALKY', label: 'Chalky / Acid Sulfate' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFarm) {
      setError('Please select an active farm first.');
      return;
    }
    if (!name.trim()) {
      setError('Field zone name is required.');
      return;
    }
    if (areaHectares <= 0) {
      setError('Field area must be greater than 0 hectares.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await fieldService.createField(activeFarm.farmId, {
        name: name.trim(),
        localFieldId: `F-${Date.now()}`,
        cropType,
        soilType,
        areaHectares,
        notes: notes.trim() || undefined,
      });

      navigate('/dashboard/fields');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create field zone');
    } finally {
      setLoading(false);
    }
  };

  if (!activeFarm) {
    return (
      <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
        <h2 className="text-base font-bold text-on-surface">No Farm Selected</h2>
        <p className="text-xs text-on-surface-variant mt-1 mb-4">Please select a farm before adding a field zone.</p>
        <Link to="/dashboard/farms" className="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold">
          Go to My Farms
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[800px] mx-auto space-y-6">
      {/* Breadcrumb Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard/fields"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to Fields</span>
        </Link>
        <span className="px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-bold uppercase tracking-wider">
          {activeFarm.name}
        </span>
      </div>

      {/* Main Form Card */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-10 shadow-sm border border-outline-variant/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-0.5 rounded-full bg-surface-container-low text-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">add_location_alt</span>
            Zone Partitioning
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
          Add Agricultural Field Zone
        </h1>
        <p className="text-sm text-on-surface-variant mt-1 mb-8 leading-relaxed">
          Configure a discrete field plot under <strong className="text-on-surface">{activeFarm.name}</strong> to allocate IoT soil probes, track crop phenology, and dispatch agronomists.
        </p>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-error-container text-error text-xs font-medium border border-error/20 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Field Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface" htmlFor="field-name">
              Field / Zone Identifier *
            </label>
            <input
              id="field-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Zone Alpha - North Ridge"
              required
              className="w-full h-11 px-4 rounded-lg bg-surface-container-low text-on-surface placeholder:text-outline text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner"
            />
          </div>

          {/* Crop Type & Soil Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface" htmlFor="crop-type">
                Crop Variety / Species *
              </label>
              <select
                id="crop-type"
                value={cropType}
                onChange={(e) => setCropType(e.target.value as CropType)}
                className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner cursor-pointer"
              >
                {CROP_PRESETS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface" htmlFor="soil-type">
                Soil Classification *
              </label>
              <select
                id="soil-type"
                value={soilType}
                onChange={(e) => setSoilType(e.target.value as SoilType)}
                className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner cursor-pointer"
              >
                {SOIL_PRESETS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Area in Hectares */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface" htmlFor="field-area">
              Zone Area (Hectares) *
            </label>
            <input
              id="field-area"
              type="number"
              step="0.1"
              min="0.1"
              value={areaHectares}
              onChange={(e) => setAreaHectares(parseFloat(e.target.value) || 0)}
              required
              className="w-full h-11 px-4 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner"
            />
          </div>

          {/* Boundaries & Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface" htmlFor="field-desc">
              Zone Boundaries & Agronomic Notes
            </label>
            <textarea
              id="field-desc"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Irrigation sector details, topography, center pivot coverage, or soil treatment history..."
              className="w-full p-3 rounded-lg bg-surface-container-low text-on-surface placeholder:text-outline text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/30">
            <Link
              to="/dashboard/fields"
              className="h-11 px-5 rounded-xl border border-outline-variant/40 hover:bg-surface-container-low text-on-surface font-semibold text-xs transition-colors flex items-center justify-center no-underline"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="h-11 px-6 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 active:scale-95"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
                  <span>Creating Field Zone...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>Create Field Zone</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
