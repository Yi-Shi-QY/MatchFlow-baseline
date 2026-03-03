import React, { useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Card, CardContent } from '@/src/components/ui/Card';
import { Select } from '@/src/components/ui/Select';
import { isAuthenticated } from '@/src/lib/adminSession';
import { AdminStudioApiError, loginWithAccount } from '@/src/services/adminStudio';
import { getSettings, saveSettings, type AdminStudioAuthMode } from '@/src/services/settings';

type FeedbackTone = 'success' | 'error' | 'info';

const AUTH_MODE_OPTIONS: Array<{ value: AdminStudioAuthMode; label: string }> = [
  { value: 'account', label: 'account token' },
  { value: 'api_key', label: 'api key' },
];

function summarizeError(error: unknown) {
  if (error instanceof AdminStudioApiError) {
    const code = error.code ? `[${error.code}] ` : '';
    return `${code}${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const settings = getSettings();
  const [serverUrlInput, setServerUrlInput] = useState(settings.matchDataServerUrl);
  const [authModeInput, setAuthModeInput] = useState<AdminStudioAuthMode>(settings.authMode);
  const [apiKeyInput, setApiKeyInput] = useState(settings.matchDataApiKey);
  const [accountIdentifierInput, setAccountIdentifierInput] = useState(settings.accountIdentifier);
  const [accountPasswordInput, setAccountPasswordInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: FeedbackTone; message: string } | null>(null);

  const nextPath = useMemo(() => {
    const state = location.state as { from?: string } | null;
    if (state?.from && state.from.startsWith('/app/')) {
      return state.from;
    }
    return '/app/dashboard';
  }, [location.state]);

  if (isAuthenticated()) {
    return <Navigate to="/app/dashboard" replace />;
  }

  async function handleLogin() {
    const serverUrl = serverUrlInput.trim();
    if (!serverUrl) {
      setFeedback({ tone: 'error', message: 'Server URL is required.' });
      return;
    }

    if (authModeInput === 'api_key') {
      const apiKey = apiKeyInput.trim();
      if (!apiKey) {
        setFeedback({ tone: 'error', message: 'API key is required in api key mode.' });
        return;
      }
      saveSettings({
        matchDataServerUrl: serverUrl,
        authMode: 'api_key',
        matchDataApiKey: apiKey,
        accountIdentifier: accountIdentifierInput.trim(),
        accessToken: '',
        refreshToken: '',
        accessTokenExpiresAt: '',
        refreshTokenExpiresAt: '',
        authUser: null,
      });
      setFeedback({ tone: 'success', message: 'Connected with API key.' });
      navigate(nextPath, { replace: true });
      return;
    }

    const identifier = accountIdentifierInput.trim();
    const password = accountPasswordInput;
    if (!identifier || !password) {
      setFeedback({ tone: 'error', message: 'Account identifier and password are required.' });
      return;
    }

    setIsSubmitting(true);
    try {
      saveSettings({
        matchDataServerUrl: serverUrl,
        authMode: 'account',
        accountIdentifier: identifier,
      });
      const result = await loginWithAccount({
        identifier,
        password,
      });
      setAccountPasswordInput('');
      setFeedback({
        tone: 'success',
        message: `Signed in as ${result.user?.username || result.user?.email || result.user?.id || identifier}.`,
      });
      navigate(nextPath, { replace: true });
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-zinc-100">
      <Card className="w-full max-w-xl border-zinc-800 bg-zinc-950">
        <CardContent className="space-y-4 p-5">
          <div>
            <h1 className="text-lg font-semibold text-white">Admin Studio Sign In</h1>
            <p className="text-xs text-zinc-500">
              Login first, then enter workspace pages for design, management, and release.
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
              <span>{feedback.message}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-wider text-zinc-500">Server URL</label>
            <input
              type="text"
              value={serverUrlInput}
              onChange={(event) => setServerUrlInput(event.target.value)}
              placeholder="http://127.0.0.1:3001"
              data-testid="login-server-url"
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-wider text-zinc-500">Auth Mode</label>
            <Select
              value={authModeInput}
              onChange={(value) => setAuthModeInput(value as AdminStudioAuthMode)}
              options={AUTH_MODE_OPTIONS}
              testId="login-auth-mode"
            />
          </div>

          {authModeInput === 'api_key' ? (
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-wider text-zinc-500">API Key</label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(event) => setApiKeyInput(event.target.value)}
                placeholder="API key"
                data-testid="login-api-key"
                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider text-zinc-500">Account</label>
                <input
                  type="text"
                  value={accountIdentifierInput}
                  onChange={(event) => setAccountIdentifierInput(event.target.value)}
                  placeholder="username/email"
                  data-testid="login-account-identifier"
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider text-zinc-500">Password</label>
                <input
                  type="password"
                  value={accountPasswordInput}
                  onChange={(event) => setAccountPasswordInput(event.target.value)}
                  placeholder="password"
                  data-testid="login-account-password"
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          <Button
            onClick={() => void handleLogin()}
            disabled={isSubmitting}
            className="w-full gap-2"
            data-testid="login-submit"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Enter Admin Studio
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
