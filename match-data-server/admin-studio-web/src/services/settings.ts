export type AdminStudioAuthMode = 'api_key' | 'account';

export interface AdminStudioAuthUser {
  id: string;
  tenantId?: string;
  username?: string;
  email?: string;
  displayName?: string | null;
  roles?: string[];
  permissions?: string[];
}

export interface AdminStudioSettings {
  matchDataServerUrl: string;
  matchDataApiKey: string;
  authMode: AdminStudioAuthMode;
  accountIdentifier: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  authUser: AdminStudioAuthUser | null;
}

const SETTINGS_KEY = 'matchflow_admin_studio_settings';
export const ADMIN_STUDIO_SETTINGS_UPDATED_EVENT = 'admin-studio-settings-updated';

const DEFAULT_SETTINGS: AdminStudioSettings = {
  matchDataServerUrl: String(import.meta.env.VITE_MATCH_DATA_SERVER_URL || '').trim(),
  matchDataApiKey: String(import.meta.env.VITE_MATCH_DATA_API_KEY || '').trim(),
  authMode:
    String(import.meta.env.VITE_ADMIN_STUDIO_AUTH_MODE || '').trim() === 'account'
      ? 'account'
      : 'api_key',
  accountIdentifier: String(import.meta.env.VITE_ADMIN_STUDIO_ACCOUNT_IDENTIFIER || '').trim(),
  accessToken: '',
  refreshToken: '',
  accessTokenExpiresAt: '',
  refreshTokenExpiresAt: '',
  authUser: null,
};

function normalizeAuthMode(value: unknown): AdminStudioAuthMode {
  return value === 'account' ? 'account' : 'api_key';
}

function sanitizeAuthUser(value: unknown): AdminStudioAuthUser | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || record.id.trim().length === 0) {
    return null;
  }
  return {
    id: record.id.trim(),
    tenantId: typeof record.tenantId === 'string' ? record.tenantId.trim() : undefined,
    username: typeof record.username === 'string' ? record.username.trim() : undefined,
    email: typeof record.email === 'string' ? record.email.trim() : undefined,
    displayName:
      typeof record.displayName === 'string' || record.displayName === null
        ? (record.displayName as string | null)
        : undefined,
    roles: Array.isArray(record.roles)
      ? record.roles.filter((item): item is string => typeof item === 'string')
      : undefined,
    permissions: Array.isArray(record.permissions)
      ? record.permissions.filter((item): item is string => typeof item === 'string')
      : undefined,
  };
}

function sanitizeSettings(input: Partial<AdminStudioSettings>): AdminStudioSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...input,
    matchDataServerUrl: String(input.matchDataServerUrl || DEFAULT_SETTINGS.matchDataServerUrl).trim(),
    matchDataApiKey: String(input.matchDataApiKey || '').trim(),
    authMode: normalizeAuthMode(input.authMode),
    accountIdentifier: String(input.accountIdentifier || '').trim(),
    accessToken: String(input.accessToken || '').trim(),
    refreshToken: String(input.refreshToken || '').trim(),
    accessTokenExpiresAt: String(input.accessTokenExpiresAt || '').trim(),
    refreshTokenExpiresAt: String(input.refreshTokenExpiresAt || '').trim(),
    authUser: sanitizeAuthUser(input.authUser),
  };
}

export function getSettings(): AdminStudioSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }
    return sanitizeSettings(JSON.parse(raw) as Partial<AdminStudioSettings>);
  } catch (error) {
    console.error('Failed to load admin studio settings', error);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(next: Partial<AdminStudioSettings>) {
  try {
    const merged = sanitizeSettings({
      ...getSettings(),
      ...next,
    });
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(ADMIN_STUDIO_SETTINGS_UPDATED_EVENT));
    }
  } catch (error) {
    console.error('Failed to save admin studio settings', error);
  }
}

export function clearAuthSession() {
  saveSettings({
    accessToken: '',
    refreshToken: '',
    accessTokenExpiresAt: '',
    refreshTokenExpiresAt: '',
    authUser: null,
  });
}
