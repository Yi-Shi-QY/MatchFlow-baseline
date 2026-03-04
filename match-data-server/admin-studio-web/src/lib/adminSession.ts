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
  const isZh = settings.language === 'zh';
  if (!isAuthenticated(settings)) {
    return isZh ? '未认证' : 'Not authenticated';
  }
  if (settings.authMode === 'account') {
    const user = settings.authUser;
    const userText =
      user?.username
      || user?.email
      || user?.id
      || settings.accountIdentifier
      || (isZh ? '账号' : 'account');
    return isZh ? `账号：${userText}` : `Account: ${userText}`;
  }
  return isZh ? 'API Key 会话' : 'API Key session';
}
