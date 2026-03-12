import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Match } from '@/src/data/matches';
import type { AnalysisRequestPayload } from '@/src/services/ai/contracts';
import { getSettings } from '@/src/services/settings';
import {
  executeAnalysisRun,
  finalizeRunMetrics,
} from '@/src/services/automation/executionRuntime';
import { useAnalysisBackgroundNotification } from '@/src/contexts/analysis/notificationAdapter';
import { useAndroidForegroundExecution } from '@/src/contexts/analysis/androidForegroundAdapter';
import {
  buildAnalysisSubjectKey,
  type ActiveAnalysis,
  type AnalysisSubjectRef,
} from '@/src/contexts/analysis/types';
import {
  buildPlannerRuntimeState,
  createPlannerRunId,
} from '@/src/services/planner/runtime';

export type { ActiveAnalysis };

interface AnalysisContextType {
  activeAnalyses: Record<string, ActiveAnalysis>;
  startAnalysis: (
    match: Match,
    dataToAnalyze: AnalysisRequestPayload,
    includeAnimations: boolean,
    isResume?: boolean,
  ) => void;
  stopAnalysis: (subjectKey: string) => void;
  clearActiveAnalysis: (subjectKey: string) => void;
  setCollapsedSegments: (subjectKey: string, segments: Record<string, boolean>) => void;
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);
const USER_STOP_NOTE = '\n\n[SYSTEM] Analysis stopped by user.';

function appendStopNote(thoughts: string): string {
  return thoughts.includes(USER_STOP_NOTE.trim()) ? thoughts : `${thoughts}${USER_STOP_NOTE}`;
}

function resolveContextSubjectRef(
  match: Match,
  dataToAnalyze: AnalysisRequestPayload,
): AnalysisSubjectRef {
  const sourceContextDomainId =
    typeof dataToAnalyze?.sourceContext?.domainId === 'string' &&
    dataToAnalyze.sourceContext.domainId.trim().length > 0
      ? dataToAnalyze.sourceContext.domainId.trim()
      : '';
  const domainId = sourceContextDomainId || getSettings().activeDomainId || 'football';
  return {
    domainId,
    subjectId: match.id,
    subjectType: 'match',
  };
}

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [activeAnalyses, setActiveAnalyses] = useState<Record<string, ActiveAnalysis>>({});
  const analysisAbortControllersRef = useRef<Record<string, AbortController>>({});
  const userStoppedRef = useRef<Record<string, boolean>>({});

  useAnalysisBackgroundNotification(activeAnalyses);
  useAndroidForegroundExecution(activeAnalyses);

  const updateAnalysis = useCallback((subjectKey: string, updates: Partial<ActiveAnalysis>) => {
    setActiveAnalyses((prev) => {
      if (!prev[subjectKey]) return prev;
      return {
        ...prev,
        [subjectKey]: {
          ...prev[subjectKey],
          ...updates,
        },
      };
    });
  }, []);

  const clearActiveAnalysis = useCallback((subjectKey: string) => {
    const controller = analysisAbortControllersRef.current[subjectKey];
    if (controller && !controller.signal.aborted) {
      controller.abort();
    }
    delete analysisAbortControllersRef.current[subjectKey];
    delete userStoppedRef.current[subjectKey];

    setActiveAnalyses((prev) => {
      const next = { ...prev };
      delete next[subjectKey];
      return next;
    });
  }, []);

  const stopAnalysis = useCallback((subjectKey: string) => {
    const controller = analysisAbortControllersRef.current[subjectKey];
    if (controller && !controller.signal.aborted) {
      userStoppedRef.current[subjectKey] = true;
      controller.abort();
    }

    setActiveAnalyses((prev) => {
      const target = prev[subjectKey];
      if (!target || !target.isAnalyzing) return prev;

      return {
        ...prev,
        [subjectKey]: {
          ...target,
          thoughts: appendStopNote(target.thoughts),
          isAnalyzing: false,
          error: null,
          runMetrics: finalizeRunMetrics(target.runMetrics),
          runtimeStatus: buildPlannerRuntimeState({
            stage: 'cancelled',
            runId: target.runtimeStatus?.runId || createPlannerRunId(`analysis_${target.subjectId}`),
            segmentIndex: target.runtimeStatus?.segmentIndex ?? target.planCompletedSegments,
            totalSegments: target.runtimeStatus?.totalSegments ?? target.planTotalSegments,
            stageLabel: 'Cancelled',
            source: 'context',
            eventSeq: (target.runtimeStatus?.eventSeq ?? 0) + 1,
            stageStartedAt: target.runtimeStatus?.stageStartedAt,
          }),
        },
      };
    });
  }, []);

  const setCollapsedSegments = useCallback((subjectKey: string, segments: Record<string, boolean>) => {
    updateAnalysis(subjectKey, { collapsedSegments: segments });
  }, [updateAnalysis]);

  const startAnalysis = useCallback((
    match: Match,
    dataToAnalyze: AnalysisRequestPayload,
    includeAnimations: boolean,
    isResume: boolean = false,
  ) => {
    const subjectRef = resolveContextSubjectRef(match, dataToAnalyze);
    const subjectKey = buildAnalysisSubjectKey(subjectRef);
    const previousController = analysisAbortControllersRef.current[subjectKey];
    if (previousController && !previousController.signal.aborted) {
      previousController.abort();
    }

    delete userStoppedRef.current[subjectKey];

    const abortController = new AbortController();
    analysisAbortControllersRef.current[subjectKey] = abortController;

    const applySnapshot = (snapshot: ActiveAnalysis) => {
      setActiveAnalyses((prev) => {
        if (analysisAbortControllersRef.current[subjectKey] !== abortController) {
          return prev;
        }

        const shouldAppendUserStopNote =
          userStoppedRef.current[subjectKey] && !snapshot.isAnalyzing;
        const nextSnapshot = shouldAppendUserStopNote
          ? {
              ...snapshot,
              thoughts: appendStopNote(snapshot.thoughts),
            }
          : snapshot;

        return {
          ...prev,
          [subjectKey]: nextSnapshot,
        };
      });

      if (userStoppedRef.current[subjectKey] && !snapshot.isAnalyzing) {
        delete userStoppedRef.current[subjectKey];
      }
    };

    void executeAnalysisRun({
      match,
      subjectSnapshot: match,
      dataToAnalyze,
      includeAnimations,
      isResume,
      abortController,
      getCurrentAbortController: () => analysisAbortControllersRef.current[subjectKey],
      onSnapshot: applySnapshot,
      runtimeSource: 'context',
      resumeMode: 'enabled',
      subjectRef,
    }).catch((error) => {
      console.error('Unexpected analysis execution failure', error);
    });
  }, []);

  return (
    <AnalysisContext.Provider
      value={{
        activeAnalyses,
        startAnalysis,
        stopAnalysis,
        clearActiveAnalysis,
        setCollapsedSegments,
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const context = useContext(AnalysisContext);
  if (context === undefined) {
    throw new Error('useAnalysis must be used within an AnalysisProvider');
  }
  return context;
}
