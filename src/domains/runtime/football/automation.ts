import type { Match } from '@/src/data/matches';
import { extractMatchesFromRuntimeEvents } from '@/src/domains/runtime/sourceQueries';
import type { DomainEvent, DomainRuntimePack } from '@/src/domains/runtime/types';
import { resolveDomainEventFeed } from '@/src/services/domainMatchFeed';
import { getHistory } from '@/src/services/history';
import { getSavedSubjects } from '@/src/services/savedSubjects';
import type {
  AutomationJob,
  AutomationTargetSnapshotItem,
} from '@/src/services/automation/types';
import type {
  DomainAutomationCapability,
  DomainAutomationResolvedTarget,
} from '../automation';
import { parseFootballAutomationCommand } from './automationParser';

interface FootballAutomationCandidate {
  eventId: string;
  title: string;
  match: Match;
}

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function statusRank(status: Match['status']): number {
  if (status === 'live') return 0;
  if (status === 'upcoming') return 1;
  return 2;
}

function compareMatchesForExecution(left: Match, right: Match): number {
  const statusDelta = statusRank(left.status) - statusRank(right.status);
  if (statusDelta !== 0) {
    return statusDelta;
  }

  return new Date(left.date).getTime() - new Date(right.date).getTime();
}

function isTargetSnapshotItem(input: unknown): input is AutomationTargetSnapshotItem {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return false;
  }

  const value = input as Record<string, unknown>;
  return (
    typeof value.domainId === 'string' &&
    typeof value.subjectId === 'string' &&
    typeof value.subjectType === 'string' &&
    typeof value.title === 'string'
  );
}

function resolveTitleFromMatch(match: Match): string {
  return `${match.homeTeam.name} vs ${match.awayTeam.name}`;
}

function buildCandidateFromMatch(match: Match): FootballAutomationCandidate {
  return {
    eventId: match.id,
    title: resolveTitleFromMatch(match),
    match,
  };
}

function buildCandidateFromEvent(event: DomainEvent): FootballAutomationCandidate | null {
  const match = extractMatchesFromRuntimeEvents([event])[0];
  if (!match) {
    return null;
  }

  return {
    eventId: event.eventId,
    title: event.title || resolveTitleFromMatch(match),
    match,
  };
}

function sortCandidateEventsForExecution(
  candidates: FootballAutomationCandidate[],
): FootballAutomationCandidate[] {
  return [...candidates].sort((left, right) =>
    compareMatchesForExecution(left.match, right.match),
  );
}

function dedupeCandidateEvents(
  candidates: FootballAutomationCandidate[],
): FootballAutomationCandidate[] {
  const next = new Map<string, FootballAutomationCandidate>();
  candidates.forEach((candidate) => {
    const dedupeKey = candidate.eventId || candidate.match.id;
    if (!next.has(dedupeKey)) {
      next.set(dedupeKey, candidate);
    }
  });
  return Array.from(next.values());
}

function resolveSyntheticSubjectTitle(job: AutomationJob): string {
  if (job.targetSelector.mode === 'fixed_subject') {
    return job.targetSelector.subjectLabel;
  }
  if (job.targetSelector.mode === 'league_query') {
    return job.targetSelector.leagueLabel;
  }

  return job.targetSelector.displayLabel;
}

function createSyntheticMatch(job: AutomationJob): Match & { customInfo?: unknown } {
  const subjectLabel = resolveSyntheticSubjectTitle(job);
  const customInfo =
    job.targetSelector.mode === 'server_resolve'
      ? job.targetSelector.queryText
      : job.title;

  return {
    id: `${job.domainId}_${job.id}`,
    league: job.domainId.toUpperCase(),
    date: new Date().toISOString(),
    status: 'upcoming',
    homeTeam: {
      id: `${job.id}_subject`,
      name: subjectLabel,
      logo: 'https://picsum.photos/seed/automation-subject/200/200',
      form: ['?', '?', '?', '?', '?'],
    },
    awayTeam: {
      id: `${job.id}_context`,
      name: 'Automation Context',
      logo: 'https://picsum.photos/seed/automation-context/200/200',
      form: ['?', '?', '?', '?', '?'],
    },
    stats: {
      possession: { home: 50, away: 50 },
      shots: { home: 0, away: 0 },
      shotsOnTarget: { home: 0, away: 0 },
    },
    customInfo,
  };
}

async function listCandidateEvents(input: {
  domainId: string;
  runtimePack?: DomainRuntimePack | null;
}): Promise<FootballAutomationCandidate[]> {
  const [historyRecords, savedRecords, runtimeEvents] = await Promise.all([
    getHistory({ domainId: input.domainId }),
    getSavedSubjects({ domainId: input.domainId }),
    resolveDomainEventFeed({
      domainId: input.domainId,
      runtimePack: input.runtimePack,
    }),
  ]);

  const historyCandidates = historyRecords.map((record) =>
    buildCandidateFromMatch(record.subjectDisplay),
  );
  const savedCandidates = savedRecords.map((record) =>
    buildCandidateFromMatch(record.subjectDisplay),
  );
  const runtimeCandidates = runtimeEvents
    .map((event) => buildCandidateFromEvent(event))
    .filter((candidate): candidate is FootballAutomationCandidate => Boolean(candidate));

  return sortCandidateEventsForExecution(dedupeCandidateEvents([
    ...historyCandidates,
    ...savedCandidates,
    ...runtimeCandidates,
  ]));
}

