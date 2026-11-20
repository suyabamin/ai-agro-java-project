import React, { useEffect, useState, useCallback } from 'react';
import { farmService } from '../../services/farmService';
import type { Farm, FarmMember } from '../../types/farm';

interface FarmMembersModalProps {
  isOpen: boolean;
  farm: Farm | null;
  onClose: () => void;
}

export const FarmMembersModal: React.FC<FarmMembersModalProps> = ({ isOpen, farm, onClose }) => {
  const [members, setMembers] = useState<FarmMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New member inputs
  const [targetUserId, setTargetUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'MANAGER' | 'OBSERVER'>('MANAGER');
  const [submitting, setSubmitting] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!farm) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await farmService.fetchFarmMembers(farm.farmId);
      setMembers(resp.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load members';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [farm]);

  useEffect(() => {
    if (isOpen && farm) {
      loadMembers();
      setSuccess(null);
      setError(null);
    }
  }, [isOpen, farm, loadMembers]);

  if (!isOpen || !farm) return null;

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!targetUserId.trim()) {
      setError('Target User ID is required');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await farmService.addFarmMember(farm.farmId, {
        userId: targetUserId.trim(),
        role: selectedRole,
      });
      setSuccess(`Member '${targetUserId.trim()}' successfully granted role ${selectedRole}`);
      setTargetUserId('');
      await loadMembers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add member';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'MANAGER' | 'OBSERVER') => {
    setError(null);
    setSuccess(null);
    try {
      await farmService.updateFarmMemberRole(farm.farmId, userId, { role: newRole });
      setSuccess(`Updated role for ${userId} to ${newRole}`);
      await loadMembers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update member role';
      setError(msg);
    }
  };

  const handleRevoke = async (userId: string) => {
    if (!window.confirm(`Are you sure you want to revoke membership for user ${userId}?`)) {
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      await farmService.removeFarmMember(farm.farmId, userId);
      setSuccess(`Membership revoked for ${userId}`);
      await loadMembers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to revoke member';
      setError(msg);
    }
  };

  const isOwner = farm.myRole === 'OWNER';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '640px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#1B4332' }}>Farm Member Roster</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6B7280' }}>
              {farm.name} ({farm.farmId})
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#6B7280' }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#FEE2E2',
                color: '#991B1B',
                borderRadius: '6px',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#D1FAE5',
                color: '#065F46',
                borderRadius: '6px',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {success}
            </div>
          )}

          {isOwner && (
            <form
              onSubmit={handleAddMember}
              style={{
                padding: '16px',
                backgroundColor: '#F9FAFB',
                borderRadius: '6px',
                marginBottom: '20px',
                border: '1px solid #E5E7EB',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '10px' }}>
                Grant Membership to Existing User
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '8px' }}>
                <input
                  type="text"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  placeholder="Target User UID"
                  required
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '13px',
                  }}
                />
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as 'MANAGER' | 'OBSERVER')}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '13px',
                  }}
                >
                  <option value="MANAGER">MANAGER</option>
                  <option value="OBSERVER">OBSERVER</option>
                </select>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#2D6A4F',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  {submitting ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          )}

          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
              Members ({members.length})
            </div>

            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280', fontSize: '13px' }}>
                Loading member roster...
              </div>
            ) : members.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280', fontSize: '13px' }}>
                No members found.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {members.map((m) => (
                  <div
                    key={m.membershipId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 14px',
                      backgroundColor: m.status === 'REVOKED' ? '#F9FAFB' : '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      borderRadius: '6px',
                      opacity: m.status === 'REVOKED' ? 0.6 : 1,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937' }}>
                        UID: {m.userId}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>
                        Status: <strong style={{ color: m.status === 'ACTIVE' ? '#059669' : '#DC2626' }}>{m.status}</strong>
                        {' • '}Added: {new Date(m.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          backgroundColor:
                            m.role === 'OWNER' ? '#FEF3C7' : m.role === 'MANAGER' ? '#DBEAFE' : '#F3F4F6',
                          color:
                            m.role === 'OWNER' ? '#92400E' : m.role === 'MANAGER' ? '#1E40AF' : '#374151',
                          fontWeight: 700,
                        }}
                      >
                        {m.role}
                      </span>

                      {isOwner && m.role !== 'OWNER' && m.status === 'ACTIVE' && (
                        <>
                          <button
                            onClick={() =>
                              handleRoleChange(m.userId, m.role === 'MANAGER' ? 'OBSERVER' : 'MANAGER')
                            }
                            style={{
                              fontSize: '11px',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: '1px solid #D1D5DB',
                              backgroundColor: '#FFFFFF',
                              cursor: 'pointer',
                            }}
                          >
                            Set to {m.role === 'MANAGER' ? 'OBSERVER' : 'MANAGER'}
                          </button>
                          <button
                            onClick={() => handleRevoke(m.userId)}
                            style={{
                              fontSize: '11px',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: '1px solid #FCA5A5',
                              backgroundColor: '#FEE2E2',
                              color: '#991B1B',
                              cursor: 'pointer',
                            }}
                          >
                            Revoke
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #E5E7EB',
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: '#F9FAFB',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              color: '#374151',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
