import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { EmptyState } from '../components/ui/EmptyState';

interface ActivityItem {
  id: string;
  type: 'FARM' | 'FIELD' | 'WORKFORCE' | 'PAYMENT' | 'TELEMETRY';
  title: string;
  description: string;
  timestamp: string;
  actor: string;
  icon: string;
}

export const ActivityDashboardPage: React.FC = () => {
  const { activeFarm } = useFarm();
  const navigate = useNavigate();

  const [filterType, setFilterType] = useState('ALL');

  if (!activeFarm) {
    return (
      <EmptyState
        icon="warehouse"
        title="No Farm Selected"
        description="Select an active farm to inspect audit logs and operational events."
        actionText="My Farms"
        onAction={() => navigate('/dashboard/farms')}
      />
    );
  }

  const activities: ActivityItem[] = [
    {
      id: 'act-1',
      type: 'TELEMETRY',
      title: 'In-situ Probe Telemetry Ingested',
      description: 'Soil probe zone report received: VWC 58.2%, Temperature 24.1°C, EC 1.1 dS/m.',
      timestamp: '12 minutes ago',
      actor: 'Automated Node M-104',
      icon: 'sensors',
    },
    {
      id: 'act-2',
      type: 'PAYMENT',
      title: 'Disbursement Ledger Updated',
      description: 'Administrative payment of 1,200 BDT recorded for paddy specialist.',
      timestamp: '2 hours ago',
      actor: 'Farm Owner',
      icon: 'payments',
    },
    {
      id: 'act-3',
      type: 'WORKFORCE',
      title: 'Farmer Assignment Authorized',
      description: 'Field specialist assigned to Zone A with telemetry & maintenance scope.',
      timestamp: '5 hours ago',
      actor: 'Farm Owner',
      icon: 'how_to_reg',
    },
    {
      id: 'act-4',
      type: 'FIELD',
      title: 'Field Zone Parameters Synchronized',
      description: 'Crop rotation set to Rice (BRRI Dhan 28) with optimistic concurrency lock.',
      timestamp: '1 day ago',
      actor: 'Farm Owner',
      icon: 'crop_free',
    },
    {
      id: 'act-5',
      type: 'FARM',
      title: 'Farm Metadata Updated',
      description: `Holding boundaries and public directory visibility re-indexed for "${activeFarm.name}".`,
      timestamp: '2 days ago',
      actor: 'Farm Owner',
      icon: 'warehouse',
    },
  ];

  const filtered = activities.filter((a) => filterType === 'ALL' || a.type === filterType);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Immutable Audit Trail
            </span>
            <span className="text-xs text-on-surface-variant">• {activeFarm.name}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
            Farm Activity & Audit Logs
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Chronological audit of agronomic interventions, sensor telemetry transmissions, and ledger entries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-on-surface-variant font-semibold">Scope Filter:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-transparent cursor-pointer font-bold"
          >
            <option value="ALL">All Events</option>
            <option value="TELEMETRY">Telemetry</option>
            <option value="PAYMENT">Finance & Payments</option>
            <option value="WORKFORCE">Workforce</option>
            <option value="FIELD">Field Zones</option>
            <option value="FARM">Farm Holding</option>
          </select>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 space-y-6">
        <h2 className="text-base font-bold text-on-surface">Recent Operational Events</h2>

        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-outline-variant/40">
          {filtered.map((item) => (
            <div key={item.id} className="relative flex items-start gap-4 text-xs">
              <div className="absolute -left-6 w-5 h-5 rounded-full bg-primary-container text-on-primary flex items-center justify-center text-[12px] shadow-sm">
                <span className="material-symbols-outlined text-[13px]">{item.icon}</span>
              </div>

              <div className="flex-1 p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 hover:border-primary/30 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                  <span className="font-bold text-sm text-on-surface">{item.title}</span>
                  <span className="text-[11px] text-on-surface-variant font-medium">{item.timestamp}</span>
                </div>
                <p className="text-on-surface-variant leading-relaxed mb-2">{item.description}</p>
                <div className="flex items-center gap-2 text-[10px] text-on-surface-variant font-medium">
                  <span className="px-2 py-0.5 rounded bg-surface-container font-semibold">
                    {item.type}
                  </span>
                  <span>•</span>
                  <span>Initiated by: <strong className="text-on-surface">{item.actor}</strong></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
