import { expect, test } from '@playwright/test';

function buildDatasourceManifest(itemId: string) {
  return {
    id: itemId,
    name: 'Permission Guard Datasource',
    requiredPermissions: ['datasource:use:market'],
    fields: [
      {
        id: 'league',
        type: 'text',
        path: ['league'],
      },
    ],
  };
}

test.describe('Admin Studio permission guards', () => {
  test('blocks create item action without catalog edit permission', async ({ page, request }) => {
    const runTag = Date.now();
    const serverUrl = process.env.E2E_MATCH_DATA_SERVER_URL || 'http://127.0.0.1:3001';
    const apiKey = process.env.E2E_MATCH_DATA_API_KEY || process.env.API_KEY || 'your-secret-key';
    const username = `e2e_analyst_${runTag}`;
    const email = `${username}@example.com`;
    const password = `E2eP@ssw0rd_${runTag}`;
    const itemId = `e2e_guard_datasource_${runTag}`;
    const manifestText = JSON.stringify(buildDatasourceManifest(itemId), null, 2);

    const createUserResponse = await request.post(`${serverUrl}/admin/users`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      data: {
        username,
        email,
        password,
        displayName: 'E2E Analyst',
        roleCodes: ['analyst'],
      },
    });
    expect(createUserResponse.ok()).toBeTruthy();

    const loginResponse = await request.post(`${serverUrl}/auth/login`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        identifier: username,
        password,
      },
    });
    expect(loginResponse.ok()).toBeTruthy();
    const loginPayload = (await loginResponse.json()) as { data?: { accessToken?: string } };
    const analystAccessToken = loginPayload?.data?.accessToken;
    expect(typeof analystAccessToken).toBe('string');
    expect((analystAccessToken || '').length).toBeGreaterThan(20);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Admin Studio 2.0' })).toBeVisible();

    await page.getByTestId('settings-server-url').fill(serverUrl);
    await page.getByTestId('settings-api-key').fill(analystAccessToken || '');
    await page.getByTestId('settings-save-connection').click();
    await expect(page.getByTestId('feedback-banner')).toContainText('Admin Studio connection settings saved.');

    await page.getByTestId('create-item-id').fill(itemId);
    await page.getByTestId('create-item-version').fill('1.0.0');
    await page.getByTestId('create-item-manifest').fill(manifestText);
    await page.getByTestId('create-item-submit').click();

    await expect(page.getByTestId('feedback-banner')).toContainText(
      'Missing required permission: catalog:datasource:edit',
      { timeout: 30_000 },
    );
  });
});
