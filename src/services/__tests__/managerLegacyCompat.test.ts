import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE } from '@/src/domains/runtime/football/workflowType';
import { PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE } from '@/src/domains/runtime/projectOps/workflowType';
import type { ManagerSessionProjection } from '@/src/services/manager-gateway/types';
import type { ManagerPendingTask } from '@/src/services/manager/types';
import { projectManagerSessionProjectionToLegacySnapshot } from '@/src/services/manager-gateway/legacyCompat';

const registryMocks = vi.hoisted(() => ({
  getRuntimeDomainPackById: vi.fn(),
  getDefaultRuntimeDomainPack: vi.fn(),
}));

vi.mock('@/src/domains/runtime/registry', () => {
  return {
    getRuntimeDomainPackById: (...args: unknown[]) => registryMocks.getRuntimeDomainPackById(...args),
    getDefaultRuntimeDomainPack: (...args: unknown[]) =>
      registryMocks.getDefaultRuntimeDomainPack(...args),
    resolveRuntimeDomainPack: (domainId?: string | null) =>
      registryMocks.getRuntimeDomainPackById(domainId) ||
      registryMocks.getDefaultRuntimeDomainPack(),
  };
});

function createPendingTask(): ManagerPendingTask {
  return {
    id: 'pending_1',
    sourceText: 'Analyze Arsenal vs Chelsea tonight',
    composerMode: 'smart',
    drafts: [],
    stage: 'await_sequence',
    selectedSourceIds: ['fundamental', 'market'],
    sequencePreference: ['fundamental', 'market', 'prediction'],
    createdAt: 100,
  };
}

function createProjection(
  overrides: Partial<ManagerSessionProjection> = {},
): ManagerSessionProjection {
  return {
    session: {
      id: 'session_main',
      sessionKey: 'manager:main',
      sessionKind: 'domain_main',
      title: 'Main session',
      status: 'active',
      domainId: 'football',
      runtimeDomainVersion: '1.0.0',
      activeWorkflowType: null,
      activeWorkflowStateData: null,
      compositeWorkflowStateData: null,
      latestSummaryId: null,
      latestMessageAt: 300,
      createdAt: 100,
      updatedAt: 300,
    },
    runtimeDomainId: 'football',
    runtimeDomainVersion: '1.0.0',
    feed: [],
    activeRun: null,
    latestRun: null,
    activeWorkflow: null,
    compositeWorkflow: null,
    ...overrides,
  };
}

