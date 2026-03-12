import type { Match } from '@/src/data/matches';

export type SubjectDisplayMatch = Match;
export type SubjectDisplayStatus = SubjectDisplayMatch['status'];

function isRecordObject(input: unknown): input is Record<string, unknown> {
  return !!input && typeof input === 'object' && !Array.isArray(input);
}

export function buildFallbackDisplayMatch(
  subjectId: string,
  domainId: string,
): SubjectDisplayMatch {
  return {
    id: subjectId,
    league: domainId.toUpperCase(),
    date: new Date().toISOString(),
    status: 'upcoming',
    homeTeam: {
      id: `${subjectId}_home`,
      name: 'Subject A',
      logo: 'https://picsum.photos/seed/subject-a/200/200',
      form: ['?', '?', '?', '?', '?'],
    },
    awayTeam: {
      id: `${subjectId}_away`,
      name: 'Subject B',
      logo: 'https://picsum.photos/seed/subject-b/200/200',
      form: ['?', '?', '?', '?', '?'],
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

  return {
    id: typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id : subjectId,
    league: typeof raw.league === 'string' && raw.league.trim().length > 0 ? raw.league : domainId,
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
      name:
        typeof homeTeamRaw.name === 'string' && homeTeamRaw.name.trim().length > 0
          ? homeTeamRaw.name
          : 'Subject A',
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
      name:
        typeof awayTeamRaw.name === 'string' && awayTeamRaw.name.trim().length > 0
          ? awayTeamRaw.name
          : 'Subject B',
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
    capabilities: isRecordObject(raw.capabilities)
      ? {
          hasStats: Boolean(raw.capabilities.hasStats),
          hasOdds: Boolean(raw.capabilities.hasOdds),
          hasCustom: Boolean(raw.capabilities.hasCustom),
        }
      : undefined,
  };
}
