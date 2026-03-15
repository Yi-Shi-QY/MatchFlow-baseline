import { describe, expect, it } from 'vitest';
import {
  activateCompositeItem,
  completeCompositeItem,
  createCompositeWorkflow,
  parseCompositeWorkflowSnapshot,
  serializeCompositeWorkflow,
  syncChildStateIntoCompositeItem,
} from '@/src/services/manager-orchestration/compositeWorkflow';
import type { ManagerRoutingResult } from '@/src/services/manager-orchestration/types';

function createRoutingResult(): ManagerRoutingResult {
  return {
    mode: 'composite',
    items: [
      {
        domainId: 'football',
        sourceText: 'Analyze Real Madrid vs Barcelona',
        confidence: 0.96,
      },
      {
        domainId: 'project_ops',
        sourceText: 'Review Q2 mobile launch blockers',
        confidence: 0.89,
      },
    ],
  };
}

describe('manager composite workflow', () => {
  it('creates a composite workflow from the routing result', () => {
    const workflow = createCompositeWorkflow({
      workflowId: 'manager_composite_1',
      sourceText: 'Analyze football and project ops',
      routingResult: createRoutingResult(),
      now: 100,
    });

    expect(workflow).toMatchObject({
      schemaVersion: 'manager_composite_v1',
      workflowId: 'manager_composite_1',
      workflowType: 'manager_composite',
      sourceText: 'Analyze football and project ops',
      status: 'active',
      createdAt: 100,
      updatedAt: 100,
    });
    expect(workflow.items).toHaveLength(2);
    expect(workflow.activeItemId).toBe(workflow.items[0].itemId);
    expect(workflow.items[0]).toMatchObject({
      domainId: 'football',
      sourceText: 'Analyze Real Madrid vs Barcelona',
      status: 'active',
    });
    expect(workflow.items[1]).toMatchObject({
      domainId: 'project_ops',
      sourceText: 'Review Q2 mobile launch blockers',
      status: 'pending',
    });
  });

  it('switches the active composite item deterministically', () => {
    const workflow = createCompositeWorkflow({
      workflowId: 'manager_composite_2',
      sourceText: 'Analyze football and project ops',
      routingResult: createRoutingResult(),
      now: 100,
    });

    const switched = activateCompositeItem(workflow, {
      itemId: workflow.items[1].itemId,
      now: 120,
    });

    expect(switched.activeItemId).toBe(workflow.items[1].itemId);
    expect(switched.status).toBe('active');
    expect(switched.updatedAt).toBe(120);
    expect(switched.items[0].status).toBe('pending');
    expect(switched.items[1].status).toBe('active');
  });

  it('syncs child state and advances item completion', () => {
    const workflow = createCompositeWorkflow({
      workflowId: 'manager_composite_3',
      sourceText: 'Analyze football and project ops',
      routingResult: createRoutingResult(),
      now: 100,
    });

    const synced = syncChildStateIntoCompositeItem(workflow, {
      itemId: workflow.items[0].itemId,
      status: 'active',
      childSessionId: 'child_session_1',
      childWorkflowType: 'football_task_intake',
      childWorkflowStateData: {
        activeStepId: 'analysis_dimensions',
      },
      pendingLabel: 'Choose analysis factors',
      now: 110,
    });

    expect(synced.items[0]).toMatchObject({
      status: 'active',
      childSessionId: 'child_session_1',
      childWorkflowType: 'football_task_intake',
      pendingLabel: 'Choose analysis factors',
    });

    const afterFirstComplete = completeCompositeItem(synced, {
      itemId: workflow.items[0].itemId,
      summary: 'Football analysis configured',
      now: 130,
    });

    expect(afterFirstComplete.status).toBe('active');
    expect(afterFirstComplete.items[0]).toMatchObject({
      status: 'completed',
      summary: 'Football analysis configured',
    });
    expect(afterFirstComplete.activeItemId).toBe(workflow.items[1].itemId);
    expect(afterFirstComplete.items[1].status).toBe('active');

    const afterAllComplete = completeCompositeItem(afterFirstComplete, {
      itemId: workflow.items[1].itemId,
      summary: 'Project ops analysis configured',
      now: 150,
    });

    expect(afterAllComplete.status).toBe('completed');
    expect(afterAllComplete.activeItemId).toBeNull();
    expect(afterAllComplete.items.every((item) => item.status === 'completed')).toBe(true);
  });

  it('serializes and restores the composite workflow snapshot', () => {
    const workflow = createCompositeWorkflow({
      workflowId: 'manager_composite_4',
      sourceText: 'Analyze football and project ops',
      routingResult: createRoutingResult(),
      now: 100,
    });
    const serialized = serializeCompositeWorkflow(workflow);
    const restored = parseCompositeWorkflowSnapshot(serialized);

    expect(restored).toEqual(workflow);
    expect(parseCompositeWorkflowSnapshot('{"workflowType":"other"}')).toBeNull();
  });
});
