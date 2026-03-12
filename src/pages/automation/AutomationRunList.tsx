import React from 'react';
import { History } from 'lucide-react';
import { Card, CardContent } from '@/src/components/ui/Card';
import type { AutomationRun } from '@/src/services/automation';

interface AutomationRunListProps {
  language: 'zh' | 'en';
  runs: AutomationRun[];
  selectedRunId?: string | null;
}

export function AutomationRunList({
  language,
  runs,
  selectedRunId = null,
}: AutomationRunListProps) {
  const copy =
    language === 'zh'
      ? {
          title: '最近运行',
          empty: '自动化运行记录还为空。',
          completed: '完成',
          failed: '失败',
          running: '运行中',
          cancelled: '已取消',
        }
      : {
          title: 'Recent Runs',
          empty: 'Automation run history is empty.',
          completed: 'Completed',
          failed: 'Failed',
          running: 'Running',
          cancelled: 'Cancelled',
        };

  const stateLabel = (state: AutomationRun['state']) => {
    if (state === 'completed') return copy.completed;
    if (state === 'failed') return copy.failed;
    if (state === 'cancelled') return copy.cancelled;
    return copy.running;
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-[var(--mf-accent)]" />
        <h3 className="text-sm font-semibold text-[var(--mf-text)]">{copy.title}</h3>
      </div>

      {runs.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-sm text-[var(--mf-text-muted)]">
            {copy.empty}
          </CardContent>
        </Card>
      ) : (
        runs.map((run) => {
          const isSelected = selectedRunId === run.id;
          return (
            <Card
              key={run.id}
              id={`automation-run-${run.id}`}
              className={`bg-[var(--mf-surface)] transition-colors ${
                isSelected ? 'ring-1 ring-[var(--mf-accent)] bg-[var(--mf-surface-muted)]' : ''
              }`}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-[var(--mf-text)]">{run.title}</div>
                  <span className="text-[11px] text-[var(--mf-text-muted)]">
                    {stateLabel(run.state)}
                  </span>
                </div>
                <div className="text-xs text-[var(--mf-text-muted)]">
                  {new Date(run.startedAt).toLocaleString(
                    language === 'zh' ? 'zh-CN' : 'en-US',
                    {
                      hour12: false,
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    },
                  )}
                </div>
                {run.errorMessage ? (
                  <div className="text-xs text-red-300">{run.errorMessage}</div>
                ) : null}
              </CardContent>
            </Card>
          );
        })
      )}
    </section>
  );
}
