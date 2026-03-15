import { translateText } from '@/src/i18n/translate';
import { resolveRuntimeDomainPack } from '@/src/domains/runtime/registry';
import type { RuntimeTaskIntakeCapability } from '@/src/domains/runtime/types';
import {
  formatAutomationSchedule,
  getAutomationTargetSelectorLabel,
  getCommandComposerExamples,
  getNextClarificationQuestion,
  type AutomationDraft,
  type AutomationRun,
} from '@/src/services/automation';
import { buildManagerIntakePrompt } from '@/src/services/manager-intake/promptBuilder';
import type { ManagerIntakeWorkflowState } from '@/src/services/manager-intake/types';
import { parseManagerIntakeWorkflowSnapshot } from '@/src/services/manager-intake/workflowProjection';
import {
  getRuntimeManagerCapability,
  parseRuntimeManagerPendingTask,
} from '@/src/services/manager/runtimeIntentRouter';
import type {
  ManagerFeedBlock,
} from '@/src/services/manager-gateway/types';
import type {
  ManagerCompositeItem,
  ManagerCompositeWorkflowState,
} from '@/src/services/manager-orchestration/types';
import type { ManagerPendingTask } from '@/src/services/manager/types';
import type { ManagerWorkspaceProjection } from '@/src/services/manager-workspace/types';
import { buildExecutionApprovalCardModel } from './ExecutionApprovalCard';
import { projectManagerSessionProjectionToCommandCenterFeed } from './feedAdapter';

export type CommandCenterHomeMode = 'continue_first' | 'new_input_first';
export type CommandCenterHomeStatusTone = 'neutral' | 'warning' | 'active' | 'success';
export type CommandCenterContinueCardKind =
  | 'approval'
  | 'clarification'
  | 'exception'
  | 'resumable';

export type CommandCenterContinueAction =
  | {
      type: 'activate_draft';
      draftId: string;
    }
  | {
      type: 'focus_draft';
      draftId: string;
    }
  | {
      type: 'focus_run_status';
    }
  | {
      type: 'focus_conversation';
    };

export interface CommandCenterContinueCard {
  id: string;
  kind: CommandCenterContinueCardKind;
  title: string;
  description: string;
  chips?: string[];
  primaryActionLabel: string;
  eyebrow: string;
  action: CommandCenterContinueAction;
}

export interface CommandCenterSummaryCard {
  title: string;
  summary: string;
  actionLabel: string;
}

export interface CommandCenterSuggestionChip {
  id: string;
  label: string;
  fillText: string;
  autoSubmit: false;
}

export interface CommandCenterHomeLayout {
  mode: CommandCenterHomeMode;
  statusLabel: string;
  statusTone: CommandCenterHomeStatusTone;
  pendingCount: number;
  runningCount: number;
  continueCards: CommandCenterContinueCard[];
  lastSummaryCard: CommandCenterSummaryCard | null;
  suggestionChips: CommandCenterSuggestionChip[];
}

function tr(
  language: 'zh' | 'en',
  key: string,
  zh: string,
  en: string,
  options: Record<string, unknown> = {},
): string {
  return translateText(language, key, language === 'zh' ? zh : en, options);
}

function getDraftTargetLabel(draft: AutomationDraft, language: 'zh' | 'en'): string {
  return (
    getAutomationTargetSelectorLabel(draft.targetSelector) ||
    tr(language, 'command_center.home.target_needed', '待补充目标', 'Target needed')
  );
}

function buildDraftDescription(draft: AutomationDraft, language: 'zh' | 'en'): string {
  const scheduleLabel = formatAutomationSchedule(draft.schedule, language);
  const targetLabel = getDraftTargetLabel(draft, language);
  return `${targetLabel} · ${scheduleLabel}`;
}

function getRuntimeDomainLabel(domainId: string): string {
  const displayName = resolveRuntimeDomainPack(domainId).manifest.displayName.trim();
  return displayName.replace(/\s+Runtime Pack$/i, '').trim() || domainId;
}

function getSupervisorCompositeWorkflow(
  workspaceProjection: ManagerWorkspaceProjection | null | undefined,
): ManagerCompositeWorkflowState | null {
  const projection = workspaceProjection?.managerProjection;
  if (!projection || projection.session.sessionKind !== 'supervisor') {
    return null;
  }

  return projection.compositeWorkflow || null;
}

