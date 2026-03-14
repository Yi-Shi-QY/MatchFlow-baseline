import React from 'react';
import { useNavigate } from 'react-router-dom';
import { translateText } from '@/src/i18n/translate';
import { getActiveAnalysisDomain } from '@/src/services/domains/registry';
import { activateAutomationDraft } from '@/src/services/automation/activation';
import { applyClarificationAnswer, getNextClarificationQuestion } from '@/src/services/automation/clarification';
import {
  deleteAutomationDraft,
  getAutomationDraft,
  listAutomationDrafts,
  saveAutomationDraft,
} from '@/src/services/automation/draftStore';
import { executeAutomationJob } from '@/src/services/automation/executor';
import { getAutomationJob, listAutomationJobs } from '@/src/services/automation/jobStore';
import { listAutomationRules } from '@/src/services/automation/ruleStore';
import { listAutomationRuns } from '@/src/services/automation/runStore';
import { resolveImmediateAnalysisNavigation } from '@/src/services/automation/commandCenter';
import { withWorkspaceBackContext } from '@/src/services/navigation/workspaceBackNavigation';
import {
  ensureExecutionTicketForDraft,
  listExecutionTickets,
  patchExecutionTicket,
} from '@/src/services/manager-workspace/executionTicketStore';
import { deriveTaskCenterModel, type TaskCenterAction } from './taskCenterModel';
import type {
  AutomationDraft,
  AutomationJob,
  AutomationRule,
  AutomationRun,
} from '@/src/services/automation/types';

function tr(
  language: 'zh' | 'en',
  key: string,
  zh: string,
  en: string,
  options: Record<string, unknown> = {},
): string {
  return translateText(language, key, language === 'zh' ? zh : en, options);
}

function buildTaskActivationFeedbackMessage(args: {
  draft: {
    title: string;
    intentType: 'one_time' | 'recurring';
    activationMode: 'save_only' | 'run_now';
  };
  activationKind: 'job' | 'rule';
  language: 'zh' | 'en';
}): string {
  const { draft, activationKind, language } = args;

  if (draft.activationMode === 'run_now' && activationKind === 'job') {
    return tr(
      language,
      'task_center.feedback.formal_job_started',
      '已正式拉起“{{title}}”并开始执行。',
      'Started the formal task "{{title}}".',
      { title: draft.title },
    );
  }

  if (activationKind === 'rule' || draft.intentType === 'recurring') {
    return tr(
      language,
      'task_center.feedback.enabled_recurring',
      '已启用周期规则“{{title}}”。',
      'Enabled recurring rule "{{title}}".',
      { title: draft.title },
    );
  }

  return tr(
    language,
    'task_center.feedback.scheduled_job',
    '已安排定时任务“{{title}}”。',
    'Scheduled "{{title}}".',
    { title: draft.title },
  );
}

