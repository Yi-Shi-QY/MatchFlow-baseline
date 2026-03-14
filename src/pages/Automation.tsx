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
  const { t, i18n } = useTranslation();
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

  return (
    <WorkspaceShell
      language={language}
      section="tasks"
      title={t('workspace.tasks.title')}
      subtitle={t('workspace.tasks.subtitle')}
    >
      <TaskCenterSummaryGrid metrics={state.taskCenterModel.summaryMetrics} />

      <AutomationDraftList
        language={language}
        items={state.taskCenterModel.waitingItems}
        selectedDraftId={selectedDraftId}
        onAction={state.handleTaskCenterAction}
      />

      <AutomationTaskList
        items={state.taskCenterModel.runningItems}
        title={t('workspace.tasks.running_title')}
        emptyText={t('workspace.tasks.running_empty')}
        selectedRunId={selectedRunId}
        onAction={state.handleTaskCenterAction}
      />

      <AutomationTaskList
        items={state.taskCenterModel.scheduledItems}
        title={t('workspace.tasks.scheduled_title')}
        emptyText={t('workspace.tasks.scheduled_empty')}
        selectedRuleId={selectedRuleId}
        selectedJobId={selectedJobId}
        onAction={state.handleTaskCenterAction}
      />

      <AutomationRunList
        items={state.taskCenterModel.completedItems}
        title={t('workspace.tasks.completed_title')}
        emptyText={t('workspace.tasks.completed_empty')}
        selectedRunId={selectedRunId}
        onAction={state.handleTaskCenterAction}
      />
    </WorkspaceShell>
  );
}
