import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WorkspaceShell } from '@/src/components/layout/WorkspaceShell';
import { AutomationDiagnosticsCard } from '@/src/pages/automation/AutomationDiagnosticsCard';
import { AutomationDraftList } from '@/src/pages/automation/AutomationDraftList';
import { AutomationTaskList } from '@/src/pages/automation/AutomationTaskList';
import { AutomationRunList } from '@/src/pages/automation/AutomationRunList';
import { useAutomationTaskState } from '@/src/pages/automation/useAutomationTaskState';

export default function Automation() {
  const [searchParams] = useSearchParams();
  const { i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const state = useAutomationTaskState(language);
  const selectedDraftId = searchParams.get('draftId');
  const selectedJobId = searchParams.get('jobId');
  const selectedRunId = searchParams.get('runId');

  React.useEffect(() => {
    const targetElementId = selectedDraftId
      ? `automation-draft-${selectedDraftId}`
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
            '这里专门查看草稿、启用中的规则、待执行任务和最近运行记录。对话入口已经独立到总管 Agent 页面。',
        }
      : {
          title: 'Task Center',
          subtitle:
            'Review drafts, enabled rules, queued jobs, and recent runs here. The conversational entry now lives on the manager agent page.',
        };

  return (
    <WorkspaceShell
      language={language}
      section="tasks"
      title={copy.title}
      subtitle={copy.subtitle}
    >
      <AutomationDiagnosticsCard language={language} />

      <AutomationDraftList
        drafts={state.drafts}
        language={language}
        selectedDraftId={selectedDraftId}
        onActivateDraft={state.handleActivateDraft}
        onDeleteDraft={state.handleDeleteDraft}
        onClarificationAnswer={state.handleClarificationAnswer}
      />

      <AutomationTaskList
        language={language}
        rules={state.rules}
        jobs={state.jobs}
        selectedJobId={selectedJobId}
        runningJobId={state.runningJobId}
        onRunJobNow={state.handleRunJobNow}
      />

      <AutomationRunList
        language={language}
        runs={state.runs}
        selectedRunId={selectedRunId}
      />
    </WorkspaceShell>
  );
}
