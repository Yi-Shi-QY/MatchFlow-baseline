import type { Match } from '@/src/data/matches';
import { extractMatchesFromRuntimeEvents } from '@/src/domains/runtime/sourceQueries';
import type { DomainEvent } from '@/src/domains/runtime/types';
import type { AnalysisRequestPayload } from '@/src/services/ai/contracts';
import {
  fetchSubjectAnalysisConfig,
  mergeServerPlanningIntoAnalysisPayload,
  resolveSubjectAnalysisConfig,
} from '@/src/services/analysisConfig';
import { resolveDomainEventFeed } from '@/src/services/domainMatchFeed';
import { getHistory } from '@/src/services/history';
import { getSavedSubjects } from '@/src/services/savedSubjects';
import type {
  AutomationJob,
  AutomationTargetSnapshotItem,
  AutomationTargetSnapshot,
} from './types';

export interface AssembledAutomationTarget {
  jobId: string;
  domainId: string;
  subjectId: string;
  subjectType: 'match';
  title: string;
  match: Match;
  dataToAnalyze: AnalysisRequestPayload;
}

export interface AssembledAutomationJob {
  job: AutomationJob;
  targets: AssembledAutomationTarget[];
  targetSnapshot: AutomationTargetSnapshot;
}

interface AutomationCandidateEvent {
  eventId: string;
  title: string;
  match: Match;
  event?: DomainEvent;
}

