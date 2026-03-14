import { beforeEach, describe, expect, it } from 'vitest';
import type { AutomationJob, AutomationRun } from '@/src/services/automation/types';
import {
  clearManagerSessionStoreFallback,
  createManagerSessionStore,
} from '@/src/services/manager-gateway/sessionStore';
import { writeAutomationLifecycleToManagerConversation } from '@/src/services/manager-workspace/automationWritebackBridge';
import { resolveDefaultSettings, saveSettings } from '@/src/services/settings';

function createJob(overrides: Partial<AutomationJob> = {}): AutomationJob {
  return {
    id: 'job-1',
    title: 'Analyze Arsenal vs Man City',
    sourceDraftId: 'draft-1',
    sourceRuleId: undefined,
    domainId: 'football',
    domainPackVersion: '1.0.0',
    templateId: undefined,
    triggerType: 'one_time',
    targetSelector: {
      mode: 'fixed_subject',
      subjectId: 'm1',
      subjectLabel: 'Arsenal vs Man City',
    },
    targetSnapshot: undefined,
    notificationPolicy: {
      notifyOnClarification: true,
      notifyOnStart: true,
      notifyOnComplete: true,
      notifyOnFailure: true,
    },
    scheduledFor: '2026-03-13T12:00:00.000Z',
    state: 'running',
    retryCount: 0,
    maxRetries: 2,
    retryAfter: null,
    recoveryWindowEndsAt: null,
    createdAt: 10,
    updatedAt: 20,
    ...overrides,
  };
}

function createRun(overrides: Partial<AutomationRun> = {}): AutomationRun {
  return {
    id: 'run-1',
    jobId: 'job-1',
    title: 'Analyze Arsenal vs Man City',
    state: 'running',
    domainId: 'football',
    domainPackVersion: '1.0.0',
    templateId: undefined,
    startedAt: 100,
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  };
}

function createLocalStorageMock(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe('writeAutomationLifecycleToManagerConversation', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: createLocalStorageMock(),
      configurable: true,
    });
    localStorage.clear();
    clearManagerSessionStoreFallback();
    saveSettings({
      ...resolveDefaultSettings(),
      language: 'zh',
    });
  });

  it('writes started lifecycle updates into the manager main session', async () => {
    const job = createJob();
    const run = createRun();

    const record = await writeAutomationLifecycleToManagerConversation({
      phase: 'started',
      job,
      run,
    });
    const store = createManagerSessionStore();
    const session = await store.getOrCreateMainSession({
      domainId: job.domainId,
    });
    const messages = await store.listMessages(session.id);

    expect(record).toBeTruthy();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      sessionId: session.id,
      runId: run.id,
      role: 'assistant',
      blockType: 'tool_status',
      createdAt: run.startedAt,
    });
    expect(messages[0].text).toContain('\u5df2\u5f00\u59cb\u6267\u884c');
    expect(messages[0].text).toContain(job.title);

    const payload = JSON.parse(messages[0].payloadData || '{}') as {
      schemaVersion?: number;
      automationEvent?: Record<string, unknown>;
    };
    expect(payload.schemaVersion).toBe(1);
    expect(payload.automationEvent).toMatchObject({
      source: 'automation_executor',
      phase: 'started',
      jobId: job.id,
      runId: run.id,
      route: '/automation?jobId=job-1&runId=run-1',
      title: job.title,
      jobState: job.state,
      runState: run.state,
    });
  });

  it('writes completed lifecycle updates with a result route payload', async () => {
    saveSettings({
      ...resolveDefaultSettings(),
      language: 'en',
    });
    const job = createJob({
      state: 'completed',
    });
    const run = createRun({
      state: 'completed',
      endedAt: 180,
      updatedAt: 180,
      resultHistoryId: 'football::m1',
      provider: 'openai',
      model: 'gpt-5',
      totalTokens: 300,
    });

    await writeAutomationLifecycleToManagerConversation({
      phase: 'completed',
      job,
      run,
    });
    const store = createManagerSessionStore();
    const session = await store.getOrCreateMainSession({
      domainId: job.domainId,
    });
    const messages = await store.listMessages(session.id);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      blockType: 'tool_result',
      createdAt: 180,
    });
    expect(messages[0].text).toContain('Completed');

    const payload = JSON.parse(messages[0].payloadData || '{}') as {
      automationEvent?: Record<string, unknown>;
    };
    expect(payload.automationEvent).toMatchObject({
      phase: 'completed',
      route: '/subject/football/m1',
      provider: 'openai',
      model: 'gpt-5',
      totalTokens: 300,
      resultHistoryId: 'football::m1',
    });
  });

  it('writes failed lifecycle updates as error notices', async () => {
    const job = createJob({
      state: 'failed_retryable',
    });
    const run = createRun({
      state: 'failed',
      endedAt: 220,
      updatedAt: 220,
      errorMessage: 'Provider timeout',
    });

    await writeAutomationLifecycleToManagerConversation({
      phase: 'failed',
      job,
      run,
    });
    const store = createManagerSessionStore();
    const session = await store.getOrCreateMainSession({
      domainId: job.domainId,
    });
    const messages = await store.listMessages(session.id);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      blockType: 'error_notice',
      createdAt: 220,
    });
    expect(messages[0].text).toContain('Provider timeout');

    const payload = JSON.parse(messages[0].payloadData || '{}') as {
      automationEvent?: Record<string, unknown>;
    };
    expect(payload.automationEvent).toMatchObject({
      phase: 'failed',
      errorMessage: 'Provider timeout',
      route: '/automation?jobId=job-1&runId=run-1',
    });
  });

  it('deduplicates repeated lifecycle writes for the same run phase', async () => {
    const job = createJob();
    const run = createRun();

    await writeAutomationLifecycleToManagerConversation({
      phase: 'started',
      job,
      run,
    });
    await writeAutomationLifecycleToManagerConversation({
      phase: 'started',
      job,
      run,
    });

    const store = createManagerSessionStore();
    const session = await store.getOrCreateMainSession({
      domainId: job.domainId,
    });
    const messages = await store.listMessages(session.id);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      runId: run.id,
      blockType: 'tool_status',
    });
  });
});
