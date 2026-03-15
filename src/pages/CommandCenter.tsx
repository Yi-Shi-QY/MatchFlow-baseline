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
      contentClassName="min-h-screen gap-4 pt-[4rem] pb-[calc(8.5rem+env(safe-area-inset-bottom))]"
    >
      <div className="flex min-h-full flex-col gap-4">
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
          executionTickets={state.executionTickets}
          onActivateDraft={state.handleActivateDraft}
          onDeleteDraft={state.handleDeleteDraft}
          onClarificationAnswer={state.handleClarificationAnswer}
          onOpenSettings={state.handleOpenSettings}
          onOpenAutomationEventRoute={state.handleOpenAutomationEventRoute}
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
      </div>

      <div className="pointer-events-none fixed inset-x-0 top-0 z-20 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="pointer-events-auto mx-auto max-w-md">
          <CommandCenterStatusBar language={language} layout={state.homeLayout} />
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto mx-auto max-w-md">
          <CommandCenterComposer
            language={language}
            commandText={state.commandText}
            placeholder={state.composerPlaceholder}
            isSubmitting={state.isSubmitting}
            onCommandTextChange={state.setCommandText}
            onSubmit={state.handleParseCommand}
          />
        </div>
      </div>
    </WorkspaceShell>
  );
}
