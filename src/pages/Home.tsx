import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/src/components/ui/Card';
import { Activity, Calendar, ChevronRight, QrCode, History, Settings, Search, Trash2, ArrowUpDown, Loader2, RefreshCw } from 'lucide-react';
import { getHistory, clearHistory, deleteHistoryRecord, HistoryRecord, clearResumeState } from '@/src/services/history';
import type { MatchAnalysis } from '@/src/services/ai';
import type { AgentResult } from '@/src/services/agentParser';
import {
  getSavedSubjects,
  deleteSavedSubject,
  type SavedSubjectRecord,
} from '@/src/services/savedSubjects';
import { Button } from '@/src/components/ui/Button';
import { motion, AnimatePresence } from 'motion/react';
import { useAnalysis } from '@/src/contexts/AnalysisContext';
import { buildAnalysisSubjectKey } from '@/src/contexts/analysis/types';
import { getActiveAnalysisDomain } from '@/src/services/domains/registry';
import { getPlannerStageI18nKey } from '@/src/services/planner/stageI18n';
import {
  getDomainUiTheme,
  getDomainUiPresenter,
  type HomeCenterDisplay,
  type HomeEntityDisplay,
  type HistoryPresenterContext,
  type HomePresenterContext,
  resolveHomeEntityDisplay,
} from '@/src/services/domains/ui/presenter';
import { buildSubjectRoute } from '@/src/services/navigation/subjectRoute';
import type { SubjectDisplayMatch } from '@/src/services/subjectDisplayMatch';
import { cn } from '@/src/lib/utils';
import type { PlannerRuntimeState } from '@/src/services/planner/runtime';
import { resolveDomainMatchFeed } from '@/src/services/domainMatchFeed';

function toneClassForMetric(tone?: 'neutral' | 'positive' | 'negative') {
  if (tone === 'positive') return 'text-emerald-400';
  if (tone === 'negative') return 'text-red-400';
  return 'text-zinc-400';
}

type PendingDeleteTarget =
  | { kind: 'history'; id: string; subjectId: string; domainId: string }
  | { kind: 'saved'; id: string; subjectId: string; domainId: string }
  | null;

interface ActiveHomeRecord {
  id: string;
  domainId: string;
  subjectId: string;
  subjectDisplay: SubjectDisplayMatch;
  subjectSnapshot?: unknown;
  timestamp: number;
  isActive: true;
  analysis: MatchAnalysis | null;
  parsedStream: AgentResult | null;
  runtimeStatus: PlannerRuntimeState | null;
  planTotalSegments: number;
  planCompletedSegments: number;
}

type HomeListRecord = ActiveHomeRecord | (HistoryRecord & { isActive?: false });

