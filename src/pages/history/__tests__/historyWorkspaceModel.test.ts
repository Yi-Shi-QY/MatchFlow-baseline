import { describe, expect, it } from 'vitest';
import type { Match } from '@/src/data/matches';
import type { HistoryRecord, SavedResumeState } from '@/src/services/history';
import type { SavedSubjectRecord } from '@/src/services/savedSubjects';
import { deriveHistoryWorkspaceModel } from '@/src/pages/history/historyWorkspaceModel';

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

function createResumeState(subjectDisplay: Match, overrides: Partial<SavedResumeState> = {}): SavedResumeState {
  return {
    domainId: 'football',
    subjectId: subjectDisplay.id,
    subjectType: 'match',
    thoughts: 'Continue this topic',
    timestamp: 1710000003000,
    state: {
      plan: [],
      completedSegmentIndices: [],
      fullAnalysisText: 'Unfinished analysis',
      subjectDisplaySnapshot: subjectDisplay,
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
    timestamp: 1710000001000,
    ...overrides,
  };
}

describe('history workspace model', () => {
  it('keeps the frozen order and separates recent completed, resumable, and saved topics without duplicate subjects', () => {
    const completedSubject = createMatch('completed-1', {
      homeTeam: { id: 'arsenal', name: 'Arsenal', logo: '', form: [] },
      awayTeam: { id: 'city', name: 'Manchester City', logo: '', form: [] },
    });
    const resumableSubject = createMatch('resume-1');
    const resumableOnlySubject = createMatch('resume-only-1');
    const savedOnlySubject = createMatch('saved-1');

    const model = deriveHistoryWorkspaceModel({
      historyRecords: [
        createHistoryRecord(completedSubject),
        createHistoryRecord(resumableSubject, {
          id: 'history:resume-1',
          subjectId: 'resume-1',
          timestamp: 1710000004000,
        }),
      ],
      resumeStates: [
        createResumeState(resumableSubject, {
          subjectId: 'resume-1',
          timestamp: 1710000004500,
        }),
        createResumeState(resumableOnlySubject, {
          subjectId: 'resume-only-1',
          timestamp: 1710000004600,
        }),
      ],
      savedSubjects: [
        createSavedSubject(completedSubject),
        createSavedSubject(resumableSubject, {
          subjectId: 'resume-1',
          timestamp: 1710000002000,
        }),
        createSavedSubject(savedOnlySubject, {
          subjectId: 'saved-1',
          timestamp: 1710000001500,
        }),
      ],
      language: 'zh',
    });

    expect(model.sections.map((section) => section.id)).toEqual([
      'summary',
      'recent_completed',
      'resumable_topics',
      'saved_topics',
    ]);
    expect(model.recentCompletedCards[0].primaryAction.label).toBe('查看结果');
    expect(model.resumableCards[0].primaryAction.label).toBe('继续此主题');
    expect(model.savedTopicCards[0].primaryAction.label).toBe('打开主题');
    expect(model.recentCompletedCards).toHaveLength(2);
    expect(model.resumableCards).toHaveLength(1);
    expect(model.savedTopicCards).toHaveLength(1);
  });
});
