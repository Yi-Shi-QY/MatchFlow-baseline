import type { AutomationExecutionPhase } from '@/src/services/automation/jobExecutionContext';
import { resolveAutomationRunNotificationRoute } from '@/src/services/automation/notifications';
import { getAutomationTargetSelectorLabel } from '@/src/services/automation/targetSelector';
import type { AutomationJob, AutomationRun } from '@/src/services/automation/types';
import { persistMemoryCandidates } from '@/src/services/memoryCandidateStore';
import type { MemoryCandidateInput } from '@/src/services/memoryCandidateTypes';
import { createManagerSessionStore } from '@/src/services/manager-gateway/sessionStore';
import type { ManagerMessageRecord } from '@/src/services/manager-gateway/types';
import { getSettings } from '@/src/services/settings';

interface AutomationLifecyclePayload {
  schemaVersion: 1;
  automationEvent: {
    source: 'automation_executor';
    phase: AutomationExecutionPhase;
    domainId: string;
    domainPackVersion: string | null;
    jobId: string;
    jobState: AutomationJob['state'];
    runId: string;
    runState: AutomationRun['state'];
    route: string;
    title: string;
    triggerType: AutomationJob['triggerType'];
    scheduledFor: string;
    resultHistoryId: string | null;
    provider: string | null;
    model: string | null;
    errorMessage: string | null;
    totalTokens: number | null;
  };
}

function resolveLanguage(): 'zh' | 'en' {
  return getSettings().language === 'zh' ? 'zh' : 'en';
}

function resolveSelectorTitle(job: AutomationJob): string {
  return getAutomationTargetSelectorLabel(job.targetSelector) || job.id;
}

function resolveJobTitle(job: AutomationJob, run: AutomationRun, language: 'zh' | 'en'): string {
  const candidates = [job.title, run.title, resolveSelectorTitle(job), job.id];
  const title = candidates
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find((value) => value.length > 0);

  if (title) {
    return title;
  }

  return language === 'zh' ? '\u81ea\u52a8\u5316\u4efb\u52a1' : 'automation task';
}

function parseLifecyclePayload(
  payloadData: string | null | undefined,
): AutomationLifecyclePayload | null {
  if (!payloadData) {
    return null;
  }

  try {
    const parsed = JSON.parse(payloadData);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const payload = parsed as Partial<AutomationLifecyclePayload>;
    if (
      payload.schemaVersion !== 1 ||
      !payload.automationEvent ||
      typeof payload.automationEvent !== 'object' ||
      Array.isArray(payload.automationEvent)
    ) {
      return null;
    }

    return payload as AutomationLifecyclePayload;
  } catch {
    return null;
  }
}

function findDuplicateLifecycleMessage(input: {
  messages: ManagerMessageRecord[];
  phase: AutomationExecutionPhase;
  runId: string;
}): ManagerMessageRecord | null {
  const recentMessages = input.messages.slice(-40).reverse();

  for (const message of recentMessages) {
    const payload = parseLifecyclePayload(message.payloadData);
    if (!payload) {
      continue;
    }

    if (
      payload.automationEvent.source === 'automation_executor' &&
      payload.automationEvent.phase === input.phase &&
      payload.automationEvent.runId === input.runId
    ) {
      return message;
    }
  }

  return null;
}

function resolveCreatedAt(phase: AutomationExecutionPhase, run: AutomationRun): number {
  if (phase === 'started' && Number.isFinite(run.startedAt)) {
    return run.startedAt;
  }

  if (typeof run.endedAt === 'number' && Number.isFinite(run.endedAt)) {
    return run.endedAt;
  }

  return run.updatedAt;
}

function resolveBlockType(
  phase: AutomationExecutionPhase,
): 'tool_status' | 'tool_result' | 'error_notice' {
  if (phase === 'completed') {
    return 'tool_result';
  }

  if (phase === 'failed') {
    return 'error_notice';
  }

  return 'tool_status';
}