function splitMatchupQuery(queryText: string): [string, string] | null {
  const normalized = queryText
    .replace(/\bversus\b/gi, ' vs ')
    .replace(/[：:]/g, ' ')
    .trim();
  const parts = normalized.split(/\bvs\b/i).map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 2) {
    return null;
  }

  return [normalizeText(parts[0]), normalizeText(parts[1])];
}

function matchesLeagueSelector(match: Match, job: AutomationJob): boolean {
  if (job.targetSelector.mode !== 'league_query') {
    return false;
  }

  const leagueText = normalizeText(match.league);
  const selectorValues = [
    job.targetSelector.leagueLabel,
    job.targetSelector.leagueKey.replace(/_/g, ' '),
  ].map(normalizeText);

  return selectorValues.some((value) => value.length > 0 && leagueText.includes(value));
}

function matchesServerResolveQuery(
  candidate: FootballAutomationCandidate,
  queryText: string,
): boolean {
  const normalizedQuery = normalizeText(queryText);
  if (!normalizedQuery) {
    return false;
  }

  const match = candidate.match;
  const home = normalizeText(match.homeTeam.name);
  const away = normalizeText(match.awayTeam.name);
  const league = normalizeText(match.league);
  const title = normalizeText(candidate.title);
  const haystack = `${title} ${home} ${away} ${league}`.trim();
  const matchupQuery = splitMatchupQuery(queryText);

  if (matchupQuery) {
    const [left, right] = matchupQuery;
    const directMatch = home.includes(left) && away.includes(right);
    const reverseMatch = home.includes(right) && away.includes(left);
    return directMatch || reverseMatch;
  }

  return normalizedQuery
    .split(' ')
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

async function resolvePersistedSubjectMatch(job: AutomationJob): Promise<Match | null> {
  if (job.targetSelector.mode !== 'fixed_subject') {
    return null;
  }

  const [historyRecords, savedRecords] = await Promise.all([
    getHistory({
      domainId: job.domainId,
      subjectId: job.targetSelector.subjectId,
    }),
    getSavedSubjects({
      domainId: job.domainId,
      subjectId: job.targetSelector.subjectId,
    }),
  ]);

  return historyRecords[0]?.subjectDisplay || savedRecords[0]?.subjectDisplay || null;
}

function toResolvedTarget(
  job: AutomationJob,
  candidate: FootballAutomationCandidate,
): DomainAutomationResolvedTarget {
  return {
    domainId: job.domainId,
    subjectId: candidate.match.id,
    subjectType: 'match',
    title: candidate.title,
    subjectDisplay: candidate.match,
  };
}

export function createFootballAutomationCapability(input: {
  runtimePack?: DomainRuntimePack | null;
} = {}): DomainAutomationCapability {
  return {
    async resolveJobTargets(job: AutomationJob): Promise<DomainAutomationResolvedTarget[]> {
      if (Array.isArray(job.targetSnapshot)) {
        const snapshotItems = job.targetSnapshot.filter((entry): entry is AutomationTargetSnapshotItem =>
          isTargetSnapshotItem(entry),
        );
        if (snapshotItems.length > 0) {
          const candidates = await listCandidateEvents({
            domainId: job.domainId,
            runtimePack: input.runtimePack,
          });
          const candidateBySubjectId = new Map(
            candidates.map((candidate) => [candidate.match.id, candidate]),
          );
          return snapshotItems
            .map((item) => candidateBySubjectId.get(item.subjectId))
            .filter((candidate): candidate is FootballAutomationCandidate => Boolean(candidate))
            .map((candidate) => toResolvedTarget(job, candidate));
        }
      }

      if (isTargetSnapshotItem(job.targetSnapshot)) {
        const snapshotItem = job.targetSnapshot;
        const candidates = await listCandidateEvents({
          domainId: job.domainId,
          runtimePack: input.runtimePack,
        });
        const matched = candidates.find((candidate) => candidate.match.id === snapshotItem.subjectId);
        if (matched) {
          return [toResolvedTarget(job, matched)];
        }
      }

      if (job.targetSelector.mode === 'fixed_subject') {
        const persistedMatch = await resolvePersistedSubjectMatch(job);
        if (persistedMatch) {
          return [toResolvedTarget(job, buildCandidateFromMatch(persistedMatch))];
        }
      }

      const candidates = await listCandidateEvents({
        domainId: job.domainId,
        runtimePack: input.runtimePack,
      });
      if (job.targetSelector.mode === 'league_query') {
        return candidates
          .filter((candidate) => matchesLeagueSelector(candidate.match, job))
          .map((candidate) => toResolvedTarget(job, candidate));
      }

      if (job.targetSelector.mode === 'server_resolve') {
        const { queryText } = job.targetSelector;
        return candidates
          .filter((candidate) =>
            matchesServerResolveQuery(candidate, queryText),
          )
          .map((candidate) => toResolvedTarget(job, candidate));
      }

      return [];
    },

    async createSyntheticTarget(job: AutomationJob): Promise<DomainAutomationResolvedTarget> {
      const syntheticMatch = createSyntheticMatch(job);
      return {
        domainId: job.domainId,
        subjectId: syntheticMatch.id,
        subjectType: 'match',
        title: resolveSyntheticSubjectTitle(job),
        subjectDisplay: syntheticMatch,
      };
    },
    parseCommand: parseFootballAutomationCommand,
  };
}

export const footballAutomationCapability = createFootballAutomationCapability();
