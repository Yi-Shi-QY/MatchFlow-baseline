import type { AutomationDraft, AutomationJob, AutomationRun } from '@/src/services/automation/types';
import type {
  ManagerWorkspaceApprovalItem,
  BuildManagerWorkspaceProjectionInput,
  ManagerWorkspaceMemoryCandidate,
  ManagerWorkspaceProjection,
  ManagerWorkspaceResultItem,
} from './types';

function compareUpdatedDesc<T extends { updatedAt: number }>(left: T, right: T): number {
  return right.updatedAt - left.updatedAt;
}

function parseComparableTime(value: number | string | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function sortDraftsByUpdatedDesc(drafts: AutomationDraft[]): AutomationDraft[] {
  return [...drafts].sort(compareUpdatedDesc);
}

function sortApprovalItemsByUpdatedDesc(
  approvals: ManagerWorkspaceApprovalItem[],
): ManagerWorkspaceApprovalItem[] {
  return [...approvals].sort(compareUpdatedDesc);
}

function sortJobsByScheduledAsc(jobs: AutomationJob[]): AutomationJob[] {
  return [...jobs].sort(
    (left, right) =>
      parseComparableTime(left.scheduledFor) - parseComparableTime(right.scheduledFor),
  );
}

function sortJobsByUpdatedDesc(jobs: AutomationJob[]): AutomationJob[] {
  return [...jobs].sort(compareUpdatedDesc);
}

function sortRunsByUpdatedDesc(runs: AutomationRun[]): AutomationRun[] {
  return [...runs].sort(compareUpdatedDesc);
}

function sortResultsByEndedDesc(results: ManagerWorkspaceResultItem[]): ManagerWorkspaceResultItem[] {
  return [...results].sort((left, right) => {
    const leftTime = left.endedAt ?? left.updatedAt;
    const rightTime = right.endedAt ?? right.updatedAt;
    return rightTime - leftTime;
  });
}

function sortMemoryCandidatesByUpdatedDesc(
  candidates: ManagerWorkspaceMemoryCandidate[],
): ManagerWorkspaceMemoryCandidate[] {
  return [...candidates].sort(compareUpdatedDesc);
}

function buildPendingApprovals(
  drafts: AutomationDraft[],
  executionTickets: NonNullable<BuildManagerWorkspaceProjectionInput['executionTickets']>,
): ManagerWorkspaceApprovalItem[] {
  const ticketsByDraftId = new Map(
    executionTickets
      .filter((ticket) => typeof ticket.draftId === 'string' && ticket.draftId.trim().length > 0)
      .map((ticket) => [ticket.draftId as string, ticket]),
  );

  return sortApprovalItemsByUpdatedDesc(
    drafts
      .filter((draft) => draft.status === 'ready')
      .map<ManagerWorkspaceApprovalItem>((draft) => {
        const ticket = ticketsByDraftId.get(draft.id) || null;
        return {
          id: ticket?.id || draft.id,
          draftId: draft.id,
          ticketId: ticket?.id || null,
          draft,
          ticket,
          updatedAt: Math.max(draft.updatedAt, ticket?.updatedAt || 0),
        };
      }),
  );
}

function buildLatestResults(runs: AutomationRun[]): ManagerWorkspaceResultItem[] {
  const results = runs
    .filter(
      (run): run is AutomationRun & { state: Exclude<AutomationRun['state'], 'running'> } =>
        run.state !== 'running',
    )
    .map<ManagerWorkspaceResultItem>((run) => ({
      id: `automation_run:${run.id}`,
      source: 'automation_run',
      runId: run.id,
      jobId: run.jobId,
      title: run.title,
      status: run.state,
      updatedAt: run.updatedAt,
      endedAt: typeof run.endedAt === 'number' ? run.endedAt : null,
      resultHistoryId: run.resultHistoryId || null,
      errorMessage: run.errorMessage || null,
    }));

  return sortResultsByEndedDesc(results);
}

export function buildManagerWorkspaceProjection(
  input: BuildManagerWorkspaceProjectionInput,
): ManagerWorkspaceProjection {
  const executionTickets = Array.isArray(input.executionTickets) ? input.executionTickets : [];
  const memoryCandidates = Array.isArray(input.memoryCandidates) ? input.memoryCandidates : [];
  const pendingApprovals = buildPendingApprovals(input.drafts, executionTickets);
  const pendingClarifications = sortDraftsByUpdatedDesc(
    input.drafts.filter((draft) => draft.status === 'needs_clarification'),
  );
  const pendingJobs = sortJobsByScheduledAsc(
    input.jobs.filter((job) => job.state === 'pending' || job.state === 'eligible'),
  );
  const runningJobs = sortJobsByUpdatedDesc(
    input.jobs.filter((job) => job.state === 'running'),
  );
  const activeRuns = sortRunsByUpdatedDesc(
    input.runs.filter((run) => run.state === 'running'),
  );
  const failedRuns = sortRunsByUpdatedDesc(
    input.runs.filter((run) => run.state === 'failed'),
  );

  return {
    managerProjection: input.managerProjection,
    automationState: {
      drafts: [...input.drafts],
      jobs: [...input.jobs],
      runs: [...input.runs],
      executionTickets: [...executionTickets].sort(compareUpdatedDesc),
    },
    taskState: {
      pendingApprovals,
      pendingClarifications,
      pendingJobs,
      runningJobs,
      activeRuns,
      failedRuns,
    },
    resultState: {
      latestResults: buildLatestResults(input.runs),
    },
    memoryState: {
      pendingCount: memoryCandidates.filter((candidate) => candidate.status === 'pending').length,
      candidates: sortMemoryCandidatesByUpdatedDesc(memoryCandidates),
    },
  };
}
