import React, { useState } from 'react';
import { fieldService } from '../../services/fieldService';
import type { CropType, SoilType, IrrigationType, FieldStatus } from '../../types/field';

interface CreateFieldModalProps {
  isOpen: boolean;
  farmId: string;
  onClose: () => void;
  onCreated: () => void;
}

const CROP_OPTIONS: CropType[] = [
  'RICE',
  'WHEAT',
  'JUTE',
  'MAIZE',
  'POTATO',
  'TEA',
  'VEGETABLES',
  'OTHER',
];

const SOIL_OPTIONS: SoilType[] = [
  'CLAY',
  'SANDY',
  'LOAMY',
  'SILTY',
  'PEATY',
  'CHALKY',
];

const IRRIGATION_OPTIONS: IrrigationType[] = [
  'RAIN_FED',
  'CANAL',
  'DRIP',
  'SPRINKLER',
  'GROUNDWATER_TUBEWELL',
];

const STATUS_OPTIONS: FieldStatus[] = ['ACTIVE', 'FALLOW', 'PREPARATION'];

export const CreateFieldModal: React.FC<CreateFieldModalProps> = ({
  isOpen,
  farmId,
  onClose,
  onCreated,
}) => {
  const [localFieldId, setLocalFieldId] = useState('');
  const [name, setName] = useState('');
  const [cropType, setCropType] = useState<CropType>('RICE');
  const [soilType, setSoilType] = useState<SoilType | ''>('LOAMY');
  const [irrigationType, setIrrigationType] = useState<IrrigationType | ''>('GROUNDWATER_TUBEWELL');
  const [areaHectares, setAreaHectares] = useState<number>(1.5);
  const [status, setStatus] = useState<FieldStatus>('ACTIVE');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const trimmedLocalId = localFieldId.trim();
    const trimmedName = name.trim();

    if (!trimmedLocalId) {
      setError('Local Field ID is required');
      return;
    }

    if (!/^[a-zA-Z0-9-]{1,21}$/.test(trimmedLocalId)) {
      setError('Local Field ID must be 1-21 characters and contain only letters, numbers, and hyphens');
      return;
    }

    if (!trimmedName) {
      setError('Field name is required');
      return;
    }

    if (areaHectares <= 0) {
      setError('Field area must be greater than 0');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await fieldService.createField(farmId, {
        localFieldId: trimmedLocalId,
        name: trimmedName,
        cropType,
        soilType: (soilType as SoilType) || undefined,
        irrigationType: (irrigationType as IrrigationType) || undefined,
        areaHectares,
        status,
        notes: notes.trim() || undefined,
      });

      // Reset
      setLocalFieldId('');
      setName('');
      setCropType('RICE');
      setSoilType('LOAMY');
      setIrrigationType('GROUNDWATER_TUBEWELL');
      setAreaHectares(1.5);
      setStatus('ACTIVE');
      setNotes('');

      onCreated();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create field';
      setError(msg);
    } finally {
      setSubmitting(false);
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
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '28px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#1B4332' }}>Add New Field</h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6B7280' }}>
              Create a managed plot under farm <code>{farmId}</code>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#6B7280' }}
          >
            ✕
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Local Field ID *
              </label>
              <input
                type="text"
                value={localFieldId}
                onChange={(e) => setLocalFieldId(e.target.value)}
                placeholder="e.g. plot-north-01"
                maxLength={21}
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: '11px', color: '#6B7280' }}>1-21 characters: a-z, 0-9, hyphen</span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Field Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. North Paddy Block A"
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Primary Crop *
              </label>
              <select
                value={cropType}
                onChange={(e) => setCropType(e.target.value as CropType)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: '#FFFFFF',
                  boxSizing: 'border-box',
                }}
              >
                {CROP_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Area (Hectares) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={areaHectares}
                onChange={(e) => setAreaHectares(parseFloat(e.target.value) || 0)}
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Soil Type
              </label>
              <select
                value={soilType}
                onChange={(e) => setSoilType(e.target.value as SoilType | '')}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: '#FFFFFF',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">None / Unspecified</option>
                {SOIL_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Irrigation System
              </label>
              <select
                value={irrigationType}
                onChange={(e) => setIrrigationType(e.target.value as IrrigationType | '')}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: '#FFFFFF',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">None / Unspecified</option>
                {IRRIGATION_OPTIONS.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
              Initial Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as FieldStatus)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: '#FFFFFF',
                boxSizing: 'border-box',
              }}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
              Agronomic Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. High nitrogen fertilizer applied in March; prone to mild waterlogging."
              rows={3}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '8px 16px',
                backgroundColor: '#F3F4F6',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '13px',
                color: '#374151',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '8px 20px',
                backgroundColor: submitting ? '#9CA3AF' : '#2D6A4F',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '13px',
                color: '#FFFFFF',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Creating Plot...' : 'Create Field'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
