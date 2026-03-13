import React from 'react';
import { useTranslation } from 'react-i18next';
import { WorkspaceShell } from '@/src/components/layout/WorkspaceShell';
import { CommandCenterContinueStrip } from '@/src/pages/command/CommandCenterContinueStrip';
import { CommandCenterComposer } from '@/src/pages/command/CommandCenterComposer';
import { CommandCenterConversation } from '@/src/pages/command/CommandCenterConversation';
import { CommandCenterRunStatus } from '@/src/pages/command/CommandCenterRunStatus';
import { CommandCenterStatusBar } from '@/src/pages/command/CommandCenterStatusBar';
import { CommandCenterSuggestionBar } from '@/src/pages/command/CommandCenterSuggestionBar';
import { CommandCenterSummaryStrip } from '@/src/pages/command/CommandCenterSummaryStrip';
import { useCommandCenterState } from '@/src/pages/command/useCommandCenterState';

export default function CommandCenter() {
  const { t, i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const state = useCommandCenterState(language);

  return (
    <WorkspaceShell
      language={language}
      section="chat"
      title={t('home.command_center.title')}
      subtitle={t('home.command_center.subtitle')}
      hideHeader
      contentClassName="min-h-screen gap-4"
    >
      <CommandCenterStatusBar language={language} layout={state.homeLayout} />

      {state.homeLayout.mode === 'continue_first' ? (
        <CommandCenterContinueStrip
          language={language}
          cards={state.homeLayout.continueCards}
          onAction={state.handleContinueAction}
        />
      ) : (
        <CommandCenterSummaryStrip
          language={language}
          card={state.homeLayout.lastSummaryCard}
          onOpenConversation={state.handleOpenConversation}
        />
      )}

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

      <CommandCenterSuggestionBar
        language={language}
        chips={state.homeLayout.suggestionChips}
        onSelect={state.handleSuggestionSelect}
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