function getSupervisorActiveCompositeItem(
  workspaceProjection: ManagerWorkspaceProjection | null | undefined,
): ManagerCompositeItem | null {
  const workflow = getSupervisorCompositeWorkflow(workspaceProjection);
  if (!workflow || workflow.items.length === 0 || workflow.status === 'completed') {
    return null;
  }

  if (workflow.activeItemId) {
    const activeItem = workflow.items.find((item) => item.itemId === workflow.activeItemId);
    if (activeItem) {
      return activeItem;
    }
  }

  return (
    workflow.items.find((item) => item.status === 'active') ||
    workflow.items.find((item) => item.status === 'blocked') ||
    workflow.items.find((item) => item.status === 'pending') ||
    workflow.items.find((item) => item.status === 'failed') ||
    null
  );
}

function countSupervisorPendingItems(
  workspaceProjection: ManagerWorkspaceProjection | null | undefined,
): number {
  const workflow = getSupervisorCompositeWorkflow(workspaceProjection);
  if (!workflow) {
    return 0;
  }

  return workflow.items.filter((item) => item.status !== 'completed').length;
}

function buildSupervisorCompositeCardDescription(input: {
  item: ManagerCompositeItem;
  language: 'zh' | 'en';
}): string {
  const { item, language } = input;
  const summary = item.summary?.trim();
  if (summary) {
    return summary;
  }

  const pendingLabel = item.pendingLabel?.trim();
  if (pendingLabel) {
    return tr(
      language,
      'command_center.home.composite.pending_description',
      '当前子任务正在等待“{{pendingLabel}}”。',
      'This work item is waiting for "{{pendingLabel}}".',
      { pendingLabel },
    );
  }

  if (item.status === 'failed') {
    return tr(
      language,
      'command_center.home.composite.failed_description',
      '当前子任务需要回到对话中检查并处理。',
      'This work item needs review in the conversation before it can continue.',
    );
  }

  if (item.status === 'active') {
    return tr(
      language,
      'command_center.home.composite.active_description',
      '当前子任务已经激活，可回到对话查看最新进展。',
      'This work item is active. Return to the conversation to review the latest progress.',
    );
  }

  return tr(
    language,
    'command_center.home.composite.default_description',
    '当前子任务已进入处理队列，可回到对话继续推进。',
    'This work item is ready to continue in the conversation.',
  );
}

function buildSupervisorCompositeContinueCard(
  workspaceProjection: ManagerWorkspaceProjection | null | undefined,
  language: 'zh' | 'en',
): CommandCenterContinueCard | null {
  const activeItem = getSupervisorActiveCompositeItem(workspaceProjection);
  if (!activeItem || activeItem.status === 'completed') {
    return null;
  }

  const chips = [getRuntimeDomainLabel(activeItem.domainId)];
  const pendingLabel = activeItem.pendingLabel?.trim();
  if (pendingLabel) {
    chips.push(pendingLabel);
  }

  const kind: CommandCenterContinueCardKind =
    activeItem.status === 'failed'
      ? 'exception'
      : pendingLabel || activeItem.status === 'blocked' || activeItem.status === 'pending'
        ? 'clarification'
        : 'resumable';

  return {
    id: `composite:${activeItem.itemId}`,
    kind,
    title: activeItem.title,
    description: buildSupervisorCompositeCardDescription({
      item: activeItem,
      language,
    }),
    chips,
    primaryActionLabel:
      kind === 'exception'
        ? tr(language, 'command_center.home.exception.action', '查看异常', 'Review issue')
        : kind === 'resumable'
          ? tr(language, 'command_center.home.resumable.action', '查看进展', 'View progress')
          : tr(language, 'command_center.home.workflow.action', '回到对话补充', 'Continue in chat'),
    eyebrow:
      kind === 'exception'
        ? tr(language, 'command_center.home.exception.eyebrow', '异常待处理', 'Issue detected')
        : kind === 'resumable'
          ? tr(language, 'command_center.home.resumable.eyebrow', '可继续主题', 'Resumable thread')
          : tr(
              language,
              'command_center.home.workflow.eyebrow',
              '对话待继续',
              'Conversation pending',
            ),
    action: {
      type: kind === 'resumable' ? 'focus_run_status' : 'focus_conversation',
    },
  };
}

