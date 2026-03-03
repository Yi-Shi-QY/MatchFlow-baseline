import { expect, test } from '@playwright/test';
import { loginWithApiKey } from './support/auth';

function buildDatasourceManifest(itemId: string) {
  return {
    id: itemId,
    name: 'Validation Center Datasource',
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

test.describe('Validation Center', () => {
  test('runs validation and supports run lookup by runId', async ({ page, request }) => {
    test.slow();

    const runTag = Date.now();
    const itemId = `e2e_vc_datasource_${runTag}`;
    const version = '1.0.0';
    const serverUrl = process.env.E2E_MATCH_DATA_SERVER_URL || 'http://127.0.0.1:3001';
    const apiKey = process.env.E2E_MATCH_DATA_API_KEY || process.env.API_KEY || 'your-secret-key';

    const createResponse = await request.post(`${serverUrl}/admin/catalog/datasource`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      data: {
        itemId,
        version,
        manifest: buildDatasourceManifest(itemId),
      },
    });
    expect(createResponse.ok()).toBeTruthy();

    await loginWithApiKey(page, { serverUrl, apiKey });
    await page.goto('/app/validation-center');
    await expect(page.getByRole('heading', { name: 'Validation Center' })).toBeVisible();

    await page.getByTestId('validation-center-domain-select').click();
    await page.getByTestId('validation-center-domain-select-option-datasource').click();

    await page.getByTestId('validation-center-item-select').click();
    await page.getByTestId(`validation-center-item-select-option-${itemId}`).click();

    await page.getByTestId('validation-center-version-select').click();
    await page.getByTestId('validation-center-version-select-option-1.0.0').click();

    await page.getByTestId('validation-center-start-run').click();
    await expect(page.getByTestId('validation-center-feedback')).toContainText('Validation run started:', {
      timeout: 30_000,
    });

    await expect(page.getByTestId('validation-center-run-status')).toHaveText('succeeded', {
      timeout: 90_000,
    });

    const runId = await page.getByTestId('validation-center-run-id-input').inputValue();
    expect(runId.length).toBeGreaterThan(20);

    await page.getByTestId('validation-center-load-run').click();
    await expect(page.getByTestId('validation-center-active-run-id')).toContainText(runId);
  });
});
