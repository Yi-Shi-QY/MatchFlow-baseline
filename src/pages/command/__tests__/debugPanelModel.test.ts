import { describe, expect, it } from 'vitest';
import type { ManagerSessionProjection } from '@/src/services/manager-gateway/types';
import { projectManagerSessionProjectionToDebugModel } from '@/src/pages/command/debugPanelModel';

function createProjection(): ManagerSessionProjection {
  return {
    session: {
      id: 'session_main',
      sessionKey: 'manager:main',
      title: 'Football',
      status: 'active',
      domainId: 'football',
      runtimeDomainVersion: '1.0.0',
      activeWorkflowType: null,
      activeWorkflowStateData: null,
      latestSummaryId: 'summary_1',
      latestMessageAt: 300,
      createdAt: 100,
      updatedAt: 300,
    },
    runtimeDomainId: 'football',
    runtimeDomainVersion: '1.0.0',
    activeRun: null,
    latestRun: null,
    activeWorkflow: null,
    feed: [],
    contextUsage: {
      fragmentCount: 3,
      tokenEstimate: 128,
      summaryId: 'summary_1',
      memoryCount: 1,
    },
    contextSnapshot: {
      assembledAt: 1710000000000,
      recentMessageCount: 4,
      summaryId: 'summary_1',
      memoryCount: 1,
      fragments: [
        {
          id: 'summary:summary_1',
          category: 'summary',
          priority: 100,
          text: 'Transcript summary through ordinal 6.',
          metadata: {
            summaryId: 'summary_1',
            cutoffOrdinal: 6,
          },
        },
        {
          id: 'memory:memory_1',
          category: 'memory',
          priority: 80,
          text: 'preferred_sequence: fundamental -> market -> prediction',
          metadata: {
            scopeType: 'domain',
            scopeId: 'football',
          },
        },
        {
          id: 'runtime_state',
          category: 'runtime_state',
          priority: 50,
          text: 'Session title: Football',
        },
      ],
    },
  };
}

describe('command center debug panel model', () => {
  it('projects manager context snapshot into metrics and fragment entries', () => {
    const model = projectManagerSessionProjectionToDebugModel(createProjection(), 'en');

    expect(model?.title).toBe('Context Debug');
    expect(model?.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'fragments',
          value: '3',
        }),
        expect.objectContaining({
          id: 'summary',
          value: 'summary_1',
        }),
      ]),
    );
    expect(model?.fragments).toHaveLength(3);
    expect(model?.fragments[0]).toMatchObject({
      category: 'summary',
      categoryLabel: 'Summary',
      metadataLines: ['summaryId: summary_1', 'cutoffOrdinal: 6'],
    });
    expect(model?.assembledAtLabel.length).toBeGreaterThan(0);
  });

  it('returns null when the projection does not have a context snapshot', () => {
    expect(
      projectManagerSessionProjectionToDebugModel(
        {
          ...createProjection(),
          contextSnapshot: undefined,
        },
        'en',
      ),
    ).toBeNull();
  });
});
