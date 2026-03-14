import {
  streamAgentThoughts,
  type MatchAnalysis,
  type AnalysisResumeState,
  isAbortError,
  type AnalysisRunTelemetryEvent,
} from '@/src/services/ai';
import {
  saveHistory,
  clearResumeState,
} from '@/src/services/history';
import { deleteSavedSubject } from '@/src/services/savedSubjects';
import {
  parseAgentStream,
  type AgentResult,
  type AgentSegment,
} from '@/src/services/agentParser';
import type {
  AnalysisOutputBlock,
  AnalysisOutputEnvelope,
  AnalysisRequestPayload,
} from '@/src/services/ai/contracts';
import { DEFAULT_DOMAIN_ID } from '@/src/services/domains/builtinModules';
import { getSettings } from '@/src/services/settings';
import {
  buildPlannerRuntimeState,
  createPlannerRunId,
  type PlannerRuntimeSource,
  type PlannerRuntimeState,
} from '@/src/services/planner/runtime';
import type { SubjectDisplay } from '@/src/services/subjectDisplay';
import type { SubjectDisplayMatch } from '@/src/services/subjectDisplayMatch';
import { buildAnalysisOutputEnvelope } from '@/src/services/ai/multimodalCompatibility';
import {
  bootstrapResumeState,
  createResumeSnapshotPersister,
  type AnalysisResumeOptions,
} from '@/src/contexts/analysis/resumePersistenceAdapter';
import type {
  ActiveAnalysis,
  AnalysisRunMetrics,
  AnalysisSubjectRef,
} from '@/src/contexts/analysis/types';

const STREAM_UI_UPDATE_INTERVAL_MS = 80;

export interface AnalysisExecutionSubjectRef extends AnalysisSubjectRef {}

export interface ExecuteAnalysisRunArgs {
  subjectDisplay?: SubjectDisplay;
  match?: SubjectDisplay;
  subjectSnapshot?: unknown;
  dataToAnalyze: AnalysisRequestPayload;
  includeAnimations: boolean;
  isResume?: boolean;
  abortController?: AbortController;
  getCurrentAbortController?: () => AbortController | undefined;
  onSnapshot?: (snapshot: ActiveAnalysis) => void;
  runtimeSource?: PlannerRuntimeSource;
  resumeMode?: 'enabled' | 'disabled';
  subjectRef?: Partial<AnalysisExecutionSubjectRef>;
}

export interface AnalysisExecutionResult {
  status: 'completed' | 'cancelled' | 'failed';
  snapshot: ActiveAnalysis;
  historyId?: string | null;
  analysisOutputEnvelope?: AnalysisOutputEnvelope;
  errorMessage?: string | null;
}

interface ResumeBootstrapState {
  shouldResume: boolean;
  resumeStateData: AnalysisResumeState | undefined;
  initialThoughts: string;
  initialParsedStream: AgentResult | null;
  initialCollapsed: Record<string, boolean>;
  initialResumeState: AnalysisResumeState;
}

interface AnalysisAttemptRuntimeContext {
  subjectRef: AnalysisExecutionSubjectRef;
  abortController: AbortController;
  getCurrentAbortController: () => AbortController | undefined;
  runtimeSource: PlannerRuntimeSource;
  resumeMode: 'enabled' | 'disabled';
  onSnapshot?: (snapshot: ActiveAnalysis) => void;
}

interface RestartFreshResult {
  status: 'restart_fresh';
  snapshot: ActiveAnalysis;
}

type AnalysisAttemptResult = AnalysisExecutionResult | RestartFreshResult;

function createEmptyResumeState(): AnalysisResumeState {
  return {
    plan: [],
    completedSegmentIndices: [],
    fullAnalysisText: '',
    segmentResults: [],
    runtimeStatus: undefined,
    subjectSnapshot: undefined,
    subjectDisplaySnapshot: undefined,
  };
}

function createDisabledResumeBootstrapState(): ResumeBootstrapState {
  return {
    shouldResume: false,
    resumeStateData: undefined,
    initialThoughts: '',
    initialParsedStream: null,
    initialCollapsed: {},
    initialResumeState: createEmptyResumeState(),
  };
}

function getExecutionErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === 'string') {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Analysis failed';
}