function resolveErrorMessage(run: AutomationRun): string | null {
  if (typeof run.errorMessage !== 'string') {
    return null;
  }

  const normalized = run.errorMessage.trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveProvider(run: AutomationRun): string | null {
  const normalized = typeof run.provider === 'string' ? run.provider.trim() : '';
  return normalized.length > 0 ? normalized : null;
}

function resolveModel(run: AutomationRun): string | null {
  const normalized = typeof run.model === 'string' ? run.model.trim() : '';
  return normalized.length > 0 ? normalized : null;
}

function resolveTotalTokens(run: AutomationRun): number | null {
  return typeof run.totalTokens === 'number' && Number.isFinite(run.totalTokens)
    ? run.totalTokens
    : null;
}

function buildLifecycleText(input: {
  language: 'zh' | 'en';
  phase: AutomationExecutionPhase;
  title: string;
  run: AutomationRun;
}): string {
  const { language, phase, title, run } = input;
  const errorMessage = resolveErrorMessage(run);

  if (language === 'zh') {
    switch (phase) {
      case 'started':
        return `\u5df2\u5f00\u59cb\u6267\u884c "${title}"\u3002\u6267\u884c\u8fdb\u5ea6\u4f1a\u6301\u7eed\u56de\u5199\u5230\u5f53\u524d\u5bf9\u8bdd\u3002`;
      case 'completed':
        return `\u5df2\u5b8c\u6210 "${title}"\u3002\u7ed3\u679c\u5df2\u751f\u6210\uff0c\u53ef\u7ee7\u7eed\u67e5\u770b\u8be6\u60c5\u3002`;
      case 'failed':
        return errorMessage
          ? `\u6267\u884c "${title}" \u5931\u8d25\u3002\u539f\u56e0\uff1a${errorMessage}`
          : `\u6267\u884c "${title}" \u5931\u8d25\u3002`;
      case 'cancelled':
        return `\u5df2\u53d6\u6d88 "${title}"\u3002`;
      default:
        return `\u5df2\u66f4\u65b0 "${title}" \u7684\u6267\u884c\u72b6\u6001\u3002`;
    }
  }

  switch (phase) {
    case 'started':
      return `Started "${title}". Progress will continue to be written back here.`;
    case 'completed':
      return `Completed "${title}". The result is ready to review.`;
    case 'failed':
      return errorMessage
        ? `Failed to execute "${title}". Reason: ${errorMessage}`
        : `Failed to execute "${title}".`;
    case 'cancelled':
      return `Cancelled "${title}".`;
    default:
      return `Updated the execution status for "${title}".`;
  }
}

function buildPayload(input: {
  phase: AutomationExecutionPhase;
  job: AutomationJob;
  run: AutomationRun;
  title: string;
  route: string;
}): string {
  const payload: AutomationLifecyclePayload = {
    schemaVersion: 1,
    automationEvent: {
      source: 'automation_executor',
      phase: input.phase,
      domainId: input.job.domainId,
      domainPackVersion: input.job.domainPackVersion || null,
      jobId: input.job.id,
      jobState: input.job.state,
      runId: input.run.id,
      runState: input.run.state,
      route: input.route,
      title: input.title,
      triggerType: input.job.triggerType,
      scheduledFor: input.job.scheduledFor,
      resultHistoryId: input.run.resultHistoryId || null,
      provider: resolveProvider(input.run),
      model: resolveModel(input.run),
      errorMessage: resolveErrorMessage(input.run),
      totalTokens: resolveTotalTokens(input.run),
    },
  };

  return JSON.stringify(payload);
}

export async function writeAutomationLifecycleToManagerConversation(input: {
  phase: AutomationExecutionPhase;
  job: AutomationJob;
  run: AutomationRun;
  memoryCandidates?: MemoryCandidateInput[];
}): Promise<ManagerMessageRecord | null> {
  const store = createManagerSessionStore();
  if (!store.appendMessage) {
    return null;
  }

  const language = resolveLanguage();
  const title = resolveJobTitle(input.job, input.run, language);
  const route = resolveAutomationRunNotificationRoute(input.job, input.run);
  const session = await store.getOrCreateMainSession({
    domainId: input.job.domainId,
    runtimeDomainVersion: input.job.domainPackVersion,
  });
  if (Array.isArray(input.memoryCandidates) && input.memoryCandidates.length > 0) {
    await persistMemoryCandidates({
      candidates: input.memoryCandidates,
      sessionStore: store,
    });
  }
  const existingMessages = await store.listMessages(session.id);
  const duplicate = findDuplicateLifecycleMessage({
    messages: existingMessages,
    phase: input.phase,
    runId: input.run.id,
  });

  if (duplicate) {
    return duplicate;
  }

  return store.appendMessage({
    sessionId: session.id,
    runId: input.run.id,
    role: 'assistant',
    blockType: resolveBlockType(input.phase),
    text: buildLifecycleText({
      language,
      phase: input.phase,
      title,
      run: input.run,
    }),
    payloadData: buildPayload({
      phase: input.phase,
      job: input.job,
      run: input.run,
      title,
      route,
    }),
    createdAt: resolveCreatedAt(input.phase, input.run),
  });
}
