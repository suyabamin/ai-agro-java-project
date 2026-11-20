import React, { useState, useEffect, useCallback } from 'react';
import { fieldService } from '../../services/fieldService';
import type { Field } from '../../types/field';
import type { FarmRole } from '../../types/farm';
import { CreateFieldModal } from './CreateFieldModal';
import { EditFieldModal } from './EditFieldModal';
import { FieldAssignmentsSection } from '../assignment/FieldAssignmentsSection';

interface FieldListProps {
  farmId: string;
  userRole?: FarmRole;
  onFieldCountChanged?: () => void;
}

export const FieldList: React.FC<FieldListProps> = ({
  farmId,
  userRole,
  onFieldCountChanged,
}) => {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState<boolean>(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [expandedAssignmentsFieldId, setExpandedAssignmentsFieldId] = useState<string | null>(null);

  const canManage = userRole === 'OWNER' || userRole === 'MANAGER';
  const isOwner = userRole === 'OWNER';

  const loadFields = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fieldService.fetchFields(farmId, includeArchived);
      setFields(resp.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load fields';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [farmId, includeArchived]);

  useEffect(() => {
    loadFields();
  }, [loadFields]);

  const handleArchive = async (field: Field) => {
    if (!isOwner) return;
    if (
      !window.confirm(
        `Are you sure you want to archive field "${field.name}" (${field.localFieldId})? This will decrement the active field count.`
      )
    ) {
      return;
    }

    try {
      await fieldService.archiveField(farmId, field.fieldId, field.version);
      setActionMessage(`Field "${field.name}" archived successfully`);
      loadFields();
      if (onFieldCountChanged) {
        onFieldCountChanged();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to archive field';
      setError(msg);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return { bg: '#D1FAE5', color: '#065F46', text: 'ACTIVE' };
      case 'FALLOW':
        return { bg: '#FEF3C7', color: '#92400E', text: 'FALLOW' };
      case 'PREPARATION':
        return { bg: '#DBEAFE', color: '#1E40AF', text: 'PREPARATION' };
      case 'ARCHIVED':
        return { bg: '#FEE2E2', color: '#991B1B', text: 'ARCHIVED' };
      default:
        return { bg: '#F3F4F6', color: '#4B5563', text: status };
    }
  };

  const getCropEmoji = (crop: string) => {
    switch (crop) {
      case 'RICE':
        return '🌾';
      case 'WHEAT':
        return '🌾';
      case 'MAIZE':
        return '🌽';
      case 'POTATO':
        return '🥔';
      case 'TEA':
        return '🍃';
      case 'JUTE':
        return '🌿';
      case 'VEGETABLES':
        return '🥦';
      default:
        return '🌱';
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '8px',
        border: '1px solid #E5E7EB',
        padding: '24px',
        marginTop: '24px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#1B4332' }}>🌱 Field Management</h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6B7280' }}>
            Manage plots, crop rotations, soil classifications, and acreage under this farm.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#4B5563', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            Show Archived
          </label>

          {canManage && (
            <button
              onClick={() => setCreateModalOpen(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#2D6A4F',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              + Add Field
            </button>
          )}
        </div>
      </div>

      {actionMessage && (
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
          {actionMessage}
        </div>
      )}

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

      {/* Field Cards / Table */}
      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#6B7280' }}>Loading fields...</div>
      ) : fields.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '36px 20px',
            backgroundColor: '#F9FAFB',
            borderRadius: '6px',
            border: '1px dashed #D1D5DB',
          }}
        >
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🌾</div>
          <h4 style={{ margin: '0 0 6px', fontSize: '15px', color: '#111827' }}>No Fields Found</h4>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#6B7280' }}>
            {includeArchived
              ? 'No active or archived fields exist for this farm.'
              : 'This farm currently has no active fields. Add your first field plot to begin tracking.'}
          </p>
          {canManage && (
            <button
              onClick={() => setCreateModalOpen(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#2D6A4F',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Add First Field
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {fields.map((field) => {
            const badge = getStatusBadge(field.status);
            return (
              <div
                key={field.fieldId}
                style={{
                  border: '1px solid #E5E7EB',
                  borderRadius: '6px',
                  padding: '16px',
                  backgroundColor: field.status === 'ARCHIVED' ? '#F9FAFB' : '#FFFFFF',
                  opacity: field.status === 'ARCHIVED' ? 0.75 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#1B4332' }}>
                      {getCropEmoji(field.cropType)} {field.name}
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: badge.bg,
                        color: badge.color,
                        fontWeight: 700,
                      }}
                    >
                      {badge.text}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>
                    Code: <code style={{ backgroundColor: '#F3F4F6', padding: '1px 4px', borderRadius: '3px' }}>{field.localFieldId}</code>
                    {' • '}v{field.version}
                  </div>

                  <div style={{ fontSize: '13px', color: '#374151', marginBottom: '6px' }}>
                    <strong>Area:</strong> {field.areaHectares} ha
                  </div>

                  <div style={{ fontSize: '12px', color: '#4B5563', marginBottom: '4px' }}>
                    <strong>Crop:</strong> {field.cropType}
                    {field.soilType ? ` • Soil: ${field.soilType}` : ''}
                  </div>

                  {field.irrigationType && (
                    <div style={{ fontSize: '12px', color: '#4B5563', marginBottom: '4px' }}>
                      <strong>Irrigation:</strong> {field.irrigationType}
                    </div>
                  )}

                  {field.notes && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#6B7280',
                        fontStyle: 'italic',
                        marginTop: '8px',
                        backgroundColor: '#F9FAFB',
                        padding: '6px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      {field.notes}
                    </div>
                  )}
                </div>

                {canManage && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      marginTop: '14px',
                      paddingTop: '10px',
                      borderTop: '1px solid #F3F4F6',
                    }}
                  >
                    <button
                      onClick={() => {
                        setSelectedField(field);
                        setEditModalOpen(true);
                      }}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #D1D5DB',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#374151',
                        cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>

                    <button
                      onClick={() =>
                        setExpandedAssignmentsFieldId(
                          expandedAssignmentsFieldId === field.fieldId ? null : field.fieldId
                        )
                      }
                      style={{
                        padding: '6px 10px',
                        backgroundColor: expandedAssignmentsFieldId === field.fieldId ? '#D8F3DC' : '#FFFFFF',
                        border: '1px solid #2D6A4F',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#1B4332',
                        cursor: 'pointer',
                      }}
                    >
                      {expandedAssignmentsFieldId === field.fieldId ? 'Hide Farmers' : '👨‍🌾 Farmers'}
                    </button>

                    {isOwner && field.status !== 'ARCHIVED' && (
                      <button
                        onClick={() => handleArchive(field)}
                        style={{
                          padding: '6px 10px',
                          backgroundColor: '#FEE2E2',
                          border: '1px solid #FCA5A5',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#991B1B',
                          cursor: 'pointer',
                        }}
                      >
                        Archive
                      </button>
                    )}
                  </div>
                )}

                {expandedAssignmentsFieldId === field.fieldId && field.status === 'ACTIVE' && (
                  <FieldAssignmentsSection
                    farmId={farmId}
                    fieldId={field.fieldId}
                    fieldName={field.name}
                    canManage={canManage}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <CreateFieldModal
        isOpen={createModalOpen}
        farmId={farmId}
        onClose={() => setCreateModalOpen(false)}
        onCreated={() => {
          loadFields();
          if (onFieldCountChanged) {
            onFieldCountChanged();
          }
        }}
      />

      <EditFieldModal
        isOpen={editModalOpen}
        farmId={farmId}
        field={selectedField}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedField(null);
        }}
        onUpdated={() => {
          loadFields();
          if (onFieldCountChanged) {
            onFieldCountChanged();
          }
        }}
      />
    </div>
  );
};
