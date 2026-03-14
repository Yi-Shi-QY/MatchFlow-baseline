import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearManagerSessionStoreFallback,
  createManagerSessionStore,
} from '@/src/services/manager-gateway/sessionStore';
import {
  clearMemoryCandidateStoreFallback,
  dismissMemoryCandidate,
  enableMemoryCandidate,
  persistMemoryCandidates,
} from '@/src/services/memoryCandidateStore';
import { loadMemoryWorkspace } from '@/src/services/memoryWorkspace';

describe('memory workspace loader', () => {
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
    clearMemoryCandidateStoreFallback();
  });

  it('loads pending candidates alongside manager memories while keeping enabled memory content as the source of truth', async () => {
    const store = createManagerSessionStore();
    const session = await store.getOrCreateMainSession({
      domainId: 'football',
      runtimeDomainVersion: '1.0.0',
    });

    await store.upsertMemory?.({
      scopeType: 'global',
      scopeId: 'global',
      memoryType: 'preference',
      keyText: 'tone',
      contentText: 'Use concise language.',
      importance: 0.8,
      source: 'user',
      updatedAt: 100,
    });
    await store.upsertMemory?.({
      scopeType: 'domain',
      scopeId: 'football',
      memoryType: 'habit',
      keyText: 'preferred-league',
      contentText: 'Focus on Premier League first.',
      importance: 0.9,
      source: 'system',
      updatedAt: 200,
    });
    await store.upsertMemory?.({
      scopeType: 'session',
      scopeId: session.id,
      memoryType: 'summary',
      keyText: 'current-thread',
      contentText: 'User is iterating on the conversation-first workspace.',
      importance: 0.7,
      source: 'session',
      updatedAt: 300,
    });
    await store.upsertMemory?.({
      scopeType: 'domain',
      scopeId: 'football',
      memoryType: 'habit',
      keyText: 'preferred-league',
      contentText: 'Focus on Premier League and Champions League first.',
      importance: 0.95,
      source: 'system',
      updatedAt: 400,
    });
    const [pendingCandidate] = await persistMemoryCandidates({
      candidates: [
        {
          sourceKind: 'explicit_preference',
          origin: 'manager_turn',
          scopeType: 'domain',
          scopeId: 'football',
          memoryType: 'preference',
          keyText: 'analysis-factors',
          contentText: 'Prefer fundamentals and market signals.',
          title: 'Analysis factor preference',
          reasoning: 'User explicitly stated which analysis factors to prioritize.',
          evidence: ['fundamentals and market'],
        },
      ],
      sessionStore: store,
    });
    const [dismissedCandidate] = await persistMemoryCandidates({
      candidates: [
        {
          sourceKind: 'explicit_constraint',
          origin: 'manager_turn',
          scopeType: 'global',
          scopeId: 'global',
          memoryType: 'constraint',
          keyText: 'response-constraint',
          contentText: 'Do not use emoji in replies.',
          title: 'Response constraint',
          reasoning: 'User explicitly stated a response constraint.',
          evidence: ['Do not use emoji in replies.'],
        },
      ],
      sessionStore: store,
    });
    await dismissMemoryCandidate(dismissedCandidate.id);

    const workspace = await loadMemoryWorkspace({
      domainId: 'football',
      runtimeDomainVersion: '1.0.0',
    });

    expect(workspace.sessionId).toBe(session.id);
    expect(workspace.memories.map((memory) => memory.scopeType)).toEqual([
      'domain',
      'global',
      'session',
    ]);
    expect(workspace.candidates.map((candidate) => candidate.status)).toEqual([
      'pending',
      'dismissed',
    ]);
    expect(workspace.memories[0].contentText).toBe(
      'Focus on Premier League and Champions League first.',
    );

    await enableMemoryCandidate({
      candidateId: pendingCandidate.id,
      sessionStore: store,
    });

    const nextWorkspace = await loadMemoryWorkspace({
      domainId: 'football',
      runtimeDomainVersion: '1.0.0',
    });

    expect(
      nextWorkspace.memories.some(
        (memory) =>
          memory.memoryType === 'preference' &&
          memory.keyText === 'analysis-factors' &&
          memory.contentText === 'Prefer fundamentals and market signals.',
      ),
    ).toBe(true);
    expect(
      nextWorkspace.candidates.some((candidate) => candidate.candidateId === pendingCandidate.id),
    ).toBe(false);
    expect(
      nextWorkspace.candidates.find((candidate) => candidate.candidateId === dismissedCandidate.id)
        ?.status,
    ).toBe('dismissed');
  });
});
