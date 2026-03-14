import { DEFAULT_DOMAIN_ID } from '@/src/services/domains/builtinModules';
import { getSettings } from '@/src/services/settings';

function normalizeRouteSegment(input: string, fallback: string): string {
  const value = String(input || '').trim();
  return value.length > 0 ? value : fallback;
}

function resolveDefaultRouteDomainId(): string {
  return getSettings().activeDomainId || DEFAULT_DOMAIN_ID;
}

export interface SubjectRouteRef {
  domainId: string;
  subjectId: string;
}

export function buildSubjectRoute(domainId: string, subjectId: string): string {
  const normalizedDomainId = normalizeRouteSegment(domainId, resolveDefaultRouteDomainId());
  const normalizedSubjectId = normalizeRouteSegment(subjectId, 'unknown_subject');
  return `/subject/${encodeURIComponent(normalizedDomainId)}/${encodeURIComponent(normalizedSubjectId)}`;
}

export function buildSubjectRouteFromRef(ref: SubjectRouteRef): string {
  return buildSubjectRoute(ref.domainId, ref.subjectId);
}

export function parseSubjectRoute(pathname: string): SubjectRouteRef | null {
  const match = String(pathname || '').trim().match(/^\/subject\/([^/]+)\/([^/]+)$/i);
  if (!match) {
    return null;
  }

  return {
    domainId: decodeURIComponent(match[1]),
    subjectId: decodeURIComponent(match[2]),
  };
}
