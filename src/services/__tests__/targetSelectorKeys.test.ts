import { describe, expect, it } from 'vitest';
import {
  getAutomationTargetSelectorCollectionKey,
  getAutomationTargetSelectorSubjectId,
  type AutomationTargetSelector,
} from '@/src/services/automation';

describe('target selector semantic helpers', () => {
  it('returns the subject id only for fixed subject selectors', () => {
    const selector: AutomationTargetSelector = {
      mode: 'fixed_subject',
      subjectId: 'match_1',
      subjectLabel: 'Arsenal vs Manchester City',
    };

    expect(getAutomationTargetSelectorSubjectId(selector)).toBe('match_1');
    expect(
      getAutomationTargetSelectorSubjectId({
        mode: 'league_query',
        leagueKey: 'epl',
        leagueLabel: 'Premier League',
      }),
    ).toBeNull();
  });

  it('returns a stable collection key only for collection-style selectors', () => {
    expect(
      getAutomationTargetSelectorCollectionKey({
        mode: 'league_query',
        leagueKey: 'epl',
        leagueLabel: 'Premier League',
      }),
    ).toBe('league_query:epl');
    expect(
      getAutomationTargetSelectorCollectionKey({
        mode: 'fixed_subject',
        subjectId: 'match_1',
        subjectLabel: 'Arsenal vs Manchester City',
      }),
    ).toBeNull();
    expect(
      getAutomationTargetSelectorCollectionKey({
        mode: 'server_resolve',
        queryText: 'Tonight focus match',
        displayLabel: 'Real Madrid vs Barcelona',
      }),
    ).toBeNull();
  });
});
