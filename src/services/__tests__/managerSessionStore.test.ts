import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearManagerSessionStoreFallback,
  createManagerSessionStore,
} from '@/src/services/manager-gateway/sessionStore';

describe('manager session store', () => {
  beforeEach(() => {
    const map = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
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
      } satisfies Storage,
      configurable: true,
    });
    localStorage.clear();
    clearManagerSessionStoreFallback();
  });

  it('creates a new main session in fallback storage when no legacy state exists', async () => {
    const store = createManagerSessionStore();
    const session = await store.getOrCreateMainSession({
      domainId: 'football',
      runtimeDomainVersion: '1.0.0',
    });

    expect(session.sessionKey).toBe('manager:main');
    expect(session.domainId).toBe('football');
    expect(session.runtimeDomainVersion).toBe('1.0.0');
    await expect(store.listMessages(session.id)).resolves.toEqual([]);
  });

  it('appends messages with increasing ordinals and updates session timestamps', async () => {
    const store = createManagerSessionStore();
    const session = await store.getOrCreateMainSession({
      domainId: 'football',
      runtimeDomainVersion: '1.0.0',
    });

    const first = await store.appendMessage?.({
      sessionId: session.id,
      role: 'assistant',
      blockType: 'assistant_text',
      text: 'Manager ready.',
      createdAt: 101,
    });
    const second = await store.appendMessage?.({
      sessionId: session.id,
      role: 'user',
      blockType: 'user_text',
      text: 'Show me today matches.',
      createdAt: 102,
    });
    const messages = await store.listMessages(session.id);
    const updatedSession = await store.getSessionById(session.id);

    expect(first?.ordinal).toBe(0);
    expect(second?.ordinal).toBe(1);
    expect(messages.map((entry) => entry.ordinal)).toEqual([0, 1]);
    expect(updatedSession?.latestMessageAt).toBe(102);
  });

  it('stores and retrieves rolling summaries in fallback storage', async () => {
    const store = createManagerSessionStore();
    const session = await store.getOrCreateMainSession({
      domainId: 'football',
      runtimeDomainVersion: '1.0.0',
    });

    const summary = await store.saveSummary?.({
      sessionId: session.id,
      kind: 'rolling_compaction',
      cutoffOrdinal: 3,
      summaryText: 'Transcript summary through ordinal 3.',
      sourceMessageCount: 4,
      createdAt: 200,
    });
    const latestSummary = await store.getLatestSummary?.(session.id);

    expect(summary?.sessionId).toBe(session.id);
    expect(latestSummary).toMatchObject({
      kind: 'rolling_compaction',
      cutoffOrdinal: 3,
      summaryText: 'Transcript summary through ordinal 3.',
    });
  });

  it('upserts and retrieves scoped memories in fallback storage', async () => {
    const store = createManagerSessionStore();

    const first = await store.upsertMemory?.({
      scopeType: 'domain',
      scopeId: 'football',
      memoryType: 'preference',
      keyText: 'preferred_sequence',
      contentText: 'fundamental -> market -> prediction',
      importance: 0.8,
      source: 'test',
      createdAt: 100,
      updatedAt: 100,
    });
    const second = await store.upsertMemory?.({
      scopeType: 'domain',
      scopeId: 'football',
      memoryType: 'preference',
      keyText: 'preferred_sequence',
      contentText: 'market -> prediction',
      importance: 0.9,
      source: 'test',
      createdAt: 100,
      updatedAt: 120,
    });
    const memories = await store.listMemories?.({
      scopeType: 'domain',
      scopeId: 'football',
      limit: 10,
    });

    expect(first?.id).toBe(second?.id);
    expect(memories).toHaveLength(1);
    expect(memories?.[0]).toMatchObject({
      keyText: 'preferred_sequence',
      contentText: 'market -> prediction',
      importance: 0.9,
    });
  });

  it('creates, updates, and prioritizes active runs in fallback storage', async () => {
    const store = createManagerSessionStore();
    const session = await store.getOrCreateMainSession({
      domainId: 'football',
      runtimeDomainVersion: '1.0.0',
    });

    const queuedRun = await store.createRun?.({
      sessionId: session.id,
      status: 'queued',
      triggerType: 'user',
      createdAt: 300,
      updatedAt: 300,
    });
    const runningRun = await store.createRun?.({
      sessionId: session.id,
      status: 'running',
      triggerType: 'user',
      createdAt: 320,
      updatedAt: 320,
    });

    expect(queuedRun).toBeTruthy();
    expect(runningRun).toBeTruthy();
    if (!queuedRun || !runningRun) {
      throw new Error('Expected run persistence methods to return records.');
    }

    await expect(store.getActiveRun?.(session.id)).resolves.toMatchObject({
      id: runningRun.id,
      status: 'running',
    });

    const updatedQueued = await store.updateRun?.(queuedRun.id, {
      status: 'failed',
      errorCode: 'test_failure',
      updatedAt: 340,
    });
    const updatedRunning = await store.updateRun?.(runningRun.id, {
      inputMessageId: 'message_1',
      status: 'completed',
      plannerMode: 'deterministic',
      toolPath: 'tool:test',
      finishedAt: 360,
      updatedAt: 360,
    });

    expect(updatedQueued).toMatchObject({
      id: queuedRun.id,
      status: 'failed',
      errorCode: 'test_failure',
    });
    expect(updatedRunning).toMatchObject({
      id: runningRun.id,
      status: 'completed',
      inputMessageId: 'message_1',
      plannerMode: 'deterministic',
      toolPath: 'tool:test',
      finishedAt: 360,
    });
    await expect(store.getActiveRun?.(session.id)).resolves.toBeNull();
    await expect(store.getLatestRun?.(session.id)).resolves.toMatchObject({
      id: runningRun.id,
      status: 'completed',
      toolPath: 'tool:test',
    });
  });
});