function buildApprovalCards(
  approvals: ManagerWorkspaceProjection['taskState']['pendingApprovals'],
  language: 'zh' | 'en',
): CommandCenterContinueCard[] {
  return approvals
    .map((approval) => {
      const model = buildExecutionApprovalCardModel({
        draft: approval.draft,
        ticket: approval.ticket,
        language,
      });
      const draft = approval.draft;

      return {
      id: `approval:${model.approvalId}`,
      kind: 'approval' as const,
      title: model.title,
      description: model.summary || buildDraftDescription(draft, language),
      primaryActionLabel:
        draft.activationMode === 'run_now'
          ? tr(language, 'command_center.home.approval.analyze_now', '立即分析', 'Analyze now')
          : tr(language, 'command_center.home.approval.confirm_run', '确认执行', 'Confirm run'),
      eyebrow: tr(
        language,
        'command_center.home.approval.eyebrow',
        '待确认任务',
        'Approval needed',
      ),
      action: {
        type: 'activate_draft',
        draftId: approval.draftId,
      },
    };
    });
}

function buildClarificationCards(
  drafts: AutomationDraft[],
  language: 'zh' | 'en',
): CommandCenterContinueCard[] {
  return drafts
    .filter((draft) => draft.status === 'needs_clarification')
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map((draft) => ({
      id: `clarification:${draft.id}`,
      kind: 'clarification' as const,
      title: draft.title,
      description:
        getNextClarificationQuestion(draft, language)?.prompt ||
        tr(
          language,
          'command_center.home.clarification.description_fallback',
          '还缺少继续执行所需的关键信息。',
          'Some required details are still missing before this can continue.',
        ),
      primaryActionLabel: tr(
        language,
        'command_center.home.clarification.action',
        '继续补充',
        'Continue',
      ),
      eyebrow: tr(
        language,
        'command_center.home.clarification.eyebrow',
        '待回复问题',
        'Needs reply',
      ),
      action: {
        type: 'focus_draft',
        draftId: draft.id,
      },
    }));
}

function getActiveWorkflowPendingTask(
  workspaceProjection: ManagerWorkspaceProjection | null | undefined,
): ManagerPendingTask | null {
  const projection = workspaceProjection?.managerProjection;
  if (!projection?.activeWorkflow) {
    return null;
  }

  return parseRuntimeManagerPendingTask({
    domainId: projection.runtimeDomainId || projection.session.domainId,
    workflow: projection.activeWorkflow,
  });
}

function getActiveIntakeWorkflow(
  workspaceProjection: ManagerWorkspaceProjection | null | undefined,
): {
  capability: RuntimeTaskIntakeCapability;
  workflow: ManagerIntakeWorkflowState;
} | null {
  const projection = workspaceProjection?.managerProjection;
  if (!projection?.activeWorkflow) {
    return null;
  }

  const capability = getRuntimeManagerCapability({
    domainId: projection.runtimeDomainId || projection.session.domainId,
  })?.taskIntake;
  if (!capability) {
    return null;
  }

  const workflow = parseManagerIntakeWorkflowSnapshot(
    projection.activeWorkflow,
    capability.definition.workflowType,
  );
  if (!workflow || workflow.completed) {
    return null;
  }

  return {
    capability,
    workflow,
  };
}

function buildGenericWorkflowClarificationCard(
  workspaceProjection: ManagerWorkspaceProjection | null | undefined,
  language: 'zh' | 'en',
): CommandCenterContinueCard | null {
  const intake = getActiveIntakeWorkflow(workspaceProjection);
  if (!intake) {
    return null;
  }

  const prompt = buildManagerIntakePrompt({
    capability: intake.capability,
    state: intake.workflow,
    language,
  });
  const sourceText = intake.workflow.sourceText.trim();
  const stepTitle = prompt.title.trim();
  const description = sourceText.length > 0
    ? tr(
        language,
        'command_center.home.workflow.generic.description',
        '{{sourceText}}。当前还需要完成“{{stepTitle}}”后才能继续。',
        '{{sourceText}}. Complete "{{stepTitle}}" to continue this task.',
        {
          sourceText,
          stepTitle,
        },
      )
    : tr(
        language,
        'command_center.home.workflow.generic.description_fallback',
        '当前还有一个对话采集步骤未完成，补齐后才能继续任务。',
        'This conversation still has an unfinished intake step. Complete it to continue the task.',
      );

  return {
    id: `workflow:${intake.workflow.workflowId}`,
    kind: 'clarification',
    title: stepTitle,
    description,
    primaryActionLabel: tr(
      language,
      'command_center.home.workflow.action',
      '回到对话补充',
      'Continue in chat',
    ),
    eyebrow: tr(
      language,
      'command_center.home.workflow.eyebrow',
      '对话待继续',
      'Conversation pending',
    ),
    action: {
      type: 'focus_conversation',
    },
  };
}

