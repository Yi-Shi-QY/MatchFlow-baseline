import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE } from '@/src/domains/runtime/projectOps/workflowType';
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

  it('prefers tool-authored agent text when the stream also contains a natural-language recap', async () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      provider: 'deepseek',
      model: 'deepseek-chat',
      deepseekApiKey: 'sk-deepseek',
    });

    streamAIRequestMock.mockImplementation(async function* () {
      yield '[SYSTEM] Tool result: {"agentText":"Need factors first","messageKind":"text"}\n';
      yield 'I will help you analyze that now. First, tell me which factors to prioritize.';
    });

    const planner = createLegacyManagerGatewayLlmPlanner();
    const result = await planner.planTurn(createPlannerInput());

    expect(result?.blocks[0]).toMatchObject({
      blockType: 'assistant_text',
      role: 'assistant',
      text: 'Need factors first',
    });
    expect(result?.diagnostics?.feedbackMessage).toBe('Need factors first');
  });

  it('passes generic intake workflow context to the agent prompt', async () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      provider: 'deepseek',
      model: 'deepseek-chat',
      deepseekApiKey: 'sk-deepseek',
    });

    const systemPromptMock = vi.fn().mockReturnValue('manager prompt');
    getAgentMock.mockReturnValue({
      id: 'manager_command_center',
      skills: [],
      systemPrompt: systemPromptMock,
    });

    streamAIRequestMock.mockImplementation(async function* () {
      yield '[SYSTEM] Tool result: {"agentText":"Handled by project ops","messageKind":"text"}';
    });

    const planner = createLegacyManagerGatewayLlmPlanner();
    await planner.planTurn(
      createPlannerInput({
        runtimePack: createRuntimePack({
          manifest: {
            domainId: 'project_ops',
            displayName: 'Project Ops',
            version: '1.0.0',
          },
          manager: {
            domainId: 'project_ops',
            skillIds: ['manager_continue_task_intake', 'manager_help'],
            plannerHints: {
              defaultWorkflowType: PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE,
            },
            taskIntake: {
              definition: {
                workflowType: PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE,
                title: { en: 'Project intake' },
                slots: [],
                steps: [
                  {
                    stepId: 'focus_dimensions',
                    title: { en: 'Choose focus areas' },
                    slotIds: ['focus_dimensions'],
                  },
                ],
              },
              parseInput: () => ({}),
              buildPrompt: () => ({ body: 'prompt body' }),
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
        projection: {
          ...createPlannerInput().projection,
          session: {
            ...createPlannerInput().projection.session,
            domainId: 'project_ops',
          },
          runtimeDomainId: 'project_ops',
          activeWorkflow: {
            workflowType: PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE,
            stateData: {
              schemaVersion: 'manager_intake_v1',
              workflowId: 'project_ops_intake_1',
              workflowType: PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE,
              domainId: 'project_ops',
              sourceText: 'Analyze Q2 Mobile Launch now',
              composerMode: 'smart',
              drafts: [],
              slotValues: {},
              recognizedSlotIds: ['target_subject'],
              missingSlotIds: ['focus_dimensions'],
              activeStepId: 'focus_dimensions',
              completed: false,
              createdAt: 100,
              updatedAt: 100,
            },
          },
        },
      }),
    );

    expect(systemPromptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        managerTaskIntake: expect.objectContaining({
          workflowType: PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE,
          sourceText: 'Analyze Q2 Mobile Launch now',
          activeStepId: 'focus_dimensions',
          activeStepTitle: 'Choose focus areas',
          recognizedSlotIds: ['target_subject'],
          missingSlotIds: ['focus_dimensions'],
          completed: false,
        }),
      }),
    );
  });

  it('strips reasoning tags from direct replies for reasoning models', async () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      provider: 'deepseek',
      model: 'deepseek-r1',
      deepseekApiKey: 'sk-deepseek',
    });

    streamAIRequestMock.mockImplementation(async function* () {
      yield '<think>I should answer directly.</think>\nPlanner ready.';
    });

    const planner = createLegacyManagerGatewayLlmPlanner();
    const result = await planner.planTurn(createPlannerInput());

    expect(result?.blocks[0]).toMatchObject({
      blockType: 'assistant_text',
      role: 'assistant',
      text: 'Planner ready.',
    });
  });
});
