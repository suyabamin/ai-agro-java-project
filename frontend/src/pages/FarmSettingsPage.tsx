import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { farmService } from '../services/farmService';
import type { FarmMember, FarmVisibility } from '../types/farm';
import { StatusBadge } from '../components/ui/StatusBadge';

export const FarmSettingsPage: React.FC = () => {
  const { activeFarm, updateFarm, updateVisibility, archiveFarm, refreshFarms } = useFarm();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [division, setDivision] = useState('');
  const [district, setDistrict] = useState('');
  const [detailedAddress, setDetailedAddress] = useState('');
  const [totalAreaHectares, setTotalAreaHectares] = useState<number>(0);
  const [visibility, setVisibility] = useState<FarmVisibility>('PRIVATE');

  const [members, setMembers] = useState<FarmMember[]>([]);
  const [newMemberUid, setNewMemberUid] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'MANAGER' | 'OBSERVER'>('MANAGER');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeFarm) {
      setName(activeFarm.name);
      setDescription(activeFarm.description || '');
      setDivision(activeFarm.division);
      setDistrict(activeFarm.district);
      setDetailedAddress(activeFarm.detailedAddress || '');
      setTotalAreaHectares(activeFarm.totalAreaHectares || 0);
      setVisibility(activeFarm.visibility);

      // Load members
      farmService.fetchFarmMembers(activeFarm.farmId).then((res) => {
        setMembers(res.data || []);
      }).catch(console.warn);
    }
  }, [activeFarm]);

  if (!activeFarm) {
    return (
      <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
        <h2 className="text-base font-bold text-on-surface">No Farm Selected</h2>
        <p className="text-xs text-on-surface-variant mt-1 mb-4">Select or register a farm to view its settings.</p>
        <Link to="/dashboard/farms" className="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold">
          Go to My Farms
        </Link>
      </div>
    );
  }

  const isOwner = activeFarm.myRole === 'OWNER';

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;

    try {
      setSaving(true);
      setError(null);
      setMessage(null);
      await updateFarm(activeFarm.farmId, {
        name,
        description: description || undefined,
        division,
        district,
        detailedAddress: detailedAddress || undefined,
        totalAreaHectares,
        expectedVersion: activeFarm.version,
      });

      if (visibility !== activeFarm.visibility) {
        await updateVisibility(activeFarm.farmId, {
          visibility,
          expectedVersion: activeFarm.version + 1,
        });
      }

      await refreshFarms();
      setMessage('Farm settings and metadata updated successfully.');
      setTimeout(() => setMessage(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update farm settings');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberUid.trim() || !isOwner) return;

    try {
      setLoading(true);
      setError(null);
      await farmService.addFarmMember(activeFarm.farmId, {
        userId: newMemberUid.trim(),
        role: newMemberRole,
      });
      const res = await farmService.fetchFarmMembers(activeFarm.farmId);
      setMembers(res.data || []);
      setNewMemberUid('');
      setMessage(`Member granted ${newMemberRole} role successfully.`);
      setTimeout(() => setMessage(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add farm member');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!window.confirm('Remove this member from the farm holding?')) return;
    try {
      await farmService.removeFarmMember(activeFarm.farmId, userId);
      setMembers(members.filter((m) => m.userId !== userId));
      setMessage('Member removed.');
      setTimeout(() => setMessage(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const handleArchive = async () => {
    if (!window.confirm(`Are you sure you want to archive farm "${activeFarm.name}"?`)) return;
    try {
      await archiveFarm(activeFarm.farmId, activeFarm.version);
      navigate('/dashboard/farms');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to archive farm');
    }
  };

  return (
    <div className="w-full max-w-[1000px] mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Farm Governance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
            Farm Settings & Labor Administration
          </h1>
        </div>
        <StatusBadge status={activeFarm.visibility} />
      </div>

      {message && (
        <div className="p-3.5 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-error-container text-error text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Farm Metadata Card */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30">
        <h2 className="text-lg font-bold text-on-surface mb-1">General Holding Metadata</h2>
        <p className="text-xs text-on-surface-variant mb-6">
          Update farm geographic credentials and commercial visibility settings.
        </p>

        <form onSubmit={handleSaveMetadata} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface">Farm Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isOwner}
              required
              className="w-full h-11 px-4 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none border border-transparent disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface">Division</label>
              <input
                type="text"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                disabled={!isOwner}
                required
                className="w-full h-11 px-4 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none border border-transparent disabled:opacity-60"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface">District / Upazila</label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                disabled={!isOwner}
                required
                className="w-full h-11 px-4 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none border border-transparent disabled:opacity-60"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface">Total Area (Hectares)</label>
              <input
                type="number"
                step="0.1"
                value={totalAreaHectares}
                onChange={(e) => setTotalAreaHectares(parseFloat(e.target.value) || 0)}
                disabled={!isOwner}
                required
                className="w-full h-11 px-4 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none border border-transparent disabled:opacity-60"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface">Marketplace Visibility</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as FarmVisibility)}
                disabled={!isOwner}
                className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none border border-transparent disabled:opacity-60 cursor-pointer"
              >
                <option value="PRIVATE">Private</option>
                <option value="PUBLIC">Public (Directory Listing)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface">Detailed Address</label>
            <input
              type="text"
              value={detailedAddress}
              onChange={(e) => setDetailedAddress(e.target.value)}
              disabled={!isOwner}
              className="w-full h-11 px-4 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none border border-transparent disabled:opacity-60"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface">Farm Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!isOwner}
              className="w-full p-3 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none border border-transparent disabled:opacity-60"
            />
          </div>

          {isOwner && (
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="h-10 px-5 rounded-lg bg-primary hover:bg-secondary text-on-primary font-bold text-xs shadow-sm transition-all disabled:opacity-60 cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Farm Changes'}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Farm Membership Administration */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 space-y-4">
        <h2 className="text-lg font-bold text-on-surface">Farm Team & Membership</h2>
        <p className="text-xs text-on-surface-variant">
          Grant MANAGER or OBSERVER privileges to collaborate on field telemetry and work assignments.
        </p>

        {isOwner && (
          <form onSubmit={handleAddMember} className="flex flex-col sm:flex-row gap-3 p-4 rounded-xl bg-surface-container-low border border-outline-variant/30">
            <input
              type="text"
              value={newMemberUid}
              onChange={(e) => setNewMemberUid(e.target.value)}
              placeholder="Enter User UID (from user profile)"
              required
              className="flex-1 h-10 px-3 rounded-lg bg-surface-container-lowest text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-transparent"
            />
            <select
              value={newMemberRole}
              onChange={(e) => setNewMemberRole(e.target.value as 'MANAGER' | 'OBSERVER')}
              className="h-10 px-3 rounded-lg bg-surface-container-lowest text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-transparent"
            >
              <option value="MANAGER">MANAGER</option>
              <option value="OBSERVER">OBSERVER</option>
            </select>
            <button
              type="submit"
              disabled={loading}
              className="h-10 px-4 rounded-lg bg-primary text-on-primary font-bold text-xs shadow-sm cursor-pointer"
            >
              Add Member
            </button>
          </form>
        )}

        <div className="divide-y divide-outline-variant/20">
          {members.map((m) => (
            <div key={m.userId} className="py-3 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-on-surface">{m.userId}</span>
                <span className="ml-2 text-on-surface-variant text-[11px]">(Member)</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={m.role} />
                {isOwner && m.role !== 'OWNER' && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(m.userId)}
                    className="p-1 text-error hover:bg-error-container/40 rounded cursor-pointer"
                    title="Remove Member"
                  >
                    <span className="material-symbols-outlined text-[16px]">person_remove</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      {isOwner && (
        <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-error/30">
          <h2 className="text-base font-bold text-error">Danger Zone</h2>
          <p className="text-xs text-on-surface-variant mt-1 mb-4 leading-relaxed">
            Archiving this farm will remove it from the public directory and disable active field operations. Existing telemetry logs and audit trails remain preserved.
          </p>
          <button
            type="button"
            onClick={handleArchive}
            className="h-10 px-4 rounded-lg bg-error-container text-error hover:bg-error hover:text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Archive This Farm Holding
          </button>
        </div>
      )}
    </div>
  );
};
