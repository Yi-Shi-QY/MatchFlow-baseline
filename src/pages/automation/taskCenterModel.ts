import { translateText } from '@/src/i18n/translate';
import {
  formatAutomationSchedule,
  getAutomationTargetSelectorLabel,
  getNextClarificationQuestion,
  type AutomationDraft,
  type AutomationJob,
  type AutomationRule,
  type AutomationRun,
} from '@/src/services/automation';
import type { ExecutionTicket } from '@/src/services/manager-workspace/executionTicketTypes';
import {
  buildExecutionApprovalCardModel,
  type ExecutionApprovalCardModel,
} from '@/src/pages/command/ExecutionApprovalCard';

export type TaskCenterSummaryMetricId = 'waiting' | 'running' | 'scheduled' | 'completed';
export type TaskCenterCardKind =
  | 'approval'
  | 'clarification'
  | 'exception'
  | 'running'
  | 'scheduled'
  | 'completed';

export type TaskCenterAction =
  | {
      type: 'activate_draft';
      draftId: string;
    }
  | {
      type: 'delete_draft';
      draftId: string;
    }
  | {
      type: 'focus_draft';
      draftId: string;
    }
  | {
      type: 'focus_rule';
      ruleId: string;
    }
  | {
      type: 'focus_job';
      jobId: string;
    }
  | {
      type: 'focus_run';
      runId: string;
    };

export interface TaskCenterActionDescriptor {
  label: string;
  action: TaskCenterAction;
}

export interface TaskCenterCardTarget {
  type: 'draft' | 'rule' | 'job' | 'run';
  id: string;
}

export interface TaskCenterCard {
  id: string;
  kind: TaskCenterCardKind;
  title: string;
  eyebrow: string;
  description: string;
  meta: string[];
  target: TaskCenterCardTarget;
  primaryAction: TaskCenterActionDescriptor;
  secondaryAction?: TaskCenterActionDescriptor;
  approval?: ExecutionApprovalCardModel;
}

export interface TaskCenterSummaryMetric {
  id: TaskCenterSummaryMetricId;
  label: string;
  value: number;
}

