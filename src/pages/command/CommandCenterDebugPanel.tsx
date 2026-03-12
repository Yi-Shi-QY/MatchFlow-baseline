import React from 'react';
import { ChevronDown, ChevronUp, ListTree } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import type { ManagerSessionProjection } from '@/src/services/manager-gateway/types';
import { projectManagerSessionProjectionToDebugModel } from './debugPanelModel';

interface CommandCenterDebugPanelProps {
  language: 'zh' | 'en';
  projection: ManagerSessionProjection | null;
}

function getCategoryTone(category: string): string {
  switch (category) {
    case 'summary':
      return 'border-[var(--mf-accent)]/40 bg-[var(--mf-accent-soft)] text-[var(--mf-text)]';
    case 'memory':
      return 'border-sky-400/30 bg-sky-500/10 text-sky-200';
    case 'recent_turns':
      return 'border-amber-400/30 bg-amber-500/10 text-amber-200';
    case 'domain_state':
      return 'border-violet-400/30 bg-violet-500/10 text-violet-200';
    case 'runtime_state':
      return 'border-zinc-400/30 bg-white/5 text-[var(--mf-text-muted)]';
    default:
      return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200';
  }
}

export function CommandCenterDebugPanel({
  language,
  projection,
}: CommandCenterDebugPanelProps) {
  const model = React.useMemo(
    () => projectManagerSessionProjectionToDebugModel(projection, language),
    [language, projection],
  );
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    if (!model) {
      setExpanded(false);
    }
  }, [model]);

  if (!model) {
    return null;
  }

  return (
    <Card className="overflow-hidden rounded-[1.6rem] border-[var(--mf-border)] bg-[var(--mf-surface)]/88 shadow-lg backdrop-blur-xl">
      <CardHeader className="gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[var(--mf-text-muted)]">
              <ListTree className="h-3.5 w-3.5" />
              {language === 'zh' ? 'Phase 5 Debug' : 'Phase 5 Debug'}
            </div>
            <CardTitle className="mt-2 text-base">{model.title}</CardTitle>
            <p className="mt-1 text-xs leading-relaxed text-[var(--mf-text-muted)]">
              {model.subtitle}
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 rounded-2xl border border-[var(--mf-border)] px-3"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? (
              <>
                <ChevronUp className="mr-1 h-4 w-4" />
                {language === 'zh' ? '收起' : 'Hide'}
              </>
            ) : (
              <>
                <ChevronDown className="mr-1 h-4 w-4" />
                {language === 'zh' ? '展开' : 'Show'}
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {model.metrics.map((metric) => (
            <div
              key={metric.id}
              className="rounded-2xl border border-[var(--mf-border)] bg-[var(--mf-surface-strong)]/70 px-3 py-2"
            >
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--mf-text-muted)]">
                {metric.label}
              </div>
              <div className="mt-1 truncate text-sm font-medium text-[var(--mf-text)]">
                {metric.value}
              </div>
            </div>
          ))}
        </div>
      </CardHeader>

      {expanded ? (
        <CardContent className="border-t border-[var(--mf-border)] p-4">
          <div className="space-y-3">
            {model.fragments.map((fragment) => (
              <div
                key={fragment.id}
                className="rounded-[1.35rem] border border-[var(--mf-border)] bg-[var(--mf-surface-strong)]/75 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${getCategoryTone(fragment.category)}`}
                  >
                    {fragment.categoryLabel}
                  </span>
                  <span className="text-[11px] text-[var(--mf-text-muted)]">
                    priority {fragment.priority}
                  </span>
                  <span className="truncate text-[11px] text-[var(--mf-text-muted)]">
                    {fragment.id}
                  </span>
                </div>

                <pre className="mt-3 whitespace-pre-wrap break-words rounded-2xl bg-black/20 p-3 font-mono text-[11px] leading-relaxed text-[var(--mf-text)]">
                  {fragment.text}
                </pre>

                {fragment.metadataLines.length > 0 ? (
                  <div className="mt-3 space-y-1 rounded-2xl border border-[var(--mf-border)]/70 bg-white/5 p-3 font-mono text-[11px] text-[var(--mf-text-muted)]">
                    {fragment.metadataLines.map((line) => (
                      <div key={line}>{line}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
