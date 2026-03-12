import { describe, expect, it } from 'vitest';
import { FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE } from '@/src/domains/runtime/football/tools';
import type { ManagerSessionProjection } from '@/src/services/manager-gateway/types';
import type { ManagerPendingTask } from '@/src/services/manager/types';
import { projectManagerSessionProjectionToLegacySnapshot } from '@/src/services/manager-gateway/legacyCompat';

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
      title: 'Main session',
      status: 'active',
      domainId: 'football',
      runtimeDomainVersion: '1.0.0',
      activeWorkflowType: null,
      activeWorkflowStateData: null,
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
    ...overrides,
  };
}

describe('manager legacy compat', () => {
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
});
