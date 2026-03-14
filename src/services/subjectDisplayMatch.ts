import type { Match } from '@/src/data/matches';
import type { SubjectDisplay } from '@/src/services/subjectDisplay';

export type SubjectDisplayMatch = Match & SubjectDisplay;
export type SubjectDisplayStatus = SubjectDisplayMatch['status'];

function isRecordObject(input: unknown): input is Record<string, unknown> {
  return !!input && typeof input === 'object' && !Array.isArray(input);
}

function buildMatchTitle(homeName: string, awayName: string): string {
  return `${homeName} vs ${awayName}`;
}

export function buildFallbackDisplayMatch(
  subjectId: string,
  domainId: string,
): SubjectDisplayMatch {
  const homeName = 'Subject A';
  const awayName = 'Subject B';
  return {
    id: subjectId,
    domainId,
    subjectType: 'match',
    title: buildMatchTitle(homeName, awayName),
    subtitle: domainId.toUpperCase(),
    league: domainId.toUpperCase(),
    date: new Date().toISOString(),
    status: 'upcoming',
    homeTeam: {
      id: `${subjectId}_home`,
      name: homeName,
      logo: 'https://picsum.photos/seed/subject-a/200/200',
      form: ['?', '?', '?', '?', '?'],
    },
    awayTeam: {
      id: `${subjectId}_away`,
      name: awayName,
      logo: 'https://picsum.photos/seed/subject-b/200/200',
      form: ['?', '?', '?', '?', '?'],
    },
    metadata: {
      league: domainId.toUpperCase(),
    },
    stats: {
      possession: { home: 50, away: 50 },
      shots: { home: 0, away: 0 },
      shotsOnTarget: { home: 0, away: 0 },
    },
  };
}

export function coerceSubjectSnapshotToDisplayMatch(
  raw: unknown,
  subjectId: string,
  domainId: string,
): SubjectDisplayMatch {
  if (!isRecordObject(raw)) {
    return buildFallbackDisplayMatch(subjectId, domainId);
  }

  const homeTeamRaw = isRecordObject(raw.homeTeam) ? raw.homeTeam : {};
  const awayTeamRaw = isRecordObject(raw.awayTeam) ? raw.awayTeam : {};
  const statusRaw = raw.status;
  const status: SubjectDisplayStatus =
    statusRaw === 'live' || statusRaw === 'finished' || statusRaw === 'upcoming'
      ? statusRaw
      : 'upcoming';
  const homeName =
    typeof homeTeamRaw.name === 'string' && homeTeamRaw.name.trim().length > 0
      ? homeTeamRaw.name.trim()
      : 'Subject A';
  const awayName =
    typeof awayTeamRaw.name === 'string' && awayTeamRaw.name.trim().length > 0
      ? awayTeamRaw.name.trim()
      : 'Subject B';
  const league =
    typeof raw.league === 'string' && raw.league.trim().length > 0 ? raw.league : domainId;

  return {
    id: typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id : subjectId,
    domainId:
      typeof raw.domainId === 'string' && raw.domainId.trim().length > 0
        ? raw.domainId
        : domainId,
    subjectType:
      typeof raw.subjectType === 'string' && raw.subjectType.trim().length > 0
        ? raw.subjectType
        : 'match',
    title:
      typeof raw.title === 'string' && raw.title.trim().length > 0
        ? raw.title
        : buildMatchTitle(homeName, awayName),
    subtitle:
      typeof raw.subtitle === 'string' && raw.subtitle.trim().length > 0
        ? raw.subtitle
        : league,
    league,
    date:
      typeof raw.date === 'string' && raw.date.trim().length > 0
        ? raw.date
        : new Date().toISOString(),
    status,
    homeTeam: {
      id:
        typeof homeTeamRaw.id === 'string' && homeTeamRaw.id.trim().length > 0
          ? homeTeamRaw.id
          : `${subjectId}_home`,
      name: homeName,
      logo:
        typeof homeTeamRaw.logo === 'string' && homeTeamRaw.logo.trim().length > 0
          ? homeTeamRaw.logo
          : 'https://picsum.photos/seed/subject-a/200/200',
      form: Array.isArray(homeTeamRaw.form)
        ? homeTeamRaw.form.filter((entry): entry is string => typeof entry === 'string')
        : ['?', '?', '?', '?', '?'],
    },
    awayTeam: {
      id:
        typeof awayTeamRaw.id === 'string' && awayTeamRaw.id.trim().length > 0
          ? awayTeamRaw.id
          : `${subjectId}_away`,
      name: awayName,
      logo:
        typeof awayTeamRaw.logo === 'string' && awayTeamRaw.logo.trim().length > 0
          ? awayTeamRaw.logo
          : 'https://picsum.photos/seed/subject-b/200/200',
      form: Array.isArray(awayTeamRaw.form)
        ? awayTeamRaw.form.filter((entry): entry is string => typeof entry === 'string')
        : ['?', '?', '?', '?', '?'],
    },
    score: isRecordObject(raw.score)
      ? {
          home: Number.isFinite(raw.score.home) ? Number(raw.score.home) : 0,
          away: Number.isFinite(raw.score.away) ? Number(raw.score.away) : 0,
        }
      : undefined,
    stats:
      isRecordObject(raw.stats) &&
      isRecordObject(raw.stats.possession) &&
      isRecordObject(raw.stats.shots) &&
      isRecordObject(raw.stats.shotsOnTarget)
        ? {
            possession: {
              home: Number.isFinite(raw.stats.possession.home) ? Number(raw.stats.possession.home) : 50,
              away: Number.isFinite(raw.stats.possession.away) ? Number(raw.stats.possession.away) : 50,
            },
            shots: {
              home: Number.isFinite(raw.stats.shots.home) ? Number(raw.stats.shots.home) : 0,
              away: Number.isFinite(raw.stats.shots.away) ? Number(raw.stats.shots.away) : 0,
            },
            shotsOnTarget: {
              home: Number.isFinite(raw.stats.shotsOnTarget.home)
                ? Number(raw.stats.shotsOnTarget.home)
                : 0,
              away: Number.isFinite(raw.stats.shotsOnTarget.away)
                ? Number(raw.stats.shotsOnTarget.away)
                : 0,
            },
          }
        : undefined,
    odds: isRecordObject(raw.odds) ? (raw.odds as SubjectDisplayMatch['odds']) : undefined,
    source: typeof raw.source === 'string' ? raw.source : undefined,
    metadata: isRecordObject(raw.metadata)
      ? raw.metadata
      : {
          league,
        },
    capabilities: isRecordObject(raw.capabilities)
      ? {
          hasStats: Boolean(raw.capabilities.hasStats),
          hasOdds: Boolean(raw.capabilities.hasOdds),
          hasCustom: Boolean(raw.capabilities.hasCustom),
        }
      : undefined,
  };
}
