import React from 'react';
import { CircleAlert } from 'lucide-react';
import { Card, CardContent } from '@/src/components/ui/Card';
import type { AutomationDraft } from '@/src/services/automation';
import { AutomationDraftCard } from './AutomationDraftCard';

interface AutomationDraftListProps {
  drafts: AutomationDraft[];
  language: 'zh' | 'en';
  selectedDraftId?: string | null;
  onActivateDraft: (draftId: string) => void;
  onDeleteDraft: (draftId: string) => void;
  onClarificationAnswer: (draftId: string, answer: string) => void;
}

export function AutomationDraftList({
  drafts,
  language,
  selectedDraftId = null,
  onActivateDraft,
  onDeleteDraft,
  onClarificationAnswer,
}: AutomationDraftListProps) {
  const copy =
    language === 'zh'
      ? {
          title: '待确认草稿',
          empty: '还没有任务草稿。先从对话里下达自然语言指令。',
        }
      : {
          title: 'Drafts',
          empty: 'No command drafts yet. Start with a natural-language command in chat.',
        };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <CircleAlert className="h-4 w-4 text-[var(--mf-accent)]" />
        <h3 className="text-sm font-semibold text-[var(--mf-text)]">{copy.title}</h3>
      </div>

      {drafts.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-sm text-[var(--mf-text-muted)]">
            {copy.empty}
          </CardContent>
        </Card>
      ) : (
        drafts.map((draft) => (
          <AutomationDraftCard
            key={draft.id}
            draft={draft}
            language={language}
            isSelected={selectedDraftId === draft.id}
            onActivateDraft={onActivateDraft}
            onDeleteDraft={onDeleteDraft}
            onClarificationAnswer={onClarificationAnswer}
          />
        ))
      )}
    </section>
  );
}