function buildWorkflowClarificationDescription(input: {
  pendingTask: ManagerPendingTask;
  language: 'zh' | 'en';
}): string {
  const { pendingTask, language } = input;
  const sourceText = pendingTask.sourceText.trim();

  if (pendingTask.stage === 'await_sequence') {
    return sourceText.length > 0
      ? tr(
          language,
          'command_center.home.workflow.await_sequence.description',
          '{{sourceText}}。还需要确认分析顺序，任务才能继续。',
          '{{sourceText}}. The analysis order still needs confirmation before the task can continue.',
          { sourceText },
        )
      : tr(
          language,
          'command_center.home.workflow.await_sequence.description_fallback',
          '还需要确认分析顺序，任务才能继续。',
          'The analysis order still needs confirmation before the task can continue.',
        );
  }

  return sourceText.length > 0
    ? tr(
        language,
        'command_center.home.workflow.await_factors.description',
        '{{sourceText}}。还需要补充这次要看的分析因素，任务才能继续。',
        '{{sourceText}}. The analysis factors still need to be clarified before the task can continue.',
        { sourceText },
      )
    : tr(
        language,
        'command_center.home.workflow.await_factors.description_fallback',
        '还需要补充这次要看的分析因素，任务才能继续。',
        'The analysis factors still need to be clarified before the task can continue.',
      );
}

function buildWorkflowClarificationCard(
  workspaceProjection: ManagerWorkspaceProjection | null | undefined,
  language: 'zh' | 'en',
): CommandCenterContinueCard | null {
  const genericCard = buildGenericWorkflowClarificationCard(workspaceProjection, language);
  if (genericCard) {
    return genericCard;
  }

  const pendingTask = getActiveWorkflowPendingTask(workspaceProjection);
  if (!pendingTask) {
    return null;
  }

  return {
    id: `workflow:${pendingTask.id}`,
    kind: 'clarification',
    title:
      pendingTask.stage === 'await_sequence'
        ? tr(
            language,
            'command_center.home.workflow.await_sequence.title',
            '需要补充分析顺序',
            'Choose the analysis order',
          )
        : tr(
            language,
            'command_center.home.workflow.await_factors.title',
            '需要补充分析因素',
            'Choose analysis factors',
          ),
    description: buildWorkflowClarificationDescription({
      pendingTask,
      language,
    }),
    primaryActionLabel: tr(
      language,
      'command_center.home.workflow.action',
      '回到对话补充',
      'Continue in chat',
    ),
    eyebrow: tr(
      language,
      'command_center.home.workflow.eyebrow',
      '对话待继续',
      'Conversation pending',
    ),
    action: {
      type: 'focus_conversation',
    },
  };
}

function findLatestErrorBlock(
  workspaceProjection: ManagerWorkspaceProjection | null | undefined,
): ManagerFeedBlock | null {
  const projection = workspaceProjection?.managerProjection;
  if (!projection) {
    return null;
  }

  const reversed = [...projection.feed].reverse();
  return (
    reversed.find(
      (block) =>
        block.blockType === 'error_notice' &&
        typeof block.text === 'string' &&
        block.text.trim().length > 0,
    ) || null
  );
}

function buildAutomationFailureCard(
  failedRun: AutomationRun,
  language: 'zh' | 'en',
): CommandCenterContinueCard {
  return {
    id: `exception:automation:${failedRun.id}`,
    kind: 'exception',
    title: tr(
      language,
      'command_center.home.exception.failed_title',
      '最近一次执行失败',
      'The latest run failed',
    ),
    description:
      failedRun.errorMessage ||
      tr(
        language,
        'command_center.home.exception.description_fallback',
        '需要回到对话里查看失败原因。',
        'Open the conversation to inspect the failure details.',
      ),
    primaryActionLabel: tr(
      language,
      'command_center.home.exception.action',
      '查看异常',
      'Review issue',
    ),
    eyebrow: tr(
      language,
      'command_center.home.exception.eyebrow',
      '异常待处理',
      'Issue detected',
    ),
    action: {
      type: 'focus_conversation',
    },
  };
}

