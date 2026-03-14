import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAnalysisConfigAdapterForSubject: vi.fn(),
  getAnalysisConfigAdapterForSnapshot: vi.fn(),
}));

vi.mock('@/src/services/analysisConfigRegistry', () => ({
  getAnalysisConfigAdapterForSubject: mocks.getAnalysisConfigAdapterForSubject,
  getAnalysisConfigAdapterForSnapshot: mocks.getAnalysisConfigAdapterForSnapshot,
}));

describe('analysisConfig', () => {
  beforeEach(() => {
    mocks.getAnalysisConfigAdapterForSubject.mockReset();
    mocks.getAnalysisConfigAdapterForSnapshot.mockReset();
  });

  it('returns null when no subject config adapter is available', async () => {
    mocks.getAnalysisConfigAdapterForSubject.mockReturnValue(null);
    const { fetchSubjectAnalysisConfig } = await import('@/src/services/analysisConfig');

    await expect(
      fetchSubjectAnalysisConfig({
        domainId: 'project_ops',
        subjectId: 'task-1',
        subjectType: 'task',
      }),
    ).resolves.toBeNull();
  });

  it('delegates subject config fetches to the resolved adapter', async () => {
    const adapter = {
      fetchSubjectConfig: vi.fn().mockResolvedValue({
        subjectId: 'match-1',
        sourceContext: {
          domainId: 'football',
          planning: {
            mode: 'default',
          },
        },
      }),
    };
    mocks.getAnalysisConfigAdapterForSubject.mockReturnValue(adapter);
    const { fetchSubjectAnalysisConfig } = await import('@/src/services/analysisConfig');

    const result = await fetchSubjectAnalysisConfig({
      domainId: 'football',
      subjectId: 'match-1',
      subjectType: 'match',
    });

    expect(adapter.fetchSubjectConfig).toHaveBeenCalledWith({
      domainId: 'football',
      subjectId: 'match-1',
      subjectType: 'match',
    });
    expect(result?.sourceContext?.domainId).toBe('football');
  });

  it('delegates config resolution and planning merges to the resolved adapter', async () => {
    const adapter = {
      resolveSubjectConfig: vi.fn().mockResolvedValue({
        subjectId: 'task-1',
        sourceContext: {
          domainId: 'project_ops',
        },
      }),
      mergePlanning: vi.fn().mockImplementation((payload: any, config: any) => ({
        ...payload,
        mergedPlanning: config?.sourceContext?.domainId || null,
      })),
    };
    mocks.getAnalysisConfigAdapterForSnapshot.mockReturnValue(adapter);
    const {
      mergeServerPlanningIntoAnalysisPayload,
      resolveSubjectAnalysisConfig,
    } = await import('@/src/services/analysisConfig');

    const payload = {
      sourceContext: {
        domainId: 'project_ops',
      },
    };
    const config = await resolveSubjectAnalysisConfig(payload);
    const merged = mergeServerPlanningIntoAnalysisPayload(payload, config);

    expect(adapter.resolveSubjectConfig).toHaveBeenCalledWith(payload);
    expect(adapter.mergePlanning).toHaveBeenCalledWith(payload, config);
    expect(merged).toEqual({
      sourceContext: {
        domainId: 'project_ops',
      },
      mergedPlanning: 'project_ops',
    });
  });
});
