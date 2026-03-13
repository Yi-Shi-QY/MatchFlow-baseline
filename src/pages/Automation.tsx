import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WorkspaceShell } from '@/src/components/layout/WorkspaceShell';
import { AutomationDraftList } from '@/src/pages/automation/AutomationDraftList';
import { AutomationTaskList } from '@/src/pages/automation/AutomationTaskList';
import { AutomationRunList } from '@/src/pages/automation/AutomationRunList';
import { TaskCenterSummaryGrid } from '@/src/pages/automation/TaskCenterSummaryGrid';
import { useAutomationTaskState } from '@/src/pages/automation/useAutomationTaskState';

export default function Automation() {
  const [searchParams] = useSearchParams();
  const { i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const state = useAutomationTaskState(language);
  const selectedDraftId = searchParams.get('draftId');
  const selectedRuleId = searchParams.get('ruleId');
  const selectedJobId = searchParams.get('jobId');
  const selectedRunId = searchParams.get('runId');

  React.useEffect(() => {
    const targetElementId = selectedDraftId
      ? `automation-draft-${selectedDraftId}`
      : selectedRuleId
        ? `automation-rule-${selectedRuleId}`
      : selectedRunId
        ? `automation-run-${selectedRunId}`
        : selectedJobId
          ? `automation-job-${selectedJobId}`
          : null;
    if (!targetElementId || typeof document === 'undefined') {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      document.getElementById(targetElementId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [
    selectedDraftId,
    selectedRuleId,
    selectedJobId,
    selectedRunId,
    state.drafts.length,
    state.jobs.length,
    state.runs.length,
  ]);

  const copy =
    language === 'zh'
      ? {
          title: '任务中心',
          subtitle:
            '查看待我处理、执行中、已安排和最近完成的事项。重型诊断能力已移出主任务面。',
        }
      : {
          title: 'Task Center',
          subtitle:
            'Review waiting items, active work, scheduled tasks, and recent completions. Heavy diagnostics are no longer on the primary surface.',
        };

  return (
    <WorkspaceShell
      language={language}
      section="tasks"
      title={copy.title}
      subtitle={copy.subtitle}
    >
      <TaskCenterSummaryGrid metrics={state.taskCenterModel.summaryMetrics} />

      <AutomationDraftList
        language={language}
        items={state.taskCenterModel.waitingItems}
        selectedDraftId={selectedDraftId}
        onPrimaryAction={state.handleTaskCenterAction}
      />

      <AutomationTaskList
        items={state.taskCenterModel.runningItems}
        title={language === 'zh' ? '执行中' : 'Running'}
        emptyText={language === 'zh' ? '当前没有执行中的任务。' : 'No tasks are currently running.'}
        selectedRunId={selectedRunId}
        onPrimaryAction={state.handleTaskCenterAction}
      />

      <AutomationTaskList
        items={state.taskCenterModel.scheduledItems}
        title={language === 'zh' ? '已安排' : 'Scheduled'}
        emptyText={language === 'zh' ? '当前没有已安排的任务或规则。' : 'No jobs or rules are scheduled yet.'}
        selectedRuleId={selectedRuleId}
        selectedJobId={selectedJobId}
        onPrimaryAction={state.handleTaskCenterAction}
      />

      <AutomationRunList
        items={state.taskCenterModel.completedItems}
        title={language === 'zh' ? '最近完成' : 'Recent completions'}
        emptyText={language === 'zh' ? '最近还没有已完成任务。' : 'No recent completed tasks yet.'}
        selectedRunId={selectedRunId}
        onPrimaryAction={state.handleTaskCenterAction}
      />
    </WorkspaceShell>
  );
}
