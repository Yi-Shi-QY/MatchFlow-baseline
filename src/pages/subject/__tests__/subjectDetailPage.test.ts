import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedUseSubjectDetailState = vi.fn();
const mockedGetDomainSubjectDetailAdapter = vi.fn();

vi.mock('@/src/pages/subject/useSubjectDetailState', () => ({
  useSubjectDetailState: () => mockedUseSubjectDetailState(),
}));

vi.mock('@/src/services/domains/ui/detailRegistry', () => ({
  getDomainSubjectDetailAdapter: (input: { domainId: string; subjectType: string }) =>
    mockedGetDomainSubjectDetailAdapter(input),
}));

describe('SubjectDetailPage', () => {
  beforeEach(() => {
    mockedUseSubjectDetailState.mockReset();
    mockedGetDomainSubjectDetailAdapter.mockReset();
  });

  it('renders the resolved domain detail adapter', async () => {
    mockedUseSubjectDetailState.mockReturnValue({
      domain: {
        id: 'project_ops',
        name: 'Project Ops',
        description: 'Operations',
        dataSources: [],
        getAvailableDataSources: () => [],
        resolveSourceSelection: () => ({}),
        buildSourceCapabilities: () => ({}),
      },
      domainId: 'project_ops',
      subjectId: 'task-1',
      subjectType: 'task',
      routeState: null,
    });
    mockedGetDomainSubjectDetailAdapter.mockReturnValue({
      buildViewModel: () => ({
        element: React.createElement('main', null, 'project ops detail'),
      }),
    });

    const { default: SubjectDetailPage } = await import('@/src/pages/subject/SubjectDetailPage');
    const markup = renderToStaticMarkup(React.createElement(SubjectDetailPage));

    expect(markup).toContain('project ops detail');
    expect(mockedGetDomainSubjectDetailAdapter).toHaveBeenCalledWith({
      domainId: 'project_ops',
      subjectType: 'task',
    });
  });

  it('renders a fallback screen when no adapter is registered', async () => {
    mockedUseSubjectDetailState.mockReturnValue({
      domain: {
        id: 'macro',
        name: 'Macro',
        description: 'Macro',
        dataSources: [],
        getAvailableDataSources: () => [],
        resolveSourceSelection: () => ({}),
        buildSourceCapabilities: () => ({}),
      },
      domainId: 'macro',
      subjectId: 'cpi',
      subjectType: 'timeline',
      routeState: null,
    });
    mockedGetDomainSubjectDetailAdapter.mockReturnValue(null);

    const { default: SubjectDetailPage } = await import('@/src/pages/subject/SubjectDetailPage');
    const markup = renderToStaticMarkup(React.createElement(SubjectDetailPage));

    expect(markup).toContain('No detail adapter registered');
    expect(markup).toContain('macro / timeline / cpi');
  });
});
