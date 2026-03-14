import { translateText } from '@/src/i18n/translate';
import type {
  ManagerRunRecord,
  ManagerSessionProjection,
} from '@/src/services/manager-gateway/types';

export interface CommandCenterRunStatusMetric {
  id: string;
  label: string;
  value: string;
}

export interface CommandCenterRunStatusModel {
  state: 'submitting' | 'queued' | 'running' | 'failed' | 'cancelled';
  badgeLabel: string;
  title: string;
  description: string;
  metrics: CommandCenterRunStatusMetric[];
  actionLabel?: string;
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

function formatTimestamp(
  timestamp: number | null | undefined,
  language: 'zh' | 'en',
): string {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    return '-';
  }

  try {
    return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return String(timestamp);
  }
}

function shortenId(input: string | null | undefined): string {
  if (!input) {
    return '-';
  }

  if (input.length <= 18) {
    return input;
  }

  return `${input.slice(0, 8)}...${input.slice(-6)}`;
}

function getStatusLabel(
  status: CommandCenterRunStatusModel['state'],
  language: 'zh' | 'en',
): string {
  switch (status) {
    case 'submitting':
      return tr(language, 'command_center.run_model.states.submitting', '提交中', 'Submitting');
    case 'queued':
      return tr(language, 'command_center.run_model.states.queued', '排队中', 'Queued');
    case 'running':
      return tr(language, 'command_center.run_model.states.running', '运行中', 'Running');
    case 'failed':
      return tr(language, 'command_center.run_model.states.failed', '失败', 'Failed');
    case 'cancelled':
      return tr(language, 'command_center.run_model.states.cancelled', '已取消', 'Cancelled');
  }
}

function getTriggerLabel(
  triggerType: ManagerRunRecord['triggerType'] | undefined,
  language: 'zh' | 'en',
): string {
  switch (triggerType) {
    case 'resume':
      return tr(language, 'command_center.run_model.trigger.resume', '恢复', 'Resume');
    case 'system':
      return tr(language, 'command_center.run_model.trigger.system', '系统', 'System');
    case 'compaction':
      return tr(language, 'command_center.run_model.trigger.compaction', '压缩', 'Compaction');
    default:
      return tr(language, 'command_center.run_model.trigger.user', '用户', 'User');
  }
}

function getPlannerLabel(
  plannerMode: ManagerRunRecord['plannerMode'] | undefined,
  language: 'zh' | 'en',
): string {
  if (!plannerMode) {
    return '-';
  }

  switch (plannerMode) {
    case 'workflow':
      return tr(language, 'command_center.run_model.planner.workflow', '工作流', 'Workflow');
    case 'llm_assisted':
      return tr(language, 'command_center.run_model.planner.llm', 'LLM', 'LLM');
    default:
      return tr(
        language,
        'command_center.run_model.planner.deterministic',
        '确定性',
        'Deterministic',
      );
  }
}

function buildRunMetrics(
  run: ManagerRunRecord | null,
  language: 'zh' | 'en',
): CommandCenterRunStatusMetric[] {
  if (!run) {
    return [];
  }

  return [
    {
      id: 'run_id',
      label: tr(language, 'command_center.run_model.metrics.run_id', 'Run ID', 'Run ID'),
      value: shortenId(run.id),
    },
    {
      id: 'status',
      label: tr(language, 'command_center.run_model.metrics.status', '状态', 'Status'),
      value: getStatusLabel(
        run.status === 'queued' ||
          run.status === 'running' ||
          run.status === 'failed' ||
          run.status === 'cancelled'
          ? run.status
          : 'running',
        language,
      ),
    },
    {
      id: 'trigger',
      label: tr(language, 'command_center.run_model.metrics.trigger', '触发', 'Trigger'),
      value: getTriggerLabel(run.triggerType, language),
    },
    {
      id: 'planner',
      label: tr(language, 'command_center.run_model.metrics.planner', '路径', 'Planner'),
      value: getPlannerLabel(run.plannerMode, language),
    },
    {
      id: 'tool',
      label: tr(language, 'command_center.run_model.metrics.tool', '工具', 'Tool'),
      value: run.toolPath || '-',
    },
    {
      id: 'intent',
      label: tr(language, 'command_center.run_model.metrics.intent', '意图', 'Intent'),
      value: run.intentType || '-',
    },
    {
      id: 'started',
      label: tr(language, 'command_center.run_model.metrics.started', '开始', 'Started'),
      value: formatTimestamp(run.startedAt || run.createdAt, language),
    },
    {
      id: 'updated',
      label: tr(language, 'command_center.run_model.metrics.updated', '更新', 'Updated'),
      value: formatTimestamp(run.updatedAt, language),
    },
  ];
}

