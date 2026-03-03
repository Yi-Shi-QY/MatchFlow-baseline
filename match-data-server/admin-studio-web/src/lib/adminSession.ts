import { getSettings, type AdminStudioSettings } from '@/src/services/settings';

function hasText(value: string | null | undefined) {
  return String(value || '').trim().length > 0;
}

export function hasConfiguredServer(settings: AdminStudioSettings = getSettings()) {
  return hasText(settings.matchDataServerUrl);
}

export function hasApiKeySession(settings: AdminStudioSettings = getSettings()) {
  return settings.authMode === 'api_key' && hasText(settings.matchDataApiKey);
}

export function hasAccountSession(settings: AdminStudioSettings = getSettings()) {
  return settings.authMode === 'account' && hasText(settings.accessToken);
}

export function isAuthenticated(settings: AdminStudioSettings = getSettings()) {
  if (!hasConfiguredServer(settings)) {
    return false;
  }
  return hasApiKeySession(settings) || hasAccountSession(settings);
}

export function getAuthLabel(settings: AdminStudioSettings = getSettings()) {
  if (!isAuthenticated(settings)) {
    return 'Not authenticated';
  }
  if (settings.authMode === 'account') {
    const user = settings.authUser;
    const userText =
      user?.username
      || user?.email
      || user?.id
      || settings.accountIdentifier
      || 'account';
    return `Account: ${userText}`;
  }
  return 'API Key session';
}
