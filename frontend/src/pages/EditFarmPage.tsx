import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';

export const EditFarmPage: React.FC = () => {
  const { activeFarm, updateFarm } = useFarm();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [district, setDistrict] = useState('');
  const [division, setDivision] = useState('');
  const [detailedAddress, setDetailedAddress] = useState('');
  const [totalAreaHectares, setTotalAreaHectares] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeFarm) {
      setName(activeFarm.name || '');
      setDescription(activeFarm.description || '');
      setDistrict(activeFarm.district || '');
      setDivision(activeFarm.division || '');
      setDetailedAddress(activeFarm.detailedAddress || '');
      setTotalAreaHectares(activeFarm.totalAreaHectares !== undefined ? String(activeFarm.totalAreaHectares) : '');
    }
  }, [activeFarm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFarm) return;
    setSaving(true); setError(null);
    try {
      await updateFarm(activeFarm.farmId, {
        name: name.trim(),
        description: description.trim() || undefined,
        district: district.trim(),
        division: division.trim(),
        detailedAddress: detailedAddress.trim() || undefined,
        totalAreaHectares: parseFloat(totalAreaHectares) || 0,
        expectedVersion: activeFarm.version,
      });
      navigate('/dashboard/settings/farm');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update farm');
      setSaving(false);
    }
  };

  if (!activeFarm) {
    return (
      <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
        <h2 className="text-base font-bold text-on-surface">No Farm Selected</h2>
        <Link to="/dashboard/farms" className="mt-3 inline-block px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold">Go to My Farms</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[700px] mx-auto">
      <div className="flex items-center gap-2">
        <Link to="/dashboard/settings/farm" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Farm Settings
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-[22px]">edit</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-on-surface">Edit Farm</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">Update details for {activeFarm.name}.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6 space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-on-surface" htmlFor="farm-name">Farm Name <span className="text-error">*</span></label>
          <input
            id="farm-name"
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full h-10 px-3 rounded-lg bg-surface-container text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary border border-transparent"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-on-surface" htmlFor="farm-desc">Description</label>
          <textarea
            id="farm-desc"
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-surface-container text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary border border-transparent resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface" htmlFor="farm-division">Division <span className="text-error">*</span></label>
            <input
              id="farm-division"
              type="text"
              required
              value={division}
              onChange={e => setDivision(e.target.value)}
              placeholder="e.g. Dhaka"
              className="w-full h-10 px-3 rounded-lg bg-surface-container text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary border border-transparent"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface" htmlFor="farm-district">District <span className="text-error">*</span></label>
            <input
              id="farm-district"
              type="text"
              required
              value={district}
              onChange={e => setDistrict(e.target.value)}
              placeholder="e.g. Gazipur"
              className="w-full h-10 px-3 rounded-lg bg-surface-container text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary border border-transparent"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-on-surface" htmlFor="farm-addr">Detailed Address</label>
          <input
            id="farm-addr"
            type="text"
            value={detailedAddress}
            onChange={e => setDetailedAddress(e.target.value)}
            placeholder="Village, Upazila, Road…"
            className="w-full h-10 px-3 rounded-lg bg-surface-container text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary border border-transparent"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-on-surface" htmlFor="farm-area">Total Area (hectares) <span className="text-error">*</span></label>
          <input
            id="farm-area"
            type="number"
            min="0.1"
            step="0.01"
            required
            value={totalAreaHectares}
            onChange={e => setTotalAreaHectares(e.target.value)}
            className="w-full h-10 px-3 rounded-lg bg-surface-container text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary border border-transparent"
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-error/10 border border-error/30">
            <p className="text-xs text-error">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Link to="/dashboard/settings/farm" className="h-10 px-5 inline-flex items-center rounded-xl border border-outline-variant/40 hover:bg-surface-container text-on-surface text-sm font-semibold">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving || !name.trim() || !district.trim() || !division.trim() || !totalAreaHectares}
            className="h-10 px-6 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-bold text-sm shadow-sm cursor-pointer disabled:opacity-60 flex items-center gap-2"
          >
            {saving ? (
              <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Saving…</>
            ) : (
              <><span className="material-symbols-outlined text-[16px]">save</span> Save Changes</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
