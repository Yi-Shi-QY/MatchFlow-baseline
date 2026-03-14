import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AutomationDraft,
  AutomationJob,
  AutomationRule,
} from '@/src/services/automation/types';

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  listAutomationJobs: vi.fn(),
  listAutomationRules: vi.fn(),
}));

vi.mock('@/src/services/settings', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/settings')>(
    '@/src/services/settings',
  );
  return {
    ...actual,
    getSettings: mocks.getSettings,
    saveSettings: mocks.saveSettings,
  };
});

vi.mock('@/src/services/automation/jobStore', () => ({
  listAutomationJobs: mocks.listAutomationJobs,
}));

vi.mock('@/src/services/automation/ruleStore', () => ({
  listAutomationRules: mocks.listAutomationRules,
}));

function createSettings(overrides: Record<string, unknown> = {}) {
  return {
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
    rememberUserPreferences: true,
    requireMemoryConfirmation: true,
    enableDailyMemorySummary: true,
    showSuggestionReplies: true,
    ...overrides,
  };
}

function createDraft(overrides: Partial<AutomationDraft> = {}): AutomationDraft {
  return {
    id: 'draft_1',
    sourceText: 'Analyze Real Madrid vs Barcelona tonight',
    title: 'Analyze Real Madrid vs Barcelona',
    status: 'ready',
    intentType: 'one_time',
    activationMode: 'save_only',
    domainId: 'football',
    domainPackVersion: '1.0.0',
    templateId: undefined,
    schedule: {
      type: 'one_time',
      runAt: '2026-03-14T12:00:00.000Z',
      timezone: 'Asia/Shanghai',
    },
    targetSelector: {
      mode: 'fixed_subject',
      subjectId: 'match_1',
      subjectLabel: 'Real Madrid vs Barcelona',
    },
    executionPolicy: {
      targetExpansion: 'single',
      recoveryWindowMinutes: 30,
      maxRetries: 1,
    },
    notificationPolicy: {
      notifyOnClarification: true,
      notifyOnStart: true,
      notifyOnComplete: true,
      notifyOnFailure: true,
    },
    analysisProfile: undefined,
    clarificationState: {
      roundsUsed: 0,
    },
    rejectionReason: undefined,
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  };
}

function createJob(overrides: Partial<AutomationJob> = {}): AutomationJob {
  const now = Date.now();
  return {
    id: 'job_1',
    title: 'Analyze Real Madrid vs Barcelona',
    sourceDraftId: 'draft_1',
    sourceRuleId: undefined,
    domainId: 'football',
    domainPackVersion: '1.0.0',
    templateId: undefined,
    triggerType: 'one_time',
    targetSelector: {
      mode: 'fixed_subject',
      subjectId: 'match_1',
      subjectLabel: 'Real Madrid vs Barcelona',
    },
    targetSnapshot: undefined,
    notificationPolicy: {
      notifyOnClarification: true,
      notifyOnStart: true,
      notifyOnComplete: true,
      notifyOnFailure: true,
    },
    analysisProfile: undefined,
    scheduledFor: '2026-03-14T12:00:00.000Z',
    state: 'pending',
    retryCount: 0,
    maxRetries: 1,
    retryAfter: null,
    recoveryWindowEndsAt: '2026-03-14T12:30:00.000Z',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  const now = Date.now();
  return {
    id: 'rule_1',
    title: 'Daily La Liga scan',
    enabled: true,
    sourceDraftId: 'draft_1',
    domainId: 'football',
    domainPackVersion: '1.0.0',
    templateId: undefined,
    schedule: {
      type: 'daily',
      time: '09:00',
      timezone: 'Asia/Shanghai',
    },
    targetSelector: {
      mode: 'league_query',
      leagueKey: 'la_liga',
      leagueLabel: 'La Liga',
    },
    executionPolicy: {
      targetExpansion: 'all_matches',
      recoveryWindowMinutes: 30,
      maxRetries: 1,
    },
    notificationPolicy: {
      notifyOnClarification: true,
      notifyOnStart: true,
      notifyOnComplete: true,
      notifyOnFailure: true,
    },
    analysisProfile: undefined,
    nextPlannedAt: '2026-03-14T01:00:00.000Z',
    timezone: 'Asia/Shanghai',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('automation execution settings', () => {
  let currentSettings = createSettings();

  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    currentSettings = createSettings();
    mocks.getSettings.mockImplementation(() => currentSettings);
    mocks.saveSettings.mockImplementation((nextSettings) => {
      currentSettings = nextSettings;
    });
    mocks.listAutomationJobs.mockResolvedValue([]);
    mocks.listAutomationRules.mockResolvedValue([]);
  });

  it('auto-enables automation and background for scheduled draft activation on a durable host', async () => {
    const { ensureAutomationExecutionSettingsForDraft } = await import(
      '@/src/services/automation/executionSettings'
    );

    const result = ensureAutomationExecutionSettingsForDraft(createDraft(), {
      hostType: 'android_native',
    });

    expect(result).toMatchObject({
      changed: true,
      autoEnabledAutomation: true,
      autoEnabledBackground: true,
    });
    expect(mocks.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        enableAutomation: true,
        enableBackgroundMode: true,
      }),
    );
  });

  it('keeps background mode unchanged for run-now activation', async () => {
    const { ensureAutomationExecutionSettingsForDraft } = await import(
      '@/src/services/automation/executionSettings'
    );

    const result = ensureAutomationExecutionSettingsForDraft(
      createDraft({
        activationMode: 'run_now',
      }),
      {
        hostType: 'android_native',
      },
    );

    expect(result).toMatchObject({
      changed: true,
      autoEnabledAutomation: true,
      autoEnabledBackground: false,
    });
    expect(mocks.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        enableAutomation: true,
        enableBackgroundMode: false,
      }),
    );
  });

  it('repairs legacy disabled settings once when active workload already exists', async () => {
    mocks.listAutomationJobs.mockResolvedValue([createJob()]);
    mocks.listAutomationRules.mockResolvedValue([createRule()]);

    const { repairLegacyAutomationExecutionSettings } = await import(
      '@/src/services/automation/executionSettings'
    );

    const result = await repairLegacyAutomationExecutionSettings({
      hostType: 'android_native',
    });

    expect(result).toMatchObject({
      changed: true,
      autoEnabledAutomation: true,
      autoEnabledBackground: true,
    });
    expect(mocks.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        enableAutomation: true,
        enableBackgroundMode: true,
      }),
    );

    mocks.saveSettings.mockClear();
    const second = await repairLegacyAutomationExecutionSettings({
      hostType: 'android_native',
    });
    expect(second.changed).toBe(false);
    expect(mocks.saveSettings).not.toHaveBeenCalled();
  });
});
