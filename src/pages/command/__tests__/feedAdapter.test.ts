import { describe, expect, it } from 'vitest';
import type { ManagerSessionProjection } from '@/src/services/manager-gateway/types';
import { resolveRuntimeManagerHelpText } from '@/src/services/manager/runtimeIntentRouter';
import {
  createCommandCenterWelcomeFeed,
  projectManagerSessionProjectionToCommandCenterFeed,
} from '@/src/pages/command/feedAdapter';

function createProjection(): ManagerSessionProjection {
  return {
    session: {
      id: 'session_main',
      sessionKey: 'manager:main',
      sessionKind: 'domain_main',
      title: 'Main session',
      status: 'active',
      domainId: 'football',
      runtimeDomainVersion: '1.0.0',
      activeWorkflowType: null,
      activeWorkflowStateData: null,
      compositeWorkflowStateData: null,
      latestSummaryId: null,
      latestMessageAt: 300,
      createdAt: 100,
      updatedAt: 300,
    },
    runtimeDomainId: 'football',
    runtimeDomainVersion: '1.0.0',
    activeRun: null,
    latestRun: null,
    activeWorkflow: null,
    compositeWorkflow: null,
    feed: [
      {
        id: 'msg_user_1',
        role: 'user',
        blockType: 'user_text',
        text: 'Analyze Arsenal vs Chelsea tonight',
        payloadData: null,
        createdAt: 100,
      },
      {
        id: 'msg_agent_1',
        role: 'assistant',
        blockType: 'draft_bundle',
        text: 'I prepared one draft.',
        payloadData: JSON.stringify({
          draftIds: ['draft_1'],
          action: {
            type: 'open_settings',
            label: 'Open Settings',
          },
        }),
        createdAt: 200,
      },
      {
        id: 'msg_tool_1',
        role: 'assistant',
        blockType: 'tool_result',
        text: 'Completed "Analyze Arsenal vs Chelsea tonight". The result is ready to review.',
        payloadData: JSON.stringify({
          schemaVersion: 1,
          automationEvent: {
            source: 'automation_executor',
            phase: 'completed',
            route: '/subject/football/match-1',
            title: 'Analyze Arsenal vs Chelsea tonight',
            provider: 'openai',
            model: 'gpt-5',
            totalTokens: 320,
          },
        }),
        createdAt: 250,
      },
      {
        id: 'msg_nav_1',
        role: 'system',
        blockType: 'navigation_intent',
        text: null,
        payloadData: JSON.stringify({
          route: '/subject/football/match-1',
        }),
        createdAt: 300,
      },
    ],
  };
}

describe('command center feed adapter', () => {
  it('renders command-center items from projection feed blocks without any legacy snapshot shape', () => {
    const projection = createProjection();
    const items = projectManagerSessionProjectionToCommandCenterFeed(projection);

    expect((projection as unknown as Record<string, unknown>).messages).toBeUndefined();

    expect(items).toHaveLength(4);
    expect(items[0]).toMatchObject({
      id: 'msg_user_1',
      role: 'user',
      blockType: 'user_text',
      text: 'Analyze Arsenal vs Chelsea tonight',
    });
    expect(items[1]).toMatchObject({
      id: 'msg_agent_1',
      role: 'assistant',
      blockType: 'draft_bundle',
      text: 'I prepared one draft.',
      draftIds: ['draft_1'],
      action: {
        type: 'open_settings',
        label: 'Open Settings',
      },
    });
    expect(items[2]).toMatchObject({
      id: 'msg_tool_1',
      role: 'assistant',
      blockType: 'tool_result',
      automationEvent: {
        source: 'automation_executor',
        phase: 'completed',
        route: '/subject/football/match-1',
        title: 'Analyze Arsenal vs Chelsea tonight',
        provider: 'openai',
        model: 'gpt-5',
        totalTokens: 320,
      },
    });
    expect(items[3]).toMatchObject({
      id: 'msg_nav_1',
      role: 'system',
      blockType: 'navigation_intent',
      navigationIntent: {
        route: '/subject/football/match-1',
      },
    });
  });

  it('builds a static welcome feed for empty-state fallback', () => {
    const items = createCommandCenterWelcomeFeed('en');

    expect(items).toEqual([
      {
        id: 'command_center_welcome_en',
        role: 'assistant',
        blockType: 'assistant_text',
        text: resolveRuntimeManagerHelpText({
          domainId: 'football',
          language: 'en',
        }),
        createdAt: 0,
      },
    ]);
  });

  it('builds a domain-aware project ops welcome feed', () => {
    const items = createCommandCenterWelcomeFeed('en', 'project_ops');

    expect(items[0]?.text).toContain('project, task, or initiative');
  });

  it('projects supervisor composite child summaries even when they are only stored on the workflow items', () => {
    const items = projectManagerSessionProjectionToCommandCenterFeed({
      ...createProjection(),
      session: {
        ...createProjection().session,
        sessionKey: 'manager:main:supervisor',
        sessionKind: 'supervisor',
        domainId: 'football',
      },
      feed: [],
      activeWorkflow: null,
      compositeWorkflow: {
        schemaVersion: 'manager_composite_v1',
        workflowId: 'manager_composite_1',
        workflowType: 'manager_composite',
        sourceText: 'Analyze football and project ops',
        status: 'active',
        activeItemId: 'item_project_ops',
        createdAt: 100,
        updatedAt: 200,
        items: [
          {
            itemId: 'item_football',
            title: 'Real Madrid vs Barcelona',
            domainId: 'football',
            sourceText: 'Analyze Real Madrid vs Barcelona',
            status: 'completed',
            summary: 'Football analysis configured.',
          },
          {
            itemId: 'item_project_ops',
            title: 'Q2 mobile launch blockers',
            domainId: 'project_ops',
            sourceText: 'Review Q2 mobile launch blockers',
            status: 'active',
            pendingLabel: 'Choose focus areas',
            summary: 'Project ops intake is waiting for focus areas.',
          },
        ],
      },
    });

    expect(items.map((item) => item.text)).toEqual([
      '[Football] Football analysis configured.',
      '[Project Ops] Project ops intake is waiting for focus areas.',
    ]);
    expect(items.every((item) => item.role === 'assistant')).toBe(true);
  });
});
