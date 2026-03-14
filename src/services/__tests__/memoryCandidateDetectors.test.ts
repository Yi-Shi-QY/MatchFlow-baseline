import { describe, expect, it } from 'vitest';
import type { AutomationJob, AutomationRun } from '@/src/services/automation/types';
import {
  detectMemoryCandidatesFromAutomationResult,
  detectMemoryCandidatesFromManagerInput,
} from '@/src/services/memoryCandidateDetectors';

function createAutomationJob(overrides: Partial<AutomationJob> = {}): AutomationJob {
  return {
    id: 'job-1',
    title: 'Analyze Premier League',
    sourceDraftId: 'draft-1',
    sourceRuleId: 'rule-1',
    domainId: 'football',
    domainPackVersion: undefined,
    templateId: undefined,
    triggerType: 'schedule',
    targetSelector: {
      mode: 'league_query',
      leagueKey: 'premier_league',
      leagueLabel: 'Premier League',
    },
    targetSnapshot: undefined,
    notificationPolicy: {
      notifyOnClarification: true,
      notifyOnStart: false,
      notifyOnComplete: true,
      notifyOnFailure: true,
    },
    analysisProfile: {
      selectedSourceIds: ['market', 'custom'],
      sequencePreference: ['market', 'fundamental', 'prediction'],
    },
    scheduledFor: '2026-03-13T12:00:00.000Z',
    state: 'completed',
    retryCount: 0,
    maxRetries: 2,
    retryAfter: null,
    recoveryWindowEndsAt: null,
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

function createAutomationRun(overrides: Partial<AutomationRun> = {}): AutomationRun {
  return {
    id: 'run-1',
    jobId: 'job-1',
    title: 'Analyze Premier League',
    state: 'completed',
    domainId: 'football',
    domainPackVersion: undefined,
    templateId: undefined,
    startedAt: 10,
    endedAt: 20,
    createdAt: 10,
    updatedAt: 20,
    ...overrides,
  };
}

describe('memory candidate detectors', () => {
  it('extracts explicit analysis preferences from a combined clarification answer', () => {
    const candidates = detectMemoryCandidatesFromManagerInput({
      text: 'prioritize fundamentals and market, then go market first, fundamentals second, final prediction last',
      domainId: 'football',
      detectionMode: 'analysis_profile',
    });

    expect(candidates.map((candidate) => candidate.keyText)).toEqual([
      'analysis-factors',
      'analysis-sequence',
    ]);
    expect(candidates[0]).toMatchObject({
      sourceKind: 'explicit_preference',
      scopeType: 'domain',
      scopeId: 'football',
      memoryType: 'preference',
      keyText: 'analysis-factors',
    });
    expect(candidates[0].contentText.toLowerCase()).toContain('fundamental');
    expect(candidates[0].contentText.toLowerCase()).toContain('market');
    expect(candidates[1]).toMatchObject({
      sourceKind: 'explicit_preference',
      scopeType: 'domain',
      scopeId: 'football',
      memoryType: 'preference',
      keyText: 'analysis-sequence',
    });
    expect(candidates[1].contentText.toLowerCase()).toContain('market');
    expect(candidates[1].contentText.toLowerCase()).toContain('prediction');
  });

  it('extracts an explicit constraint from a direct instruction', () => {
    const candidates = detectMemoryCandidatesFromManagerInput({
      text: 'Do not use emoji in replies.',
      domainId: 'football',
      detectionMode: 'freeform',
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      sourceKind: 'explicit_constraint',
      scopeType: 'global',
      memoryType: 'constraint',
      keyText: 'response-constraint',
    });
    expect(candidates[0].contentText).toContain('Do not use emoji');
  });

  it('extracts a stable habit candidate when the same sequence preference repeats', () => {
    const candidates = detectMemoryCandidatesFromManagerInput({
      text: 'Always start with market odds, then fundamentals, then the final prediction.',
      domainId: 'football',
      detectionMode: 'analysis_sequence',
      recentUserMessages: [
        'Always start with market odds, then fundamentals, then the final prediction.',
        'Please start with market odds before fundamentals again.',
      ],
    });

    const habitCandidate = candidates.find(
      (candidate) => candidate.sourceKind === 'stable_habit',
    );

    expect(habitCandidate).toMatchObject({
      scopeType: 'domain',
      scopeId: 'football',
      memoryType: 'habit',
      keyText: 'analysis-sequence-habit',
    });
    expect(habitCandidate?.contentText.toLowerCase()).toContain('market');
    expect(habitCandidate?.contentText.toLowerCase()).toContain('fundamental');
  });

  it('extracts conservative candidates from recurring automation results', () => {
    const job = createAutomationJob();
    const run = createAutomationRun();
    const candidates = detectMemoryCandidatesFromAutomationResult({
      job,
      run,
      historicalJobs: [
        createAutomationJob({
          id: 'job-2',
          title: 'Analyze Premier League again',
        }),
      ],
    });

    expect(candidates.map((candidate) => candidate.keyText)).toEqual([
      'analysis-factors',
      'analysis-sequence',
      'automation-league-focus-habit',
    ]);
    expect(candidates[0].origin).toBe('automation_result');
    expect(candidates[2]).toMatchObject({
      sourceKind: 'stable_habit',
      memoryType: 'habit',
      keyText: 'automation-league-focus-habit',
    });
  });

  it('does not derive candidates from one-off transient automation results', () => {
    const candidates = detectMemoryCandidatesFromAutomationResult({
      job: createAutomationJob({
        sourceRuleId: undefined,
        triggerType: 'one_time',
        targetSelector: {
          mode: 'fixed_subject',
          subjectId: 'm1',
          subjectLabel: 'Arsenal vs Manchester City',
        },
        analysisProfile: undefined,
      }),
      run: createAutomationRun(),
      historicalJobs: [],
    });

    expect(candidates).toEqual([]);
  });
});
