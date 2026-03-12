import { describe, expect, it } from 'vitest';
import type { ManagerSessionProjection } from '@/src/services/manager-gateway/types';
import {
  createCommandCenterWelcomeFeed,
  projectManagerSessionProjectionToCommandCenterFeed,
} from '@/src/pages/command/feedAdapter';

function createProjection(): ManagerSessionProjection {
  return {
    session: {
      id: 'session_main',
      sessionKey: 'manager:main',
      title: 'Main session',
      status: 'active',
      domainId: 'football',
      runtimeDomainVersion: '1.0.0',
      activeWorkflowType: null,
      activeWorkflowStateData: null,
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

    expect(items).toHaveLength(2);
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
  });

  it('builds a static welcome feed for empty-state fallback', () => {
    const items = createCommandCenterWelcomeFeed('en');

    expect(items).toEqual([
      {
        id: 'command_center_welcome_en',
        role: 'assistant',
        blockType: 'assistant_text',
        text:
          'The manager agent is ready. Ask what matches are on today, or tell me which match to analyze and when. I will query local synced data first, then arrange the analysis task in the conversation.',
        createdAt: 0,
      },
    ]);
  });
});
