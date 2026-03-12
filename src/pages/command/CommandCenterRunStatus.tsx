import React from 'react';
import {
  AlertTriangle,
  Clock3,
  LoaderCircle,
  PlayCircle,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Card, CardContent } from '@/src/components/ui/Card';
import type { ManagerSessionProjection } from '@/src/services/manager-gateway/types';
import { projectManagerSessionProjectionToRunStatusModel } from './runStatusModel';

interface CommandCenterRunStatusProps {
  language: 'zh' | 'en';
  projection: ManagerSessionProjection | null;
  isSubmitting: boolean;
  isCancellingRun: boolean;
  submitError?: string | null;
  onCancelRun: () => void;
}

function getToneClasses(state: 'submitting' | 'queued' | 'running' | 'failed' | 'cancelled'): {
  shell: string;
  badge: string;
  icon: string;
} {
  switch (state) {
    case 'queued':
      return {
        shell: 'border-amber-400/30 bg-amber-500/10',
        badge: 'border-amber-400/35 bg-amber-500/15 text-amber-100',
        icon: 'text-amber-200',
      };
    case 'running':
      return {
        shell: 'border-sky-400/30 bg-sky-500/10',
        badge: 'border-sky-400/35 bg-sky-500/15 text-sky-100',
        icon: 'text-sky-200',
      };
    case 'failed':
      return {
        shell: 'border-rose-400/30 bg-rose-500/10',
        badge: 'border-rose-400/35 bg-rose-500/15 text-rose-100',
        icon: 'text-rose-200',
      };
    case 'cancelled':
      return {
        shell: 'border-zinc-400/30 bg-zinc-500/10',
        badge: 'border-zinc-400/35 bg-zinc-500/15 text-zinc-100',
        icon: 'text-zinc-200',
      };
    default:
      return {
        shell: 'border-[var(--mf-accent)]/30 bg-[var(--mf-accent-soft)]/40',
        badge: 'border-[var(--mf-accent)]/30 bg-[var(--mf-accent-soft)] text-[var(--mf-text)]',
        icon: 'text-[var(--mf-accent)]',
      };
  }
}

function getStatusIcon(state: 'submitting' | 'queued' | 'running' | 'failed' | 'cancelled') {
  switch (state) {
    case 'queued':
      return Clock3;
    case 'running':
      return PlayCircle;
    case 'failed':
      return AlertTriangle;
    case 'cancelled':
      return Clock3;
    default:
      return LoaderCircle;
  }
}

export function CommandCenterRunStatus({
  language,
  projection,
  isSubmitting,
  isCancellingRun,
  submitError,
  onCancelRun,
}: CommandCenterRunStatusProps) {
  const model = React.useMemo(
    () =>
      projectManagerSessionProjectionToRunStatusModel({
        projection,
        isSubmitting,
        submitError,
        language,
      }),
    [isSubmitting, language, projection, submitError],
  );

  if (!model) {
    return null;
  }

  const tone = getToneClasses(model.state);
  const Icon = getStatusIcon(model.state);
  const shouldSpin = model.state === 'submitting';

  return (
    <Card
      className={`overflow-hidden rounded-[1.6rem] shadow-lg backdrop-blur-xl ${tone.shell}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/15 ${tone.icon}`}
          >
            <Icon className={`h-5 w-5 ${shouldSpin ? 'animate-spin' : ''}`} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${tone.badge}`}
              >
                {model.badgeLabel}
              </span>
              <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--mf-text-muted)]">
                {language === 'zh' ? '运行状态' : 'Run Status'}
              </span>
            </div>

            <div className="mt-2 text-sm font-semibold text-[var(--mf-text)]">
              {model.title}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[var(--mf-text-muted)]">
              {model.description}
            </p>

            {model.metrics.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {model.metrics.map((metric) => (
                  <div
                    key={metric.id}
                    className="rounded-full border border-white/10 bg-black/10 px-3 py-1.5 text-[11px] text-[var(--mf-text)]"
                  >
                    <span className="text-[var(--mf-text-muted)]">{metric.label}: </span>
                    <span>{metric.value}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {model.actionLabel ? (
              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-2xl border-white/15 bg-black/10"
                  onClick={onCancelRun}
                  disabled={isCancellingRun}
                >
                  {isCancellingRun
                    ? language === 'zh'
                      ? '取消中'
                      : 'Cancelling...'
                    : model.actionLabel}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
