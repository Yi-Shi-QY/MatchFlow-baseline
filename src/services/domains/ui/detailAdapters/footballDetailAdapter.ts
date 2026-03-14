import React from 'react';
import MatchDetail from '@/src/pages/MatchDetail';
import type { DomainSubjectDetailAdapter } from '@/src/services/domains/ui/detailRegistry';

export const footballDetailAdapter: DomainSubjectDetailAdapter = {
  domainId: 'football',
  canRender(subjectType) {
    return subjectType === 'match';
  },
  buildViewModel() {
    return {
      element: React.createElement(MatchDetail),
    };
  },
};

export const DOMAIN_SUBJECT_DETAIL_ADAPTERS = [footballDetailAdapter];