function buildTargetSnapshotItem(input: {
  domainId: string;
  subjectId: string;
  subjectType: string;
  title: string;
}): AutomationTargetSnapshotItem {
  return {
    domainId: input.domainId,
    subjectId: input.subjectId,
    subjectType: input.subjectType,
    title: input.title,
  };
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

function isMatchLike(input: unknown): input is Match {
  if (!input || typeof input !== 'object') return false;
  const value = input as Partial<Match>;
  return (
    typeof value.id === 'string' &&
    typeof value.league === 'string' &&
    typeof value.date === 'string' &&
    !!value.homeTeam &&
    typeof value.homeTeam.name === 'string' &&
    !!value.awayTeam &&
    typeof value.awayTeam.name === 'string'
  );
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

function buildCandidateFromMatch(match: Match): AutomationCandidateEvent {
  return {
    eventId: match.id,
    title: resolveTitleFromMatch(match),
    match,
  };
}

function buildCandidateFromEvent(event: DomainEvent): AutomationCandidateEvent | null {
  const match = extractMatchesFromRuntimeEvents([event])[0];
  if (!match) {
    return null;
  }

  return {
    eventId: event.eventId,
    title: event.title || resolveTitleFromMatch(match),
    match,
    event,
  };
}

function sortCandidateEventsForExecution(
  candidates: AutomationCandidateEvent[],
): AutomationCandidateEvent[] {
  return [...candidates].sort((left, right) =>
    compareMatchesForExecution(left.match, right.match),
  );
}

function dedupeCandidateEvents(
  candidates: AutomationCandidateEvent[],
): AutomationCandidateEvent[] {
  const next = new Map<string, AutomationCandidateEvent>();
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
    customInfo:
      customInfo,
  };
}

async function listCandidateEvents(domainId: string): Promise<AutomationCandidateEvent[]> {
  const [historyRecords, savedRecords, runtimeEvents] = await Promise.all([
    getHistory({ domainId }),
    getSavedSubjects({ domainId }),
    resolveDomainEventFeed({ domainId }),
  ]);

  const historyCandidates = historyRecords.map((record) =>
    buildCandidateFromMatch(record.subjectDisplay),
  );
  const savedCandidates = savedRecords.map((record) =>
    buildCandidateFromMatch(record.subjectDisplay),
  );
  const runtimeCandidates = runtimeEvents
    .map((event) => buildCandidateFromEvent(event))
    .filter((candidate): candidate is AutomationCandidateEvent => Boolean(candidate));

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

function matchesServerResolveQuery(candidate: AutomationCandidateEvent, queryText: string): boolean {
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

async function resolveJobCandidates(job: AutomationJob): Promise<AutomationCandidateEvent[]> {
  if (Array.isArray(job.targetSnapshot)) {
    const snapshotItems = job.targetSnapshot.filter((entry): entry is AutomationTargetSnapshotItem =>
      isTargetSnapshotItem(entry),
    );
    if (snapshotItems.length > 0) {
      const candidates = await listCandidateEvents(job.domainId);
      const candidateBySubjectId = new Map(
        candidates.map((candidate) => [candidate.match.id, candidate]),
      );
      return snapshotItems
        .map((item) => candidateBySubjectId.get(item.subjectId))
        .filter((candidate): candidate is AutomationCandidateEvent => Boolean(candidate));
    }
  }

  if (isTargetSnapshotItem(job.targetSnapshot)) {
    const snapshotItem = job.targetSnapshot;
    const candidates = await listCandidateEvents(job.domainId);
    const matched = candidates.find((candidate) => candidate.match.id === snapshotItem.subjectId);
    if (matched) {
      return [matched];
    }
  }

  if (job.targetSelector.mode === 'fixed_subject') {
    const persistedMatch = await resolvePersistedSubjectMatch(job);
    if (persistedMatch) {
      return [buildCandidateFromMatch(persistedMatch)];
    }
  }

  const candidates = await listCandidateEvents(job.domainId);
  if (job.targetSelector.mode === 'league_query') {
    return candidates.filter((candidate) => matchesLeagueSelector(candidate.match, job));
  }

  if (job.targetSelector.mode === 'server_resolve') {
    const { queryText } = job.targetSelector;
    return candidates.filter((candidate) =>
      matchesServerResolveQuery(candidate, queryText),
    );
  }

  return [];
}

async function prepareAutomationAnalysisPayload(
  match: Match,
  job: AutomationJob,
): Promise<AnalysisRequestPayload> {
  let dataToAnalyze: AnalysisRequestPayload = {
    ...match,
  };

  try {
    let serverConfig = null;
    if (typeof match.id === 'string' && match.id.trim().length > 0 && !match.id.startsWith('custom_')) {
      serverConfig = await fetchSubjectAnalysisConfig({
        domainId: job.domainId,
        subjectId: match.id.trim(),
        subjectType: 'match',
      });
    }

    if (!serverConfig) {
      serverConfig = await resolveSubjectAnalysisConfig(dataToAnalyze);
    }

    dataToAnalyze = mergeServerPlanningIntoAnalysisPayload(dataToAnalyze, serverConfig);
  } catch (error) {
    console.warn(
      'Failed to resolve server planning config for automation job; continue with local source context.',
      error,
    );
  }

  const currentSourceContext =
    dataToAnalyze?.sourceContext && typeof dataToAnalyze.sourceContext === 'object'
      ? dataToAnalyze.sourceContext
      : {};
  const selectedSourceIds = Array.isArray(job.analysisProfile?.selectedSourceIds)
    ? job.analysisProfile.selectedSourceIds
    : currentSourceContext.selectedSourceIds;
  const selectedSources =
    Array.isArray(selectedSourceIds) && selectedSourceIds.length > 0
      ? selectedSourceIds.reduce<Record<string, boolean>>((acc, sourceId) => {
          acc[sourceId] = true;
          return acc;
        }, {})
      : currentSourceContext.selectedSources;
  const planningContext =
    currentSourceContext.planning && typeof currentSourceContext.planning === 'object'
      ? currentSourceContext.planning
      : {};

  return {
    ...dataToAnalyze,
    sourceContext: {
      ...currentSourceContext,
      domainId: job.domainId,
      selectedSources,
      selectedSourceIds,
      planning: {
        ...planningContext,
        sequencePreference: job.analysisProfile?.sequencePreference || planningContext.sequencePreference,
        conversationManaged: Boolean(job.analysisProfile),
      },
      automation: {
        jobId: job.id,
        sourceRuleId: job.sourceRuleId,
        triggerType: job.triggerType,
        domainPackVersion: job.domainPackVersion,
        templateId: job.templateId,
        targetSelector: job.targetSelector,
      },
    },
  };
}

export async function assembleAutomationJob(job: AutomationJob): Promise<AssembledAutomationJob> {
  const resolvedCandidates = await resolveJobCandidates(job);
  const targets: AssembledAutomationTarget[] = [];

  if (resolvedCandidates.length > 0) {
    const selectedCandidates =
      job.targetSelector.mode === 'league_query' || Array.isArray(job.targetSnapshot)
        ? resolvedCandidates
        : [resolvedCandidates[0]];

    for (const candidate of selectedCandidates) {
      const match = candidate.match;
      const dataToAnalyze = await prepareAutomationAnalysisPayload(match, job);
      targets.push({
        jobId: job.id,
        domainId: job.domainId,
        subjectId: match.id,
        subjectType: 'match',
        title: resolveTitleFromMatch(match),
        match,
        dataToAnalyze,
      });
    }

    return {
      job,
      targets,
      targetSnapshot:
        selectedCandidates.length === 1
          ? buildTargetSnapshotItem({
              domainId: job.domainId,
              subjectId: selectedCandidates[0].match.id,
              subjectType: 'match',
              title: selectedCandidates[0].title,
            })
          : selectedCandidates.map((candidate) =>
              buildTargetSnapshotItem({
                domainId: job.domainId,
                subjectId: candidate.match.id,
                subjectType: 'match',
                title: candidate.title,
              }),
            ),
    };
  }

  const syntheticMatch = createSyntheticMatch(job);
  const syntheticPayload = await prepareAutomationAnalysisPayload(syntheticMatch, job);
  syntheticPayload.customInfo = syntheticMatch.customInfo;

  return {
    job,
    targets: [
      {
        jobId: job.id,
        domainId: job.domainId,
        subjectId: syntheticMatch.id,
        subjectType: 'match',
        title: resolveSyntheticSubjectTitle(job),
        match: syntheticMatch,
        dataToAnalyze: syntheticPayload,
      },
    ],
    targetSnapshot: buildTargetSnapshotItem({
      domainId: job.domainId,
      subjectId: syntheticMatch.id,
      subjectType: 'match',
      title: resolveSyntheticSubjectTitle(job),
    }),
  };
}
