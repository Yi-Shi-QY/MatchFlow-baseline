import { describe, expect, it } from 'vitest';
import type {
  DomainSourceAdapter,
  RuntimeSessionSnapshot,
  SessionWorkflowStateSnapshot,
} from '@/src/domains/runtime/types';
import { createFootballRuntimePack, footballRuntimePack } from '@/src/domains/runtime/football';
import {
  FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE,
  parsePendingTaskFromWorkflow,
} from '@/src/domains/runtime/football/tools';
import { queryFootballMatchesViaRuntimeAdapters } from '@/src/domains/runtime/football/sourceAdapters';

function createAbortedSignal(): AbortSignal {
  const controller = new AbortController();
  controller.abort();
  return controller.signal;
}

function createSession(): RuntimeSessionSnapshot {
  return {
    sessionId: 'session_1',
    sessionKey: 'manager:main',
    domainId: 'football',
    title: 'Main Session',
    runtimeDomainVersion: '1.0.0',
    activeWorkflow: null,
  };
}

describe('football runtime pack', () => {
  it('exposes football source adapters for pack-level data access', async () => {
    expect(footballRuntimePack.sourceAdapters.length).toBeGreaterThan(0);

    const matches = await queryFootballMatchesViaRuntimeAdapters();
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].homeTeam.name).toBeTruthy();
  });

  it('wraps the legacy local match query as a runtime tool', async () => {
    const queryTool = footballRuntimePack.tools.find((tool) => tool.id === 'football_query_local_matches');
    expect(queryTool).toBeTruthy();

    const result = await queryTool!.execute({
      input: 'What Premier League matches are on tomorrow?',
      language: 'en',
      session: createSession(),
      intent: {
        domainId: 'football',
        intentType: 'query',
        rawInput: 'What Premier League matches are on tomorrow?',
      },
    });

    expect(result.blocks[0].blockType).toBe('assistant_text');
    expect(result.blocks[0].text).toContain('Premier League');
  });

  it('resolves football events through injected runtime source adapters', async () => {
    const adapterCalls: string[] = [];
    const customAdapters: DomainSourceAdapter[] = [
      {
        id: 'football_empty_override',
        supports(input) {
          return input.domainId === 'football' && input.queryType === 'football_match_list';
        },
        async query() {
          adapterCalls.push('football_empty_override');
          return {
            events: [],
          };
        },
        normalize() {
          return [];
        },
      },
      {
        id: 'football_custom_primary',
        supports(input) {
          return input.domainId === 'football' && input.queryType === 'football_match_list';
        },
        async query() {
          adapterCalls.push('football_custom_primary');
          return {
            events: [
              {
                domainId: 'football',
                eventType: 'match',
                eventId: 'custom-1',
                title: 'Real Madrid vs Barcelona',
                subjectRefs: [],
                metadata: {},
              },
            ],
          };
        },
        normalize() {
          return [];
        },
      },
    ];
    const injectedPack = createFootballRuntimePack({
      sourceAdapters: customAdapters,
    });

    const events = await injectedPack.resolver.resolveEvents(
      {
        domainId: 'football',
        intentType: 'analyze',
        rawInput: 'Analyze Real Madrid vs Barcelona',
      },
      {
        language: 'en',
      },
    );

    expect(adapterCalls).toEqual(['football_empty_override', 'football_custom_primary']);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventId: 'custom-1',
      title: 'Real Madrid vs Barcelona',
    });
    expect(injectedPack.sourceAdapters.map((adapter) => adapter.id)).toEqual([
      'football_empty_override',
      'football_custom_primary',
    ]);
  });

  it('resolves event refs for a concrete football analysis command', async () => {
    const intent = await footballRuntimePack.resolver.resolveIntent(
      'Analyze Real Madrid vs Barcelona',
      {
        language: 'en',
      },
    );

    expect(intent?.intentType).toBe('analyze');
    expect(intent?.targetType).toBe('event');
    expect(intent?.eventRefs?.[0]).toMatchObject({
      eventType: 'match',
      title: 'Real Madrid vs Barcelona',
    });
  });

  it('resolves football events through the runtime resolver', async () => {
    const events = await footballRuntimePack.resolver.resolveEvents(
      {
        domainId: 'football',
        intentType: 'analyze',
        rawInput: 'Analyze Real Madrid vs Barcelona',
      },
      {
        language: 'en',
      },
    );

    expect(events[0]).toMatchObject({
      eventType: 'match',
      title: 'Real Madrid vs Barcelona',
    });
  });

  it('aborts football event resolution when the resolver context signal is cancelled', async () => {
    await expect(
      footballRuntimePack.resolver.resolveEvents(
        {
          domainId: 'football',
          intentType: 'analyze',
          rawInput: 'Analyze Real Madrid vs Barcelona',
        },
        {
          language: 'en',
          signal: createAbortedSignal(),
        },
      ),
    ).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('aborts the football query tool when the runtime signal is already cancelled', async () => {
    const queryTool = footballRuntimePack.tools.find((tool) => tool.id === 'football_query_local_matches');
    expect(queryTool).toBeTruthy();

    await expect(
      queryTool!.execute({
        input: 'What Premier League matches are on tomorrow?',
        language: 'en',
        session: createSession(),
        intent: {
          domainId: 'football',
          intentType: 'query',
          rawInput: 'What Premier League matches are on tomorrow?',
        },
        signal: createAbortedSignal(),
      }),
    ).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('starts a task-intake workflow when the runtime tool needs clarification', async () => {
    const prepareTool = footballRuntimePack.tools.find(
      (tool) => tool.id === 'football_prepare_task_intake',
    );
    expect(prepareTool).toBeTruthy();

    const result = await prepareTool!.execute({
      input: 'Tonight at 20:00 analyze Real Madrid vs Barcelona',
      language: 'en',
      session: createSession(),
      intent: {
        domainId: 'football',
        intentType: 'analyze',
        rawInput: 'Tonight at 20:00 analyze Real Madrid vs Barcelona',
      },
    });

    expect(result.blocks[0].blockType).toBe('assistant_text');
    expect(result.sessionPatch?.activeWorkflow?.workflowType).toBe(
      FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE,
    );
  });

  it('resumes the football task-intake workflow through the runtime workflow handler', async () => {
    const workflow = footballRuntimePack.workflows?.[0];
    const workflowState: SessionWorkflowStateSnapshot = {
      workflowType: FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE,
      stateData: {
        id: 'pending_1',
        sourceText: 'Tonight at 20:00 analyze Real Madrid vs Barcelona',
        composerMode: 'smart',
        drafts: [],
        stage: 'await_factors',
        createdAt: Date.now(),
      },
    };

    expect(parsePendingTaskFromWorkflow(workflowState)?.stage).toBe('await_factors');

    const result = await workflow!.resume({
      input: 'fundamentals and market',
      language: 'en',
      session: createSession(),
      workflow: workflowState,
    });

    expect(result.workflowHandled).toBe(true);
    expect(result.blocks[0].text).toContain('analysis order');
    expect(result.sessionPatch?.activeWorkflow?.workflowType).toBe(
      FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE,
    );
  });

  it('aborts the football workflow handler when the runtime signal is already cancelled', async () => {
    const workflow = footballRuntimePack.workflows?.[0];
    const workflowState: SessionWorkflowStateSnapshot = {
      workflowType: FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE,
      stateData: {
        id: 'pending_1',
        sourceText: 'Tonight at 20:00 analyze Real Madrid vs Barcelona',
        composerMode: 'smart',
        drafts: [],
        stage: 'await_factors',
        createdAt: Date.now(),
      },
    };

    await expect(
      workflow!.resume({
        input: 'fundamentals and market',
        language: 'en',
        session: createSession(),
        workflow: workflowState,
        signal: createAbortedSignal(),
      }),
    ).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
