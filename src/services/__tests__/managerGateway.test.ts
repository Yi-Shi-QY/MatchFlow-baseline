import { describe, expect, it, vi } from 'vitest';
import { createManagerGateway } from '@/src/services/manager-gateway/gateway';
import type {
  ManagerGatewaySessionStore,
  ManagerMessageRecord,
  ManagerRunRecord,
  ManagerSessionRecord,
} from '@/src/services/manager-gateway/types';

function createSession(overrides: Partial<ManagerSessionRecord> = {}): ManagerSessionRecord {
  return {
    id: 'session_main',
    sessionKey: 'manager:main',
    title: 'Main session',
    status: 'active',
    domainId: 'football',
    runtimeDomainVersion: '1.0.0',
    activeWorkflowType: null,
    activeWorkflowStateData: null,
    latestSummaryId: null,
    latestMessageAt: 100,
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  };
}

function createMessage(overrides: Partial<ManagerMessageRecord> = {}): ManagerMessageRecord {
  return {
    id: 'message_1',
    sessionId: 'session_main',
    runId: null,
    ordinal: 1,
    role: 'assistant',
    blockType: 'assistant_text',
    text: 'Manager ready.',
    payloadData: null,
    createdAt: 100,
    ...overrides,
  };
}

describe('manager gateway', () => {
  it('creates a main session projection using the runtime registry', async () => {
    const latestRun: ManagerRunRecord = {
      id: 'run_latest',
      sessionId: 'session_main',
      inputMessageId: null,
      status: 'completed',
      triggerType: 'user',
      plannerMode: 'deterministic',
      intentType: 'query',
      toolPath: 'tool:test',
      errorCode: null,
      errorMessage: null,
      stateData: null,
      startedAt: 101,
      finishedAt: 110,
      createdAt: 100,
      updatedAt: 110,
    };
    const sessionStore: ManagerGatewaySessionStore = {
      getOrCreateMainSession: vi.fn(async ({ domainId, runtimeDomainVersion }) =>
        createSession({
          domainId,
          runtimeDomainVersion: runtimeDomainVersion || null,
        }),
      ),
      getSessionById: vi.fn(async () => createSession()),
      listMessages: vi.fn(async () => [createMessage()]),
      getActiveRun: vi.fn(async (): Promise<ManagerRunRecord | null> => null),
      getLatestRun: vi.fn(async (): Promise<ManagerRunRecord | null> => latestRun),
    };

    const gateway = createManagerGateway({ sessionStore });
    const projection = await gateway.getOrCreateMainSession({ domainId: 'football' });

    expect(sessionStore.getOrCreateMainSession).toHaveBeenCalledWith({
      domainId: 'football',
      runtimeDomainVersion: '1.0.0',
      title: undefined,
    });
    expect(projection.runtimeDomainId).toBe('football');
    expect(projection.feed).toHaveLength(1);
    expect(projection.feed[0].blockType).toBe('assistant_text');
    expect(projection.latestRun).toEqual(latestRun);
  });

  it('returns null when loading a missing session projection', async () => {
    const sessionStore: ManagerGatewaySessionStore = {
      getOrCreateMainSession: vi.fn(async () => createSession()),
      getSessionById: vi.fn(async () => null),
      listMessages: vi.fn(async () => []),
    };

    const gateway = createManagerGateway({ sessionStore });
    await expect(gateway.loadSessionProjection('missing_session')).resolves.toBeNull();
  });
});
