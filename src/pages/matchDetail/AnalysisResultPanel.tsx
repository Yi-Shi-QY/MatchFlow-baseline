import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Activity,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Video,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { RemotionPlayer } from '@/src/components/RemotionPlayer';
import { AnalysisPlannerRuntimeBridge } from '@/src/components/planner/AnalysisPlannerRuntimeBridge';
import type { AgentResult } from '@/src/services/agentParser';
import type { MatchAnalysis } from '@/src/services/ai';
import type { PlannerRuntimeState } from '@/src/services/planner/runtime';
import type { DomainResultSummaryHero } from '@/src/services/domains/ui/types';
import type { SummaryDistributionItem } from '@/src/services/analysisSummary';
import { formatConclusionCardValue } from '@/src/services/analysisSummary';
import type { AnalysisRunMetrics } from '@/src/contexts/analysis/types';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

interface AnalysisResultPanelProps {
  isAnalyzing: boolean;
  plannerDomainId: string;
  planSegments: any[];
  runtimeStatus: PlannerRuntimeState | null;
  runMetrics: AnalysisRunMetrics | null;
  planTotalSegments: number;
  planCompletedSegments: number;
  parsedStream: AgentResult | null;
  language: string;
  isPlannerCompact: boolean;
  collapsedSegments: Record<string, boolean>;
  onToggleCollapsedSegment: (segmentId: string, nextCollapsed: boolean) => void;
  retryMatchData: any;
  segmentAnimationOverrides: Record<string, any>;
  onAnimationRepaired: (segmentId: string, nextAnimation: any) => void;
  analysis: MatchAnalysis | null;
  summaryHero: DomainResultSummaryHero;
  summaryDistribution: SummaryDistributionItem[];
  summaryCards: any[];
  summaryTheme: any;
  summaryBarPalette: string[];
  summaryIsZh: boolean;
  thoughts: string;
  t: TranslateFn;
}

