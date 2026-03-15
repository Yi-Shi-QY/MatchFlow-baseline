import {
  describeAvailableFactors,
  describeDefaultSequence,
} from '@/src/services/manager-legacy/analysisProfile';
import type {
  RuntimeManagerCapability,
  RuntimeManagerLegacyEffectInput,
  RuntimeToolExecutionResult,
  SessionWorkflowStateSnapshot,
} from '../types';
import { footballTaskIntakeCapability } from './taskIntake';
import { mapLegacyManagerEffectToRuntimeToolResult, parsePendingTaskFromWorkflow } from './tools';
import { FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE } from './workflowType';

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
  taskIntake: footballTaskIntakeCapability,
  plannerHints: {
    helpText: {
      zh: '浣犲彲浠ョ洿鎺ラ棶鎴戜粖澶╂湁鍝簺姣旇禌锛屾垨鑰呭憡璇夋垜鎯冲垎鏋愬摢鍦烘瘮璧涗互鍙婁粈涔堟椂闂存墽琛屻€傛垜浼氬厛鍦ㄥ璇濋噷纭鍒嗘瀽鍥犵礌鍜岄『搴忥紝鍐嶇敓鎴愪换鍔″崱鐗囥€?',
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
