import { describe, expect, it } from 'vitest';
import type { Match } from '@/src/data/matches';
import type { HistoryRecord } from '@/src/services/history';
import type { SavedSubjectRecord } from '@/src/services/savedSubjects';
import { deriveAnalysisDataWorkspaceModel } from '@/src/pages/dataSources/analysisDataWorkspaceModel';

function createMatch(id: string, overrides: Partial<Match> = {}): Match {
  return {
    id,
    league: 'Premier League',
    date: '2026-03-13T12:00:00.000Z',
    status: 'upcoming',
    homeTeam: {
      id: `${id}-home`,
      name: `${id} Home`,
      logo: '',
      form: [],
    },
    awayTeam: {
      id: `${id}-away`,
      name: `${id} Away`,
      logo: '',
      form: [],
    },
    stats: {
      possession: { home: 50, away: 50 },
      shots: { home: 0, away: 0 },
      shotsOnTarget: { home: 0, away: 0 },
    },
    ...overrides,
  };
}

function createSavedSubject(subjectDisplay: Match, overrides: Partial<SavedSubjectRecord> = {}): SavedSubjectRecord {
  return {
    id: `saved:${subjectDisplay.id}`,
    domainId: 'football',
    subjectId: subjectDisplay.id,
    subjectType: 'match',
    subjectSnapshot: subjectDisplay,
    subjectDisplay,
    timestamp: 1710000000000,
    ...overrides,
  };
}

function createHistoryRecord(subjectDisplay: Match, overrides: Partial<HistoryRecord> = {}): HistoryRecord {
  return {
    id: `history:${subjectDisplay.id}`,
    domainId: 'football',
    subjectId: subjectDisplay.id,
    subjectType: 'match',
    subjectSnapshot: subjectDisplay,
    subjectDisplay,
    analysis: {} as never,
    parsedStream: undefined,
    generatedCodes: undefined,
    analysisOutputEnvelope: undefined,
    timestamp: 1710000005000,
    ...overrides,
  };
}

describe('analysis data workspace model', () => {
  it('keeps the frozen section order and outputs analyzable object cards plus one data summary card', () => {
    const liveSubject = createMatch('live-1', {
      homeTeam: {
        id: 'arsenal',
        name: 'Arsenal',
        logo: '',
        form: [],
      },
      awayTeam: {
        id: 'city',
        name: 'Manchester City',
        logo: '',
        form: [],
      },
    });
    const savedOnlySubject = createMatch('saved-1');

    const model = deriveAnalysisDataWorkspaceModel({
      activeDomainId: 'football',
      liveSubjectDisplays: [liveSubject],
      savedSubjects: [
        createSavedSubject(liveSubject),
        createSavedSubject(savedOnlySubject, {
          subjectId: 'saved-1',
        }),
      ],
      recentHistory: [createHistoryRecord(liveSubject)],
      isRefreshing: false,
      refreshError: null,
      language: 'zh',
    });

    expect(model.sections.map((section) => section.id)).toEqual([
      'status_summary',
      'analyzable_objects',
      'data_availability',
      'recent_updates',
    ]);
    expect(model.objectCards[0].primaryAction.label).toBe('进入分析');
    expect(model.dataAvailabilityCard.kind).toBe('summary');
    expect(model.objectCards).toHaveLength(2);
  });
});
