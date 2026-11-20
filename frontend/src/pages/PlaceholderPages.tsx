import React from 'react';
import { Link } from 'react-router-dom';

export const AboutPage: React.FC = () => (
  <div className="w-full max-w-[1000px] mx-auto px-4 sm:px-8 py-12 space-y-8">
    <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-10 shadow-sm border border-outline-variant/30 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-low text-primary text-xs font-bold uppercase tracking-wider mb-4">
        <span className="material-symbols-outlined text-[16px]">info</span>
        <span>Platform Architecture</span>
      </div>

      <h1 className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight mb-4">
        About AgroAI Enterprise
      </h1>
      <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed mb-8">
        AgroAI is a distributed multi-farm precision agricultural platform designed to bridge autonomous soil telemetry, edge AI crop disease diagnostics, and a verified agronomic workforce marketplace.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-2">
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <span className="material-symbols-outlined text-[20px]">code</span>
            <span>Frontend Tier</span>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            React 19, TypeScript, Vite, and Tailwind CSS design tokens built according to Google Stitch UI specifications with real-time responsive layouts.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-2">
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <span className="material-symbols-outlined text-[20px]">dns</span>
            <span>Backend API Core</span>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Enterprise Java 21, Spring Boot 3.3.6, with 89 secure REST endpoints, optimistic version concurrency, and comprehensive auditability.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-2">
          <div className="flex items-center gap-2 text-secondary font-bold text-sm">
            <span className="material-symbols-outlined text-[20px]">lock</span>
            <span>Security & Storage</span>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Firebase Authentication JWT verification and Google Cloud Firestore document persistence with contextual role enforcement.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-2">
          <div className="flex items-center gap-2 text-secondary font-bold text-sm">
            <span className="material-symbols-outlined text-[20px]">psychiatry</span>
            <span>Edge Diagnostics</span>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Python 3.12 FastAPI microservice architecture with OpenCV multispectral image ingestion and graceful MODEL_UNAVAILABLE fallbacks.
          </p>
        </div>
      </div>
    </div>
  </div>
);

export const NotFoundPage: React.FC = () => (
  <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
    <div className="w-20 h-20 rounded-2xl bg-surface-container-high text-primary flex items-center justify-center font-extrabold text-3xl shadow-sm mb-6">
      <span className="material-symbols-outlined text-[40px]">wrong_location</span>
    </div>
    <h1 className="text-4xl sm:text-5xl font-black text-on-surface tracking-tight mb-2">
      404
    </h1>
    <h2 className="text-lg font-bold text-on-surface mb-2">
      Page Not Found
    </h2>
    <p className="text-sm text-on-surface-variant max-w-md mb-6 leading-relaxed">
      The requested route or agricultural resource could not be located on the AgroAI network.
    </p>
    <Link
      to="/"
      className="h-11 px-6 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs shadow-md transition-all flex items-center gap-2 no-underline active:scale-95"
    >
      <span className="material-symbols-outlined text-[18px]">home</span>
      <span>Return to Home</span>
    </Link>
  </div>
);
