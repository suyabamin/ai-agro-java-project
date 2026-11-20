import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';

export const FarmerProfilePage: React.FC = () => {
  const { farmerId } = useParams<{ farmerId: string }>();
  const { activeFarm } = useFarm();

  return (
    <div className="w-full max-w-[1000px] mx-auto space-y-6">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard/farmers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to Farmer Directory</span>
        </Link>
        <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold uppercase tracking-wider">
          Verified Field Agronomist
        </span>
      </div>

      {/* Main Profile Card */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-10 shadow-sm border border-outline-variant/30 relative overflow-hidden flex flex-col md:flex-row items-start justify-between gap-6">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-2xl bg-primary-container text-on-primary flex items-center justify-center font-bold text-2xl shadow-md shrink-0">
            RU
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-extrabold text-on-surface tracking-tight">
                Rahim Uddin
              </h1>
              <span className="material-symbols-outlined text-[20px] text-primary" title="Identity Verified">
                verified
              </span>
            </div>
            <p className="text-xs text-on-surface-variant flex items-center gap-1 mb-2">
              <span className="material-symbols-outlined text-[15px] text-primary">location_on</span>
              <span>Gazipur, Dhaka Division • Available for Assignment</span>
            </p>
            <p className="text-xs text-on-surface-variant max-w-xl leading-relaxed">
              Specialized in high-yield Aman and Boro rice cultivation, integrated pest management (IPM), and multi-depth capacitive soil sensor calibration with 12+ years of field experience across floodplain basins.
            </p>
          </div>
        </div>

        {activeFarm && (
          <Link
            to={`/dashboard/assignments/new${farmerId ? `?farmerUid=${farmerId}` : ''}`}
            className="h-11 px-5 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs shadow-md transition-all flex items-center gap-2 shrink-0 no-underline active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
            <span>Assign to Field</span>
          </Link>
        )}
      </div>

      {/* Metric Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-center">
          <div className="text-2xl font-extrabold text-primary">4.9 / 5.0</div>
          <span className="text-[11px] text-on-surface-variant font-semibold">Owner Rating</span>
        </div>
        <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-center">
          <div className="text-2xl font-extrabold text-on-surface">38</div>
          <span className="text-[11px] text-on-surface-variant font-semibold">Completed Tenures</span>
        </div>
        <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-center">
          <div className="text-2xl font-extrabold text-secondary">99.2%</div>
          <span className="text-[11px] text-on-surface-variant font-semibold">Sensor Ingestion Rate</span>
        </div>
        <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-center">
          <div className="text-2xl font-extrabold text-on-surface">12 Years</div>
          <span className="text-[11px] text-on-surface-variant font-semibold">Agronomic Experience</span>
        </div>
      </div>

      {/* Verified Skills & Certifications */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30 space-y-3">
        <h2 className="text-base font-bold text-on-surface">Verified Agronomic Competencies</h2>
        <div className="flex flex-wrap gap-2">
          {[
            'Boro & Aman Rice Phenology',
            'Dielectric Moisture Sensor Placement',
            'LoRaWAN Gateway Antenna Maintenance',
            'Integrated Pest Scouting (IPM)',
            'Penman-Monteith Irrigation Scheduling',
            'Variable-Rate Fertilizer Application',
          ].map((skill) => (
            <span
              key={skill}
              className="px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface text-xs font-semibold border border-outline-variant/30"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Recent Reviews */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30 space-y-4">
        <h2 className="text-base font-bold text-on-surface">Recent Field Reviews</h2>
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-surface-container-low text-xs leading-relaxed">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-on-surface">GreenValley High-Yield Zone Alpha</span>
              <span className="text-amber-500 font-bold">★★★★★ (5.0)</span>
            </div>
            <p className="text-on-surface-variant">
              "Exceptional care taken during soil sensor deployment and seedling transplanting. Detected root fungal vulnerability early."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
