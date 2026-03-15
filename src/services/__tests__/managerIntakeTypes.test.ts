import { describe, expect, it } from 'vitest';
import type { ManagerIntakeWorkflowState } from '@/src/services/manager-intake/types';
import {
  createManagerIntakeWorkflowSnapshot,
  isManagerIntakeWorkflowState,
  parseManagerIntakeWorkflowSnapshot,
} from '@/src/services/manager-intake/workflowProjection';

function createState(): ManagerIntakeWorkflowState {
  return {
    schemaVersion: 'manager_intake_v1',
    workflowId: 'manager_intake_1',
    workflowType: 'demo_workflow',
    domainId: 'demo',
    sourceText: 'Analyze the launch plan',
    composerMode: 'smart',
    drafts: [],
    slotValues: {
      subject: 'launch plan',
    },
    recognizedSlotIds: ['subject'],
    missingSlotIds: ['focus_dimensions'],
    activeStepId: 'focus_dimensions',
    completed: false,
    metadata: {
      source: 'unit_test',
    },
    createdAt: 100,
    updatedAt: 200,
  };
}

describe('manager intake workflow projection', () => {
  it('round-trips a generic intake workflow state through the session workflow snapshot', () => {
    const state = createState();
    const snapshot = createManagerIntakeWorkflowSnapshot(state);

    expect(snapshot.workflowType).toBe('demo_workflow');
    expect(isManagerIntakeWorkflowState(snapshot.stateData)).toBe(true);
    expect(parseManagerIntakeWorkflowSnapshot(snapshot)).toEqual(state);
  });

  it('rejects unrelated workflow snapshots', () => {
    expect(
      parseManagerIntakeWorkflowSnapshot({
        workflowType: 'other_workflow',
        stateData: {
          foo: 'bar',
        },
      }),
    ).toBeNull();
  });
});
