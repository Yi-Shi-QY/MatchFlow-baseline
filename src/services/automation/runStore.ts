import {
  AUTOMATION_RUNS_STORAGE_KEY,
  MAX_AUTOMATION_RUN_COUNT,
} from './constants';
import {
  normalizeObject,
  normalizeString,
  normalizeTimestamp,
  readAutomationRecords,
  writeAutomationRecords,
} from './storageFallback';
import type { AutomationRun, AutomationRunQueryOptions } from './types';
import { sortByCreatedAtDesc } from './utils';

function normalizeRun(raw: unknown): AutomationRun | null {
  const value = normalizeObject<Record<string, unknown>>(raw);
  if (!value) return null;
  const state = normalizeString(value.state);
  if (
    state !== 'running' &&
    state !== 'completed' &&
    state !== 'failed' &&
    state !== 'cancelled'
  ) {
    return null;
  }
  const id = normalizeString(value.id);
  const jobId = normalizeString(value.jobId);
  const title = normalizeString(value.title);
  if (!id || !jobId || !title) return null;
  return {
    id,
    jobId,
    title,
    state,
    domainId: normalizeString(value.domainId, 'football'),
    domainPackVersion: normalizeString(value.domainPackVersion) || undefined,
    templateId: normalizeString(value.templateId) || undefined,
    startedAt: normalizeTimestamp(value.startedAt, Date.now()),
    endedAt:
      typeof value.endedAt === 'number' && Number.isFinite(value.endedAt)
        ? value.endedAt
        : undefined,
    provider: normalizeString(value.provider) || undefined,
    model: normalizeString(value.model) || undefined,
    inputTokens:
      typeof value.inputTokens === 'number' && Number.isFinite(value.inputTokens)
        ? value.inputTokens
        : undefined,
    outputTokens:
      typeof value.outputTokens === 'number' && Number.isFinite(value.outputTokens)
        ? value.outputTokens
        : undefined,
    totalTokens:
      typeof value.totalTokens === 'number' && Number.isFinite(value.totalTokens)
        ? value.totalTokens
        : undefined,
    tokenSource: normalizeString(value.tokenSource) || undefined,
    resultHistoryId: normalizeString(value.resultHistoryId) || undefined,
    errorCode: normalizeString(value.errorCode) || undefined,
    errorMessage: normalizeString(value.errorMessage) || undefined,
    createdAt: normalizeTimestamp(value.createdAt, Date.now()),
    updatedAt: normalizeTimestamp(value.updatedAt, Date.now()),
  };
}

export async function listAutomationRuns(
  options?: AutomationRunQueryOptions,
): Promise<AutomationRun[]> {
  const runs = readAutomationRecords(AUTOMATION_RUNS_STORAGE_KEY, {
    normalizer: normalizeRun,
  });
  const filtered =
    Array.isArray(options?.states) && options.states.length > 0
      ? runs.filter((run) => options.states!.includes(run.state))
      : runs;
  const sorted = sortByCreatedAtDesc(filtered);
  return typeof options?.limit === 'number' ? sorted.slice(0, options.limit) : sorted;
}

export async function saveAutomationRun(run: AutomationRun): Promise<void> {
  const current = await listAutomationRuns();
  const next = current.filter((entry) => entry.id !== run.id);
  next.unshift({
    ...run,
    updatedAt: Date.now(),
  });
  writeAutomationRecords(AUTOMATION_RUNS_STORAGE_KEY, next, {
    sort: (a, b) => b.createdAt - a.createdAt,
    limit: MAX_AUTOMATION_RUN_COUNT,
  });
}
