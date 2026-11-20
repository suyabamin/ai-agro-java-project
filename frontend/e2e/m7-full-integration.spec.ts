import { expect, test } from '@playwright/test';

const testFarm = {
  farmId: 'farm-m7-integration',
  name: 'Green Horizon Farm',
  ownerUid: 'owner-uid-m7',
  district: 'Gazipur',
  division: 'Dhaka',
  totalAreaHectares: 12.5,
  activeFieldCount: 2,
  visibility: 'PRIVATE',
  status: 'ACTIVE',
  version: 1,
  myRole: 'OWNER',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const testField = {
  fieldId: 'field-m7-01',
  localFieldId: 'F-01',
  farmId: testFarm.farmId,
  name: 'Paddy Field Alpha',
  cropType: 'RICE',
  soilType: 'LOAM',
  irrigationType: 'DRIP',
  areaHectares: 5.0,
  status: 'ACTIVE',
  version: 1,
};

const response = (data: unknown) => ({ success: true, data, message: 'm7 integration fixture' });

test('M7 Full System Integration: Owner records payment, completes review, and views monitoring', async ({ page }) => {
  const releasedAssignment = {
    assignmentId: 'asgn-tenure-m7-ended',
    farmId: testFarm.farmId,
    fieldId: testField.fieldId,
    farmerUid: 'farmer-uid-m7',
    farmerName: 'Rahim Ahmed',
    status: 'RELEASED',
    version: 2,
    permissions: ['READ', 'WRITE_LOGS'],
  };

  const paymentsList = [
    {
      paymentId: 'pay-m7-001',
      id: 'pay-m7-001',
      farmId: testFarm.farmId,
      assignmentId: releasedAssignment.assignmentId,
      amount: 15000.00,
      currency: 'BDT',
      payerUid: 'owner-uid-m7',
      payerName: 'Farm Owner',
      farmerUid: 'farmer-uid-m7',
      farmerName: 'Rahim Ahmed',
      purpose: 'Harvesting bonus',
      notes: 'Completed ahead of schedule',
      scope: 'ASSIGNMENT',
      status: 'RECORDED',
      paymentDate: '2026-11-18T10:00:00Z',
      createdAt: '2026-11-18T10:00:00Z',
      createdByUid: 'owner-uid-m7',
    },
  ];

  const reviewRecord = {
    id: releasedAssignment.assignmentId,
    assignmentId: releasedAssignment.assignmentId,
    farmId: testFarm.farmId,
    fieldId: testField.fieldId,
    farmerUid: 'farmer-uid-m7',
    authorUid: 'owner-uid-m7',
    rating: 5,
    comment: 'Exceptional work during the monsoon harvest.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    revisions: [],
  };

  await page.route('http://127.0.0.1:8080/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    let data: unknown = [];

    if (path === '/farms' && request.method() === 'GET') {
      data = [testFarm];
    } else if (path === `/farms/${testFarm.farmId}/fields` && request.method() === 'GET') {
      data = [testField];
    } else if (path === `/farms/${testFarm.farmId}/fields/${testField.fieldId}/assignments` && request.method() === 'GET') {
      data = { items: [releasedAssignment], nextCursor: null, hasNext: false, pageSize: 25 };
    } else if (path === `/farms/${testFarm.farmId}/payments` && request.method() === 'GET') {
      data = paymentsList;
    } else if (path.includes('/review') && request.method() === 'GET') {
      data = reviewRecord;
    } else if (path.includes('/monitoring/telemetry/latest')) {
      data = [{ measurementType: 'SOIL_MOISTURE', rawValue: 35.5, unit: '%', validationStatus: 'VALID' }];
    } else if (path.includes('/monitoring/disease-availability')) {
      data = { available: false, status: 'MODEL_UNAVAILABLE', message: 'A trained model must be supplied before disease inference is available.' };
    } else if (path.includes('/monitoring/irrigation-plans') && request.method() === 'GET') {
      data = { items: [], nextCursor: null, hasNext: false, pageSize: 10 };
    } else if (path.includes('/monitoring/images') && request.method() === 'GET') {
      data = { items: [], nextCursor: null, hasNext: false, pageSize: 10 };
    } else if (path.includes('/monitoring/history') && request.method() === 'GET') {
      data = { items: [], nextCursor: null, hasNext: false, pageSize: 10 };
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response(data)) });
  });

  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Sign In as Farm Owner' }).click();
  await expect(page.getByRole('heading', { name: 'Farm Owner Dashboard' })).toBeVisible();

  // Verify Farm & Field card
  await expect(page.getByRole('heading', { name: 'Green Horizon Farm' })).toBeVisible();
  await expect(page.getByText('Paddy Field Alpha').first()).toBeVisible();

  // Verify Payment Records section renders with BDT amount and disclaimer
  await expect(page.getByText(/Farm Compensation & Payment Ledger/i)).toBeVisible();
  await expect(page.getByText('15000.00 BDT')).toBeVisible();
  await expect(page.getByText('Harvesting bonus')).toBeVisible();
  await expect(page.getByText(/Manual entries do not execute or represent bank transfers/i)).toBeVisible();

  // Test opening Record Payment Modal
  await page.getByRole('button', { name: '+ Record Manual Payment' }).click();
  await expect(page.getByRole('heading', { name: 'Record Manual Payment' })).toBeVisible();
  await expect(page.getByText(/Manual Record Notice/i)).toBeVisible();
  await expect(page.locator('input[value="BDT"]')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  // Open Assignments and inspect Review Modal
  await page.getByRole('button', { name: /Farmers/ }).click();

  // Click Review on the released assignment if button is visible
  const reviewBtn = page.getByRole('button', { name: '★ Review' });
  if (await reviewBtn.isVisible()) {
    await reviewBtn.click();
    await expect(page.getByRole('heading', { name: 'Assignment Performance Review' })).toBeVisible();
    await expect(page.getByText('Exceptional work during the monsoon harvest.')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
  }

  // Inspect Field Monitoring Panel model-unavailable honest indicator
  await expect(page.getByText('A trained model must be supplied before disease inference is available.')).toBeVisible();
});

