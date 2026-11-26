import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import heroAgricultureImg from '../../assets/landing/hero-agriculture.jpg';

const TRUST_PILLARS = [
  {
    icon: 'agriculture',
    title: 'Smarter Farm Management',
    subtitle: 'Multi-farm & field operations',
  },
  {
    icon: 'biotech',
    title: 'AI Disease Intelligence',
    subtitle: 'Crop leaf image diagnostics',
  },
  {
    icon: 'menu_book',
    title: 'Evidence-Based Advisory',
    subtitle: 'Research-backed guidance',
  },
  {
    icon: 'water_drop',
    title: 'Intelligent Irrigation',
    subtitle: 'Field moisture planning',
  },
  {
    icon: 'monitoring',
    title: 'Agricultural Monitoring',
    subtitle: 'Telemetry & audit history',
  },
];

export const LandingHero: React.FC = () => {
  const { isAuthenticated } = useAuth();

  const handleExploreClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section
      id="hero"
      className="relative w-full overflow-hidden bg-gradient-to-b from-[#f3f8f4] via-[#f7f6f2] to-surface dark:from-[#121c16] dark:via-surface dark:to-surface pb-12 sm:pb-16"
    >
      {/* Subtle Ambient Background Gradient */}
      <div
        aria-hidden="true"
        className="absolute -top-28 -left-28 w-[440px] h-[440px] rounded-full bg-emerald-200/35 dark:bg-emerald-900/20 blur-3xl pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="absolute top-12 right-0 w-[520px] h-[520px] rounded-full bg-green-100/50 dark:bg-emerald-950/30 blur-3xl pointer-events-none"
      />

      <div className="relative max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 lg:pt-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left Copy Column */}
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
            <div className="agro-hero-enter inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-container-lowest/95 border border-primary/20 shadow-sm text-primary text-xs font-bold tracking-wide">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Multi-Farm Agricultural Intelligence Platform</span>
            </div>

            <h1 className="agro-hero-enter-delay-1 text-3xl sm:text-5xl lg:text-[54px] font-extrabold text-on-surface tracking-tight leading-[1.12]">
              Smart Agriculture.{' '}
              <span className="text-primary">Powered by Artificial Intelligence.</span>
            </h1>

            <p className="agro-hero-enter-delay-2 text-base sm:text-lg text-on-surface-variant max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              Empowering farmers with intelligent crop monitoring, AI-powered disease detection,
              evidence-based agricultural insights, and smarter farm management.
            </p>

            <div className="agro-hero-enter-delay-3 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-1">
              <Link
                to={isAuthenticated ? '/dashboard' : '/register'}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-primary hover:bg-secondary text-on-primary font-bold text-sm shadow-md hover:shadow-lg active:scale-95 transition-all no-underline group"
              >
                <span>{isAuthenticated ? 'Open Workspace' : 'Get Started'}</span>
                <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </Link>
              <a
                href="#features"
                onClick={handleExploreClick}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-surface-container-lowest hover:bg-surface-container text-on-surface font-bold text-sm border border-outline-variant/60 shadow-sm transition-all no-underline"
              >
                <span>Explore Features</span>
                <span className="material-symbols-outlined text-[18px] text-primary">
                  south_east
                </span>
              </a>
            </div>
          </div>

          {/* Right Hero Visual Column */}
          <div className="lg:col-span-6 relative agro-hero-enter-delay-2">
            <div className="relative rounded-3xl overflow-hidden shadow-xl border border-outline-variant/30 bg-surface-container-lowest">
              <img
                src={heroAgricultureImg}
                alt="Farmer inspecting green crops in a sunlit field with a digital tablet"
                className="w-full h-[260px] sm:h-[360px] lg:h-[420px] object-cover object-center"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent pointer-events-none"
              />

              {/* Floating Sample Workspace Preview Card */}
              <div className="agro-float-gentle hidden sm:block absolute bottom-4 left-4 right-4 sm:right-auto sm:w-[320px] p-4 rounded-2xl bg-surface-container-lowest/95 backdrop-blur-md border border-outline-variant/40 shadow-lg">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    Sample Preview
                  </span>
                  <span className="text-[10px] font-semibold text-on-surface-variant">
                    Field Intelligence
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[22px]">biotech</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-on-surface truncate">
                      Crop Health &amp; Research Flow
                    </p>
                    <p className="text-[11px] text-on-surface-variant">
                      Leaf Scan • Evidence Retrieval • Advisory
                    </p>
                  </div>
                </div>
              </div>

              {/* Subtle Top-Right Floating Chip */}
              <div className="hidden md:flex items-center gap-2 absolute top-4 right-4 px-3.5 py-2 rounded-full bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant/30 shadow-md text-xs font-bold text-on-surface">
                <span className="material-symbols-outlined text-[16px] text-primary">
                  translate
                </span>
                <span>English &amp; বাংলা Advisory</span>
              </div>
            </div>
          </div>
        </div>

        {/* C. Trust / Value Proposition Strip */}
        <div className="mt-10 sm:mt-12 rounded-2xl bg-surface-container-lowest/95 backdrop-blur-md border border-outline-variant/35 shadow-md p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5">
            {TRUST_PILLARS.map((pillar) => (
              <div
                key={pillar.title}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-container-low transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">{pillar.icon}</span>
                </div>
                <div className="min-w-0">
                  <h2 className="text-xs font-extrabold text-on-surface leading-snug">
                    {pillar.title}
                  </h2>
                  <p className="text-[11px] text-on-surface-variant leading-snug">
                    {pillar.subtitle}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
