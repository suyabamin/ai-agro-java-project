import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import diseaseLeafImg from '../../assets/landing/disease-leaf-scan.jpg';

type ShowcaseTab = 'disease' | 'research' | 'advisory';

export const AiIntelligenceShowcase: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { ref, visible } = useScrollReveal();
  const [activeTab, setActiveTab] = useState<ShowcaseTab>('disease');

  return (
    <section
      id="ai-intelligence"
      className="w-full py-14 sm:py-20 px-4 sm:px-6 lg:px-8 bg-surface"
    >
      <div
        ref={ref}
        className={`max-w-[1360px] mx-auto rounded-3xl bg-gradient-to-br from-surface-container-lowest via-surface-container-lowest to-[#eef6f0] dark:to-[#18261d] border border-outline-variant/35 shadow-xl p-6 sm:p-10 lg:p-12 agro-reveal ${
          visible ? 'agro-reveal-visible' : ''
        }`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left Explanation Column */}
          <div className="lg:col-span-5 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
              <span className="material-symbols-outlined text-[16px]">psychology</span>
              <span>AI Intelligence Pipeline</span>
            </div>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-on-surface tracking-tight leading-tight">
              From Crop Image to Evidence-Based Advisory
            </h2>

            <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed">
              Upload a crop leaf image to run TensorFlow Lite disease classification, retrieve
              supporting agricultural research, combine field telemetry context, and generate
              bilingual Bengali &amp; English guidance.
            </p>

            <ul className="space-y-2.5 text-sm text-on-surface">
              {[
                'Multi-Source Research (OpenAlex, Crossref, Semantic Scholar & BD portals)',
                'Model prediction confidence kept distinct from research evidence quality',
                'Field soil telemetry integrated as environmental advisory context',
                'Bilingual Bengali & English presentation with expandable original evidence',
              ].map((point) => (
                <li key={point} className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5">
                    check_circle
                  </span>
                  <span className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                    {point}
                  </span>
                </li>
              ))}
            </ul>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-900 dark:text-amber-200 leading-relaxed flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">info</span>
              <span>
                AI predictions support initial screening only and never replace qualified
                agricultural extension officers or laboratory confirmation.
              </span>
            </div>

            <div className="pt-1">
              <Link
                to={isAuthenticated ? '/dashboard' : '/register'}
                className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full bg-primary hover:bg-secondary text-on-primary font-bold text-sm shadow-sm hover:shadow-md active:scale-95 transition-all no-underline group"
              >
                <span>{isAuthenticated ? 'Open Disease Intelligence' : 'Start with AgroAI'}</span>
                <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </Link>
            </div>
          </div>

          {/* Right Interactive Preview Card */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-lg p-4 sm:p-5 space-y-4">
              {/* Top Tabs + Sample Label */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-outline-variant/30">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant">
                  Sample Intelligence Preview
                </span>

                <div
                  role="tablist"
                  aria-label="AI intelligence preview tabs"
                  className="inline-flex rounded-xl bg-surface-container p-1 gap-1"
                >
                  {(
                    [
                      { id: 'disease', label: 'Disease Info' },
                      { id: 'research', label: 'Research' },
                      { id: 'advisory', label: 'Advisory' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === tab.id
                          ? 'bg-primary text-on-primary shadow-sm'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview Body */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-stretch">
                {/* Leaf Image with Animated Scan Reticle */}
                <div className="sm:col-span-5 relative rounded-xl overflow-hidden bg-surface-container-high min-h-[210px]">
                  <img
                    src={diseaseLeafImg}
                    alt="Sample crop leaf image used for disease screening preview"
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                  {/* Scanning Line */}
                  <div
                    aria-hidden="true"
                    className="agro-scan-sweep absolute left-2 right-2 top-3 h-0.5 bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)] rounded-full pointer-events-none"
                  />
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 px-2.5 py-1.5 rounded-lg bg-black/65 backdrop-blur-sm text-white text-[11px] font-semibold flex items-center justify-between">
                    <span>Leaf Screening</span>
                    <span className="text-emerald-300 font-mono">TFLite</span>
                  </div>
                </div>

                {/* Tab Content */}
                <div className="sm:col-span-7 flex flex-col justify-between gap-3">
                  {activeTab === 'disease' && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/25 space-y-1.5">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 text-[10px] font-bold uppercase">
                          Illustrative Disease Detection
                        </span>
                        <h3 className="text-base font-extrabold text-on-surface">
                          Potato / Tomato Late Blight
                        </h3>
                        <p className="text-xs text-on-surface-variant">
                          Pathogen: <em className="font-semibold">Phytophthora infestans</em>{' '}
                          (Oomycete)
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/25">
                          <span className="text-[10px] font-bold uppercase text-on-surface-variant block">
                            Model Confidence
                          </span>
                          <span className="text-sm font-extrabold text-primary">
                            Sample Score
                          </span>
                          <span className="block text-[10px] text-on-surface-variant">
                            Image classifier output
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                          <span className="text-[10px] font-bold uppercase text-on-surface-variant block">
                            Evidence Quality
                          </span>
                          <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                            HIGH (Separate)
                          </span>
                          <span className="block text-[10px] text-on-surface-variant">
                            Peer-reviewed match
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'research' && (
                    <div className="space-y-2.5">
                      <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/25 space-y-1">
                        <span className="text-[10px] font-bold uppercase text-primary block">
                          Multi-Source Academic &amp; Extension Retrieval
                        </span>
                        <p className="text-xs text-on-surface leading-relaxed">
                          Retrieves verified papers with DOI checks alongside Bangladesh
                          agricultural portal references.
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/25 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-on-surface">OpenAlex &amp; Crossref</span>
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary">
                            DOI Verified
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-on-surface">Semantic Scholar</span>
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
                            Abstract &amp; Citations
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'advisory' && (
                    <div className="space-y-2.5">
                      <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/25 space-y-1">
                        <span className="text-[10px] font-bold uppercase text-primary block">
                          Structured Bilingual Guidance (বাংলা / EN)
                        </span>
                        <p className="text-xs text-on-surface leading-relaxed">
                          Actions are grouped into Immediate, Short-Term, and Preventive steps with
                          citations and agronomist escalation alerts.
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/25 space-y-1 text-xs">
                        <span className="font-bold text-on-surface block">
                          Telemetry Context Included
                        </span>
                        <span className="text-[11px] text-on-surface-variant">
                          Combines field soil moisture, humidity, and temperature readings when
                          available.
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="p-2.5 rounded-xl bg-surface-container text-[11px] text-on-surface-variant flex items-center justify-between gap-2">
                    <span>Click tabs above to inspect each pipeline stage</span>
                    <span className="font-mono text-[10px] text-primary font-bold">A → I</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