export interface TaskCenterModel {
  summaryMetrics: TaskCenterSummaryMetric[];
  waitingItems: TaskCenterCard[];
  runningItems: TaskCenterCard[];
  scheduledItems: TaskCenterCard[];
  completedItems: TaskCenterCard[];
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

function formatTimestamp(value: number | string | null | undefined, language: 'zh' | 'en'): string {
  if (value === null || value === undefined) {
    return '-';
  }

  const date = typeof value === 'number' ? new Date(value) : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseComparableTime(value: number | string | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function getDraftTargetLabel(draft: AutomationDraft, language: 'zh' | 'en'): string {
  return (
    getAutomationTargetSelectorLabel(draft.targetSelector) ||
    tr(language, 'task_center.cards.target_needed', '待补充目标', 'Target needed')
  );
}

function getRuleTargetLabel(rule: AutomationRule): string {
  return getAutomationTargetSelectorLabel(rule.targetSelector) || rule.title;
}

function getJobTargetLabel(job: AutomationJob): string {
  return getAutomationTargetSelectorLabel(job.targetSelector) || job.title;
}

function buildDraftDescription(draft: AutomationDraft, language: 'zh' | 'en'): string {
  const target = getDraftTargetLabel(draft, language);
  const schedule = formatAutomationSchedule(draft.schedule, language);
  return `${target} · ${schedule}`;
}

function buildApprovalCards(
  drafts: AutomationDraft[],
  executionTickets: ExecutionTicket[],
  language: 'zh' | 'en',
): TaskCenterCard[] {
  const ticketsByDraftId = new Map(
    executionTickets
      .filter((ticket) => typeof ticket.draftId === 'string' && ticket.draftId.trim().length > 0)
      .map((ticket) => [ticket.draftId as string, ticket]),
  );

  return drafts
    .filter((draft) => draft.status === 'ready')
    .sort((left, right) => {
      const leftTicketUpdatedAt = ticketsByDraftId.get(left.id)?.updatedAt || 0;
      const rightTicketUpdatedAt = ticketsByDraftId.get(right.id)?.updatedAt || 0;
      return Math.max(right.updatedAt, rightTicketUpdatedAt) - Math.max(left.updatedAt, leftTicketUpdatedAt);
    })
    .map((draft) => {
      const approval = buildExecutionApprovalCardModel({
        draft,
        ticket: ticketsByDraftId.get(draft.id) || null,
        language,
      });

      return {
      id: `approval:${approval.approvalId}`,
      kind: 'approval',
      title: approval.title,
      eyebrow: tr(language, 'task_center.cards.approval.eyebrow', '待确认执行', 'Approval needed'),
      description: approval.summary || buildDraftDescription(draft, language),
      meta: [
        approval.targetValue,
        approval.whenValue,
      ],
      target: {
        type: 'draft',
        id: draft.id,
      },
      primaryAction: {
        label: tr(language, 'task_center.cards.approval.action', '确认执行', 'Confirm run'),
        action: {
          type: 'activate_draft',
          draftId: draft.id,
        },
      },
      secondaryAction: {
        label: approval.secondaryActionLabel,
        action: {
          type: 'delete_draft',
          draftId: draft.id,
        },
      },
      approval,
    };
    });
}

function buildClarificationCards(
  drafts: AutomationDraft[],
  language: 'zh' | 'en',
): TaskCenterCard[] {
  return drafts
    .filter((draft) => draft.status === 'needs_clarification')
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map((draft) => ({
      id: `clarification:${draft.id}`,
      kind: 'clarification',
      title: draft.title,
      eyebrow: tr(
        language,
        'task_center.cards.clarification.eyebrow',
        '待补充信息',
        'Needs clarification',
      ),
      description:
        getNextClarificationQuestion(draft, language)?.prompt ||
        tr(
          language,
          'task_center.cards.clarification.description_fallback',
          '还缺少继续执行所需的关键信息。',
          'Some required details are still missing before this can proceed.',
        ),
      meta: [getDraftTargetLabel(draft, language)],
      target: {
        type: 'draft',
        id: draft.id,
      },
      primaryAction: {
        label: tr(language, 'task_center.cards.clarification.action', '继续补充', 'Continue'),
        action: {
          type: 'focus_draft',
          draftId: draft.id,
        },
      },
    }));
}

function buildRejectedDraftCards(
  drafts: AutomationDraft[],
  language: 'zh' | 'en',
): TaskCenterCard[] {
  return drafts
    .filter((draft) => draft.status === 'rejected')
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map((draft) => ({
      id: `exception:draft:${draft.id}`,
      kind: 'exception',
      title: draft.title,
      eyebrow: tr(language, 'task_center.cards.rejected.eyebrow', '异常待处理', 'Issue detected'),
      description:
        draft.rejectionReason ||
        tr(
          language,
          'task_center.cards.rejected.description_fallback',
          '这条任务草稿当前无法继续执行。',
          'This draft cannot proceed in its current form.',
        ),
      meta: [getDraftTargetLabel(draft, language)],
      target: {
        type: 'draft',
        id: draft.id,
      },
      primaryAction: {
        label: tr(language, 'task_center.cards.rejected.action', '处理异常', 'Handle issue'),
        action: {
          type: 'focus_draft',
          draftId: draft.id,
        },
      },
    }));
}

function buildFailedRunCards(
  runs: AutomationRun[],
  language: 'zh' | 'en',
): TaskCenterCard[] {
  return runs
    .filter((run) => run.state === 'failed')
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map((run) => ({
      id: `exception:run:${run.id}`,
      kind: 'exception',
      title: run.title,
      eyebrow: tr(language, 'task_center.cards.failed.eyebrow', '异常待处理', 'Issue detected'),
      description:
        run.errorMessage ||
        tr(
          language,
          'task_center.cards.failed.description_fallback',
          '最近一次运行失败，需要回看详情。',
          'The most recent run failed and needs review.',
        ),
      meta: [formatTimestamp(run.updatedAt, language)],
      target: {
        type: 'run',
        id: run.id,
      },
      primaryAction: {
        label: tr(language, 'task_center.cards.failed.action', '处理异常', 'Handle issue'),
        action: {
          type: 'focus_run',
          runId: run.id,
        },
      },
    }));
}

function buildRunningCards(
  runs: AutomationRun[],
  language: 'zh' | 'en',
): TaskCenterCard[] {
  return runs
    .filter((run) => run.state === 'running')
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map((run) => ({
      id: `running:${run.id}`,
      kind: 'running',
      title: run.title,
      eyebrow: tr(language, 'task_center.cards.running.eyebrow', '执行中', 'Running'),
      description: tr(
        language,
        'task_center.cards.running.description',
        '任务已经开始执行，可以回看最近进展。',
        'This task is already running. Open it to review the latest progress.',
      ),
      meta: [formatTimestamp(run.updatedAt, language)],
      target: {
        type: 'run',
        id: run.id,
      },
      primaryAction: {
        label: tr(language, 'task_center.cards.running.action', '查看进展', 'View progress'),
        action: {
          type: 'focus_run',
          runId: run.id,
        },
      },
    }));
}

function buildScheduledRuleCards(
  rules: AutomationRule[],
  language: 'zh' | 'en',
): TaskCenterCard[] {
  return rules
    .filter((rule) => rule.enabled)
    .sort(
      (left, right) =>
        parseComparableTime(left.nextPlannedAt || left.updatedAt) -
        parseComparableTime(right.nextPlannedAt || right.updatedAt),
    )
    .map((rule) => ({
      id: `scheduled:rule:${rule.id}`,
      kind: 'scheduled',
      title: rule.title,
      eyebrow: tr(
        language,
        'task_center.cards.scheduled_rule.eyebrow',
        '已安排规则',
        'Scheduled rule',
      ),
      description: `${getRuleTargetLabel(rule)} · ${formatAutomationSchedule(rule.schedule, language)}`,
      meta: [formatTimestamp(rule.nextPlannedAt, language)],
      target: {
        type: 'rule',
        id: rule.id,
      },
      primaryAction: {
        label: tr(
          language,
          'task_center.cards.scheduled_rule.action',
          '查看安排',
          'View schedule',
        ),
        action: {
          type: 'focus_rule',
          ruleId: rule.id,
        },
      },
    }));
}

function buildScheduledJobCards(
  jobs: AutomationJob[],
  language: 'zh' | 'en',
): TaskCenterCard[] {
  return jobs
    .filter((job) => job.state === 'pending' || job.state === 'eligible')
    .sort(
      (left, right) =>
        parseComparableTime(left.scheduledFor) - parseComparableTime(right.scheduledFor),
    )
    .map((job) => ({
      id: `scheduled:job:${job.id}`,
      kind: 'scheduled',
      title: job.title,
      eyebrow: tr(
        language,
        'task_center.cards.scheduled_job.eyebrow',
        '已安排任务',
        'Scheduled job',
      ),
      description: `${getJobTargetLabel(job)} · ${formatTimestamp(job.scheduledFor, language)}`,
      meta: [getJobTargetLabel(job)],
      target: {
        type: 'job',
        id: job.id,
      },
      primaryAction: {
        label: tr(
          language,
          'task_center.cards.scheduled_job.action',
          '查看安排',
          'View schedule',
        ),
        action: {
          type: 'focus_job',
          jobId: job.id,
        },
      },
    }));
}

function buildCompletedCards(
  runs: AutomationRun[],
  language: 'zh' | 'en',
): TaskCenterCard[] {
  return runs
    .filter((run) => run.state === 'completed')
    .sort(
      (left, right) =>
        parseComparableTime(right.endedAt || right.updatedAt) -
        parseComparableTime(left.endedAt || left.updatedAt),
    )
    .map((run) => ({
      id: `completed:${run.id}`,
      kind: 'completed',
      title: run.title,
      eyebrow: tr(language, 'task_center.cards.completed.eyebrow', '最近完成', 'Recent result'),
      description: tr(
        language,
        'task_center.cards.completed.description',
        '任务已经完成，可以查看结果回顾。',
        'This task is complete. Open it to review the result.',
      ),
      meta: [formatTimestamp(run.endedAt || run.updatedAt, language)],
      target: {
        type: 'run',
        id: run.id,
      },
      primaryAction: {
        label: tr(language, 'task_center.cards.completed.action', '查看结果', 'View result'),
        action: {
          type: 'focus_run',
          runId: run.id,
        },
      },
    }));
}

export function getTaskCenterAnchorId(target: TaskCenterCardTarget): string {
  if (target.type === 'draft') {
    return `automation-draft-${target.id}`;
  }
  if (target.type === 'rule') {
    return `automation-rule-${target.id}`;
  }
  if (target.type === 'job') {
    return `automation-job-${target.id}`;
  }
  return `automation-run-${target.id}`;
}

export function deriveTaskCenterModel(input: {
  drafts: AutomationDraft[];
  rules: AutomationRule[];
  jobs: AutomationJob[];
  runs: AutomationRun[];
  executionTickets: ExecutionTicket[];
  language: 'zh' | 'en';
}): TaskCenterModel {
  const { drafts, rules, jobs, runs, executionTickets, language } = input;
  const waitingItems = [
    ...buildApprovalCards(drafts, executionTickets, language),
    ...buildClarificationCards(drafts, language),
    ...buildRejectedDraftCards(drafts, language),
    ...buildFailedRunCards(runs, language),
  ];
  const runningItems = buildRunningCards(runs, language);
  const scheduledItems = [
    ...buildScheduledRuleCards(rules, language),
    ...buildScheduledJobCards(jobs, language),
  ];
  const completedItems = buildCompletedCards(runs, language);

  return {
    summaryMetrics: [
      {
        id: 'waiting',
        label: tr(language, 'task_center.summary.waiting', '待我处理', 'Waiting'),
        value: waitingItems.length,
      },
      {
        id: 'running',
        label: tr(language, 'task_center.summary.running', '执行中', 'Running'),
        value: runningItems.length,
      },
      {
        id: 'scheduled',
        label: tr(language, 'task_center.summary.scheduled', '已安排', 'Scheduled'),
        value: scheduledItems.length,
      },
      {
        id: 'completed',
        label: tr(language, 'task_center.summary.completed', '最近完成', 'Completed'),
        value: completedItems.length,
      },
    ],
    waitingItems,
    runningItems,
    scheduledItems,
    completedItems,
  };
}
