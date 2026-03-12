import React from 'react';
import { useTranslation } from 'react-i18next';
import { WorkspaceShell } from '@/src/components/layout/WorkspaceShell';
import { CommandCenterComposer } from '@/src/pages/command/CommandCenterComposer';
import { CommandCenterConversation } from '@/src/pages/command/CommandCenterConversation';
import { CommandCenterDebugPanel } from '@/src/pages/command/CommandCenterDebugPanel';
import { CommandCenterRunStatus } from '@/src/pages/command/CommandCenterRunStatus';
import { useCommandCenterState } from '@/src/pages/command/useCommandCenterState';

export default function CommandCenter() {
  const { i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const state = useCommandCenterState(language);
  const copy =
    language === 'zh'
      ? {
          title: '总管 Agent',
          subtitle: '对话即入口，任务安排和待编辑卡片都回到消息流里。',
        }
      : {
          title: 'Manager Agent',
          subtitle: 'Chat is the primary entry. Task arrangement and editable cards stay inside the message flow.',
        };

  return (
    <WorkspaceShell
      language={language}
      section="chat"
      title={copy.title}
      subtitle={copy.subtitle}
      hideHeader
      contentClassName="min-h-screen"
    >
      <CommandCenterConversation
        language={language}
        items={state.feedItems}
        drafts={state.drafts}
        onActivateDraft={state.handleActivateDraft}
        onDeleteDraft={state.handleDeleteDraft}
        onClarificationAnswer={state.handleClarificationAnswer}
        onOpenSettings={state.handleOpenSettings}
      />

      <CommandCenterRunStatus
        language={language}
        projection={state.projection}
        isSubmitting={state.isSubmitting}
        isCancellingRun={state.isCancellingRun}
        submitError={state.submitError}
        onCancelRun={state.handleCancelRun}
      />

      <CommandCenterDebugPanel
        language={language}
        projection={state.projection}
      />

      <CommandCenterComposer
        language={language}
        commandText={state.commandText}
        isSubmitting={state.isSubmitting}
        onCommandTextChange={state.setCommandText}
        onSubmit={state.handleParseCommand}
      />
    </WorkspaceShell>
  );
}
