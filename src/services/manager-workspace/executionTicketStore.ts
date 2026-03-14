import type { AutomationDraft } from '@/src/services/automation/types';
import {
  getAutomationTargetSelectorLabel,
  getAutomationTargetSelectorSubjectId,
} from '@/src/services/automation/targetSelector';
import {
  normalizeAutomationSchedule,
  normalizeAutomationTargetSelector,
} from '@/src/services/automation/recordNormalizers';
import {
  normalizeObject,
  normalizeString,
  normalizeTimestamp,
  readAutomationRecords,
  writeAutomationRecords,
} from '@/src/services/automation/storageFallback';
import { createAutomationId } from '@/src/services/automation/utils';
import type {
  CreateExecutionTicketInput,
  ExecutionTicket,
  ExecutionTicketDraftSnapshot,
  ExecutionTicketExecutionMode,
  ExecutionTicketPatch,
  ExecutionTicketSource,
  ExecutionTicketStatus,
  ExecutionTicketTarget,
} from './executionTicketTypes';

const EXECUTION_TICKETS_STORAGE_KEY = 'matchflow_manager_execution_tickets_v1';
const MAX_EXECUTION_TICKET_COUNT = 256;

function isExecutionTicketSource(value: unknown): value is ExecutionTicketSource {
  return value === 'command_center' || value === 'task_center';
}

function isExecutionTicketExecutionMode(
  value: unknown,
): value is ExecutionTicketExecutionMode {
  return value === 'run_now' || value === 'scheduled';
}

function isExecutionTicketStatus(value: unknown): value is ExecutionTicketStatus {
  return (
    value === 'pending_confirmation' ||
    value === 'confirmed' ||
    value === 'running' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'cancelled'
  );
}

function normalizeDraftSnapshot(input: unknown): ExecutionTicketDraftSnapshot | null {
  const value = normalizeObject<Record<string, unknown>>(input);
  if (!value) {
    return null;
  }

  const sourceText = normalizeString(value.sourceText);
  const title = normalizeString(value.title);
  const intentType = normalizeString(value.intentType);
  const activationMode = normalizeString(value.activationMode);
  if (!sourceText || !title) {
    return null;
  }
  if (intentType !== 'one_time' && intentType !== 'recurring') {
    return null;
  }
  if (activationMode !== 'run_now' && activationMode !== 'save_only') {
    return null;
  }

  return {
    sourceText,
    title,
    intentType,
    activationMode,
    schedule: normalizeAutomationSchedule(value.schedule),
    targetSelector: normalizeAutomationTargetSelector(value.targetSelector),
  };
}

function normalizeTarget(input: unknown): ExecutionTicketTarget | null {
  const value = normalizeObject<Record<string, unknown>>(input);
  if (!value) {
    return null;
  }

  const domainId = normalizeString(value.domainId);
  const targetLabel = normalizeString(value.targetLabel);
  if (!domainId || !targetLabel) {
    return null;
  }

  return {
    domainId,
    subjectId: normalizeString(value.subjectId) || undefined,
    targetLabel,
    scheduledFor: normalizeString(value.scheduledFor) || null,
  };
}

function normalizeExecutionTicket(raw: unknown): ExecutionTicket | null {
  const value = normalizeObject<Record<string, unknown>>(raw);
  if (!value) {
    return null;
  }

  const id = normalizeString(value.id);
  const source = value.source;
  const executionMode = value.executionMode;
  const status = value.status;
  const title = normalizeString(value.title);
  const domainId = normalizeString(value.domainId);
  const target = normalizeTarget(value.target);
  const draftSnapshot = normalizeDraftSnapshot(value.draftSnapshot);

  if (
    !id ||
    !title ||
    !domainId ||
    !target ||
    !draftSnapshot ||
    !isExecutionTicketSource(source) ||
    !isExecutionTicketExecutionMode(executionMode) ||
    !isExecutionTicketStatus(status)
  ) {
    return null;
  }

  return {
    id,
    source,
    executionMode,
    status,
    title,
    domainId,
    domainPackVersion: normalizeString(value.domainPackVersion) || undefined,
    templateId: normalizeString(value.templateId) || undefined,
    draftId: normalizeString(value.draftId) || undefined,
    jobId: normalizeString(value.jobId) || undefined,
    runId: normalizeString(value.runId) || undefined,
    target,
    draftSnapshot,
    createdAt: normalizeTimestamp(value.createdAt, Date.now()),
    updatedAt: normalizeTimestamp(value.updatedAt, Date.now()),
  };
}

