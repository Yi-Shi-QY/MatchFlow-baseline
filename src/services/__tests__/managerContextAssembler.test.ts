import { describe, expect, it, vi } from 'vitest';
import type { DomainRuntimePack } from '@/src/domains/runtime/types';
import { createManagerContextAssembler } from '@/src/services/manager-gateway/contextAssembler';
import type {
  ManagerFeedBlock,
  ManagerGatewayMemoryService,
  ManagerGatewaySummaryService,
  ManagerSessionRecord,
} from '@/src/services/manager-gateway/types';

function createSession(): ManagerSessionRecord {
  return {
    id: 'session_main',
    sessionKey: 'manager:main',
    title: 'Football',
    status: 'active',
    domainId: 'football',
    runtimeDomainVersion: '1.0.0',
    activeWorkflowType: null,
    activeWorkflowStateData: null,
    latestSummaryId: 'summary_1',
    latestMessageAt: 200,
    createdAt: 100,
    updatedAt: 200,
  };
}

function createFeed(): ManagerFeedBlock[] {
  return [
    {
      id: 'message_1',
      role: 'user',
      blockType: 'user_text',
      text: 'Analyze Arsenal vs Chelsea tonight',
      payloadData: null,
      createdAt: 100,
    },
    {
      id: 'message_2',
      role: 'assistant',
      blockType: 'assistant_text',
      text: 'I need your factor priorities first.',
      payloadData: null,
      createdAt: 200,
    },
  ];
}

describe('manager context assembler', () => {
  it('assembles ordered context fragments from summary, transcript, memory, domain, runtime, and tool affordances', async () => {
    const collectDomainContext = vi.fn(async () => [
      {
        id: 'domain_fragment',
        category: 'domain_state' as const,
        priority: 70,
        text: 'Current football context provider snapshot.',
      },
    ]);
    const summaryService: ManagerGatewaySummaryService = {
      getLatestSummary: vi.fn(async () => ({
        id: 'summary_1',
        sessionId: 'session_main',
        kind: 'rolling_compaction',
        cutoffOrdinal: 3,
        summaryText: 'Transcript summary through ordinal 3.',
        sourceMessageCount: 4,
        createdAt: 120,
      })),
      refreshSessionSummary: vi.fn(async () => null),
    };
    const memoryService: ManagerGatewayMemoryService = {
      listRelevantMemories: vi.fn(async () => [
        {
          id: 'memory_1',
          scopeType: 'domain' as const,
          scopeId: 'football',
          memoryType: 'preference',
          keyText: 'preferred_sequence',
          contentText: 'fundamental -> market -> prediction',
          importance: 0.8,
          source: 'test',
          createdAt: 100,
          updatedAt: 200,
        },
      ]),
      persistMemoryWrites: vi.fn(async () => []),
    };
    const runtimePack: DomainRuntimePack = {
      manifest: {
        domainId: 'football',
        version: '1.0.0',
        displayName: 'Football',
        supportedIntentTypes: ['query', 'analyze'],
        supportedEventTypes: ['match'],
        supportedFactorIds: ['fundamental', 'market'],
      },
      resolver: {
        resolveIntent: vi.fn(async () => null),
        resolveSubjects: vi.fn(async () => []),
        resolveEvents: vi.fn(async () => []),
      },
      sourceAdapters: [
        {
          id: 'football_remote_primary',
          supports: vi.fn(() => true),
          query: vi.fn(async () => ({})),
          normalize: vi.fn(() => []),
        },
        {
          id: 'football_builtin_fallback',
          supports: vi.fn(() => true),
          query: vi.fn(async () => ({})),
          normalize: vi.fn(() => []),
        },
      ],
      queryCatalog: {
        eventListQueryType: 'football_match_list',
      },
      contextProviders: [
        {
          id: 'football_state',
          collect: collectDomainContext,
        },
      ],
      tools: [
        {
          id: 'football_help',
          description: 'Fallback football guidance.',
          canHandle() {
            return true;
          },
          execute: vi.fn(async () => ({ blocks: [] })),
        },
      ],
    };

    const assembler = createManagerContextAssembler({
      summaryService,
      memoryService,
    });
    const result = await assembler.assemble({
      session: createSession(),
      activeRun: null,
      activeWorkflow: null,
      feed: createFeed(),
      runtimePack,
    });

    expect(result.fragments.map((fragment) => fragment.category)).toEqual([
      'summary',
      'recent_turns',
      'memory',
      'domain_state',
      'runtime_state',
      'tool_affordance',
    ]);
    expect(result.usage).toMatchObject({
      fragmentCount: 6,
      summaryId: 'summary_1',
      memoryCount: 1,
    });
    expect(result.snapshot.fragments).toHaveLength(6);
    expect(collectDomainContext).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeBindings: {
          sourceAdapterIds: ['football_remote_primary', 'football_builtin_fallback'],
          queryCatalog: {
            eventListQueryType: 'football_match_list',
          },
        },
        domainState: {
          activeWorkflow: null,
        },
      }),
    );
    expect(
      result.fragments.find((fragment) => fragment.category === 'runtime_state')?.text,
    ).toContain('Mounted source adapters: football_remote_primary, football_builtin_fallback');
  });
});
