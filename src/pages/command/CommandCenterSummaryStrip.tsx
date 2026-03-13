import React from 'react';
import { Button } from '@/src/components/ui/Button';
import type { CommandCenterSummaryCard } from './homeLayoutModel';

interface CommandCenterSummaryStripProps {
  language: 'zh' | 'en';
  card: CommandCenterSummaryCard | null;
  onOpenConversation: () => void;
}

export function CommandCenterSummaryStrip({
  language,
  card,
  onOpenConversation,
}: CommandCenterSummaryStripProps) {
  if (!card) {
    return null;
  }

  return (
    <section className="rounded-[1.5rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/92 p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--mf-text-muted)]">
        {language === 'zh' ? '上次摘要' : 'Last summary'}
      </div>
      <div className="mt-2 text-sm font-semibold text-[var(--mf-text)]">{card.title}</div>
      <p className="mt-2 text-sm leading-6 text-[var(--mf-text-muted)]">{card.summary}</p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4 rounded-2xl"
        onClick={onOpenConversation}
      >
        {card.actionLabel}
      </Button>
    </section>
  );
}
