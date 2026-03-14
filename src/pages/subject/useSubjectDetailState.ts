import { useLocation, useParams } from 'react-router-dom';
import {
  getActiveAnalysisDomain,
  getAnalysisDomainById,
} from '@/src/services/domains/registry';
import type { AnalysisDomain } from '@/src/services/domains/types';

export interface SubjectDetailStateModel {
  domain: AnalysisDomain;
  domainId: string;
  subjectId: string;
  subjectType: string;
  routeState: unknown;
}

function normalizeRouteSegment(input: unknown): string {
  return typeof input === 'string' && input.trim().length > 0 ? decodeURIComponent(input) : '';
}

function resolveSubjectType(state: unknown): string {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return 'match';
  }

  const value = state as Record<string, unknown>;
  const candidates = [
    value.subjectType,
    value.importedData &&
    typeof value.importedData === 'object' &&
    !Array.isArray(value.importedData)
      ? (value.importedData as Record<string, unknown>).subjectType
      : null,
    value.subjectSnapshot &&
    typeof value.subjectSnapshot === 'object' &&
    !Array.isArray(value.subjectSnapshot)
      ? (value.subjectSnapshot as Record<string, unknown>).subjectType
      : null,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return 'match';
}

export function useSubjectDetailState(): SubjectDetailStateModel {
  const params = useParams();
  const location = useLocation();
  const routeDomainId = normalizeRouteSegment(params.domainId);
  const routeSubjectId = normalizeRouteSegment(params.subjectId);
  const domain =
    getAnalysisDomainById(routeDomainId) || getActiveAnalysisDomain();

  return {
    domain,
    domainId: domain.id,
    subjectId: routeSubjectId,
    subjectType: resolveSubjectType(location.state),
    routeState: location.state,
  };
}
