import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearManagerSessionStoreFallback,
  createManagerSessionStore,
} from '@/src/services/manager-gateway/sessionStore';
import type { MemoryCandidateInput } from '@/src/services/memoryCandidateTypes';
import {
  clearMemoryCandidateStoreFallback,
  dismissMemoryCandidate,
  enableMemoryCandidate,
  getMemoryCandidate,
  listMemoryCandidates,
  persistMemoryCandidates,
} from '@/src/services/memoryCandidateStore';

function createCandidate(
  contentText: string,
  overrides: Partial<MemoryCandidateInput> = {},
): MemoryCandidateInput {
  return {
    sourceKind: 'explicit_preference',
    origin: 'manager_turn',
    scopeType: 'domain',
    scopeId: 'football',
    memoryType: 'preference',
    keyText: 'analysis-factors',
    contentText,
    title: 'Analysis factor preference',
    reasoning: 'User explicitly stated which analysis factors to prioritize.',
    evidence: ['fundamentals and market'],
    ...overrides,
  };
}

describe('memory candidate store', () => {
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

  it('dedupes identical candidates by fingerprint', async () => {
    const [first] = await persistMemoryCandidates({
      candidates: [createCandidate('Prefer fundamentals and market signals.')],
    });
    const [second] = await persistMemoryCandidates({
      candidates: [createCandidate('Prefer fundamentals and market signals.')],
    });
    const allCandidates = await listMemoryCandidates();

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(allCandidates).toHaveLength(1);
    expect(allCandidates[0]).toMatchObject({
      id: first.id,
      status: 'pending',
      conflictKind: 'none',
    });
  });

  it('flags conflicting candidate content for the same memory key', async () => {
    const [first] = await persistMemoryCandidates({
      candidates: [createCandidate('Prefer fundamentals and market signals.')],
    });
    const [conflict] = await persistMemoryCandidates({
      candidates: [createCandidate('Prefer market signals only.')],
    });

    expect(conflict.id).not.toBe(first.id);
    expect(conflict.conflictKind).toBe('candidate_content');
    expect(conflict.conflictCandidateId).toBe(first.id);
  });

  it('dismissing a candidate does not create manager memory', async () => {
    const sessionStore = createManagerSessionStore();
    const [candidate] = await persistMemoryCandidates({
      candidates: [createCandidate('Prefer fundamentals and market signals.')],
    });

    await dismissMemoryCandidate(candidate.id);
    const dismissed = await getMemoryCandidate(candidate.id);

    expect(dismissed?.status).toBe('dismissed');
    await expect(
      sessionStore.listMemories?.({
        scopeType: 'domain',
        scopeId: 'football',
        limit: 10,
      }),
    ).resolves.toHaveLength(0);
  });

  it('enabling a candidate persists it into manager memory', async () => {
    const sessionStore = createManagerSessionStore();
    const [candidate] = await persistMemoryCandidates({
      candidates: [createCandidate('Prefer fundamentals and market signals.')],
    });

    const result = await enableMemoryCandidate({
      candidateId: candidate.id,
      sessionStore,
    });
    const persistedMemories =
      (await sessionStore.listMemories?.({
        scopeType: 'domain',
        scopeId: 'football',
        limit: 10,
      })) || [];

    expect(result.candidate).toMatchObject({
      id: candidate.id,
      status: 'enabled',
    });
    expect(result.memory).toMatchObject({
      scopeType: 'domain',
      scopeId: 'football',
      memoryType: 'preference',
      keyText: 'analysis-factors',
      contentText: 'Prefer fundamentals and market signals.',
    });
    expect(persistedMemories).toHaveLength(1);
  });
});
