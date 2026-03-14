import type { AnalysisRequestPayload } from '@/src/services/ai/contracts';
import { translateText } from '@/src/i18n/translate';
import { buildSubjectRoute } from '@/src/services/navigation/subjectRoute';
import { getNextClarificationQuestion } from './clarification';
import { assembleAutomationJob } from './jobAssembler';
import type {
  AutomationDraft,
  AutomationDraftActivationMode,
  AutomationJob,
} from './types';
import { createAutomationId, resolveAutomationTimeZone } from './utils';

export type AutomationCommandComposerMode =
  | 'smart'
  | 'analyze_now'
  | 'automation';

export interface ImmediateAnalysisNavigationTarget {
  route: string;
  state: {
    importedData: AnalysisRequestPayload;
    autoStartAnalysis: true;
    autoStartSourceText: string;
  };
}

export interface ImmediateAnalysisNavigationResult {
  status: 'ready' | 'unsupported';
  navigation?: ImmediateAnalysisNavigationTarget;
  message?: string;
}

export interface AutomationManagerResponseSummary {
  totalDrafts: number;
  readyCount: number;
  clarificationCount: number;
  rejectedCount: number;
  runNowCount: number;
  saveOnlyCount: number;
  message: string;
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

function detectLanguage(sourceText: string): 'zh' | 'en' {
  return /[\u4e00-\u9fa5]/.test(sourceText) ? 'zh' : 'en';
}

export function summarizeManagerResponse(
  drafts: AutomationDraft[],
  options: {
    composerMode: AutomationCommandComposerMode;
    language: 'zh' | 'en';
  },
): AutomationManagerResponseSummary {
  const readyCount = drafts.filter((draft) => draft.status === 'ready').length;
  const clarificationCount = drafts.filter(
    (draft) => draft.status === 'needs_clarification',
  ).length;
  const rejectedCount = drafts.filter((draft) => draft.status === 'rejected').length;
  const runNowCount = drafts.filter((draft) => draft.activationMode === 'run_now').length;
  const saveOnlyCount = drafts.length - runNowCount;

  if (options.language === 'zh') {
    const lead =
      drafts.length === 0
        ? '总管暂时没有整理出可执行任务。'
        : runNowCount > 0 && saveOnlyCount === 0
          ? `总管已整理 ${drafts.length} 个等待确认的立即分析请求。`
          : `总管已整理 ${drafts.length} 个待执行任务草稿。`;
    const parts = [
      readyCount > 0 ? `${readyCount} 个可直接确认` : null,
      clarificationCount > 0 ? `${clarificationCount} 个待补充` : null,
      rejectedCount > 0 ? `${rejectedCount} 个未接纳` : null,
    ].filter(Boolean);
    const tail =
      clarificationCount > 0
        ? '待编辑卡片已放到对话里，请先补充关键信息。'
        : runNowCount > 0 && saveOnlyCount === 0
          ? '确认卡片后会立刻启动分析。'
          : options.composerMode === 'analyze_now' && saveOnlyCount > 0
            ? '这次我已改写成自动化草稿，待确认卡片已放到对话里。'
            : '待确认卡片已放到对话里。';

    return {
      totalDrafts: drafts.length,
      readyCount,
      clarificationCount,
      rejectedCount,
      runNowCount,
      saveOnlyCount,
      message: [lead, parts.length > 0 ? `${parts.join('，')}。` : null, tail]
        .filter(Boolean)
        .join(' '),
    };
  }

  const lead =
    drafts.length === 0
      ? 'The manager could not prepare an actionable task yet.'
      : runNowCount > 0 && saveOnlyCount === 0
        ? `The manager prepared ${drafts.length} instant analysis request(s) pending confirmation.`
        : `The manager has prepared ${drafts.length} task draft(s).`;
  const parts = [
    readyCount > 0 ? `${readyCount} ready to confirm` : null,
    clarificationCount > 0 ? `${clarificationCount} need clarification` : null,
    rejectedCount > 0 ? `${rejectedCount} rejected` : null,
  ].filter(Boolean);
  const tail =
    clarificationCount > 0
      ? 'Editable cards are now in the conversation. Fill in the missing details first.'
      : runNowCount > 0 && saveOnlyCount === 0
        ? 'Confirm the card and the analysis will start immediately.'
        : options.composerMode === 'analyze_now' && saveOnlyCount > 0
          ? 'This command was converted into automation drafts, and the editable cards are now in the conversation.'
          : 'Review cards are now in the conversation.';

  return {
    totalDrafts: drafts.length,
    readyCount,
    clarificationCount,
    rejectedCount,
    runNowCount,
    saveOnlyCount,
    message: [lead, parts.length > 0 ? parts.join(', ') + '.' : null, tail]
      .filter(Boolean)
      .join(' '),
  };
}

function hasExplicitScheduleHint(sourceText: string): boolean {
  return /(?:every day|daily|tonight|tomorrow|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b|每天|每日|今晚|明天|明晚|\d{1,2}\s*点)/i.test(
    sourceText,
  );
}

function shouldRunNow(
  sourceText: string,
  drafts: AutomationDraft[],
  composerMode: AutomationCommandComposerMode,
): boolean {
  if (drafts.length !== 1) {
    return false;
  }

  if (drafts[0].intentType !== 'one_time') {
    return false;
  }

  if (composerMode === 'analyze_now') {
    return true;
  }

  if (composerMode === 'smart') {
    return !hasExplicitScheduleHint(sourceText);
  }

  return false;
}

function buildImmediateSchedule(now: Date) {
  return {
    type: 'one_time' as const,
    runAt: now.toISOString(),
    timezone: resolveAutomationTimeZone(),
  };
}

function applyDraftActivationMode(
  draft: AutomationDraft,
  activationMode: AutomationDraftActivationMode,
  now: Date,
): AutomationDraft {
  const language = detectLanguage(draft.sourceText);
  const nextDraft: AutomationDraft = {
    ...draft,
    activationMode,
    schedule:
      activationMode === 'run_now'
        ? buildImmediateSchedule(now)
        : draft.schedule,
    updatedAt: Date.now(),
  };

  nextDraft.status =
    nextDraft.schedule && nextDraft.targetSelector ? 'ready' : 'needs_clarification';
  nextDraft.clarificationState = {
    ...nextDraft.clarificationState,
    lastQuestion: getNextClarificationQuestion(nextDraft, language) || undefined,
  };

  return nextDraft;
}

export function finalizeAutomationDraftsForComposer(
  sourceText: string,
  drafts: AutomationDraft[],
  options: {
    composerMode: AutomationCommandComposerMode;
    now?: Date;
  },
): AutomationDraft[] {
  const now = options.now || new Date();
  const runNow = shouldRunNow(sourceText, drafts, options.composerMode);

  return drafts.map((draft) =>
    applyDraftActivationMode(draft, runNow ? 'run_now' : 'save_only', now),
  );
}

function buildPreviewJobFromDraft(draft: AutomationDraft): AutomationJob {
  return {
    id: createAutomationId('automation_job_preview'),
    title: draft.title,
    sourceDraftId: draft.id,
    sourceRuleId: undefined,
    domainId: draft.domainId,
    domainPackVersion: draft.domainPackVersion,
    templateId: draft.templateId,
    triggerType: 'one_time',
    targetSelector: draft.targetSelector!,
    targetSnapshot: undefined,
    notificationPolicy: draft.notificationPolicy,
    analysisProfile: draft.analysisProfile,
    scheduledFor:
      draft.schedule?.type === 'one_time'
        ? draft.schedule.runAt
        : new Date().toISOString(),
    state: 'pending',
    retryCount: 0,
    maxRetries: draft.executionPolicy.maxRetries,
    retryAfter: null,
    recoveryWindowEndsAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function buildImmediateModeUnsupportedMessage(
  language: 'zh' | 'en',
  reason: 'missing_target' | 'multi_target' | 'recurring',
): string {
  if (reason === 'missing_target') {
    return tr(
      language,
      'task_center.feedback.immediate_missing_target',
      '请先补充一个明确的分析目标，再执行立即分析。',
      'Add one clear target before running an immediate analysis.',
    );
  }
  if (reason === 'recurring') {
    return tr(
      language,
      'task_center.feedback.immediate_recurring',
      '周期任务请切到“自动化”模式保存，不支持作为立即分析执行。',
      'Recurring commands should be saved in Automation mode, not run as immediate analysis.',
    );
  }
  return tr(
    language,
    'task_center.feedback.immediate_multi_target',
    '这条指令会展开成多个目标。请改成一个具体对象，或切到“自动化”模式。',
    'This command expands to multiple targets. Narrow it down or switch to Automation mode.',
  );
}

export async function resolveImmediateAnalysisNavigation(
  draft: AutomationDraft,
  language: 'zh' | 'en',
): Promise<ImmediateAnalysisNavigationResult> {
  if (draft.intentType !== 'one_time') {
    return {
      status: 'unsupported',
      message: buildImmediateModeUnsupportedMessage(language, 'recurring'),
    };
  }

  if (!draft.targetSelector) {
    return {
      status: 'unsupported',
      message: buildImmediateModeUnsupportedMessage(language, 'missing_target'),
    };
  }

  const assembled = await assembleAutomationJob(buildPreviewJobFromDraft(draft));

  if (assembled.targets.length !== 1) {
    return {
      status: 'unsupported',
      message: buildImmediateModeUnsupportedMessage(language, 'multi_target'),
    };
  }

  const target = assembled.targets[0];
  return {
    status: 'ready',
    navigation: {
      route: buildSubjectRoute(target.domainId, target.subjectId),
      state: {
        importedData: target.dataToAnalyze,
        autoStartAnalysis: true,
        autoStartSourceText: draft.sourceText,
      },
    },
  };
}

export function getCommandComposerExamples(
  language: 'zh' | 'en',
  composerMode: AutomationCommandComposerMode,
): string[] {
  if (composerMode === 'analyze_now') {
    return [
      tr(
        language,
        'task_center.examples.analyze_now.0',
        '现在分析皇马 vs 巴萨',
        'Analyze Real Madrid vs Barcelona now',
      ),
      tr(
        language,
        'task_center.examples.analyze_now.1',
        '马上分析曼联 vs 利物浦',
        'Run Manchester United vs Liverpool now',
      ),
      tr(
        language,
        'task_center.examples.analyze_now.2',
        '分析今天的英超焦点战',
        "Analyze today's key Premier League match now",
      ),
    ];
  }

  if (composerMode === 'automation') {
    return [
      tr(
        language,
        'task_center.examples.automation.0',
        '今晚 20:00 分析皇马 vs 巴萨，完成后提醒我',
        'Tonight at 20:00 analyze Real Madrid vs Barcelona and notify me',
      ),
      tr(
        language,
        'task_center.examples.automation.1',
        '每天 09:00 分析英超和西甲全部比赛',
        'Every day at 09:00 analyze all Premier League and La Liga matches',
      ),
      tr(
        language,
        'task_center.examples.automation.2',
        '明晚 19:30 自动分析英超重点比赛',
        'Tomorrow at 19:30 automatically analyze key Premier League matches',
      ),
    ];
  }

  return [
    tr(
      language,
      'task_center.examples.smart.0',
      '现在分析皇马 vs 巴萨',
      'Analyze Real Madrid vs Barcelona now',
    ),
    tr(
      language,
      'task_center.examples.smart.1',
      '今晚 20:00 分析皇马 vs 巴萨，完成后提醒我',
      'Tonight at 20:00 analyze Real Madrid vs Barcelona and notify me',
    ),
    tr(
      language,
      'task_center.examples.smart.2',
      '每天 09:00 分析英超和西甲全部比赛',
      'Every day at 09:00 analyze all Premier League and La Liga matches',
    ),
  ];
}