function createAbortError(): Error & { name: string } {
  const error = new Error('Analysis aborted') as Error & { name: string };
  error.name = 'AbortError';
  return error;
}

function resolveExecutionSubjectDisplay(args: ExecuteAnalysisRunArgs): SubjectDisplay {
  const subjectDisplay = args.subjectDisplay ?? args.match;
  if (subjectDisplay) {
    return subjectDisplay;
  }

  throw new Error('Analysis execution requires a subject display snapshot.');
}

function resolveSubjectRef(
  subjectDisplay: SubjectDisplay,
  dataToAnalyze: AnalysisRequestPayload,
  input?: Partial<AnalysisExecutionSubjectRef>,
): AnalysisExecutionSubjectRef {
  const sourceContextDomainId =
    typeof dataToAnalyze?.sourceContext?.domainId === 'string' &&
    dataToAnalyze.sourceContext.domainId.trim().length > 0
      ? dataToAnalyze.sourceContext.domainId.trim()
      : '';
  const explicitDomainId =
    typeof input?.domainId === 'string' && input.domainId.trim().length > 0
      ? input.domainId.trim()
      : '';
  const domainId =
    explicitDomainId || sourceContextDomainId || getSettings().activeDomainId || DEFAULT_DOMAIN_ID;
  const subjectId =
    typeof input?.subjectId === 'string' && input.subjectId.trim().length > 0
      ? input.subjectId.trim()
      : subjectDisplay.id;
  const subjectType =
    typeof input?.subjectType === 'string' && input.subjectType.trim().length > 0
      ? input.subjectType.trim()
      : 'match';

  return {
    domainId,
    subjectId,
    subjectType,
  };
}

export function sanitizeModelLabel(provider: string, model: string): string {
  const normalizedProvider = typeof provider === 'string' ? provider.trim() : '';
  const normalizedModel = typeof model === 'string' ? model.trim() : '';
  if (normalizedProvider && normalizedModel) {
    return `${normalizedProvider}:${normalizedModel}`;
  }
  if (normalizedModel) return normalizedModel;
  if (normalizedProvider) return normalizedProvider;
  return 'unknown';
}

export function combineTokenSource(
  prev: AnalysisRunMetrics['tokenSource'],
  next: AnalysisRunMetrics['tokenSource'],
): AnalysisRunMetrics['tokenSource'] {
  if (next === 'none') return prev;
  if (prev === 'none') return next;
  if (prev === next) return prev;
  return 'mixed';
}

