import {
  describeAvailableFactors,
  describeDefaultSequence,
} from '@/src/services/managerAgent';
import type {
  RuntimeManagerCapability,
  RuntimeManagerLegacyEffectInput,
  RuntimeToolExecutionResult,
  SessionWorkflowStateSnapshot,
} from '../types';
import {
  FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE,
  mapLegacyManagerEffectToRuntimeToolResult,
  parsePendingTaskFromWorkflow,
} from './tools';

const FOOTBALL_MANAGER_SKILL_IDS = [
  'manager_query_local_matches',
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
  return mapLegacyManagerEffectToRuntimeToolResult(
    effect as unknown as Parameters<typeof mapLegacyManagerEffectToRuntimeToolResult>[0],
  );
}

export const footballRuntimeManagerCapability: RuntimeManagerCapability = {
  domainId: 'football',
  skillIds: [...FOOTBALL_MANAGER_SKILL_IDS],
  plannerHints: {
    helpText: {
      zh: '你可以直接问我今天有哪些比赛，或者告诉我想分析哪场比赛以及什么时间执行。我会先在对话里确认分析因素和顺序，再生成任务卡片。',
      en: 'Ask what matches are on today, or tell me which match or league to analyze and when. I will confirm the analysis factors and sequence in chat before creating task cards.',
    },
    factorsText: {
      zh: describeAvailableFactors('zh'),
      en: describeAvailableFactors('en'),
    },
    sequenceText: {
      zh: describeDefaultSequence('zh'),
      en: describeDefaultSequence('en'),
    },
    defaultWorkflowType: FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE,
  },
  parsePendingTask: clonePendingTaskState,
  mapLegacyEffect,
};

export const footballManagerSkillIds = [...FOOTBALL_MANAGER_SKILL_IDS];
