import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const PublicLayout: React.FC = () => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-surface text-on-surface font-sans selection:bg-secondary-container selection:text-on-secondary-container">
      {/* Top Fixed Header */}
      <header className="sticky top-0 z-50 bg-surface/90 backdrop-blur-md border-b border-outline-variant/30 shadow-sm">
        <div className="h-16 w-full max-w-[1600px] mx-auto px-4 sm:px-8 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-3 no-underline group">
            <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-on-primary shadow-sm group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[22px]">psychiatry</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xl text-on-surface tracking-tight">AgroAI</span>
                <span className="px-1.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase tracking-wider">
                  Enterprise
                </span>
              </div>
              <span className="text-[11px] text-on-surface-variant font-medium -mt-1 hidden sm:inline">
                Precision Agriculture Platform
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-on-surface-variant">
            <Link to="/" className="hover:text-primary transition-colors py-1">
              Overview
            </Link>
            <Link to="/explore" className="hover:text-primary transition-colors py-1">
              Farms
            </Link>
            <Link to="/jobs" className="hover:text-primary transition-colors py-1">
              Jobs & Labor
            </Link>
            <Link to="/about" className="hover:text-primary transition-colors py-1">
              About
            </Link>
          </nav>

          {/* Status & Auth Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-on-surface text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>Mesh Status: <strong className="text-primary font-bold">148 Nodes</strong></span>
            </div>

            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="h-10 px-4 rounded-lg bg-primary hover:bg-secondary text-on-primary font-semibold text-sm transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">dashboard</span>
                  <span>Dashboard</span>
                </button>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="h-10 px-3 rounded-lg border border-outline-variant/60 hover:bg-surface-container-high text-on-surface text-sm font-medium transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="h-10 px-4 rounded-lg border border-primary/40 hover:bg-primary/10 text-primary font-semibold text-sm transition-colors flex items-center justify-center no-underline"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="h-10 px-4 rounded-lg bg-primary hover:bg-secondary text-on-primary font-semibold text-sm transition-all shadow-sm flex items-center justify-center no-underline active:scale-95"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Page Slot */}
      <main className="flex-1 w-full">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="w-full bg-surface-container-lowest border-t border-outline-variant/30 py-8 shadow-sm">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-on-surface-variant">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface font-semibold">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>Systems Operational</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-secondary">verified_user</span>
              <span>SOC 2 Type II Certified Infrastructure</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <Link to="/about" className="hover:text-primary transition-colors no-underline text-on-surface-variant">
              About AgroAI
            </Link>
            <a href="#privacy" className="hover:text-primary transition-colors no-underline text-on-surface-variant">
              Privacy Policy
            </a>
            <a href="#terms" className="hover:text-primary transition-colors no-underline text-on-surface-variant">
              Terms of Service
            </a>
            <span className="text-outline-variant">•</span>
            <span>© 2026 AgroAI Platform Inc.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
