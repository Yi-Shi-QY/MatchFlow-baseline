import type {
  AutomationDraft,
  AutomationJob,
  AutomationRun,
} from '@/src/services/automation/types';
import type { ManagerSessionProjection } from '@/src/services/manager-gateway/types';
import type { ExecutionTicket } from './executionTicketTypes';

export type ManagerWorkspaceMemoryCandidateStatus =
  | 'pending'
  | 'enabled'
  | 'dismissed';

export interface ManagerWorkspaceMemoryCandidate {
  id: string;
  title: string;
  memoryType: string;
  status: ManagerWorkspaceMemoryCandidateStatus;
  createdAt: number;
  updatedAt: number;
}

export interface ManagerWorkspaceResultItem {
  id: string;
  source: 'automation_run';
  runId: string;
  jobId: string;
  title: string;
  status: Exclude<AutomationRun['state'], 'running'>;
  updatedAt: number;
  endedAt: number | null;
  resultHistoryId: string | null;
  errorMessage: string | null;
}

export interface ManagerWorkspaceApprovalItem {
  id: string;
  draftId: string;
  ticketId: string | null;
  draft: AutomationDraft;
  ticket: ExecutionTicket | null;
  updatedAt: number;
}

export interface ManagerWorkspaceTaskState {
  pendingApprovals: ManagerWorkspaceApprovalItem[];
  pendingClarifications: AutomationDraft[];
  pendingJobs: AutomationJob[];
  runningJobs: AutomationJob[];
  activeRuns: AutomationRun[];
  failedRuns: AutomationRun[];
}

export interface ManagerWorkspaceResultState {
  latestResults: ManagerWorkspaceResultItem[];
}

export interface ManagerWorkspaceMemoryState {
  pendingCount: number;
  candidates: ManagerWorkspaceMemoryCandidate[];
}

export interface ManagerWorkspaceProjection {
  managerProjection: ManagerSessionProjection | null;
  automationState: {
    drafts: AutomationDraft[];
    jobs: AutomationJob[];
    runs: AutomationRun[];
    executionTickets: ExecutionTicket[];
  };
  taskState: ManagerWorkspaceTaskState;
  resultState: ManagerWorkspaceResultState;
  memoryState: ManagerWorkspaceMemoryState;
}

export interface BuildManagerWorkspaceProjectionInput {
  managerProjection: ManagerSessionProjection | null;
  drafts: AutomationDraft[];
  jobs: AutomationJob[];
  runs: AutomationRun[];
  executionTickets?: ExecutionTicket[];
  memoryCandidates?: ManagerWorkspaceMemoryCandidate[];
}
