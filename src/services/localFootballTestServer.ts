import { Capacitor } from '@capacitor/core';

export const LOCAL_FOOTBALL_TEST_SERVER_API_KEY =
  'matchflow-local-football-test-key-20260311';
export const LOCAL_FOOTBALL_TEST_SERVER_WEB_URL = 'http://127.0.0.1:3001';
export const LOCAL_FOOTBALL_TEST_SERVER_ANDROID_URL = 'http://10.0.2.2:3001';

export interface LocalFootballTestRuntime {
  nativePlatform?: boolean;
  platform?: string;
}

export interface LocalFootballTestEnv {
  VITE_MATCHFLOW_LOCAL_TEST_SERVER_PRESET?: string;
  VITE_MATCHFLOW_LOCAL_TEST_SERVER_URL?: string;
  VITE_MATCHFLOW_LOCAL_TEST_SERVER_ANDROID_URL?: string;
  VITE_MATCHFLOW_LOCAL_TEST_SERVER_API_KEY?: string;
}

export interface LocalFootballTestServerPreset {
  matchDataServerUrl: string;
  matchDataApiKey: string;
}

function isPresetEnabled(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

function normalizeOptionalValue(value: string | undefined): string | null {
  const normalized = String(value || '').trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveRuntime(input: LocalFootballTestRuntime = {}): Required<LocalFootballTestRuntime> {
  const nativePlatform =
    typeof input.nativePlatform === 'boolean' ? input.nativePlatform : Capacitor.isNativePlatform();
  const platform =
    typeof input.platform === 'string' && input.platform.trim().length > 0
      ? input.platform.trim()
      : nativePlatform
        ? Capacitor.getPlatform()
        : 'web';

  return {
    nativePlatform,
    platform,
  };
}

export function getLocalFootballTestServerPreset(
  runtime: LocalFootballTestRuntime = {},
): LocalFootballTestServerPreset {
  const resolvedRuntime = resolveRuntime(runtime);
  const matchDataServerUrl =
    resolvedRuntime.nativePlatform && resolvedRuntime.platform === 'android'
      ? LOCAL_FOOTBALL_TEST_SERVER_ANDROID_URL
      : LOCAL_FOOTBALL_TEST_SERVER_WEB_URL;

  return {
    matchDataServerUrl,
    matchDataApiKey: LOCAL_FOOTBALL_TEST_SERVER_API_KEY,
  };
}

export function getConfiguredLocalFootballTestServerPreset(input: {
  env?: LocalFootballTestEnv;
  runtime?: LocalFootballTestRuntime;
} = {}): LocalFootballTestServerPreset | null {
  const env = input.env ?? (import.meta.env as LocalFootballTestEnv);
  if (!isPresetEnabled(env.VITE_MATCHFLOW_LOCAL_TEST_SERVER_PRESET)) {
    return null;
  }

  const resolvedRuntime = resolveRuntime(input.runtime);
  const defaultPreset = getLocalFootballTestServerPreset(resolvedRuntime);
  const runtimeUrl =
    resolvedRuntime.nativePlatform && resolvedRuntime.platform === 'android'
      ? normalizeOptionalValue(env.VITE_MATCHFLOW_LOCAL_TEST_SERVER_ANDROID_URL)
      : normalizeOptionalValue(env.VITE_MATCHFLOW_LOCAL_TEST_SERVER_URL);

  return {
    matchDataServerUrl: runtimeUrl || defaultPreset.matchDataServerUrl,
    matchDataApiKey:
      normalizeOptionalValue(env.VITE_MATCHFLOW_LOCAL_TEST_SERVER_API_KEY) ||
      defaultPreset.matchDataApiKey,
  };
}
