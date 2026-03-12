import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveAutomationRuntimePollingDecision } from '@/src/services/automation/runtimeCoordinator';

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
}));

vi.mock('@/src/services/settings', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/settings')>(
    '@/src/services/settings',
  );
  return {
    ...actual,
    getSettings: mocks.getSettings,
  };
});

describe('resolveAutomationRuntimePollingDecision', () => {
  beforeEach(() => {
    mocks.getSettings.mockReset();
    mocks.getSettings.mockReturnValue({
      provider: 'gemini',
      model: 'gemini-3-flash-preview',
      agentModelMode: 'global',
      activeDomainId: 'football',
      skillHttpAllowedHosts: [],
      deepseekApiKey: '',
      geminiApiKey: '',
      openaiCompatibleBaseUrl: 'https://api.openai.com/v1',
      openaiCompatibleApiKey: '',
      matchDataServerUrl: '',
      matchDataApiKey: '',
      language: 'zh',
      theme: 'dark',
      enableAutomation: false,
      enableBackgroundMode: false,
      enableAutonomousPlanning: false,
    });
  });

  it('does not poll when automation is disabled', () => {
    const decision = resolveAutomationRuntimePollingDecision({
      automationEnabled: false,
      isAppActive: true,
      hostType: 'android_native',
    });

    expect(decision.shouldPoll).toBe(false);
    expect(decision.reason).toBe('automation_disabled');
  });

  it('polls in foreground when automation is enabled', () => {
    const decision = resolveAutomationRuntimePollingDecision({
      automationEnabled: true,
      isAppActive: true,
      hostType: 'browser_web',
    });

    expect(decision.shouldPoll).toBe(true);
    expect(decision.reason).toBe('app_active');
  });

  it('keeps browser web paused in background even if automation and background mode are on', () => {
    const decision = resolveAutomationRuntimePollingDecision({
      automationEnabled: true,
      backgroundEnabled: true,
      isAppActive: false,
      hostType: 'browser_web',
    });

    expect(decision.shouldPoll).toBe(false);
    expect(decision.reason).toBe('host_not_durable');
  });

  it('allows a durable background host when background mode is enabled', () => {
    const decision = resolveAutomationRuntimePollingDecision({
      automationEnabled: true,
      backgroundEnabled: true,
      isAppActive: false,
      hostType: 'android_native',
    });

    expect(decision.shouldPoll).toBe(true);
    expect(decision.reason).toBe('background_host_available');
  });
});
