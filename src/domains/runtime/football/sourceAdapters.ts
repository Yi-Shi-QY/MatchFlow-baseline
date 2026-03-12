import type { Match } from '@/src/data/matches';
import { MOCK_MATCHES } from '@/src/data/matches';
import { cloneMatch } from '@/src/services/domains/modules/shared/cloneMatch';
import { getBuiltinDomainLocalSubjectSnapshots } from '@/src/services/domains/builtinModules';
import { fetchMatches } from '@/src/services/matchData';
import type {
  DomainEvent,
  DomainQueryResult,
  DomainSourceAdapter,
} from '../types';

export const FOOTBALL_MATCH_LIST_QUERY = 'football_match_list';

export interface FootballMatchFilters extends Record<string, unknown> {
  matchDate?: string;
  statuses?: string[];
  leagueTerms?: string[];
}

function createAbortError(): Error & { name: string } {
  const error = new Error('Football source query aborted') as Error & { name: string };
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return;
  }

  throw createAbortError();
}

function toLocalDateKey(input: string | number | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeStringList(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0),
    ),
  );
}

function normalizeFilters(input: unknown): FootballMatchFilters {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  const value = input as Record<string, unknown>;
  return {
    matchDate:
      typeof value.matchDate === 'string' && value.matchDate.trim().length > 0
        ? value.matchDate.trim()
        : undefined,
    statuses: normalizeStringList(
      Array.isArray(value.statuses)
        ? value.statuses.filter((entry): entry is string => typeof entry === 'string')
        : undefined,
    ),
    leagueTerms: normalizeStringList(
      Array.isArray(value.leagueTerms)
        ? value.leagueTerms.filter((entry): entry is string => typeof entry === 'string')
        : undefined,
    ),
  };
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
    typeof value.status === 'string' &&
    value.homeTeam !== null &&
    typeof value.homeTeam === 'object' &&
    value.awayTeam !== null &&
    typeof value.awayTeam === 'object'
  );
}

function filterMatches(matches: Match[], filters: FootballMatchFilters): Match[] {
  const normalizedStatuses = normalizeStringList(filters.statuses);
  const normalizedLeagueTerms = normalizeStringList(filters.leagueTerms).map((term) =>
    term.toLowerCase(),
  );

  return matches.filter((match) => {
    if (filters.matchDate && toLocalDateKey(match.date) !== filters.matchDate) {
      return false;
    }

    if (normalizedStatuses.length > 0 && !normalizedStatuses.includes(match.status)) {
      return false;
    }

    if (
      normalizedLeagueTerms.length > 0 &&
      !normalizedLeagueTerms.some((term) => match.league.toLowerCase().includes(term))
    ) {
      return false;
    }

    return true;
  });
}

function toFootballDomainEvent(match: Match): DomainEvent {
  return {
    domainId: 'football',
    eventType: 'match',
    eventId: match.id,
    title: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
    subjectRefs: [
      {
        subjectType: 'team',
        subjectId: match.homeTeam.id,
        role: 'home',
      },
      {
        subjectType: 'team',
        subjectId: match.awayTeam.id,
        role: 'away',
      },
    ],
    startTime: match.date,
    status: match.status,
    metadata: {
      league: match.league,
      kickoffAt: match.date,
      matchData: cloneMatch(match),
    },
  };
}

function toFootballQueryResult(matches: Match[]): DomainQueryResult {
  return {
    events: matches.map((match) => toFootballDomainEvent(match)),
  };
}

function extractMatches(result: DomainQueryResult): Match[] {
  return (result.events || [])
    .map((event) => event.metadata?.matchData)
    .filter(isMatchLike)
    .map((match) => cloneMatch(match));
}

function extractEvents(result: DomainQueryResult): DomainEvent[] {
  return Array.isArray(result.events) ? result.events : [];
}

async function queryRemoteMatches(signal?: AbortSignal): Promise<Match[]> {
  throwIfAborted(signal);
  const matches = await fetchMatches({
    signal,
  });
  throwIfAborted(signal);
  return matches;
}

function queryBuiltinMatches(): Match[] {
  const matches = getBuiltinDomainLocalSubjectSnapshots('football');
  return (matches.length > 0 ? matches : MOCK_MATCHES).map((match) => cloneMatch(match));
}

export const footballRuntimeSourceAdapters: DomainSourceAdapter[] = [
  {
    id: 'football_match_data_server',
    supports(input) {
      return input.domainId === 'football' && input.queryType === FOOTBALL_MATCH_LIST_QUERY;
    },
    async query(input) {
      const filters = normalizeFilters(input.filters);
      const matches = filterMatches(await queryRemoteMatches(input.signal), filters);
      return toFootballQueryResult(matches);
    },
    normalize(input) {
      if (!Array.isArray(input)) {
        return [];
      }

      return input.filter(isMatchLike).map((match) => toFootballDomainEvent(match));
    },
  },
  {
    id: 'football_builtin_match_cases',
    supports(input) {
      return input.domainId === 'football' && input.queryType === FOOTBALL_MATCH_LIST_QUERY;
    },
    async query(input) {
      throwIfAborted(input.signal);
      const filters = normalizeFilters(input.filters);
      const matches = filterMatches(queryBuiltinMatches(), filters);
      throwIfAborted(input.signal);
      return toFootballQueryResult(matches);
    },
    normalize(input) {
      if (!Array.isArray(input)) {
        return [];
      }

      return input.filter(isMatchLike).map((match) => toFootballDomainEvent(match));
    },
  },
];

export async function queryFootballMatchesViaRuntimeAdapters(input: {
  filters?: FootballMatchFilters;
  signal?: AbortSignal;
  adapters?: DomainSourceAdapter[];
} = {}): Promise<Match[]> {
  const adapters = input.adapters || footballRuntimeSourceAdapters;

  for (const adapter of adapters) {
    if (
      !adapter.supports({
        domainId: 'football',
        queryType: FOOTBALL_MATCH_LIST_QUERY,
      })
    ) {
      continue;
    }

    throwIfAborted(input.signal);
    const result = await adapter.query({
      domainId: 'football',
      queryType: FOOTBALL_MATCH_LIST_QUERY,
      filters: input.filters,
      signal: input.signal,
    });
    const matches = extractMatches(result);
    if (matches.length > 0) {
      return matches;
    }
  }

  return [];
}

export async function queryFootballMatchEventsViaRuntimeAdapters(input: {
  filters?: FootballMatchFilters;
  signal?: AbortSignal;
  adapters?: DomainSourceAdapter[];
} = {}): Promise<DomainEvent[]> {
  const adapters = input.adapters || footballRuntimeSourceAdapters;

  for (const adapter of adapters) {
    if (
      !adapter.supports({
        domainId: 'football',
        queryType: FOOTBALL_MATCH_LIST_QUERY,
      })
    ) {
      continue;
    }

    throwIfAborted(input.signal);
    const result = await adapter.query({
      domainId: 'football',
      queryType: FOOTBALL_MATCH_LIST_QUERY,
      filters: input.filters,
      signal: input.signal,
    });
    const events = extractEvents(result);
    if (events.length > 0) {
      return events;
    }
  }

  return [];
}
