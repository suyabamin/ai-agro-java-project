import { expect, test, type Page } from '@playwright/test';

const farm = {
  farmId: 'farm-e2e', name: 'Test Farm', ownerUid: 'mock-owner-001', district: 'Dhaka', division: 'Dhaka',
  totalAreaHectares: 4, activeFieldCount: 1, visibility: 'PRIVATE', status: 'ACTIVE', version: 1,
  myRole: 'OWNER', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
};
const field = {
  fieldId: 'field-e2e', localFieldId: 'A-1', farmId: farm.farmId, name: 'North Field', cropType: 'RICE',
  soilType: 'CLAY', irrigationType: 'CANAL', areaHectares: 2, status: 'ACTIVE', version: 1,
};
const envelope = (data: unknown) => ({ success: true, data, message: 'E2E fixture response' });

async function installApiFixtures(page: Page) {
  await page.route('http://127.0.0.1:8080/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const cursor = url.searchParams.get('cursor');
    let data: unknown = [];

    if (path === '/farms' && request.method() === 'GET') data = [farm];
    else if (path === `/farms/${farm.farmId}/fields` && request.method() === 'GET') data = [field];
    else if (path.endsWith('/disease-availability')) data = {
      available: false, status: 'MODEL_UNAVAILABLE', errorCode: 'MODEL_UNAVAILABLE',
      message: 'No trained model has been supplied.',
    };
    else if (path.endsWith('/images') && request.method() === 'GET') data = cursor
      ? { items: [{ id: 'image-2', imageId: 'image-2', originalFilename: 'page-two.png', processingStatus: 'UPLOADED' }], nextCursor: null, hasNext: false, pageSize: 25 }
      : { items: [{ id: 'image-1', imageId: 'image-1', originalFilename: 'leaf-one.png', processingStatus: 'UPLOADED' }], nextCursor: 'image-cursor-2', hasNext: true, pageSize: 25 };
    else if (path.endsWith('/disease-analyses') && request.method() === 'GET') data = cursor
      ? { items: [{ id: 'analysis-2', analysisId: 'analysis-2', status: 'MODEL_UNAVAILABLE' }], nextCursor: null, hasNext: false, pageSize: 25 }
      : { items: [{ id: 'analysis-1', analysisId: 'analysis-1', status: 'MODEL_UNAVAILABLE' }], nextCursor: 'analysis-cursor-2', hasNext: true, pageSize: 25 };
    else if (path.endsWith('/irrigation-plans') && request.method() === 'GET') data = cursor
      ? { items: [{ id: 'plan-2', planId: 'plan-2', recommendationStatus: 'INSUFFICIENT_DATA', status: 'DRAFT', rationale: 'Page two fixture' }], nextCursor: null, hasNext: false, pageSize: 25 }
      : { items: [{ id: 'plan-1', planId: 'plan-1', recommendationStatus: 'INSUFFICIENT_DATA', status: 'DRAFT', rationale: 'No recent soil moisture evidence.' }], nextCursor: 'plan-cursor-2', hasNext: true, pageSize: 25 };
    else if (path.endsWith('/telemetry/latest')) data = [{ id: 'reading-latest', measurementType: 'SOIL_MOISTURE', value: 42, unit: '%', observedAt: '2026-11-18T00:00:00Z', source: 'MANUAL' }];
    else if (path.endsWith('/telemetry') && request.method() === 'GET') data = { items: [], nextCursor: null, hasNext: false, pageSize: 50 };
    else if (path.endsWith('/history')) data = { items: [], nextCursor: null, hasNext: false, pageSize: 25 };
    else if (path.endsWith('/images') && request.method() === 'POST') data = { imageId: 'uploaded-image', status: 'UPLOADED' };
    else if (path.endsWith('/disease-analyses') && request.method() === 'POST') data = { analysisId: 'analysis-new', status: 'MODEL_UNAVAILABLE', predictedClass: null, confidenceScore: null };
    else if (path.endsWith('/telemetry') && request.method() === 'POST') data = { telemetryId: 'reading-new', measurementType: 'SOIL_MOISTURE', value: 38, unit: '%', source: 'MANUAL' };
    else if (path.endsWith('/irrigation-plans') && request.method() === 'POST') data = { planId: 'plan-new', status: 'DRAFT', recommendationStatus: 'INSUFFICIENT_DATA', rationale: 'No recent soil moisture evidence.' };

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(envelope(data)) });
  });
}

test('protected navigation, owner sign-in/out, monitoring workflows and cursor controls', async ({ page }, testInfo) => {
  await installApiFixtures(page);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);

  await page.getByRole('button', { name: 'Sign In as Farm Owner' }).click();
  await expect(page.getByRole('heading', { name: 'Farm Owner Dashboard' })).toBeVisible();
  await page.getByRole('link', { name: 'Monitoring & Telemetry' }).click();
  await expect(page.getByRole('heading', { name: 'Field monitoring' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.locator('.field-monitoring-panel').evaluate(panel => {
    const rowsFit = [...panel.querySelectorAll('.monitoring-record-row')].every(row => row.scrollWidth <= row.clientWidth);
    return panel.scrollWidth <= panel.clientWidth && rowsFit;
  })).toBe(true);
  await expect(page.getByText('Disease detection status: MODEL_UNAVAILABLE. No trained model has been supplied.')).toBeVisible();
  await expect(page.getByText('42 %')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('monitoring-layout.png'), fullPage: true });

  await page.getByLabel('Soil moisture (%)').fill('38');
  await page.getByRole('button', { name: 'Save reading' }).click();
  await expect(page.getByText('Soil reading saved.')).toBeVisible();

  await page.getByLabel('Crop image').setInputFiles({ name: 'leaf.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
  await expect(page.getByText(/Choose a PNG or JPEG file/)).toBeVisible();
  await page.getByLabel('Crop image').setInputFiles({
    name: 'leaf.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=', 'base64'),
  });
  await page.getByRole('button', { name: 'Upload image and check model status' }).click();
  await expect(page.getByText(/Disease detection is unavailable: the trained model has not been supplied/)).toBeVisible();

  await page.getByRole('button', { name: 'Load more images' }).click();
  await expect(page.getByText('page-two.png')).toBeVisible();
  await page.getByRole('button', { name: 'Load more analyses' }).click();
  await expect(page.getByText('Disease analyses (2)')).toBeVisible();
  await page.getByRole('button', { name: 'Create irrigation plan' }).click();
  await expect(page.getByText('Irrigation plan saved.')).toBeVisible();
  await page.getByRole('button', { name: 'Load more irrigation plans' }).click();
  await expect(page.getByText('Irrigation plans (2)')).toBeVisible();

  await page.getByRole('button', { name: 'Sign Out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to AgroAI' })).toBeVisible();
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});