export function projectManagerSessionProjectionToRunStatusModel(input: {
  projection: ManagerSessionProjection | null | undefined;
  isSubmitting: boolean;
  submitError?: string | null;
  language: 'zh' | 'en';
}): CommandCenterRunStatusModel | null {
  const { projection, isSubmitting, submitError, language } = input;
  const activeRun = projection?.activeRun || null;
  const latestRun = projection?.latestRun || null;

  if (activeRun?.status === 'queued') {
    return {
      state: 'queued',
      badgeLabel: getStatusLabel('queued', language),
      title: tr(
        language,
        'command_center.run_model.queued.title',
        '正在等待上一条请求完成',
        'Waiting for the previous step to finish',
      ),
      description: tr(
        language,
        'command_center.run_model.queued.description',
        '当前会话还有一个请求在执行，这次请求会在它结束后自动开始。',
        'Another request in this conversation is still running. This one will start automatically next.',
      ),
      metrics: buildRunMetrics(activeRun, language),
      actionLabel: tr(
        language,
        'command_center.run_model.queued.action',
        '取消待开始请求',
        'Cancel pending request',
      ),
    };
  }

  if (activeRun?.status === 'running') {
    return {
      state: 'running',
      badgeLabel: getStatusLabel('running', language),
      title: tr(
        language,
        'command_center.run_model.running.title',
        '正在处理你的最新请求',
        'Working on your latest request',
      ),
      description: tr(
        language,
        'command_center.run_model.running.description',
        '系统正在处理这次请求，可能会拉取上下文、恢复流程或调用工具。',
        'The manager is processing your request and may gather context, resume a workflow, or call a tool.',
      ),
      metrics: buildRunMetrics(activeRun, language),
      actionLabel: tr(
        language,
        'command_center.run_model.running.action',
        '停止这次请求',
        'Stop request',
      ),
    };
  }

  if (submitError && submitError.trim().length > 0) {
    return {
      state: 'failed',
      badgeLabel: getStatusLabel('failed', language),
      title: tr(
        language,
        'command_center.run_model.submit_failed.title',
        '这次请求未能启动',
        'This request could not be started',
      ),
      description: submitError.trim(),
      metrics: [
        {
          id: 'status',
          label: tr(language, 'command_center.run_model.metrics.status', '状态', 'Status'),
          value: getStatusLabel('failed', language),
        },
      ],
    };
  }

  if (isSubmitting) {
    return {
      state: 'submitting',
      badgeLabel: getStatusLabel('submitting', language),
      title: tr(
        language,
        'command_center.run_model.submitting.title',
        '正在启动这次请求',
        'Starting your request',
      ),
      description: tr(
        language,
        'command_center.run_model.submitting.description',
        '请求已经发出，正在等待进入稳定的执行状态。',
        'The request has been sent. Waiting for execution to enter a stable running state.',
      ),
      metrics: projection?.session
        ? [
            {
              id: 'session',
              label: tr(language, 'command_center.run_model.metrics.session', '会话', 'Session'),
              value: projection.session.title,
            },
            {
              id: 'domain',
              label: tr(language, 'command_center.run_model.metrics.domain', '领域', 'Domain'),
              value: projection.runtimeDomainId,
            },
          ]
        : [],
    };
  }

  // Historical failed/cancelled runs already surface in the conversation feed
  // and summary cards. Keeping a persistent status panel for them makes the
  // home chat feel heavier than necessary.
  if (latestRun?.status === 'failed' || latestRun?.status === 'cancelled') {
    return null;
  }

  return null;
}
