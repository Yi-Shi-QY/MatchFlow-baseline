import React from 'react';
import { Bot, User } from 'lucide-react';
import type { AutomationDraft } from '@/src/services/automation';
import type { ExecutionTicket } from '@/src/services/manager-workspace/executionTicketTypes';
import { AutomationDraftCard } from '@/src/pages/automation/AutomationDraftCard';
import { Button } from '@/src/components/ui/Button';
import { translateText } from '@/src/i18n/translate';
import type { CommandCenterFeedItem } from './feedAdapter';
import { ExecutionEventCard } from './ExecutionEventCard';

interface CommandCenterConversationProps {
  language: 'zh' | 'en';
  items: CommandCenterFeedItem[];
  drafts: AutomationDraft[];
  executionTickets: ExecutionTicket[];
  onActivateDraft: (draftId: string) => void;
  onDeleteDraft: (draftId: string) => void;
  onClarificationAnswer: (draftId: string, answer: string) => void;
  onOpenSettings: () => void;
  onOpenAutomationEventRoute: (route: string) => void;
  className?: string;
}

function tr(language: 'zh' | 'en', key: string, zh: string, en: string) {
  return translateText(language, key, language === 'zh' ? zh : en);
}

export function CommandCenterConversation({
  language,
  items,
  drafts,
  executionTickets,
  onActivateDraft,
  onDeleteDraft,
  onClarificationAnswer,
  onOpenSettings,
  onOpenAutomationEventRoute,
  className = '',
}: CommandCenterConversationProps) {
  const emptyBundleCopy = tr(
    language,
    'command_center.conversation.draft_bundle_empty',
    '\u8fd9\u4e9b\u5361\u7247\u5df2\u7ecf\u5904\u7406\u5b8c\u6210\u3002',
    'Those cards have already been handled.',
  );

  return (
    <section
      id="command-center-conversation"
      className={`flex flex-col gap-3 ${className}`.trim()}
    >
      {items.map((item) => {
        const relatedDrafts =
          item.draftIds?.length
            ? item.draftIds
                .map((draftId) => drafts.find((draft) => draft.id === draftId))
                .filter((draft): draft is AutomationDraft => Boolean(draft))
            : [];
        const relatedTickets = item.draftIds?.length
          ? new Map(
              executionTickets
                .filter((ticket) => ticket.draftId && item.draftIds?.includes(ticket.draftId))
                .map((ticket) => [ticket.draftId as string, ticket]),
            )
          : new Map<string, ExecutionTicket>();
        const isUser = item.role === 'user';
        const isSystem = item.role === 'system';
        const bubbleText = item.text || '';
        const hasExecutionEvent = Boolean(item.automationEvent || item.navigationIntent);

        return (
          <div key={item.id} id={`command-feed-item-${item.id}`} className="space-y-3">
            <div
              className={`flex gap-3 ${
                isSystem ? 'justify-center' : isUser ? 'justify-end' : 'justify-start'
              }`}
            >
              {!isUser && !isSystem ? (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[var(--mf-border)] bg-[var(--mf-surface)]/95 text-[var(--mf-accent)] shadow-sm">
                  <Bot className="h-4 w-4" />
                </div>
              ) : null}

              {hasExecutionEvent ? (
                <ExecutionEventCard
                  language={language}
                  item={item}
                  onOpenRoute={onOpenAutomationEventRoute}
                />
              ) : bubbleText ? (
                <div
                  className={`whitespace-pre-wrap border shadow-sm ${
                    isSystem
                      ? 'max-w-[90%] rounded-full border-[var(--mf-border)] bg-[var(--mf-surface)]/75 px-3 py-1.5 text-xs text-[var(--mf-text-muted)]'
                      : `max-w-[85%] rounded-[1.5rem] px-4 py-3 text-sm leading-relaxed ${
                          isUser
                            ? 'border-[var(--mf-accent)] bg-[var(--mf-accent-soft)] text-[var(--mf-text)]'
                            : 'border-[var(--mf-border)] bg-[var(--mf-surface)]/92 text-[var(--mf-text)]'
                        }`
                  }`}
                >
                  {bubbleText}
                </div>
              ) : null}

              {isUser ? (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[var(--mf-border)] bg-[var(--mf-surface)]/95 text-[var(--mf-text-muted)] shadow-sm">
                  <User className="h-4 w-4" />
                </div>
              ) : null}
            </div>

            {item.action?.type === 'open_settings' ? (
              <div className="pl-12">
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={onOpenSettings}
                >
                  {item.action.label}
                </Button>
              </div>
            ) : null}

            {item.blockType === 'draft_bundle' ? (
              relatedDrafts.length > 0 ? (
                <div className="space-y-3 pl-12">
                  {relatedDrafts.map((draft) => (
                    <AutomationDraftCard
                      key={draft.id}
                      draft={draft}
                      executionTicket={relatedTickets.get(draft.id) || null}
                      language={language}
                      className="shadow-sm"
                      onActivateDraft={onActivateDraft}
                      onDeleteDraft={onDeleteDraft}
                      onClarificationAnswer={onClarificationAnswer}
                    />
                  ))}
                </div>
              ) : (
                <div className="pl-12 text-xs text-[var(--mf-text-muted)]">{emptyBundleCopy}</div>
              )
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
