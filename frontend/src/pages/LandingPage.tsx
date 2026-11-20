import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex flex-col w-full">
      {/* HERO SECTION */}
      <section className="relative w-full overflow-hidden px-4 sm:px-8 py-12 sm:py-16">
        {/* Subtle Background Glows */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[720px] h-[480px] bg-secondary-container/40 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute top-1/3 -right-32 w-[380px] h-[380px] bg-tertiary-fixed/30 rounded-full blur-[100px] pointer-events-none -z-10" />

        <div className="max-w-[1440px] mx-auto flex flex-col items-center text-center">
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-container-lowest shadow-sm text-primary text-xs font-bold uppercase tracking-wider mb-6 border border-outline-variant/30">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>Next-Generation Autonomous Agronomy</span>
            <span className="text-outline-variant">•</span>
            <span className="text-on-surface-variant font-medium hidden sm:inline">
              Powered by Edge AI & Multispectral Satellite Vision
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-on-surface max-w-5xl tracking-tight leading-[1.15] mb-6">
            Autonomous Intelligence for{' '}
            <span className="text-primary underline decoration-secondary-container decoration-4 underline-offset-8">
              High-Yield
            </span>{' '}
            Commercial Agriculture
          </h1>

          {/* Subheadline */}
          <p className="text-base sm:text-lg text-on-surface-variant max-w-3xl mb-8 leading-relaxed">
            Unify real-time in-situ soil telemetry, satellite NDVI multispectral imaging, and AI-driven precision irrigation into a single predictive operating system. Eliminate crop loss and boost harvest output by up to 24%.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-10">
            <Link
              to={isAuthenticated ? '/dashboard' : '/register'}
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-sm transition-all shadow-md active:scale-95 group no-underline"
            >
              <span>{isAuthenticated ? 'Open AgroAI Workspace' : 'Get Started with AgroAI'}</span>
              <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </Link>
            <Link
              to="/explore"
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-surface-container-lowest hover:bg-surface-container-high text-on-surface font-bold text-sm shadow-sm transition-all border border-outline-variant/30 no-underline"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">travel_explore</span>
              <span>Explore Public Farms</span>
            </Link>
          </div>

          {/* Trust Metrics Pill Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl p-5 rounded-2xl bg-surface-container-lowest/90 backdrop-blur-md shadow-sm border border-outline-variant/30 mb-12">
            <div className="flex flex-col items-center">
              <span className="text-2xl sm:text-3xl font-extrabold text-primary">420k+</span>
              <span className="text-xs text-on-surface-variant font-medium">Hectares Monitored</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl sm:text-3xl font-extrabold text-primary">99.4%</span>
              <span className="text-xs text-on-surface-variant font-medium">Telemetry Reliability</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl sm:text-3xl font-extrabold text-primary">34%</span>
              <span className="text-xs text-on-surface-variant font-medium">Average Water Conserved</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl sm:text-3xl font-extrabold text-primary">Zero</span>
              <span className="text-xs text-on-surface-variant font-medium">Unmonitored Blindspots</span>
            </div>
          </div>

          {/* Live Terminal UI Mockup Container */}
          <div className="w-full max-w-6xl rounded-2xl bg-surface-container-lowest p-6 sm:p-8 shadow-xl border border-outline-variant/30 relative text-left">
            {/* Terminal Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-outline-variant/30">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-error/70" />
                  <span className="w-3 h-3 rounded-full bg-secondary-fixed-dim" />
                  <span className="w-3 h-3 rounded-full bg-primary-fixed" />
                </div>
                <span className="text-sm font-bold text-on-surface ml-1">
                  AgroAI Live Command Node #BD-DH-094
                </span>
                <span className="px-2 py-0.5 rounded-full bg-surface-container-low text-primary text-xs font-semibold uppercase">
                  Zone Alpha • Paddy & Vegetables
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-low text-primary text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                  Sentinel-2 Orbit Sync: Active
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-surface-container text-on-surface-variant text-xs font-semibold">
                  <span className="material-symbols-outlined text-[14px] text-primary">wifi_tethering</span>
                  LoRa Mesh 99.8%
                </span>
              </div>
            </div>

            {/* Terminal Body Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: NDVI Heatmap & Satellite Feed */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <div className="relative w-full h-80 rounded-xl overflow-hidden bg-surface-container-high shadow-inner">
                  <div className="w-full h-full bg-gradient-to-br from-emerald-900 via-emerald-800 to-green-950 p-6 flex flex-col justify-between text-white">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-1.5">
                        <span className="px-2.5 py-1 rounded bg-black/60 text-xs font-semibold backdrop-blur-md">
                          NDVI Index: 0.84 • Peak Photosynthetic Activity
                        </span>
                        <span className="px-2.5 py-1 rounded bg-black/60 text-xs font-semibold backdrop-blur-md">
                          GDD Accumulated: 1,480 Units
                        </span>
                      </div>
                      <span className="px-2.5 py-1 rounded bg-emerald-500/80 text-white text-xs font-bold uppercase">
                        Active Telemetry Link
                      </span>
                    </div>

                    <div className="bg-black/60 backdrop-blur-md p-4 rounded-xl border border-white/10 flex items-center justify-between">
                      <div>
                        <div className="text-xs text-emerald-300 font-bold uppercase tracking-wider">
                          Sub-Plot Anomaly Scanner
                        </div>
                        <div className="text-sm font-semibold">
                          Continuous Edge Diagnostic Feed Active
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-emerald-400 text-[28px]">
                        radar
                      </span>
                    </div>
                  </div>
                </div>

                {/* Telemetry Strip */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-surface-container-low flex flex-col">
                    <span className="text-[11px] text-on-surface-variant uppercase font-bold tracking-wider">
                      VPD Deficit
                    </span>
                    <span className="text-xl font-extrabold text-primary mt-0.5">1.24 kPa</span>
                    <span className="text-[11px] text-secondary font-medium">Optimal Transpiration</span>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-container-low flex flex-col">
                    <span className="text-[11px] text-on-surface-variant uppercase font-bold tracking-wider">
                      Canopy Temp
                    </span>
                    <span className="text-xl font-extrabold text-primary mt-0.5">23.8 °C</span>
                    <span className="text-[11px] text-primary font-medium">-1.4°C vs Ambient</span>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-container-low flex flex-col">
                    <span className="text-[11px] text-on-surface-variant uppercase font-bold tracking-wider">
                      Solar Flux
                    </span>
                    <span className="text-xl font-extrabold text-primary mt-0.5">810 W/m²</span>
                    <span className="text-[11px] text-secondary font-medium">Peak Solar Radiation</span>
                  </div>
                </div>
              </div>

              {/* Right: Strata Soil Telemetry & Valve Controls */}
              <div className="lg:col-span-5 flex flex-col justify-between gap-4">
                <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
                      3-Depth Capacitive Strata
                    </span>
                    <span className="text-xs font-bold text-primary">Probe Node #702</span>
                  </div>

                  {/* Strata 1 */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs text-on-surface-variant">
                      <span>Surface Strata (-10 cm)</span>
                      <span className="font-bold text-on-surface">32.4% Volumetric</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: '65%' }} />
                    </div>
                  </div>

                  {/* Strata 2 */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs text-on-surface-variant">
                      <span>Active Root Zone (-30 cm)</span>
                      <span className="font-bold text-on-surface">41.8% Volumetric</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
                      <div className="h-full bg-primary-container rounded-full" style={{ width: '82%' }} />
                    </div>
                  </div>

                  {/* Strata 3 */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs text-on-surface-variant">
                      <span>Deep Reservoir (-60 cm)</span>
                      <span className="font-bold text-on-surface">48.2% Volumetric</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
                      <div className="h-full bg-secondary rounded-full" style={{ width: '90%' }} />
                    </div>
                  </div>
                </div>

                {/* Autonomous Valve Status Card */}
                <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-primary text-[20px]">water_drop</span>
                      <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
                        Irrigation Decision Support
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[11px] font-bold">
                      Calculated
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    ET₀ dynamic calculation projected 4.2mm transpiration loss. Zone micro-valves planned according to soil moisture thresholds.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-on-surface-variant">Last update: Live sync active</span>
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center gap-1 text-xs text-primary font-bold hover:underline"
                  >
                    <span>View Workspace Telemetry</span>
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THREE CORE PILLARS SECTION */}
      <section className="w-full py-16 px-4 sm:px-8 bg-surface-container-low/40">
        <div className="max-w-[1440px] mx-auto flex flex-col gap-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="max-w-2xl">
              <span className="text-xs text-primary uppercase tracking-wider font-bold">
                Unmatched Agronomic Rigor
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-on-surface tracking-tight mt-1">
                Engineered from In-Situ Strata to Cloud Management
              </h2>
            </div>
            <p className="text-sm text-on-surface-variant max-w-md leading-relaxed">
              Modern commercial farms require robust end-to-end tooling. AgroAI connects subterranean soil telemetry to crop monitoring and structured farmer operations.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pillar 1 */}
            <div className="flex flex-col rounded-2xl bg-surface-container-lowest p-6 shadow-sm border border-outline-variant/30 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center text-primary mb-4">
                <span className="material-symbols-outlined text-[28px]">biotech</span>
              </div>
              <span className="text-xs text-tertiary uppercase tracking-wider font-bold">Pillar 01</span>
              <h3 className="text-lg font-bold text-on-surface mt-1 mb-2">
                Crop Health & Image Upload
              </h3>
              <p className="text-sm text-on-surface-variant mb-6 leading-relaxed flex-1">
                Field imagery ingestion pipeline supporting high-resolution image uploads, automated OpenCV preprocessing, and decoupled analysis job lifecycle.
              </p>
              <div className="p-3 rounded-lg bg-surface-container-low text-xs text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
                <span>Asynchronous lifecycle: PENDING → COMPLETED/FAILED</span>
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="flex flex-col rounded-2xl bg-surface-container-lowest p-6 shadow-sm border border-outline-variant/30 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center text-primary mb-4">
                <span className="material-symbols-outlined text-[28px]">sensors</span>
              </div>
              <span className="text-xs text-tertiary uppercase tracking-wider font-bold">Pillar 02</span>
              <h3 className="text-lg font-bold text-on-surface mt-1 mb-2">
                In-Situ Soil Telemetry
              </h3>
              <p className="text-sm text-on-surface-variant mb-6 leading-relaxed flex-1">
                Real-time tracking of soil moisture, temperature, electrical conductivity, and ambient air factors with full telemetry range validation and historical charts.
              </p>
              <div className="p-3 rounded-lg bg-surface-container-low text-xs text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
                <span>Idempotent sensor ingestion with audit history</span>
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="flex flex-col rounded-2xl bg-surface-container-lowest p-6 shadow-sm border border-outline-variant/30 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center text-primary mb-4">
                <span className="material-symbols-outlined text-[28px]">diversity_3</span>
              </div>
              <span className="text-xs text-tertiary uppercase tracking-wider font-bold">Pillar 03</span>
              <h3 className="text-lg font-bold text-on-surface mt-1 mb-2">
                Labor & Assignment Operations
              </h3>
              <p className="text-sm text-on-surface-variant mb-6 leading-relaxed flex-1">
                Complete farmer marketplace, job vacancies, structured field assignments, manual BDT payment ledgers, and 24-hour window performance reviews.
              </p>
              <div className="p-3 rounded-lg bg-surface-container-low text-xs text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
                <span>Contextual Owner and Farmer role security</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PLATFORM CAPABILITIES */}
      <section className="w-full py-16 px-4 sm:px-8">
        <div className="max-w-[1440px] mx-auto flex flex-col gap-10">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs text-primary uppercase tracking-wider font-bold">
              Comprehensive Platform
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight mt-1 mb-3">
              Everything Needed for Modern Farm Operations
            </h2>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Designed for farm owners and agricultural workers to cooperate seamlessly on a single unified platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-surface-container-low text-primary flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[22px]">warehouse</span>
              </div>
              <h4 className="text-base font-bold text-on-surface mb-2">Multi-Farm Ownership</h4>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Manage multiple farms and subdivisions across districts with independent field boundaries and membership roles.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-surface-container-low text-primary flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[22px]">water_drop</span>
              </div>
              <h4 className="text-base font-bold text-on-surface mb-2">Explainable Irrigation</h4>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Generate sourced threshold comparison irrigation recommendations with clear decision explanations and water estimates.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-surface-container-low text-primary flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[22px]">payments</span>
              </div>
              <h4 className="text-base font-bold text-on-surface mb-2">Manual Payment Ledger</h4>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Transparent administrative records for farm and assignment compensation in Bangladeshi Taka (BDT) with reversal auditing.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-surface-container-low text-primary flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[22px]">star</span>
              </div>
              <h4 className="text-base font-bold text-on-surface mb-2">Farmer Performance Reviews</h4>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                1–5 star ratings and reviews for completed field assignments, respecting assignment tenure and the 24-hour edit window.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-surface-container-low text-primary flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[22px]">history</span>
              </div>
              <h4 className="text-base font-bold text-on-surface mb-2">Audit & Activity Log</h4>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Full chronological activity stream tracking telemetry ingestions, assignment transitions, and farm events.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-surface-container-low text-primary flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[22px]">shield</span>
              </div>
              <h4 className="text-base font-bold text-on-surface mb-2">Firebase Authentication</h4>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Enterprise security with dual-write profile reconciliation, token verification, and granular Firestore security rules.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
