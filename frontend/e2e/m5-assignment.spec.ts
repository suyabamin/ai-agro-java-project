import { expect, test } from '@playwright/test';

const farm = {
  farmId: 'farm-m5-e2e', name: 'M5 Test Farm', ownerUid: 'mock-owner-001', district: 'Dhaka', division: 'Dhaka',
  totalAreaHectares: 4, activeFieldCount: 1, visibility: 'PRIVATE', status: 'ACTIVE', version: 1,
  myRole: 'OWNER', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
};
const field = {
  fieldId: 'field-m5-e2e', localFieldId: 'M5-1', farmId: farm.farmId, name: 'M5 North Field', cropType: 'RICE',
  soilType: 'CLAY', irrigationType: 'CANAL', areaHectares: 2, status: 'ACTIVE', version: 1,
};
const response = (data: unknown) => ({ success: true, data, message: 'isolated M5 UI fixture' });

test('M5 owner assigns, releases, reviews history, then creates a distinct tenure', async ({ page }) => {
  let assignments: Array<Record<string, unknown>> = [];
  const history: Record<string, Array<Record<string, unknown>>> = {};
  let tenure = 0;
  await page.route('http://127.0.0.1:8080/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    let data: unknown = [];

    if (path === '/farms' && request.method() === 'GET') data = [farm];
    else if (path === `/farms/${farm.farmId}/fields` && request.method() === 'GET') data = [field];
    else if (path === `/farms/${farm.farmId}/fields/${field.fieldId}/assignments` && request.method() === 'GET') {
      data = { items: assignments, nextCursor: null, hasNext: false, pageSize: 25 };
    } else if (path.endsWith('/assignments') && request.method() === 'POST') {
      tenure += 1;
      const payload = request.postDataJSON() as { farmerUid: string };
      const assignmentId = `asgn-tenure-${tenure}`;
      const record = { assignmentId, farmId: farm.farmId, fieldId: field.fieldId, farmerUid: payload.farmerUid,
        farmerName: 'M5 E2E Farmer', status: 'ACTIVE', version: 1, permissions: ['READ', 'WRITE_LOGS'] };
      assignments = [...assignments, record];
      history[assignmentId] = [{ historyId: `history-${tenure}-assigned`, assignmentId,
        eventType: 'ASSIGNED', performedByUid: 'mock-owner-001', performedByRole: 'OWNER',
        timestamp: '2026-11-18T12:00:00Z', reason: 'M5 UI test' }];
      data = record;
    } else if (path.includes('/assignments/') && path.endsWith('/release') && request.method() === 'POST') {
      const assignmentId = path.split('/').at(-2)!;
      assignments = assignments.map(item => item.assignmentId === assignmentId
        ? { ...item, status: 'RELEASED', version: Number(item.version) + 1 } : item);
      history[assignmentId] = [...(history[assignmentId] || []), { historyId: `${assignmentId}-released`,
        assignmentId, eventType: 'RELEASED', performedByUid: 'mock-owner-001', performedByRole: 'OWNER',
        timestamp: '2026-11-18T13:00:00Z', reason: 'Season completed' }];
      data = assignments.find(item => item.assignmentId === assignmentId);
    } else if (path.includes('/assignments/') && path.endsWith('/history') && request.method() === 'GET') {
      const assignmentId = path.split('/').at(-2)!;
      data = { items: history[assignmentId] || [], nextCursor: null, hasNext: false, pageSize: 25 };
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response(data)) });
  });

  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Sign In as Farm Owner' }).click();
  await expect(page.getByRole('heading', { name: 'Farm Owner Dashboard' })).toBeVisible();
  await expect(page.getByText('M5 North Field').first()).toBeVisible();
  await page.getByRole('button', { name: /Farmers/ }).click();
  await page.getByRole('button', { name: '+ Assign Farmer' }).click();
  await page.getByLabel('Farmer Firebase UID *').fill('farmer-disposable-m5');
  await page.getByRole('button', { name: 'Assign Farmer' }).last().click();
  await expect(page.getByText('M5 E2E Farmer')).toBeVisible();
  await page.getByRole('button', { name: 'Audit History' }).click();
  await expect(page.getByText('ASSIGNED', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    'Assignment history dialog should fit the viewport').toBe(true);
  await page.locator('div[style*="z-index: 1100"] button').first().click();

  await page.getByRole('button', { name: 'Release', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    'Release dialog should fit the viewport').toBe(true);
  await page.getByLabel('Reason for Release (Optional)').fill('Season completed');
  await page.getByRole('button', { name: 'Confirm Release' }).click();
  await expect(page.getByText('RELEASED', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Audit History' }).first().click();
  await expect(page.getByText('RELEASED', { exact: true })).toHaveCount(2);
  await page.locator('div[style*="z-index: 1100"] button').first().click();

  await page.getByRole('button', { name: '+ Assign Farmer' }).click();
  await page.getByLabel('Farmer Firebase UID *').fill('farmer-disposable-m5');
  await page.getByRole('button', { name: 'Assign Farmer' }).last().click();
  await expect(page.getByText('Assigned Farmers (1 Active)')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Audit History' })).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    'Assignment dashboard should not overflow the configured viewport').toBe(true);
  await page.screenshot({ path: test.info().outputPath('m5-assignment-tenures.png'), fullPage: true });
});

test('M5 farmer workspace displays only fixture-assigned fields and retains released tenure history', async ({ page }) => {
  const assigned = { assignmentId: 'asgn-farmer-current', farmId: farm.farmId, fieldId: field.fieldId,
    farmerUid: 'mock-farmer-001', status: 'ACTIVE', permissions: ['READ'], assignedAt: '2026-11-18T12:00:00Z', version: 1 };
  const released = { ...assigned, assignmentId: 'asgn-farmer-ended', status: 'RELEASED',
    releaseReason: 'Season completed', assignedAt: '2026-10-18T12:00:00Z', version: 2 };

  await page.route('http://127.0.0.1:8080/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    let data: unknown = [];
    if (path === '/farmers/me/assignments') data = { items: [assigned], nextCursor: null, hasNext: false, pageSize: 25 };
    else if (path === '/farmers/me/assignments/history') data = { items: [released], nextCursor: null, hasNext: false, pageSize: 25 };
    else if (path === `/farmers/me/fields/${field.fieldId}`) data = field;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response(data)) });
  });

  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Sign In as Farmer' }).click();
  await page.getByRole('button', { name: 'Farmer View' }).click();
  await expect(page.getByRole('heading', { name: 'Farmer Assigned Workspace' })).toBeVisible();
  await expect(page.getByText(field.fieldId, { exact: true })).toBeVisible();
  await expect(page.getByText('unassigned-field-secret', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /View Operational Details/ }).click();
  await expect(page.getByText('OPERATIONAL FIELD INSPECTION')).toBeVisible();
  await expect(page.getByText('M5 North Field (M5-1)')).toBeVisible();
  await page.locator('div[style*="z-index: 1000"] button').first().click();
  await page.getByRole('button', { name: /Assignment History/ }).click();
  await expect(page.getByText('RELEASED', { exact: true })).toBeVisible();
  await expect(page.getByText('Season completed')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Farmer Assigned Workspace' })).toBeVisible();
  await expect(page.getByText(field.fieldId, { exact: true })).toBeVisible();
});
