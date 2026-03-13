import {
  formatAutomationSchedule,
  getCommandComposerExamples,
  getNextClarificationQuestion,
  type AutomationDraft,
} from '@/src/services/automation';
import type {
  ManagerFeedBlock,
  ManagerSessionProjection,
} from '@/src/services/manager-gateway/types';
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

function getDraftTargetLabel(draft: AutomationDraft, language: 'zh' | 'en'): string {
  if (!draft.targetSelector) {
    return language === 'zh' ? '待补充目标' : 'Target needed';
  }

  if (draft.targetSelector.mode === 'fixed_subject') {
    return draft.targetSelector.subjectLabel;
  }

  if (draft.targetSelector.mode === 'league_query') {
    return draft.targetSelector.leagueLabel;
  }

  return draft.targetSelector.displayLabel;
}

function buildDraftDescription(draft: AutomationDraft, language: 'zh' | 'en'): string {
  const scheduleLabel = formatAutomationSchedule(draft.schedule, language);
  const targetLabel = getDraftTargetLabel(draft, language);
  if (language === 'zh') {
    return `${targetLabel} · ${scheduleLabel}`;
  }
  return `${targetLabel} · ${scheduleLabel}`;
}

function buildApprovalCards(
  drafts: AutomationDraft[],
  language: 'zh' | 'en',
): CommandCenterContinueCard[] {
  return drafts
    .filter((draft) => draft.status === 'ready')
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map((draft) => ({
      id: `approval:${draft.id}`,
      kind: 'approval' as const,
      title: draft.title,
      description: buildDraftDescription(draft, language),
      primaryActionLabel:
        draft.activationMode === 'run_now'
          ? language === 'zh'
            ? '立即分析'
            : 'Analyze now'
          : language === 'zh'
            ? '确认执行'
            : 'Confirm run',
      eyebrow: language === 'zh' ? '待确认任务' : 'Approval needed',
      action: {
        type: 'activate_draft',
        draftId: draft.id,
      },
    }));
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
        (language === 'zh'
          ? '还缺少继续执行所需的关键信息。'
          : 'Some required details are still missing before this can continue.'),
      primaryActionLabel: language === 'zh' ? '继续补充' : 'Continue',
      eyebrow: language === 'zh' ? '待回复问题' : 'Needs reply',
      action: {
        type: 'focus_draft',
        draftId: draft.id,
      },
    }));
}

