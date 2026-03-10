import { describe, expect, it } from 'vitest';
import type { ActiveAnalysis } from './types';
import { buildAndroidForegroundServicePayload } from './androidForegroundStatus';

function createActiveAnalysis(overrides: Partial<ActiveAnalysis>): ActiveAnalysis {
  const base = {
    matchId: 'match-1',
    domainId: 'football',
    subjectId: 'match-1',
    match: {
      id: 'match-1',
      league: 'EPL',
      date: '2026-03-10',
      status: 'upcoming',
      homeTeam: { id: 'h', name: 'Home', logo: '', form: [] },
      awayTeam: { id: 'a', name: 'Away', logo: '', form: [] },
      stats: {
        possession: { home: 50, away: 50 },
        shots: { home: 0, away: 0 },
        shotsOnTarget: { home: 0, away: 0 },
      },
    },
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
  } as unknown as ActiveAnalysis;

  return {
    ...base,
    ...overrides,
  };
}

describe('buildAndroidForegroundServicePayload', () => {
  it('returns null when no analysis is running', () => {
    const payload = buildAndroidForegroundServicePayload({
      'match-1': createActiveAnalysis({ isAnalyzing: false }),
    });
    expect(payload).toBeNull();
  });

  it('builds notification payload with progress and stage', () => {
    const payload = buildAndroidForegroundServicePayload({
      'match-1': createActiveAnalysis({
        isAnalyzing: true,
        planTotalSegments: 6,
        planCompletedSegments: 2,
        runtimeStatus: {
          stage: 'segment_running',
          runId: 'run-1',
          timestamp: Date.now(),
          stageStartedAt: Date.now(),
          stageDurationMs: 10,
          eventSeq: 1,
          segmentIndex: 3,
          totalSegments: 6,
          progressPercent: 50,
          stageLabel: 'Segment 3',
        },
      }),
    });

    expect(payload).not.toBeNull();
    expect(payload?.title).toContain('MatchFlow analysis running');
    expect(payload?.text).toContain('Home vs Away');
    expect(payload?.text).toContain('Progress 3/6');
    expect(payload?.text).toContain('Stage: Segment 3');
    expect(payload?.useWakeLock).toBe(true);
  });
});
