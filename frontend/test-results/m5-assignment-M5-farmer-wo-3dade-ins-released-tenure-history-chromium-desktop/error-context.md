# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: m5-assignment.spec.ts >> M5 farmer workspace displays only fixture-assigned fields and retains released tenure history
- Location: e2e\m5-assignment.spec.ts:90:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Sign In as Farmer' })

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e5]:
      - link "psychiatry AgroAI Enterprise Precision Agriculture Platform" [ref=e6] [cursor=pointer]:
        - /url: /
        - generic [ref=e7]: psychiatry
        - generic [ref=e9]:
          - generic [ref=e10]:
            - generic [ref=e11]: AgroAI
            - generic [ref=e12]: Enterprise
          - generic [ref=e13]: Precision Agriculture Platform
      - navigation [ref=e14]:
        - link "Overview" [ref=e15] [cursor=pointer]:
          - /url: /
        - link "Farms" [ref=e16] [cursor=pointer]:
          - /url: /explore
        - link "Jobs & Labor" [ref=e17] [cursor=pointer]:
          - /url: /jobs
        - link "About" [ref=e18] [cursor=pointer]:
          - /url: /about
      - generic [ref=e19]:
        - generic [ref=e22]:
          - text: "Mesh Status:"
          - strong [ref=e23]: 148 Nodes
        - generic [ref=e24]:
          - link "Sign In" [ref=e25] [cursor=pointer]:
            - /url: /login
          - link "Register" [ref=e26] [cursor=pointer]:
            - /url: /register
  - main [ref=e27]:
    - generic [ref=e28]:
      - generic [ref=e29]:
        - generic [ref=e30]:
          - generic [ref=e34]: AgroAI Multi-Tenant Gateway v4.12
          - generic [ref=e35]: •
          - generic [ref=e36]: 256-Bit Encrypted Telemetry Link
        - generic [ref=e37]:
          - generic [ref=e38]:
            - generic [ref=e39]: sensors
            - generic [ref=e40]:
              - text: "Mesh Status:"
              - strong [ref=e41]: 148 Nodes Active
          - generic [ref=e42]:
            - generic [ref=e43]: satellite_alt
            - generic [ref=e44]:
              - text: "Sentinel-2 Orbit Sync:"
              - strong [ref=e45]: 18m ago
      - generic [ref=e46]:
        - generic [ref=e48]:
          - generic [ref=e50]:
            - generic [ref=e51]:
              - generic [ref=e52]: shield
              - text: Workspace Identity
            - generic [ref=e53]: Precision Agronomic Intelligence
          - heading "Sign In to Your Workspace" [level=1] [ref=e54]
          - paragraph [ref=e55]: Access real-time in-situ telemetry, crop disease diagnostics, and automated irrigation management.
          - generic [ref=e56]:
            - generic [ref=e57]:
              - generic [ref=e58]:
                - generic [ref=e59]: Work / Farm Operations Email
                - generic [ref=e60]: SSO Auto-Detect
              - generic [ref=e61]:
                - generic: corporate_fare
                - textbox "Work / Farm Operations Email SSO Auto-Detect" [ref=e62]:
                  - /placeholder: e.g., elena.vance@greenvalleyranch.com
            - generic [ref=e63]:
              - generic [ref=e64]:
                - generic [ref=e65]: Password
                - link "Forgot Password?" [ref=e66] [cursor=pointer]:
                  - /url: /forgot-password
              - generic [ref=e67]:
                - generic: key
                - textbox "Password" [ref=e68]:
                  - /placeholder: Enter your security credential
                - button "Toggle password visibility" [ref=e69] [cursor=pointer]:
                  - generic [ref=e70]: visibility
            - generic [ref=e71]:
              - checkbox "Keep me signed in on this device" [ref=e72] [cursor=pointer]
              - generic [ref=e73] [cursor=pointer]: Keep me signed in on this device
            - button "Sign In to AgroAI arrow_forward" [ref=e74] [cursor=pointer]:
              - generic [ref=e75]: Sign In to AgroAI
              - generic [ref=e76]: arrow_forward
            - generic [ref=e77]: Development & Enterprise Sign-In
            - generic [ref=e81]:
              - button "warehouse Owner Workspace Demo" [ref=e82] [cursor=pointer]:
                - generic [ref=e83]: warehouse
                - generic [ref=e84]: Owner Workspace Demo
              - button "grass Farmer Workdesk Demo" [ref=e85] [cursor=pointer]:
                - generic [ref=e86]: grass
                - generic [ref=e87]: Farmer Workdesk Demo
            - generic [ref=e88]:
              - generic [ref=e89]: Don't have an AgroAI account?
              - link "Create Account / Request Access open_in_new" [ref=e90] [cursor=pointer]:
                - /url: /register
                - generic [ref=e91]: Create Account / Request Access
                - generic [ref=e92]: open_in_new
          - generic [ref=e93]:
            - generic [ref=e94]:
              - generic [ref=e95]: verified_user
              - generic [ref=e96]: SOC 2 Type II Certified Infrastructure
            - generic [ref=e99]:
              - text: "Regional Clusters:"
              - strong [ref=e100]: 14ms latency
        - generic [ref=e101]:
          - generic [ref=e102]:
            - generic [ref=e103]:
              - generic [ref=e104]:
                - generic [ref=e105]: satellite_alt
                - generic [ref=e107]:
                  - text: Telemetry Target
                  - generic [ref=e108]: GreenValley Ranch
              - generic [ref=e109]: Sector 4A Online
            - generic [ref=e110]:
              - generic [ref=e111]:
                - generic [ref=e112]: "NDVI Index: 0.84 (Optimal)"
                - generic [ref=e113]: LIVE LORAWAN
              - generic [ref=e115]:
                - generic [ref=e116]:
                  - paragraph [ref=e117]: Canopy Transpiration
                  - paragraph [ref=e118]: 94.2%
                - generic [ref=e119]:
                  - paragraph [ref=e120]: Active Soil Moisture
                  - paragraph [ref=e121]: 32.8 kPa
            - generic [ref=e122]:
              - generic [ref=e123]:
                - generic [ref=e124]:
                  - generic [ref=e125]: water_drop
                  - text: VPD Deficit
                - generic [ref=e126]: 1.18 kPa
                - generic [ref=e127]: Automatic Valve Closed
              - generic [ref=e128]:
                - generic [ref=e129]:
                  - generic [ref=e130]: nest_thermostat
                  - text: Root Zone (40cm)
                - generic [ref=e131]: 21.4°C
                - generic [ref=e132]: Nominal Range
          - generic [ref=e133]:
            - generic [ref=e134]:
              - generic [ref=e135]: MV
              - generic [ref=e136]:
                - generic [ref=e137]: Dr. Marcus Vance
                - generic [ref=e138]: VP of Agronomy, Pacific Agro Operations
            - blockquote [ref=e139]: "\"AgroAI securely protects proprietary soil telemetry and harvest analytics across 420,000+ hectares worldwide with zero sensor packet loss.\""
  - contentinfo [ref=e140]:
    - generic [ref=e141]:
      - generic [ref=e142]:
        - generic [ref=e143]: Systems Operational
        - generic [ref=e146]:
          - generic [ref=e147]: verified_user
          - generic [ref=e148]: SOC 2 Type II Certified Infrastructure
      - generic [ref=e149]:
        - link "About AgroAI" [ref=e150] [cursor=pointer]:
          - /url: /about
        - link "Privacy Policy" [ref=e151] [cursor=pointer]:
          - /url: "#privacy"
        - link "Terms of Service" [ref=e152] [cursor=pointer]:
          - /url: "#terms"
        - generic [ref=e153]: •
        - generic [ref=e154]: © 2026 AgroAI Platform Inc.
