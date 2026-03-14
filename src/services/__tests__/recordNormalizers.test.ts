import { describe, expect, it } from 'vitest';
import {
  normalizeAutomationAnalysisProfile,
  normalizeAutomationExecutionPolicy,
  normalizeAutomationSchedule,
  normalizeAutomationTargetSelector,
} from '@/src/services/automation/recordNormalizers';

describe('automation record normalizers', () => {
  it('normalizes one-time and daily schedules from persisted records', () => {
    expect(
      normalizeAutomationSchedule({
        type: 'one_time',
        runAt: '2026-03-14T12:00:00.000Z',
        timezone: 'Asia/Shanghai',
      }),
    ).toEqual({
      type: 'one_time',
      runAt: '2026-03-14T12:00:00.000Z',
      timezone: 'Asia/Shanghai',
    });

    expect(
      normalizeAutomationSchedule({
        type: 'daily',
        time: '09:00',
        timezone: 'Asia/Shanghai',
      }),
    ).toEqual({
      type: 'daily',
      time: '09:00',
      timezone: 'Asia/Shanghai',
    });

    expect(normalizeAutomationSchedule({ type: 'daily', timezone: 'Asia/Shanghai' })).toBeUndefined();
  });

  it('normalizes all supported target selector variants', () => {
    expect(
      normalizeAutomationTargetSelector({
        mode: 'fixed_subject',
        subjectId: 'match_1',
        subjectLabel: 'Arsenal vs Manchester City',
      }),
    ).toEqual({
      mode: 'fixed_subject',
      subjectId: 'match_1',
      subjectLabel: 'Arsenal vs Manchester City',
    });

    expect(
      normalizeAutomationTargetSelector({
        mode: 'league_query',
        leagueKey: 'epl',
        leagueLabel: 'Premier League',
      }),
    ).toEqual({
      mode: 'league_query',
      leagueKey: 'epl',
      leagueLabel: 'Premier League',
    });

    expect(
      normalizeAutomationTargetSelector({
        mode: 'server_resolve',
        queryText: '今晚焦点战',
        displayLabel: 'Real Madrid vs Barcelona',
      }),
    ).toEqual({
      mode: 'server_resolve',
      queryText: '今晚焦点战',
      displayLabel: 'Real Madrid vs Barcelona',
    });

    expect(
      normalizeAutomationTargetSelector({
        mode: 'fixed_subject',
        subjectId: 'match_2',
      }),
    ).toBeUndefined();
  });

  it('filters invalid analysis profile entries and drops empty profiles', () => {
    expect(
      normalizeAutomationAnalysisProfile({
        selectedSourceIds: ['fundamental', 'invalid', 'market'],
        sequencePreference: ['custom', 'prediction', 'unknown'],
      }),
    ).toEqual({
      selectedSourceIds: ['fundamental', 'market'],
      sequencePreference: ['custom', 'prediction'],
    });

    expect(
      normalizeAutomationAnalysisProfile({
        selectedSourceIds: [],
        sequencePreference: [],
      }),
    ).toBeUndefined();
  });

  it('falls back to the default execution policy when persisted values are missing', () => {
    expect(
      normalizeAutomationExecutionPolicy({
        targetExpansion: 'all_matches',
        recoveryWindowMinutes: 45,
        maxRetries: 3,
      }),
    ).toEqual({
      targetExpansion: 'all_matches',
      recoveryWindowMinutes: 45,
      maxRetries: 3,
    });

    expect(normalizeAutomationExecutionPolicy(undefined)).toEqual({
      targetExpansion: 'single',
      recoveryWindowMinutes: 30,
      maxRetries: 2,
    });
  });
});
