import React from 'react';
import { Bot, User } from 'lucide-react';
import type { AutomationDraft } from '@/src/services/automation';
import { AutomationDraftCard } from '@/src/pages/automation/AutomationDraftCard';
import { Button } from '@/src/components/ui/Button';
import type { CommandCenterFeedItem } from './feedAdapter';

interface CommandCenterConversationProps {
  language: 'zh' | 'en';
  items: CommandCenterFeedItem[];
  drafts: AutomationDraft[];
  onActivateDraft: (draftId: string) => void;
  onDeleteDraft: (draftId: string) => void;
  onClarificationAnswer: (draftId: string, answer: string) => void;
  onOpenSettings: () => void;
}

export function CommandCenterConversation({
  language,
  items,
  drafts,
  onActivateDraft,
  onDeleteDraft,
  onClarificationAnswer,
  onOpenSettings,
}: CommandCenterConversationProps) {
  const emptyBundleCopy =
    language === 'zh'
      ? '这批卡片已经处理完了。'
      : 'Those cards have already been handled.';

  return (
    <section className="flex flex-col gap-3 pt-[calc(3.8rem+env(safe-area-inset-top))]">
      {items.map((item) => {
        const relatedDrafts =
          item.draftIds?.length
            ? item.draftIds
                .map((draftId) => drafts.find((draft) => draft.id === draftId))
                .filter((draft): draft is AutomationDraft => Boolean(draft))
            : [];
        const isUser = item.role === 'user';
        const isSystem = item.role === 'system';
        const bubbleText = item.text || '';

        return (
          <div key={item.id} className="space-y-3">
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

              {bubbleText ? (
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
