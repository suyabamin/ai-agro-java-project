import React, { useState } from 'react';
import { assignmentService } from '../../services/assignmentService';
import type { CreateAssignmentPayload, FieldAssignment } from '../../types/assignment';

interface AssignFarmerModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  fieldId: string;
  fieldName: string;
  onSuccess: (newAssignment: FieldAssignment) => void;
}

export const AssignFarmerModal: React.FC<AssignFarmerModalProps> = ({
  isOpen,
  onClose,
  farmId,
  fieldId,
  fieldName,
  onSuccess,
}) => {
  const [farmerUid, setFarmerUid] = useState('');
  const [sourceApplicationId, setSourceApplicationId] = useState('');
  const [permissions, setPermissions] = useState<string[]>(['READ', 'WRITE_LOGS']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const togglePermission = (perm: string) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmerUid.trim()) {
      setError('Farmer UID is required');
      return;
    }

    setLoading(true);
    setError(null);

    const payload: CreateAssignmentPayload = {
      farmerUid: farmerUid.trim(),
      permissions,
      sourceApplicationId: sourceApplicationId.trim() || null,
    };

    try {
      const resp = await assignmentService.createAssignment(farmId, fieldId, payload);
      if (resp.data) {
        onSuccess(resp.data);
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to assign farmer';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

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
          width: '480px',
          maxWidth: '90%',
          padding: '24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#1B4332' }}>
            Assign Farmer to {fieldName}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#6B7280',
            }}
          >
            ×
          </button>
        </div>

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

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="assignment-farmer-uid" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
              Farmer Firebase UID *
            </label>
            <input
              id="assignment-farmer-uid"
              type="text"
              value={farmerUid}
              onChange={(e) => setFarmerUid(e.target.value)}
              placeholder="e.g. user_farmer_12345"
              required
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #D1D5DB',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
              Linked Application ID (Optional)
            </label>
            <input
              type="text"
              value={sourceApplicationId}
              onChange={(e) => setSourceApplicationId(e.target.value)}
              placeholder="e.g. app_job-123::uid_farmer"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #D1D5DB',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
            <span style={{ fontSize: '11px', color: '#6B7280' }}>
              Candidate must already be in APPROVED status.
            </span>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              Granted Operational Permissions
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {['READ', 'WRITE_LOGS'].map((perm) => (
                <button
                  type="button"
                  key={perm}
                  onClick={() => togglePermission(perm)}
                  style={{
                    padding: '6px 10px',
                    fontSize: '12px',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: permissions.includes(perm) ? '#2D6A4F' : '#D1D5DB',
                    backgroundColor: permissions.includes(perm) ? '#D8F3DC' : '#FFFFFF',
                    color: permissions.includes(perm) ? '#1B4332' : '#6B7280',
                    cursor: 'pointer',
                    fontWeight: permissions.includes(perm) ? 600 : 400,
                  }}
                >
                  {permissions.includes(perm) ? '✓ ' : '+ '}
                  {perm}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '8px 14px',
                border: '1px solid #D1D5DB',
                backgroundColor: '#FFFFFF',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '8px 16px',
                border: 'none',
                backgroundColor: '#2D6A4F',
                color: '#FFFFFF',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Assigning...' : 'Assign Farmer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
