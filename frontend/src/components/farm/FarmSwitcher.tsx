import React, { useState } from 'react';
import { useFarm } from '../../context/FarmContext';

interface FarmSwitcherProps {
  onOpenCreateModal: () => void;
}

export const FarmSwitcher: React.FC<FarmSwitcherProps> = ({ onOpenCreateModal }) => {
  const { farms, activeFarm, setActiveFarmId, loading } = useFarm();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/40 transition-colors cursor-pointer text-xs font-semibold text-on-surface"
      >
        <span className="material-symbols-outlined text-[16px] text-primary">warehouse</span>
        <span className="truncate max-w-[150px]">
          {loading
            ? 'Loading farms...'
            : activeFarm
            ? activeFarm.name
            : farms.length > 0
            ? 'Select a Farm'
            : 'No Farms Found'}
        </span>
        {activeFarm && (
          <span className="px-1.5 py-0.2 rounded-md bg-primary-container text-on-primary text-[10px] font-bold uppercase">
            {activeFarm.myRole}
          </span>
        )}
        <span className="material-symbols-outlined text-[14px] text-on-surface-variant">
          expand_more
        </span>
      </button>

      {dropdownOpen && (
        <div
          className="absolute left-0 mt-2 w-64 rounded-xl bg-surface-container-lowest border border-outline-variant/40 shadow-xl py-2 z-50 text-xs"
          onClick={() => setDropdownOpen(false)}
        >
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-outline-variant/30">
            Active Farms ({farms.length})
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-outline-variant/20">
            {farms.map((f) => (
              <div
                key={f.farmId}
                onClick={() => setActiveFarmId(f.farmId)}
                className={`p-3 cursor-pointer flex items-center justify-between hover:bg-surface-container-low transition-colors ${
                  f.farmId === activeFarm?.farmId ? 'bg-secondary-container/30' : ''
                }`}
              >
                <div>
                  <div className="font-bold text-on-surface">{f.name}</div>
                  <div className="text-[11px] text-on-surface-variant">
                    {f.district}, {f.division} • {f.visibility}
                  </div>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface font-semibold text-[10px]">
                  {f.myRole}
                </span>
              </div>
            ))}
          </div>

          <div
            onClick={onOpenCreateModal}
            className="p-3 bg-surface-container-low/70 hover:bg-surface-container text-primary font-bold cursor-pointer flex items-center gap-2 border-t border-outline-variant/30 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            <span>Register New Farm</span>
          </div>
        </div>
      )}
    </div>
  );
};
