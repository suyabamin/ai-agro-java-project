import React, { useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useFarm } from '../../context/FarmContext';
import { FarmSwitcher } from '../farm/FarmSwitcher';
import { CreateFarmModal } from '../farm/CreateFarmModal';

export const DashboardLayout: React.FC = () => {
  const { user, perspective, setPerspective, logout } = useAuth();
  const { activeFarm } = useFarm();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [createFarmModalOpen, setCreateFarmModalOpen] = useState(false);

  const isOwner = perspective === 'owner';

  // Navigation config for Owner perspective
  const ownerNavGroups = [
    {
      group: 'Overview',
      items: [
        { label: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
        { label: 'My Farms', path: '/dashboard/farms', icon: 'warehouse' },
        { label: 'Field Management', path: '/dashboard/fields', icon: 'crop_free' },
      ],
    },
    {
      group: 'Agronomy & AI',
      items: [
        { label: 'AI Crop Diagnostics', path: '/dashboard/ai', icon: 'psychiatry' },
        { label: 'Soil & Telemetry', path: '/dashboard/monitoring', icon: 'sensors' },
        { label: 'Irrigation Plans', path: '/dashboard/irrigation', icon: 'water_drop' },
      ],
    },
    {
      group: 'Workforce & Labor',
      items: [
        { label: 'Farmer Directory', path: '/dashboard/farmers', icon: 'badge' },
        { label: 'Job Vacancies', path: '/dashboard/jobs', icon: 'work' },
        { label: 'Applications', path: '/dashboard/applications', icon: 'assignment_ind' },
        { label: 'Field Assignments', path: '/dashboard/assignments', icon: 'how_to_reg' },
      ],
    },
    {
      group: 'Finance & Records',
      items: [
        { label: 'Payments & Ledger', path: '/dashboard/payments', icon: 'payments' },
        { label: 'Farmer Reviews', path: '/dashboard/reviews', icon: 'rate_review' },
        { label: 'Activity Logs', path: '/dashboard/activity', icon: 'history' },
      ],
    },
    {
      group: 'Settings',
      items: [
        { label: 'Farm Settings', path: '/dashboard/settings/farm', icon: 'tune' },
        { label: 'Account Security', path: '/dashboard/settings/security', icon: 'shield' },
        { label: 'Notifications', path: '/dashboard/settings/notifications', icon: 'notifications' },
        { label: 'My Profile', path: '/dashboard/profile', icon: 'person' },
      ],
    },
  ];

  // Navigation config for Farmer perspective
  const farmerNavGroups = [
    {
      group: 'Workdesk',
      items: [
        { label: 'Farmer Dashboard', path: '/farmer/dashboard', icon: 'dashboard' },
        { label: 'Assigned Fields', path: '/farmer/fields', icon: 'grass' },
        { label: 'My Assignments', path: '/farmer/assignments', icon: 'assignment' },
        { label: 'My Applications', path: '/farmer/applications', icon: 'assignment_ind' },
        { label: 'Payment History', path: '/farmer/payments', icon: 'receipt_long' },
        { label: 'My Reviews', path: '/farmer/reviews', icon: 'star' },
      ],
    },
    {
      group: 'Marketplace',
      items: [
        { label: 'Job Opportunities', path: '/jobs', icon: 'work_outline' },
        { label: 'Explore Farms', path: '/explore', icon: 'travel_explore' },
      ],
    },
    {
      group: 'Settings',
      items: [
        { label: 'My Profile', path: '/dashboard/profile', icon: 'person' },
        { label: 'Account Security', path: '/dashboard/settings/security', icon: 'shield' },
      ],
    },
  ];

  const currentGroups = isOwner ? ownerNavGroups : farmerNavGroups;

  const isCurrentActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface text-on-surface font-sans selection:bg-secondary-container selection:text-on-secondary-container">
      {/* Top Telemetry Status Ribbon */}
      <div className="w-full bg-surface-container-lowest/90 backdrop-blur-md border-b border-outline-variant/30 px-4 sm:px-8 py-2 flex flex-wrap items-center justify-between gap-2 text-xs z-40">
        <div className="flex items-center gap-3">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
          </span>
          <span className="font-semibold text-on-surface uppercase tracking-wider">
            AgroAI Multi-Tenant Gateway v4.12
          </span>
          <span className="text-outline-variant hidden sm:inline">•</span>
          <span className="text-on-surface-variant hidden md:inline">256-Bit Encrypted Telemetry Link</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface font-medium">
            <span className="material-symbols-outlined text-[14px] text-primary">sensors</span>
            <span>Mesh: <strong className="text-primary font-semibold">148 Nodes</strong></span>
          </div>
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-medium">
            <span className="material-symbols-outlined text-[14px]">satellite_alt</span>
            <span>Sentinel-2 Sync: <strong className="font-semibold">18m ago</strong></span>
          </div>
          {activeFarm && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary font-medium text-[11px]">
              <span className="material-symbols-outlined text-[13px]">location_on</span>
              <span className="truncate max-w-[120px]">{activeFarm.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Top Header */}
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-md border-b border-outline-variant/30 shadow-sm">
        <div className="h-16 px-4 sm:px-8 flex items-center justify-between gap-4">
          {/* Left Brand & Mobile Toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-surface-container-high text-on-surface cursor-pointer"
              aria-label="Toggle Navigation"
            >
              <span className="material-symbols-outlined text-[24px]">
                {mobileMenuOpen ? 'close' : 'menu'}
              </span>
            </button>

            <Link to="/dashboard" className="flex items-center gap-2.5 no-underline group">
              <div className="w-9 h-9 rounded-xl bg-primary-container flex items-center justify-center text-on-primary shadow-sm group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[20px]">psychiatry</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-lg text-on-surface tracking-tight">AgroAI</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase tracking-wider">
                    {isOwner ? 'Owner' : 'Farmer'}
                  </span>
                </div>
              </div>
            </Link>

            {/* Farm Switcher for Owners */}
            {isOwner && (
              <div className="hidden sm:block ml-2">
                <FarmSwitcher onOpenCreateModal={() => setCreateFarmModalOpen(true)} />
              </div>
            )}
          </div>

          {/* Right Controls: Perspective Toggle & Profile */}
          <div className="flex items-center gap-3">
            {/* Perspective Switcher */}
            <div className="flex items-center bg-surface-container-high/60 p-1 rounded-xl border border-outline-variant/30">
              <button
                type="button"
                onClick={() => {
                  setPerspective('owner');
                  navigate('/dashboard');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isOwner
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Owner View
              </button>
              <button
                type="button"
                onClick={() => {
                  setPerspective('farmer');
                  navigate('/farmer/dashboard');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  !isOwner
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Farmer View
              </button>
            </div>

            {/* User Profile Pill / Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-colors cursor-pointer border border-outline-variant/30"
              >
                <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs uppercase">
                  {user?.fullName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-bold text-on-surface leading-tight truncate max-w-[120px]">
                    {user?.fullName || user?.name || 'AgroAI Operator'}
                  </span>
                  <span className="text-[10px] text-on-surface-variant leading-tight truncate max-w-[120px]">
                    {user?.email || 'Authenticated'}
                  </span>
                </div>
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                  expand_more
                </span>
              </button>

              {userDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-xl bg-surface-container-lowest border border-outline-variant/40 shadow-xl py-2 z-50 text-xs"
                  onClick={() => setUserDropdownOpen(false)}
                >
                  <div className="px-4 py-2 border-b border-outline-variant/30">
                    <p className="font-bold text-on-surface text-sm truncate">
                      {user?.fullName || 'Operator'}
                    </p>
                    <p className="text-on-surface-variant truncate">{user?.email}</p>
                    <span className="mt-1 inline-block px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-semibold uppercase text-[10px]">
                      {perspective.toUpperCase()} WORKSPACE
                    </span>
                  </div>

                  <Link
                    to="/dashboard/profile"
                    className="flex items-center gap-2.5 px-4 py-2 hover:bg-surface-container-low text-on-surface transition-colors no-underline"
                  >
                    <span className="material-symbols-outlined text-[18px] text-primary">person</span>
                    <span>My Profile</span>
                  </Link>
                  <Link
                    to="/dashboard/settings/security"
                    className="flex items-center gap-2.5 px-4 py-2 hover:bg-surface-container-low text-on-surface transition-colors no-underline"
                  >
                    <span className="material-symbols-outlined text-[18px] text-secondary">shield</span>
                    <span>Account Security</span>
                  </Link>
                  <Link
                    to="/dashboard/settings/notifications"
                    className="flex items-center gap-2.5 px-4 py-2 hover:bg-surface-container-low text-on-surface transition-colors no-underline"
                  >
                    <span className="material-symbols-outlined text-[18px]">notifications</span>
                    <span>Notification Settings</span>
                  </Link>

                  <div className="border-t border-outline-variant/30 my-1" />

                  <button
                    type="button"
                    onClick={() => logout()}
                    className="w-full text-left flex items-center gap-2.5 px-4 py-2 hover:bg-error-container/40 text-error transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    <span className="font-semibold">Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Body: Sidebar + Page Outlet */}
      <div className="flex-1 flex w-full relative">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-surface-container-lowest border-r border-outline-variant/30 min-h-[calc(100vh-7rem)] py-6 px-4">
          <div className="space-y-6 flex-1 overflow-y-auto">
            {currentGroups.map((group) => (
              <div key={group.group}>
                <div className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant px-3 mb-2">
                  {group.group}
                </div>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const active = isCurrentActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-all no-underline ${
                          active
                            ? 'bg-primary text-on-primary shadow-sm'
                            : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-[20px] ${
                            active ? 'text-on-primary' : 'text-primary'
                          }`}
                        >
                          {item.icon}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar Footer Card */}
          <div className="mt-6 p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface-variant">
            <div className="flex items-center gap-2 font-bold text-on-surface mb-1">
              <span className="material-symbols-outlined text-[16px] text-primary">eco</span>
              <span>Agronomic Telemetry</span>
            </div>
            <p className="text-[11px] leading-tight text-on-surface-variant">
              In-situ LoRaWAN sensors online across active zones.
            </p>
          </div>
        </aside>

        {/* Mobile Slide-Over Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm transition-opacity"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative w-72 max-w-[85vw] bg-surface-container-lowest h-full shadow-2xl flex flex-col py-6 px-4 overflow-y-auto z-50">
              <div className="flex items-center justify-between pb-4 border-b border-outline-variant/30 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs">
                    🌿
                  </div>
                  <span className="font-bold text-base text-on-surface">AgroAI Menu</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container-low"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {isOwner && (
                <div className="mb-4">
                  <FarmSwitcher onOpenCreateModal={() => {
                    setMobileMenuOpen(false);
                    setCreateFarmModalOpen(true);
                  }} />
                </div>
              )}

              <div className="space-y-6 flex-1">
                {currentGroups.map((group) => (
                  <div key={group.group}>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant px-3 mb-1.5">
                      {group.group}
                    </div>
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const active = isCurrentActive(item.path);
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-all no-underline ${
                              active
                                ? 'bg-primary text-on-primary shadow-sm'
                                : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                            <span className="truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Content Outlet */}
        <main className="flex-1 w-full min-w-0 p-4 sm:p-6 lg:p-8 bg-surface">
          <Outlet />
        </main>
      </div>

      {/* Farm Create Modal */}
      {createFarmModalOpen && (
        <CreateFarmModal
          isOpen={createFarmModalOpen}
          onClose={() => setCreateFarmModalOpen(false)}
        />
      )}
    </div>
  );
};
