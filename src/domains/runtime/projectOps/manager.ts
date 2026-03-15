import type {
  RuntimeManagerCapability,
  RuntimeManagerLegacyEffectInput,
  RuntimeToolExecutionResult,
  SessionWorkflowStateSnapshot,
} from '../types';
import { projectOpsTaskIntakeCapability } from './taskIntake';
import {
  mapLegacyManagerEffectToProjectOpsRuntimeToolResult,
  parsePendingTaskFromWorkflow,
} from './tools';
import { PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE } from './workflowType';

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
  taskIntake: projectOpsTaskIntakeCapability,
  plannerHints: {
    helpText: {
      zh: '直接描述你要分析的项目、任务或专项，以及希望什么时候执行。我会先确认分析对象和关注方向，再创建任务卡片。',
      en: 'Describe the project, task, or initiative you want to analyze and when it should run. I will confirm the subject and focus areas before creating task cards.',
    },
    factorsText: {
      zh: 'Project Ops 当前支持的关注方向包括：进度与里程碑、风险与阻塞、资源与负责人、协同与交接。你也可以直接说“默认”，我会按通用运营复盘顺序推进。',
      en: 'Project Ops currently supports these focus areas: delivery and milestones, risk and blockers, resources and owners, coordination and handoff. You can also say "default" and I will use the standard operating review flow.',
    },
    sequenceText: {
      zh: 'Project Ops 的默认分析顺序是：先看对象与上下文，再看风险和阻塞，最后给推进建议。',
      en: 'The default Project Ops review order is context first, then risks and blockers, then the next-step recommendation.',
    },
    defaultWorkflowType: PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE,
  },
  parsePendingTask: clonePendingTaskState,
  mapLegacyEffect,
};
