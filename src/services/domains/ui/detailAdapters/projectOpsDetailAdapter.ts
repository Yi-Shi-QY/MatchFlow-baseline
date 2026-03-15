import React from 'react';
import MatchDetail from '@/src/pages/MatchDetail';
import ProjectOpsSubjectDetail from '@/src/pages/subject/ProjectOpsSubjectDetail';
import type { DomainSubjectDetailAdapter } from '@/src/services/domains/ui/detailRegistry';

function shouldRenderAnalysisWorkbench(routeState: unknown): boolean {
  if (!routeState || typeof routeState !== 'object' || Array.isArray(routeState)) {
    return false;
  }

  const value = routeState as Record<string, unknown>;
  return value.openAnalysisWorkbench === true || value.autoStartAnalysis === true;
}

export const projectOpsDetailAdapter: DomainSubjectDetailAdapter = {
  domainId: 'project_ops',
  canRender(subjectType) {
    return (
      subjectType === 'match' ||
      subjectType === 'project' ||
      subjectType === 'task' ||
      subjectType === 'initiative'
    );
  },
  buildViewModel(input) {
    return {
      element: shouldRenderAnalysisWorkbench(input.routeState)
        ? React.createElement(MatchDetail)
        : React.createElement(ProjectOpsSubjectDetail, input),
    };
  },
};

export const DOMAIN_SUBJECT_DETAIL_ADAPTERS = [projectOpsDetailAdapter];
