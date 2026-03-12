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
  if (language === 'zh') {
    switch (status) {
      case 'submitting':
        return '提交中';
      case 'queued':
        return '排队中';
      case 'running':
        return '运行中';
      case 'failed':
        return '失败';
      case 'cancelled':
        return '已取消';
    }
  }

  switch (status) {
    case 'submitting':
      return 'Submitting';
    case 'queued':
      return 'Queued';
    case 'running':
      return 'Running';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
  }
}

function getTriggerLabel(
  triggerType: ManagerRunRecord['triggerType'] | undefined,
  language: 'zh' | 'en',
): string {
  if (language === 'zh') {
    switch (triggerType) {
      case 'resume':
        return '恢复';
      case 'system':
        return '系统';
      case 'compaction':
        return '压缩';
      default:
        return '用户';
    }
  }

  switch (triggerType) {
    case 'resume':
      return 'Resume';
    case 'system':
      return 'System';
    case 'compaction':
      return 'Compaction';
    default:
      return 'User';
  }
}

function getPlannerLabel(
  plannerMode: ManagerRunRecord['plannerMode'] | undefined,
  language: 'zh' | 'en',
): string {
  if (!plannerMode) {
    return '-';
  }

  if (language === 'zh') {
    switch (plannerMode) {
      case 'workflow':
        return '工作流';
      case 'llm_assisted':
        return 'LLM';
      default:
        return '确定性';
    }
  }

  switch (plannerMode) {
    case 'workflow':
      return 'Workflow';
    case 'llm_assisted':
      return 'LLM';
    default:
      return 'Deterministic';
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
      label: language === 'zh' ? 'Run ID' : 'Run ID',
      value: shortenId(run.id),
    },
    {
      id: 'status',
      label: language === 'zh' ? '状态' : 'Status',
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
      label: language === 'zh' ? '触发' : 'Trigger',
      value: getTriggerLabel(run.triggerType, language),
    },
    {
      id: 'planner',
      label: language === 'zh' ? '路径' : 'Planner',
      value: getPlannerLabel(run.plannerMode, language),
    },
    {
      id: 'tool',
      label: language === 'zh' ? '工具' : 'Tool',
      value: run.toolPath || '-',
    },
    {
      id: 'intent',
      label: language === 'zh' ? '意图' : 'Intent',
      value: run.intentType || '-',
    },
    {
      id: 'started',
      label: language === 'zh' ? '开始' : 'Started',
      value: formatTimestamp(run.startedAt || run.createdAt, language),
    },
    {
      id: 'updated',
      label: language === 'zh' ? '更新' : 'Updated',
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
      title: language === 'zh' ? '当前会话已有任务排队' : 'This session already has queued work',
      description:
        language === 'zh'
          ? '另一个 run 仍在占用该会话。当前输入会在前一个 run 结束后自动开始。'
          : 'Another run is still occupying this session. The pending turn will start automatically when it finishes.',
      metrics: buildRunMetrics(activeRun, language),
      actionLabel: language === 'zh' ? '取消排队' : 'Cancel queued turn',
    };
  }

  if (activeRun?.status === 'running') {
    return {
      state: 'running',
      badgeLabel: getStatusLabel('running', language),
      title: language === 'zh' ? 'Manager 正在处理当前回合' : 'Manager is processing this turn',
      description:
        language === 'zh'
          ? '当前 run 已进入执行阶段，正在组装上下文、恢复工作流或执行工具。'
          : 'The active run is executing. The manager may be assembling context, resuming a workflow, or running a tool.',
      metrics: buildRunMetrics(activeRun, language),
      actionLabel: language === 'zh' ? '停止运行' : 'Stop run',
    };
  }

  if (latestRun?.status === 'failed') {
    return {
      state: 'failed',
      badgeLabel: getStatusLabel('failed', language),
      title:
        language === 'zh'
          ? '最近一次 run 执行失败'
          : 'The most recent run failed',
      description:
        latestRun.errorMessage ||
        latestRun.errorCode ||
        (language === 'zh' ? '未返回更多错误信息。' : 'No additional error details were returned.'),
      metrics: buildRunMetrics(latestRun, language),
    };
  }

  if (latestRun?.status === 'cancelled') {
    const wasInterrupted = latestRun.errorCode === 'aborted_by_user';

    return {
      state: 'cancelled',
      badgeLabel: getStatusLabel('cancelled', language),
      title:
        language === 'zh'
          ? '最近一次排队 run 已取消'
          : wasInterrupted
            ? 'The most recent run was interrupted'
            : 'The most recent queued run was cancelled',
      description:
        latestRun.errorMessage ||
        (language === 'zh'
          ? '该 run 在真正开始执行之前被取消。'
          : wasInterrupted
            ? 'This run was interrupted during execution.'
            : 'This run was cancelled before execution started.'),
      metrics: buildRunMetrics(latestRun, language),
    };
  }

  if (submitError && submitError.trim().length > 0) {
    return {
      state: 'failed',
      badgeLabel: getStatusLabel('failed', language),
      title: language === 'zh' ? '本次提交失败' : 'This turn failed',
      description: submitError.trim(),
      metrics: [
        {
          id: 'status',
          label: language === 'zh' ? '状态' : 'Status',
          value: getStatusLabel('failed', language),
        },
      ],
    };
  }

  if (isSubmitting) {
    return {
      state: 'submitting',
      badgeLabel: getStatusLabel('submitting', language),
      title: language === 'zh' ? '正在发起本次提交' : 'Submitting this turn',
      description:
        language === 'zh'
          ? '页面已发出请求，正在等待 run 生命周期进入稳定状态。'
          : 'The page has sent the request and is waiting for the run lifecycle to settle.',
      metrics: projection?.session
        ? [
            {
              id: 'session',
              label: language === 'zh' ? '会话' : 'Session',
              value: projection.session.title,
            },
            {
              id: 'domain',
              label: language === 'zh' ? '领域' : 'Domain',
              value: projection.runtimeDomainId,
            },
          ]
        : [],
    };
  }

  return null;
}
