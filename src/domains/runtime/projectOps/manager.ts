import type {
  RuntimeManagerCapability,
  RuntimeManagerLegacyEffectInput,
  RuntimeToolExecutionResult,
  SessionWorkflowStateSnapshot,
} from '../types';
import {
  PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE,
  mapLegacyManagerEffectToProjectOpsRuntimeToolResult,
  parsePendingTaskFromWorkflow,
} from './tools';

const PROJECT_OPS_MANAGER_SKILL_IDS = [
  'manager_describe_capability',
  'manager_prepare_task_intake',
  'manager_continue_task_intake',
  'manager_help',
] as const;

function clonePendingTaskState(
  workflow: SessionWorkflowStateSnapshot | null | undefined,
): Record<string, unknown> | null {
  const pendingTask = parsePendingTaskFromWorkflow(workflow);
  if (!pendingTask) {
    return null;
  }

  return JSON.parse(JSON.stringify(pendingTask)) as Record<string, unknown>;
}

function mapLegacyEffect(
  effect: RuntimeManagerLegacyEffectInput,
): RuntimeToolExecutionResult {
  return mapLegacyManagerEffectToProjectOpsRuntimeToolResult(
    effect as unknown as Parameters<typeof mapLegacyManagerEffectToProjectOpsRuntimeToolResult>[0],
  );
}

export const projectOpsRuntimeManagerCapability: RuntimeManagerCapability = {
  domainId: 'project_ops',
  skillIds: [...PROJECT_OPS_MANAGER_SKILL_IDS],
  plannerHints: {
    helpText: {
      zh: 'Describe the project, task, or initiative you want to analyze and when it should run. I will confirm the factors and sequence before creating task cards.',
      en: 'Describe the project, task, or initiative you want to analyze and when it should run. I will confirm the factors and sequence before creating task cards.',
    },
    factorsText: {
      zh: 'Project Ops uses the shared analysis profile: fundamentals for operating context, market for execution signals, and custom for freeform notes.',
      en: 'Project Ops uses the shared analysis profile: fundamentals for operating context, market for execution signals, and custom for freeform notes.',
    },
    sequenceText: {
      zh: 'The default sequence is fundamentals -> market -> custom -> prediction, which means context first, risk second, notes third, and recommendation last.',
      en: 'The default sequence is fundamentals -> market -> custom -> prediction, which means context first, risk second, notes third, and recommendation last.',
    },
    defaultWorkflowType: PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE,
  },
  parsePendingTask: clonePendingTaskState,
  mapLegacyEffect,
};
