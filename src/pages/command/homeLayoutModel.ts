import { translateText } from '@/src/i18n/translate';
import {
  formatAutomationSchedule,
  getAutomationTargetSelectorLabel,
  getCommandComposerExamples,
  getNextClarificationQuestion,
  type AutomationDraft,
  type AutomationRun,
} from '@/src/services/automation';
import type {
  ManagerFeedBlock,
} from '@/src/services/manager-gateway/types';
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

function buildSuggestionChips(language: 'zh' | 'en'): CommandCenterSuggestionChip[] {
  return getCommandComposerExamples(language, 'smart').slice(0, 3).map((entry, index) => ({
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
}): CommandCenterHomeLayout {
  const { workspaceProjection, language } = input;
  const approvals = workspaceProjection?.taskState.pendingApprovals || [];
  const clarificationDrafts = workspaceProjection?.taskState.pendingClarifications || [];
  const continueCards = [
    ...buildApprovalCards(approvals, language),
    ...buildClarificationCards(clarificationDrafts, language),
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
    suggestionChips: buildSuggestionChips(language),
  };
}
