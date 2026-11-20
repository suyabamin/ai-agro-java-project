import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { farmService } from '../services/farmService';
import type { PublicFarm } from '../types/farm';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

export const ExploreFarmsPage: React.FC = () => {
  const [farms, setFarms] = useState<PublicFarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [division, setDivision] = useState<string>('');
  const [district, setDistrict] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const loadPublicFarms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await farmService.fetchPublicFarms({
        division: division.trim() || undefined,
        district: district.trim() || undefined,
      });
      setFarms(resp.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load public directory';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [division, district]);

  useEffect(() => {
    loadPublicFarms();
  }, [loadPublicFarms]);

  const filteredFarms = farms.filter((f) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      f.name.toLowerCase().includes(term) ||
      f.division.toLowerCase().includes(term) ||
      f.district.toLowerCase().includes(term)
    );
  });

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-8 py-8 space-y-8">
      {/* Hero Header */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-10 shadow-sm border border-outline-variant/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-low text-primary text-xs font-bold uppercase tracking-wider mb-3">
              <span className="material-symbols-outlined text-[16px]">travel_explore</span>
              <span>Open Agricultural Registry</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
              Explore Verified Farms
            </h1>
            <p className="text-sm sm:text-base text-on-surface-variant mt-2 leading-relaxed">
              Discover publicly registered precision agricultural holdings, soil telemetry zones, and cultivation hubs across Bangladesh.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/register"
              className="h-11 px-5 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs shadow-md transition-all flex items-center gap-2 no-underline active:scale-95 shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">add_business</span>
              <span>Register Your Farm</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/30 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80 flex items-center">
          <span className="absolute left-3 text-on-surface-variant pointer-events-none">
            <span className="material-symbols-outlined text-[18px]">search</span>
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search farm name, region..."
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface-container-low text-on-surface text-xs placeholder:text-outline outline-none focus:ring-2 focus:ring-primary border border-transparent shadow-inner"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs text-on-surface-variant font-semibold">Division:</span>
            <input
              type="text"
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              placeholder="e.g. Dhaka"
              className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-transparent shadow-inner w-32"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-on-surface-variant font-semibold">District:</span>
            <input
              type="text"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="e.g. Gazipur"
              className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-transparent shadow-inner w-32"
            />
          </div>

          {(division || district || searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setDivision('');
                setDistrict('');
                setSearchTerm('');
              }}
              className="h-10 px-3 rounded-lg border border-outline-variant/40 hover:bg-surface-container-low text-on-surface-variant text-xs font-semibold cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-error-container text-error text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Farms Grid */}
      {loading ? (
        <LoadingSkeleton count={6} />
      ) : filteredFarms.length === 0 ? (
        <EmptyState
          icon="travel_explore"
          title="No Public Farms Found"
          description="There are currently no public farms matching your selected region filters."
          actionText="Clear Filters"
          onAction={() => {
            setDivision('');
            setDistrict('');
            setSearchTerm('');
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFarms.map((farm) => (
            <div
              key={farm.farmId}
              className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30 hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
                      <span className="material-symbols-outlined text-[20px]">agriculture</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-on-surface tracking-tight group-hover:text-primary transition-colors">
                        {farm.name}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-on-surface-variant">
                        <span className="material-symbols-outlined text-[14px] text-primary">location_on</span>
                        <span>{farm.district}, {farm.division}</span>
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase tracking-wider">
                    Verified
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-surface-container-low text-xs mb-4">
                  <div>
                    <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Boundary Area</span>
                    <div className="font-bold text-on-surface text-sm">{farm.totalAreaHectares} ha</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Active Zones</span>
                    <div className="font-bold text-on-surface text-sm">{farm.activeFieldCount} Fields</div>
                  </div>
                </div>

                {farm.primaryCropTypes && farm.primaryCropTypes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {farm.primaryCropTypes.map((crop) => (
                      <span
                        key={crop}
                        className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant text-[11px] font-medium"
                      >
                        {crop}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-outline-variant/20 flex items-center justify-between text-xs">
                <span className="text-[11px] text-on-surface-variant">
                  Projection v{farm.projectionVersion}
                </span>
                <Link
                  to="/jobs"
                  className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
                >
                  <span>View Open Jobs</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
