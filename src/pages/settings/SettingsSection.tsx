import React from 'react';

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <section className="space-y-3">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--mf-text-muted)]">
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
