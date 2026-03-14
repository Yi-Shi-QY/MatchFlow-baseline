import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MOCK_MATCHES, Match } from '@/src/data/matches';
import { MatchAnalysis } from '@/src/services/ai';
import { Card, CardContent } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { ArrowLeft, Share2, BrainCircuit, Pause, Activity, TrendingUp, RefreshCw, LayoutTemplate, FileText, Video, Download, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { AgentResult } from '@/src/services/agentParser';
import { useAnalysis } from '@/src/contexts/AnalysisContext';
import { buildAnalysisSubjectKey } from '@/src/contexts/analysis/types';
import { compressToEncodedURIComponent } from 'lz-string';
import {
  SourceIconKey,
  SourceSelection
} from '@/src/services/dataSources';
import { getActiveAnalysisDomain, getAnalysisDomainById } from '@/src/services/domains/registry';
import { getAnalysisConclusionCards } from '@/src/services/analysisSummary';
import { findBuiltinDomainLocalSubjectSnapshotById } from '@/src/services/domains/builtinModules';
import {
  getDomainUiTheme,
  getDomainUiPresenter,
  type ResultPresenterContext,
} from '@/src/services/domains/ui/presenter';
import { exportSubjectReportPdf } from '@/src/pages/matchDetail/exportReportPdf';
import { useSubjectRecordContext } from '@/src/pages/matchDetail/useSubjectRecordContext';
import { useResumeRecoveryState } from '@/src/pages/matchDetail/useResumeRecoveryState';
import {
  buildAnalysisDisplayData,
  useAnalysisRuntime,
} from '@/src/pages/matchDetail/useAnalysisRuntime';
import { useEditableSourceForm } from '@/src/pages/matchDetail/useEditableSourceForm';
import { SourceSelectionCards } from '@/src/pages/matchDetail/SourceSelectionCards';
import { PromptPreviewPanel } from '@/src/pages/matchDetail/PromptPreviewPanel';
import { AnalysisResultPanel } from '@/src/pages/matchDetail/AnalysisResultPanel';
import type { SubjectDisplayMatch } from '@/src/services/subjectDisplayMatch';
import type { EditableSubjectDataFormModel } from '@/src/pages/matchDetail/contracts';
import { useWorkspaceNavigation } from '@/src/services/navigation/useWorkspaceNavigation';

interface ExportSegmentOption {
  includeSegment: boolean;
}

export default function MatchDetail() {
  const params = useParams();
  const routeDomainId =
    typeof params.domainId === 'string' && params.domainId.trim().length > 0
      ? decodeURIComponent(params.domainId)
      : '';
  const routeSubjectId =
    typeof params.subjectId === 'string' && params.subjectId.trim().length > 0
      ? decodeURIComponent(params.subjectId)
      : '';
  const id = routeSubjectId;
  const { navigate, goBack } = useWorkspaceNavigation();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const importedData = (location.state?.importedData ?? null) as EditableSubjectDataFormModel | null;
  const autoStartAnalysis = Boolean(location.state?.autoStartAnalysis);
  const autoStartSourceText =
    typeof location.state?.autoStartSourceText === 'string'
      ? location.state.autoStartSourceText
      : '';
  const autoStartConsumedRef = React.useRef<string>('');
  const {
    activeAnalyses,
    startAnalysis: contextStartAnalysis,
    stopAnalysis: contextStopAnalysis,
    setCollapsedSegments: contextSetCollapsedSegments
  } = useAnalysis();
  const configuredDomain = getActiveAnalysisDomain();
  const activeDomain = getAnalysisDomainById(routeDomainId) || configuredDomain;
  
  const isCustom = id === 'custom';
  const customMatch = React.useMemo(() => {
    if (importedData) {
      return {
        id: importedData.id || `custom_${Date.now()}`,
        league: importedData.league || '自定义赛事',
        date: importedData.date || new Date().toISOString().split('T')[0],
        status: importedData.status || 'upcoming',
        homeTeam: { 
          id: importedData.homeTeam?.id || 'home',
          name: importedData.homeTeam?.name || '主队', 
          logo: importedData.homeTeam?.logo || 'https://picsum.photos/seed/home/200/200', 
          form: importedData.homeTeam?.form || ['?', '?', '?', '?', '?'] 
        },
        awayTeam: { 
          id: importedData.awayTeam?.id || 'away',
          name: importedData.awayTeam?.name || '客队', 
          logo: importedData.awayTeam?.logo || 'https://picsum.photos/seed/away/200/200', 
          form: importedData.awayTeam?.form || ['?', '?', '?', '?', '?'] 
        },
        stats:
          (importedData.stats as Match['stats'] | undefined) ||
          { possession: { home: 50, away: 50 }, shots: { home: 0, away: 0 }, shotsOnTarget: { home: 0, away: 0 } },
        customInfo: importedData.customInfo
      } as Match;
    }
    return {
      id: `custom_${Date.now()}`,
      league: '自定义赛事',
      date: new Date().toISOString().split('T')[0],
      status: 'upcoming',
      homeTeam: { id: 'home', name: '主队', logo: 'https://picsum.photos/seed/home/200/200', form: ['?', '?', '?', '?', '?'] },
      awayTeam: { id: 'away', name: '客队', logo: 'https://picsum.photos/seed/away/200/200', form: ['?', '?', '?', '?', '?'] },
      stats: { possession: { home: 50, away: 50 }, shots: { home: 0, away: 0 }, shotsOnTarget: { home: 0, away: 0 } }
    } as Match;
  }, [importedData]);
  
  const {
    historyRecord,
    savedSubjectRecord,
    resumeSubjectDisplay,
    isLoadingRecordContext,
  } = useSubjectRecordContext({
    id,
    domainId: activeDomain.id,
  });

  const routeActiveAnalysis = id
    ? Object.values(activeAnalyses).find(
        (analysis) => analysis.subjectId === id && analysis.domainId === activeDomain.id,
      ) || activeAnalyses[id]
    : null;
  const routeBuiltinCase = React.useMemo<SubjectDisplayMatch | null>(() => {
    if (!id || id === 'custom') return null;
    return findBuiltinDomainLocalSubjectSnapshotById<SubjectDisplayMatch>({
      domainId: activeDomain.id,
      subjectId: id,
    });
  }, [activeDomain.id, id]);
  const match = (
    (importedData ? customMatch : null) ||
    (isCustom
      ? customMatch
      : ((routeActiveAnalysis?.match as SubjectDisplayMatch | undefined) ||
        historyRecord?.subjectDisplay ||
        savedSubjectRecord?.subjectDisplay ||
        resumeSubjectDisplay ||
        routeBuiltinCase ||
        MOCK_MATCHES.find(m => m.id === id)))
  ) as SubjectDisplayMatch | null;

  const activeAnalysis =
    routeActiveAnalysis ||
    (match
      ? activeAnalyses[
          buildAnalysisSubjectKey({
            domainId: activeDomain.id,
            subjectId: match.id,
          })
        ]
      : null);

  // Local state for UI
  const [includeAnimations, setIncludeAnimations] = useState(true);
  const [selectedSources, setSelectedSources] = useState<Partial<SourceSelection>>({});
  const domainUiPresenter = getDomainUiPresenter(activeDomain);
  const domainUiTheme = getDomainUiTheme(activeDomain);
  const resultPresenter = domainUiPresenter.result;
  const translate = React.useCallback(
    (key: string, options?: Record<string, unknown>) => String(t(key, options as never)),
    [t],
  );
  const resultPresenterContext = React.useMemo<ResultPresenterContext>(
    () => ({
      t: translate,
      language: i18n.language.startsWith('zh') ? 'zh' : 'en',
    }),
    [translate, i18n.language],
  );
  const domainSourceCatalog = activeDomain.dataSources;

  const [editableData, setEditableData] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSegments, setExportSegments] = useState<Record<string, ExportSegmentOption>>({});
  const [includeSummaryInExport, setIncludeSummaryInExport] = useState(true);
  const [segmentAnimationOverrides, setSegmentAnimationOverrides] = useState<Record<string, unknown>>({});

  const { savedResumeState, resumeStatusMeta } = useResumeRecoveryState({
    match,
    activeAnalysis,
    historyRecord,
    activeDomainId: activeDomain.id,
    language: i18n.language,
    t: translate,
  });

  const { step, setStep, startAnalysis, stopAnalysis, isPlannerCompact } = useAnalysisRuntime({
    subjectDisplay: match,
    editableData,
    includeAnimations,
    activeDomainId: activeDomain.id,
    activeAnalysis,
    historyRecord,
    startAnalysisInContext: contextStartAnalysis,
    stopAnalysisInContext: contextStopAnalysis,
    t: translate,
  });

  useEffect(() => {
    setSegmentAnimationOverrides({});
  }, [id]);

  useEffect(() => {
    setSelectedSources({});
  }, [match?.id]);

  useEffect(() => {
    if (!autoStartAnalysis || !match || !editableData.trim() || isLoadingRecordContext) {
      return;
    }
    if (step !== 'selection') {
      return;
    }

    const consumeKey = `${match.id}:${autoStartSourceText || 'auto_start'}`;
    if (autoStartConsumedRef.current === consumeKey) {
      return;
    }

    autoStartConsumedRef.current = consumeKey;
    void startAnalysis(false);
  }, [
    autoStartAnalysis,
    autoStartSourceText,
    editableData,
    isLoadingRecordContext,
    match,
    startAnalysis,
    step,
  ]);

  const resolvedSelectedSources = React.useMemo<SourceSelection>(() => {
    if (!match) {
      const emptySelection: SourceSelection = {};
      domainSourceCatalog.forEach((source) => {
        emptySelection[source.id] = false;
      });
      return emptySelection;
    }
    return activeDomain.resolveSourceSelection(
      match as SubjectDisplayMatch,
      importedData,
      selectedSources,
    );
  }, [match, importedData, selectedSources, activeDomain, domainSourceCatalog]);

  const availableSources = React.useMemo(() => {
    if (!match) return domainSourceCatalog;
    const ctx = { subjectDisplay: match as SubjectDisplayMatch, importedData };
    return activeDomain.getAvailableDataSources(ctx);
  }, [match, importedData, activeDomain, domainSourceCatalog]);

  const { showJson, setShowJson, renderHumanReadableForm } = useEditableSourceForm({
    editableData,
    setEditableData,
    step,
    subjectDisplay: match,
    importedData,
    activeDomain,
    domainSourceCatalog,
    resolvedSelectedSources,
    availableSources,
    t: translate,
  });

  const renderSourceIcon = (icon: SourceIconKey) => {
    if (icon === 'layout') return <LayoutTemplate className="w-5 h-5 text-zinc-400" />;
    if (icon === 'trending') return <TrendingUp className="w-5 h-5 text-zinc-400" />;
    return <FileText className="w-5 h-5 text-zinc-400" />;
  };

  const resolvePresenterSubjectSnapshot = (
    draftData: EditableSubjectDataFormModel | null,
  ): unknown => {
    return (
      draftData ??
      historyRecord?.subjectSnapshot ??
      savedSubjectRecord?.subjectSnapshot ??
      savedResumeState?.state?.subjectSnapshot ??
      importedData ??
      match
    );
  };

  const openExportModal = (stream: AgentResult | null, hasSummary: boolean) => {
    const segments = stream?.segments || [];
    const defaults = segments.reduce((acc, seg) => {
      acc[seg.id] = {
        includeSegment: true,
      };
      return acc;
    }, {} as Record<string, ExportSegmentOption>);

    setExportSegments(defaults);
    setIncludeSummaryInExport(hasSummary);
    setShowExportModal(true);
  };

  const handleExportPDF = async (stream: AgentResult | null, summary: MatchAnalysis | null) => {
    if (!match || isExporting) return;

    let exportDraftData: EditableSubjectDataFormModel | null = null;
    try {
      exportDraftData = editableData ? JSON.parse(editableData) : null;
    } catch (e) {
      exportDraftData = null;
    }
    const presenterSubjectSnapshot = resolvePresenterSubjectSnapshot(exportDraftData);
    const selectedSegments = (stream?.segments || []).filter(
      seg => exportSegments[seg.id]?.includeSegment
    );

    if (selectedSegments.length === 0 && !includeSummaryInExport) {
      alert(t('match.export_validation'));
      return;
    }

    setIsExporting(true);
    setShowExportModal(false);

    try {
      await exportSubjectReportPdf({
        subjectDisplay: match,
        selectedSegments,
        includeSummaryInExport,
        summary,
        draftData: exportDraftData,
        resultPresenter,
        resultPresenterContext,
        presenterSubjectSnapshot,
        language: i18n.language,
        t: translate,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error && typeof error.message === 'string'
          ? error.message
          : t('match.export_unknown_error');
      console.error('Failed to export PDF:', error);
      alert(`${t('match.export_failed')}: ${errorMessage}`);
    } finally {
      setIsExporting(false);
    }
  };

  const shareData = React.useMemo(() => {
    if (!editableData) return '';
    try {
      const data = JSON.parse(editableData);
      const jsonString = JSON.stringify({
        v: 3, // Increment version to indicate lz-string compression
        d: data
      });
      return compressToEncodedURIComponent(jsonString);
    } catch (e) {
      return '';
    }
  }, [editableData]);

  const shareUrl = `${window.location.origin}/share?d=${shareData}`;

  if (!match) {
    if (isLoadingRecordContext) {
      return (
        <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
          <span>{resultPresenter.getLoadingContextText(resultPresenterContext)}</span>
        </div>
      );
    }
    return (
      <div className="p-8 text-white text-center">
        {resultPresenter.getNotFoundText(resultPresenterContext)}
      </div>
    );
  }

  const displayData = buildAnalysisDisplayData({
    activeAnalysis,
    historyRecord,
    subjectDisplay: match,
    activeDomainId: activeDomain.id,
  });

  const {
    analysis,
    subjectDisplay: analyzedSubjectDisplay,
    thoughts,
    parsedStream,
    collapsedSegments,
    isAnalyzing,
    error,
    planTotalSegments,
    planCompletedSegments,
    planSegments,
    plannerDomainId,
    runtimeStatus,
    runMetrics,
  } = displayData;

  const retryMatchData = (() => {
    try {
      const parsed = editableData ? JSON.parse(editableData) : null;
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (e) {
      // Ignore parse failure and fallback to analyzed match object.
    }
    return analyzedSubjectDisplay;
  })();

  let editablePreviewData: EditableSubjectDataFormModel | null = null;
  try {
    editablePreviewData = editableData ? JSON.parse(editableData) : null;
  } catch (e) {
    editablePreviewData = null;
  }

  const presenterSubjectSnapshot = resolvePresenterSubjectSnapshot(editablePreviewData);
  const summaryHeader = resultPresenter.getHeader(
    match,
    editablePreviewData,
    resultPresenterContext,
    presenterSubjectSnapshot,
  );
  const summaryHero = resultPresenter.getSummaryHero(
    match,
    editablePreviewData,
    resultPresenterContext,
    presenterSubjectSnapshot,
  );
  const summaryDistribution = resultPresenter.getSummaryDistribution(
    analysis,
    match,
    editablePreviewData,
    resultPresenterContext,
    presenterSubjectSnapshot,
  );
  const summaryCards = getAnalysisConclusionCards(analysis);
  const summaryTheme = domainUiTheme.result.summary;
  const summaryBarPalette = summaryTheme.barPalette;
  const summaryIsZh = i18n.language.startsWith('zh');
  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans flex flex-col pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {/* Mobile App Header */}
      <header className="sticky top-0 z-20 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void goBack('/')}
            className="h-8 w-8 rounded-full bg-zinc-900 border border-white/10"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-500 uppercase font-mono">
              {summaryHeader.subtitle}
            </span>
            <h1 className="text-sm font-bold tracking-tight text-white line-clamp-1">
              {summaryHeader.title}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAnalyzing && (
            <Button
              variant="outline"
              size="icon"
              onClick={stopAnalysis}
              title={t('match.stop_analysis')}
              aria-label={t('match.stop_analysis')}
              className="h-8 w-8 rounded-full border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Pause className="w-4 h-4" />
            </Button>
          )}
          {step === 'result' && (
            <>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => openExportModal(parsedStream, !!analysis)}
                disabled={isExporting}
                className="h-8 w-8 rounded-full border-blue-500/50 text-blue-400 hover:bg-blue-500/10 transition-colors"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setStep('selection')}
                className="h-8 w-8 rounded-full border-zinc-500/50 text-zinc-400 hover:bg-zinc-800 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </>
          )}
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setShowShare(true)}
            disabled={!editableData}
            className="h-8 w-8 rounded-full border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {step === 'selection' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 flex flex-col gap-4 p-4 max-w-md mx-auto w-full"
        >
          <h2 className="text-lg font-bold text-white mb-2">{t('match.select_sources')}</h2>
          
          <SourceSelectionCards
            availableSources={availableSources}
            resolvedSelectedSources={resolvedSelectedSources}
            onToggleSource={(sourceId) =>
              setSelectedSources((prev) => ({
                ...prev,
                [sourceId]: !resolvedSelectedSources[sourceId],
              }))
            }
            renderSourceIcon={renderSourceIcon}
            t={translate}
          />

          <PromptPreviewPanel
            isPreviewExpanded={isPreviewExpanded}
            onTogglePreview={() => setIsPreviewExpanded(!isPreviewExpanded)}
            showJson={showJson}
            onToggleJson={() => setShowJson(!showJson)}
            editableData={editableData}
            onChangeEditableData={setEditableData}
            renderHumanReadableForm={renderHumanReadableForm}
            t={translate}
          />

          <div className="flex items-center gap-3 mt-4 px-1">
            <div 
              className={`w-9 h-5 rounded-full flex items-center transition-colors p-1 cursor-pointer ${includeAnimations ? 'bg-emerald-500' : 'bg-zinc-700'}`}
              onClick={() => setIncludeAnimations(!includeAnimations)}
            >
              <motion.div 
                className="bg-white w-3 h-3 rounded-full shadow-sm"
                animate={{ x: includeAnimations ? 16 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </div>
            <label 
              className="text-xs text-zinc-400 select-none cursor-pointer flex items-center gap-2"
              onClick={() => setIncludeAnimations(!includeAnimations)}
            >
              <Video className="w-3 h-3" /> {t('match.generate_animation')}
            </label>
          </div>

          <div className="flex flex-col gap-2 mt-4">
            {savedResumeState && (
              <>
                {resumeStatusMeta && (
                  <Card className="border-blue-500/30 bg-blue-500/5">
                    <CardContent className="p-3">
                      <div className="text-[10px] uppercase tracking-wider text-blue-300 mb-2">
                        {t('match.resume_checkpoint')}
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                        <span className="text-zinc-400">{t('match.resume_stage')}</span>
                        <span className="text-blue-100">{resumeStatusMeta.stageLabel}</span>
                        <span className="text-zinc-400">{t('match.resume_progress')}</span>
                        <span className="text-blue-100">
                          {resumeStatusMeta.completedSegments}/{resumeStatusMeta.totalSegments} ({resumeStatusMeta.progressPercent}%)
                        </span>
                        <span className="text-zinc-400">{t('match.resume_last_saved')}</span>
                        <span className="text-blue-100">{resumeStatusMeta.lastSaved}</span>
                      </div>
                      {resumeStatusMeta.activeSegmentTitle && (
                        <div className="mt-2 text-[11px] text-zinc-300">
                          {t('match.resume_segment')}: {resumeStatusMeta.activeSegmentTitle}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
                <Button
                  className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => startAnalysis(true)}
                >
                  <Activity className="w-4 h-4" /> {t('match.continue_unfinished')}
                </Button>
              </>
            )}
            <Button 
              className="w-full gap-2"
              variant={savedResumeState ? "outline" : "default"}
              onClick={() => startAnalysis(false)}
            >
              <BrainCircuit className="w-4 h-4" /> {savedResumeState ? t('match.restart_analysis') : t('match.start_analysis')}
            </Button>
          </div>
        </motion.div>
      )}

      {(step === 'analyzing' || step === 'result') && (
        <AnalysisResultPanel
          isAnalyzing={isAnalyzing}
          plannerDomainId={plannerDomainId}
          planSegments={planSegments}
          runtimeStatus={runtimeStatus}
          runMetrics={runMetrics}
          planTotalSegments={planTotalSegments}
          planCompletedSegments={planCompletedSegments}
          parsedStream={parsedStream}
          language={i18n.language}
          isPlannerCompact={isPlannerCompact}
          collapsedSegments={collapsedSegments}
          onToggleCollapsedSegment={(segmentId, nextCollapsed) =>
            contextSetCollapsedSegments(
              buildAnalysisSubjectKey({
                domainId: activeDomain.id,
                subjectId: match.id,
              }),
              {
                ...collapsedSegments,
                [segmentId]: nextCollapsed,
              },
            )
          }
          retryMatchData={retryMatchData}
          segmentAnimationOverrides={segmentAnimationOverrides}
          onAnimationRepaired={(segmentId, nextAnimation) =>
            setSegmentAnimationOverrides((prev) => ({
              ...prev,
              [segmentId]: nextAnimation,
            }))
          }
          analysis={analysis}
          summaryHero={summaryHero}
          summaryDistribution={summaryDistribution}
          summaryCards={summaryCards}
          summaryTheme={summaryTheme}
          summaryBarPalette={summaryBarPalette}
          summaryIsZh={summaryIsZh}
          thoughts={thoughts}
          t={translate}
        />
      )}

      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowExportModal(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 14 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 14 }}
              className="bg-zinc-900 border border-white/10 rounded-2xl p-5 max-w-md w-full shadow-2xl max-h-[80vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-base font-bold text-white mb-1">{t('match.export_modal_title')}</h3>
              <p className="text-[11px] text-zinc-500 mb-4">
                {t('match.export_modal_desc')}
              </p>

              <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                {(parsedStream?.segments || []).map((seg, index) => {
                  const selected = exportSegments[seg.id];
                  return (
                    <div key={seg.id} className="border border-white/10 rounded-xl p-3 bg-black/30">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!selected?.includeSegment}
                          onChange={(e) =>
                            setExportSegments(prev => ({
                              ...prev,
                              [seg.id]: {
                                includeSegment: e.target.checked,
                              },
                            }))
                          }
                          className="mt-0.5"
                        />
                        <div className="min-w-0">
                          <div className="text-xs text-zinc-300 font-medium line-clamp-1">
                            {index + 1}. {seg.title || t('match.export_segment_fallback', { index: index + 1 })}
                          </div>
                          <div className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">
                            {(seg.thoughts || '').replace(/\s+/g, ' ').slice(0, 90) || t('match.export_segment_empty')}
                          </div>
                        </div>
                      </label>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSummaryInExport}
                    onChange={(e) => setIncludeSummaryInExport(e.target.checked)}
                  />
                  {t('match.export_include_summary')}
                </label>
                <div className="text-[11px] text-zinc-500">
                  {t('match.export_disclaimer_forced')}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                  onClick={() => setShowExportModal(false)}
                  disabled={isExporting}
                >
                  {t('home.cancel')}
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={() => handleExportPDF(parsedStream, analysis)}
                  disabled={isExporting}
                >
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {t('match.export_share')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {showShare && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowShare(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-xs w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-4 text-center text-white">{t('match.share_config')}</h3>
              <div className="bg-white p-4 rounded-xl flex items-center justify-center mb-4">
                <QRCodeSVG value={shareUrl} size={180} />
              </div>
              <p className="text-xs text-zinc-400 text-center mb-6 font-mono">
                {t('match.scan_to_import')}
              </p>
              <Button className="w-full" onClick={() => setShowShare(false)}>
                {t('match.close')}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
