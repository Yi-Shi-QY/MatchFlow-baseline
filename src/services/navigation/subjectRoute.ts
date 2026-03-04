function normalizeRouteSegment(input: string, fallback: string): string {
  const value = String(input || '').trim();
  return value.length > 0 ? value : fallback;
}

export function buildSubjectRoute(domainId: string, subjectId: string): string {
  const normalizedDomainId = normalizeRouteSegment(domainId, 'football');
  const normalizedSubjectId = normalizeRouteSegment(subjectId, 'unknown_subject');
  return `/subject/${encodeURIComponent(normalizedDomainId)}/${encodeURIComponent(normalizedSubjectId)}`;
}

export function buildLegacyMatchRoute(subjectId: string): string {
  const normalizedSubjectId = normalizeRouteSegment(subjectId, 'unknown_subject');
  return `/match/${encodeURIComponent(normalizedSubjectId)}`;
}
