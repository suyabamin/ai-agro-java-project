import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useFarm } from '../../context/FarmContext';
import { useLanguage } from '../../context/LanguageContext';
import { FarmSwitcher } from '../farm/FarmSwitcher';
import { CreateFarmModal } from '../farm/CreateFarmModal';
import { ThemeToggle } from '../common/ThemeToggle';
import { LanguageToggle } from '../common/LanguageToggle';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

export const DashboardLayout: React.FC = () => {
  const { user, perspective, setPerspective, logout } = useAuth();
  const { activeFarm, farms, setActiveFarmId } = useFarm();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [createFarmModalOpen, setCreateFarmModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const isOwner = perspective === 'owner';

  // Navigation config for Owner perspective (every existing route preserved)
  const ownerNavGroups: NavGroup[] = useMemo(
    () => [
      {
        group: t('nav.overview'),
        items: [
          { label: t('nav.dashboard'), path: '/dashboard', icon: 'dashboard' },
          { label: t('nav.farms'), path: '/dashboard/farms', icon: 'warehouse' },
          { label: t('nav.fields'), path: '/dashboard/fields', icon: 'crop_free' },
        ],
      },
      {
        group: t('nav.ai'),
        items: [
          { label: t('nav.ai'), path: '/dashboard/ai', icon: 'psychiatry' },
          { label: t('nav.monitoring'), path: '/dashboard/monitoring', icon: 'sensors' },
          { label: t('nav.irrigation'), path: '/dashboard/irrigation', icon: 'water_drop' },
        ],
      },
      {
        group: t('nav.farmers'),
        items: [
          { label: t('nav.farmers'), path: '/dashboard/farmers', icon: 'badge' },
          { label: t('nav.jobs'), path: '/dashboard/jobs', icon: 'work' },
          { label: t('nav.myApplications'), path: '/dashboard/applications', icon: 'assignment_ind' },
          { label: t('nav.assignments'), path: '/dashboard/assignments', icon: 'how_to_reg' },
        ],
      },
      {
        group: t('nav.payments'),
        items: [
          { label: t('nav.payments'), path: '/dashboard/payments', icon: 'payments' },
          { label: t('nav.reviews'), path: '/dashboard/reviews', icon: 'rate_review' },
          { label: t('nav.activity'), path: '/dashboard/activity', icon: 'history' },
        ],
      },
      {
        group: t('nav.settings'),
        items: [
          { label: t('farm.farmSettings'), path: '/dashboard/settings/farm', icon: 'tune' },
          { label: t('nav.security'), path: '/dashboard/settings/security', icon: 'shield' },
          { label: t('nav.notifications'), path: '/dashboard/settings/notifications', icon: 'notifications' },
          { label: t('nav.profile'), path: '/dashboard/profile', icon: 'person' },
        ],
      },
    ],
    [t]
  );

  // Navigation config for Farmer perspective
  const farmerNavGroups: NavGroup[] = useMemo(
    () => [
      {
        group: t('nav.workdesk'),
        items: [
          { label: t('farmer.workdeskTitle'), path: '/farmer/dashboard', icon: 'dashboard' },
          { label: t('farmer.assignedFields'), path: '/farmer/fields', icon: 'grass' },
          { label: t('farmer.myAssignments'), path: '/farmer/assignments', icon: 'assignment' },
          { label: t('farmer.myApplications'), path: '/farmer/applications', icon: 'assignment_ind' },
          { label: t('farmer.paymentHistory'), path: '/farmer/payments', icon: 'receipt_long' },
          { label: t('farmer.myReviews'), path: '/farmer/reviews', icon: 'star' },
        ],
      },
      {
        group: t('nav.marketplace'),
        items: [
          { label: t('nav.jobsMarket'), path: '/jobs', icon: 'work_outline' },
          { label: t('nav.explore'), path: '/explore', icon: 'travel_explore' },
        ],
      },
      {
        group: t('nav.settings'),
        items: [
          { label: t('nav.profile'), path: '/dashboard/profile', icon: 'person' },
          { label: t('nav.security'), path: '/dashboard/settings/security', icon: 'shield' },
        ],
      },
    ],
    [t]
  );

  const currentGroups = isOwner ? ownerNavGroups : farmerNavGroups;

  const isCurrentActive = (path: string) => {
    if (path === '/dashboard' || path === '/farmer/dashboard') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  // Real search over existing navigation items & user's real farms
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { navMatches: [], farmMatches: [] };
    const navMatches = currentGroups
      .flatMap((g) => g.items.map((item) => ({ ...item, group: g.group })))
      .filter((item) => item.label.toLowerCase().includes(q) || item.path.toLowerCase().includes(q))
      .slice(0, 6);
    const farmMatches = (farms || [])
      .filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          (f.district && f.district.toLowerCase().includes(q))
      )
      .slice(0, 4);
    return { navMatches, farmMatches };
  }, [searchQuery, currentGroups, farms]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setUserDropdownOpen(false);
        setNotifDropdownOpen(false);
        setSearchFocused(false);
      }
    };
    const onClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, []);

  const SidebarContent = ({
    collapsed = false,
    onNavigate,
  }: {
    collapsed?: boolean;
    onNavigate?: () => void;
  }) => (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div
        className={`px-4 py-5 flex items-center ${
          collapsed ? 'justify-center' : 'justify-between'
        } border-b border-white/10`}
      >
        <Link
          to="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-2.5 no-underline group min-w-0"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white shadow-md shrink-0 group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-[22px]">eco</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-lg text-white tracking-tight leading-none">
                AgroAI
              </span>
              <span className="text-[10px] text-emerald-200/80 font-medium truncate mt-0.5">
                Smart Agriculture • Better Tomorrow
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation Groups */}
      <nav aria-label="Workspace navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {currentGroups.map((group) => (
          <div key={group.group}>
            {!collapsed && (
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-200/60 px-3 mb-1.5">
                {group.group}
              </div>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = isCurrentActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={`group flex items-center ${
                      collapsed ? 'justify-center px-2' : 'gap-3 px-3'
                    } py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 no-underline relative ${
                      active
                        ? 'bg-gradient-to-r from-[#2e7d4f] to-[#1f5e3a] text-white shadow-md'
                        : 'text-emerald-100/80 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[19px] shrink-0 transition-transform duration-200 ${
                        active ? 'text-emerald-200' : 'group-hover:scale-110'
                      }`}
                    >
                      {item.icon}
                    </span>
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Brand Card */}
      <div className="p-3 border-t border-white/10">
        {collapsed ? (
          <div className="flex justify-center py-1" title="AgroAI Active">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-white/10 border border-white/10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-400/20 text-emerald-200 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">compost</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white leading-tight">
                Growing Smarter Together
              </p>
              <p className="text-[10px] text-emerald-200/75 truncate mt-0.5">
                {activeFarm ? activeFarm.name : t('ribbon.workspace')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-surface text-on-surface font-sans selection:bg-secondary-container selection:text-on-secondary-container">
      {/* Desktop Deep Forest-Green Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 bg-gradient-to-b from-[#0e3b24] via-[#0b301d] to-[#082415] text-white sticky top-0 h-screen transition-all duration-300 z-30 shadow-xl ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <SidebarContent collapsed={sidebarCollapsed} />
      </aside>

      {/* Mobile Sidebar Overlay Drawer */}
      <div
        className={`fixed inset-0 z-50 lg:hidden flex transition-opacity duration-300 ${
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        <div
          className="fixed inset-0 bg-black/55 backdrop-blur-xs"
          onClick={() => setMobileMenuOpen(false)}
        />
        <div
          className={`relative w-72 max-w-[85vw] bg-gradient-to-b from-[#0e3b24] via-[#0b301d] to-[#082415] text-white h-full shadow-2xl flex flex-col z-10 transition-transform duration-300 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-200/80">
              {isOwner ? t('badge.owner') : t('badge.farmer')}
            </span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation drawer"
              className="p-1.5 rounded-lg text-emerald-100 hover:bg-white/10 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Mobile Quick Controls */}
          <div className="px-4 pb-3 border-b border-white/10 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <LanguageToggle variant="full" />
              <ThemeToggle />
            </div>
            <div className="grid grid-cols-2 gap-1.5 bg-white/10 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => {
                  setPerspective('owner');
                  setMobileMenuOpen(false);
                  navigate('/dashboard');
                }}
                className={`py-1.5 rounded-lg font-semibold cursor-pointer transition-colors ${
                  isOwner ? 'bg-emerald-500 text-white' : 'text-emerald-100/80'
                }`}
              >
                {t('nav.ownerView')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPerspective('farmer');
                  setMobileMenuOpen(false);
                  navigate('/farmer/dashboard');
                }}
                className={`py-1.5 rounded-lg font-semibold cursor-pointer transition-colors ${
                  !isOwner ? 'bg-emerald-500 text-white' : 'text-emerald-100/80'
                }`}
              >
                {t('nav.farmerView')}
              </button>
            </div>
            {isOwner && (
              <FarmSwitcher
                onOpenCreateModal={() => {
                  setMobileMenuOpen(false);
                  setCreateFarmModalOpen(true);
                }}
              />
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            <SidebarContent onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      </div>

      {/* Right Main Column (Topbar + Content) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-20 bg-surface-container-lowest/95 backdrop-blur-md border-b border-outline-variant/30 shadow-xs">
          <div className="h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
            {/* Left: Sidebar Toggle + Search + Farm Switcher */}
            <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="lg:hidden p-2 rounded-xl hover:bg-surface-container text-on-surface cursor-pointer"
                aria-label="Toggle Navigation"
              >
                <span className="material-symbols-outlined text-[22px]">menu</span>
              </button>

              <button
                type="button"
                onClick={() => setSidebarCollapsed((v) => !v)}
                className="hidden lg:flex p-2 rounded-xl hover:bg-surface-container text-on-surface-variant hover:text-on-surface cursor-pointer transition-colors"
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {sidebarCollapsed ? 'menu_open' : 'menu'}
                </span>
              </button>

              {/* Real Search over Farms & Navigation Routes */}
              <div ref={searchContainerRef} className="relative flex-1 max-w-md hidden sm:block">
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute left-3 pointer-events-none">
                    search
                  </span>
                  <input
                    type="search"
                    value={searchQuery}
                    onFocus={() => setSearchFocused(true)}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchFocused(true);
                    }}
                    placeholder="Search farms, pages, or features..."
                    aria-label="Search farms, pages, or features"
                    className="w-full h-9 pl-9 pr-3 rounded-full bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                  />
                </div>

                {searchFocused && searchQuery.trim().length > 0 && (
                  <div className="absolute left-0 right-0 mt-2 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-xl py-2 z-50 text-xs max-h-80 overflow-y-auto">
                    {searchResults.farmMatches.length === 0 &&
                    searchResults.navMatches.length === 0 ? (
                      <div className="px-4 py-3 text-on-surface-variant">
                        No matching farms or workspace pages.
                      </div>
                    ) : (
                      <>
                        {searchResults.farmMatches.length > 0 && (
                          <div className="pb-1">
                            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                              Your Farms
                            </div>
                            {searchResults.farmMatches.map((farm) => (
                              <button
                                key={farm.farmId}
                                type="button"
                                onClick={() => {
                                  setActiveFarmId(farm.farmId);
                                  setSearchQuery('');
                                  setSearchFocused(false);
                                  navigate('/dashboard');
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-surface-container-low flex items-center justify-between gap-2 cursor-pointer"
                              >
                                <span className="font-semibold text-on-surface truncate">
                                  {farm.name}
                                </span>
                                <span className="text-[10px] text-on-surface-variant shrink-0">
                                  {farm.district || farm.status}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                        {searchResults.navMatches.length > 0 && (
                          <div>
                            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                              Workspace Pages
                            </div>
                            {searchResults.navMatches.map((item) => (
                              <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => {
                                  setSearchQuery('');
                                  setSearchFocused(false);
                                }}
                                className="flex items-center gap-2.5 px-3 py-2 hover:bg-surface-container-low text-on-surface no-underline"
                              >
                                <span className="material-symbols-outlined text-[16px] text-primary">
                                  {item.icon}
                                </span>
                                <span className="font-medium truncate">{item.label}</span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Farm Switcher */}
              {isOwner && (
                <div className="hidden xl:block">
                  <FarmSwitcher onOpenCreateModal={() => setCreateFarmModalOpen(true)} />
                </div>
              )}
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden md:flex items-center gap-2">
                <LanguageToggle />
                <ThemeToggle />
              </div>

              {/* Perspective Switcher */}
              <div className="hidden sm:flex items-center bg-surface-container p-1 rounded-xl border border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => {
                    setPerspective('owner');
                    navigate('/dashboard');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isOwner
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {t('nav.ownerView')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPerspective('farmer');
                    navigate('/farmer/dashboard');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    !isOwner
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {t('nav.farmerView')}
                </button>
              </div>

              {/* Notifications Popover */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotifDropdownOpen((v) => !v);
                    setUserDropdownOpen(false);
                  }}
                  aria-label={t('nav.notifications')}
                  className="w-9 h-9 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 flex items-center justify-center text-on-surface cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[19px]">notifications</span>
                </button>

                {notifDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-xl p-3 z-50 text-xs space-y-2">
                    <div className="font-bold text-on-surface flex items-center justify-between">
                      <span>{t('nav.notifications')}</span>
                      <span className="text-[10px] font-medium text-primary">
                        {activeFarm ? activeFarm.name : 'Workspace'}
                      </span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">
                      Manage alert preferences and review chronological farm events in the Audit Log.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <Link
                        to="/dashboard/settings/notifications"
                        onClick={() => setNotifDropdownOpen(false)}
                        className="flex-1 text-center py-1.5 rounded-lg bg-primary text-on-primary font-semibold no-underline"
                      >
                        Preferences
                      </Link>
                      <Link
                        to="/dashboard/activity"
                        onClick={() => setNotifDropdownOpen(false)}
                        className="flex-1 text-center py-1.5 rounded-lg bg-surface-container text-on-surface font-semibold no-underline"
                      >
                        Audit Log
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* User Profile Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setUserDropdownOpen((v) => !v);
                    setNotifDropdownOpen(false);
                  }}
                  className="flex items-center gap-2 p-1 pr-2 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer border border-outline-variant/30"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1b4d32] to-[#2d6a4f] text-white flex items-center justify-center font-bold text-xs uppercase">
                    {user?.fullName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                  </div>
                  <div className="hidden md:flex flex-col text-left">
                    <span className="text-xs font-bold text-on-surface leading-tight truncate max-w-[120px]">
                      {user?.fullName || user?.name || 'AgroAI Operator'}
                    </span>
                    <span className="text-[10px] text-on-surface-variant leading-tight capitalize">
                      {isOwner ? t('badge.owner') : t('badge.farmer')}
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                    expand_more
                  </span>
                </button>

                {userDropdownOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-xl py-2 z-50 text-xs"
                    onClick={() => setUserDropdownOpen(false)}
                  >
                    <div className="px-4 py-2 border-b border-outline-variant/30">
                      <p className="font-bold text-on-surface text-sm truncate">
                        {user?.fullName || user?.name || 'Operator'}
                      </p>
                      <p className="text-on-surface-variant truncate">{user?.email}</p>
                      <span className="mt-1 inline-block px-2 py-0.5 rounded-md bg-secondary-container text-on-secondary-container font-semibold capitalize text-[10px]">
                        {isOwner ? t('badge.owner') : t('badge.farmer')}
                      </span>
                    </div>

                    <Link
                      to="/dashboard/profile"
                      className="flex items-center gap-2.5 px-4 py-2 hover:bg-surface-container-low text-on-surface transition-colors no-underline"
                    >
                      <span className="material-symbols-outlined text-[18px] text-primary">person</span>
                      <span>{t('nav.profile')}</span>
                    </Link>
                    <Link
                      to="/dashboard/settings/security"
                      className="flex items-center gap-2.5 px-4 py-2 hover:bg-surface-container-low text-on-surface transition-colors no-underline"
                    >
                      <span className="material-symbols-outlined text-[18px] text-secondary">shield</span>
                      <span>{t('nav.security')}</span>
                    </Link>
                    <Link
                      to="/dashboard/settings/notifications"
                      className="flex items-center gap-2.5 px-4 py-2 hover:bg-surface-container-low text-on-surface transition-colors no-underline"
                    >
                      <span className="material-symbols-outlined text-[18px]">notifications</span>
                      <span>{t('nav.notifications')}</span>
                    </Link>

                    <div className="border-t border-outline-variant/30 my-1" />

                    <button
                      type="button"
                      onClick={() => logout()}
                      className="w-full text-left flex items-center gap-2.5 px-4 py-2 hover:bg-error-container/40 text-error transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">logout</span>
                      <span className="font-semibold">{t('nav.logout')}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

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
