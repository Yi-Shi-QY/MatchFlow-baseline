import { executeManagerContinueTaskIntake } from '@/src/services/manager/toolRegistry';
import type {
  DomainWorkflowHandler,
  SessionWorkflowStateSnapshot,
  WorkflowResumeInput,
  WorkflowResumeResult,
} from '../types';
import {
  FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE,
  parsePendingTaskFromWorkflow,
} from './tools';

function mapResumeResult(input: {
  agentText: string;
  messageKind: 'text' | 'draft_bundle';
  draftIds?: string[];
  action?: unknown;
  draftsToSave?: Array<{ id: string }>;
  pendingTask?: unknown;
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
      typeof input.pendingTask === 'undefined'
        ? undefined
        : {
            activeWorkflow:
              parsePendingTaskFromWorkflow({
                workflowType: FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE,
                stateData:
                  input.pendingTask && typeof input.pendingTask === 'object'
                    ? (input.pendingTask as Record<string, unknown>)
                    : {},
              }) && input.pendingTask && typeof input.pendingTask === 'object'
                ? {
                    workflowType: FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE,
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

function canResumeWorkflow(state: SessionWorkflowStateSnapshot): boolean {
  return state.workflowType === FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE;
}

export const footballRuntimeWorkflowHandlers: DomainWorkflowHandler[] = [
  {
    workflowType: FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE,
    canResume(state: SessionWorkflowStateSnapshot): boolean {
      return canResumeWorkflow(state) && Boolean(parsePendingTaskFromWorkflow(state));
    },
    async resume(input: WorkflowResumeInput): Promise<WorkflowResumeResult> {
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
        signal: input.signal,
      });

      return mapResumeResult(effect);
    },
  },
];
