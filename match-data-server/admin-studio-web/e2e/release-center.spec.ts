import { expect, test, type APIRequestContext } from '@playwright/test';
import { loginWithApiKey } from './support/auth';

function buildDatasourceManifest(itemId: string) {
  return {
    id: itemId,
    name: 'Release Center Datasource',
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

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function createDatasource(
  request: APIRequestContext,
  input: {
    serverUrl: string;
    apiKey: string;
    itemId: string;
    version: string;
  },
) {
  const response = await request.post(`${input.serverUrl}/admin/catalog/datasource`, {
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    data: {
      itemId: input.itemId,
      version: input.version,
      manifest: buildDatasourceManifest(input.itemId),
    },
  });
  expect(response.ok()).toBeTruthy();
}

async function runValidationUntilSucceeded(
  request: APIRequestContext,
  input: {
    serverUrl: string;
    apiKey: string;
    itemId: string;
    version: string;
  },
) {
  const startResponse = await request.post(`${input.serverUrl}/admin/validate/run`, {
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    data: {
      runType: 'catalog_validate',
      domain: 'datasource',
      scope: {
        itemId: input.itemId,
        version: input.version,
      },
    },
  });
  expect(startResponse.ok()).toBeTruthy();
  const startPayload = (await startResponse.json()) as { data?: { id?: string; status?: string } };
  const runId = startPayload?.data?.id || '';
  expect(runId.length).toBeGreaterThan(20);

  for (let attempt = 0; attempt < 45; attempt += 1) {
    const runResponse = await request.get(`${input.serverUrl}/admin/validate/${runId}`, {
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
      },
    });
    expect(runResponse.ok()).toBeTruthy();
    const runPayload = (await runResponse.json()) as {
      data?: { status?: string };
    };
    const status = runPayload?.data?.status || 'unknown';
    if (status === 'succeeded') {
      return runId;
    }
    if (status === 'failed' || status === 'canceled') {
      throw new Error(`Validation run ${runId} ended with status=${status}`);
    }
    await wait(1200);
  }

  throw new Error(`Validation run ${runId} did not finish in time.`);
}

test.describe('Release Center', () => {
  test('publishes and rolls back using release action form', async ({ page, request }) => {
    test.slow();

    const runTag = Date.now();
    const itemId = `e2e_rc_datasource_${runTag}`;
    const version = '1.0.0';
    const serverUrl = process.env.E2E_MATCH_DATA_SERVER_URL || 'http://127.0.0.1:3001';
    const apiKey = process.env.E2E_MATCH_DATA_API_KEY || process.env.API_KEY || 'your-secret-key';

    await createDatasource(request, {
      serverUrl,
      apiKey,
      itemId,
      version,
    });

    const validationRunId = await runValidationUntilSucceeded(request, {
      serverUrl,
      apiKey,
      itemId,
      version,
    });

    await loginWithApiKey(page, { serverUrl, apiKey });
    await page.goto('/app/release-center');
    await expect(page.getByRole('heading', { name: 'Release Center' })).toBeVisible();

    await page.getByTestId('release-center-action-domain-select').click();
    await page.getByTestId('release-center-action-domain-select-option-datasource').click();

    await page.getByTestId('release-center-action-item-select').click();
    await page.getByTestId(`release-center-action-item-select-option-${itemId}`).click();

    await page.getByTestId('release-center-publish-version-select').click();
    await page.getByTestId('release-center-publish-version-select-option-1.0.0').click();

    await page.getByTestId('release-center-rollback-version-select').click();
    await page.getByTestId('release-center-rollback-version-select-option-1.0.0').click();

    await page.getByTestId('release-center-validation-run-id-input').fill(validationRunId);
    await page.getByTestId('release-center-notes-input').fill('e2e release center publish rollback');

    await page.getByTestId('release-center-publish').click();
    await expect(page.getByTestId('release-center-feedback')).toContainText(
      `Published datasource:${itemId}@1.0.0 to`,
      { timeout: 60_000 },
    );

    await page.getByTestId('release-center-rollback').click();
    await expect(page.getByTestId('release-center-feedback')).toContainText('Rollback completed to 1.0.0.', {
      timeout: 60_000,
    });

    await page.getByTestId('release-center-history-item-search').fill(itemId);
    await expect(page.getByTestId('release-center-history-list')).toContainText(itemId, {
      timeout: 30_000,
    });
  });
});
