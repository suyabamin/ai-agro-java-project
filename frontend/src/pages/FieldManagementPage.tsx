import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { fieldService } from '../services/fieldService';
import type { Field } from '../types/field';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';

export const FieldManagementPage: React.FC = () => {
  const { activeFarm } = useFarm();
  const navigate = useNavigate();

  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeFarm) {
      setFields([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    async function loadFields() {
      setLoading(true);
      setError(null);
      try {
        const resp = await fieldService.fetchFields(activeFarm!.farmId, true);
        if (mounted) {
          setFields(resp.data || []);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch fields');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadFields();

    return () => {
      mounted = false;
    };
  }, [activeFarm]);

  const filteredFields = fields.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.cropType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.soilType ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || f.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (!activeFarm) {
    return (
      <EmptyState
        icon="warehouse"
        title="No Active Farm Selected"
        description="Select or register a farm to manage its agricultural field zones."
        actionText="My Farms"
        onAction={() => navigate('/dashboard/farms')}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Acreage Partitioning
            </span>
            <span className="text-xs text-on-surface-variant">• {activeFarm.name}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
            Field Zone Management
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Partition farm acreage into monitored zones, track crop rotations, and assign field specialists.
          </p>
        </div>

        <Link
          to="/dashboard/fields/new"
          className="h-11 px-5 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 no-underline shrink-0 active:scale-95"
        >
          <span className="material-symbols-outlined text-[18px]">add_location_alt</span>
          <span>Add New Field</span>
        </Link>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-error-container text-error text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/30">
        <div className="relative w-full sm:w-80 flex items-center">
          <span className="absolute left-3 text-on-surface-variant pointer-events-none">
            <span className="material-symbols-outlined text-[18px]">search</span>
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search field, crop, or soil type..."
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface-container-low text-on-surface text-xs placeholder:text-outline outline-none focus:ring-2 focus:ring-primary border border-transparent shadow-inner"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-on-surface-variant font-semibold">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-transparent cursor-pointer font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="RESTING">RESTING</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </div>
      </div>

      {/* Fields List */}
      {loading ? (
        <LoadingSkeleton count={3} />
      ) : filteredFields.length === 0 ? (
        <EmptyState
          icon="grass"
          title={fields.length === 0 ? 'No Fields Created Yet' : 'No Matching Fields'}
          description={
            fields.length === 0
              ? `There are no field zones registered under "${activeFarm.name}". Add your first zone to begin soil telemetry mapping.`
              : 'No fields match your filter criteria. Try adjusting the search or status filter.'
          }
          actionText={fields.length === 0 ? 'Add Field' : undefined}
          onAction={fields.length === 0 ? () => navigate('/dashboard/fields/new') : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFields.map((f) => (
            <div
              key={f.fieldId}
              className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="font-bold text-base text-on-surface">{f.name}</span>
                  <StatusBadge status={f.status} />
                </div>

                <p className="text-xs text-on-surface-variant line-clamp-2 mb-4 leading-relaxed">
                  {f.notes || 'Monitored precision agricultural field zone.'}
                </p>

                <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-surface-container-low text-xs mb-4">
                  <div>
                    <span className="text-[10px] text-on-surface-variant uppercase font-semibold">
                      Crop
                    </span>
                    <div className="font-bold text-on-surface truncate">{f.cropType}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-on-surface-variant uppercase font-semibold">
                      Soil
                    </span>
                    <div className="font-bold text-on-surface truncate">{f.soilType}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-on-surface-variant uppercase font-semibold">
                      Area
                    </span>
                    <div className="font-bold text-on-surface">{f.areaHectares} ha</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-outline-variant/20">
                <Link
                  to={`/dashboard/fields/${f.fieldId}`}
                  className="flex-1 h-9 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors no-underline"
                >
                  <span className="material-symbols-outlined text-[16px] text-primary">insights</span>
                  <span>Field Console</span>
                </Link>
                <Link
                  to={`/dashboard/fields/${f.fieldId}/edit`}
                  className="h-9 px-3 rounded-lg border border-outline-variant/40 hover:bg-surface-container text-on-surface-variant font-semibold text-xs flex items-center gap-1 transition-colors no-underline"
                  title="Edit Field"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  <span>Edit</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
