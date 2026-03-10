import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';
import { Match } from '@/src/data/matches';
import {
  streamAgentThoughts,
  MatchAnalysis,
  AnalysisResumeState,
  isAbortError,
  type AnalysisRunTelemetryEvent,
} from '@/src/services/ai';
import {
  saveHistory,
  clearResumeState,
} from '@/src/services/history';
import { deleteSavedSubject } from '@/src/services/savedSubjects';
import { AgentResult, AgentSegment, parseAgentStream } from '@/src/services/agentParser';
import type { AnalysisOutputBlock, AnalysisRequestPayload } from '@/src/services/ai/contracts';
import { getSettings } from '@/src/services/settings';
import {
  buildPlannerRuntimeState,
  createPlannerRunId,
  type PlannerRuntimeState,
} from '@/src/services/planner/runtime';
import { buildAnalysisOutputEnvelope } from '@/src/services/ai/multimodalCompatibility';
import { useAnalysisBackgroundNotification } from '@/src/contexts/analysis/notificationAdapter';
import { useAndroidForegroundExecution } from '@/src/contexts/analysis/androidForegroundAdapter';
import {
  bootstrapResumeState,
  createResumeSnapshotPersister,
} from '@/src/contexts/analysis/resumePersistenceAdapter';
import type { ActiveAnalysis, AnalysisRunMetrics } from '@/src/contexts/analysis/types';

export type { ActiveAnalysis };

interface AnalysisContextType {
  activeAnalyses: Record<string, ActiveAnalysis>;
  startAnalysis: (
    match: Match,
    dataToAnalyze: AnalysisRequestPayload,
    includeAnimations: boolean,
    isResume?: boolean,
  ) => void;
  stopAnalysis: (matchId: string) => void;
  clearActiveAnalysis: (matchId: string) => void;
  setCollapsedSegments: (matchId: string, segments: Record<string, boolean>) => void;
}

const STREAM_UI_UPDATE_INTERVAL_MS = 80;

function sanitizeModelLabel(provider: string, model: string): string {
  const normalizedProvider = typeof provider === 'string' ? provider.trim() : '';
  const normalizedModel = typeof model === 'string' ? model.trim() : '';
  if (normalizedProvider && normalizedModel) {
    return `${normalizedProvider}:${normalizedModel}`;
  }
  if (normalizedModel) return normalizedModel;
  if (normalizedProvider) return normalizedProvider;
  return 'unknown';
}

function combineTokenSource(
  prev: AnalysisRunMetrics['tokenSource'],
  next: AnalysisRunMetrics['tokenSource'],
): AnalysisRunMetrics['tokenSource'] {
  if (next === 'none') return prev;
  if (prev === 'none') return next;
  if (prev === next) return prev;
  return 'mixed';
}

function buildInitialRunMetrics(runId: string): AnalysisRunMetrics {
  const startedAt = Date.now();
  return {
    runId,
    startedAt,
    elapsedMs: 0,
    currentProvider: '',
    currentModel: '',
    modelsUsed: [],
    requestCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    tokenSource: 'none',
    toolCallTotal: 0,
    toolCallSuccess: 0,
    toolCallFailed: 0,
    updatedAt: startedAt,
  };
}

function applyRunTelemetryEvent(
  previous: AnalysisRunMetrics,
  event: AnalysisRunTelemetryEvent,
): AnalysisRunMetrics {
  const updatedAt = Date.now();
  const next: AnalysisRunMetrics = {
    ...previous,
    updatedAt,
  };

  const modelLabel = sanitizeModelLabel(event.provider, event.model);
  if (!next.modelsUsed.includes(modelLabel)) {
    next.modelsUsed = [...next.modelsUsed, modelLabel];
  }
  next.currentProvider = event.provider;
  next.currentModel = event.model;

  if (event.type === 'request_start') {
    next.requestCount += 1;
    return next;
  }

  if (event.type === 'request_end') {
    next.inputTokens += Math.max(0, event.inputTokens);
    next.outputTokens += Math.max(0, event.outputTokens);
    next.totalTokens += Math.max(0, event.totalTokens);
    next.tokenSource = combineTokenSource(next.tokenSource, event.tokenSource);
    return next;
  }

  if (event.type === 'tool_call') {
    next.toolCallTotal += 1;
    if (event.success) {
      next.toolCallSuccess += 1;
    } else {
      next.toolCallFailed += 1;
    }
  }

  return next;
}