function buildExceptionCard(
  workspaceProjection: ManagerWorkspaceProjection | null | undefined,
  language: 'zh' | 'en',
): CommandCenterContinueCard | null {
  const latestErrorBlock = findLatestErrorBlock(workspaceProjection);
  if (latestErrorBlock) {
    return {
      id: `exception:${latestErrorBlock.id}`,
      kind: 'exception',
      title: tr(
        language,
        'command_center.home.exception.review_title',
        '上一次执行需要处理',
        'The last run needs review',
      ),
      description: latestErrorBlock.text?.trim() || '',
      primaryActionLabel: tr(
        language,
        'command_center.home.exception.action',
        '查看异常',
        'Review issue',
      ),
      eyebrow: tr(
        language,
        'command_center.home.exception.eyebrow',
        '异常待处理',
        'Issue detected',
      ),
      action: {
        type: 'focus_conversation',
      },
    };
  }

  const latestRun = workspaceProjection?.managerProjection?.latestRun;
  if (latestRun?.status !== 'failed') {
    const latestFailedAutomationRun = workspaceProjection?.taskState.failedRuns[0];
    return latestFailedAutomationRun
      ? buildAutomationFailureCard(latestFailedAutomationRun, language)
      : null;
  }

  return {
    id: `exception:run:${latestRun.id}`,
    kind: 'exception',
    title: tr(
      language,
      'command_center.home.exception.failed_title',
      '最近一次执行失败',
      'The latest run failed',
    ),
    description:
      latestRun.errorMessage ||
      latestRun.errorCode ||
      tr(
        language,
        'command_center.home.exception.description_fallback',
        '需要回到对话里查看失败原因。',
        'Open the conversation to inspect the failure details.',
      ),
    primaryActionLabel: tr(
      language,
      'command_center.home.exception.action',
      '查看异常',
      'Review issue',
    ),
    eyebrow: tr(
      language,
      'command_center.home.exception.eyebrow',
      '异常待处理',
      'Issue detected',
    ),
    action: {
      type: 'focus_conversation',
    },
  };
}

function buildResumableCard(
  workspaceProjection: ManagerWorkspaceProjection | null | undefined,
  language: 'zh' | 'en',
): CommandCenterContinueCard | null {
  const activeRun = workspaceProjection?.managerProjection?.activeRun;
  if (!activeRun || (activeRun.status !== 'queued' && activeRun.status !== 'running')) {
    const automationRun = workspaceProjection?.taskState.activeRuns[0];
    if (!automationRun) {
      return null;
    }

    return {
      id: `resumable:automation:${automationRun.id}`,
      kind: 'resumable',
      title: automationRun.title,
      description: tr(
        language,
        'command_center.home.resumable.automation_description',
        '后台自动化仍在执行中，返回对话查看最新进展。',
        'Background automation is still running. Return to the conversation to review the latest progress.',
      ),
      primaryActionLabel: tr(
        language,
        'command_center.home.resumable.action',
        '查看进展',
        'View progress',
      ),
      eyebrow: tr(
        language,
        'command_center.home.resumable.eyebrow',
        '可继续主题',
        'Resumable thread',
      ),
      action: {
        type: 'focus_conversation',
      },
    };
  }

  const statusLabel =
    activeRun.status === 'running'
      ? tr(language, 'command_center.home.resumable.status_running', '正在推进', 'In progress')
      : tr(language, 'command_center.home.resumable.status_queued', '排队中', 'Queued');

  return {
    id: `resumable:${activeRun.id}`,
    kind: 'resumable',
    title:
      workspaceProjection?.managerProjection?.session.title ||
      tr(
        language,
        'command_center.home.resumable.title_fallback',
        '继续当前主题',
        'Continue current thread',
      ),
    description: tr(
      language,
      'command_center.home.resumable.description',
      '{{status}} - 返回会话查看最新进展。',
      '{{status}} - Return to the conversation to review the latest progress.',
      { status: statusLabel },
    ),
    primaryActionLabel: tr(
      language,
      'command_center.home.resumable.action',
      '查看进展',
      'View progress',
    ),
    eyebrow: tr(
      language,
      'command_center.home.resumable.eyebrow',
      '可继续主题',
      'Resumable thread',
    ),
    action: {
      type: 'focus_run_status',
    },
  };
}

