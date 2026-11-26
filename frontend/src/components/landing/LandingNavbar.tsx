import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useScrolled } from '../../hooks/useScrollReveal';
import { LanguageToggle } from '../common/LanguageToggle';
import { ThemeToggle } from '../common/ThemeToggle';

export interface NavSectionItem {
  id: string;
  label: string;
}

export const LANDING_NAV_ITEMS: NavSectionItem[] = [
  { id: 'hero', label: 'Home' },
  { id: 'features', label: 'Features' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'ai-intelligence', label: 'AI Intelligence' },
  { id: 'about', label: 'About' },
];

interface LandingNavbarProps {
  activeSection: string;
}

export const LandingNavbar: React.FC<LandingNavbarProps> = ({ activeSection }) => {
  const { isAuthenticated, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const scrolled = useScrolled(20);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setMobileOpen(false);
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (id === 'hero') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? 'bg-surface-container-lowest/95 backdrop-blur-md border-b border-outline-variant/40 shadow-sm'
          : 'bg-surface/80 backdrop-blur-sm border-b border-transparent'
      }`}
    >
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-[72px] flex items-center justify-between gap-4">
        {/* Brand */}
        <Link
          to="/"
          onClick={() => {
            setMobileOpen(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex items-center gap-2.5 no-underline group shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1b4d32] to-[#2d6a4f] flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-[22px]">eco</span>
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg sm:text-xl text-on-surface tracking-tight leading-none">
              AgroAI
            </span>
            <span className="text-[10px] text-on-surface-variant font-semibold tracking-wide mt-0.5 hidden sm:inline">
              Smart Farming • Better Tomorrow
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav aria-label="Primary navigation" className="hidden lg:flex items-center gap-1.5">
          {LANDING_NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => handleAnchorClick(e, item.id)}
                className={`px-3.5 py-2 rounded-full text-sm font-semibold transition-all no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-primary hover:bg-primary/5'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-2.5 shrink-0">
          <LanguageToggle />
          <ThemeToggle />

          {isAuthenticated ? (
            <>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="h-10 px-4 rounded-full bg-primary hover:bg-secondary text-on-primary font-bold text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">dashboard</span>
                <span>{t('nav.dashboard')}</span>
              </button>
              <button
                type="button"
                onClick={() => logout()}
                aria-label={t('nav.logout')}
                className="h-10 px-3 rounded-full border border-outline-variant/60 hover:bg-surface-container-high text-on-surface text-xs font-semibold transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="h-10 px-4 rounded-full border border-outline-variant/70 hover:border-primary/50 hover:bg-primary/5 text-on-surface font-bold text-xs transition-all flex items-center justify-center no-underline"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="h-10 px-5 rounded-full bg-primary hover:bg-secondary text-on-primary font-bold text-xs transition-all shadow-sm hover:shadow-md active:scale-95 flex items-center justify-center no-underline"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger */}
        <div className="flex lg:hidden items-center gap-2">
          <div className="hidden sm:flex md:hidden items-center gap-1.5">
            <LanguageToggle />
            <ThemeToggle />
          </div>
          <button
            type="button"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            aria-controls="landing-mobile-menu"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="w-10 h-10 rounded-xl border border-outline-variant/50 bg-surface-container-lowest text-on-surface flex items-center justify-center cursor-pointer hover:bg-surface-container transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-[22px]">
              {mobileOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {/* Animated Mobile Drawer */}
      <div
        id="landing-mobile-menu"
        className={`lg:hidden overflow-hidden transition-all duration-300 ease-out border-t border-outline-variant/30 bg-surface-container-lowest/98 backdrop-blur-md ${
          mobileOpen ? 'max-h-[460px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none border-t-transparent'
        }`}
      >
        <nav aria-label="Mobile navigation" className="px-4 py-4 space-y-1.5">
          {LANDING_NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => handleAnchorClick(e, item.id)}
                className={`block px-4 py-2.5 rounded-xl text-sm font-semibold no-underline transition-colors ${
                  isActive
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface hover:bg-surface-container'
                }`}
              >
                {item.label}
              </a>
            );
          })}

          <div className="pt-3 mt-3 border-t border-outline-variant/30 flex items-center justify-between gap-2 md:hidden">
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>

          <div className="pt-2 grid grid-cols-2 gap-2.5 md:hidden">
            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    navigate('/dashboard');
                  }}
                  className="col-span-2 h-11 rounded-xl bg-primary text-on-primary font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">dashboard</span>
                  <span>{t('nav.dashboard')}</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="h-11 rounded-xl border border-outline-variant/70 text-on-surface font-bold text-sm flex items-center justify-center no-underline hover:bg-surface-container"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileOpen(false)}
                  className="h-11 rounded-xl bg-primary text-on-primary font-bold text-sm flex items-center justify-center no-underline hover:bg-secondary"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
};