function finalizeRunMetrics(metrics: AnalysisRunMetrics | null): AnalysisRunMetrics | null {
  if (!metrics) return null;
  const endedAt = Date.now();
  return {
    ...metrics,
    endedAt,
    elapsedMs: Math.max(metrics.elapsedMs, endedAt - metrics.startedAt),
    updatedAt: endedAt,
  };
}

function areTagsEqual(a: AgentSegment['tags'], b: AgentSegment['tags']): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].label !== b[i].label ||
      a[i].team !== b[i].team ||
      a[i].color !== b[i].color
    ) {
      return false;
    }
  }
  return true;
}

function stabilizeSegment(prevSeg: AgentSegment, nextSeg: AgentSegment): AgentSegment {
  const sameCore =
    prevSeg.title === nextSeg.title &&
    prevSeg.thoughts === nextSeg.thoughts &&
    prevSeg.animationJson === nextSeg.animationJson &&
    prevSeg.isThoughtComplete === nextSeg.isThoughtComplete &&
    prevSeg.isAnimationComplete === nextSeg.isAnimationComplete &&
    areTagsEqual(prevSeg.tags, nextSeg.tags);

  if (sameCore) {
    return prevSeg;
  }

  if (
    prevSeg.animation &&
    nextSeg.animation &&
    nextSeg.isAnimationComplete &&
    prevSeg.animationJson &&
    prevSeg.animationJson === nextSeg.animationJson
  ) {
    return {
      ...nextSeg,
      animation: prevSeg.animation,
    };
  }

  return nextSeg;
}