function compareUpdatedDesc(left: ExecutionTicket, right: ExecutionTicket): number {
  return right.updatedAt - left.updatedAt;
}

function sanitizePatch(patch: ExecutionTicketPatch): ExecutionTicketPatch {
  const next: ExecutionTicketPatch = {};

  if (patch.source && isExecutionTicketSource(patch.source)) {
    next.source = patch.source;
  }
  if (patch.executionMode && isExecutionTicketExecutionMode(patch.executionMode)) {
    next.executionMode = patch.executionMode;
  }
  if (patch.status && isExecutionTicketStatus(patch.status)) {
    next.status = patch.status;
  }
  if (typeof patch.title === 'string' && patch.title.trim().length > 0) {
    next.title = patch.title.trim();
  }
  if (typeof patch.domainId === 'string' && patch.domainId.trim().length > 0) {
    next.domainId = patch.domainId.trim();
  }
  if (typeof patch.domainPackVersion === 'string' && patch.domainPackVersion.trim().length > 0) {
    next.domainPackVersion = patch.domainPackVersion.trim();
  }
  if (typeof patch.templateId === 'string' && patch.templateId.trim().length > 0) {
    next.templateId = patch.templateId.trim();
  }
  if (typeof patch.draftId === 'string' && patch.draftId.trim().length > 0) {
    next.draftId = patch.draftId.trim();
  }
  if (typeof patch.jobId === 'string' && patch.jobId.trim().length > 0) {
    next.jobId = patch.jobId.trim();
  }
  if (typeof patch.runId === 'string' && patch.runId.trim().length > 0) {
    next.runId = patch.runId.trim();
  }

  const target = patch.target ? normalizeTarget(patch.target) : null;
  if (target) {
    next.target = target;
  }

  const draftSnapshot = patch.draftSnapshot
    ? normalizeDraftSnapshot(patch.draftSnapshot)
    : null;
  if (draftSnapshot) {
    next.draftSnapshot = draftSnapshot;
  }

  return next;
}

async function persistExecutionTickets(tickets: ExecutionTicket[]): Promise<void> {
  writeAutomationRecords(EXECUTION_TICKETS_STORAGE_KEY, tickets, {
    sort: compareUpdatedDesc,
    limit: MAX_EXECUTION_TICKET_COUNT,
  });
}

function buildExecutionModeFromDraft(
  draft: AutomationDraft,
): ExecutionTicketExecutionMode {
  return draft.activationMode === 'run_now' ? 'run_now' : 'scheduled';
}

function buildExecutionTicketTargetFromDraft(draft: AutomationDraft): ExecutionTicketTarget {
  if (!draft.targetSelector) {
    return {
      domainId: draft.domainId,
      targetLabel: draft.domainId,
      scheduledFor: draft.schedule?.type === 'one_time' ? draft.schedule.runAt : null,
    };
  }

  const subjectId = getAutomationTargetSelectorSubjectId(draft.targetSelector);
  if (subjectId) {
    return {
      domainId: draft.domainId,
      subjectId,
      targetLabel:
        getAutomationTargetSelectorLabel(draft.targetSelector) || draft.domainId,
      scheduledFor: draft.schedule?.type === 'one_time' ? draft.schedule.runAt : null,
    };
  }

  return {
    domainId: draft.domainId,
    targetLabel:
      getAutomationTargetSelectorLabel(draft.targetSelector) || draft.domainId,
    scheduledFor: draft.schedule?.type === 'one_time' ? draft.schedule.runAt : null,
  };
}

function buildDraftSnapshotFromDraft(
  draft: AutomationDraft,
): ExecutionTicketDraftSnapshot {
  return {
    sourceText: draft.sourceText,
    title: draft.title,
    intentType: draft.intentType,
    activationMode: draft.activationMode,
    schedule: draft.schedule,
    targetSelector: draft.targetSelector,
  };
}

