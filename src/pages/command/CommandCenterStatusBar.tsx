import React from 'react';
import { Activity, CircleCheck, CircleDot, TriangleAlert } from 'lucide-react';
import type { CommandCenterHomeLayout } from './homeLayoutModel';

interface CommandCenterStatusBarProps {
  language: 'zh' | 'en';
  layout: CommandCenterHomeLayout;
}

function getToneClasses(tone: CommandCenterHomeLayout['statusTone']) {
  if (tone === 'warning') {
    return {
      shell: 'border-amber-400/35 bg-amber-500/10',
      icon: 'text-amber-300',
    };
  }
  if (tone === 'active') {
    return {
      shell: 'border-sky-400/35 bg-sky-500/10',
      icon: 'text-sky-300',
    };
  }
  if (tone === 'success') {
    return {
      shell: 'border-emerald-400/35 bg-emerald-500/10',
      icon: 'text-emerald-300',
    };
  }
  return {
    shell: 'border-[var(--mf-border)] bg-[var(--mf-surface)]/90',
    icon: 'text-[var(--mf-text-muted)]',
  };
}

function getStatusIcon(tone: CommandCenterHomeLayout['statusTone']) {
  if (tone === 'warning') {
    return TriangleAlert;
  }
  if (tone === 'active') {
    return Activity;
  }
  if (tone === 'success') {
    return CircleCheck;
  }
  return CircleDot;
}

export function CommandCenterStatusBar({
  language,
  layout,
}: CommandCenterStatusBarProps) {
  const tone = getToneClasses(layout.statusTone);
  const Icon = getStatusIcon(layout.statusTone);
  const copy =
    language === 'zh'
      ? {
          pending: '待继续',
          running: '进行中',
        }
      : {
          pending: 'Pending',
          running: 'Running',
        };

  return (
    <section className="sticky top-[calc(1rem+env(safe-area-inset-top))] z-20 pl-14">
      <div
        className={`flex items-center justify-between gap-3 rounded-[1.4rem] border px-4 py-3 shadow-lg backdrop-blur-xl ${tone.shell}`}
      >
        <div className="min-w-0 flex items-center gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/10 ${tone.icon}`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--mf-text-muted)]">
              MatchFlow
            </div>
            <div className="truncate text-sm font-semibold text-[var(--mf-text)]">
              {layout.statusLabel}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-2 text-[11px]">
          <div className="rounded-full border border-white/10 bg-black/10 px-3 py-1.5 text-[var(--mf-text)]">
            <span className="text-[var(--mf-text-muted)]">{copy.pending}: </span>
            <span>{layout.pendingCount}</span>
          </div>
          <div className="rounded-full border border-white/10 bg-black/10 px-3 py-1.5 text-[var(--mf-text)]">
            <span className="text-[var(--mf-text-muted)]">{copy.running}: </span>
            <span>{layout.runningCount}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
