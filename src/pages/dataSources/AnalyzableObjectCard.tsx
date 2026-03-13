import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import type { AnalysisObjectCardModel } from './analysisDataWorkspaceModel';

interface AnalyzableObjectCardProps {
  model: AnalysisObjectCardModel;
  onOpen: (route: string, state: Record<string, unknown>) => void;
}

export function AnalyzableObjectCard({
  model,
  onOpen,
}: AnalyzableObjectCardProps) {
  return (
    <article className="rounded-[1.5rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/92 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--mf-text-muted)]">
          {model.league}
        </div>
        <div className="rounded-full border border-[var(--mf-border)] px-2 py-1 text-[10px] text-[var(--mf-text-muted)]">
          {model.statusLabel}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
        <div>
          <div className="text-sm font-semibold text-[var(--mf-text)]">
            {model.subjectDisplay.homeTeam.name}
          </div>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-[var(--mf-text-muted)]">
          VS
        </div>
        <div>
          <div className="text-sm font-semibold text-[var(--mf-text)]">
            {model.subjectDisplay.awayTeam.name}
          </div>
        </div>
      </div>

      <div className="mt-4 text-xs text-[var(--mf-text-muted)]">{model.subtitle}</div>

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
