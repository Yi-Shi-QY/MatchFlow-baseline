import { expect, test } from '@playwright/test';
import { loginWithApiKey, openLegacyStudio } from './support/auth';

function buildPlanningTemplateManifest(itemId: string) {
  return {
    id: itemId,
    name: 'E2E Planning Template',
    rule: 'Use one concise segment for baseline analysis.',
    requiredAgents: ['overview'],
    requiredSkills: ['select_plan_template_v2'],
    segments: [
      {
        id: 'segment_1',
        agentType: 'overview',
        title: {
          en: 'Overview',
          zh: '概览',
        },
        focus: {
          en: 'Summarize current form and momentum.',
          zh: '总结当前状态与势头。',
        },
        contextMode: 'independent',
      },
    ],
  };
}

test.describe('Admin Studio planning_template governance lifecycle', () => {
  test('supports create, validate, publish, rollback, and release history trace', async ({ page }) => {
    test.slow();

    const runTag = Date.now();
    const itemId = `e2e_planning_template_${runTag}`;
    const version = '1.0.0';
    const serverUrl = process.env.E2E_MATCH_DATA_SERVER_URL || 'http://127.0.0.1:3001';
    const apiKey = process.env.E2E_MATCH_DATA_API_KEY || process.env.API_KEY || 'your-secret-key';
    const manifestText = JSON.stringify(buildPlanningTemplateManifest(itemId), null, 2);

    await loginWithApiKey(page, { serverUrl, apiKey });
    await openLegacyStudio(page);

    await page.getByTestId('domain-select').click();
    await page.getByTestId('domain-select-option-planning_template').click();

    await page.getByTestId('create-item-id').fill(itemId);
    await page.getByTestId('create-item-version').fill(version);
    await page.getByTestId('create-item-manifest').fill(manifestText);
    await page.getByTestId('create-item-submit').click();

    await expect(page.getByTestId('feedback-banner')).toContainText(`Created planning_template:${itemId}@${version}.`);
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
