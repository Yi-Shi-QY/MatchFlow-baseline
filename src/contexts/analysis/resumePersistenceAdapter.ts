import type { AnalysisResumeState } from '@/src/services/ai';
import {
  clearResumeState,
  getResumeState,
  isResumeStateRecoverable,
  saveResumeState,
} from '@/src/services/history';
import { parseAgentStream, type AgentResult } from '@/src/services/agentParser';
import type { PlannerRuntimeState } from '@/src/services/planner/runtime';

function resolveResumeStateSubjectDisplaySnapshot(
  state: AnalysisResumeState | undefined,
): AnalysisResumeState['subjectDisplaySnapshot'] {
  return state?.subjectDisplaySnapshot;
}

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
  subjectId: string;
  isResume: boolean;
  resumeOptions: AnalysisResumeOptions;
}

export async function bootstrapResumeState(
  args: BootstrapResumeStateArgs,
): Promise<InitialResumeBootstrapState> {
  const { subjectId, isResume, resumeOptions } = args;

  let initialThoughts = '';
  let initialParsedStream: AgentResult | null = null;
  let initialCollapsed: Record<string, boolean> = {};
  let resumeStateData: AnalysisResumeState | undefined = undefined;
  let shouldResume = isResume;

  if (shouldResume) {
    const savedState = await getResumeState(subjectId, resumeOptions);
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
      await clearResumeState(subjectId, resumeOptions);
    }
  } else {
    await clearResumeState(subjectId, resumeOptions);
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
    subjectSnapshot:
      resumeStateData?.subjectSnapshot ?? resolveResumeStateSubjectDisplaySnapshot(resumeStateData),
    subjectDisplaySnapshot: resolveResumeStateSubjectDisplaySnapshot(resumeStateData),
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
  subjectId: string;
  subjectSnapshot: unknown;
  subjectDisplayProjection: AnalysisResumeState['subjectDisplaySnapshot'];
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
    subjectId,
    subjectSnapshot,
    subjectDisplayProjection,
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
      subjectSnapshot,
      runtimeStatus: payload.latestRuntimeStatus,
      subjectDisplaySnapshot:
        resumeOptions.subjectType === 'match'
          ? subjectDisplayProjection
          : resolveResumeStateSubjectDisplaySnapshot(payload.latestResumeState),
    };

    void saveResumeState(subjectId, stateToPersist, payload.currentThoughts, {
      ...resumeOptions,
      subjectSnapshot,
    });
  };

  return { persistSnapshot };
}