export async function listExecutionTickets(): Promise<ExecutionTicket[]> {
  const tickets = readAutomationRecords(EXECUTION_TICKETS_STORAGE_KEY, {
    normalizer: normalizeExecutionTicket,
  });
  return [...tickets].sort(compareUpdatedDesc);
}

export async function getExecutionTicketById(
  ticketId: string,
): Promise<ExecutionTicket | null> {
  const tickets = await listExecutionTickets();
  return tickets.find((ticket) => ticket.id === ticketId) || null;
}

export async function getExecutionTicketByDraftId(
  draftId: string,
): Promise<ExecutionTicket | null> {
  const tickets = await listExecutionTickets();
  return tickets.find((ticket) => ticket.draftId === draftId) || null;
}

export async function getExecutionTicketByJobId(
  jobId: string,
): Promise<ExecutionTicket | null> {
  const tickets = await listExecutionTickets();
  return tickets.find((ticket) => ticket.jobId === jobId) || null;
}

export async function getExecutionTicketByRunId(
  runId: string,
): Promise<ExecutionTicket | null> {
  const tickets = await listExecutionTickets();
  return tickets.find((ticket) => ticket.runId === runId) || null;
}

export async function createExecutionTicket(
  input: CreateExecutionTicketInput,
): Promise<ExecutionTicket> {
  const tickets = await listExecutionTickets();
  const existing = input.draftId
    ? tickets.find((ticket) => ticket.draftId === input.draftId)
    : null;
  const timestamp = Date.now();

  if (existing) {
    const updated: ExecutionTicket = {
      ...existing,
      title: input.title,
      domainId: input.domainId || input.target.domainId,
      domainPackVersion: input.domainPackVersion || existing.domainPackVersion,
      templateId: input.templateId || existing.templateId,
      executionMode: input.executionMode,
      status: input.status || existing.status,
      jobId: input.jobId || existing.jobId,
      runId: input.runId || existing.runId,
      target: input.target,
      draftSnapshot: input.draftSnapshot,
      updatedAt: timestamp,
    };

    await persistExecutionTickets([
      updated,
      ...tickets.filter((ticket) => ticket.id !== existing.id),
    ]);
    return updated;
  }

  const created: ExecutionTicket = {
    id: createAutomationId('execution_ticket'),
    source: input.source,
    executionMode: input.executionMode,
    status: input.status || 'pending_confirmation',
    title: input.title,
    domainId: input.domainId || input.target.domainId,
    domainPackVersion: input.domainPackVersion,
    templateId: input.templateId,
    draftId: input.draftId,
    jobId: input.jobId,
    runId: input.runId,
    target: input.target,
    draftSnapshot: input.draftSnapshot,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await persistExecutionTickets([created, ...tickets]);
  return created;
}

export async function ensureExecutionTicketForDraft(input: {
  draft: AutomationDraft;
  source: ExecutionTicketSource;
}): Promise<ExecutionTicket> {
  return createExecutionTicket({
    source: input.source,
    executionMode: buildExecutionModeFromDraft(input.draft),
    title: input.draft.title,
    domainId: input.draft.domainId,
    domainPackVersion: input.draft.domainPackVersion,
    templateId: input.draft.templateId,
    draftId: input.draft.id,
    target: buildExecutionTicketTargetFromDraft(input.draft),
    draftSnapshot: buildDraftSnapshotFromDraft(input.draft),
  });
}

export async function patchExecutionTicket(input: {
  ticketId?: string;
  draftId?: string;
  jobId?: string;
  runId?: string;
  patch: ExecutionTicketPatch;
}): Promise<ExecutionTicket | null> {
  const tickets = await listExecutionTickets();
  const ticket = tickets.find((entry) => {
    if (input.ticketId) {
      return entry.id === input.ticketId;
    }
    if (input.runId) {
      return entry.runId === input.runId;
    }
    if (input.jobId) {
      return entry.jobId === input.jobId;
    }
    if (input.draftId) {
      return entry.draftId === input.draftId;
    }
    return false;
  });

  if (!ticket) {
    return null;
  }

  const patch = sanitizePatch(input.patch);
  const updated: ExecutionTicket = {
    ...ticket,
    ...patch,
    updatedAt: Date.now(),
  };

  await persistExecutionTickets([
    updated,
    ...tickets.filter((entry) => entry.id !== ticket.id),
  ]);
  return updated;
}
