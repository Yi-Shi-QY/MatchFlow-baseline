import { MOCK_MATCHES, type Match } from '@/src/data/matches';
import {
  extractMatchesFromRuntimeEvents,
  queryRuntimeDomainEventList,
} from '@/src/domains/runtime/sourceQueries';
import type {
  DomainEvent,
  DomainRuntimePack,
} from '@/src/domains/runtime/types';
import { getBuiltinDomainLocalSubjectSnapshots } from '@/src/services/domains/builtinModules';
import { cloneMatch } from '@/src/services/domains/modules/shared/cloneMatch';

export interface ResolveDomainFeedInput {
  domainId: string;
  allowRuntime?: boolean;
  filters?: Record<string, unknown>;
  queryType?: string;
  runtimePack?: DomainRuntimePack | null;
  signal?: AbortSignal;
}

export interface ResolveDomainEventFeedInput extends ResolveDomainFeedInput {}
export interface ResolveDomainMatchFeedInput extends ResolveDomainFeedInput {}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'AbortError'
  );
}

function cloneMockMatches(): Match[] {
  return MOCK_MATCHES.map((match) => cloneMatch(match));
}

function isDomainEventLike(input: unknown): input is DomainEvent {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return false;
  }

  const value = input as Record<string, unknown>;
  return (
    typeof value.domainId === 'string' &&
    typeof value.eventType === 'string' &&
    typeof value.eventId === 'string' &&
    typeof value.title === 'string' &&
    Array.isArray(value.subjectRefs)
  );
}

function extractEventsFromNormalizedOutput(input: unknown): DomainEvent[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.filter(isDomainEventLike);
}

async function resolveRuntimePack(
  input: ResolveDomainFeedInput,
): Promise<DomainRuntimePack | null> {
  if (input.runtimePack !== undefined) {
    return input.runtimePack;
  }

  const { getRuntimeDomainPackById } = await import('@/src/domains/runtime/registry');
  return getRuntimeDomainPackById(input.domainId);
}

function normalizeLegacyMatchesToEvents(input: {
  matches: Match[];
  domainId: string;
  queryType?: string;
  runtimePack: DomainRuntimePack | null;
}): DomainEvent[] {
  if (!input.runtimePack || input.matches.length === 0) {
    return [];
  }

  const queryType =
    input.queryType ||
    input.runtimePack.queryCatalog?.eventListQueryType ||
    input.runtimePack.queryCatalog?.matchListQueryType;
  if (!queryType) {
    return [];
  }

  for (const adapter of input.runtimePack.sourceAdapters) {
    if (
      !adapter.supports({
        domainId: input.domainId,
        queryType,
      })
    ) {
      continue;
    }

    const normalized = extractEventsFromNormalizedOutput(adapter.normalize(input.matches));
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return [];
}

function resolveLegacyMatches(domainId: string): Match[] {
  const domainCases = getBuiltinDomainLocalSubjectSnapshots(domainId);
  if (domainCases.length > 0) {
    return domainCases;
  }

  return cloneMockMatches();
}

export async function resolveDomainEventFeed(
  input: ResolveDomainEventFeedInput,
): Promise<DomainEvent[]> {
  const runtimePack = await resolveRuntimePack(input);
  const queryType =
    input.queryType ||
    runtimePack?.queryCatalog?.eventListQueryType ||
    runtimePack?.queryCatalog?.matchListQueryType;

  if (input.allowRuntime !== false) {
    try {
      if (runtimePack && queryType) {
        const runtimeEvents = await queryRuntimeDomainEventList({
          domainId: input.domainId,
          filters: input.filters,
          queryType,
          runtimePack,
          signal: input.signal,
        });
        if (runtimeEvents.length > 0) {
          return runtimeEvents;
        }
      }
    } catch (error) {
      if (input.signal?.aborted || isAbortError(error)) {
        throw error;
      }
      console.warn(
        `Failed to resolve runtime events for domain "${input.domainId}", falling back to local cases.`,
        error,
      );
    }
  }

  const domainCases = getBuiltinDomainLocalSubjectSnapshots(input.domainId);
  const builtinEvents = normalizeLegacyMatchesToEvents({
    matches: domainCases,
    domainId: input.domainId,
    queryType,
    runtimePack,
  });
  if (builtinEvents.length > 0) {
    return builtinEvents;
  }

  const mockEvents = normalizeLegacyMatchesToEvents({
    matches: cloneMockMatches(),
    domainId: input.domainId,
    queryType,
    runtimePack,
  });
  if (mockEvents.length > 0) {
    return mockEvents;
  }

  return [];
}

export async function resolveDomainMatchFeed(
  input: ResolveDomainMatchFeedInput,
): Promise<Match[]> {
  const runtimePack = await resolveRuntimePack(input);
  const queryType =
    input.queryType ||
    runtimePack?.queryCatalog?.matchListQueryType ||
    runtimePack?.queryCatalog?.eventListQueryType;
  const events = await resolveDomainEventFeed({
    ...input,
    runtimePack,
    queryType,
  });
  const matches = extractMatchesFromRuntimeEvents(events);

  if (matches.length > 0) {
    return matches;
  }

  return resolveLegacyMatches(input.domainId);
}
