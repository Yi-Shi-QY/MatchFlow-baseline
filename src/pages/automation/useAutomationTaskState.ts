import React from 'react';
import { useNavigate } from 'react-router-dom';
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
import type {
  AutomationDraft,
  AutomationJob,
  AutomationRule,
  AutomationRun,
} from '@/src/services/automation/types';

export function useAutomationTaskState(language: 'zh' | 'en') {
  const navigate = useNavigate();
  const activeDomain = getActiveAnalysisDomain();
  const [drafts, setDrafts] = React.useState<AutomationDraft[]>([]);
  const [rules, setRules] = React.useState<AutomationRule[]>([]);
  const [jobs, setJobs] = React.useState<AutomationJob[]>([]);
  const [runs, setRuns] = React.useState<AutomationRun[]>([]);
  const [feedbackMessage, setFeedbackMessage] = React.useState('');
  const [runningJobId, setRunningJobId] = React.useState<string | null>(null);

  const refreshAll = React.useCallback(async () => {
    const [nextDrafts, nextRules, nextJobs, nextRuns] = await Promise.all([
      listAutomationDrafts(),
      listAutomationRules(),
      listAutomationJobs({
        states: ['pending', 'eligible', 'running'],
      }),
      listAutomationRuns({ limit: 8 }),
    ]);
    setDrafts(nextDrafts);
    setRules(nextRules);
    setJobs(nextJobs);
    setRuns(nextRuns);
    return { nextDrafts, nextRules, nextJobs, nextRuns };
  }, []);

  React.useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const handleClarificationAnswer = React.useCallback(
    async (draftId: string, answer: string) => {
      const normalizedAnswer = answer.trim();
      const draft = await getAutomationDraft(draftId);
      if (!draft || !normalizedAnswer) {
        return;
      }

      const nextDraft = applyClarificationAnswer(draft, normalizedAnswer);
      await saveAutomationDraft(nextDraft);
      const question = getNextClarificationQuestion(draft, language);
      setFeedbackMessage(
        question
          ? language === 'zh'
            ? '任务草稿已更新。'
            : 'Draft updated.'
          : language === 'zh'
            ? '草稿已补全。'
            : 'Draft completed.',
      );
      await refreshAll();
    },
    [language, refreshAll],
  );

  const handleActivateDraft = React.useCallback(
    async (draftId: string) => {
      const draft = await getAutomationDraft(draftId);
      if (!draft) return;

      if (draft.activationMode === 'run_now') {
        const result = await resolveImmediateAnalysisNavigation(draft, language);
        if (result.status !== 'ready' || !result.navigation) {
          const message =
            result.message ||
            (language === 'zh'
              ? '这条指令暂时还不能直接执行立即分析。'
              : 'This command cannot run as an immediate analysis yet.');
          setFeedbackMessage(message);
          return;
        }

        await deleteAutomationDraft(draftId);
        navigate(result.navigation.route, {
          state: result.navigation.state,
        });
        await refreshAll();
        return;
      }

      await activateAutomationDraft(draft);
      await deleteAutomationDraft(draftId);
      const { kickAutomationRuntime } = await import('@/src/services/automation/runtimeCoordinator');
      kickAutomationRuntime('draft_activated');
      setFeedbackMessage(
        language === 'zh'
          ? draft.intentType === 'recurring'
            ? `已启用周期规则“${draft.title}”。`
            : `已安排定时任务“${draft.title}”。`
          : draft.intentType === 'recurring'
            ? `Enabled recurring rule "${draft.title}".`
            : `Scheduled "${draft.title}".`,
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
        language === 'zh'
          ? `已删除${draft?.title ? `“${draft.title}”` : '该'}草稿。`
          : `Deleted ${draft?.title ? `"${draft.title}"` : 'that'} draft.`,
      );
      await refreshAll();
    },
    [language, refreshAll],
  );

  const handleRunJobNow = React.useCallback(
    async (jobId: string) => {
      const job = await getAutomationJob(jobId);
      if (!job) {
        setFeedbackMessage(language === 'zh' ? '未找到对应任务。' : 'Job not found.');
        return;
      }

      setRunningJobId(jobId);
      setFeedbackMessage(language === 'zh' ? '任务开始执行。' : 'Job started.');

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
            ? language === 'zh'
              ? `已完成“${job.title}”。`
              : `Completed "${job.title}".`
            : result.status === 'cancelled'
              ? language === 'zh'
                ? `已取消“${job.title}”。`
                : `Cancelled "${job.title}".`
              : language === 'zh'
                ? result.run.errorMessage || `执行“${job.title}”失败。`
                : result.run.errorMessage || `Failed to run "${job.title}".`;
        setFeedbackMessage(completionMessage);
      } finally {
        setRunningJobId(null);
        await refreshAll();
      }
    },
    [language, refreshAll],
  );

  return {
    activeDomainName: activeDomain.name,
    drafts,
    rules,
    jobs,
    runs,
    feedbackMessage,
    runningJobId,
    refreshAll,
    handleClarificationAnswer,
    handleActivateDraft,
    handleDeleteDraft,
    handleRunJobNow,
  };
}
