import React from 'react';
import type { ActiveAnalysis } from '@/src/contexts/AnalysisContext';
import { buildAnalysisSubjectKey } from '@/src/contexts/analysis/types';
import type { MatchAnalysis } from '@/src/services/ai';
import type { AgentResult } from '@/src/services/agentParser';
import type { HistoryRecord } from '@/src/services/history';
import type { PlannerRuntimeState } from '@/src/services/planner/runtime';
import type { AnalysisRunMetrics } from '@/src/contexts/analysis/types';
import type { SubjectDisplay } from '@/src/services/subjectDisplay';
import {
  fetchSubjectAnalysisConfig,
  mergeServerPlanningIntoAnalysisPayload,
  resolveSubjectAnalysisConfig,
} from '@/src/services/analysisConfig';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;
type AnalysisSubjectDisplay = SubjectDisplay;
type ContextStartAnalysis = (
  subjectDisplay: AnalysisSubjectDisplay,
  dataToAnalyze: any,
  includeAnimations: boolean,
  isResume?: boolean,
) => void;
type ContextStopAnalysis = (subjectKey: string) => void;

export type AnalysisPageStep = 'selection' | 'analyzing' | 'result';
export type MatchAnalysisStep = AnalysisPageStep;

export interface AnalysisDisplayData {
  analysis: MatchAnalysis | null;
  subjectDisplay: AnalysisSubjectDisplay;
  thoughts: string;
  parsedStream: AgentResult | null;
  collapsedSegments: Record<string, boolean>;
  isAnalyzing: boolean;
  error: string | null;
  planTotalSegments: number;
  planCompletedSegments: number;
  planSegments: any[];
  plannerDomainId: string;
  runtimeStatus: PlannerRuntimeState | null;
  runMetrics: AnalysisRunMetrics | null;
}

export type MatchDetailDisplayData = AnalysisDisplayData;

interface BuildAnalysisDisplayDataArgs {
  activeAnalysis: ActiveAnalysis | null;
  historyRecord: HistoryRecord | undefined;
  subjectDisplay: AnalysisSubjectDisplay;
  activeDomainId: string;
}

function buildParsedStreamFromHistory(historyRecord: HistoryRecord): AgentResult | null {
  if (historyRecord.parsedStream) {
    return historyRecord.parsedStream;
  }
  const blocks = historyRecord.analysisOutputEnvelope?.blocks;
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return null;
  }

  const textBlocks = blocks
    .filter((block) => block.type === 'text' && typeof block.content === 'string')
    .map((block, index) => ({
      id: `restored_seg_${index}`,
      title:
        typeof block.title === 'string' && block.title.trim().length > 0
          ? block.title.trim()
          : `Segment ${index + 1}`,
      thoughts: block.content!.trim(),
      tags: [],
      animationJson: '',
      animation: null,
      isThoughtComplete: true,
      isAnimationComplete: true,
    }))
    .filter((segment) => segment.thoughts.length > 0);

  if (textBlocks.length === 0) {
    return null;
  }

  return {
    segments: textBlocks,
    summaryJson: historyRecord.analysisOutputEnvelope?.summaryMarkdown || '',
    summary: historyRecord.analysis,
    isComplete: true,
  };
}

export function buildAnalysisDisplayData({
  activeAnalysis,
  historyRecord,
  subjectDisplay,
  activeDomainId,
}: BuildAnalysisDisplayDataArgs): AnalysisDisplayData {
  if (activeAnalysis) {
    const sourceContextDomainId =
      typeof activeAnalysis.dataToAnalyze?.sourceContext?.domainId === 'string'
        ? activeAnalysis.dataToAnalyze.sourceContext.domainId.trim()
        : '';
    return {
      analysis: activeAnalysis.analysis,
      subjectDisplay: activeAnalysis.subjectDisplay ?? activeAnalysis.match ?? subjectDisplay,
      thoughts: activeAnalysis.thoughts,
      parsedStream: activeAnalysis.parsedStream,
      collapsedSegments: activeAnalysis.collapsedSegments,
      isAnalyzing: activeAnalysis.isAnalyzing,
      error: activeAnalysis.error,
      planTotalSegments: activeAnalysis.planTotalSegments,
      planCompletedSegments: activeAnalysis.planCompletedSegments,
      planSegments: Array.isArray(activeAnalysis.plan) ? activeAnalysis.plan : [],
      plannerDomainId: sourceContextDomainId || activeDomainId,
      runtimeStatus: activeAnalysis.runtimeStatus,
      runMetrics: activeAnalysis.runMetrics,
    };
  }

  if (historyRecord) {
    const restoredParsedStream = buildParsedStreamFromHistory(historyRecord);
    const restoredSummary = historyRecord.analysisOutputEnvelope?.summaryMarkdown?.trim() || '';
    return {
      analysis: historyRecord.analysis,
      subjectDisplay: historyRecord.subjectDisplay,
      thoughts: restoredSummary
        ? `[SYSTEM] Loaded from local history cache.\n\n${restoredSummary}`
        : '[SYSTEM] Loaded from local history cache.\n\nAnalysis complete.',
      parsedStream: restoredParsedStream,
      collapsedSegments: {},
      isAnalyzing: false,
      error: null,
      planTotalSegments: 0,
      planCompletedSegments: 0,
      planSegments: [],
      plannerDomainId: activeDomainId,
      runtimeStatus: null,
      runMetrics: null,
    };
  }

  return {
    analysis: null,
    subjectDisplay,
    thoughts: '',
    parsedStream: null,
    collapsedSegments: {},
    isAnalyzing: false,
    error: null,
    planTotalSegments: 0,
    planCompletedSegments: 0,
    planSegments: [],
    plannerDomainId: activeDomainId,
    runtimeStatus: null,
    runMetrics: null,
  };
}

