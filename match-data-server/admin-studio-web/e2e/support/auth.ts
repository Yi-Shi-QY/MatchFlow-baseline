import { expect, type Page } from '@playwright/test';

export async function loginWithApiKey(
  page: Page,
  input: {
    serverUrl: string;
    apiKey: string;
  },
) {
  await page.goto('/');
  await page.evaluate((serverUrl) => {
    localStorage.setItem(
      'matchflow_admin_studio_settings',
      JSON.stringify({
        matchDataServerUrl: String(serverUrl || '').trim(),
        matchDataApiKey: '',
        authMode: 'api_key',
        accountIdentifier: '',
        accessToken: '',
        refreshToken: '',
        accessTokenExpiresAt: '',
        refreshTokenExpiresAt: '',
        authUser: null,
      }),
    );
  }, input.serverUrl);

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Admin Studio Sign In' })).toBeVisible();

  await page.getByTestId('login-server-url').fill(input.serverUrl);
  await page.getByTestId('login-auth-mode').click();
  await page.getByTestId('login-auth-mode-option-api_key').click();
  await page.getByTestId('login-api-key').fill(input.apiKey);
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(/\/app\/dashboard/);
}

export async function openLegacyStudio(page: Page) {
  await page.goto('/legacy/studio');
  await expect(page.getByRole('heading', { name: 'Admin Studio 2.0' })).toBeVisible();
}
