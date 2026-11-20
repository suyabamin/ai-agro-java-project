import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import type { FarmVisibility } from '../types/farm';

export const RegisterFarmPage: React.FC = () => {
  const { createFarm } = useFarm();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [division, setDivision] = useState('Dhaka');
  const [district, setDistrict] = useState('');
  const [detailedAddress, setDetailedAddress] = useState('');
  const [totalAreaHectares, setTotalAreaHectares] = useState<number>(10.0);
  const [visibility, setVisibility] = useState<FarmVisibility>('PRIVATE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const BANGLADESH_DIVISIONS = [
    'Dhaka',
    'Chittagong',
    'Rajshahi',
    'Khulna',
    'Barisal',
    'Sylhet',
    'Rangpur',
    'Mymensingh',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Farm name is required.');
      return;
    }
    if (!district.trim()) {
      setError('District is required.');
      return;
    }
    if (totalAreaHectares <= 0) {
      setError('Total area must be greater than 0 hectares.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const newFarm = await createFarm({
        name: name.trim(),
        description: description.trim() || undefined,
        division: division.trim(),
        district: district.trim(),
        detailedAddress: detailedAddress.trim() || undefined,
        totalAreaHectares,
        visibility,
      });

      navigate(`/dashboard/farms/${newFarm.farmId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to register farm holding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[900px] mx-auto space-y-6">
      {/* Breadcrumb Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard/farms"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to My Farms</span>
        </Link>
        <span className="px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-bold uppercase tracking-wider">
          New Holding Onboarding
        </span>
      </div>

      {/* Main Registration Card */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-10 shadow-sm border border-outline-variant/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-0.5 rounded-full bg-surface-container-low text-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">warehouse</span>
            Holding Registration
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
          Register Agricultural Farm Holding
        </h1>
        <p className="text-sm text-on-surface-variant mt-1 mb-8 leading-relaxed">
          Define your farm boundaries, district governance, and initial acreage to enable IoT telemetry deployment and field partitioning.
        </p>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-error-container text-error text-xs font-medium border border-error/20 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Farm Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface" htmlFor="farm-name">
              Farm Holding Name *
            </label>
            <input
              id="farm-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. GreenValley High-Yield Agrotech"
              required
              className="w-full h-11 px-4 rounded-lg bg-surface-container-low text-on-surface placeholder:text-outline text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner"
            />
          </div>

          {/* Division & District */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface" htmlFor="farm-division">
                Division *
              </label>
              <select
                id="farm-division"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner cursor-pointer"
              >
                {BANGLADESH_DIVISIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface" htmlFor="farm-district">
                District / Upazila *
              </label>
              <input
                id="farm-district"
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="e.g. Gazipur / Sreepur"
                required
                className="w-full h-11 px-4 rounded-lg bg-surface-container-low text-on-surface placeholder:text-outline text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner"
              />
            </div>
          </div>

          {/* Detailed Address */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface" htmlFor="farm-address">
              Detailed Address / GPS Coordinates
            </label>
            <input
              id="farm-address"
              type="text"
              value={detailedAddress}
              onChange={(e) => setDetailedAddress(e.target.value)}
              placeholder="e.g. Plot 42, Mawna Road (24.1843° N, 90.4682° E)"
              className="w-full h-11 px-4 rounded-lg bg-surface-container-low text-on-surface placeholder:text-outline text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner"
            />
          </div>

          {/* Area & Visibility */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface" htmlFor="farm-area">
                Total Area (Hectares) *
              </label>
              <input
                id="farm-area"
                type="number"
                step="0.1"
                min="0.1"
                value={totalAreaHectares}
                onChange={(e) => setTotalAreaHectares(parseFloat(e.target.value) || 0)}
                required
                className="w-full h-11 px-4 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface" htmlFor="farm-visibility">
                Marketplace Visibility
              </label>
              <select
                id="farm-visibility"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as FarmVisibility)}
                className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner cursor-pointer"
              >
                <option value="PRIVATE">Private (Internal Operator Access Only)</option>
                <option value="PUBLIC">Public (Visible in Farmer Job Marketplace)</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface" htmlFor="farm-desc">
              Agronomic Description & Objectives
            </label>
            <textarea
              id="farm-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Primary crops (e.g. Aman Rice, Brinjal, Maize), soil characteristics, and irrigation infrastructure..."
              className="w-full p-3 rounded-lg bg-surface-container-low text-on-surface placeholder:text-outline text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner"
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/30">
            <Link
              to="/dashboard/farms"
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
                  <span>Registering Farm Holding...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>Complete Farm Registration</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
