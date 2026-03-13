import React from 'react';
import type { TaskCenterSummaryMetric } from './taskCenterModel';

interface TaskCenterSummaryGridProps {
  metrics: TaskCenterSummaryMetric[];
}

export function TaskCenterSummaryGrid({ metrics }: TaskCenterSummaryGridProps) {
  return (
    <section className="grid grid-cols-2 gap-3">
      {metrics.map((metric) => (
        <article
          key={metric.id}
          className="rounded-[1.5rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/92 p-4 shadow-sm"
        >
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--mf-text-muted)]">
            {metric.label}
          </div>
          <div className="mt-3 text-2xl font-semibold text-[var(--mf-text)]">{metric.value}</div>
        </article>
      ))}
    </section>
  );
}
