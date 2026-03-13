import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import type { HistorySavedTopicCardModel } from './historyWorkspaceModel';

interface HistorySavedTopicCardProps {
  model: HistorySavedTopicCardModel;
  onOpen: (route: string, state: Record<string, unknown>) => void;
}

export function HistorySavedTopicCard({
  model,
  onOpen,
}: HistorySavedTopicCardProps) {
  return (
    <article className="rounded-[1.5rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/92 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--mf-text-muted)]">
          {model.tag}
        </div>
        <div className="text-right text-[11px] text-[var(--mf-text-muted)]">
          <div>{model.metaLabel}</div>
          <div className="mt-1 font-mono">{model.timestampLabel}</div>
        </div>
      </div>

      <div className="mt-4 text-sm font-semibold text-[var(--mf-text)]">{model.title}</div>
      <p className="mt-2 text-sm leading-6 text-[var(--mf-text-muted)]">{model.summary}</p>

      <Button
        className="mt-4 w-full justify-center gap-2 rounded-2xl"
        onClick={() => onOpen(model.primaryAction.route, model.primaryAction.state)}
      >
        {model.primaryAction.label}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </article>
  );
}
