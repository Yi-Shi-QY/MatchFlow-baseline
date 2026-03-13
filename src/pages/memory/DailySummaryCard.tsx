import React from 'react';
import { Button } from '@/src/components/ui/Button';
import type { WorkspaceDailySummaryCardModel } from './memoryWorkspaceModel';

interface DailySummaryCardProps {
  card: WorkspaceDailySummaryCardModel;
  onOpen: (summaryId: string) => void;
}

export function DailySummaryCard({ card, onOpen }: DailySummaryCardProps) {
  return (
    <article className="rounded-[1.5rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/92 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold text-[var(--mf-text)]">{card.title}</div>
        <div className="rounded-full border border-[var(--mf-border)] px-2 py-1 text-[10px] text-[var(--mf-text-muted)]">
          {card.statusLabel}
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-[var(--mf-text-muted)]">{card.summary}</p>

      <Button className="mt-4 rounded-2xl" onClick={() => onOpen(card.summaryId)}>
        {card.ctaLabel}
      </Button>
    </article>
  );
}
