import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/src/components/ui/Button';
import type { DataAvailabilityCardModel } from './analysisDataWorkspaceModel';

interface DataAvailabilityCardProps {
  model: DataAvailabilityCardModel;
}

export function DataAvailabilityCard({ model }: DataAvailabilityCardProps) {
  const navigate = useNavigate();

  return (
    <section className="rounded-[1.5rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/92 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--mf-text-muted)]">
          {model.title}
        </div>
        <div className="rounded-full border border-[var(--mf-border)] px-2 py-1 text-[10px] text-[var(--mf-text-muted)]">
          {model.statusLabel}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--mf-text-muted)]">{model.description}</p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4 rounded-2xl"
        onClick={() => navigate(model.primaryAction.route)}
      >
        {model.primaryAction.label}
      </Button>
    </section>
  );
}
