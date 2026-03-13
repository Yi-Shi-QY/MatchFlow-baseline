import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/src/services/settings';
import { deriveSettingsHomeModel } from '@/src/pages/settings/settingsHomeModel';

describe('settings home model', () => {
  it('keeps the frozen section order and exposes a Done primary action instead of a save-all action', () => {
    const model = deriveSettingsHomeModel({
      settings: {
        ...DEFAULT_SETTINGS,
        language: 'zh',
        theme: 'light',
        enableAutomation: true,
        enableBackgroundMode: true,
        rememberUserPreferences: true,
        requireMemoryConfirmation: true,
        enableDailyMemorySummary: true,
        showSuggestionReplies: true,
      },
      language: 'zh',
    });

    expect(model.sections.map((section) => section.id)).toEqual([
      'general',
      'execution',
      'memory',
      'connections',
      'diagnostics_entry',
    ]);
    expect(model.primaryAction.label).toBe('完成');
  });
});
