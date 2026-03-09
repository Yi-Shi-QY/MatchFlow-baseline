import React from 'react';
import type { Match } from '@/src/data/matches';
import type { ActiveAnalysis } from '@/src/contexts/AnalysisContext';
import type { MatchAnalysis } from '@/src/services/ai';
import type { AgentResult } from '@/src/services/agentParser';
import type { HistoryRecord } from '@/src/services/history';
import type { PlannerRuntimeState } from '@/src/services/planner/runtime';
import {
  fetchMatchAnalysisConfig,
  mergeServerPlanningIntoMatchData,
  resolveAnalysisConfig,
} from '@/src/services/analysisConfig';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;
type ContextStartAnalysis = (
  match: Match,
  dataToAnalyze: any,
  includeAnimations: boolean,
  isResume?: boolean,
) => void;
type ContextStopAnalysis = (matchId: string) => void;

export type MatchAnalysisStep = 'selection' | 'analyzing' | 'result';

export interface MatchDetailDisplayData {
  analysis: MatchAnalysis | null;
  analyzedMatch: Match;
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
}

interface BuildMatchDetailDisplayDataArgs {
  activeAnalysis: ActiveAnalysis | null;
  historyRecord: HistoryRecord | undefined;
  match: Match;
  activeDomainId: string;
}

export function buildMatchDetailDisplayData({
  activeAnalysis,
  historyRecord,
  match,
  activeDomainId,
}: BuildMatchDetailDisplayDataArgs): MatchDetailDisplayData {
  if (activeAnalysis) {
    const sourceContextDomainId =
      typeof activeAnalysis.dataToAnalyze?.sourceContext?.domainId === 'string'
        ? activeAnalysis.dataToAnalyze.sourceContext.domainId.trim()
        : '';
    return {
      analysis: activeAnalysis.analysis,
      analyzedMatch: match,
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
    };
  }

  if (historyRecord) {
    return {
      analysis: historyRecord.analysis,
      analyzedMatch: historyRecord.match,
      thoughts: '[SYSTEM] Loaded from local history cache.\n\nAnalysis complete.',
      parsedStream: historyRecord.parsedStream || null,
      collapsedSegments: {},
      isAnalyzing: false,
      error: null,
      planTotalSegments: 0,
      planCompletedSegments: 0,
      planSegments: [],
      plannerDomainId: activeDomainId,
      runtimeStatus: null,
    };
  }

  return {
    analysis: null,
    analyzedMatch: match,
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
  };
}

interface UseAnalysisRuntimeArgs {
  match: Match | undefined;
  editableData: string;
  includeAnimations: boolean;
  activeDomainId: string;
  activeAnalysis: ActiveAnalysis | null;
  startAnalysisInContext: ContextStartAnalysis;
  stopAnalysisInContext: ContextStopAnalysis;
  t: TranslateFn;
}

export function useAnalysisRuntime({
  match,
  editableData,
  includeAnimations,
  activeDomainId,
  activeAnalysis,
  startAnalysisInContext,
  stopAnalysisInContext,
  t,
}: UseAnalysisRuntimeArgs): {
  step: MatchAnalysisStep;
  setStep: React.Dispatch<React.SetStateAction<MatchAnalysisStep>>;
  startAnalysis: (isResume?: boolean) => Promise<void>;
  stopAnalysis: () => void;
  isPlannerCompact: boolean;
} {
  const [step, setStep] = React.useState<MatchAnalysisStep>('selection');
  const [isPlannerCompact, setIsPlannerCompact] = React.useState(false);

  React.useEffect(() => {
    if (!activeAnalysis) return;
    if (activeAnalysis.isAnalyzing) {
      setStep('analyzing');
      return;
    }
    if (activeAnalysis.analysis) {
      setStep('result');
      return;
    }
    setStep('selection');
  }, [activeAnalysis]);

  const startAnalysis = React.useCallback(
    async (isResume: boolean = false) => {
      if (!match) return;
      let dataToAnalyze: any;
      try {
        dataToAnalyze = JSON.parse(editableData);
      } catch (e) {
        alert(t('match.invalid_json_preview'));
        return;
      }

      try {
        let serverConfig = null;
        if (
          typeof match.id === 'string' &&
          match.id.trim().length > 0 &&
          !match.id.startsWith('custom_')
        ) {
          serverConfig = await fetchMatchAnalysisConfig(match.id.trim());
        }

        if (!serverConfig) {
          serverConfig = await resolveAnalysisConfig(dataToAnalyze);
        }

        dataToAnalyze = mergeServerPlanningIntoMatchData(dataToAnalyze, serverConfig);

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
      startAnalysisInContext(match, dataToAnalyze, includeAnimations, isResume);
    },
    [
      match,
      editableData,
      includeAnimations,
      activeDomainId,
      startAnalysisInContext,
      t,
    ],
  );

  const stopAnalysis = React.useCallback(() => {
    if (!match) return;
    stopAnalysisInContext(match.id);
  }, [match, stopAnalysisInContext]);

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
