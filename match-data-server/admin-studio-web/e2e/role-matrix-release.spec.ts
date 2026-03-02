import { expect, test } from '@playwright/test';

function buildDatasourceManifest(itemId: string) {
  return {
    id: itemId,
    name: 'Role Matrix Datasource',
    requiredPermissions: ['datasource:use:market'],
    fields: [
      {
        id: 'league',
        type: 'text',
        path: ['league'],
      },
      {
        id: 'had_home',
        type: 'number',
        path: ['odds', 'had', 'h'],
      },
    ],
  };
}

async function createRoleWithPermissions(
  request: { post: (url: string, options: { headers: Record<string, string>; data: unknown }) => Promise<{ ok: () => boolean }> },
  input: {
    serverUrl: string;
    apiKey: string;
    roleCode: string;
    permissionCodes: string[];
  },
) {
  const response = await request.post(`${input.serverUrl}/admin/roles`, {
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    data: {
      code: input.roleCode,
      name: input.roleCode,
      description: `E2E role ${input.roleCode}`,
      permissionCodes: input.permissionCodes,
    },
  });
  expect(response.ok()).toBeTruthy();
}

async function createUserAndLogin(
  request: {
    post: (
      url: string,
      options: { headers: Record<string, string>; data: unknown },
    ) => Promise<{ ok: () => boolean; json: () => Promise<unknown> }>;
  },
  input: {
    serverUrl: string;
    apiKey: string;
    username: string;
    email: string;
    password: string;
    roleCodes: string[];
  },
) {
  const createUserResponse = await request.post(`${input.serverUrl}/admin/users`, {
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    data: {
      username: input.username,
      email: input.email,
      password: input.password,
      displayName: input.username,
      roleCodes: input.roleCodes,
    },
  });
  expect(createUserResponse.ok()).toBeTruthy();

  const loginResponse = await request.post(`${input.serverUrl}/auth/login`, {
    headers: {
      'Content-Type': 'application/json',
    },
    data: {
      identifier: input.username,
      password: input.password,
    },
  });
  expect(loginResponse.ok()).toBeTruthy();
  const loginPayload = (await loginResponse.json()) as { data?: { accessToken?: string } };
  const accessToken = loginPayload?.data?.accessToken || '';
  expect(accessToken.length).toBeGreaterThan(20);
  return accessToken;
}

async function configureStudioToken(page: { goto: (url: string) => Promise<void>; getByRole: (role: string, options: { name: string }) => { toBeVisible: () => Promise<void> }; getByTestId: (id: string) => { fill: (value: string) => Promise<void>; click: () => Promise<void> }; }, serverUrl: string, accessToken: string) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Admin Studio 2.0' })).toBeVisible();
  await page.getByTestId('settings-server-url').fill(serverUrl);
  await page.getByTestId('settings-api-key').fill(accessToken);
  await page.getByTestId('settings-save-connection').click();
  await expect(page.getByTestId('feedback-banner')).toContainText('Admin Studio connection settings saved.');
}