export function buildInitialRunMetrics(runId: string): AnalysisRunMetrics {
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

export function applyRunTelemetryEvent(
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

export function finalizeRunMetrics(metrics: AnalysisRunMetrics | null): AnalysisRunMetrics | null {
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
  for (let index = 0; index < a.length; index += 1) {
    if (
      a[index].label !== b[index].label ||
      a[index].team !== b[index].team ||
      a[index].color !== b[index].color
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

export function stabilizeParsedStream(
  prevParsed: AgentResult | null,
  nextParsed: AgentResult | null,
): AgentResult | null {
  if (!nextParsed) return null;
  if (!prevParsed) return nextParsed;

  const prevSegmentsById = new Map(prevParsed.segments.map((segment) => [segment.id, segment]));
  const nextSegments = nextParsed.segments.map((segment) => {
    const previous = prevSegmentsById.get(segment.id);
    if (!previous) return segment;
    return stabilizeSegment(previous, segment);
  });

  const summary =
    prevParsed.summaryJson === nextParsed.summaryJson ? prevParsed.summary : nextParsed.summary;

  const fullyStable =
    prevParsed.isComplete === nextParsed.isComplete &&
    prevParsed.summaryJson === nextParsed.summaryJson &&
    prevParsed.segments.length === nextSegments.length &&
    nextSegments.every((segment, index) => segment === prevParsed.segments[index]);

  if (fullyStable) {
    return prevParsed;
  }

  return {
    ...nextParsed,
    segments: nextSegments,
    summary,
  };
}

function createActiveAnalysisSnapshot(args: {
  subjectRef: AnalysisExecutionSubjectRef;
  subjectSnapshot: unknown;
  subjectDisplay: SubjectDisplay;
  dataToAnalyze: AnalysisRequestPayload;
  includeAnimations: boolean;
  thoughts: string;
  parsedStream: AgentResult | null;
  collapsedSegments: Record<string, boolean>;
  resumeState: AnalysisResumeState;
  runtimeStatus: PlannerRuntimeState | null;
  runMetrics: AnalysisRunMetrics | null;
}): ActiveAnalysis {
  return {
    subjectRef: args.subjectRef,
    domainId: args.subjectRef.domainId,
    subjectId: args.subjectRef.subjectId,
    subjectType: args.subjectRef.subjectType,
    subjectSnapshot: args.subjectSnapshot,
    subjectDisplay: args.subjectDisplay,
    match: args.subjectDisplay,
    dataToAnalyze: args.dataToAnalyze,
    plan: args.resumeState.plan,
    includeAnimations: args.includeAnimations,
    thoughts: args.thoughts,
    parsedStream: args.parsedStream,
    collapsedSegments: args.collapsedSegments,
    isAnalyzing: true,
    analysis: null,
    error: null,
    planTotalSegments: args.resumeState.plan.length,
    planCompletedSegments: args.resumeState.completedSegmentIndices.length,
    runtimeStatus: args.runtimeStatus,
    runMetrics: args.runMetrics,
  };
}

function buildCompletedRuntimeStatus(
  snapshot: ActiveAnalysis,
  runId: string,
  runtimeSource: PlannerRuntimeSource,
): PlannerRuntimeState {
  const totalSegments = Math.max(
    snapshot.planTotalSegments,
    snapshot.runtimeStatus?.totalSegments ?? 0,
    snapshot.planCompletedSegments,
  );
  const completedSegments = totalSegments > 0 ? totalSegments : snapshot.planCompletedSegments;
  return buildPlannerRuntimeState({
    stage: 'completed',
    runId,
    segmentIndex: completedSegments,
    totalSegments,
    stageLabel: 'Completed',
    progressPercent: 100,
    source: runtimeSource,
    eventSeq: (snapshot.runtimeStatus?.eventSeq ?? 0) + 1,
  });
}

async function runSingleAnalysisAttempt(
  args: ExecuteAnalysisRunArgs,
  runtime: AnalysisAttemptRuntimeContext,
): Promise<AnalysisAttemptResult> {
  const subjectDisplay = resolveExecutionSubjectDisplay(args);
  const { dataToAnalyze, includeAnimations } = args;
  const { subjectRef, abortController, getCurrentAbortController, runtimeSource, resumeMode, onSnapshot } = runtime;

  const resumeOptions: AnalysisResumeOptions = {
    domainId: subjectRef.domainId,
    subjectId: subjectRef.subjectId,
    subjectType: subjectRef.subjectType,
  };

  const resumeBootstrap =
    resumeMode === 'enabled'
      ? await bootstrapResumeState({
          subjectId: subjectRef.subjectId,
          isResume: Boolean(args.isResume),
          resumeOptions,
        })
      : createDisabledResumeBootstrapState();

  const {
    shouldResume,
    resumeStateData,
    initialThoughts,
    initialParsedStream,
    initialCollapsed,
    initialResumeState,
  } = resumeBootstrap;
  const initialPlanTotalSegments = initialResumeState.plan.length;
  const initialPlanCompletedSegments = initialResumeState.completedSegmentIndices.length;

  const persistedRuntimeStatus = initialResumeState.runtimeStatus
    ? buildPlannerRuntimeState({
        ...initialResumeState.runtimeStatus,
        runId:
          typeof initialResumeState.runtimeStatus.runId === 'string' &&
          initialResumeState.runtimeStatus.runId.trim().length > 0
            ? initialResumeState.runtimeStatus.runId
            : createPlannerRunId(`analysis_${subjectRef.subjectId}`),
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

  const analysisRunId =
    persistedRuntimeStatus?.runId || createPlannerRunId(`analysis_${subjectRef.subjectId}`);
  const initialRunMetrics = buildInitialRunMetrics(analysisRunId);
  const initialRuntimeStatus = persistedRuntimeStatus
    ? persistedRuntimeStatus
    : buildPlannerRuntimeState({
        stage: 'booting',
        runId: analysisRunId,
        segmentIndex: initialPlanCompletedSegments,
        totalSegments: initialPlanTotalSegments,
        stageLabel: 'Booting',
        source: runtimeSource,
      });
  const resolvedSubjectSnapshot =
    initialResumeState.subjectSnapshot ?? args.subjectSnapshot ?? subjectDisplay;

  let snapshot = createActiveAnalysisSnapshot({
    subjectRef,
    subjectSnapshot: resolvedSubjectSnapshot,
    subjectDisplay,
    dataToAnalyze,
    includeAnimations,
    thoughts: initialThoughts,
    parsedStream: initialParsedStream,
    collapsedSegments: initialCollapsed,
    resumeState: initialResumeState,
    runtimeStatus: initialRuntimeStatus,
    runMetrics: initialRunMetrics,
  });
  onSnapshot?.(snapshot);

  const updateSnapshot = (apply: (current: ActiveAnalysis) => ActiveAnalysis) => {
    snapshot = apply(snapshot);
    onSnapshot?.(snapshot);
  };

  let currentThoughts = initialThoughts;
  let latestResumeState: AnalysisResumeState = {
    ...initialResumeState,
    subjectSnapshot: resolvedSubjectSnapshot,
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

  const resumePersister =
    resumeMode === 'enabled'
      ? createResumeSnapshotPersister({
          subjectId: subjectRef.subjectId,
          subjectSnapshot: resolvedSubjectSnapshot,
          subjectDisplayProjection:
            subjectRef.subjectType === 'match'
              ? (subjectDisplay as SubjectDisplayMatch)
              : undefined,
          resumeOptions,
          ownerController: abortController,
          getCurrentController: getCurrentAbortController,
        })
      : null;

  const persistResumeSnapshot = (force: boolean = false) => {
    if (!resumePersister) {
      return;
    }

    resumePersister.persistSnapshot(
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
    updateSnapshot((current) => ({
      ...current,
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

    updateSnapshot((current) => ({
      ...current,
      thoughts: currentThoughts,
      parsedStream: stabilizeParsedStream(current.parsedStream, parsedStream),
      collapsedSegments,
    }));
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

        updateSnapshot((current) => ({
          ...current,
          plan: Array.isArray(state.plan) ? state.plan : current.plan,
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

        updateSnapshot((current) => {
          const planTotalSegments =
            runtimeState.totalSegments > 0
              ? Math.max(current.planTotalSegments, runtimeState.totalSegments)
              : current.planTotalSegments;
          const runtimeCompletedSegments =
            runtimeState.totalSegments > 0
              ? Math.min(runtimeState.totalSegments, runtimeState.segmentIndex)
              : current.planCompletedSegments;
          const planCompletedSegments = Math.max(current.planCompletedSegments, runtimeCompletedSegments);
          return {
            ...current,
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
        currentThoughts = '';
        dropStaleDraftOnFirstChunk = false;
      }
      currentThoughts += chunk;
      hasProducedNewChunks = true;
      currentParsedStream = stabilizeParsedStream(
        currentParsedStream,
        parseAgentStream(currentThoughts),
      );

      const nextCollapsed = { ...currentCollapsed };
      currentParsedStream.segments.forEach((segment) => {
        if (segment.isThoughtComplete && !nextCollapsed[segment.id]) {
          nextCollapsed[segment.id] = true;
        }
      });
      currentCollapsed = nextCollapsed;

      commitLivePreview(currentParsedStream, currentCollapsed, false);
      persistResumeSnapshot();
    }
    if (abortController.signal.aborted) {
      throw createAbortError();
    }

    const finalParsed = stabilizeParsedStream(
      currentParsedStream,
      parseAgentStream(currentThoughts),
    );

    updateSnapshot((current) => ({
      ...current,
      thoughts: currentThoughts,
      parsedStream: stabilizeParsedStream(current.parsedStream, finalParsed),
      collapsedSegments: currentCollapsed,
    }));

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
      for (let index = 0; index < finalParsed.segments.length; index += 1) {
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

      const finalSubjectDisplay: SubjectDisplayMatch & { customInfo?: unknown } = {
        ...(subjectDisplay as SubjectDisplayMatch),
      };
      if (!finalSubjectDisplay.homeTeam.id) finalSubjectDisplay.homeTeam.id = 'home';
      if (!finalSubjectDisplay.awayTeam.id) finalSubjectDisplay.awayTeam.id = 'away';
      if (dataToAnalyze.homeTeam?.name) finalSubjectDisplay.homeTeam.name = dataToAnalyze.homeTeam.name;
      if (dataToAnalyze.awayTeam?.name) finalSubjectDisplay.awayTeam.name = dataToAnalyze.awayTeam.name;
      if (dataToAnalyze.league) finalSubjectDisplay.league = dataToAnalyze.league;
      if (dataToAnalyze.odds) {
        finalSubjectDisplay.odds = dataToAnalyze.odds as SubjectDisplay['odds'];
      }
      if (dataToAnalyze.customInfo) finalSubjectDisplay.customInfo = dataToAnalyze.customInfo;

      const historyId = await saveHistory({
        domainId: subjectRef.domainId,
        subjectId: subjectRef.subjectId,
        subjectType: subjectRef.subjectType,
        subjectSnapshot:
          subjectRef.subjectType === 'match'
            ? finalSubjectDisplay
            : (snapshot.subjectSnapshot ?? resolvedSubjectSnapshot),
        subjectDisplay: finalSubjectDisplay,
        analysis: finalAnalysis,
        parsedStream: finalParsed,
        analysisOutputEnvelope,
      });

      await deleteSavedSubject(subjectRef.subjectId, {
        domainId: subjectRef.domainId,
        subjectId: subjectRef.subjectId,
        subjectType: subjectRef.subjectType,
      }).catch(() => {});

      const finalizedRunMetrics = finalizeLatestRunMetrics();
      updateSnapshot((current) => {
        const completedRuntimeStatus = buildCompletedRuntimeStatus(
          {
            ...current,
            planTotalSegments: Math.max(
              current.planTotalSegments,
              current.runtimeStatus?.totalSegments ?? 0,
              current.planCompletedSegments,
            ),
            planCompletedSegments: Math.max(
              current.planCompletedSegments,
              current.runtimeStatus?.segmentIndex ?? current.planCompletedSegments,
            ),
          },
          current.runtimeStatus?.runId || analysisRunId,
          runtimeSource,
        );
        const totalSegments = completedRuntimeStatus.totalSegments;
        const completedSegments =
          totalSegments > 0 ? completedRuntimeStatus.segmentIndex : current.planCompletedSegments;

        return {
          ...current,
          analysis: finalAnalysis,
          isAnalyzing: false,
          runMetrics: finalizedRunMetrics,
          planTotalSegments: totalSegments,
          planCompletedSegments: completedSegments,
          runtimeStatus: completedRuntimeStatus,
        };
      });

      if (resumeMode === 'enabled') {
        await clearResumeState(subjectRef.subjectId, resumeOptions);
      }

      return {
        status: 'completed',
        snapshot,
        historyId: historyId ?? null,
        analysisOutputEnvelope,
        errorMessage: null,
      };
    }

    const finalizedRunMetrics = finalizeLatestRunMetrics();
    updateSnapshot((current) => {
      const completedRuntimeStatus = buildCompletedRuntimeStatus(
        current,
        current.runtimeStatus?.runId || analysisRunId,
        runtimeSource,
      );
      const totalSegments = completedRuntimeStatus.totalSegments;
      const completedSegments =
        totalSegments > 0 ? completedRuntimeStatus.segmentIndex : current.planCompletedSegments;

      return {
        ...current,
        isAnalyzing: false,
        runMetrics: finalizedRunMetrics,
        planTotalSegments: totalSegments,
        planCompletedSegments: completedSegments,
        runtimeStatus: completedRuntimeStatus,
      };
    });

    return {
      status: 'completed',
      snapshot,
      historyId: null,
      errorMessage: null,
    };
  } catch (error: unknown) {
    if (isAbortError(error) || abortController.signal.aborted) {
      const cancelledRuntimeStatus = buildPlannerRuntimeState({
        stage: 'cancelled',
        runId: latestRuntimeStatus?.runId || analysisRunId,
        segmentIndex: latestRuntimeStatus?.segmentIndex ?? latestResumeState.completedSegmentIndices.length,
        totalSegments: latestRuntimeStatus?.totalSegments ?? latestResumeState.plan.length,
        stageLabel: 'Cancelled',
        source: runtimeSource,
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
      updateSnapshot((current) => ({
        ...current,
        isAnalyzing: false,
        error: null,
        runMetrics: finalizedRunMetrics,
        runtimeStatus: buildPlannerRuntimeState({
          stage: 'cancelled',
          runId: current.runtimeStatus?.runId || analysisRunId,
          segmentIndex: current.runtimeStatus?.segmentIndex ?? current.planCompletedSegments,
          totalSegments: current.runtimeStatus?.totalSegments ?? current.planTotalSegments,
          stageLabel: 'Cancelled',
          source: runtimeSource,
          eventSeq: (current.runtimeStatus?.eventSeq ?? 0) + 1,
          stageStartedAt: current.runtimeStatus?.stageStartedAt,
        }),
      }));

      return {
        status: 'cancelled',
        snapshot,
        errorMessage: null,
      };
    }

    const shouldFallbackToFreshRun =
      resumeMode === 'enabled' &&
      shouldResume &&
      !hasProducedNewChunks &&
      !hasAdvancedCompletedSegments;
    if (shouldFallbackToFreshRun) {
      console.warn('Resume snapshot is incompatible, fallback to fresh analysis run.', error);
      await clearResumeState(subjectRef.subjectId, resumeOptions);
      const finalizedRunMetrics = finalizeLatestRunMetrics();
      updateSnapshot((current) => ({
        ...current,
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
      return {
        status: 'restart_fresh',
        snapshot,
      };
    }

    console.error('Analysis failed:', error);
    const errorMessage = getExecutionErrorMessage(error);
    const failedRuntimeStatus = buildPlannerRuntimeState({
      stage: 'failed',
      runId: latestRuntimeStatus?.runId || analysisRunId,
      segmentIndex: latestRuntimeStatus?.segmentIndex ?? latestResumeState.completedSegmentIndices.length,
      totalSegments: latestRuntimeStatus?.totalSegments ?? latestResumeState.plan.length,
      stageLabel: 'Failed',
      errorMessage,
      source: runtimeSource,
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
    updateSnapshot((current) => ({
      ...current,
      isAnalyzing: false,
      error: errorMessage,
      runMetrics: finalizedRunMetrics,
      runtimeStatus: buildPlannerRuntimeState({
        stage: 'failed',
        runId: current.runtimeStatus?.runId || analysisRunId,
        segmentIndex: current.runtimeStatus?.segmentIndex ?? current.planCompletedSegments,
        totalSegments: current.runtimeStatus?.totalSegments ?? current.planTotalSegments,
        stageLabel: 'Failed',
        errorMessage,
        source: runtimeSource,
        eventSeq: (current.runtimeStatus?.eventSeq ?? 0) + 1,
        stageStartedAt: current.runtimeStatus?.stageStartedAt,
      }),
    }));

    return {
      status: 'failed',
      snapshot,
      errorMessage,
    };
  }
}

export async function executeAnalysisRun(
  args: ExecuteAnalysisRunArgs,
): Promise<AnalysisExecutionResult> {
  const abortController = args.abortController ?? new AbortController();
  const runtimeSource = args.runtimeSource || 'context';
  const resumeMode = args.resumeMode || 'enabled';
  const subjectDisplay = resolveExecutionSubjectDisplay(args);
  const subjectRef = resolveSubjectRef(subjectDisplay, args.dataToAnalyze, args.subjectRef);
  const getCurrentAbortController =
    args.getCurrentAbortController || (() => abortController);

  let nextArgs = {
    ...args,
    abortController,
  };
  let nextIsResume = Boolean(args.isResume);

  while (true) {
    const result = await runSingleAnalysisAttempt(
      {
        ...nextArgs,
        isResume: nextIsResume,
      },
      {
        subjectRef,
        abortController,
        getCurrentAbortController,
        runtimeSource,
        resumeMode,
        onSnapshot: args.onSnapshot,
      },
    );

    if (result.status !== 'restart_fresh') {
      return result;
    }

    nextIsResume = false;
  }
}
