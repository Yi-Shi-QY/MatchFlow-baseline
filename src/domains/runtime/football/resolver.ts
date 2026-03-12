import {
  isAnalysisFactorsQuestion,
  isAnalysisSequenceQuestion,
  looksLikeTaskCommand,
} from '@/src/services/managerAgent';
import { looksLikeLocalMatchesQuery } from '@/src/services/manager/toolRegistry';
import type {
  AnalysisIntent,
  DomainEvent,
  DomainResolver,
  DomainSourceAdapter,
  DomainSubject,
  ResolveContext,
} from '../types';
import { queryFootballMatchEventsViaRuntimeAdapters } from './sourceAdapters';

function buildIntent(intentType: AnalysisIntent['intentType'], input: string): AnalysisIntent {
  return {
    domainId: 'football',
    intentType,
    rawInput: input,
  };
}

function toLocalDateKey(input: Date): string {
  const year = input.getFullYear();
  const month = `${input.getMonth() + 1}`.padStart(2, '0');
  const day = `${input.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeSearchText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveRequestedMatchDate(input: string, now: Date): string | undefined {
  const normalized = normalizeSearchText(input);
  if (/(tomorrow|鏄庡ぉ|鏄庢櫄)/i.test(normalized)) {
    const next = new Date(now);
    next.setDate(now.getDate() + 1);
    return toLocalDateKey(next);
  }

  if (/(today|tonight|浠婂ぉ|浠婃櫄)/i.test(normalized)) {
    return toLocalDateKey(now);
  }

  return undefined;
}

function buildRequestedWindow(input: string, now: Date): AnalysisIntent['requestedWindow'] | undefined {
  const matchDate = resolveRequestedMatchDate(input, now);
  if (!matchDate) {
    return undefined;
  }

  return {
    start: matchDate,
    end: matchDate,
  };
}

function extractEventTeamNames(event: DomainEvent): string[] {
  const matchData = event.metadata?.matchData;
  if (!matchData || typeof matchData !== 'object') {
    return [];
  }

  const value = matchData as {
    homeTeam?: {
      name?: string;
    };
    awayTeam?: {
      name?: string;
    };
  };

  return [value.homeTeam?.name, value.awayTeam?.name]
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => normalizeSearchText(entry));
}

function scoreEventAgainstInput(event: DomainEvent, normalizedInput: string): number {
  const normalizedTitle = normalizeSearchText(event.title);
  const teamNames = extractEventTeamNames(event);
  const matchedTeamCount = teamNames.filter((name) => normalizedInput.includes(name)).length;

  if (matchedTeamCount >= 2) {
    return 100 + matchedTeamCount;
  }

  if (matchedTeamCount === 1) {
    return 10;
  }

  if (normalizedTitle.length > 0 && normalizedInput.includes(normalizedTitle)) {
    return 5;
  }

  return 0;
}

async function resolveRelevantFootballEvents(
  rawInput: string,
  ctx: ResolveContext,
  sourceAdapters?: DomainSourceAdapter[],
): Promise<DomainEvent[]> {
  const now = ctx.now || new Date();
  const normalizedInput = normalizeSearchText(rawInput);
  const matchDate = resolveRequestedMatchDate(rawInput, now);
  const events = await queryFootballMatchEventsViaRuntimeAdapters({
    filters: matchDate
      ? {
          matchDate,
        }
      : undefined,
    adapters: sourceAdapters,
    signal: ctx.signal,
  });

  const scoredEvents = events
    .map((event) => ({
      event,
      score: scoreEventAgainstInput(event, normalizedInput),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  return scoredEvents.map((entry) => entry.event);
}

export function createFootballRuntimeResolver(input: {
  sourceAdapters?: DomainSourceAdapter[];
} = {}): DomainResolver {
  const sourceAdapters = input.sourceAdapters;

  return {
    async resolveIntent(
      rawInput: string,
      ctx: ResolveContext,
    ): Promise<AnalysisIntent | null> {
      const normalized = rawInput.trim();
      if (!normalized) {
        return null;
      }

      const now = ctx.now || new Date();

      if (looksLikeLocalMatchesQuery(normalized)) {
        return {
          ...buildIntent('query', normalized),
          targetType: 'timeline',
          requestedWindow: buildRequestedWindow(normalized, now),
        };
      }

      if (looksLikeTaskCommand(normalized)) {
        const intent: AnalysisIntent = {
          ...buildIntent(
            /(every|daily|schedule|recurring|everyday)/i.test(normalized)
              ? 'schedule'
              : 'analyze',
            normalized,
          ),
          targetType: 'event',
          requestedWindow: buildRequestedWindow(normalized, now),
        };
        const eventRefs = await resolveRelevantFootballEvents(normalized, ctx, sourceAdapters);

        return {
          ...intent,
          eventRefs: eventRefs.length > 0 ? eventRefs : undefined,
        };
      }

      if (isAnalysisFactorsQuestion(normalized) || isAnalysisSequenceQuestion(normalized)) {
        return buildIntent('explain', normalized);
      }

      return null;
    },

    async resolveSubjects(_query: string, _ctx: ResolveContext): Promise<DomainSubject[]> {
      return [];
    },

    async resolveEvents(intent: AnalysisIntent, ctx: ResolveContext): Promise<DomainEvent[]> {
      if (Array.isArray(intent.eventRefs) && intent.eventRefs.length > 0) {
        return intent.eventRefs;
      }

      return resolveRelevantFootballEvents(intent.rawInput, ctx, sourceAdapters);
    },
  };
}

export const footballRuntimeResolver = createFootballRuntimeResolver();
