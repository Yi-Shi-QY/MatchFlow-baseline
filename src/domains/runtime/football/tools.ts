import type { ManagerPendingTask } from '@/src/services/manager/types';
import {
  executeManagerDescribeCapability,
  executeManagerHelp,
  executeManagerPrepareTaskIntake,
  executeManagerQueryLocalMatches,
} from '@/src/services/manager/toolRegistry';
import type {
  DomainToolDefinition,
  RuntimeFeedBlockInput,
  RuntimeToolExecutionResult,
  SessionWorkflowStateSnapshot,
  ToolExecutionInput,
} from '../types';

export const FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE = 'football_task_intake';

function isManagerPendingTask(input: unknown): input is ManagerPendingTask {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return false;
  }

  const value = input as Record<string, unknown>;
  return (
    typeof value.id === 'string' &&
    typeof value.sourceText === 'string' &&
    Array.isArray(value.drafts) &&
    (value.stage === 'await_factors' || value.stage === 'await_sequence')
  );
}

function createWorkflowStateFromPendingTask(
  pendingTask: ManagerPendingTask | null | undefined,
): SessionWorkflowStateSnapshot | null {
  if (!pendingTask) {
    return null;
  }

  return {
    workflowType: FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE,
    stateData: JSON.parse(JSON.stringify(pendingTask)) as Record<string, unknown>,
    updatedAt: Date.now(),
  };
}

function mapEffectToBlocks(effect: {
  agentText: string;
  messageKind: 'text' | 'draft_bundle';
  draftIds?: string[];
  action?: unknown;
}): RuntimeFeedBlockInput[] {
  const blocks: RuntimeFeedBlockInput[] = [
    {
      blockType: effect.messageKind === 'draft_bundle' ? 'draft_bundle' : 'assistant_text',
      role: 'assistant',
      text: effect.agentText,
      payload:
        effect.messageKind === 'draft_bundle' || effect.action
          ? {
              draftIds: effect.draftIds,
              action: effect.action,
            }
          : undefined,
    },
  ];

  if (effect.action) {
    blocks.push({
      blockType: 'navigation_intent',
      role: 'system',
      payload: {
        action: effect.action,
      },
    });
  }

  return blocks;
}

export function mapLegacyManagerEffectToRuntimeToolResult(effect: {
  agentText: string;
  messageKind: 'text' | 'draft_bundle';
  draftIds?: string[];
  action?: unknown;
  draftsToSave?: Array<{ id: string }>;
  pendingTask?: ManagerPendingTask | null;
  shouldRefreshTaskState?: boolean;
  feedbackMessage?: string;
  navigation?: {
    route: string;
    state?: Record<string, unknown>;
  };
  memoryCandidates?: unknown[];
}): RuntimeToolExecutionResult {
  const draftIds =
    effect.draftIds ||
    (Array.isArray(effect.draftsToSave) ? effect.draftsToSave.map((draft) => draft.id) : undefined);

  return {
    blocks: mapEffectToBlocks({
      agentText: effect.agentText,
      messageKind: effect.messageKind,
      draftIds,
      action: effect.action,
    }),
    sessionPatch:
      typeof effect.pendingTask === 'undefined'
        ? undefined
        : {
            activeWorkflow: createWorkflowStateFromPendingTask(effect.pendingTask),
          },
    navigationIntent: effect.navigation,
    diagnostics: {
      shouldRefreshTaskState: Boolean(effect.shouldRefreshTaskState),
      feedbackMessage: effect.feedbackMessage || effect.agentText,
      draftsToSave: effect.draftsToSave,
      navigation: effect.navigation,
      memoryCandidates: effect.memoryCandidates,
    },
  };
}

function resolveLanguage(input: ToolExecutionInput): 'zh' | 'en' {
  return input.language === 'zh' ? 'zh' : 'en';
}

export function parsePendingTaskFromWorkflow(
  workflow: SessionWorkflowStateSnapshot | null | undefined,
): ManagerPendingTask | null {
  if (!workflow) {
    return null;
  }
  if (workflow.workflowType !== FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE) {
    return null;
  }
  return isManagerPendingTask(workflow.stateData) ? workflow.stateData : null;
}

export const footballRuntimeTools: DomainToolDefinition[] = [
  {
    id: 'football_query_local_matches',
    description: 'Query football matches through the runtime source adapter chain.',
    canHandle(input) {
      return input.intent?.intentType === 'query';
    },
    async execute(input) {
      const effect = await executeManagerQueryLocalMatches({
        sourceText: input.input,
        domainId: input.session.domainId,
        language: resolveLanguage(input),
        signal: input.signal,
      });
      return mapLegacyManagerEffectToRuntimeToolResult(effect);
    },
  },
  {
    id: 'football_explain_capability',
    description: 'Explain football analysis factors, sequence, or general manager help.',
    canHandle(input) {
      return input.intent?.intentType === 'explain';
    },
    async execute(input) {
      const normalized = input.input.toLowerCase();
      const topic = /(sequence|order)/i.test(normalized) ? 'sequence' : 'factors';
      const effect = await executeManagerDescribeCapability({
        topic,
        domainId: input.session.domainId,
        language: resolveLanguage(input),
        signal: input.signal,
      });
      return mapLegacyManagerEffectToRuntimeToolResult(effect);
    },
  },
  {
    id: 'football_prepare_task_intake',
    description:
      'Prepare football analysis task intake and start workflow when clarification is needed.',
    canHandle(input) {
      return input.intent?.intentType === 'analyze' || input.intent?.intentType === 'schedule';
    },
    async execute(input) {
      const effect = await executeManagerPrepareTaskIntake({
        sourceText: input.input,
        composerMode: 'smart',
        defaultDomainId: input.session.domainId,
        language: resolveLanguage(input),
        signal: input.signal,
      });
      return mapLegacyManagerEffectToRuntimeToolResult(effect);
    },
  },
  {
    id: 'football_help',
    description: 'Fallback football manager guidance for unsupported or ambiguous input.',
    canHandle() {
      return true;
    },
    async execute(input) {
      const effect = await executeManagerHelp({
        domainId: input.session.domainId,
        language: resolveLanguage(input),
        signal: input.signal,
      });
      return mapLegacyManagerEffectToRuntimeToolResult(effect);
    },
  },
];