function buildSuggestionChips(
  language: 'zh' | 'en',
  domainId?: string,
): CommandCenterSuggestionChip[] {
  return getCommandComposerExamples(language, 'smart', domainId).slice(0, 3).map((entry, index) => ({
    id: `suggestion:${language}:${index}`,
    label: entry,
    fillText: entry,
    autoSubmit: false,
  }));
}

function buildLastSummaryCard(
  workspaceProjection: ManagerWorkspaceProjection | null | undefined,
  language: 'zh' | 'en',
): CommandCenterSummaryCard | null {
  const projection = workspaceProjection?.managerProjection;
  const supervisorWorkflow = getSupervisorCompositeWorkflow(workspaceProjection);
  if (supervisorWorkflow?.status === 'completed') {
    const latestCompositeSummary = [...supervisorWorkflow.items]
      .reverse()
      .find(
        (item) => item.status === 'completed' && typeof item.summary === 'string' && item.summary.trim().length > 0,
      );

    if (latestCompositeSummary?.summary) {
      return {
        title: tr(
          language,
          'command_center.home.last_summary.title',
          '\u4e0a\u6b21\u5df2\u5b8c\u6210',
          'Last completed flow',
        ),
        summary: latestCompositeSummary.summary.trim(),
        actionLabel: tr(
          language,
          'command_center.home.last_summary.action',
          '\u67e5\u770b\u5bf9\u8bdd',
          'Open thread',
        ),
      };
    }
  }

  const items = projectManagerSessionProjectionToCommandCenterFeed(projection);
  const latestAssistantText = [...items]
    .reverse()
    .find((item) => item.role === 'assistant' && typeof item.text === 'string' && item.text.trim().length > 0);

  if (latestAssistantText?.text) {
    return {
      title: tr(
        language,
        'command_center.home.last_summary.title',
        '上次已完成',
        'Last completed flow',
      ),
      summary: latestAssistantText.text.trim(),
      actionLabel: tr(
        language,
        'command_center.home.last_summary.action',
        '查看对话',
        'Open thread',
      ),
    };
  }

  const latestResult = workspaceProjection?.resultState.latestResults[0];
  if (latestResult?.status === 'completed') {
    return {
      title: tr(
        language,
        'command_center.home.last_summary.title',
        '上次已完成',
        'Last completed flow',
      ),
      summary: tr(
        language,
        'command_center.home.last_summary.automation_summary',
        '最近一次自动化结果已经生成，可以直接查看结果详情。',
        'The latest automation result is ready to review.',
      ),
      actionLabel: tr(
        language,
        'command_center.home.last_summary.action',
        '查看对话',
        'Open thread',
      ),
    };
  }

  if (projection?.latestRun?.status === 'completed') {
    return {
      title: tr(
        language,
        'command_center.home.last_summary.title',
        '上次已完成',
        'Last completed flow',
      ),
      summary: tr(
        language,
        'command_center.home.last_summary.empty_summary',
        '上一条流程已经结束，可以直接开始新的输入。',
        'The previous flow is complete. You can start a new request now.',
      ),
      actionLabel: tr(
        language,
        'command_center.home.last_summary.action',
        '查看对话',
        'Open thread',
      ),
    };
  }

  return null;
}