describe('manager legacy compat', () => {
  beforeEach(() => {
    registryMocks.getRuntimeDomainPackById.mockReset();
    registryMocks.getDefaultRuntimeDomainPack.mockReset();
    registryMocks.getRuntimeDomainPackById.mockImplementation((domainId?: string | null) => {
      if (domainId === 'football') {
        return {
          manifest: {
            domainId: 'football',
          },
          manager: {
            domainId: 'football',
            skillIds: ['manager_continue_task_intake'],
            parsePendingTask: (workflow: { workflowType?: string; stateData?: unknown } | null) =>
              workflow?.workflowType === FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE
                ? (workflow.stateData as Record<string, unknown>)
                : null,
          },
        };
      }
      return null;
    });
    registryMocks.getDefaultRuntimeDomainPack.mockReturnValue({
      manifest: {
        domainId: 'football',
      },
      manager: {
        domainId: 'football',
        skillIds: ['manager_continue_task_intake'],
        parsePendingTask: () => null,
      },
    });
  });

  it('projects gateway feed blocks back into the legacy manager snapshot shape', () => {
    const pendingTask = createPendingTask();
    const snapshot = projectManagerSessionProjectionToLegacySnapshot(
      createProjection({
        feed: [
          {
            id: 'msg_user_1',
            role: 'user',
            blockType: 'user_text',
            text: 'Analyze Arsenal vs Chelsea tonight',
            payloadData: null,
            createdAt: 100,
          },
          {
            id: 'msg_agent_1',
            role: 'assistant',
            blockType: 'assistant_text',
            text: 'Open Settings first.',
            payloadData: JSON.stringify({
              action: {
                type: 'open_settings',
                label: 'Open Settings',
              },
            }),
            createdAt: 200,
          },
          {
            id: 'msg_tool_1',
            role: 'system',
            blockType: 'tool_status',
            text: 'Calling tool',
            payloadData: null,
            createdAt: 250,
          },
          {
            id: 'msg_agent_2',
            role: 'assistant',
            blockType: 'draft_bundle',
            text: 'I prepared one draft.',
            payloadData: JSON.stringify({
              draftIds: ['draft_1'],
            }),
            createdAt: 300,
          },
        ],
        activeWorkflow: {
          workflowType: FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE,
          stateData: pendingTask as unknown as Record<string, unknown>,
          updatedAt: 300,
        },
      }),
    );

    expect(snapshot.pendingTask).toEqual(pendingTask);
    expect(snapshot.messages).toHaveLength(3);
    expect(snapshot.messages[0]).toMatchObject({
      id: 'msg_user_1',
      role: 'user',
      kind: 'text',
      text: 'Analyze Arsenal vs Chelsea tonight',
    });
    expect(snapshot.messages[1].action).toEqual({
      type: 'open_settings',
      label: 'Open Settings',
    });
    expect(snapshot.messages[2]).toMatchObject({
      id: 'msg_agent_2',
      role: 'agent',
      kind: 'draft_bundle',
      draftIds: ['draft_1'],
    });
  });

  it('reads pending workflow state from the active runtime-domain capability', () => {
    const pendingTask = createPendingTask();
    registryMocks.getRuntimeDomainPackById.mockImplementation((domainId?: string | null) => {
      if (domainId === 'project_ops') {
        return {
          manifest: {
            domainId: 'project_ops',
          },
          manager: {
            domainId: 'project_ops',
            skillIds: ['manager_continue_task_intake'],
            parsePendingTask: (workflow: { workflowType?: string; stateData?: unknown } | null) =>
              workflow?.workflowType === PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE
                ? (workflow.stateData as Record<string, unknown>)
                : null,
          },
        };
      }
      return null;
    });

    const snapshot = projectManagerSessionProjectionToLegacySnapshot(
      createProjection({
        session: {
          ...createProjection().session,
          domainId: 'project_ops',
        },
        runtimeDomainId: 'project_ops',
        activeWorkflow: {
          workflowType: PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE,
          stateData: pendingTask as unknown as Record<string, unknown>,
        },
      }),
    );

    expect(snapshot.pendingTask).toEqual(pendingTask);
  });

  it('projects the supervisor active child workflow and composite summaries into the legacy snapshot', () => {
    const pendingTask = createPendingTask();
    registryMocks.getRuntimeDomainPackById.mockImplementation((domainId?: string | null) => {
      if (domainId === 'project_ops') {
        return {
          manifest: {
            domainId: 'project_ops',
            displayName: 'Project Ops Runtime Pack',
          },
          manager: {
            domainId: 'project_ops',
            skillIds: ['manager_continue_task_intake'],
            parsePendingTask: (workflow: { workflowType?: string; stateData?: unknown } | null) =>
              workflow?.workflowType === PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE
                ? (workflow.stateData as Record<string, unknown>)
                : null,
          },
        };
      }

      if (domainId === 'football') {
        return {
          manifest: {
            domainId: 'football',
            displayName: 'Football Runtime Pack',
          },
          manager: {
            domainId: 'football',
            skillIds: ['manager_continue_task_intake'],
            parsePendingTask: (workflow: { workflowType?: string; stateData?: unknown } | null) =>
              workflow?.workflowType === FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE
                ? (workflow.stateData as Record<string, unknown>)
                : null,
          },
        };
      }

      return null;
    });

    const snapshot = projectManagerSessionProjectionToLegacySnapshot(
      createProjection({
        session: {
          ...createProjection().session,
          sessionKey: 'manager:main:supervisor',
          sessionKind: 'supervisor',
        },
        activeWorkflow: null,
        compositeWorkflow: {
          schemaVersion: 'manager_composite_v1',
          workflowId: 'manager_composite_1',
          workflowType: 'manager_composite',
          sourceText: 'Analyze football and project ops',
          status: 'active',
          activeItemId: 'item_project_ops',
          createdAt: 100,
          updatedAt: 300,
          items: [
            {
              itemId: 'item_football',
              title: 'Real Madrid vs Barcelona',
              domainId: 'football',
              sourceText: 'Analyze Real Madrid vs Barcelona',
              status: 'completed',
              summary: 'Football analysis configured.',
            },
            {
              itemId: 'item_project_ops',
              title: 'Q2 mobile launch blockers',
              domainId: 'project_ops',
              sourceText: 'Review Q2 mobile launch blockers',
              status: 'active',
              childWorkflowType: PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE,
              childWorkflowStateData: pendingTask as unknown as Record<string, unknown>,
              summary: 'Project ops intake is waiting for focus areas.',
            },
          ],
        },
      }),
    );

    expect(snapshot.pendingTask).toEqual(pendingTask);
    expect(snapshot.messages.map((message) => message.text)).toContain(
      '[Football] Football analysis configured.',
    );
    expect(snapshot.messages.map((message) => message.text)).toContain(
      '[Project Ops] Project ops intake is waiting for focus areas.',
    );
  });
});