```

# Test source

```ts
  7   | };
  8   | const field = {
  9   |   fieldId: 'field-m5-e2e', localFieldId: 'M5-1', farmId: farm.farmId, name: 'M5 North Field', cropType: 'RICE',
  10  |   soilType: 'CLAY', irrigationType: 'CANAL', areaHectares: 2, status: 'ACTIVE', version: 1,
  11  | };
  12  | const response = (data: unknown) => ({ success: true, data, message: 'isolated M5 UI fixture' });
  13  | 
  14  | test('M5 owner assigns, releases, reviews history, then creates a distinct tenure', async ({ page }) => {
  15  |   let assignments: Array<Record<string, unknown>> = [];
  16  |   const history: Record<string, Array<Record<string, unknown>>> = {};
  17  |   let tenure = 0;
  18  |   await page.route('http://127.0.0.1:8080/api/v1/**', async route => {
  19  |     const request = route.request();
  20  |     const url = new URL(request.url());
  21  |     const path = url.pathname.replace('/api/v1', '');
  22  |     let data: unknown = [];
  23  | 
  24  |     if (path === '/farms' && request.method() === 'GET') data = [farm];
  25  |     else if (path === `/farms/${farm.farmId}/fields` && request.method() === 'GET') data = [field];
  26  |     else if (path === `/farms/${farm.farmId}/fields/${field.fieldId}/assignments` && request.method() === 'GET') {
  27  |       data = { items: assignments, nextCursor: null, hasNext: false, pageSize: 25 };
  28  |     } else if (path.endsWith('/assignments') && request.method() === 'POST') {
  29  |       tenure += 1;
  30  |       const payload = request.postDataJSON() as { farmerUid: string };
  31  |       const assignmentId = `asgn-tenure-${tenure}`;
  32  |       const record = { assignmentId, farmId: farm.farmId, fieldId: field.fieldId, farmerUid: payload.farmerUid,
  33  |         farmerName: 'M5 E2E Farmer', status: 'ACTIVE', version: 1, permissions: ['READ', 'WRITE_LOGS'] };
  34  |       assignments = [...assignments, record];
  35  |       history[assignmentId] = [{ historyId: `history-${tenure}-assigned`, assignmentId,
  36  |         eventType: 'ASSIGNED', performedByUid: 'mock-owner-001', performedByRole: 'OWNER',
  37  |         timestamp: '2026-11-18T12:00:00Z', reason: 'M5 UI test' }];
  38  |       data = record;
  39  |     } else if (path.includes('/assignments/') && path.endsWith('/release') && request.method() === 'POST') {
  40  |       const assignmentId = path.split('/').at(-2)!;
  41  |       assignments = assignments.map(item => item.assignmentId === assignmentId
  42  |         ? { ...item, status: 'RELEASED', version: Number(item.version) + 1 } : item);
  43  |       history[assignmentId] = [...(history[assignmentId] || []), { historyId: `${assignmentId}-released`,
  44  |         assignmentId, eventType: 'RELEASED', performedByUid: 'mock-owner-001', performedByRole: 'OWNER',
  45  |         timestamp: '2026-11-18T13:00:00Z', reason: 'Season completed' }];
  46  |       data = assignments.find(item => item.assignmentId === assignmentId);
  47  |     } else if (path.includes('/assignments/') && path.endsWith('/history') && request.method() === 'GET') {
  48  |       const assignmentId = path.split('/').at(-2)!;
  49  |       data = { items: history[assignmentId] || [], nextCursor: null, hasNext: false, pageSize: 25 };
  50  |     }
  51  | 
  52  |     await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response(data)) });
  53  |   });
  54  | 
  55  |   await page.goto('/dashboard');
  56  |   await page.getByRole('button', { name: 'Sign In as Farm Owner' }).click();
  57  |   await expect(page.getByRole('heading', { name: 'Farm Owner Dashboard' })).toBeVisible();
  58  |   await expect(page.getByText('M5 North Field').first()).toBeVisible();
  59  |   await page.getByRole('button', { name: /Farmers/ }).click();
  60  |   await page.getByRole('button', { name: '+ Assign Farmer' }).click();
  61  |   await page.getByLabel('Farmer Firebase UID *').fill('farmer-disposable-m5');
  62  |   await page.getByRole('button', { name: 'Assign Farmer' }).last().click();
  63  |   await expect(page.getByText('M5 E2E Farmer')).toBeVisible();
  64  |   await page.getByRole('button', { name: 'Audit History' }).click();
  65  |   await expect(page.getByText('ASSIGNED', { exact: true })).toBeVisible();
  66  |   expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  67  |     'Assignment history dialog should fit the viewport').toBe(true);
  68  |   await page.locator('div[style*="z-index: 1100"] button').first().click();
  69  | 
  70  |   await page.getByRole('button', { name: 'Release', exact: true }).click();
  71  |   expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  72  |     'Release dialog should fit the viewport').toBe(true);
  73  |   await page.getByLabel('Reason for Release (Optional)').fill('Season completed');
  74  |   await page.getByRole('button', { name: 'Confirm Release' }).click();
  75  |   await expect(page.getByText('RELEASED', { exact: true })).toBeVisible();
  76  |   await page.getByRole('button', { name: 'Audit History' }).first().click();
  77  |   await expect(page.getByText('RELEASED', { exact: true })).toHaveCount(2);
  78  |   await page.locator('div[style*="z-index: 1100"] button').first().click();
  79  | 
  80  |   await page.getByRole('button', { name: '+ Assign Farmer' }).click();
  81  |   await page.getByLabel('Farmer Firebase UID *').fill('farmer-disposable-m5');
  82  |   await page.getByRole('button', { name: 'Assign Farmer' }).last().click();
  83  |   await expect(page.getByText('Assigned Farmers (1 Active)')).toBeVisible();
  84  |   await expect(page.getByRole('button', { name: 'Audit History' })).toHaveCount(2);
  85  |   expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  86  |     'Assignment dashboard should not overflow the configured viewport').toBe(true);
  87  |   await page.screenshot({ path: test.info().outputPath('m5-assignment-tenures.png'), fullPage: true });
  88  | });
  89  | 
  90  | test('M5 farmer workspace displays only fixture-assigned fields and retains released tenure history', async ({ page }) => {
  91  |   const assigned = { assignmentId: 'asgn-farmer-current', farmId: farm.farmId, fieldId: field.fieldId,
  92  |     farmerUid: 'mock-farmer-001', status: 'ACTIVE', permissions: ['READ'], assignedAt: '2026-11-18T12:00:00Z', version: 1 };
  93  |   const released = { ...assigned, assignmentId: 'asgn-farmer-ended', status: 'RELEASED',
  94  |     releaseReason: 'Season completed', assignedAt: '2026-10-18T12:00:00Z', version: 2 };
  95  | 
  96  |   await page.route('http://127.0.0.1:8080/api/v1/**', async route => {
  97  |     const url = new URL(route.request().url());
  98  |     const path = url.pathname.replace('/api/v1', '');
  99  |     let data: unknown = [];
  100 |     if (path === '/farmers/me/assignments') data = { items: [assigned], nextCursor: null, hasNext: false, pageSize: 25 };
  101 |     else if (path === '/farmers/me/assignments/history') data = { items: [released], nextCursor: null, hasNext: false, pageSize: 25 };
  102 |     else if (path === `/farmers/me/fields/${field.fieldId}`) data = field;
  103 |     await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response(data)) });
  104 |   });
  105 | 
  106 |   await page.goto('/dashboard');
