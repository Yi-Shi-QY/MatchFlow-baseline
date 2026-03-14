import {
  getAnalysisConfigAdapterForSnapshot,
  getAnalysisConfigAdapterForSubject,
  type AnalysisConfigSubjectRef,
  type SubjectAnalysisConfigPayload,
} from './analysisConfigRegistry';

export type { AnalysisConfigSubjectRef, SubjectAnalysisConfigPayload };

export async function fetchSubjectAnalysisConfig(
  subjectRef: AnalysisConfigSubjectRef,
): Promise<SubjectAnalysisConfigPayload | null> {
  const adapter = getAnalysisConfigAdapterForSubject(subjectRef);
  if (!adapter) {
    return null;
  }
  return adapter.fetchSubjectConfig(subjectRef);
}

export async function resolveSubjectAnalysisConfig(
  subjectSnapshot: any,
): Promise<SubjectAnalysisConfigPayload | null> {
  const adapter = getAnalysisConfigAdapterForSnapshot(subjectSnapshot);
  if (!adapter) {
    return null;
  }
  return adapter.resolveSubjectConfig(subjectSnapshot);
}

export function mergeServerPlanningIntoAnalysisPayload(
  subjectPayload: any,
  config: SubjectAnalysisConfigPayload | null,
): any {
  const adapter = getAnalysisConfigAdapterForSnapshot(subjectPayload);
  if (!adapter) {
    return subjectPayload;
  }
  return adapter.mergePlanning(subjectPayload, config);
}

