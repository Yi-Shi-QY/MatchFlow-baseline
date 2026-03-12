import { describe, expect, it } from 'vitest';
import {
  LOCAL_FOOTBALL_TEST_SERVER_API_KEY,
  getConfiguredLocalFootballTestServerPreset,
  getLocalFootballTestServerPreset,
} from '@/src/services/localFootballTestServer';
import { DEFAULT_SETTINGS, resolveDefaultSettings } from '@/src/services/settings';

describe('local football test server preset', () => {
  it('uses localhost for web runtime', () => {
    const preset = getLocalFootballTestServerPreset({
      nativePlatform: false,
      platform: 'web',
    });

    expect(preset.matchDataServerUrl).toBe('http://127.0.0.1:3001');
    expect(preset.matchDataApiKey).toBe(LOCAL_FOOTBALL_TEST_SERVER_API_KEY);
  });

  it('uses 10.0.2.2 for android native runtime', () => {
    const preset = getLocalFootballTestServerPreset({
      nativePlatform: true,
      platform: 'android',
    });

    expect(preset.matchDataServerUrl).toBe('http://10.0.2.2:3001');
    expect(preset.matchDataApiKey).toBe(LOCAL_FOOTBALL_TEST_SERVER_API_KEY);
  });

  it('returns null when build preset is disabled', () => {
    const preset = getConfiguredLocalFootballTestServerPreset({
      env: {
        VITE_MATCHFLOW_LOCAL_TEST_SERVER_PRESET: '0',
      },
      runtime: {
        nativePlatform: false,
        platform: 'web',
      },
    });

    expect(preset).toBeNull();
  });

  it('uses configured runtime-specific preset values when enabled', () => {
    const preset = getConfiguredLocalFootballTestServerPreset({
      env: {
        VITE_MATCHFLOW_LOCAL_TEST_SERVER_PRESET: 'true',
        VITE_MATCHFLOW_LOCAL_TEST_SERVER_URL: 'http://127.0.0.1:3901',
        VITE_MATCHFLOW_LOCAL_TEST_SERVER_ANDROID_URL: 'http://10.0.2.2:3901',
        VITE_MATCHFLOW_LOCAL_TEST_SERVER_API_KEY: 'local-test-key',
      },
      runtime: {
        nativePlatform: true,
        platform: 'android',
      },
    });

    expect(preset).toEqual({
      matchDataServerUrl: 'http://10.0.2.2:3901',
      matchDataApiKey: 'local-test-key',
    });
  });

  it('injects preset defaults into settings when enabled', () => {
    const defaults = resolveDefaultSettings({
      env: {
        VITE_MATCHFLOW_LOCAL_TEST_SERVER_PRESET: '1',
      },
      runtime: {
        nativePlatform: false,
        platform: 'web',
      },
    });

    expect(defaults.matchDataServerUrl).toBe('http://127.0.0.1:3001');
    expect(defaults.matchDataApiKey).toBe(LOCAL_FOOTBALL_TEST_SERVER_API_KEY);
    expect(defaults.provider).toBe(DEFAULT_SETTINGS.provider);
    expect(defaults.activeDomainId).toBe(DEFAULT_SETTINGS.activeDomainId);
  });
});