export const buildMatchDetailDisplayData = buildAnalysisDisplayData;

interface UseAnalysisRuntimeArgs {
  subjectDisplay: AnalysisSubjectDisplay | undefined;
  editableData: string;
  includeAnimations: boolean;
  activeDomainId: string;
  activeAnalysis: ActiveAnalysis | null;
  historyRecord?: HistoryRecord;
  startAnalysisInContext: ContextStartAnalysis;
  stopAnalysisInContext: ContextStopAnalysis;
  t: TranslateFn;
}

export function resolveAnalysisPageStep(input: {
  activeAnalysis: ActiveAnalysis | null;
  historyRecord?: HistoryRecord;
}): AnalysisPageStep {
  if (input.activeAnalysis?.isAnalyzing) {
    return 'analyzing';
  }
  if (input.activeAnalysis?.analysis || input.historyRecord) {
    return 'result';
  }
  return 'selection';
}

export const resolveMatchDetailStep = resolveAnalysisPageStep;

export function useAnalysisRuntime({
  subjectDisplay,
  editableData,
  includeAnimations,
  activeDomainId,
  activeAnalysis,
  historyRecord,
  startAnalysisInContext,
  stopAnalysisInContext,
  t,
}: UseAnalysisRuntimeArgs): {
  step: AnalysisPageStep;
  setStep: React.Dispatch<React.SetStateAction<AnalysisPageStep>>;
  startAnalysis: (isResume?: boolean) => Promise<void>;
  stopAnalysis: () => void;
  isPlannerCompact: boolean;
} {
  const [step, setStep] = React.useState<AnalysisPageStep>('selection');
  const [isPlannerCompact, setIsPlannerCompact] = React.useState(false);

  React.useEffect(() => {
    setStep(resolveAnalysisPageStep({
      activeAnalysis,
      historyRecord,
    }));
  }, [activeAnalysis, historyRecord]);

  const startAnalysis = React.useCallback(
    async (isResume: boolean = false) => {
      if (!subjectDisplay) return;
      let dataToAnalyze: any;
      try {
        dataToAnalyze = JSON.parse(editableData);
      } catch {
        alert(t('match.invalid_json_preview'));
        return;
      }

      try {
        let serverConfig = null;
        if (
          typeof subjectDisplay.id === 'string' &&
          subjectDisplay.id.trim().length > 0 &&
          !subjectDisplay.id.startsWith('custom_')
        ) {
          serverConfig = await fetchSubjectAnalysisConfig({
            domainId: activeDomainId,
            subjectId: subjectDisplay.id.trim(),
            subjectType: 'match',
          });
        }

        if (!serverConfig) {
          serverConfig = await resolveSubjectAnalysisConfig(dataToAnalyze);
        }

        dataToAnalyze = mergeServerPlanningIntoAnalysisPayload(dataToAnalyze, serverConfig);

        const currentSourceContext =
          dataToAnalyze?.sourceContext && typeof dataToAnalyze.sourceContext === 'object'
            ? dataToAnalyze.sourceContext
            : {};
        dataToAnalyze = {
          ...dataToAnalyze,
          sourceContext: {
            ...currentSourceContext,
            domainId: activeDomainId,
          },
        };
      } catch (error) {
        console.warn(
          'Failed to load server planning config; continue with local source context.',
          error,
        );
      }

      setStep('analyzing');
      startAnalysisInContext(subjectDisplay, dataToAnalyze, includeAnimations, isResume);
    },
    [
      subjectDisplay,
      editableData,
      includeAnimations,
      activeDomainId,
      startAnalysisInContext,
      t,
    ],
  );

  const stopAnalysis = React.useCallback(() => {
    if (!subjectDisplay) return;
    stopAnalysisInContext(
      buildAnalysisSubjectKey({
        domainId: activeDomainId,
        subjectId: subjectDisplay.id,
      }),
    );
  }, [activeDomainId, stopAnalysisInContext, subjectDisplay]);

  React.useEffect(() => {
    const shouldTrackPlannerScroll =
      !!activeAnalysis?.isAnalyzing && (step === 'analyzing' || step === 'result');
    if (!shouldTrackPlannerScroll) {
      setIsPlannerCompact(false);
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }

    const collapseThreshold = 120;
    const handleScroll = () => {
      const nextCompact = window.scrollY > collapseThreshold;
      setIsPlannerCompact((prev) => (prev === nextCompact ? prev : nextCompact));
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [activeAnalysis?.isAnalyzing, step]);

  return {
    step,
    setStep,
    startAnalysis,
    stopAnalysis,
    isPlannerCompact,
  };
}
