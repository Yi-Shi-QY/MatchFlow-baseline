import React from 'react';
import type { HistorySummaryCardModel } from './historyWorkspaceModel';

interface HistorySummaryCardProps {
  model: HistorySummaryCardModel;
}

export function HistorySummaryCard({ model }: HistorySummaryCardProps) {
  return (
    <section className="rounded-[1.6rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/92 p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--mf-text-muted)]">
        {model.title}
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--mf-text-muted)]">{model.description}</p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {model.metrics.map((metric) => (
          <div
            key={metric.id}
            className="rounded-[1.2rem] border border-[var(--mf-border)] bg-[var(--mf-surface-strong)] px-3 py-3"
          >
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--mf-text-muted)]">
              {metric.label}
            </div>
            <div className="mt-2 text-xl font-semibold text-[var(--mf-text)]">{metric.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
