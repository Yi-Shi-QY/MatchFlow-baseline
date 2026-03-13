import React from 'react';
import { Button } from '@/src/components/ui/Button';
import type { SettingsOverviewCardModel } from './settingsHomeModel';

interface SettingsOverviewCardProps {
  model: SettingsOverviewCardModel;
  onNavigate: (route: string) => void;
}

export function SettingsOverviewCard({
  model,
  onNavigate,
}: SettingsOverviewCardProps) {
  return (
    <section className="rounded-[1.6rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/92 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--mf-text-muted)]">
            {model.title}
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--mf-text-muted)]">{model.description}</p>
        </div>
        <div className="rounded-full border border-[var(--mf-border)] px-3 py-1 text-[11px] text-[var(--mf-text-muted)]">
          {model.systemStatusLabel}
        </div>
      </div>
      <div className="mt-3 text-sm text-[var(--mf-text-muted)]">{model.issueCountLabel}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        {model.statusTags.map((tag) => (
          <Button
            key={tag.id}
            variant={tag.tone === 'warning' ? 'outline' : 'secondary'}
            size="sm"
            className="rounded-2xl"
            onClick={() => onNavigate(tag.route)}
          >
            {tag.label}
          </Button>
        ))}
      </div>
    </section>
  );
}
