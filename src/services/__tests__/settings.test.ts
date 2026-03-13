import { beforeEach, describe, expect, it } from 'vitest';
import {
  getSettings,
  normalizeSettings,
} from '@/src/services/settings';

describe('settings normalization and migration', () => {
  beforeEach(() => {
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

  it('migrates legacy settings into the formal v3 shape without dropping connection configuration', () => {
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
});
