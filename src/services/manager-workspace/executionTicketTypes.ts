import type { AutomationDraft } from '@/src/services/automation/types';

export type ExecutionTicketSource = 'command_center' | 'task_center';

export type ExecutionTicketExecutionMode = 'run_now' | 'scheduled';

export type ExecutionTicketStatus =
  | 'pending_confirmation'
  | 'confirmed'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ExecutionTicketTarget {
  domainId: string;
  subjectId?: string;
  targetLabel: string;
  scheduledFor?: string | null;
}

export interface ExecutionTicketDraftSnapshot {
  sourceText: string;
  title: string;
  intentType: AutomationDraft['intentType'];
  activationMode: AutomationDraft['activationMode'];
  schedule?: AutomationDraft['schedule'];
  targetSelector?: AutomationDraft['targetSelector'];
}

export interface ExecutionTicket {
  id: string;
  source: ExecutionTicketSource;
  executionMode: ExecutionTicketExecutionMode;
  status: ExecutionTicketStatus;
  title: string;
  domainId: string;
  domainPackVersion?: string;
  templateId?: string;
  draftId?: string;
  jobId?: string;
  runId?: string;
  target: ExecutionTicketTarget;
  draftSnapshot: ExecutionTicketDraftSnapshot;
  createdAt: number;
  updatedAt: number;
}

export interface CreateExecutionTicketInput {
  source: ExecutionTicketSource;
  executionMode: ExecutionTicketExecutionMode;
  title: string;
  domainId?: string;
  domainPackVersion?: string;
  templateId?: string;
  draftId?: string;
  jobId?: string;
  runId?: string;
  target: ExecutionTicketTarget;
  draftSnapshot: ExecutionTicketDraftSnapshot;
  status?: ExecutionTicketStatus;
}

export interface ExecutionTicketPatch {
  source?: ExecutionTicketSource;
  executionMode?: ExecutionTicketExecutionMode;
  status?: ExecutionTicketStatus;
  title?: string;
  domainId?: string;
  domainPackVersion?: string;
  templateId?: string;
  draftId?: string;
  jobId?: string;
  runId?: string;
  target?: ExecutionTicketTarget;
  draftSnapshot?: ExecutionTicketDraftSnapshot;
}
