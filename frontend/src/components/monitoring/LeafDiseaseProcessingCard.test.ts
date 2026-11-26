import { describe, it, expect } from 'vitest';
import { getLeafProcessingPhase } from './LeafDiseaseProcessingCard';
import { validateTelemetryMeasurements, type FormMeasurements } from '../../pages/FarmerFieldDetailsPage';
import { validateCropImageFile } from '../../services/monitoringService';

describe('FarmerFieldDetailsPage & LeafDiseaseProcessingCard regression checks', () => {
  it('returns accurate processing phase messages without fake percentages or premature research claims', () => {
    const uploading = getLeafProcessingPhase('uploading');
    expect(uploading.stepBadge).toContain('Step 1 of 2');
    expect(uploading.title.toLowerCase()).toContain('uploading');
    expect(uploading.title).not.toMatch(/\d+%/);

    const inferring = getLeafProcessingPhase('inferring');
    expect(inferring.stepBadge).toContain('Step 2 of 2');
    expect(inferring.title.toLowerCase()).toContain('disease detection');
    expect(inferring.detail.toLowerCase()).not.toContain('openalex');
    expect(inferring.title).not.toMatch(/\d+%/);
  });

  it('validates all 8 agricultural telemetry inputs accurately', () => {
    const valid: FormMeasurements = {
      n: '90',
      p: '42',
      k: '43',
      temperature: '24.5',
      humidity: '78',
      ph: '6.5',
      rainfall: '150',
      soilMoisture: '45.2',
    };
    expect(validateTelemetryMeasurements(valid)).toEqual({});

    const invalid: FormMeasurements = {
      n: '-1',
      p: '1001',
      k: '',
      temperature: '70',
      humidity: '120',
      ph: '15',
      rainfall: '-5',
      soilMoisture: '105',
    };
    const errors = validateTelemetryMeasurements(invalid);
    expect(Object.keys(errors)).toHaveLength(8);
  });

  it('validates leaf image type (PNG/JPEG) and 8 MiB maximum file size', () => {
    const validJpg = new File([new Uint8Array(1024)], 'leaf.jpg', { type: 'image/jpeg' });
    expect(validateCropImageFile(validJpg)).toBeNull();

    const validPng = new File([new Uint8Array(1024)], 'leaf.png', { type: 'image/png' });
    expect(validateCropImageFile(validPng)).toBeNull();

    const invalidType = new File([new Uint8Array(1024)], 'leaf.gif', { type: 'image/gif' });
    expect(validateCropImageFile(invalidType)).toBeTruthy();

    const oversized = new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'huge.jpg', {
      type: 'image/jpeg',
    });
    expect(validateCropImageFile(oversized)).toBeTruthy();
  });
});
