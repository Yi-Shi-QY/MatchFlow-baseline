import React from 'react';
import ProjectOpsSubjectDetail from '@/src/pages/subject/ProjectOpsSubjectDetail';
import type { DomainSubjectDetailAdapter } from '@/src/services/domains/ui/detailRegistry';

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
      element: React.createElement(ProjectOpsSubjectDetail, input),
    };
  },
};

export const DOMAIN_SUBJECT_DETAIL_ADAPTERS = [projectOpsDetailAdapter];