function stabilizeParsedStream(
  prevParsed: AgentResult | null,
  nextParsed: AgentResult | null,
): AgentResult | null {
  if (!nextParsed) return null;
  if (!prevParsed) return nextParsed;

  const prevSegmentsById = new Map(prevParsed.segments.map(seg => [seg.id, seg]));
  const nextSegments = nextParsed.segments.map(seg => {
    const prevSeg = prevSegmentsById.get(seg.id);
    if (!prevSeg) return seg;
    return stabilizeSegment(prevSeg, seg);
  });

  const summary =
    prevParsed.summaryJson === nextParsed.summaryJson ? prevParsed.summary : nextParsed.summary;

  const fullyStable =
    prevParsed.isComplete === nextParsed.isComplete &&
    prevParsed.summaryJson === nextParsed.summaryJson &&
    prevParsed.segments.length === nextSegments.length &&
    nextSegments.every((seg, idx) => seg === prevParsed.segments[idx]);

  if (fullyStable) {
    return prevParsed;
  }

  return {
    ...nextParsed,
    segments: nextSegments,
    summary,
  };
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [activeAnalyses, setActiveAnalyses] = useState<Record<string, ActiveAnalysis>>({});
  const analysisAbortControllersRef = useRef<Record<string, AbortController>>({});
  useAnalysisBackgroundNotification(activeAnalyses);
  useAndroidForegroundExecution(activeAnalyses);

  const createAbortError = () => {
    const err = new Error("Analysis aborted") as Error & { name: string };
    err.name = "AbortError";
    return err;
  };
  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error && typeof error.message === 'string') {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return "Analysis failed";
  };
  const updateAnalysis = useCallback((matchId: string, updates: Partial<ActiveAnalysis>) => {
    setActiveAnalyses(prev => {
      if (!prev[matchId]) return prev;
      return {
        ...prev,
        [matchId]: {
          ...prev[matchId],
          ...updates
        }
      };
    });
  }, []);

  const clearActiveAnalysis = useCallback((matchId: string) => {
    const controller = analysisAbortControllersRef.current[matchId];
    if (controller && !controller.signal.aborted) {
      controller.abort();
    }
    delete analysisAbortControllersRef.current[matchId];

    setActiveAnalyses(prev => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
  }, []);

  const stopAnalysis = useCallback((matchId: string) => {
    const controller = analysisAbortControllersRef.current[matchId];
    if (controller && !controller.signal.aborted) {
      controller.abort();
    }

    const stopNote = "\n\n[SYSTEM] Analysis stopped by user.";

    setActiveAnalyses(prev => {
      const target = prev[matchId];
      if (!target || !target.isAnalyzing) return prev;

      const nextThoughts = target.thoughts.includes(stopNote.trim())
        ? target.thoughts
        : target.thoughts + stopNote;

      return {
        ...prev,
        [matchId]: {
          ...target,
          thoughts: nextThoughts,
          isAnalyzing: false,
          error: null,
          runMetrics: finalizeRunMetrics(target.runMetrics),
          runtimeStatus: buildPlannerRuntimeState({
            stage: 'cancelled',
            runId: target.runtimeStatus?.runId || createPlannerRunId(`analysis_${matchId}`),
            segmentIndex: target.runtimeStatus?.segmentIndex ?? target.planCompletedSegments,
            totalSegments: target.runtimeStatus?.totalSegments ?? target.planTotalSegments,
            stageLabel: 'Cancelled',
            source: 'context',
            eventSeq: (target.runtimeStatus?.eventSeq ?? 0) + 1,
            stageStartedAt: target.runtimeStatus?.stageStartedAt,
          }),
        }
      };
    });
  }, []);

  const setCollapsedSegments = useCallback((matchId: string, segments: Record<string, boolean>) => {
    updateAnalysis(matchId, { collapsedSegments: segments });
  }, [updateAnalysis]);

  const startAnalysis = useCallback(async (
    match: Match,
    dataToAnalyze: AnalysisRequestPayload,
    includeAnimations: boolean,
    isResume: boolean = false,
  ) => {
    const matchId = match.id;
    const analysisDomainId =
      typeof dataToAnalyze?.sourceContext?.domainId === 'string' &&
      dataToAnalyze.sourceContext.domainId.trim().length > 0
        ? dataToAnalyze.sourceContext.domainId.trim()
        : getSettings().activeDomainId || 'football';
    const analysisSubjectType = 'match';
    const resumeOptions = {
      domainId: analysisDomainId,
      subjectId: matchId,
      subjectType: analysisSubjectType,
    };
    const previousController = analysisAbortControllersRef.current[matchId];
    if (previousController && !previousController.signal.aborted) {
      previousController.abort();
    }

    const abortController = new AbortController();
    analysisAbortControllersRef.current[matchId] = abortController;
    
    const {
      shouldResume,
      resumeStateData,
      initialThoughts,
      initialParsedStream,
      initialCollapsed,
      initialResumeState,
    } = await bootstrapResumeState({
      matchId,
      isResume,
      resumeOptions,
    });
    const initialPlanTotalSegments = initialResumeState.plan.length;
    const initialPlanCompletedSegments = initialResumeState.completedSegmentIndices.length;

    const persistedRuntimeStatus = initialResumeState.runtimeStatus
      ? buildPlannerRuntimeState({
          ...initialResumeState.runtimeStatus,
          runId:
            typeof initialResumeState.runtimeStatus.runId === 'string' &&
            initialResumeState.runtimeStatus.runId.trim().length > 0
              ? initialResumeState.runtimeStatus.runId
              : createPlannerRunId(`analysis_${matchId}`),
          segmentIndex:
            typeof initialResumeState.runtimeStatus.segmentIndex === 'number'
              ? initialResumeState.runtimeStatus.segmentIndex
              : initialPlanCompletedSegments,
          totalSegments:
            typeof initialResumeState.runtimeStatus.totalSegments === 'number'
              ? initialResumeState.runtimeStatus.totalSegments
              : initialPlanTotalSegments,
          source: initialResumeState.runtimeStatus.source || 'resume',
        })
      : null;

    const analysisRunId = persistedRuntimeStatus?.runId || createPlannerRunId(`analysis_${matchId}`);
    const initialRunMetrics = buildInitialRunMetrics(analysisRunId);
    const initialRuntimeStatus = persistedRuntimeStatus
      ? persistedRuntimeStatus
      : buildPlannerRuntimeState({
          stage: 'booting',
          runId: analysisRunId,
          segmentIndex: initialPlanCompletedSegments,
          totalSegments: initialPlanTotalSegments,
          stageLabel: 'Booting',
          source: 'context',
        });

    const newAnalysis: ActiveAnalysis = {
      matchId,
      domainId: analysisDomainId,
      subjectId: matchId,
      match,
      dataToAnalyze,
      plan: initialResumeState.plan,
      includeAnimations,
      thoughts: initialThoughts,
      parsedStream: initialParsedStream,
      collapsedSegments: initialCollapsed,
      isAnalyzing: true,
      analysis: null,
      error: null,
      planTotalSegments: initialPlanTotalSegments,
      planCompletedSegments: initialPlanCompletedSegments,
      runtimeStatus: initialRuntimeStatus,
      runMetrics: initialRunMetrics,
    };

    setActiveAnalyses(prev => ({ ...prev, [matchId]: newAnalysis }));

    const updateIfCurrentRun = (apply: (target: ActiveAnalysis) => ActiveAnalysis) => {
      setActiveAnalyses(prev => {
        const target = prev[matchId];
        if (!target) return prev;
        const targetRunId = target.runtimeStatus?.runId;
        if (
          typeof targetRunId === 'string' &&
          targetRunId.trim().length > 0 &&
          targetRunId !== analysisRunId
        ) {
          return prev;
        }
        return {
          ...prev,
          [matchId]: apply(target),
        };
      });
    };

    let currentThoughts = initialThoughts;
    let latestResumeState: AnalysisResumeState = {
      ...initialResumeState,
      runtimeStatus: initialRuntimeStatus,
    };
    let latestRuntimeStatus: PlannerRuntimeState = initialRuntimeStatus;
    let latestRunMetrics: AnalysisRunMetrics = initialRunMetrics;
    let lastUiRenderAt = 0;
    let dropStaleDraftOnFirstChunk =
      shouldResume && (!resumeStateData?.segmentResults || resumeStateData.segmentResults.length === 0);
    const baselineCompletedSegments = initialPlanCompletedSegments;
    let hasProducedNewChunks = false;
    let hasAdvancedCompletedSegments = false;
    const { persistSnapshot } = createResumeSnapshotPersister({
      matchId,
      match,
      resumeOptions,
      ownerController: abortController,
      getCurrentController: () => analysisAbortControllersRef.current[matchId],
    });

    const persistResumeSnapshot = (force: boolean = false) => {
      persistSnapshot(
        {
          latestResumeState,
          latestRuntimeStatus,
          currentThoughts,
        },
        force,
      );
    };

    const onRunTelemetry = (event: AnalysisRunTelemetryEvent) => {
      latestRunMetrics = applyRunTelemetryEvent(latestRunMetrics, event);
      updateIfCurrentRun((target) => ({
        ...target,
        runMetrics: latestRunMetrics,
      }));
    };

    const finalizeLatestRunMetrics = (): AnalysisRunMetrics => {
      const finalized = finalizeRunMetrics(latestRunMetrics);
      if (finalized) {
        latestRunMetrics = finalized;
      }
      return latestRunMetrics;
    };

    const commitLivePreview = (
      parsedStream: AgentResult | null,
      collapsedSegments: Record<string, boolean>,
      force: boolean = false,
    ) => {
      const now = Date.now();
      if (!force && now - lastUiRenderAt < STREAM_UI_UPDATE_INTERVAL_MS) {
        return;
      }
      lastUiRenderAt = now;

      updateIfCurrentRun((target) => {
        const nextParsed = stabilizeParsedStream(target.parsedStream, parsedStream);
        return {
          ...target,
          thoughts: currentThoughts,
          parsedStream: nextParsed,
          collapsedSegments,
        };
      });
    };

    try {
      let currentParsedStream = initialParsedStream;
      let currentCollapsed = initialCollapsed;
      
      const stream = streamAgentThoughts(
        dataToAnalyze, 
        includeAnimations,
        resumeStateData,
        (state) => {
          const planTotalSegments = Array.isArray(state.plan) ? state.plan.length : 0;
          const planCompletedSegments = Array.isArray(state.completedSegmentIndices)
            ? state.completedSegmentIndices.length
            : 0;
          if (planCompletedSegments > baselineCompletedSegments) {
            hasAdvancedCompletedSegments = true;
          }

          updateIfCurrentRun((target) => ({
            ...target,
            plan: Array.isArray(state.plan) ? state.plan : target.plan,
            planTotalSegments,
            planCompletedSegments,
          }));

          latestResumeState = {
            ...state,
            runtimeStatus: latestRuntimeStatus,
          };
          persistResumeSnapshot(true);
        },
        abortController.signal,
        (runtimeState) => {
          latestRuntimeStatus = runtimeState;
          latestResumeState = {
            ...latestResumeState,
            runtimeStatus: runtimeState,
          };

          updateIfCurrentRun((target) => {
            const planTotalSegments = runtimeState.totalSegments > 0
              ? Math.max(target.planTotalSegments, runtimeState.totalSegments)
              : target.planTotalSegments;
            const runtimeCompletedSegments = runtimeState.totalSegments > 0
              ? Math.min(runtimeState.totalSegments, runtimeState.segmentIndex)
              : target.planCompletedSegments;
            const planCompletedSegments = Math.max(target.planCompletedSegments, runtimeCompletedSegments);
            return {
              ...target,
              runtimeStatus: runtimeState,
              planTotalSegments,
              planCompletedSegments,
            };
          });
          persistResumeSnapshot(true);
        },
        analysisRunId,
        onRunTelemetry,
      );
      
      for await (const chunk of stream) {
        if (abortController.signal.aborted) {
          throw createAbortError();
        }
        if (dropStaleDraftOnFirstChunk) {
          // Avoid duplicated content when resuming from a draft-only snapshot.
          currentThoughts = '';
          dropStaleDraftOnFirstChunk = false;
        }
        currentThoughts += chunk;
        hasProducedNewChunks = true;
        currentParsedStream = stabilizeParsedStream(
          currentParsedStream,
          parseAgentStream(currentThoughts),
        );
        
        // Auto-collapse completed thoughts
        const newCollapsed = { ...currentCollapsed };
        currentParsedStream.segments.forEach(seg => {
          if (seg.isThoughtComplete && !newCollapsed[seg.id]) {
            newCollapsed[seg.id] = true;
          }
        });
        currentCollapsed = newCollapsed;

        commitLivePreview(currentParsedStream, currentCollapsed, false);

        persistResumeSnapshot();
      }
      if (abortController.signal.aborted) {
        throw createAbortError();
      }

      // Final parse after stream completes
      const finalParsed = stabilizeParsedStream(
        currentParsedStream,
        parseAgentStream(currentThoughts),
      );
      
      updateIfCurrentRun((target) => {
        const nextParsed = stabilizeParsedStream(target.parsedStream, finalParsed);
        return {
          ...target,
          thoughts: currentThoughts,
          parsedStream: nextParsed,
          collapsedSegments: currentCollapsed,
        };
      });

      persistResumeSnapshot(true);

      if (finalParsed.summary) {
        const finalAnalysis = finalParsed.summary as MatchAnalysis;
        const summaryLines: string[] = [];
        if (typeof finalAnalysis.prediction === 'string' && finalAnalysis.prediction.trim().length > 0) {
          summaryLines.push(finalAnalysis.prediction.trim());
        }
        if (Array.isArray(finalAnalysis.keyFactors) && finalAnalysis.keyFactors.length > 0) {
          summaryLines.push('', 'Key factors:');
          summaryLines.push(
            ...finalAnalysis.keyFactors
              .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
              .map((item) => `- ${item.trim()}`),
          );
        }
        const summaryMarkdown =
          summaryLines.join('\n').trim() ||
          (typeof finalParsed.summaryJson === 'string' ? finalParsed.summaryJson.trim() : '') ||
          currentThoughts.trim();
        const segmentBlocks: AnalysisOutputBlock[] = [];
        for (let index = 0; index < finalParsed.segments.length; index++) {
          const segment = finalParsed.segments[index];
          const content = typeof segment.thoughts === 'string' ? segment.thoughts.trim() : '';
          if (!content) {
            continue;
          }
          segmentBlocks.push({
            type: 'text',
            title:
              typeof segment.title === 'string' && segment.title.trim().length > 0
                ? segment.title.trim()
                : `Segment ${index + 1}`,
            content,
          });
        }
        const summaryBlock: AnalysisOutputBlock = {
          type: 'text',
          title: 'Summary',
          content: summaryMarkdown,
        };
        const outputBlocks: AnalysisOutputBlock[] = summaryMarkdown
          ? [summaryBlock, ...segmentBlocks]
          : segmentBlocks;
        const analysisOutputEnvelope = buildAnalysisOutputEnvelope(summaryMarkdown, outputBlocks, {
          summaryJson: finalParsed.summaryJson,
          summary: finalParsed.summary,
        });
        
        // Update match object with edited names before saving
        const finalMatch: Match & { customInfo?: unknown } = { ...match };
        if (!finalMatch.homeTeam.id) finalMatch.homeTeam.id = 'home';
        if (!finalMatch.awayTeam.id) finalMatch.awayTeam.id = 'away';
        if (dataToAnalyze.homeTeam?.name) finalMatch.homeTeam.name = dataToAnalyze.homeTeam.name;
        if (dataToAnalyze.awayTeam?.name) finalMatch.awayTeam.name = dataToAnalyze.awayTeam.name;
        if (dataToAnalyze.league) finalMatch.league = dataToAnalyze.league;
        if (dataToAnalyze.odds) finalMatch.odds = dataToAnalyze.odds;
        if (dataToAnalyze.customInfo) finalMatch.customInfo = dataToAnalyze.customInfo;
        const finalizedRunMetrics = finalizeLatestRunMetrics();
        
        updateIfCurrentRun((target) => {
          saveHistory(finalMatch, finalAnalysis, finalParsed, undefined, {
            domainId: analysisDomainId,
            subjectId: matchId,
            subjectType: analysisSubjectType,
            subjectSnapshot: finalMatch,
            analysisOutputEnvelope,
          }).catch(console.error);

          // Also try to delete from saved matches if it exists (it's now history)
          deleteSavedSubject(matchId, {
            domainId: analysisDomainId,
            subjectId: matchId,
            subjectType: analysisSubjectType,
          }).catch(() => {});

          const totalSegments = Math.max(
            target.planTotalSegments,
            target.runtimeStatus?.totalSegments ?? 0,
            target.planCompletedSegments,
          );
          const completedSegments = totalSegments > 0 ? totalSegments : target.planCompletedSegments;

          return {
            ...target,
            analysis: finalAnalysis,
            isAnalyzing: false,
            runMetrics: finalizedRunMetrics,
            planTotalSegments: totalSegments,
            planCompletedSegments: completedSegments,
            runtimeStatus: buildPlannerRuntimeState({
              stage: 'completed',
              runId: target.runtimeStatus?.runId || analysisRunId,
              segmentIndex: completedSegments,
              totalSegments,
              stageLabel: 'Completed',
              progressPercent: 100,
              source: 'context',
              eventSeq: (target.runtimeStatus?.eventSeq ?? 0) + 1,
            }),
          };
        });
        
        await clearResumeState(matchId, {
          ...resumeOptions,
        });
      } else {
        const finalizedRunMetrics = finalizeLatestRunMetrics();
        updateIfCurrentRun((target) => {
          const totalSegments = Math.max(
            target.planTotalSegments,
            target.runtimeStatus?.totalSegments ?? 0,
            target.planCompletedSegments,
          );
          const completedSegments = totalSegments > 0 ? totalSegments : target.planCompletedSegments;
          return {
            ...target,
            isAnalyzing: false,
            runMetrics: finalizedRunMetrics,
            planTotalSegments: totalSegments,
            planCompletedSegments: completedSegments,
            runtimeStatus: buildPlannerRuntimeState({
              stage: 'completed',
              runId: target.runtimeStatus?.runId || analysisRunId,
              segmentIndex: completedSegments,
              totalSegments,
              stageLabel: 'Completed',
              progressPercent: 100,
              source: 'context',
              eventSeq: (target.runtimeStatus?.eventSeq ?? 0) + 1,
            }),
          };
        });
      }

    } catch (error: unknown) {
      if (isAbortError(error) || abortController.signal.aborted) {
        const cancelledRuntimeStatus = buildPlannerRuntimeState({
          stage: 'cancelled',
          runId: latestRuntimeStatus?.runId || analysisRunId,
          segmentIndex: latestRuntimeStatus?.segmentIndex ?? latestResumeState.completedSegmentIndices.length,
          totalSegments: latestRuntimeStatus?.totalSegments ?? latestResumeState.plan.length,
          stageLabel: 'Cancelled',
          source: 'context',
          eventSeq: (latestRuntimeStatus?.eventSeq ?? 0) + 1,
          stageStartedAt: latestRuntimeStatus?.stageStartedAt,
        });
        latestRuntimeStatus = cancelledRuntimeStatus;
        latestResumeState = {
          ...latestResumeState,
          runtimeStatus: cancelledRuntimeStatus,
        };
        persistResumeSnapshot(true);
        const finalizedRunMetrics = finalizeLatestRunMetrics();
        updateIfCurrentRun((target) => ({
          ...target,
          isAnalyzing: false,
          error: null,
          runMetrics: finalizedRunMetrics,
          runtimeStatus: buildPlannerRuntimeState({
            stage: 'cancelled',
            runId: target.runtimeStatus?.runId || analysisRunId,
            segmentIndex: target.runtimeStatus?.segmentIndex ?? target.planCompletedSegments,
            totalSegments: target.runtimeStatus?.totalSegments ?? target.planTotalSegments,
            stageLabel: 'Cancelled',
            source: 'context',
            eventSeq: (target.runtimeStatus?.eventSeq ?? 0) + 1,
            stageStartedAt: target.runtimeStatus?.stageStartedAt,
          }),
        }));
        return;
      }

      const shouldFallbackToFreshRun =
        shouldResume && !hasProducedNewChunks && !hasAdvancedCompletedSegments;
      if (shouldFallbackToFreshRun) {
        console.warn('Resume snapshot is incompatible, fallback to fresh analysis run.', error);
        await clearResumeState(matchId, resumeOptions);
        const finalizedRunMetrics = finalizeLatestRunMetrics();
        updateIfCurrentRun((target) => ({
          ...target,
          thoughts: '',
          parsedStream: null,
          collapsedSegments: {},
          plan: [],
          planTotalSegments: 0,
          planCompletedSegments: 0,
          isAnalyzing: false,
          error: null,
          runMetrics: finalizedRunMetrics,
          runtimeStatus: null,
        }));
        void startAnalysis(match, dataToAnalyze, includeAnimations, false);
        return;
      }

      console.error("Analysis failed:", error);
      const errorMessage = getErrorMessage(error);
      const failedRuntimeStatus = buildPlannerRuntimeState({
        stage: 'failed',
        runId: latestRuntimeStatus?.runId || analysisRunId,
        segmentIndex: latestRuntimeStatus?.segmentIndex ?? latestResumeState.completedSegmentIndices.length,
        totalSegments: latestRuntimeStatus?.totalSegments ?? latestResumeState.plan.length,
        stageLabel: 'Failed',
        errorMessage,
        source: 'context',
        eventSeq: (latestRuntimeStatus?.eventSeq ?? 0) + 1,
        stageStartedAt: latestRuntimeStatus?.stageStartedAt,
      });
      latestRuntimeStatus = failedRuntimeStatus;
      latestResumeState = {
        ...latestResumeState,
        runtimeStatus: failedRuntimeStatus,
      };
      persistResumeSnapshot(true);
      const finalizedRunMetrics = finalizeLatestRunMetrics();
      updateIfCurrentRun((target) => ({
        ...target,
        error: errorMessage,
        isAnalyzing: false,
        runMetrics: finalizedRunMetrics,
        thoughts: target.thoughts + "\n\n[ERROR] Analysis failed. Please try again.",
        runtimeStatus: buildPlannerRuntimeState({
          stage: 'failed',
          runId: target.runtimeStatus?.runId || analysisRunId,
          segmentIndex: target.runtimeStatus?.segmentIndex ?? target.planCompletedSegments,
          totalSegments: target.runtimeStatus?.totalSegments ?? target.planTotalSegments,
          stageLabel: 'Failed',
          errorMessage,
          source: 'context',
          eventSeq: (target.runtimeStatus?.eventSeq ?? 0) + 1,
          stageStartedAt: target.runtimeStatus?.stageStartedAt,
        }),
      }));
    } finally {
      if (analysisAbortControllersRef.current[matchId] === abortController) {
        delete analysisAbortControllersRef.current[matchId];
      }
    }
  }, []);

  return (
    <AnalysisContext.Provider value={{ activeAnalyses, startAnalysis, stopAnalysis, clearActiveAnalysis, setCollapsedSegments }}>
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

