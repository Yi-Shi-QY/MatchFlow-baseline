import React from 'react';
import { Button } from '@/src/components/ui/Button';
import type { ConnectionStatusCardModel } from './connectionDataModel';

interface ConnectionStatusCardProps {
  model: ConnectionStatusCardModel;
  onTestAi: () => void;
  onTestData: () => void;
  isTestingAi: boolean;
  isTestingData: boolean;
}

export function ConnectionStatusCard({
  model,
  onTestAi,
  onTestData,
  isTestingAi,
  isTestingData,
}: ConnectionStatusCardProps) {
  return (
    <section className="rounded-[1.6rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/92 p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--mf-text-muted)]">
        {model.title}
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--mf-text-muted)]">{model.description}</p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-[1.2rem] border border-[var(--mf-border)] bg-[var(--mf-surface-strong)] px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--mf-text-muted)]">
            AI
          </div>
          <div className="mt-2 text-sm font-semibold text-[var(--mf-text)]">{model.aiStatusLabel}</div>
        </div>
        <div className="rounded-[1.2rem] border border-[var(--mf-border)] bg-[var(--mf-surface-strong)] px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--mf-text-muted)]">
            Data
          </div>
          <div className="mt-2 text-sm font-semibold text-[var(--mf-text)]">{model.dataStatusLabel}</div>
        </div>
        <div className="rounded-[1.2rem] border border-[var(--mf-border)] bg-[var(--mf-surface-strong)] px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--mf-text-muted)]">
            Last Check
          </div>
          <div className="mt-2 text-sm font-semibold text-[var(--mf-text)]">{model.lastCheckedLabel}</div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button className="rounded-2xl" onClick={onTestAi} disabled={isTestingAi}>
          {isTestingAi ? 'Testing AI...' : 'Test AI'}
        </Button>
        <Button variant="outline" className="rounded-2xl" onClick={onTestData} disabled={isTestingData}>
          {isTestingData ? 'Testing Data...' : 'Test Data'}
        </Button>
      </div>
    </section>
  );
}
