import { describe, expect, it } from 'vitest';
import type { Match } from '@/src/data/matches';
import type { ActiveAnalysis } from '@/src/contexts/analysis/types';
import type { HistoryRecord } from '@/src/services/history';
import type { MatchAnalysis } from '@/src/services/ai';
import {
  buildAnalysisDisplayData,
  resolveAnalysisPageStep,
} from '@/src/pages/matchDetail/useAnalysisRuntime';

function createSubjectDisplay(): Match {
  return {
    id: 'm1',
    league: 'Premier League',
    date: '2026-03-12T12:00:00.000Z',
    status: 'upcoming',
    homeTeam: {
      id: 'h1',
      name: 'Arsenal',
      logo: '',
      form: [],
    },
    awayTeam: {
      id: 'a1',
      name: 'Manchester City',
      logo: '',
      form: [],
    },
    stats: {
      possession: { home: 50, away: 50 },
      shots: { home: 0, away: 0 },
      shotsOnTarget: { home: 0, away: 0 },
    },
  };
}

function createSummaryAnalysis(
  overrides: Partial<MatchAnalysis> = {},
): MatchAnalysis {
  return {
    prediction: 'Arsenal edge',
    keyFactors: ['shape'],
    ...overrides,
  };
}

function createActiveAnalysis(
  overrides: Partial<ActiveAnalysis> = {},
): ActiveAnalysis {
  const subjectDisplay = createSubjectDisplay();
  return {
    subjectRef: {
      domainId: 'football',
      subjectId: 'm1',
      subjectType: 'team_report',
    },
    domainId: 'football',
    subjectId: 'm1',
    subjectType: 'team_report',
    subjectSnapshot: undefined,
    subjectDisplay,
    match: subjectDisplay,
    dataToAnalyze: {},
    plan: [],
    includeAnimations: true,
    thoughts: '',
    parsedStream: null,
    collapsedSegments: {},
    isAnalyzing: false,
    analysis: null,
    error: null,
    planTotalSegments: 0,
    planCompletedSegments: 0,
    runtimeStatus: null,
    runMetrics: null,
    ...overrides,
  };
}

function createHistoryRecord(
  overrides: Partial<HistoryRecord> = {},
): HistoryRecord {
  return {
    id: 'football::m1',
    domainId: 'football',
    subjectId: 'm1',
    subjectType: 'team_report',
    timestamp: 1,
    subjectDisplay: createSubjectDisplay(),
    analysis: createSummaryAnalysis(),
    ...overrides,
  } as HistoryRecord;
}

describe('resolveAnalysisPageStep', () => {
  it('returns result when a completed history record exists', () => {
    expect(resolveAnalysisPageStep({
      activeAnalysis: null,
      historyRecord: createHistoryRecord(),
    })).toBe('result');
  });

  it('returns analyzing when an active subject analysis is running even if history exists', () => {
    expect(resolveAnalysisPageStep({
      activeAnalysis: createActiveAnalysis({
        isAnalyzing: true,
      }),
      historyRecord: createHistoryRecord(),
    })).toBe('analyzing');
  });

  it('returns selection when there is no active or historical result', () => {
    expect(resolveAnalysisPageStep({
      activeAnalysis: null,
      historyRecord: undefined,
    })).toBe('selection');
  });
});

describe('buildAnalysisDisplayData', () => {
  it('prefers subject display semantics from the active analysis snapshot', () => {
    const subjectDisplay = {
      ...createSubjectDisplay(),
      id: 'subject_active',
    };
    const activeAnalysis = createActiveAnalysis({
      subjectId: 'subject_active',
      subjectDisplay,
      match: {
        ...createSubjectDisplay(),
        id: 'legacy_match_alias',
      },
      analysis: createSummaryAnalysis({
        prediction: 'Balanced matchup',
        keyFactors: ['context'],
      }),
    });

    const displayData = buildAnalysisDisplayData({
      activeAnalysis,
      historyRecord: undefined,
      subjectDisplay: createSubjectDisplay(),
      activeDomainId: 'football',
    });

    expect(displayData.subjectDisplay.id).toBe('subject_active');
  });

  it('restores the subject display from history for subject-route recovery', () => {
    const historySubjectDisplay = {
      ...createSubjectDisplay(),
      id: 'history_subject',
    };
    const displayData = buildAnalysisDisplayData({
      activeAnalysis: null,
      historyRecord: createHistoryRecord({
        subjectDisplay: historySubjectDisplay,
      }),
      subjectDisplay: createSubjectDisplay(),
      activeDomainId: 'football',
    });

    expect(displayData.subjectDisplay.id).toBe('history_subject');
    expect(displayData.thoughts).toContain('Loaded from local history cache');
  });
});
