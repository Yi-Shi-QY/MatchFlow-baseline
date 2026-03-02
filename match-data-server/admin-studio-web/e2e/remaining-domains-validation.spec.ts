import { expect, test } from '@playwright/test';

type Domain = 'animation_template' | 'agent' | 'skill';

function buildManifest(domain: Domain, itemId: string) {
  if (domain === 'animation_template') {
    return {
      id: itemId,
      name: 'E2E Animation Template',
      description: 'Animation template used in browser validation matrix.',
      animationType: 'stats',
      templateId: `tpl_${itemId}`,
      requiredParams: ['metric', 'homeValue', 'awayValue'],
      schema: {
        type: 'object',
        properties: {
          metric: { type: 'string' },
          homeValue: { type: 'number' },
          awayValue: { type: 'number' },
        },
      },
      example: {
        metric: 'xg',
        homeValue: 1.2,
        awayValue: 0.8,
      },
    };
  }

  if (domain === 'agent') {
    return {
      kind: 'agent',
      id: itemId,
      name: 'E2E Agent',
      description: 'Agent manifest used in browser validation matrix.',
      rolePrompt: {
        en: 'You are a concise football analyst.',
        zh: '你是一个简洁的足球分析师。',
      },
      skills: ['select_plan_template_v2'],
      contextDependencies: 'all',
    };
  }

  return {
    kind: 'skill',
    id: itemId,
    name: 'E2E Skill',
    description: 'Skill manifest used in browser validation matrix.',
    declaration: {
      name: itemId,
      description: 'Delegates to builtin planner selector.',
      parameters: {
        type: 'object',
        properties: {
          matchId: { type: 'string' },
        },
        required: ['matchId'],
      },
    },
    runtime: {
      mode: 'builtin_alias',
      targetSkill: 'select_plan_template',
    },
  };
}

test.describe('Admin Studio remaining domain validation matrix', () => {
  test('supports create+validate flows for animation_template, agent, and skill', async ({ page }) => {
    test.slow();

    const runTag = Date.now();
    const serverUrl = process.env.E2E_MATCH_DATA_SERVER_URL || 'http://127.0.0.1:3001';
    const apiKey = process.env.E2E_MATCH_DATA_API_KEY || process.env.API_KEY || 'your-secret-key';
    const domains: Domain[] = ['animation_template', 'agent', 'skill'];

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Admin Studio 2.0' })).toBeVisible();

    await page.getByTestId('settings-server-url').fill(serverUrl);
    await page.getByTestId('settings-api-key').fill(apiKey);
    await page.getByTestId('settings-save-connection').click();
    await expect(page.getByTestId('feedback-banner')).toContainText('Admin Studio connection settings saved.');

    for (const domain of domains) {
      const itemId = `e2e_${domain}_${runTag}`;
      const manifestText = JSON.stringify(buildManifest(domain, itemId), null, 2);

      await page.getByTestId('domain-select').click();
      await page.getByTestId(`domain-select-option-${domain}`).click();

      await page.getByTestId('create-item-id').fill(itemId);
      await page.getByTestId('create-item-version').fill('1.0.0');
      await page.getByTestId('create-item-manifest').fill(manifestText);
      await page.getByTestId('create-item-submit').click();

      await expect(page.getByTestId('feedback-banner')).toContainText(`Created ${domain}:${itemId}@1.0.0.`);
      await expect(page.getByTestId('revision-editor-item')).toContainText(itemId);

      await page.getByTestId('action-validate').click();
      await expect(page.getByTestId('feedback-banner')).toContainText(
        `Validation succeeded for ${itemId}@1.0.0.`,
        { timeout: 60_000 },
      );
    }
  });
});
