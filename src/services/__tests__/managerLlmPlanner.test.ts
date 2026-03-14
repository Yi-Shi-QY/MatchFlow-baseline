import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DomainRuntimePack } from '@/src/domains/runtime/types';
import { createLegacyManagerGatewayLlmPlanner } from '@/src/services/manager/llmPlanner';
import type { ManagerGatewayLlmPlanner } from '@/src/services/manager-gateway/types';
import { DEFAULT_SETTINGS, saveSettings } from '@/src/services/settings';

const getAgentMock = vi.fn();
const streamAIRequestMock = vi.fn();

vi.mock('@/src/agents', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/src/agents')>();
  return {
    ...actual,
    getAgent: (...args: unknown[]) => getAgentMock(...args),
  };
});

vi.mock('@/src/services/ai/streamRequest', () => ({
  streamAIRequest: (...args: unknown[]) => streamAIRequestMock(...args),
}));

function createStorage(): Storage {
  const map = new Map<string, string>();
  return {
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
  };
}

function createRuntimePack(
  overrides: {
    manifest?: Partial<DomainRuntimePack['manifest']>;
    manager?: DomainRuntimePack['manager'];
  } = {},
): Parameters<ManagerGatewayLlmPlanner['planTurn']>[0]['runtimePack'] {
  const baseRuntimePack = {
    manifest: {
      domainId: 'football',
      displayName: 'Football',
      version: '1.0.0',
      supportedIntentTypes: [],
      supportedEventTypes: [],
      supportedFactorIds: [],
    },
    manager: {
      domainId: 'football',
      skillIds: ['manager_help'],
      plannerHints: {
        defaultWorkflowType: 'football_task_intake',
      },
      parsePendingTask: () => null,
      mapLegacyEffect: (effect) => ({
        blocks: [
          {
            blockType: effect.messageKind === 'draft_bundle' ? 'draft_bundle' : 'assistant_text',
            role: 'assistant',
            text: effect.agentText,
          },
        ],
        diagnostics: {
          feedbackMessage: effect.feedbackMessage || effect.agentText,
        },
      }),
    },
    resolver: {
      async resolveIntent() {
        return null;
      },
      async resolveSubjects() {
        return [];
      },
      async resolveEvents() {
        return [];
      },
    },
    sourceAdapters: [],
    contextProviders: [],
    tools: [],
  } as unknown as Parameters<ManagerGatewayLlmPlanner['planTurn']>[0]['runtimePack'];

  return {
    ...baseRuntimePack,
    ...overrides,
    manifest: {
      ...baseRuntimePack.manifest,
      ...(overrides.manifest || {}),
    },
  } as Parameters<ManagerGatewayLlmPlanner['planTurn']>[0]['runtimePack'];
}

function createPlannerInput(
  overrides: Partial<Parameters<ManagerGatewayLlmPlanner['planTurn']>[0]> = {},
): Parameters<ManagerGatewayLlmPlanner['planTurn']>[0] {
  return {
    input: 'Analyze Real Madrid vs Barcelona tonight',
    language: 'en' as const,
    requireLlm: true,
    projection: {
      session: {
        id: 'session_1',
        sessionKey: 'main',
        title: 'Football',
        status: 'active' as const,
        domainId: 'football',
        latestMessageAt: 0,
        createdAt: 0,
        updatedAt: 0,
      },
      runtimeDomainId: 'football',
      runtimeDomainVersion: '1',
      feed: [],
      activeRun: null,
      latestRun: null,
      activeWorkflow: null,
    },
    runtimePack: createRuntimePack(),
    recentMessages: [],
    ...overrides,
  } as Parameters<ManagerGatewayLlmPlanner['planTurn']>[0];
}

describe('createLegacyManagerGatewayLlmPlanner', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: createStorage(),
      configurable: true,
    });
    localStorage.clear();
    saveSettings({ ...DEFAULT_SETTINGS });

    getAgentMock.mockReset();
    getAgentMock.mockReturnValue({
      id: 'manager_command_center',
      skills: [],
      systemPrompt: () => 'manager prompt',
    });

    streamAIRequestMock.mockReset();
  });

  it('uses the global provider when a hidden config route lacks credentials', async () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      provider: 'deepseek',
      model: 'deepseek-chat',
      deepseekApiKey: 'sk-deepseek',
      geminiApiKey: '',
      agentModelMode: 'config',
    });

    streamAIRequestMock.mockImplementation(async function* () {
      yield 'Planner ready.';
    });

    const planner = createLegacyManagerGatewayLlmPlanner();
    const result = await planner.planTurn(createPlannerInput());

    expect(streamAIRequestMock).toHaveBeenCalledTimes(1);
    expect(result?.blocks[0]).toMatchObject({
      blockType: 'assistant_text',
      role: 'assistant',
      text: 'Planner ready.',
    });
  });

  it('returns null when the provider responds with a non-blocking runtime error', async () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      provider: 'deepseek',
      model: 'deepseek-chat',
      deepseekApiKey: 'sk-deepseek',
    });

    streamAIRequestMock.mockImplementation(async function* () {
      yield '\n[ERROR] DeepSeek API error: invalid api key\n';
    });

    const planner = createLegacyManagerGatewayLlmPlanner();
    const result = await planner.planTurn(createPlannerInput());

    expect(result).toBeNull();
  });

  it('accepts non-football runtime packs when they provide a manager capability bridge', async () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      provider: 'deepseek',
      model: 'deepseek-chat',
      deepseekApiKey: 'sk-deepseek',
    });

    streamAIRequestMock.mockImplementation(async function* () {
      yield '[SYSTEM] Tool result: {"agentText":"Handled by project ops","messageKind":"text"}';
    });

    const planner = createLegacyManagerGatewayLlmPlanner();
    const result = await planner.planTurn(
      createPlannerInput({
        runtimePack: createRuntimePack({
          manifest: {
            domainId: 'project_ops',
            displayName: 'Project Ops',
            version: '1.0.0',
          },
          manager: {
            domainId: 'project_ops',
            skillIds: ['manager_help'],
            plannerHints: {
              defaultWorkflowType: 'project_ops_task_intake',
            },
            parsePendingTask: () => null,
            mapLegacyEffect: (effect) => ({
              blocks: [
                {
                  blockType: 'assistant_text',
                  role: 'assistant',
                  text: effect.agentText,
                },
              ],
              diagnostics: {
                feedbackMessage: effect.feedbackMessage || effect.agentText,
              },
            }),
          },
        }),
      }),
    );

    expect(result?.blocks[0]).toMatchObject({
      blockType: 'assistant_text',
      role: 'assistant',
      text: 'Handled by project ops',
    });
  });
});