> 107 |   await page.getByRole('button', { name: 'Sign In as Farmer' }).click();
      |                                                                 ^ Error: locator.click: Test timeout of 30000ms exceeded.
  108 |   await page.getByRole('button', { name: 'Farmer View' }).click();
  109 |   await expect(page.getByRole('heading', { name: 'Farmer Assigned Workspace' })).toBeVisible();
  110 |   await expect(page.getByText(field.fieldId, { exact: true })).toBeVisible();
  111 |   await expect(page.getByText('unassigned-field-secret', { exact: true })).toHaveCount(0);
  112 |   await page.getByRole('button', { name: /View Operational Details/ }).click();
  113 |   await expect(page.getByText('OPERATIONAL FIELD INSPECTION')).toBeVisible();
  114 |   await expect(page.getByText('M5 North Field (M5-1)')).toBeVisible();
  115 |   await page.locator('div[style*="z-index: 1000"] button').first().click();
  116 |   await page.getByRole('button', { name: /Assignment History/ }).click();
  117 |   await expect(page.getByText('RELEASED', { exact: true })).toBeVisible();
  118 |   await expect(page.getByText('Season completed')).toBeVisible();
  119 |   await page.reload();
  120 |   await expect(page.getByRole('heading', { name: 'Farmer Assigned Workspace' })).toBeVisible();
  121 |   await expect(page.getByText(field.fieldId, { exact: true })).toBeVisible();
  122 | });
  123 | 
```