export function useAutomationTaskState(language: 'zh' | 'en') {
  const navigate = useNavigate();
  const activeDomain = getActiveAnalysisDomain();
  const [drafts, setDrafts] = React.useState<AutomationDraft[]>([]);
  const [rules, setRules] = React.useState<AutomationRule[]>([]);
  const [jobs, setJobs] = React.useState<AutomationJob[]>([]);
  const [runs, setRuns] = React.useState<AutomationRun[]>([]);
  const [executionTickets, setExecutionTickets] = React.useState<
    Awaited<ReturnType<typeof listExecutionTickets>>
  >([]);
  const [feedbackMessage, setFeedbackMessage] = React.useState('');
  const [runningJobId, setRunningJobId] = React.useState<string | null>(null);
  const taskCenterModel = React.useMemo(
    () =>
      deriveTaskCenterModel({
        drafts,
        rules,
        jobs,
        runs,
        executionTickets,
        language,
      }),
    [drafts, executionTickets, jobs, language, rules, runs],
  );

  const refreshAll = React.useCallback(async () => {
    const [nextDrafts, nextRules, nextJobs, nextRuns] = await Promise.all([
      listAutomationDrafts(),
      listAutomationRules(),
      listAutomationJobs({
        states: ['pending', 'eligible', 'running'],
      }),
      listAutomationRuns({ limit: 8 }),
    ]);
    await Promise.all(
      nextDrafts
        .filter((draft) => draft.status === 'ready')
        .map((draft) =>
          ensureExecutionTicketForDraft({
            draft,
            source: 'task_center',
          }),
        ),
    );
    const nextExecutionTickets = await listExecutionTickets();
    setDrafts(nextDrafts);
    setRules(nextRules);
    setJobs(nextJobs);
    setRuns(nextRuns);
    setExecutionTickets(nextExecutionTickets);
    return { nextDrafts, nextRules, nextJobs, nextRuns, nextExecutionTickets };
  }, []);

  React.useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const hasLiveAutomationState = React.useMemo(
    () =>
      Boolean(runningJobId) ||
      jobs.some(
        (job) =>
          job.state === 'pending' || job.state === 'eligible' || job.state === 'running',
      ) ||
      runs.some((run) => run.state === 'running'),
    [jobs, runningJobId, runs],
  );

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let cancelled = false;
    let isRefreshing = false;
    const intervalMs = hasLiveAutomationState ? 1500 : 5000;

    const poll = async () => {
      if (cancelled || isRefreshing) {
        return;
      }

      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      isRefreshing = true;
      try {
        await refreshAll();
      } catch (error) {
        console.error('Failed to refresh automation task state', error);
      } finally {
        isRefreshing = false;
      }
    };

    const timerId = window.setInterval(() => {
      void poll();
    }, intervalMs);

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void poll();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      cancelled = true;
      window.clearInterval(timerId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [hasLiveAutomationState, refreshAll]);

  const handleClarificationAnswer = React.useCallback(
    async (draftId: string, answer: string) => {
      const normalizedAnswer = answer.trim();
      const draft = await getAutomationDraft(draftId);
      if (!draft || !normalizedAnswer) {
        return;
      }

      const nextDraft = applyClarificationAnswer(draft, normalizedAnswer);
      await saveAutomationDraft(nextDraft);
      const question = getNextClarificationQuestion(nextDraft, language);
      setFeedbackMessage(
        question
          ? tr(language, 'task_center.feedback.draft_updated', '任务草稿已更新。', 'Draft updated.')
          : tr(language, 'task_center.feedback.draft_completed', '草稿已补全。', 'Draft completed.'),
      );
      await refreshAll();
    },
    [language, refreshAll],
  );

  const handleActivateDraft = React.useCallback(
    async (draftId: string) => {
      const draft = await getAutomationDraft(draftId);
      if (!draft) return;
      const ticket = await ensureExecutionTicketForDraft({
        draft,
        source: 'task_center',
      });

      if (false && draft.activationMode === 'run_now') {
        const result = await resolveImmediateAnalysisNavigation(draft, language);
        if (result.status !== 'ready' || !result.navigation) {
          const message =
            result.message ||
            tr(
              language,
              'task_center.feedback.immediate_unsupported',
              '这条指令暂时还不能直接执行立即分析。',
              'This command cannot run as an immediate analysis yet.',
            );
          setFeedbackMessage(message);
          return;
        }

        await patchExecutionTicket({
          ticketId: ticket.id,
          patch: {
            status: 'confirmed',
          },
        });
        await deleteAutomationDraft(draftId);
        navigate(result.navigation.route, {
          state: withWorkspaceBackContext(result.navigation.state, '/tasks'),
        });
        await refreshAll();
        return;
      }

      const activationResult = await activateAutomationDraft(draft);
      await patchExecutionTicket({
        ticketId: ticket.id,
        patch: {
          status: 'confirmed',
          jobId: activationResult.kind === 'job' ? activationResult.job.id : undefined,
        },
      });
      await deleteAutomationDraft(draftId);
      const { kickAutomationRuntime } = await import('@/src/services/automation/runtimeCoordinator');
      kickAutomationRuntime('draft_activated');
      setFeedbackMessage(
        draft.intentType === 'recurring'
          ? tr(
              language,
              'task_center.feedback.enabled_recurring',
              '已启用周期规则“{{title}}”。',
              'Enabled recurring rule "{{title}}".',
              { title: draft.title },
            )
          : tr(
              language,
              'task_center.feedback.scheduled_job',
              '已安排定时任务“{{title}}”。',
              'Scheduled "{{title}}".',
              { title: draft.title },
            ),
      );
      setFeedbackMessage(
        buildTaskActivationFeedbackMessage({
          draft,
          activationKind: activationResult.kind,
          language,
        }),
      );
      await refreshAll();
    },
    [language, navigate, refreshAll],
  );

  const handleDeleteDraft = React.useCallback(
    async (draftId: string) => {
      const draft = await getAutomationDraft(draftId);
      await deleteAutomationDraft(draftId);
      setFeedbackMessage(
        draft?.title
          ? tr(
              language,
              'task_center.feedback.draft_deleted_named',
              '已删除“{{title}}”草稿。',
              'Deleted "{{title}}" draft.',
              { title: draft.title },
            )
          : tr(
              language,
              'task_center.feedback.draft_deleted_unnamed',
              '已删除该草稿。',
              'Deleted that draft.',
            ),
      );
      await refreshAll();
    },
    [language, refreshAll],
  );

  const handleRunJobNow = React.useCallback(
    async (jobId: string) => {
      const job = await getAutomationJob(jobId);
      if (!job) {
        setFeedbackMessage(
          tr(language, 'task_center.feedback.job_not_found', '未找到对应任务。', 'Job not found.'),
        );
        return;
      }

      setRunningJobId(jobId);
      setFeedbackMessage(
        tr(language, 'task_center.feedback.job_started', '任务开始执行。', 'Job started.'),
      );

      try {
        const executionPromise = executeAutomationJob(job, {
          onStateChange: async () => {
            await refreshAll();
          },
        });
        await refreshAll();
        const result = await executionPromise;
        const completionMessage =
          result.status === 'completed'
            ? tr(
                language,
                'task_center.feedback.job_completed',
                '已完成“{{title}}”。',
                'Completed "{{title}}".',
                { title: job.title },
              )
            : result.status === 'cancelled'
              ? tr(
                  language,
                  'task_center.feedback.job_cancelled',
                  '已取消“{{title}}”。',
                  'Cancelled "{{title}}".',
                  { title: job.title },
                )
              : result.run.errorMessage ||
                tr(
                  language,
                  'task_center.feedback.job_failed',
                  '执行“{{title}}”失败。',
                  'Failed to run "{{title}}".',
                  { title: job.title },
                );
        setFeedbackMessage(completionMessage);
      } finally {
        setRunningJobId(null);
        await refreshAll();
      }
    },
    [language, refreshAll],
  );

  const navigateToTaskCenterTarget = React.useCallback(
    (params: Record<string, string>) => {
      const search = new URLSearchParams(params);
      navigate(`/tasks?${search.toString()}`);
    },
    [navigate],
  );

  const handleTaskCenterAction = React.useCallback(
    async (action: TaskCenterAction) => {
      if (action.type === 'activate_draft') {
        await handleActivateDraft(action.draftId);
        return;
      }

      if (action.type === 'delete_draft') {
        await handleDeleteDraft(action.draftId);
        return;
      }

      if (action.type === 'focus_draft') {
        navigateToTaskCenterTarget({ draftId: action.draftId });
        return;
      }

      if (action.type === 'focus_rule') {
        navigateToTaskCenterTarget({ ruleId: action.ruleId });
        return;
      }

      if (action.type === 'focus_job') {
        navigateToTaskCenterTarget({ jobId: action.jobId });
        return;
      }

      navigateToTaskCenterTarget({ runId: action.runId });
    },
    [handleActivateDraft, handleDeleteDraft, navigateToTaskCenterTarget],
  );

  return {
    activeDomainName: activeDomain.name,
    drafts,
    rules,
    jobs,
    runs,
    executionTickets,
    feedbackMessage,
    runningJobId,
    taskCenterModel,
    refreshAll,
    handleClarificationAnswer,
    handleActivateDraft,
    handleDeleteDraft,
    handleRunJobNow,
    handleTaskCenterAction,
  };
}
