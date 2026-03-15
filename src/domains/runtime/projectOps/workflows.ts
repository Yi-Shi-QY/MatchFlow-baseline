import {
  createManagerIntakeWorkflowSnapshot,
  parseManagerIntakeWorkflowSnapshot,
} from '@/src/services/manager-intake/workflowProjection';
import type { ManagerIntakeWorkflowState } from '@/src/services/manager-intake/types';
import { executeManagerContinueTaskIntake } from '@/src/services/manager/toolRegistry';
import type {
  DomainWorkflowHandler,
  SessionWorkflowStateSnapshot,
  WorkflowResumeInput,
  WorkflowResumeResult,
} from '../types';
import { projectOpsTaskIntakeCapability } from './taskIntake';
import { parsePendingTaskFromWorkflow } from './tools';
import { PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE } from './workflowType';

const PROJECT_OPS_MANAGER_SUPPORT = {
  domainId: 'project_ops',
  taskIntake: projectOpsTaskIntakeCapability,
} as const;

function mapResumeResult(input: {
  agentText: string;
  messageKind: 'text' | 'draft_bundle';
  draftIds?: string[];
  action?: unknown;
  draftsToSave?: Array<{ id: string }>;
  pendingTask?: unknown;
  intakeWorkflow?: ManagerIntakeWorkflowState | null;
  shouldRefreshTaskState?: boolean;
  feedbackMessage?: string;
  navigation?: {
    route: string;
    state?: Record<string, unknown>;
  };
  memoryCandidates?: unknown[];
}): WorkflowResumeResult {
  const draftIds =
    input.draftIds ||
    (Array.isArray(input.draftsToSave) ? input.draftsToSave.map((draft) => draft.id) : undefined);

  return {
    workflowHandled: true,
    blocks: [
      {
        blockType: input.messageKind === 'draft_bundle' ? 'draft_bundle' : 'assistant_text',
        role: 'assistant',
        text: input.agentText,
        payload:
          input.messageKind === 'draft_bundle' || input.action
            ? {
                draftIds,
                action: input.action,
              }
            : undefined,
      },
    ],
    sessionPatch:
      typeof input.intakeWorkflow !== 'undefined'
        ? {
            activeWorkflow: input.intakeWorkflow
              ? createManagerIntakeWorkflowSnapshot(input.intakeWorkflow)
              : null,
          }
        : typeof input.pendingTask === 'undefined'
          ? undefined
          : {
              activeWorkflow:
                parsePendingTaskFromWorkflow({
                  workflowType: PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE,
                  stateData:
                    input.pendingTask && typeof input.pendingTask === 'object'
                      ? (input.pendingTask as Record<string, unknown>)
                      : {},
                }) && input.pendingTask && typeof input.pendingTask === 'object'
                  ? {
                      workflowType: PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE,
                      stateData: JSON.parse(JSON.stringify(input.pendingTask)) as Record<string, unknown>,
                      updatedAt: Date.now(),
                    }
                  : null,
            },
    diagnostics: {
      shouldRefreshTaskState: Boolean(input.shouldRefreshTaskState),
      feedbackMessage: input.feedbackMessage || input.agentText,
      draftsToSave: input.draftsToSave,
      navigation: input.navigation,
      memoryCandidates: input.memoryCandidates,
    },
  };
}

export const projectOpsRuntimeWorkflowHandlers: DomainWorkflowHandler[] = [
  {
    workflowType: PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE,
    canResume(state: SessionWorkflowStateSnapshot): boolean {
      return (
        state.workflowType === PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE &&
        (Boolean(
          parseManagerIntakeWorkflowSnapshot(state, PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE),
        ) ||
          Boolean(parsePendingTaskFromWorkflow(state)))
      );
    },
    async resume(input: WorkflowResumeInput): Promise<WorkflowResumeResult> {
      const intakeWorkflow = parseManagerIntakeWorkflowSnapshot(
        input.workflow,
        PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE,
      );
      if (intakeWorkflow) {
        const effect = await executeManagerContinueTaskIntake({
          intakeWorkflow,
          answer: input.input,
          language: input.language === 'zh' ? 'zh' : 'en',
          support: PROJECT_OPS_MANAGER_SUPPORT,
          signal: input.signal,
        });

        return mapResumeResult(effect);
      }

      const pendingTask = parsePendingTaskFromWorkflow(input.workflow);
      if (!pendingTask) {
        return {
          workflowHandled: false,
          blocks: [],
        };
      }

      const effect = await executeManagerContinueTaskIntake({
        pendingTask,
        answer: input.input,
        language: input.language === 'zh' ? 'zh' : 'en',
        support: PROJECT_OPS_MANAGER_SUPPORT,
        signal: input.signal,
      });

      return mapResumeResult(effect);
    },
  },
];