export function AnalysisResultPanel({
  isAnalyzing,
  plannerDomainId,
  planSegments,
  runtimeStatus,
  runMetrics,
  planTotalSegments,
  planCompletedSegments,
  parsedStream,
  language,
  isPlannerCompact,
  collapsedSegments,
  onToggleCollapsedSegment,
  retryMatchData,
  segmentAnimationOverrides,
  onAnimationRepaired,
  analysis,
  summaryHero,
  summaryDistribution,
  summaryCards,
  summaryTheme,
  summaryBarPalette,
  summaryIsZh,
  thoughts,
  t,
}: AnalysisResultPanelProps) {
  const [elapsedTick, setElapsedTick] = React.useState(0);

  React.useEffect(() => {
    if (!isAnalyzing || !runMetrics) return;
    const timerId = window.setInterval(() => {
      setElapsedTick((prev) => prev + 1);
    }, 1000);
    return () => {
      clearInterval(timerId);
    };
  }, [isAnalyzing, runMetrics?.runId]);

  const formatElapsed = React.useCallback((elapsedMs: number): string => {
    const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, []);

  const metricModel = React.useMemo(() => {
    if (!runMetrics) return '--';
    const currentProvider = (runMetrics.currentProvider || '').trim();
    const currentModel = (runMetrics.currentModel || '').trim();
    if (!currentProvider && !currentModel) return '--';
    const currentLabel =
      currentProvider && currentModel
        ? `${currentProvider}:${currentModel}`
        : currentModel || currentProvider;
    const extraModelCount = Math.max(0, runMetrics.modelsUsed.length - 1);
    if (extraModelCount > 0) {
      return `${currentLabel} (+${extraModelCount})`;
    }
    return currentLabel;
  }, [runMetrics]);

  const metricTokens = React.useMemo(() => {
    if (!runMetrics) return '--';
    if (runMetrics.tokenSource === 'none' && runMetrics.totalTokens <= 0) {
      return '--';
    }
    const display = runMetrics.totalTokens.toLocaleString();
    if (runMetrics.tokenSource === 'estimated' || runMetrics.tokenSource === 'mixed') {
      return `~${display}`;
    }
    return display;
  }, [runMetrics]);

  const metricTools = React.useMemo(() => {
    if (!runMetrics) return '--';
    return String(runMetrics.toolCallTotal);
  }, [runMetrics]);

  const metricElapsed = React.useMemo(() => {
    if (!runMetrics) return '--';
    const activeElapsed = Date.now() - runMetrics.startedAt;
    const elapsedMs = isAnalyzing
      ? Math.max(runMetrics.elapsedMs, activeElapsed)
      : runMetrics.elapsedMs;
    return formatElapsed(elapsedMs);
  }, [runMetrics, isAnalyzing, elapsedTick, formatElapsed]);

  const metricsLabelModel = t('match.runtime_metric_model', { defaultValue: 'Model' });
  const metricsLabelTokens = t('match.runtime_metric_tokens', { defaultValue: 'Tokens' });
  const metricsLabelTools = t('match.runtime_metric_tools', { defaultValue: 'Tools' });
  const metricsLabelElapsed = t('match.runtime_metric_elapsed', { defaultValue: 'Elapsed' });

  return (
    <main id="analysis-content" className="flex-1 flex flex-col gap-4 p-4 max-w-md mx-auto w-full">
      {runMetrics && (
        <div className="rounded-xl border border-[var(--mf-border)] bg-[var(--mf-surface-strong)] px-3 py-2">
          <div className="grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-4">
            <div className="rounded-lg border border-[var(--mf-border)] bg-[var(--mf-surface)] px-2 py-1.5">
              <div className="text-[var(--mf-text-muted)] uppercase tracking-wider">{metricsLabelModel}</div>
              <div className="mt-0.5 truncate text-[var(--mf-text)] font-medium" title={metricModel}>
                {metricModel}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--mf-border)] bg-[var(--mf-surface)] px-2 py-1.5">
              <div className="text-[var(--mf-text-muted)] uppercase tracking-wider">{metricsLabelTokens}</div>
              <div className="mt-0.5 text-[var(--mf-text)] font-medium">{metricTokens}</div>
            </div>
            <div className="rounded-lg border border-[var(--mf-border)] bg-[var(--mf-surface)] px-2 py-1.5">
              <div className="text-[var(--mf-text-muted)] uppercase tracking-wider">{metricsLabelTools}</div>
              <div className="mt-0.5 text-[var(--mf-text)] font-medium">{metricTools}</div>
            </div>
            <div className="rounded-lg border border-[var(--mf-border)] bg-[var(--mf-surface)] px-2 py-1.5">
              <div className="text-[var(--mf-text-muted)] uppercase tracking-wider">{metricsLabelElapsed}</div>
              <div className="mt-0.5 text-[var(--mf-text)] font-medium">{metricElapsed}</div>
            </div>
          </div>
        </div>
      )}

      {isAnalyzing && (
        <AnalysisPlannerRuntimeBridge
          domainId={plannerDomainId}
          planSegments={planSegments}
          runtimeStatus={runtimeStatus}
          planTotalSegments={planTotalSegments}
          planCompletedSegments={planCompletedSegments}
          parsedSegmentCount={parsedStream?.segments?.length || 0}
          language={language.startsWith('zh') ? 'zh' : 'en'}
          compact={isPlannerCompact}
          className="sticky top-[calc(env(safe-area-inset-top)+4.75rem)] z-10 mb-2"
        />
      )}

      {parsedStream?.segments.map((seg, i) => {
        const isCollapsed = collapsedSegments[seg.id];
        const segmentAnimation = segmentAnimationOverrides[seg.id] || seg.animation;
        return (
          <motion.div
            key={seg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col border border-zinc-800 rounded-xl bg-zinc-950 overflow-hidden shadow-lg"
          >
            <div
              className="bg-zinc-900/80 p-3 flex justify-between items-center cursor-pointer hover:bg-zinc-800 transition-colors"
              onClick={() => onToggleCollapsedSegment(seg.id, !isCollapsed)}
            >
              <div className="flex flex-col gap-1">
                <span
                  className={`text-xs font-mono flex items-center gap-2 ${
                    seg.isThoughtComplete ? 'text-zinc-400' : 'text-emerald-500'
                  }`}
                >
                  {seg.isThoughtComplete ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Activity className="w-3.5 h-3.5 animate-pulse" />
                  )}
                  {t('match.analysis_phase')} {i + 1}
                  {seg.title && (
                    <span className="ml-2 text-zinc-500 font-bold border-l border-zinc-700 pl-2">
                      {seg.title}
                    </span>
                  )}
                </span>

                {seg.tags && seg.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 ml-6">
                    {seg.tags.map((tag, idx) => {
                      let colorClass = 'bg-zinc-800 text-zinc-400 border-zinc-700';
                      if (tag.team === 'home') {
                        colorClass = 'bg-emerald-950/30 text-emerald-400 border-emerald-500/30';
                      }
                      if (tag.team === 'away') {
                        colorClass = 'bg-blue-950/30 text-blue-400 border-blue-500/30';
                      }

                      return (
                        <span key={idx} className={`text-[9px] px-1.5 py-0.5 rounded border ${colorClass}`}>
                          {tag.label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              {isCollapsed ? (
                <ChevronDown className="w-4 h-4 text-zinc-500" />
              ) : (
                <ChevronUp className="w-4 h-4 text-zinc-500" />
              )}
            </div>

            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="p-4 text-[11px] font-mono text-zinc-300 leading-relaxed bg-black/50"
                >
                  <div className="prose prose-invert prose-xs max-w-none [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>h3]:text-emerald-400 [&>h3]:font-bold [&>h3]:mt-2 [&>h3]:mb-1 [&>p]:mb-2 [&>strong]:text-white">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        table: ({ node, ...props }) => (
                          <div className="overflow-x-auto my-4 border border-zinc-800 rounded-lg">
                            <table className="w-full text-left text-[10px]" {...props} />
                          </div>
                        ),
                        thead: ({ node, ...props }) => (
                          <thead
                            className="bg-zinc-900 text-zinc-400 uppercase font-bold border-b border-zinc-800"
                            {...props}
                          />
                        ),
                        tbody: ({ node, ...props }) => <tbody className="divide-y divide-zinc-800" {...props} />,
                        tr: ({ node, ...props }) => (
                          <tr className="hover:bg-zinc-900/50 transition-colors" {...props} />
                        ),
                        th: ({ node, ...props }) => (
                          <th className="px-3 py-2 whitespace-nowrap font-semibold" {...props} />
                        ),
                        td: ({ node, ...props }) => (
                          <td className="px-3 py-2 whitespace-nowrap text-zinc-300" {...props} />
                        ),
                      }}
                    >
                      {seg.thoughts}
                    </ReactMarkdown>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {segmentAnimation && (
              <div className="border-t border-zinc-800 bg-black p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-blue-400 text-xs font-bold border-b border-white/10 pb-2">
                    <Video className="w-4 h-4" /> {segmentAnimation.title || t('match.data_visualization')}
                  </div>
                  <div className="text-zinc-300 text-xs italic bg-zinc-900/50 p-3 rounded-lg border-l-2 border-blue-500">
                    "{segmentAnimation.narration}"
                  </div>

                  <div className="mt-2 w-full max-w-[300px] mx-auto">
                    <RemotionPlayer
                      animation={segmentAnimation}
                      retryContext={{
                        matchData: retryMatchData,
                        segmentPlan: {
                          title: seg.title,
                          animationType: segmentAnimation?.type || 'stats',
                        },
                        analysisText: seg.thoughts || '',
                      }}
                      onAnimationRepaired={(nextAnimation) =>
                        onAnimationRepaired(seg.id, nextAnimation)
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        );
      })}

      {analysis && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Card className={summaryTheme.cardClassName}>
            <CardHeader className={summaryTheme.headerClassName}>
              <CardTitle className={summaryTheme.titleClassName}>
                <BrainCircuit className="w-4 h-4" />
                {t(summaryTheme.titleKey)}
              </CardTitle>
            </CardHeader>

            <CardContent className={summaryTheme.contentClassName}>
              <div className="p-6 w-full flex flex-col items-center">
                {summaryHero.kind === 'pair' && (
                  <div className="flex items-center gap-6 mb-6">
                    {summaryHero.primary.logo ? (
                      <img
                        src={summaryHero.primary.logo}
                        alt={summaryHero.primary.name}
                        className="w-16 h-16 object-contain drop-shadow-2xl rounded-full bg-white/5"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-[var(--mf-surface)] border border-[var(--mf-border)] flex items-center justify-center text-xl font-bold text-[var(--mf-text)]">
                        {(summaryHero.primary.name || '?').slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="text-xl font-bold font-mono text-[var(--mf-text-muted)]">{summaryHero.connector}</div>
                    {summaryHero.secondary.logo ? (
                      <img
                        src={summaryHero.secondary.logo}
                        alt={summaryHero.secondary.name}
                        className="w-16 h-16 object-contain drop-shadow-2xl rounded-full bg-white/5"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-[var(--mf-surface)] border border-[var(--mf-border)] flex items-center justify-center text-xl font-bold text-[var(--mf-text)]">
                        {(summaryHero.secondary.name || '?').slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                )}

                {summaryHero.kind === 'single' && (
                  <div className="mb-6 flex flex-col items-center gap-2">
                    {summaryHero.entity.logo ? (
                      <img
                        src={summaryHero.entity.logo}
                        alt={summaryHero.entity.name}
                        className="w-16 h-16 object-contain drop-shadow-2xl rounded-full bg-white/5"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-[var(--mf-surface)] border border-[var(--mf-border)] flex items-center justify-center text-xl font-bold text-[var(--mf-text)]">
                        {(summaryHero.entity.name || '?').slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className={summaryTheme.heroNameClassName}>{summaryHero.entity.name}</div>
                    {summaryHero.caption ? (
                      <div className={summaryTheme.heroCaptionClassName}>{summaryHero.caption}</div>
                    ) : null}
                  </div>
                )}

                {summaryHero.kind === 'list' && summaryHero.entities.length > 0 && (
                  <div className="mb-6 w-full flex flex-wrap items-center justify-center gap-2">
                    {summaryHero.entities.map((entity, index) => (
                      <div
                        key={`${entity.id}_${index}`}
                        className="px-2.5 py-1.5 rounded-full bg-[var(--mf-surface)] border border-[var(--mf-border)] text-[10px] text-[var(--mf-text)] flex items-center gap-1.5"
                      >
                        {entity.logo ? (
                          <img
                            src={entity.logo}
                            alt={entity.name}
                            className="w-4 h-4 rounded-full object-contain bg-white/5"
                          />
                        ) : null}
                        <span className="truncate max-w-[120px]">{entity.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {summaryDistribution.length > 0 && (
                  <div className="w-full max-w-[320px] space-y-3">
                    {summaryDistribution.map((entry, index) => (
                      <div key={entry.id} className="space-y-1">
                        <div className={summaryTheme.distributionLabelClassName}>
                          <span className="truncate max-w-[180px]">{entry.label}</span>
                          <span>{entry.value}%</span>
                        </div>
                        <div className={summaryTheme.distributionTrackClassName}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${entry.value}%` }}
                            transition={{ duration: 0.9, delay: index * 0.08 }}
                            className="h-full"
                            style={{
                              backgroundColor: entry.color || summaryBarPalette[index % summaryBarPalette.length],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {summaryCards.length > 0 && (
                  <div className="mt-5 w-full grid grid-cols-2 gap-2">
                    {summaryCards.map((card, index) => (
                      <div key={`${card.label}_${index}`} className={summaryTheme.conclusionCardClassName}>
                        <div className="text-[10px] uppercase tracking-wider text-[var(--mf-text-muted)]">{card.label}</div>
                        <div className="text-sm font-semibold text-[var(--mf-text)]">{formatConclusionCardValue(card)}</div>
                        {(typeof card.confidence === 'number' || card.trend) && (
                          <div className={summaryTheme.conclusionMetaClassName}>
                            {typeof card.confidence === 'number'
                              ? `${summaryIsZh ? '置信度' : 'Confidence'} ${card.confidence}%`
                              : ''}
                            {typeof card.confidence === 'number' && card.trend ? ' | ' : ''}
                            {card.trend ? `${summaryIsZh ? '趋势' : 'Trend'} ${card.trend}` : ''}
                          </div>
                        )}
                        {card.note && <div className="text-[10px] text-[var(--mf-text-muted)] line-clamp-2">{card.note}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {analysis.prediction && (
                  <div className={summaryTheme.quoteCardClassName}>
                    <p className="text-xs text-[var(--mf-text)] leading-relaxed italic text-center">
                      "{analysis.prediction}"
                    </p>
                  </div>
                )}

                {Array.isArray(analysis.keyFactors) && analysis.keyFactors.length > 0 && (
                  <div className="mt-4 w-full flex flex-wrap items-center justify-center gap-1.5">
                    {analysis.keyFactors.slice(0, 6).map((factor, index) => (
                      <span key={`${factor}_${index}`} className={summaryTheme.keyFactorClassName}>
                        {factor}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {!parsedStream?.segments?.length && thoughts && !isAnalyzing && !analysis && (
        <Card className="border-red-500/30 bg-zinc-950">
          <CardHeader className="border-b border-white/5 py-3 px-4">
            <CardTitle className="text-red-400 text-sm">{t('match.parsing_failed')}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 font-mono text-[10px] text-zinc-400 whitespace-pre-wrap">
            {thoughts}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