function findLatestErrorBlock(
  projection: ManagerSessionProjection | null | undefined,
): ManagerFeedBlock | null {
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

function buildExceptionCard(
  projection: ManagerSessionProjection | null | undefined,
  language: 'zh' | 'en',
): CommandCenterContinueCard | null {
  const latestErrorBlock = findLatestErrorBlock(projection);
  if (latestErrorBlock) {
    return {
      id: `exception:${latestErrorBlock.id}`,
      kind: 'exception',
      title: language === 'zh' ? '上一次执行需要处理' : 'The last run needs review',
      description: latestErrorBlock.text?.trim() || '',
      primaryActionLabel: language === 'zh' ? '查看异常' : 'Review issue',
      eyebrow: language === 'zh' ? '异常待处理' : 'Issue detected',
      action: {
        type: 'focus_run_status',
      },
    };
  }

  const latestRun = projection?.latestRun;
  if (latestRun?.status !== 'failed') {
    return null;
  }

  return {
    id: `exception:run:${latestRun.id}`,
    kind: 'exception',
    title: language === 'zh' ? '最近一次执行失败' : 'The latest run failed',
    description:
      latestRun.errorMessage ||
      latestRun.errorCode ||
      (language === 'zh'
        ? '需要回到会话里查看失败原因。'
        : 'Open the conversation to inspect the failure details.'),
    primaryActionLabel: language === 'zh' ? '查看异常' : 'Review issue',
    eyebrow: language === 'zh' ? '异常待处理' : 'Issue detected',
    action: {
      type: 'focus_run_status',
    },
  };
}

function buildResumableCard(
  projection: ManagerSessionProjection | null | undefined,
  language: 'zh' | 'en',
): CommandCenterContinueCard | null {
  const activeRun = projection?.activeRun;
  if (!activeRun || (activeRun.status !== 'queued' && activeRun.status !== 'running')) {
    return null;
  }

  const statusLabel =
    activeRun.status === 'running'
      ? language === 'zh'
        ? '正在推进'
        : 'In progress'
      : language === 'zh'
        ? '排队中'
        : 'Queued';

  return {
    id: `resumable:${activeRun.id}`,
    kind: 'resumable',
    title:
      projection?.session.title ||
      (language === 'zh' ? '继续当前主题' : 'Continue current thread'),
    description:
      language === 'zh'
        ? `${statusLabel} · 返回会话查看最新进展。`
        : `${statusLabel} · Return to the conversation to review the latest progress.`,
    primaryActionLabel: language === 'zh' ? '查看进展' : 'View progress',
    eyebrow: language === 'zh' ? '可继续主题' : 'Resumable thread',
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
  projection: ManagerSessionProjection | null | undefined,
  language: 'zh' | 'en',
): CommandCenterSummaryCard | null {
  const items = projectManagerSessionProjectionToCommandCenterFeed(projection);
  const latestAssistantText = [...items]
    .reverse()
    .find((item) => item.role === 'assistant' && typeof item.text === 'string' && item.text.trim().length > 0);

  if (latestAssistantText?.text) {
    return {
      title: language === 'zh' ? '上次已完成' : 'Last completed flow',
      summary: latestAssistantText.text.trim(),
      actionLabel: language === 'zh' ? '查看对话' : 'Open thread',
    };
  }

  if (projection?.latestRun?.status === 'completed') {
    return {
      title: language === 'zh' ? '上次已完成' : 'Last completed flow',
      summary:
        language === 'zh'
          ? '上一次流程已经结束，可以直接开始新的输入。'
          : 'The previous flow is complete. You can start a new request now.',
      actionLabel: language === 'zh' ? '查看对话' : 'Open thread',
    };
  }

  return null;
}

function deriveStatus(input: {
  continueCards: CommandCenterContinueCard[];
  projection: ManagerSessionProjection | null | undefined;
  language: 'zh' | 'en';
  lastSummaryCard: CommandCenterSummaryCard | null;
}): Pick<CommandCenterHomeLayout, 'statusLabel' | 'statusTone' | 'pendingCount' | 'runningCount'> {
  const { continueCards, projection, language, lastSummaryCard } = input;
  const runningCount =
    projection?.activeRun && (projection.activeRun.status === 'queued' || projection.activeRun.status === 'running')
      ? 1
      : 0;

  if (continueCards.length > 0) {
    const firstKind = continueCards[0].kind;
    if (firstKind === 'approval') {
      return {
        statusLabel: language === 'zh' ? '有待确认任务' : 'Approval needed',
        statusTone: 'warning',
        pendingCount: continueCards.length,
        runningCount,
      };
    }
    if (firstKind === 'clarification') {
      return {
        statusLabel: language === 'zh' ? '需要补充信息' : 'Details needed',
        statusTone: 'warning',
        pendingCount: continueCards.length,
        runningCount,
      };
    }
    if (firstKind === 'exception') {
      return {
        statusLabel: language === 'zh' ? '有异常待处理' : 'Issue needs review',
        statusTone: 'warning',
        pendingCount: continueCards.length,
        runningCount,
      };
    }
    return {
      statusLabel: language === 'zh' ? '可以继续当前协作' : 'Continue the active thread',
      statusTone: 'active',
      pendingCount: continueCards.length,
      runningCount,
    };
  }

  if (lastSummaryCard) {
    return {
      statusLabel: language === 'zh' ? '上次流程已完成' : 'Last flow completed',
      statusTone: 'success',
      pendingCount: 0,
      runningCount,
    };
  }

  return {
    statusLabel: language === 'zh' ? '准备开始新的输入' : 'Ready for a new request',
    statusTone: 'neutral',
    pendingCount: 0,
    runningCount,
  };
}

export function deriveCommandCenterHomeLayout(input: {
  projection: ManagerSessionProjection | null | undefined;
  drafts: AutomationDraft[];
  language: 'zh' | 'en';
}): CommandCenterHomeLayout {
  const { projection, drafts, language } = input;
  const continueCards = [
    ...buildApprovalCards(drafts, language),
    ...buildClarificationCards(drafts, language),
    ...(() => {
      const card = buildExceptionCard(projection, language);
      return card ? [card] : [];
    })(),
    ...(() => {
      const card = buildResumableCard(projection, language);
      return card ? [card] : [];
    })(),
  ].slice(0, 3);

  const mode: CommandCenterHomeMode =
    continueCards.length > 0 ? 'continue_first' : 'new_input_first';
  const lastSummaryCard =
    mode === 'new_input_first' ? buildLastSummaryCard(projection, language) : null;
  const status = deriveStatus({
    continueCards,
    projection,
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
