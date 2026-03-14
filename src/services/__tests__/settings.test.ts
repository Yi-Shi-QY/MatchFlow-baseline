import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('settings normalization and migration', () => {
  beforeEach(() => {
    vi.resetModules();
    const map = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        get length() {
          return map.size;
        },
        clear() {
          map.clear();
        },
        getItem(key: string) {
          return map.has(key) ? map.get(key)! : null;
        },
        key(index: number) {
          return Array.from(map.keys())[index] ?? null;
        },
        removeItem(key: string) {
          map.delete(key);
        },
        setItem(key: string, value: string) {
          map.set(key, value);
        },
      } satisfies Storage,
      configurable: true,
    });
    localStorage.clear();
  });

  it('migrates legacy settings into the formal v3 shape without dropping connection configuration', async () => {
    const { getSettings, normalizeSettings } = await import('@/src/services/settings');
    const legacySettings = {
      provider: 'deepseek',
      model: 'deepseek-chat',
      activeDomainId: 'football',
      language: 'zh',
      theme: 'light',
      enableAutomation: true,
      enableBackgroundMode: true,
      enableAutonomousPlanning: false,
      deepseekApiKey: 'secret',
      matchDataServerUrl: 'http://localhost:3030',
      matchDataApiKey: 'data-key',
    };

    localStorage.setItem('matchflow_settings_v2', JSON.stringify(legacySettings));

    const normalized = normalizeSettings(legacySettings);
    const persisted = getSettings();

    expect(normalized.enableDailyMemorySummary).toBe(true);
    expect(normalized.showSuggestionReplies).toBe(true);
    expect(persisted.matchDataServerUrl).toBe('http://localhost:3030');
    expect(persisted.deepseekApiKey).toBe('secret');
  });

  it('defaults automation to enabled when the stored flag is absent', async () => {
    const { getSettings, normalizeSettings } = await import('@/src/services/settings');
    const legacySettings = {
      provider: 'gemini',
      model: 'gemini-3-flash-preview',
      language: 'en',
    };

    localStorage.setItem('matchflow_settings_v2', JSON.stringify(legacySettings));

    expect(normalizeSettings(legacySettings).enableAutomation).toBe(true);
    expect(getSettings().enableAutomation).toBe(true);
  });

  it('preserves an explicit automation-off choice', async () => {
    const { normalizeSettings } = await import('@/src/services/settings');

    expect(
      normalizeSettings({
        enableAutomation: false,
      }).enableAutomation,
    ).toBe(false);
  });

  it('normalizes an empty active domain back to the configured default domain', async () => {
    const { DEFAULT_SETTINGS, normalizeSettings } = await import('@/src/services/settings');

    expect(
      normalizeSettings({
        activeDomainId: '   ',
      }).activeDomainId,
    ).toBe(DEFAULT_SETTINGS.activeDomainId);
  });
});
