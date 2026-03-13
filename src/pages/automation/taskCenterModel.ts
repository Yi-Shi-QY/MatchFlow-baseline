import {
  formatAutomationSchedule,
  getNextClarificationQuestion,
  type AutomationDraft,
  type AutomationJob,
  type AutomationRule,
  type AutomationRun,
} from '@/src/services/automation';

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

function getRuleTargetLabel(rule: AutomationRule): string {
  if (rule.targetSelector.mode === 'fixed_subject') {
    return rule.targetSelector.subjectLabel;
  }
  if (rule.targetSelector.mode === 'league_query') {
    return rule.targetSelector.leagueLabel;
  }
  return rule.targetSelector.displayLabel;
}

function getJobTargetLabel(job: AutomationJob): string {
  if (job.targetSelector.mode === 'fixed_subject') {
    return job.targetSelector.subjectLabel;
  }
  if (job.targetSelector.mode === 'league_query') {
    return job.targetSelector.leagueLabel;
  }
  return job.targetSelector.displayLabel;
}

function buildDraftDescription(draft: AutomationDraft, language: 'zh' | 'en'): string {
  const target = getDraftTargetLabel(draft, language);
  const schedule = formatAutomationSchedule(draft.schedule, language);
  return language === 'zh' ? `${target} · ${schedule}` : `${target} · ${schedule}`;
}

function buildApprovalCards(
  drafts: AutomationDraft[],
  language: 'zh' | 'en',
): TaskCenterCard[] {
  return drafts
    .filter((draft) => draft.status === 'ready')
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map((draft) => ({
      id: `approval:${draft.id}`,
      kind: 'approval',
      title: draft.title,
      eyebrow: language === 'zh' ? '待确认执行' : 'Approval needed',
      description: buildDraftDescription(draft, language),
      meta: [
        getDraftTargetLabel(draft, language),
        formatAutomationSchedule(draft.schedule, language),
      ],
      target: {
        type: 'draft',
        id: draft.id,
      },
      primaryAction: {
        label: language === 'zh' ? '确认执行' : 'Confirm run',
        action: {
          type: 'activate_draft',
          draftId: draft.id,
        },
      },
    }));
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
      eyebrow: language === 'zh' ? '待补充信息' : 'Needs clarification',
      description:
        getNextClarificationQuestion(draft, language)?.prompt ||
        (language === 'zh'
          ? '还缺少继续执行所需的关键信息。'
          : 'Some required details are still missing before this can proceed.'),
      meta: [getDraftTargetLabel(draft, language)],
      target: {
        type: 'draft',
        id: draft.id,
      },
      primaryAction: {
        label: language === 'zh' ? '继续补充' : 'Continue',
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
      eyebrow: language === 'zh' ? '异常待处理' : 'Issue detected',
      description:
        draft.rejectionReason ||
        (language === 'zh'
          ? '这条任务草稿当前无法继续执行。'
          : 'This draft cannot proceed in its current form.'),
      meta: [getDraftTargetLabel(draft, language)],
      target: {
        type: 'draft',
        id: draft.id,
      },
      primaryAction: {
        label: language === 'zh' ? '处理异常' : 'Handle issue',
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
      eyebrow: language === 'zh' ? '异常待处理' : 'Issue detected',
      description:
        run.errorMessage ||
        (language === 'zh'
          ? '最近一次运行失败，需要回看详情。'
          : 'The most recent run failed and needs review.'),
      meta: [formatTimestamp(run.updatedAt, language)],
      target: {
        type: 'run',
        id: run.id,
      },
      primaryAction: {
        label: language === 'zh' ? '处理异常' : 'Handle issue',
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
      eyebrow: language === 'zh' ? '执行中' : 'Running',
      description:
        language === 'zh'
          ? '任务已经开始执行，可回看最近进展。'
          : 'This task is already running. Open it to review the latest progress.',
      meta: [formatTimestamp(run.updatedAt, language)],
      target: {
        type: 'run',
        id: run.id,
      },
      primaryAction: {
        label: language === 'zh' ? '查看进展' : 'View progress',
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
      eyebrow: language === 'zh' ? '已安排规则' : 'Scheduled rule',
      description:
        language === 'zh'
          ? `${getRuleTargetLabel(rule)} · ${formatAutomationSchedule(rule.schedule, language)}`
          : `${getRuleTargetLabel(rule)} · ${formatAutomationSchedule(rule.schedule, language)}`,
      meta: [formatTimestamp(rule.nextPlannedAt, language)],
      target: {
        type: 'rule',
        id: rule.id,
      },
      primaryAction: {
        label: language === 'zh' ? '查看安排' : 'View schedule',
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
      eyebrow: language === 'zh' ? '已安排任务' : 'Scheduled job',
      description:
        language === 'zh'
          ? `${getJobTargetLabel(job)} · ${formatTimestamp(job.scheduledFor, language)}`
          : `${getJobTargetLabel(job)} · ${formatTimestamp(job.scheduledFor, language)}`,
      meta: [getJobTargetLabel(job)],
      target: {
        type: 'job',
        id: job.id,
      },
      primaryAction: {
        label: language === 'zh' ? '查看安排' : 'View schedule',
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
      eyebrow: language === 'zh' ? '最近完成' : 'Recent result',
      description:
        language === 'zh'
          ? '任务已完成，可查看结果回顾。'
          : 'This task is complete. Open it to review the result.',
      meta: [formatTimestamp(run.endedAt || run.updatedAt, language)],
      target: {
        type: 'run',
        id: run.id,
      },
      primaryAction: {
        label: language === 'zh' ? '查看结果' : 'View result',
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
  language: 'zh' | 'en';
}): TaskCenterModel {
  const { drafts, rules, jobs, runs, language } = input;
  const waitingItems = [
    ...buildApprovalCards(drafts, language),
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
        label: language === 'zh' ? '待我处理' : 'Waiting',
        value: waitingItems.length,
      },
      {
        id: 'running',
        label: language === 'zh' ? '执行中' : 'Running',
        value: runningItems.length,
      },
      {
        id: 'scheduled',
        label: language === 'zh' ? '已安排' : 'Scheduled',
        value: scheduledItems.length,
      },
      {
        id: 'completed',
        label: language === 'zh' ? '最近完成' : 'Completed',
        value: completedItems.length,
      },
    ],
    waitingItems,
    runningItems,
    scheduledItems,
    completedItems,
  };
}
