import type { Match } from '@/src/data/matches';
import { cloneMatch } from '@/src/services/domains/modules/shared/cloneMatch';
import type {
  DomainEvent,
  DomainQueryResult,
  DomainRuntimePack,
} from './types';

export interface RuntimeDomainSourceResult {
  adapterId: string;
  result: DomainQueryResult;
}

function hasPayload(result: DomainQueryResult): boolean {
  return (
    (Array.isArray(result.subjects) && result.subjects.length > 0) ||
    (Array.isArray(result.events) && result.events.length > 0) ||
    (Array.isArray(result.signals) && result.signals.length > 0)
  );
}

function isMatchLike(input: unknown): input is Match {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return false;
  }

  const value = input as Record<string, unknown>;
  return (
    typeof value.id === 'string' &&
    typeof value.league === 'string' &&
    typeof value.date === 'string' &&
    value.homeTeam !== null &&
    typeof value.homeTeam === 'object' &&
    value.awayTeam !== null &&
    typeof value.awayTeam === 'object'
  );
}

async function resolveRuntimePack(input: {
  domainId: string;
  runtimePack?: DomainRuntimePack;
}): Promise<DomainRuntimePack> {
  if (input.runtimePack) {
    return input.runtimePack;
  }

  const { resolveRuntimeDomainPack } = await import('./registry');
  return resolveRuntimeDomainPack(input.domainId);
}

export async function queryRuntimeDomainSourceResults(input: {
  domainId: string;
  queryType: string;
  filters?: Record<string, unknown>;
  signal?: AbortSignal;
  runtimePack?: DomainRuntimePack;
}): Promise<RuntimeDomainSourceResult[]> {
  const runtimePack = await resolveRuntimePack(input);
  const results: RuntimeDomainSourceResult[] = [];

  for (const adapter of runtimePack.sourceAdapters) {
    if (
      !adapter.supports({
        domainId: input.domainId,
        queryType: input.queryType,
      })
    ) {
      continue;
    }

    const result = await adapter.query({
      domainId: input.domainId,
      queryType: input.queryType,
      filters: input.filters,
      signal: input.signal,
    });
    results.push({
      adapterId: adapter.id,
      result,
    });
  }

  return results;
}

export async function queryFirstRuntimeDomainSourceResult(input: {
  domainId: string;
  queryType: string;
  filters?: Record<string, unknown>;
  signal?: AbortSignal;
  runtimePack?: DomainRuntimePack;
}): Promise<RuntimeDomainSourceResult | null> {
  const results = await queryRuntimeDomainSourceResults(input);
  return results.find((entry) => hasPayload(entry.result)) || null;
}

export function extractMatchesFromRuntimeEvents(events: DomainEvent[] | undefined): Match[] {
  return (events || [])
    .map((event) => event.metadata?.matchData)
    .filter(isMatchLike)
    .map((match) => cloneMatch(match));
}

export async function queryRuntimeDomainEventList(input: {
  domainId: string;
  filters?: Record<string, unknown>;
  signal?: AbortSignal;
  runtimePack?: DomainRuntimePack;
  queryType?: string;
}): Promise<DomainEvent[]> {
  const runtimePack = await resolveRuntimePack(input);
  const queryType = input.queryType || runtimePack.queryCatalog?.eventListQueryType;
  if (!queryType) {
    return [];
  }

  const result = await queryFirstRuntimeDomainSourceResult({
    domainId: input.domainId,
    queryType,
    filters: input.filters,
    signal: input.signal,
    runtimePack,
  });

  return result?.result.events || [];
}

export async function queryRuntimeDomainMatchList(input: {
  domainId: string;
  filters?: Record<string, unknown>;
  signal?: AbortSignal;
  runtimePack?: DomainRuntimePack;
  queryType?: string;
}): Promise<Match[]> {
  const runtimePack = await resolveRuntimePack(input);
  const queryType = input.queryType || runtimePack.queryCatalog?.matchListQueryType;
  if (!queryType) {
    return [];
  }

  const events = await queryRuntimeDomainEventList({
    domainId: input.domainId,
    filters: input.filters,
    signal: input.signal,
    runtimePack,
    queryType,
  });

  return extractMatchesFromRuntimeEvents(events);
}
