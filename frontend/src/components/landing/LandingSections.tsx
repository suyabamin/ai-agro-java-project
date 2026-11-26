import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import paddyHarvestImg from '../../assets/landing/paddy-harvest.jpg';

const PLATFORM_FEATURES = [
  {
    icon: 'warehouse',
    title: 'Farm & Field Management',
    description:
      'Organize multiple farms and individual crop fields with crop type, soil profile, irrigation method, and area records.',
    to: '/dashboard',
    linkLabel: 'Manage Farms',
  },
  {
    icon: 'biotech',
    title: 'AI Crop Disease Detection',
    description:
      'Upload crop leaf images for asynchronous TensorFlow Lite screening with top predictions and transparent status states.',
    to: '/register',
    linkLabel: 'Start Screening',
  },
  {
    icon: 'travel_explore',
    title: 'Agricultural Research Intelligence',
    description:
      'Retrieve supporting literature from OpenAlex, Crossref, Semantic Scholar, and agricultural portals with DOI checks.',
    to: '/register',
    linkLabel: 'Explore Research',
  },
  {
    icon: 'translate',
    title: 'Evidence-Based Advisory',
    description:
      'Structured Bengali and English guidance grouped by urgency with source citations and agronomist escalation notices.',
    to: '/register',
    linkLabel: 'View Workflow',
  },
  {
    icon: 'sensors',
    title: 'Soil Telemetry & Monitoring',
    description:
      'Record and inspect soil moisture, temperature, and field condition readings with historical tracking.',
    to: '/dashboard',
    linkLabel: 'Open Telemetry',
  },
  {
    icon: 'water_drop',
    title: 'Irrigation Planning',
    description:
      'Generate and review field irrigation plans grounded in crop profile, soil type, and latest moisture readings.',
    to: '/dashboard',
    linkLabel: 'Plan Irrigation',
  },
  {
    icon: 'groups',
    title: 'Farmer Management',
    description:
      'Discover public farms and agricultural job listings, review applications, and assign farmers to specific fields.',
    to: '/jobs',
    linkLabel: 'Browse Jobs',
  },
  {
    icon: 'history',
    title: 'Historical Records & Analytics',
    description:
      'Audit persisted disease scans, research attempts, telemetry logs, and field activity history in one unified view.',
    to: '/explore',
    linkLabel: 'Explore Farms',
  },
];

const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    icon: 'person_add',
    title: 'Create an account',
    description: 'Sign up securely with Firebase Authentication as a Farm Owner or Farmer.',
  },
  {
    step: '02',
    icon: 'add_home_work',
    title: 'Register your farm',
    description: 'Set up one or more farms with location, visibility, and ownership details.',
  },
  {
    step: '03',
    icon: 'grid_on',
    title: 'Add your fields',
    description: 'Define field plots with crop type, soil characteristics, and irrigation setup.',
  },
  {
    step: '04',
    icon: 'monitoring',
    title: 'Monitor agricultural conditions',
    description: 'Log soil telemetry, upload crop leaf photos, and coordinate assigned farmers.',
  },
  {
    step: '05',
    icon: 'psychology',
    title: 'Use AI intelligence & advisory',
    description: 'Run disease screening, fetch multi-source research, and review bilingual guidance.',
  },
  {
    step: '06',
    icon: 'verified',
    title: 'Make informed farm decisions',
    description: 'Act on irrigation plans, field history, and expert consultation guidance.',
  },
];

