import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

export const MyFarmsPage: React.FC = () => {
  const { farms, activeFarm, setActiveFarmId, loading, archiveFarm, updateVisibility } = useFarm();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterVisibility, setFilterVisibility] = useState<string>('ALL');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const filteredFarms = farms.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.district.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.division.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesVis =
      filterVisibility === 'ALL' || f.visibility === filterVisibility;
    return matchesSearch && matchesVis;
  });

  const handleToggleVisibility = async (farmId: string, currentVis: string, version: number) => {
    try {
      const nextVis = currentVis === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC';
      await updateVisibility(farmId, { visibility: nextVis, expectedVersion: version });
      setActionMessage(`Farm visibility updated to ${nextVis}`);
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update visibility');
    }
  };

  const handleArchive = async (farmId: string, name: string, version: number) => {
    if (!window.confirm(`Are you sure you want to archive farm "${name}"? This will delist it.`)) {
      return;
    }
    try {
      await archiveFarm(farmId, version);
      setActionMessage(`Farm "${name}" successfully archived.`);
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to archive farm');
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Enterprise Portfolio
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
            My Registered Farms
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Manage your registered agricultural holdings, field boundaries, and workforce delegations.
          </p>
        </div>

        <Link
          to="/dashboard/farms/new"
          className="h-11 px-5 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 no-underline shrink-0 active:scale-95"
        >
          <span className="material-symbols-outlined text-[18px]">add_business</span>
          <span>Register New Farm</span>
        </Link>
      </div>

      {actionMessage && (
        <div className="p-3.5 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/30">
        <div className="relative w-full sm:w-80 flex items-center">
          <span className="absolute left-3 text-on-surface-variant pointer-events-none">
            <span className="material-symbols-outlined text-[18px]">search</span>
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search farm name, district, division..."
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface-container-low text-on-surface text-xs placeholder:text-outline outline-none focus:ring-2 focus:ring-primary border border-transparent shadow-inner"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-on-surface-variant font-semibold">Visibility:</span>
          <select
            value={filterVisibility}
            onChange={(e) => setFilterVisibility(e.target.value)}
            className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-transparent cursor-pointer font-medium"
          >
            <option value="ALL">All Visibility</option>
            <option value="PUBLIC">Public</option>
            <option value="PRIVATE">Private</option>
          </select>
        </div>
      </div>

      {/* Farms Grid */}
      {loading ? (
        <LoadingSkeleton count={3} />
      ) : filteredFarms.length === 0 ? (
        <EmptyState
          icon="warehouse"
          title={farms.length === 0 ? 'No Farms Registered' : 'No Matching Farms'}
          description={
            farms.length === 0
              ? 'You do not own or manage any farms yet. Register your first farm to start mapping agricultural plots.'
              : 'No farms matched your filter criteria. Try adjusting your search query.'
          }
          actionText={farms.length === 0 ? 'Register Farm' : undefined}
          onAction={farms.length === 0 ? () => navigate('/dashboard/farms/new') : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFarms.map((f) => {
            const isActive = f.farmId === activeFarm?.farmId;
            return (
              <div
                key={f.farmId}
                className={`bg-surface-container-lowest rounded-2xl p-6 shadow-sm border transition-all flex flex-col justify-between relative overflow-hidden ${
                  isActive
                    ? 'border-primary ring-2 ring-primary/20 shadow-md'
                    : 'border-outline-variant/30 hover:shadow-md'
                }`}
              >
                <div
                  className={`absolute top-0 left-0 right-0 h-1.5 ${
                    isActive ? 'bg-primary' : 'bg-surface-container-high'
                  }`}
                />

                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[11px] font-bold uppercase tracking-wider">
                      {f.myRole}
                    </span>
                    <StatusBadge status={f.visibility} />
                  </div>

                  <h3 className="text-lg font-bold text-on-surface tracking-tight mb-1">
                    {f.name}
                  </h3>
                  <p className="text-xs text-on-surface-variant line-clamp-2 mb-4 leading-relaxed">
                    {f.description || 'No detailed farm description provided.'}
                  </p>

                  <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-surface-container-low text-xs mb-4">
                    <div>
                      <span className="text-[10px] text-on-surface-variant uppercase font-semibold">
                        Location
                      </span>
                      <div className="font-bold text-on-surface truncate">
                        {f.district}, {f.division}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-on-surface-variant uppercase font-semibold">
                        Total Boundary
                      </span>
                      <div className="font-bold text-on-surface">
                        {f.totalAreaHectares || 0} ha
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-outline-variant/20">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveFarmId(f.farmId);
                        navigate('/dashboard');
                      }}
                      className={`flex-1 h-9 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-primary text-on-primary shadow-sm'
                          : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {isActive ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      <span>{isActive ? 'Active Workspace' : 'Set as Active'}</span>
                    </button>

                    <Link
                      to={`/dashboard/farms/${f.farmId}`}
                      className="h-9 px-3 rounded-lg border border-outline-variant/40 hover:bg-surface-container text-on-surface font-semibold text-xs flex items-center gap-1 transition-colors no-underline"
                    >
                      <span>Overview</span>
                    </Link>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px] text-on-surface-variant">
                    <Link
                      to={`/dashboard/settings/farm`}
                      onClick={() => setActiveFarmId(f.farmId)}
                      className="hover:text-primary font-semibold flex items-center gap-0.5"
                    >
                      <span className="material-symbols-outlined text-[14px]">tune</span>
                      <span>Settings</span>
                    </Link>

                    {f.myRole === 'OWNER' && (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleToggleVisibility(f.farmId, f.visibility, f.version)}
                          className="hover:text-primary font-semibold cursor-pointer"
                        >
                          {f.visibility === 'PUBLIC' ? 'Make Private' : 'Make Public'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleArchive(f.farmId, f.name, f.version)}
                          className="hover:text-error font-semibold cursor-pointer"
                          title="Archive Farm"
                        >
                          Archive
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
