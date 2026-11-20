import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { fieldService } from '../services/fieldService';
import { assignmentService } from '../services/assignmentService';
import { applicationService } from '../services/applicationService';
import type { Field } from '../types/field';
import type { CreateAssignmentPayload, FieldAssignment } from '../types/assignment';
import type { JobApplication } from '../types/job';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { StatusBadge } from '../components/ui/StatusBadge';

export interface ApprovedFarmerCandidate {
  uid: string;
  name: string;
  email: string;
  phone?: string | null;
  skills: string[];
  experience?: string | null;
  applicationId?: string;
  jobId?: string;
  status: string;
}

export const CreateAssignmentPage: React.FC = () => {
  const { activeFarm } = useFarm();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const prefilledFarmerUid = searchParams.get('farmerUid') || '';
  const prefilledFieldId = searchParams.get('fieldId') || '';
  const prefilledAppId = searchParams.get('applicationId') || '';

  // Form State
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState(prefilledFieldId);
  const [approvedFarmers, setApprovedFarmers] = useState<ApprovedFarmerCandidate[]>([]);
  const [selectedFarmer, setSelectedFarmer] = useState<ApprovedFarmerCandidate | null>(null);
  const [existingAssignments, setExistingAssignments] = useState<FieldAssignment[]>([]);
  const [permissions, setPermissions] = useState<string[]>(['READ', 'WRITE_LOGS', 'TELEMETRY']);

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [farmersLoading, setFarmersLoading] = useState(false);

  const AVAILABLE_PERMISSIONS = [
    { id: 'READ', label: 'Read Field & Telemetry Data', desc: 'Allows viewing historical soil data and zone metrics' },
    { id: 'WRITE_LOGS', label: 'Submit Fieldwork Logs', desc: 'Allows recording physical maintenance and crop observations' },
    { id: 'TELEMETRY', label: 'Sensor Calibration & Telemetry', desc: 'Allows manual in-situ probe readings' },
    { id: 'IRRIGATE', label: 'Irrigation Valve Activation', desc: 'Permission to execute field sector irrigation events' },
  ];

  // Load Fields and Approved Farmers
  useEffect(() => {
    if (!activeFarm) return;
    let mounted = true;

    async function loadData() {
      setLoading(true);
      setFarmersLoading(true);
      setError(null);

      try {
        // Fetch fields, approved applications, and existing assignments in parallel
        const [fieldsResp, appsResp, assignmentsResp] = await Promise.all([
          fieldService.fetchFields(activeFarm!.farmId).catch(() => ({ data: [] })),
          applicationService.getFarmApplications(activeFarm!.farmId, { status: 'APPROVED' }).catch(() => ({ data: [] })),
          assignmentService.fetchFarmAssignments(activeFarm!.farmId).catch(() => ({ data: { items: [] } })),
        ]);

        if (!mounted) return;

        // Set fields
        const loadedFields = fieldsResp.data || [];
        setFields(loadedFields);
        if (!selectedFieldId && loadedFields.length > 0) {
          setSelectedFieldId(loadedFields[0].fieldId);
        }

        // Set existing assignments
        const activeAssgns = (assignmentsResp.data?.items || []).filter((a) => a.status === 'ACTIVE');
        setExistingAssignments(activeAssgns);

        // Process approved applications
        const apps: JobApplication[] = appsResp.data || [];
        const approvedOnly = apps.filter((app) => app.status === 'APPROVED');

        // Map to distinct candidates (deduplicated by applicantUid, taking latest application)
        const candidateMap = new Map<string, ApprovedFarmerCandidate>();
        approvedOnly.forEach((app) => {
          if (!candidateMap.has(app.applicantUid)) {
            const raw = app as unknown as Record<string, unknown>;
            candidateMap.set(app.applicantUid, {
              uid: app.applicantUid,
              name: app.applicantName || 'Approved Specialist',
              email: app.applicantEmail || '',
              phone: (raw.applicantPhone as string) || null,
              skills: app.relevantSkills || (raw.skills as string[]) || [],
              experience: app.experienceYears ? `${app.experienceYears} Years` : null,
              applicationId: app.applicationId,
              jobId: app.jobId,
              status: 'APPROVED',
            });
          }
        });

        const list = Array.from(candidateMap.values());
        setApprovedFarmers(list);

        // Handle prefilled farmer UID from URL query params
        if (prefilledFarmerUid) {
          const matched = list.find(
            (f) => f.uid === prefilledFarmerUid || (prefilledAppId && f.applicationId === prefilledAppId)
          );
          if (matched) {
            setSelectedFarmer(matched);
          } else {
            // If prefilled with a verified specialist UID not yet in candidateMap
            const prefilledCandidate: ApprovedFarmerCandidate = {
              uid: prefilledFarmerUid,
              name: prefilledFarmerUid.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
              email: `${prefilledFarmerUid}@agroai.org`,
              skills: ['Agricultural Fieldwork'],
              applicationId: prefilledAppId || undefined,
              status: 'APPROVED',
            };
            setSelectedFarmer(prefilledCandidate);
          }
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load assignment data');
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setFarmersLoading(false);
        }
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [activeFarm, prefilledFarmerUid, prefilledAppId, selectedFieldId]);

  // Check if a farmer is already actively assigned to the selected field
  const isAlreadyAssigned = useMemo(() => {
    if (!selectedFarmer || !selectedFieldId) return false;
    return existingAssignments.some(
      (a) => a.fieldId === selectedFieldId && a.farmerUid === selectedFarmer.uid && a.status === 'ACTIVE'
    );
  }, [selectedFarmer, selectedFieldId, existingAssignments]);

  // Filtered farmers based on search
  const filteredFarmers = useMemo(() => {
    if (!searchQuery.trim()) return approvedFarmers;
    const q = searchQuery.toLowerCase().trim();
    return approvedFarmers.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.email.toLowerCase().includes(q) ||
        f.skills.some((s) => s.toLowerCase().includes(q))
    );
  }, [approvedFarmers, searchQuery]);

  const togglePermission = (permId: string) => {
    setPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const handleSelectFarmer = (farmer: ApprovedFarmerCandidate) => {
    setSelectedFarmer(farmer);
    setError(null);
  };

  const handleDeselectFarmer = () => {
    setSelectedFarmer(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFarm) return;
    if (!selectedFieldId) {
      setError('Please select a target field zone.');
      return;
    }
    if (!selectedFarmer) {
      setError('Please select an approved farmer / specialist.');
      return;
    }
    if (isAlreadyAssigned) {
      setError('This specialist already holds an active tenure on the selected field zone.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload: CreateAssignmentPayload = {
      farmerUid: selectedFarmer.uid,
      permissions,
      sourceApplicationId: selectedFarmer.applicationId || undefined,
      sourceJobId: selectedFarmer.jobId || undefined,
    };

    try {
      await assignmentService.createAssignment(activeFarm.farmId, selectedFieldId, payload);
      navigate('/dashboard/assignments');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create field assignment');
    } finally {
      setSubmitting(false);
    }
  };

  if (!activeFarm) {
    return (
      <EmptyState
        icon="warehouse"
        title="No Farm Selected"
        description="Select an active farm before creating a field assignment."
        actionText="My Farms"
        onAction={() => navigate('/dashboard/farms')}
      />
    );
  }

  if (loading) {
    return <LoadingSkeleton type="dashboard" />;
  }

  return (
    <div className="w-full max-w-[850px] mx-auto space-y-6">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard/assignments"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to Assignments</span>
        </Link>
        <span className="px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-bold uppercase tracking-wider">
          {activeFarm.name}
        </span>
      </div>

      {/* Main Form Container */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-0.5 rounded-full bg-surface-container-low text-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">how_to_reg</span>
            Operational Allocation
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
          Assign Specialist to Field Zone
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant mt-1 mb-8 leading-relaxed">
          Grant an approved agronomist or field technician scoped operational authority over a specific acreage sector under <strong className="text-on-surface">{activeFarm.name}</strong>.
        </p>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-error-container text-error text-xs font-medium border border-error/20 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Target Field Zone */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface" htmlFor="assign-field">
              Target Field Zone *
            </label>
            {fields.length === 0 ? (
              <div className="p-3 rounded-lg bg-surface-container-low text-xs text-on-surface-variant flex items-center justify-between">
                <span>No field zones available in this farm.</span>
                <Link to="/dashboard/fields/new" className="text-primary font-bold hover:underline">
                  Add Field Zone
                </Link>
              </div>
            ) : (
              <select
                id="assign-field"
                value={selectedFieldId}
                onChange={(e) => setSelectedFieldId(e.target.value)}
                className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner cursor-pointer"
              >
                {fields.map((f) => (
                  <option key={f.fieldId} value={f.fieldId}>
                    {f.name} — {f.cropType} ({f.areaHectares} ha)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Section 2: Approved Farmer / Specialist Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                <span>Select Approved Farmer / Specialist *</span>
                <span className="text-[11px] font-normal text-on-surface-variant">
                  ({approvedFarmers.length} approved)
                </span>
              </label>
              <Link
                to="/dashboard/applications"
                className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1"
              >
                <span>Recruitment Applications</span>
                <span className="material-symbols-outlined text-[12px]">open_in_new</span>
              </Link>
            </div>

            {/* Selected Specialist View */}
            {selectedFarmer ? (
              <div className="p-4 rounded-xl bg-primary/5 border-2 border-primary/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                    {selectedFarmer.name
                      .split(' ')
                      .map((w) => w[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2) || 'SP'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-on-surface">{selectedFarmer.name}</span>
                      <StatusBadge status="APPROVED" />
                    </div>
                    {selectedFarmer.email && (
                      <p className="text-xs text-on-surface-variant mt-0.5">{selectedFarmer.email}</p>
                    )}
                    {selectedFarmer.skills && selectedFarmer.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {selectedFarmer.skills.map((s) => (
                          <span
                            key={s}
                            className="px-2 py-0.5 rounded-md bg-surface-container-high text-on-surface text-[10px] font-medium"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {isAlreadyAssigned && (
                    <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold">
                      Already Active on this Zone
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleDeselectFarmer}
                    className="h-9 px-3.5 rounded-lg border border-outline-variant/40 hover:bg-surface-container text-on-surface text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">swap_horiz</span>
                    <span>Change</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Searchable Approved Specialist Selection Table / List */
              <div className="space-y-2.5">
                {/* Search Bar */}
                <div className="relative w-full flex items-center">
                  <span className="absolute left-3 text-on-surface-variant pointer-events-none">
                    <span className="material-symbols-outlined text-[18px]">search</span>
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search approved specialist by name, email, or agronomic skill..."
                    className="w-full h-10 pl-9 pr-4 rounded-lg bg-surface-container-low text-on-surface text-xs focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 text-on-surface-variant hover:text-on-surface text-xs"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  )}
                </div>

                {/* Candidate List Container */}
                {farmersLoading ? (
                  <div className="p-8 text-center bg-surface-container-low rounded-xl">
                    <span className="material-symbols-outlined text-[24px] text-primary animate-spin">refresh</span>
                    <p className="text-xs text-on-surface-variant mt-2">Loading approved specialists...</p>
                  </div>
                ) : filteredFarmers.length === 0 ? (
                  <div className="p-6 text-center bg-surface-container-low rounded-xl border border-outline-variant/20 space-y-2">
                    <span className="material-symbols-outlined text-[32px] text-on-surface-variant block mx-auto">
                      person_search
                    </span>
                    <p className="text-xs font-bold text-on-surface">
                      {searchQuery ? 'No matching specialists found' : 'No Approved Specialists on this Farm'}
                    </p>
                    <p className="text-[11px] text-on-surface-variant max-w-md mx-auto leading-relaxed">
                      {searchQuery
                        ? 'Try searching with a different name or skill keyword.'
                        : 'Farmers must have an APPROVED application for this farm before they can be assigned to a field zone. Review applicant submissions in Recruitment.'}
                    </p>
                    {!searchQuery && (
                      <Link
                        to="/dashboard/applications"
                        className="inline-flex items-center gap-1.5 h-8 px-4 mt-2 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-all no-underline"
                      >
                        <span className="material-symbols-outlined text-[14px]">assignment_ind</span>
                        <span>Review Job Applications</span>
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-outline-variant/30 overflow-hidden bg-surface-container-lowest shadow-sm max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-container-low border-b border-outline-variant/30 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3.5">Farmer / Specialist</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/20">
                        {filteredFarmers.map((farmer) => {
                          const assignedToCurrentField = existingAssignments.some(
                            (a) => a.fieldId === selectedFieldId && a.farmerUid === farmer.uid && a.status === 'ACTIVE'
                          );

                          return (
                            <tr
                              key={farmer.uid}
                              className={`hover:bg-surface-container-low/60 transition-colors ${
                                assignedToCurrentField ? 'opacity-70 bg-surface-container-low/30' : ''
                              }`}
                            >
                              <td className="py-2.5 px-3.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs shrink-0">
                                    {farmer.name
                                      .split(' ')
                                      .map((w) => w[0])
                                      .join('')
                                      .toUpperCase()
                                      .slice(0, 2) || 'SP'}
                                  </div>
                                  <div>
                                    <div className="font-bold text-on-surface">{farmer.name}</div>
                                    <div className="text-[11px] text-on-surface-variant flex items-center gap-2">
                                      <span>{farmer.email || 'Verified Candidate'}</span>
                                      {farmer.experience && <span>• {farmer.experience}</span>}
                                    </div>
                                    {farmer.skills && farmer.skills.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {farmer.skills.slice(0, 2).map((s) => (
                                          <span
                                            key={s}
                                            className="px-1.5 py-0.2 rounded bg-surface-container text-on-surface text-[9px] font-medium"
                                          >
                                            {s}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex flex-col gap-1 items-start">
                                  <StatusBadge status="APPROVED" />
                                  {assignedToCurrentField && (
                                    <span className="text-[10px] text-amber-800 font-semibold">
                                      Active on this zone
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  disabled={assignedToCurrentField}
                                  onClick={() => handleSelectFarmer(farmer)}
                                  className="h-8 px-3.5 rounded-lg bg-primary hover:bg-secondary text-on-primary font-bold text-xs inline-flex items-center gap-1 cursor-pointer active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <span>Select</span>
                                  <span className="material-symbols-outlined text-[14px]">check</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Permissions Matrix */}
          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-3">
            <span className="text-xs font-bold text-on-surface uppercase tracking-wider block">
              Field-Scoped Role Permissions
            </span>

            <div className="space-y-2.5">
              {AVAILABLE_PERMISSIONS.map((perm) => {
                const checked = permissions.includes(perm.id);
                return (
                  <label
                    key={perm.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/20 hover:border-primary/40 cursor-pointer transition-all"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePermission(perm.id)}
                      className="w-4 h-4 mt-0.5 rounded text-primary focus:ring-primary accent-primary cursor-pointer"
                    />
                    <div className="text-xs">
                      <div className="font-bold text-on-surface">{perm.label}</div>
                      <div className="text-[11px] text-on-surface-variant">{perm.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Section 4: Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/30">
            <Link
              to="/dashboard/assignments"
              className="h-11 px-5 rounded-xl border border-outline-variant/40 hover:bg-surface-container-low text-on-surface font-semibold text-xs transition-colors flex items-center justify-center no-underline"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || fields.length === 0 || !selectedFarmer || isAlreadyAssigned}
              className="h-11 px-6 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              {submitting ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
                  <span>Assigning Specialist...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>Confirm Assignment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
