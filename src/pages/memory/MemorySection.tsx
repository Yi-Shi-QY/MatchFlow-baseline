import React from 'react';

interface MemorySectionProps {
  title: string;
  emptyText: string;
  hasItems: boolean;
  children: React.ReactNode;
}

export function MemorySection({
  title,
  emptyText,
  hasItems,
  children,
}: MemorySectionProps) {
  return (
    <section className="space-y-3">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--mf-text-muted)]">
        {title}
      </div>
      {hasItems ? (
        children
      ) : (
        <div className="rounded-[1.5rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/90 p-4 text-sm text-[var(--mf-text-muted)] shadow-sm">
          {emptyText}
        </div>
      )}
    </section>
  );
}
