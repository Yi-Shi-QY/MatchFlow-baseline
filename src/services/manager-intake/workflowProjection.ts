import type { SessionWorkflowStateSnapshot } from '@/src/domains/runtime/types';
import type { ManagerIntakeWorkflowState } from './types';

export function isManagerIntakeWorkflowState(value: unknown): value is ManagerIntakeWorkflowState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.schemaVersion === 'manager_intake_v1' &&
    typeof candidate.workflowId === 'string' &&
    typeof candidate.workflowType === 'string' &&
    typeof candidate.domainId === 'string' &&
    typeof candidate.sourceText === 'string' &&
    Array.isArray(candidate.drafts) &&
    typeof candidate.slotValues === 'object' &&
    candidate.slotValues !== null &&
    Array.isArray(candidate.recognizedSlotIds) &&
    Array.isArray(candidate.missingSlotIds)
  );
}

export function createManagerIntakeWorkflowSnapshot(
  state: ManagerIntakeWorkflowState,
): SessionWorkflowStateSnapshot {
  return {
    workflowType: state.workflowType,
    stateData: JSON.parse(JSON.stringify(state)) as Record<string, unknown>,
    updatedAt: state.updatedAt,
  };
}

export function parseManagerIntakeWorkflowSnapshot(
  workflow: SessionWorkflowStateSnapshot | null | undefined,
  expectedWorkflowType?: string,
): ManagerIntakeWorkflowState | null {
  if (!workflow) {
    return null;
  }
  if (
    typeof expectedWorkflowType === 'string' &&
    expectedWorkflowType.trim().length > 0 &&
    workflow.workflowType !== expectedWorkflowType
  ) {
    return null;
  }

  return isManagerIntakeWorkflowState(workflow.stateData) ? workflow.stateData : null;
}
