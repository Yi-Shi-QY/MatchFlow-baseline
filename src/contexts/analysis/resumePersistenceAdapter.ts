import type { Match } from '@/src/data/matches';
import type { AnalysisResumeState } from '@/src/services/ai';
import {
  clearResumeState,
  getResumeState,
  isResumeStateRecoverable,
  saveResumeState,
} from '@/src/services/history';
import { parseAgentStream, type AgentResult } from '@/src/services/agentParser';
import type { PlannerRuntimeState } from '@/src/services/planner/runtime';

export interface AnalysisResumeOptions {
  domainId: string;
  subjectId: string;
  subjectType: string;
}

export interface InitialResumeBootstrapState {
  shouldResume: boolean;
  resumeStateData: AnalysisResumeState | undefined;
  initialThoughts: string;
  initialParsedStream: AgentResult | null;
  initialCollapsed: Record<string, boolean>;
  initialResumeState: AnalysisResumeState;
}

interface BootstrapResumeStateArgs {
  matchId: string;
  isResume: boolean;
  resumeOptions: AnalysisResumeOptions;
}

export async function bootstrapResumeState(
  args: BootstrapResumeStateArgs,
): Promise<InitialResumeBootstrapState> {
  const { matchId, isResume, resumeOptions } = args;

  let initialThoughts = '';
  let initialParsedStream: AgentResult | null = null;
  let initialCollapsed: Record<string, boolean> = {};
  let resumeStateData: AnalysisResumeState | undefined = undefined;
  let shouldResume = isResume;

  if (shouldResume) {
    const savedState = await getResumeState(matchId, resumeOptions);
    if (isResumeStateRecoverable(savedState)) {
      resumeStateData = savedState.state;

      // Prefer completed segments. Keep draft thoughts only for temporary preview.
      if (resumeStateData && resumeStateData.segmentResults) {
        initialThoughts = resumeStateData.segmentResults.map((r) => r.content).join('');
      } else {
        initialThoughts = savedState.thoughts;
      }

      initialParsedStream = parseAgentStream(initialThoughts);
      initialParsedStream.segments.forEach((seg) => {
        if (seg.isThoughtComplete) {
          initialCollapsed[seg.id] = true;
        }
      });
    } else {
      shouldResume = false;
      await clearResumeState(matchId, resumeOptions);
    }
  } else {
    await clearResumeState(matchId, resumeOptions);
  }

  const initialResumeState: AnalysisResumeState = {
    plan: Array.isArray(resumeStateData?.plan) ? resumeStateData.plan : [],
    completedSegmentIndices: Array.isArray(resumeStateData?.completedSegmentIndices)
      ? resumeStateData.completedSegmentIndices
      : [],
    fullAnalysisText:
      typeof resumeStateData?.fullAnalysisText === 'string'
        ? resumeStateData.fullAnalysisText
        : initialThoughts,
    segmentResults: Array.isArray(resumeStateData?.segmentResults)
      ? resumeStateData.segmentResults
      : [],
    runtimeStatus: resumeStateData?.runtimeStatus,
    subjectSnapshot: resumeStateData?.subjectSnapshot ?? resumeStateData?.matchSnapshot,
    matchSnapshot: resumeStateData?.matchSnapshot,
  };

  return {
    shouldResume,
    resumeStateData,
    initialThoughts,
    initialParsedStream,
    initialCollapsed,
    initialResumeState,
  };
}

interface ResumeSnapshotPersisterArgs {
  matchId: string;
  match: Match;
  resumeOptions: AnalysisResumeOptions;
  ownerController: AbortController;
  getCurrentController: () => AbortController | undefined;
  intervalMs?: number;
}

interface PersistResumeSnapshotPayload {
  latestResumeState: AnalysisResumeState;
  latestRuntimeStatus: PlannerRuntimeState;
  currentThoughts: string;
}

export function createResumeSnapshotPersister(args: ResumeSnapshotPersisterArgs) {
  const {
    matchId,
    match,
    resumeOptions,
    ownerController,
    getCurrentController,
    intervalMs = 3000,
  } = args;
  let lastSnapshotAt = 0;

  const persistSnapshot = (
    payload: PersistResumeSnapshotPayload,
    force: boolean = false,
  ) => {
    const currentController = getCurrentController();
    if (!currentController || currentController !== ownerController) {
      return;
    }

    const now = Date.now();
    if (!force && now - lastSnapshotAt < intervalMs) {
      return;
    }
    lastSnapshotAt = now;

    const stateToPersist: AnalysisResumeState = {
      ...payload.latestResumeState,
      subjectSnapshot: match,
      runtimeStatus: payload.latestRuntimeStatus,
      matchSnapshot: match,
    };

    void saveResumeState(matchId, stateToPersist, payload.currentThoughts, {
      ...resumeOptions,
      subjectSnapshot: match,
    });
  };

  return { persistSnapshot };
}
