import React from 'react';
import {
  getDomainSubjectDetailAdapter,
} from '@/src/services/domains/ui/detailRegistry';
import { useSubjectDetailState } from '@/src/pages/subject/useSubjectDetailState';

export default function SubjectDetailPage() {
  const state = useSubjectDetailState();
  const adapter = getDomainSubjectDetailAdapter({
    domainId: state.domainId,
    subjectType: state.subjectType,
  });

  if (!adapter) {
    return (
      <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center px-6 text-center">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Subject Workspace
          </div>
          <div className="text-lg font-semibold text-white">
            No detail adapter registered
          </div>
          <div className="text-sm text-zinc-400">
            {state.domainId} / {state.subjectType} / {state.subjectId}
          </div>
        </div>
      </div>
    );
  }

  return adapter.buildViewModel({
    domain: state.domain,
    domainId: state.domainId,
    subjectId: state.subjectId,
    subjectType: state.subjectType,
    routeState: state.routeState,
  }).element;
}
