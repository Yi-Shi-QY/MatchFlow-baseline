import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/src/services/settings';
import { resolveRuntimeModelRoute } from '@/src/services/ai/runtimeModel';

describe('resolveRuntimeModelRoute', () => {
  it('falls back to the global route when config mode points to a provider without credentials', () => {
    const route = resolveRuntimeModelRoute(
      {
        ...DEFAULT_SETTINGS,
        provider: 'deepseek',
        model: 'deepseek-chat',
        deepseekApiKey: 'sk-deepseek',
        agentModelMode: 'config',
        geminiApiKey: '',
      },
      'manager_command_center',
    );

    expect(route).toEqual({
      provider: 'deepseek',
      model: 'deepseek-chat',
      source: 'global_fallback',
    });
  });

  it('keeps the configured route when that provider has usable credentials', () => {
    const route = resolveRuntimeModelRoute(
      {
        ...DEFAULT_SETTINGS,
        provider: 'deepseek',
        model: 'deepseek-chat',
        deepseekApiKey: 'sk-deepseek',
        geminiApiKey: 'sk-gemini',
        agentModelMode: 'config',
      },
      'manager_command_center',
    );

    expect(route).toEqual({
      provider: 'gemini',
      model: 'gemini-3-flash-preview',
      source: 'config',
    });
  });
});
