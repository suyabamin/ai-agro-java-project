import React, { useState } from 'react';
import { useFarm } from '../../context/FarmContext';
import type { FarmVisibility } from '../../types/farm';

interface CreateFarmModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateFarmModal: React.FC<CreateFarmModalProps> = ({ isOpen, onClose }) => {
  const { createFarm } = useFarm();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [division, setDivision] = useState('Dhaka');
  const [district, setDistrict] = useState('');
  const [detailedAddress, setDetailedAddress] = useState('');
  const [totalAreaHectares, setTotalAreaHectares] = useState<number>(5.0);
  const [visibility, setVisibility] = useState<FarmVisibility>('PRIVATE');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim()) {
      setError('Farm name is required');
      return;
    }
    if (!district.trim()) {
      setError('District is required');
      return;
    }
    if (totalAreaHectares <= 0) {
      setError('Total area must be greater than 0');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createFarm({
        name: name.trim(),
        description: description.trim() || undefined,
        division: division.trim(),
        district: district.trim(),
        detailedAddress: detailedAddress.trim() || undefined,
        totalAreaHectares,
        visibility,
      });
      onClose();
      // Reset form
      setName('');
      setDescription('');
      setDistrict('');
      setDetailedAddress('');
      setTotalAreaHectares(5.0);
      setVisibility('PRIVATE');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register farm';
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
          maxWidth: '540px',
          padding: '28px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#1B4332' }}>Register New Farm</h3>
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
              Farm Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Green Valley Farm"
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Division *
              </label>
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              >
                <option value="Dhaka">Dhaka</option>
                <option value="Chittagong">Chittagong</option>
                <option value="Rajshahi">Rajshahi</option>
                <option value="Khulna">Khulna</option>
                <option value="Barisal">Barisal</option>
                <option value="Sylhet">Sylhet</option>
                <option value="Rangpur">Rangpur</option>
                <option value="Mymensingh">Mymensingh</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                District *
              </label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="e.g. Gazipur"
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Total Area (Hectares) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={totalAreaHectares}
                onChange={(e) => setTotalAreaHectares(parseFloat(e.target.value) || 0)}
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

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Visibility *
              </label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as FarmVisibility)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              >
                <option value="PRIVATE">Private (Restricted to members)</option>
                <option value="PUBLIC">Public (Discoverable in directory)</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
              Detailed Address
            </label>
            <input
              type="text"
              value={detailedAddress}
              onChange={(e) => setDetailedAddress(e.target.value)}
              placeholder="Village, Upazila / Postal Code"
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

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief details about the farm, facilities, and crops..."
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '8px 16px',
                backgroundColor: '#F3F4F6',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                color: '#374151',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '8px 18px',
                backgroundColor: '#2D6A4F',
                border: 'none',
                borderRadius: '6px',
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                color: '#FFFFFF',
              }}
            >
              {submitting ? 'Registering...' : 'Register Farm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
