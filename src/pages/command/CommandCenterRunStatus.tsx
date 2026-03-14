import React from 'react';
import {
  AlertTriangle,
  Clock3,
  LoaderCircle,
  PlayCircle,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { translateText } from '@/src/i18n/translate';
import type { ManagerSessionProjection } from '@/src/services/manager-gateway/types';
import {
  projectManagerSessionProjectionToRunStatusModel,
  type CommandCenterRunStatusMetric,
} from './runStatusModel';

interface CommandCenterRunStatusProps {
  language: 'zh' | 'en';
  projection: ManagerSessionProjection | null;
  isSubmitting: boolean;
  isCancellingRun: boolean;
  submitError?: string | null;
  onCancelRun: () => void;
}

function tr(language: 'zh' | 'en', key: string, zh: string, en: string) {
  return translateText(language, key, language === 'zh' ? zh : en);
}

function getToneClasses(state: 'submitting' | 'queued' | 'running' | 'failed' | 'cancelled'): {
  shell: string;
  badge: string;
  icon: string;
  action: string;
} {
  switch (state) {
    case 'queued':
      return {
        shell: 'border-amber-400/28 bg-amber-500/10',
        badge: 'border-amber-300/30 bg-amber-500/16 text-amber-100',
        icon: 'text-amber-200',
        action: 'border-amber-300/25 bg-amber-500/10 text-amber-50 hover:bg-amber-500/16',
      };
    case 'running':
      return {
        shell: 'border-sky-400/28 bg-sky-500/10',
        badge: 'border-sky-300/30 bg-sky-500/16 text-sky-100',
        icon: 'text-sky-200',
        action: 'border-sky-300/25 bg-sky-500/10 text-sky-50 hover:bg-sky-500/16',
      };
    case 'failed':
      return {
        shell: 'border-rose-400/28 bg-rose-500/10',
        badge: 'border-rose-300/30 bg-rose-500/16 text-rose-100',
        icon: 'text-rose-200',
        action: 'border-rose-300/25 bg-rose-500/10 text-rose-50 hover:bg-rose-500/16',
      };
    case 'cancelled':
      return {
        shell: 'border-zinc-400/24 bg-zinc-500/10',
        badge: 'border-zinc-300/20 bg-zinc-500/14 text-zinc-100',
        icon: 'text-zinc-200',
        action: 'border-zinc-300/20 bg-zinc-500/10 text-zinc-50 hover:bg-zinc-500/16',
      };
    default:
      return {
        shell: 'border-[var(--mf-accent)]/28 bg-[var(--mf-accent-soft)]/45',
        badge: 'border-[var(--mf-accent)]/25 bg-[var(--mf-accent-soft)] text-[var(--mf-text)]',
        icon: 'text-[var(--mf-accent)]',
        action:
          'border-[var(--mf-accent)]/25 bg-[var(--mf-accent-soft)]/80 text-[var(--mf-text)] hover:bg-[var(--mf-accent-soft)]',
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

function getCompactMetrics(
  state: 'submitting' | 'queued' | 'running' | 'failed' | 'cancelled',
  metrics: CommandCenterRunStatusMetric[],
) {
  if (!Array.isArray(metrics)) {
    return [];
  }

  if (state === 'submitting') {
    return metrics.slice(0, 2);
  }

  return metrics
    .filter((metric) => metric.id === 'tool' || metric.id === 'updated' || metric.id === 'status')
    .slice(0, 2);
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
  const compactMetrics = getCompactMetrics(model.state, model.metrics);

  return (
    <section id="command-center-run-status">
      <div
        className={`relative overflow-hidden rounded-[1.45rem] border px-3.5 py-3 shadow-[0_16px_40px_rgba(3,7,18,0.16)] backdrop-blur-xl ${tone.shell}`}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-white/10 to-transparent" />

        <div className="relative flex items-start gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/15 ${tone.icon}`}
          >
            <Icon className={`h-4 w-4 ${shouldSpin ? 'animate-spin' : ''}`} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${tone.badge}`}
              >
                {model.badgeLabel}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--mf-text)]">
                {model.title}
              </span>
            </div>

            <p className="mt-1.5 text-xs leading-relaxed text-[var(--mf-text-muted)]">
              {model.description}
            </p>

            {compactMetrics.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {compactMetrics.map((metric) => (
                  <div
                    key={metric.id}
                    className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-[10px] text-[var(--mf-text)]"
                  >
                    <span className="text-[var(--mf-text-muted)]">{metric.label}: </span>
                    <span>{metric.value}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {model.actionLabel ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`mt-0.5 rounded-2xl px-3 ${tone.action}`}
              onClick={onCancelRun}
              disabled={isCancellingRun}
            >
              {isCancellingRun
                ? tr(language, 'command_center.run_status.cancelling', '取消中...', 'Cancelling...')
                : model.actionLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
