import { expect, test } from '@playwright/test';
import { loginWithApiKey, openLegacyStudio } from './support/auth';

function buildDatasourceManifest(itemId: string) {
  return {
    id: itemId,
    name: 'E2E Datasource',
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

test.describe('Admin Studio datasource governance lifecycle', () => {
  test('supports create, validate, publish, rollback, and release history trace', async ({ page }) => {
    test.slow();

    const runTag = Date.now();
    const itemId = `e2e_datasource_${runTag}`;
    const version = '1.0.0';
    const serverUrl = process.env.E2E_MATCH_DATA_SERVER_URL || 'http://127.0.0.1:3001';
    const apiKey = process.env.E2E_MATCH_DATA_API_KEY || process.env.API_KEY || 'your-secret-key';
    const manifestText = JSON.stringify(buildDatasourceManifest(itemId), null, 2);

    await loginWithApiKey(page, { serverUrl, apiKey });
    await openLegacyStudio(page);

    await page.getByTestId('create-item-id').fill(itemId);
    await page.getByTestId('create-item-version').fill(version);
    await page.getByTestId('create-item-manifest').fill(manifestText);
    await page.getByTestId('create-item-submit').click();

    await expect(page.getByTestId('feedback-banner')).toContainText(`Created datasource:${itemId}@${version}.`);
    await expect(page.getByTestId('revision-editor-item')).toContainText(itemId);

    await page.getByTestId('action-validate').click();
    await expect(page.getByTestId('feedback-banner')).toContainText(
      `Validation succeeded for ${itemId}@${version}.`,
      { timeout: 60_000 },
    );

    await page.getByTestId('action-toggle-publish-wizard').click();
    await expect(page.getByTestId('publish-wizard')).toBeVisible();
    await expect(page.getByTestId('publish-gate-status')).toContainText('Gate: Passed', {
      timeout: 60_000,
    });

    await page.getByTestId('publish-wizard-confirm-publish').click();
    await expect(page.getByTestId('feedback-banner')).toContainText(
      `Published ${itemId}@${version} to`,
      { timeout: 60_000 },
    );

    await page.getByTestId('action-rollback').click();
    await expect(page.getByTestId('feedback-banner')).toContainText(
      `Rollback completed to ${version}.`,
      { timeout: 60_000 },
    );

    await page.getByTestId('release-history-filter-item').fill(itemId);

    const historyList = page.getByTestId('release-history-list');
    await expect(historyList).toContainText(itemId, { timeout: 30_000 });
    await expect(historyList.locator('button:has-text("publish")').first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(historyList.locator('button:has-text("rollback")').first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