test.describe('Admin Studio role matrix for release boundaries', () => {
  test('publisher role can publish but cannot rollback', async ({ page, request }) => {
    const runTag = Date.now();
    const serverUrl = process.env.E2E_MATCH_DATA_SERVER_URL || 'http://127.0.0.1:3001';
    const apiKey = process.env.E2E_MATCH_DATA_API_KEY || process.env.API_KEY || 'your-secret-key';
    const roleCode = `e2e_publisher_${runTag}`;
    const username = `e2e_pub_user_${runTag}`;
    const password = `E2eP@ssw0rd_${runTag}`;
    const itemId = `e2e_pub_datasource_${runTag}`;

    await createRoleWithPermissions(request, {
      serverUrl,
      apiKey,
      roleCode,
      permissionCodes: [
        'catalog:datasource:edit',
        'validate:run',
        'release:publish',
        'release:read',
      ],
    });

    const accessToken = await createUserAndLogin(request, {
      serverUrl,
      apiKey,
      username,
      email: `${username}@example.com`,
      password,
      roleCodes: [roleCode],
    });

    await configureStudioToken(page, serverUrl, accessToken);

    await page.getByTestId('create-item-id').fill(itemId);
    await page.getByTestId('create-item-version').fill('1.0.0');
    await page.getByTestId('create-item-manifest').fill(JSON.stringify(buildDatasourceManifest(itemId), null, 2));
    await page.getByTestId('create-item-submit').click();
    await expect(page.getByTestId('feedback-banner')).toContainText(`Created datasource:${itemId}@1.0.0.`);

    await page.getByTestId('action-validate').click();
    await expect(page.getByTestId('feedback-banner')).toContainText(`Validation succeeded for ${itemId}@1.0.0.`);

    await page.getByTestId('action-toggle-publish-wizard').click();
    await expect(page.getByTestId('publish-gate-status')).toContainText('Gate: Passed');
    await page.getByTestId('publish-wizard-confirm-publish').click();
    await expect(page.getByTestId('feedback-banner')).toContainText(`Published ${itemId}@1.0.0 to`);

    await page.getByTestId('action-rollback').click();
    await expect(page.getByTestId('feedback-banner')).toContainText(
      'Missing required permission: release:rollback',
      { timeout: 30_000 },
    );

    await page.getByTestId('release-history-filter-item').fill(itemId);
    const historyList = page.getByTestId('release-history-list');
    await expect(historyList).toContainText(itemId);
    await expect(historyList.locator('button:has-text("publish")').first()).toBeVisible();
    await expect(historyList.locator('button:has-text("rollback")')).toHaveCount(0);
  });

  test('tenant_admin role can publish and rollback', async ({ page, request }) => {
    const runTag = Date.now() + 1;
    const serverUrl = process.env.E2E_MATCH_DATA_SERVER_URL || 'http://127.0.0.1:3001';
    const apiKey = process.env.E2E_MATCH_DATA_API_KEY || process.env.API_KEY || 'your-secret-key';
    const username = `e2e_admin_user_${runTag}`;
    const password = `E2eP@ssw0rd_${runTag}`;
    const itemId = `e2e_admin_datasource_${runTag}`;

    const accessToken = await createUserAndLogin(request, {
      serverUrl,
      apiKey,
      username,
      email: `${username}@example.com`,
      password,
      roleCodes: ['tenant_admin'],
    });

    await configureStudioToken(page, serverUrl, accessToken);

    await page.getByTestId('create-item-id').fill(itemId);
    await page.getByTestId('create-item-version').fill('1.0.0');
    await page.getByTestId('create-item-manifest').fill(JSON.stringify(buildDatasourceManifest(itemId), null, 2));
    await page.getByTestId('create-item-submit').click();
    await expect(page.getByTestId('feedback-banner')).toContainText(`Created datasource:${itemId}@1.0.0.`);

    await page.getByTestId('action-validate').click();
    await expect(page.getByTestId('feedback-banner')).toContainText(`Validation succeeded for ${itemId}@1.0.0.`);

    await page.getByTestId('action-toggle-publish-wizard').click();
    await expect(page.getByTestId('publish-gate-status')).toContainText('Gate: Passed');
    await page.getByTestId('publish-wizard-confirm-publish').click();
    await expect(page.getByTestId('feedback-banner')).toContainText(`Published ${itemId}@1.0.0 to`);

    await page.getByTestId('action-rollback').click();
    await expect(page.getByTestId('feedback-banner')).toContainText(
      'Rollback completed to 1.0.0.',
      { timeout: 30_000 },
    );

    await page.getByTestId('release-history-filter-item').fill(itemId);
    const historyList = page.getByTestId('release-history-list');
    await expect(historyList).toContainText(itemId);
    await expect(historyList.locator('button:has-text("publish")').first()).toBeVisible();
    await expect(historyList.locator('button:has-text("rollback")').first()).toBeVisible();
  });
});