function deriveStatus(input: {
  continueCards: CommandCenterContinueCard[];
  workspaceProjection: ManagerWorkspaceProjection | null | undefined;
  language: 'zh' | 'en';
  lastSummaryCard: CommandCenterSummaryCard | null;
}): Pick<CommandCenterHomeLayout, 'statusLabel' | 'statusTone' | 'pendingCount' | 'runningCount'> {
  const { continueCards, workspaceProjection, language, lastSummaryCard } = input;
  const managerActiveRun = workspaceProjection?.managerProjection?.activeRun;
  const runningCount =
    (managerActiveRun &&
    (managerActiveRun.status === 'queued' || managerActiveRun.status === 'running')
      ? 1
      : 0) + (workspaceProjection?.taskState.activeRuns.length || 0);
  const supervisorActiveItem = getSupervisorActiveCompositeItem(workspaceProjection);
  if (supervisorActiveItem) {
    const statusTone: CommandCenterHomeStatusTone =
      supervisorActiveItem.status === 'failed'
        ? 'warning'
        : supervisorActiveItem.pendingLabel ||
            supervisorActiveItem.status === 'blocked' ||
            supervisorActiveItem.status === 'pending'
          ? 'warning'
          : 'active';

    return {
      statusLabel: supervisorActiveItem.title,
      statusTone,
      pendingCount: countSupervisorPendingItems(workspaceProjection) || continueCards.length || 1,
      runningCount,
    };
  }

  if (continueCards.length > 0) {
    const firstKind = continueCards[0].kind;
    if (firstKind === 'approval') {
      return {
        statusLabel: tr(
          language,
          'command_center.home.status.approval_needed',
          '有待确认任务',
          'Approval needed',
        ),
        statusTone: 'warning',
        pendingCount: continueCards.length,
        runningCount,
      };
    }
    if (firstKind === 'clarification') {
      return {
        statusLabel: tr(
          language,
          'command_center.home.status.details_needed',
          '需要补充信息',
          'Details needed',
        ),
        statusTone: 'warning',
        pendingCount: continueCards.length,
        runningCount,
      };
    }
    if (firstKind === 'exception') {
      return {
        statusLabel: tr(
          language,
          'command_center.home.status.issue_needs_review',
          '有异常待处理',
          'Issue needs review',
        ),
        statusTone: 'warning',
        pendingCount: continueCards.length,
        runningCount,
      };
    }
    return {
      statusLabel: tr(
        language,
        'command_center.home.status.continue_active_thread',
        '可以继续当前协作',
        'Continue the active thread',
      ),
      statusTone: 'active',
      pendingCount: continueCards.length,
      runningCount,
    };
  }

  if (lastSummaryCard) {
    return {
      statusLabel: tr(
        language,
        'command_center.home.status.last_flow_completed',
        '上次流程已完成',
        'Last flow completed',
      ),
      statusTone: 'success',
      pendingCount: 0,
      runningCount,
    };
  }

  return {
    statusLabel: tr(
      language,
      'command_center.home.status.ready_new_request',
      '准备开始新的输入',
      'Ready for a new request',
    ),
    statusTone: 'neutral',
    pendingCount: 0,
    runningCount,
  };
}

export function deriveCommandCenterHomeLayout(input: {
  workspaceProjection: ManagerWorkspaceProjection | null | undefined;
  language: 'zh' | 'en';
  domainId?: string;
}): CommandCenterHomeLayout {
  const { workspaceProjection, language, domainId } = input;
  const approvals = workspaceProjection?.taskState.pendingApprovals || [];
  const clarificationDrafts = workspaceProjection?.taskState.pendingClarifications || [];
  const supervisorCompositeCard = buildSupervisorCompositeContinueCard(workspaceProjection, language);
  const continueCards = [
    ...(supervisorCompositeCard ? [supervisorCompositeCard] : []),
    ...buildApprovalCards(approvals, language),
    ...buildClarificationCards(clarificationDrafts, language),
    ...(() => {
      if (supervisorCompositeCard) {
        return [];
      }
      const card = buildWorkflowClarificationCard(workspaceProjection, language);
      return card ? [card] : [];
    })(),
    ...(() => {
      const card = buildExceptionCard(workspaceProjection, language);
      return card ? [card] : [];
    })(),
    ...(() => {
      const card = buildResumableCard(workspaceProjection, language);
      return card ? [card] : [];
    })(),
  ].slice(0, 3);

  const mode: CommandCenterHomeMode =
    continueCards.length > 0 ? 'continue_first' : 'new_input_first';
  const lastSummaryCard =
    mode === 'new_input_first' ? buildLastSummaryCard(workspaceProjection, language) : null;
  const status = deriveStatus({
    continueCards,
    workspaceProjection,
    language,
    lastSummaryCard,
  });

  return {
    mode,
    statusLabel: status.statusLabel,
    statusTone: status.statusTone,
    pendingCount: status.pendingCount,
    runningCount: status.runningCount,
    continueCards,
    lastSummaryCard,
    suggestionChips: buildSuggestionChips(language, domainId),
  };
}
