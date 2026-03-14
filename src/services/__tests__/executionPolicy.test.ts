import { describe, expect, it } from 'vitest';
import {
  createAutomationExecutionPolicyForScope,
  createExpandedAutomationExecutionPolicy,
  detectAutomationExecutionTargetScope,
  getAutomationExecutionTargetScope,
  isAutomationExpandedTargetPolicy,
  normalizeAutomationExecutionTargetExpansion,
} from '@/src/services/automation/executionPolicy';

describe('automation execution policy helpers', () => {
  it('maps persisted target expansions into semantic scopes', () => {
    expect(getAutomationExecutionTargetScope({ targetExpansion: 'single' })).toBe('single');
    expect(getAutomationExecutionTargetScope({ targetExpansion: 'all_matches' })).toBe(
      'collection',
    );
    expect(isAutomationExpandedTargetPolicy({ targetExpansion: 'all_matches' })).toBe(true);
    expect(isAutomationExpandedTargetPolicy({ targetExpansion: 'single' })).toBe(false);
  });

  it('creates scoped policies without changing retry settings', () => {
    const basePolicy = {
      targetExpansion: 'single' as const,
      recoveryWindowMinutes: 90,
      maxRetries: 5,
    };

    expect(createAutomationExecutionPolicyForScope('collection', basePolicy)).toEqual({
      ...basePolicy,
      targetExpansion: 'all_matches',
    });
    expect(createExpandedAutomationExecutionPolicy(basePolicy)).toEqual({
      ...basePolicy,
      targetExpansion: 'all_matches',
    });
  });

  it('normalizes persisted values and detects collection-scope language', () => {
    expect(normalizeAutomationExecutionTargetExpansion('all_matches', 'single')).toBe(
      'all_matches',
    );
    expect(normalizeAutomationExecutionTargetExpansion('unexpected', 'single')).toBe('single');
    expect(normalizeAutomationExecutionTargetExpansion(undefined, 'all_matches')).toBe(
      'all_matches',
    );
    expect(detectAutomationExecutionTargetScope('Premier League all matches')).toBe(
      'collection',
    );
    expect(detectAutomationExecutionTargetScope('分析全部比赛')).toBe('collection');
    expect(detectAutomationExecutionTargetScope('Analyze Real Madrid vs Barcelona')).toBe(
      'single',
    );
  });
});