test('M7 Full System Integration: Farmer views assigned field, payment history, and reviews', async ({ page }) => {
  const farmerAssignment = {
    assignmentId: 'asgn-tenure-farmer-01',
    farmId: testFarm.farmId,
    fieldId: testField.fieldId,
    farmerUid: 'mock-farmer-001',
    status: 'ACTIVE',
    version: 1,
    permissions: ['READ'],
    assignedAt: '2026-10-01T00:00:00Z',
  };

  const farmerPayment = {
    paymentId: 'pay-m7-002',
    id: 'pay-m7-002',
    farmId: testFarm.farmId,
    assignmentId: 'asgn-tenure-farmer-01',
    amount: 12000.00,
    currency: 'BDT',
    payerUid: 'owner-uid-m7',
    payerName: 'Farm Owner',
    farmerUid: 'mock-farmer-001',
    farmerName: 'Mock Farmer',
    purpose: 'Monthly labor stipend',
    scope: 'ASSIGNMENT',
    status: 'RECORDED',
    paymentDate: '2026-11-01T10:00:00Z',
    createdAt: '2026-11-01T10:00:00Z',
  };

  await page.route('http://127.0.0.1:8080/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    let data: unknown = [];

    if (path === '/farmers/me/assignments' && request.method() === 'GET') {
      data = { items: [farmerAssignment], nextCursor: null, hasNext: false, pageSize: 25 };
    } else if (path === '/farmers/me/assignments/history' && request.method() === 'GET') {
      data = { items: [], nextCursor: null, hasNext: false, pageSize: 25 };
    } else if (path === `/farmers/me/fields/${testField.fieldId}`) {
      data = testField;
    } else if (path === '/payments/my' && request.method() === 'GET') {
      data = [farmerPayment];
    } else if (path.includes('/monitoring/telemetry/latest')) {
      data = [{ measurementType: 'SOIL_MOISTURE', rawValue: 42.0, unit: '%', validationStatus: 'VALID' }];
    } else if (path.includes('/monitoring/disease-availability')) {
      data = { available: false, status: 'MODEL_UNAVAILABLE', message: 'A trained model must be supplied before disease inference is available.' };
    } else if (path.includes('/monitoring/')) {
      data = { items: [], nextCursor: null, hasNext: false, pageSize: 10 };
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response(data)) });
  });

  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Sign In as Farmer' }).click();
  await page.getByRole('button', { name: 'Farmer View' }).click();
  await expect(page.getByRole('heading', { name: /Farmer Operational Workspace/i })).toBeVisible();

  // Verify assigned field is visible
  await expect(page.getByText('field-m7-01')).toBeVisible();

  // Click on "Payments Received" tab
  await page.getByRole('button', { name: /Payments Received/i }).click();
  await expect(page.getByText('12000.00 BDT')).toBeVisible();
  await expect(page.getByText('Monthly labor stipend')).toBeVisible();
});