export default function Home() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const activeDomain = getActiveAnalysisDomain();
  const activeDomainId = activeDomain.id;
  const domainUiPresenter = getDomainUiPresenter(activeDomain);
  const domainUiTheme = getDomainUiTheme(activeDomain);
  const homePresenter = domainUiPresenter.home;
  const historyPresenter = domainUiPresenter.history;
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [savedSubjects, setSavedSubjects] = useState<SavedSubjectRecord[]>([]);
  const [liveMatches, setLiveMatches] = useState<SubjectDisplayMatch[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [pendingDeleteTarget, setPendingDeleteTarget] = useState<PendingDeleteTarget>(null);
  const { activeAnalyses, clearActiveAnalysis } = useAnalysis();
  const prevAnalysesRef = React.useRef<Record<string, boolean>>({});
  const homeHistoryTheme = domainUiTheme.home.history;
  const summaryBarPalette = homeHistoryTheme.barPalette;
  const translate = React.useCallback(
    (key: string, options?: Record<string, unknown>) => String(t(key, options as never)),
    [t],
  );

  const presenterContext = useMemo<HomePresenterContext>(() => {
    const formatTime = (isoDate: string) => {
      const parsed = new Date(isoDate);
      if (Number.isNaN(parsed.getTime())) return '--:--';
      return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (isoDate: string) => {
      const parsed = new Date(isoDate);
      if (Number.isNaN(parsed.getTime())) return '--';
      return parsed.toLocaleDateString();
    };

    return {
      t: translate,
      formatTime,
      formatDate,
    };
  }, [translate]);

  const historyPresenterContext = useMemo<HistoryPresenterContext>(
    () => ({
      t: translate,
      language: i18n.language.startsWith('zh') ? 'zh' : 'en',
    }),
    [translate, i18n.language],
  );

  const loadMatches = async () => {
    setIsLoadingMatches(true);
    try {
      const matches = await resolveDomainMatchFeed({
        domainId: activeDomainId,
        allowRuntime: homePresenter.useRemoteFeed,
      });
      setLiveMatches(matches);
    } finally {
      setIsLoadingMatches(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      const historyData = await getHistory({ domainId: activeDomainId });
      setHistory(historyData);

      const savedData = await getSavedSubjects({ domainId: activeDomainId });
      setSavedSubjects(savedData);

      await loadMatches();
    };
    loadData();
  }, [activeDomainId, homePresenter.useRemoteFeed]);

  // Re-fetch history when an active analysis completes
  useEffect(() => {
    let newlyCompleted = false;
    const currentAnalyzing: Record<string, boolean> = {};

    Object.values(activeAnalyses).forEach(a => {
      const subjectKey = buildAnalysisSubjectKey(a.subjectRef);
      currentAnalyzing[subjectKey] = a.isAnalyzing;
      if (prevAnalysesRef.current[subjectKey] && !a.isAnalyzing && a.analysis) {
        newlyCompleted = true;
      }
    });

    prevAnalysesRef.current = currentAnalyzing;

    if (newlyCompleted) {
      getHistory({ domainId: activeDomainId }).then(setHistory);
    }
  }, [activeAnalyses, activeDomainId]);

  const handleClearHistory = async () => {
    clearHistory();
    // Clear all completed analyses from context
    Object.values(activeAnalyses).forEach(analysis => {
      if (!analysis.isAnalyzing) {
        clearActiveAnalysis(buildAnalysisSubjectKey(analysis.subjectRef));
      }
    });
    // Also clear resume state
    await clearResumeState();

    setHistory([]);
    setShowClearConfirm(false);
  };

  const handleDeleteRecord = (
    e: React.MouseEvent,
    id: string,
    subjectId: string,
    domainId: string,
  ) => {
    e.stopPropagation();
    setPendingDeleteTarget({ kind: 'history', id, subjectId, domainId });
  };

  const handleDeleteSavedSubject = (
    e: React.MouseEvent,
    id: string,
    subjectId: string,
    domainId: string,
  ) => {
    e.stopPropagation();
    setPendingDeleteTarget({ kind: 'saved', id, subjectId, domainId });
  };

  const handleConfirmDeleteItem = async () => {
    if (!pendingDeleteTarget) return;
    if (pendingDeleteTarget.kind === 'history') {
      deleteHistoryRecord(pendingDeleteTarget.id, {
        domainId: pendingDeleteTarget.domainId,
        subjectId: pendingDeleteTarget.subjectId,
        subjectType: 'match',
      });
      clearActiveAnalysis(
        buildAnalysisSubjectKey({
          domainId: pendingDeleteTarget.domainId,
          subjectId: pendingDeleteTarget.subjectId,
        }),
      );
      await clearResumeState(pendingDeleteTarget.subjectId, {
        domainId: pendingDeleteTarget.domainId,
        subjectId: pendingDeleteTarget.subjectId,
        subjectType: 'match',
      });
      const data = await getHistory({ domainId: activeDomainId });
      setHistory(data);
      setPendingDeleteTarget(null);
      return;
    }

    await deleteSavedSubject(pendingDeleteTarget.id, {
      domainId: pendingDeleteTarget.domainId,
      subjectId: pendingDeleteTarget.subjectId,
      subjectType: 'match',
    });
    const data = await getSavedSubjects({ domainId: activeDomainId });
    setSavedSubjects(data);
    setPendingDeleteTarget(null);
  };

  // Combine history and active analyses
  const allRecords = React.useMemo<HomeListRecord[]>(() => {
    const activeRecords: ActiveHomeRecord[] = Object.values(activeAnalyses)
      .filter(active => active.isAnalyzing)
      .map(active => ({
        id: `active_${buildAnalysisSubjectKey(active.subjectRef)}`,
        domainId: active.domainId,
        subjectId: active.subjectId,
        subjectDisplay: active.match,
        subjectSnapshot: active.subjectSnapshot ?? active.match,
        timestamp: Date.now(), // Keep active ones at the top
        isActive: true,
        analysis: active.analysis,
        parsedStream: active.parsedStream,
        runtimeStatus: active.runtimeStatus,
        planTotalSegments: active.planTotalSegments,
        planCompletedSegments: active.planCompletedSegments,
      }));

    // Filter out history records that are currently active in the same domain.
    const activeKeySet = new Set(
      Object.values(activeAnalyses)
        .filter((analysis) => analysis.isAnalyzing)
        .map((analysis) => buildAnalysisSubjectKey(analysis.subjectRef)),
    );
    const filteredHistory = history.filter(
      (record) =>
        !activeKeySet.has(
          buildAnalysisSubjectKey({
            domainId: record.domainId,
            subjectId: record.subjectId,
          }),
        ),
    );

    return [...activeRecords, ...filteredHistory];
  }, [history, activeAnalyses]);

  const filteredAndSortedHistory = allRecords
    .filter(record => {
      const searchLower = searchQuery.trim().toLowerCase();
      if (!searchLower) return true;
      const searchableTokens = homePresenter
        .getSearchTokens(record.subjectDisplay, record.subjectSnapshot)
        .filter(token => typeof token === 'string' && token.trim().length > 0)
        .map(token => token.toLowerCase());
      return searchableTokens.some(token => token.includes(searchLower));
    })
    .sort((a, b) => {
      if (sortOrder === 'newest') {
        return b.timestamp - a.timestamp;
      } else {
        return a.timestamp - b.timestamp;
      }
    });

  const renderCenterDisplay = (display: HomeCenterDisplay) => {
    if (display.kind === 'score') {
      return (
        <div className="text-2xl font-bold font-mono tracking-tighter">
          {display.home} - {display.away}
        </div>
      );
    }

    if (display.kind === 'metrics') {
      return (
        <div className="text-center space-y-1">
          {display.items.map((item, index) => (
            <div
              key={`${item.label}_${index}`}
              className={`text-xs font-mono ${toneClassForMetric(item.tone)}`}
            >
              {item.label}: {item.value}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className={`text-sm font-medium font-mono ${toneClassForMetric(display.tone)}`}>
        {display.value}
      </div>
    );
  };

  const renderEntityAvatar = (
    entity: { name: string; logo?: string },
    size: 'compact' | 'feed',
  ) => {
    const avatarClassName =
      size === 'feed' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs';
    if (entity.logo) {
      return (
        <img
          src={entity.logo}
          alt={entity.name}
          className={`${avatarClassName} object-contain drop-shadow-md rounded-full bg-white/5`}
        />
      );
    }
    return (
      <div
        className={`${avatarClassName} rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center font-bold text-zinc-300`}
      >
        {(entity.name || '?').slice(0, 1).toUpperCase()}
      </div>
    );
  };

  const renderCompactEntityDisplay = (display: HomeEntityDisplay) => {
    if (display.kind === 'pair') {
      return (
        <div className="flex items-center justify-between mb-3">
          <div className="flex flex-col items-center gap-1.5 w-12">
            {renderEntityAvatar(display.primary, 'compact')}
            <span className="text-[9px] font-medium text-center line-clamp-1 w-full text-zinc-300">
              {display.primary.name}
            </span>
          </div>

          <div className="text-[10px] font-bold font-mono text-[var(--mf-text-muted)]">
            {display.connector}
          </div>

          <div className="flex flex-col items-center gap-1.5 w-12">
            {renderEntityAvatar(display.secondary, 'compact')}
            <span className="text-[9px] font-medium text-center line-clamp-1 w-full text-zinc-300">
              {display.secondary.name}
            </span>
          </div>
        </div>
      );
    }

    if (display.kind === 'single') {
      return (
        <div className="mb-3 flex flex-col items-center gap-1.5 min-h-[68px] justify-center">
          {renderEntityAvatar(display.entity, 'compact')}
          <span className="text-[10px] font-medium text-center line-clamp-2 text-zinc-200">
            {display.entity.name}
          </span>
          {display.caption ? (
            <span className="text-[9px] font-mono text-[var(--mf-text-muted)] line-clamp-1">
              {display.caption}
            </span>
          ) : null}
        </div>
      );
    }

    return (
      <div className="mb-3 min-h-[68px] flex flex-wrap items-center justify-center gap-1.5">
        {display.entities.slice(0, 4).map((entity, index) => (
          <div
            key={`${entity.id}_${index}`}
            className="px-2 py-1 rounded-full bg-[var(--mf-surface)] border border-[var(--mf-border)] text-[9px] text-[var(--mf-text)] max-w-[120px] truncate"
          >
            {entity.name}
          </div>
        ))}
      </div>
    );
  };

  const renderFeedEntityDisplay = (
    display: HomeEntityDisplay,
    centerDisplay: HomeCenterDisplay,
  ) => {
    if (display.kind === 'pair') {
      return (
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center gap-2 w-20">
            {renderEntityAvatar(display.primary, 'feed')}
            <span className="text-xs font-medium text-center line-clamp-1">
              {display.primary.name}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center flex-1">
            {renderCenterDisplay(centerDisplay)}
          </div>

          <div className="flex flex-col items-center gap-2 w-20">
            {renderEntityAvatar(display.secondary, 'feed')}
            <span className="text-xs font-medium text-center line-clamp-1">
              {display.secondary.name}
            </span>
          </div>
        </div>
      );
    }

    if (display.kind === 'single') {
      return (
        <div className="flex flex-col items-center justify-center gap-2.5 py-1">
          {renderEntityAvatar(display.entity, 'feed')}
          <span className="text-xs font-medium text-center line-clamp-2 max-w-[220px]">
            {display.entity.name}
          </span>
          {display.caption ? (
            <span className="text-[10px] font-mono text-[var(--mf-text-muted)]">{display.caption}</span>
          ) : null}
          <div className="pt-0.5">{renderCenterDisplay(centerDisplay)}</div>
        </div>
      );
    }

    return (
      <div className="w-full flex flex-col items-center justify-center gap-2.5 py-1">
        <div className="w-full flex flex-wrap items-center justify-center gap-1.5">
          {display.entities.slice(0, 6).map((entity, index) => (
            <span
              key={`${entity.id}_${index}`}
              className="text-[10px] px-2 py-1 rounded-full bg-zinc-800/80 border border-white/10 text-zinc-300"
            >
              {entity.name}
            </span>
          ))}
        </div>
        <div>{renderCenterDisplay(centerDisplay)}</div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {/* Mobile App Header */}
      <header className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Activity className="text-emerald-500 w-6 h-6" /> MatchFlow
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/scan')}
              className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-white/10 text-emerald-400 hover:bg-zinc-700 transition-colors"
            >
              <QrCode className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-white/10 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 pt-6 max-w-md mx-auto space-y-8">
        <section>
          <Card
            className="cursor-pointer border-[var(--mf-border)] bg-[var(--mf-surface)]"
            onClick={() => navigate('/automation')}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--mf-text-muted)] font-mono">
                    {i18n.language.startsWith('zh') ? '自动化中枢' : 'Automation Hub'}
                  </div>
                  <div className="text-base font-semibold text-[var(--mf-text)]">
                    {i18n.language.startsWith('zh')
                      ? '用自然语言创建定时分析和周期规则'
                      : 'Create scheduled analysis and recurring rules with natural language'}
                  </div>
                  <p className="text-xs leading-relaxed text-[var(--mf-text-muted)]">
                    {i18n.language.startsWith('zh')
                      ? '先生成草案，再确认保存。第一阶段已接入首页统一入口。'
                      : 'Generate drafts first, then confirm before saving. The first unified entry is live on Home.'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[var(--mf-text-muted)] shrink-0" />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Saved subjects section */}
        {savedSubjects.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Settings className="w-5 h-5 text-zinc-400" /> {t('home.saved_matches')}
            </h2>

            <div className="flex overflow-x-auto gap-3 pb-4 snap-x snap-mandatory hide-scrollbar px-1">
              {savedSubjects.map((record) => {
                const subjectDisplay = record.subjectDisplay;
                const entityDisplay = resolveHomeEntityDisplay(
                  homePresenter,
                  subjectDisplay,
                  presenterContext,
                  record.subjectSnapshot,
                );
                return (
                  <Card
                    key={record.id}
                    className="snap-center shrink-0 w-48 cursor-pointer active:scale-[0.98] transition-all border-[var(--mf-border)] bg-[var(--mf-surface-muted)] hover:bg-[var(--mf-surface)] overflow-hidden"
                    onClick={() => navigate(buildSubjectRoute(record.domainId, record.subjectId))}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-3 gap-2">
                        <span className="min-w-0 flex-1 text-[9px] text-[var(--mf-text-muted)] uppercase tracking-wider font-mono truncate">
                          {subjectDisplay.league}
                        </span>
                        <div className="shrink-0 flex items-center gap-1.5">
                          <span className="text-[9px] text-[var(--mf-text-muted)] font-mono whitespace-nowrap">
                            {new Date(record.timestamp).toLocaleDateString()}
                          </span>
                          <button
                            onClick={(e) =>
                              handleDeleteSavedSubject(e, record.id, record.subjectId, record.domainId)
                            }
                            aria-label={t('home.clear')}
                            className="h-6 w-6 inline-flex items-center justify-center rounded-full border border-white/10 bg-zinc-800/80 text-zinc-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {renderCompactEntityDisplay(entityDisplay)}

                      <div className="mt-2 pt-2 border-t border-white/5 flex justify-center">
                        <span className="text-[10px] text-emerald-500 font-mono">
                          {t(homePresenter.openActionKey)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* History Section */}
        {allRecords.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <History className={cn('w-5 h-5', homeHistoryTheme.sectionIconClassName)} />{' '}
                {t(homeHistoryTheme.sectionTitleKey)}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                  className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1 text-xs"
                >
                  <ArrowUpDown className="w-3 h-3" />
                  {sortOrder === 'newest' ? t('home.sort_newest') : t('home.sort_oldest')}
                </button>
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 text-xs ml-2"
                >
                  <Trash2 className="w-3 h-3" />
                  {t('home.clear')}
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mf-text-muted)]" />
              <input
                type="text"
                placeholder={t(homePresenter.searchPlaceholderKey)}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--mf-surface)] border border-[var(--mf-border)] rounded-lg pl-9 pr-4 py-2 text-xs text-[var(--mf-text)] focus:outline-none focus:border-[var(--mf-accent)] transition-colors"
              />
            </div>

            {filteredAndSortedHistory.length > 0 ? (
              <div className="flex overflow-x-auto gap-3 pb-4 snap-x snap-mandatory hide-scrollbar px-1">
                {filteredAndSortedHistory.map((record) => {
                  const subjectDisplay = record.subjectDisplay;
                  const entityDisplay = resolveHomeEntityDisplay(
                    homePresenter,
                    subjectDisplay,
                    presenterContext,
                    record.subjectSnapshot,
                  );
                  const outcomeDistribution = historyPresenter.getOutcomeDistribution(
                    record.analysis,
                    subjectDisplay,
                    historyPresenterContext,
                  );
                  const isActive = record.isActive;
                  const parsedStream = record.parsedStream;

                  let statusText = isActive ? t('home.analyzing') : t('home.completed');
                  if (isActive) {
                    const runtimeStatus = record.runtimeStatus;
                    const stageLabel = runtimeStatus
                      ? t(getPlannerStageI18nKey(runtimeStatus.stage))
                      : t('home.analyzing');
                    const completedFromSegments = parsedStream
                      ? parsedStream.segments.filter((s) => s.isThoughtComplete).length
                      : 0;
                    const totalFromSegments = parsedStream ? parsedStream.segments.length : 0;
                    const totalSegments = Math.max(
                      Number(record.planTotalSegments) || 0,
                      Number(runtimeStatus?.totalSegments) || 0,
                      totalFromSegments,
                    );
                    const completedSegments = Math.max(
                      Number(record.planCompletedSegments) || 0,
                      Number(runtimeStatus?.segmentIndex) || 0,
                      completedFromSegments,
                    );
                    if (totalSegments > 0) {
                      statusText = `${stageLabel} (${Math.min(completedSegments, totalSegments)}/${totalSegments})`;
                    } else {
                      statusText = stageLabel;
                    }
                  }

                  return (
                    <Card
                      key={record.id}
                      className={cn(
                        homeHistoryTheme.cardClassName,
                        isActive ? homeHistoryTheme.activeCardClassName : '',
                      )}
                      onClick={() =>
                        navigate(buildSubjectRoute(record.domainId || activeDomainId, record.subjectId))
                      }
                    >
                      <CardContent className="p-3">
                        {/* Header: League & Time */}
                        <div className="flex items-start justify-between mb-3 gap-2">
                          <span className={homeHistoryTheme.headerMetaClassName}>
                            {subjectDisplay.league}
                          </span>
                          <div className="shrink-0 flex items-center gap-1.5">
                            <span className={homeHistoryTheme.timestampClassName}>
                              {isActive && <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />}
                              {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {!isActive && (
                              <button
                                onClick={(e) =>
                                  handleDeleteRecord(e, record.id, record.subjectId, record.domainId)
                                }
                                aria-label={t('home.clear')}
                                className={homeHistoryTheme.deleteButtonClassName}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Entity Display */}
                        {renderCompactEntityDisplay(entityDisplay)}

                        {/* Footer: Status or Probability Bar */}
                        <div className={homeHistoryTheme.footerClassName}>
                          {isActive ? (
                            <div className="flex items-center justify-center">
                              <span className={homeHistoryTheme.activeStatusClassName}>
                                {statusText}
                              </span>
                            </div>
                          ) : outcomeDistribution.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              <div className={homeHistoryTheme.distributionTrackClassName}>
                                {outcomeDistribution.map((entry, index) => (
                                  <div
                                    key={entry.id}
                                    style={{
                                      width: `${entry.value}%`,
                                      backgroundColor: entry.color || summaryBarPalette[index % summaryBarPalette.length],
                                    }}
                                  />
                                ))}
                              </div>
                              <div className={homeHistoryTheme.distributionLabelClassName}>
                                {outcomeDistribution.slice(0, 3).map((entry) => (
                                  <span key={`label_${entry.id}`} className="truncate max-w-[56px]">
                                    {entry.label} {entry.value}%
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center">
                              <span className={homeHistoryTheme.completedStatusClassName}>
                                {t('home.completed')}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-500 text-xs font-mono">
                {t('home.no_records_found', { query: searchQuery })}
              </div>
            )}
          </section>
        )}

        {/* Domain Feed Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-zinc-400" />
              {t(homePresenter.sectionTitleKey)}
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-emerald-500 font-medium hidden sm:inline-block">
                {t(homePresenter.sectionHintKey)}
              </span>
              <button
                onClick={loadMatches}
                className="flex items-center gap-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-white px-2 py-1 rounded border border-white/10 transition-colors"
                disabled={isLoadingMatches}
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingMatches ? 'animate-spin' : ''}`} />
                {t(homePresenter.refreshActionKey)}
              </button>
            </div>
          </div>

          <div className="grid gap-4">
            {isLoadingMatches ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              </div>
            ) : liveMatches.length > 0 ? (
              liveMatches.map((subjectDisplay) => {
                const entityDisplay = resolveHomeEntityDisplay(
                  homePresenter,
                  subjectDisplay,
                  presenterContext,
                );
                const centerDisplay = homePresenter.getCenterDisplay(
                  subjectDisplay,
                  presenterContext,
                );
                return (
                  <Card
                    key={subjectDisplay.id}
                    className="cursor-pointer active:scale-[0.98] transition-all border-[var(--mf-border)] bg-[var(--mf-surface-muted)]"
                    onClick={() =>
                      navigate(buildSubjectRoute(activeDomainId, subjectDisplay.id), {
                        state: { importedData: subjectDisplay },
                      })
                    }
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] text-[var(--mf-text-muted)] uppercase tracking-wider font-mono">{subjectDisplay.league}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${homePresenter.getStatusClassName(subjectDisplay.status)}`}>
                          {homePresenter.getStatusLabel(subjectDisplay.status, presenterContext)}
                        </span>
                      </div>

                      {renderFeedEntityDisplay(entityDisplay, centerDisplay)}

                      <div className="mt-4 pt-3 border-t border-[var(--mf-border)] flex items-center justify-between text-[var(--mf-text-muted)]">
                        <span className="text-[10px] font-mono">
                          {t(homePresenter.openActionKey)}
                        </span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="text-center py-8 text-zinc-500 text-xs font-mono">
                {t(homePresenter.noDataKey)}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Clear History Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowClearConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-xs w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-2 text-white">{t('home.confirm_clear_history')}</h3>
              <p className="text-sm text-zinc-400 mb-6">
                {t('home.confirm_clear_history_desc')}
              </p>
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setShowClearConfirm(false)}
                >
                  {t('home.cancel')}
                </Button>
                <Button
                  variant="default"
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                  onClick={handleClearHistory}
                >
                  {t('home.confirm')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Item Confirmation Modal */}
      <AnimatePresence>
        {pendingDeleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setPendingDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-xs w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-2 text-white">{t('home.confirm_delete_item_title')}</h3>
              <p className="text-sm text-zinc-400 mb-6">
                {t('home.confirm_delete_item_desc')}
              </p>
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setPendingDeleteTarget(null)}
                >
                  {t('home.cancel')}
                </Button>
                <Button
                  variant="default"
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                  onClick={handleConfirmDeleteItem}
                >
                  {t('home.confirm_delete_item_action')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