export const HowItWorksSection: React.FC = () => {
  const { ref, visible } = useScrollReveal();

  return (
    <section
      id="how-it-works"
      className="w-full py-14 sm:py-20 px-4 sm:px-6 lg:px-8 bg-surface-container-low/60"
    >
      <div
        ref={ref}
        className={`max-w-[1360px] mx-auto space-y-10 agro-reveal ${
          visible ? 'agro-reveal-visible' : ''
        }`}
      >
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="inline-block px-3.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
            How It Works
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
            From Farm Setup to Informed Decisions
          </h2>
          <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed">
            Six clear steps connect your physical fields with AI diagnostics, research evidence,
            and structured farm operations.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {HOW_IT_WORKS_STEPS.map((item, idx) => (
            <div
              key={item.step}
              style={{ transitionDelay: `${idx * 60}ms` }}
              className="group relative p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                </div>
                <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-full bg-surface-container text-primary">
                  Step {item.step}
                </span>
              </div>
              <h3 className="text-base font-bold text-on-surface">{item.title}</h3>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export const FeaturesSection: React.FC = () => {
  const { ref, visible } = useScrollReveal();

  return (
    <section id="features" className="w-full py-14 sm:py-20 px-4 sm:px-6 lg:px-8 bg-surface">
      <div
        ref={ref}
        className={`max-w-[1360px] mx-auto space-y-10 agro-reveal ${
          visible ? 'agro-reveal-visible' : ''
        }`}
      >
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="inline-block px-3.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
            Platform Features
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
            Everything You Need for Modern Farming
          </h2>
          <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed">
            Built for farm owners and field farmers to monitor crops, verify evidence, and manage
            daily operations together.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PLATFORM_FEATURES.map((feat, idx) => (
            <div
              key={feat.title}
              style={{ transitionDelay: `${idx * 45}ms` }}
              className="group p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 group-hover:bg-primary group-hover:text-on-primary transition-all duration-300">
                  <span className="material-symbols-outlined text-[22px]">{feat.icon}</span>
                </div>
                <h3 className="text-base font-bold text-on-surface">{feat.title}</h3>
                <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                  {feat.description}
                </p>
              </div>
              <Link
                to={feat.to}
                className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline no-underline pt-1"
              >
                <span>{feat.linkLabel}</span>
                <span className="material-symbols-outlined text-[15px] group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export const RoleExperienceSection: React.FC = () => {
  const { ref, visible } = useScrollReveal();

  return (
    <section
      id="about"
      className="w-full py-14 sm:py-20 px-4 sm:px-6 lg:px-8 bg-surface-container-low/60"
    >
      <div
        ref={ref}
        className={`max-w-[1360px] mx-auto space-y-10 agro-reveal ${
          visible ? 'agro-reveal-visible' : ''
        }`}
      >
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="inline-block px-3.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
            Role-Aware Experience
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
            Designed for Both Farm Owners &amp; Farmers
          </h2>
          <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed">
            Clear, permission-scoped workspaces keep farm management structured and field execution
            simple.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Farm Owners */}
          <div className="p-7 rounded-3xl bg-surface-container-lowest border border-outline-variant/35 shadow-sm hover:shadow-md transition-shadow space-y-5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-[24px]">domain</span>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  Owner Workspace
                </span>
                <h3 className="text-xl font-extrabold text-on-surface">For Farm Owners</h3>
              </div>
            </div>
            <ul className="space-y-3 text-sm text-on-surface-variant">
              {[
                'Manage multiple farms and individual field plots',
                'Assign farmers to fields and track work & payments',
                'Monitor soil telemetry and irrigation plans',
                'Review AI disease insights and full research history',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5">
                    check_circle
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline no-underline"
            >
              <span>Create an Owner Account</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>

          {/* Farmers */}
          <div className="p-7 rounded-3xl bg-surface-container-lowest border border-outline-variant/35 shadow-sm hover:shadow-md transition-shadow space-y-5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-secondary text-on-secondary flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-[24px]">agriculture</span>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                  Farmer Workspace
                </span>
                <h3 className="text-xl font-extrabold text-on-surface">For Farmers</h3>
              </div>
            </div>
            <ul className="space-y-3 text-sm text-on-surface-variant">
              {[
                'Access assigned fields in a focused workspace',
                'View relevant field telemetry and irrigation guidance',
                'Upload crop leaf images for AI disease screening',
                'Read persisted Bengali & English advisory and history',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-secondary shrink-0 mt-0.5">
                    check_circle
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/jobs"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-secondary hover:underline no-underline"
            >
              <span>Explore Open Farm Jobs</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export const FinalCtaSection: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { ref, visible } = useScrollReveal();

  return (
    <section className="w-full py-14 sm:py-20 px-4 sm:px-6 lg:px-8 bg-surface">
      <div
        ref={ref}
        className={`max-w-[1360px] mx-auto rounded-3xl overflow-hidden bg-gradient-to-br from-[#1b4d32] via-[#17422a] to-[#0d3520] text-white shadow-xl agro-reveal ${
          visible ? 'agro-reveal-visible' : ''
        }`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
          <div className="lg:col-span-7 p-8 sm:p-12 space-y-5">
            <span className="inline-block px-3 py-1 rounded-full bg-white/15 text-emerald-100 text-xs font-bold uppercase tracking-wider">
              Get Started Today
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight text-white">
              Build a Smarter Future for Your Farm.
            </h2>
            <p className="text-sm sm:text-base text-emerald-100/90 max-w-xl leading-relaxed">
              Start managing your agricultural operations with intelligent tools and evidence-based
              insights.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <Link
                to={isAuthenticated ? '/dashboard' : '/register'}
                className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-white text-[#1b4d32] hover:bg-emerald-50 font-extrabold text-sm shadow-md active:scale-95 transition-all no-underline"
              >
                <span>{isAuthenticated ? 'Go to Dashboard' : 'Create Your Account'}</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
              <Link
                to="/dashboard/farms/new"
                className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/30 font-bold text-sm transition-all no-underline"
              >
                <span>Register Your Farm</span>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 h-56 sm:h-72 lg:h-full min-h-[240px] relative">
            <img
              src={paddyHarvestImg}
              alt="Golden-green paddy rice panicles in sunlight"
              loading="lazy"
              className="w-full h-full object-cover"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-[#123c25]/70 via-transparent to-transparent lg:block hidden pointer-events-none"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export const LandingFooter: React.FC = () => {
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <footer className="w-full bg-[#0d3520] text-emerald-50 border-t border-white/10">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-8 border-b border-white/15">
          {/* Brand */}
          <div className="space-y-3 lg:col-span-2">
            <Link to="/" className="inline-flex items-center gap-2.5 no-underline text-white">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">eco</span>
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-lg leading-none">AgroAI</span>
                <span className="text-[11px] text-emerald-200/80">
                  Smart Farming • Better Tomorrow
                </span>
              </div>
            </Link>
            <p className="text-xs sm:text-sm text-emerald-100/80 max-w-md leading-relaxed">
              Multi-farm agricultural intelligence unifying crop disease screening, multi-source
              research retrieval, soil telemetry, irrigation planning, and farmer operations.
            </p>
          </div>

          {/* Navigation */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-200">
              Navigation
            </h3>
            <ul className="space-y-2 text-xs text-emerald-100/85">
              <li>
                <a
                  href="#hero"
                  onClick={(e) => scrollToSection(e, 'hero')}
                  className="hover:text-white no-underline transition-colors"
                >
                  Home
                </a>
              </li>
              <li>
                <a
                  href="#features"
                  onClick={(e) => scrollToSection(e, 'features')}
                  className="hover:text-white no-underline transition-colors"
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  href="#how-it-works"
                  onClick={(e) => scrollToSection(e, 'how-it-works')}
                  className="hover:text-white no-underline transition-colors"
                >
                  How It Works
                </a>
              </li>
              <li>
                <a
                  href="#ai-intelligence"
                  onClick={(e) => scrollToSection(e, 'ai-intelligence')}
                  className="hover:text-white no-underline transition-colors"
                >
                  AI Intelligence
                </a>
              </li>
              <li>
                <Link to="/about" className="hover:text-white no-underline transition-colors">
                  Platform Architecture
                </Link>
              </li>
            </ul>
          </div>

          {/* Platform Routes */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-200">
              Platform Access
            </h3>
            <ul className="space-y-2 text-xs text-emerald-100/85">
              <li>
                <Link to="/login" className="hover:text-white no-underline transition-colors">
                  Login
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-white no-underline transition-colors">
                  Create Account
                </Link>
              </li>
              <li>
                <Link
                  to="/dashboard/farms/new"
                  className="hover:text-white no-underline transition-colors"
                >
                  Register Your Farm
                </Link>
              </li>
              <li>
                <Link to="/explore" className="hover:text-white no-underline transition-colors">
                  Explore Public Farms
                </Link>
              </li>
              <li>
                <Link to="/jobs" className="hover:text-white no-underline transition-colors">
                  Agricultural Jobs
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-emerald-200/80">
          <span>© 2026 AgroAI. All rights reserved.</span>
          <span>Built with React, Spring Boot, Firebase &amp; FastAPI</span>
        </div>
      </div>
    </footer>
  );
};
