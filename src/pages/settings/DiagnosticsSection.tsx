import React from 'react';

interface DiagnosticsSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export function DiagnosticsSection({
  title,
  description,
  children,
}: DiagnosticsSectionProps) {
  return (
    <section className="space-y-3">
      <div>
        <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--mf-text-muted)]">
          {title}
        </div>
        <div className="mt-1 text-sm leading-6 text-[var(--mf-text-muted)]">{description}</div>
      </div>
      {children}
    </section>
  );
}
