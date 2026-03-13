import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { RecentUpdateItemModel } from './analysisDataWorkspaceModel';

interface RecentSyncCardProps {
  items: RecentUpdateItemModel[];
  emptyText: string;
}

export function RecentSyncCard({ items, emptyText }: RecentSyncCardProps) {
  const navigate = useNavigate();

  return (
    <section className="rounded-[1.5rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/92 p-4 shadow-sm">
      {items.length === 0 ? (
        <div className="text-sm text-[var(--mf-text-muted)]">{emptyText}</div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const content = (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-[var(--mf-text)]">{item.title}</div>
                  <div className="mt-1 text-xs text-[var(--mf-text-muted)]">{item.context}</div>
                </div>
                <div className="text-[11px] text-[var(--mf-text-muted)]">{item.timestampLabel}</div>
              </div>
            );

            return item.route ? (
              <button
                key={item.id}
                type="button"
                className="w-full rounded-[1.2rem] border border-[var(--mf-border)] bg-[var(--mf-surface-strong)] px-3 py-3 text-left"
                onClick={() => navigate(item.route!)}
              >
                {content}
              </button>
            ) : (
              <div
                key={item.id}
                className="rounded-[1.2rem] border border-[var(--mf-border)] bg-[var(--mf-surface-strong)] px-3 py-3"
              >
                {content}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
