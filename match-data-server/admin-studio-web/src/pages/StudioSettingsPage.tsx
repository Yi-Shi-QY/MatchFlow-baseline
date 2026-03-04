import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Card, CardContent } from '@/src/components/ui/Card';
import { Select } from '@/src/components/ui/Select';
import { useI18n } from '@/src/i18n';
import {
  AdminStudioApiError,
  getCurrentUserProfile,
  getMyCapabilities,
  loginWithAccount,
  logoutAccount,
} from '@/src/services/adminStudio';
import {
  getSettings,
  saveSettings,
  type AdminStudioAuthMode,
  type AdminStudioAuthUser,
} from '@/src/services/settings';

type FeedbackTone = 'success' | 'error' | 'info';

const AUTH_MODE_OPTIONS: Array<{ value: AdminStudioAuthMode; label: string }> = [
  { value: 'account', label: 'account token' },
  { value: 'api_key', label: 'api key' },
];

function summarizeError(error: unknown) {
  if (error instanceof AdminStudioApiError) {
    const codePart = error.code ? `[${error.code}] ` : '';
    return `${codePart}${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}

function formatAuthUserLabel(user: AdminStudioAuthUser | null) {
  if (!user) {
    return 'Not logged in';
  }
  const primary = user.username || user.email || user.id;
  const tenant = user.tenantId ? `tenant=${user.tenantId}` : 'tenant=unknown';
  return `${primary} (${tenant})`;
}

export default function StudioSettingsPage() {
  const { t } = useI18n();
  const initial = getSettings();
  const [serverUrlInput, setServerUrlInput] = useState(initial.matchDataServerUrl);
  const [apiKeyInput, setApiKeyInput] = useState(initial.matchDataApiKey);
  const [authModeInput, setAuthModeInput] = useState<AdminStudioAuthMode>(initial.authMode);
  const [accountIdentifierInput, setAccountIdentifierInput] = useState(initial.accountIdentifier);
  const [accountPasswordInput, setAccountPasswordInput] = useState('');
  const [currentAuthUser, setCurrentAuthUser] = useState<AdminStudioAuthUser | null>(
    initial.authUser,
  );
  const [capabilitiesSummary, setCapabilitiesSummary] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: FeedbackTone; message: string } | null>(null);

  function handleSaveConnectionSettings() {
    const serverUrl = serverUrlInput.trim();
    const apiKey = apiKeyInput.trim();
    if (!serverUrl) {
      setFeedback({ tone: 'error', message: t('Server URL is required.', '必须填写服务端地址。') });
      return;
    }

    saveSettings({
      matchDataServerUrl: serverUrl,
      matchDataApiKey: apiKey,
      authMode: authModeInput,
      accountIdentifier: accountIdentifierInput.trim(),
      ...(authModeInput === 'api_key'
        ? {
            accessToken: '',
            refreshToken: '',
            accessTokenExpiresAt: '',
            refreshTokenExpiresAt: '',
            authUser: null,
          }
        : {}),
    });

    if (authModeInput === 'api_key') {
      setCurrentAuthUser(null);
      setCapabilitiesSummary('');
    }

    setFeedback({
      tone: 'success',
      message: t('Settings saved.', '设置已保存。'),
    });
  }

  async function handleAccountLogin() {
    const serverUrl = serverUrlInput.trim();
    const identifier = accountIdentifierInput.trim();
    const password = accountPasswordInput;
    if (!serverUrl) {
      setFeedback({ tone: 'error', message: t('Server URL is required.', '必须填写服务端地址。') });
      return;
    }
    if (!identifier || !password) {
      setFeedback({
        tone: 'error',
        message: t('Account login requires identifier and password.', '账号登录需要填写账号与密码。'),
      });
      return;
    }

    setIsAuthenticating(true);
    try {
      saveSettings({
        matchDataServerUrl: serverUrl,
        authMode: 'account',
        accountIdentifier: identifier,
      });
      const data = await loginWithAccount({
        identifier,
        password,
      });
      setCurrentAuthUser(data.user || null);
      setAuthModeInput('account');
      setAccountPasswordInput('');
      setFeedback({
        tone: 'success',
        message: t(
          `Logged in as ${formatAuthUserLabel(data.user || null)}.`,
          `已登录：${formatAuthUserLabel(data.user || null)}。`,
        ),
      });
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleRefreshIdentity() {
    setIsAuthenticating(true);
    try {
      const user = await getCurrentUserProfile();
      setCurrentAuthUser(user);
      const capabilities = await getMyCapabilities();
      setCapabilitiesSummary(
        `adminConsole=${String(capabilities.canUseAdminConsole)} | templates=${capabilities.availableTemplates.length} | sources=${capabilities.availableDataSources.length}`,
      );
      setFeedback({
        tone: 'success',
        message: t(
          `Profile refreshed: ${formatAuthUserLabel(user)}.`,
          `身份信息已刷新：${formatAuthUserLabel(user)}。`,
        ),
      });
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleLogout() {
    setIsAuthenticating(true);
    try {
      await logoutAccount();
      setCurrentAuthUser(null);
      setCapabilitiesSummary('');
      setFeedback({
        tone: 'info',
        message: t('Account session cleared.', '账号会话已清除。'),
      });
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setIsAuthenticating(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
      <Card className="border-zinc-800 bg-zinc-950">
        <CardContent className="space-y-4 p-4">
          <div>
            <h1 className="text-base font-bold text-white">{t('Studio Settings', '工作台设置')}</h1>
            <p className="text-xs text-zinc-500">
              {t(
                'Manage connection and auth session outside business pages.',
                '在业务页面之外管理连接配置和认证会话。',
              )}
            </p>
          </div>

          {feedback && (
            <div
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                feedback.tone === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : feedback.tone === 'error'
                    ? 'border-red-500/30 bg-red-500/10 text-red-300'
                    : 'border-blue-500/30 bg-blue-500/10 text-blue-300'
              }`}
            >
              {feedback.tone === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
              {feedback.tone === 'error' && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_1fr_auto]">
            <input
              type="text"
              value={serverUrlInput}
              onChange={(event) => setServerUrlInput(event.target.value)}
              placeholder={t('Server URL (e.g. http://127.0.0.1:3001)', '服务端地址（例如 http://127.0.0.1:3001）')}
              data-testid="settings-server-url"
              className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
            <input
              type="password"
              value={apiKeyInput}
              onChange={(event) => setApiKeyInput(event.target.value)}
              placeholder={t('API Key', 'API Key')}
              data-testid="settings-api-key"
              className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSaveConnectionSettings}
              data-testid="settings-save-connection"
            >
              {t('Save', '保存')}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-2 lg:grid-cols-[170px_1fr_1fr_auto_auto_auto]">
            <Select
              value={authModeInput}
              onChange={(value) => setAuthModeInput(value as AdminStudioAuthMode)}
              options={AUTH_MODE_OPTIONS.map((item) => ({
                ...item,
                label:
                  item.value === 'account'
                    ? t('account token', '账号令牌')
                    : t('api key', 'API Key'),
              }))}
            />
            <input
              type="text"
              value={accountIdentifierInput}
              onChange={(event) => setAccountIdentifierInput(event.target.value)}
              placeholder={t('Account (username/email)', '账号（用户名/邮箱）')}
              className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
            <input
              type="password"
              value={accountPasswordInput}
              onChange={(event) => setAccountPasswordInput(event.target.value)}
              placeholder={t('Account Password', '账号密码')}
              className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleAccountLogin()}
              disabled={isAuthenticating}
            >
              {isAuthenticating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('Login', '登录')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleRefreshIdentity()}
              disabled={isAuthenticating}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t('Me', '我的信息')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleLogout()}
              disabled={isAuthenticating}
            >
              {t('Logout', '退出')}
            </Button>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-400">
            {t('auth', '认证')}: {authModeInput} | {t('user', '用户')}: {formatAuthUserLabel(currentAuthUser)}
            {capabilitiesSummary ? <span> | {capabilitiesSummary}</span> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
