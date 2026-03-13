import React from 'react';
import { Button } from '@/src/components/ui/Button';
import type { WorkspaceMemoryCardModel } from './memoryWorkspaceModel';

interface MemoryCardProps {
  card: WorkspaceMemoryCardModel;
  onAction: (memoryId: string, action: string) => void;
}

export function MemoryCard({ card, onAction }: MemoryCardProps) {
  return (
    <article className="rounded-[1.5rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/92 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--mf-text-muted)]">
          {card.scopeLabel}
        </div>
        <div className="rounded-full border border-[var(--mf-border)] px-2 py-1 text-[10px] text-[var(--mf-text-muted)]">
          {card.statusLabel}
        </div>
      </div>

      <div className="mt-4 text-sm font-semibold text-[var(--mf-text)]">{card.title}</div>
      <p className="mt-2 text-sm leading-6 text-[var(--mf-text-muted)]">{card.summary}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {card.actions.map((action) => (
          <Button
            key={action}
            variant={action === card.actions[0] ? 'default' : 'outline'}
            size="sm"
            className="rounded-2xl"
            onClick={() => onAction(card.memoryId, action)}
          >
            {action}
          </Button>
        ))}
      </div>
    </article>
  );
}
