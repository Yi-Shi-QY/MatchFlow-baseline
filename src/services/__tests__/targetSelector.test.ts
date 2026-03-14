import { describe, expect, it } from 'vitest';
import {
  buildAutomationTargetTitle,
  getAutomationTargetSelectorKind,
  getAutomationTargetSelectorLabel,
  getAutomationTargetSelectorLabelOrFallback,
  isAutomationCollectionTargetSelector,
  isAutomationResolvableTargetSelector,
  isAutomationSubjectTargetSelector,
  normalizeAutomationTargetSelectorRecord,
  type AutomationTargetSelector,
} from '@/src/services/automation';

describe('target selector helpers', () => {
  it('returns the fixed subject label when the selector pins one subject', () => {
    const selector: AutomationTargetSelector = {
      mode: 'fixed_subject',
      subjectId: 'match_1',
      subjectLabel: 'Arsenal vs Manchester City',
    };

    expect(getAutomationTargetSelectorLabel(selector)).toBe('Arsenal vs Manchester City');
    expect(isAutomationSubjectTargetSelector(selector)).toBe(true);
    expect(getAutomationTargetSelectorKind(selector)).toBe('subject');
  });

  it('returns the league label when the selector expands a collection query', () => {
    const selector: AutomationTargetSelector = {
      mode: 'league_query',
      leagueKey: 'epl',
      leagueLabel: 'Premier League',
    };

    expect(getAutomationTargetSelectorLabel(selector)).toBe('Premier League');
    expect(isAutomationCollectionTargetSelector(selector)).toBe(true);
    expect(getAutomationTargetSelectorKind(selector)).toBe('collection');
  });

  it('returns the server-resolved display label when the selector depends on runtime resolution', () => {
    const selector: AutomationTargetSelector = {
      mode: 'server_resolve',
      queryText: 'Tonight focus match',
      displayLabel: 'Real Madrid vs Barcelona',
    };

    expect(getAutomationTargetSelectorLabel(selector)).toBe('Real Madrid vs Barcelona');
    expect(isAutomationResolvableTargetSelector(selector)).toBe(true);
    expect(getAutomationTargetSelectorKind(selector)).toBe('query');
  });

  it('falls back when the selector is missing or the label is blank', () => {
    expect(getAutomationTargetSelectorLabel(undefined)).toBeNull();
    expect(getAutomationTargetSelectorKind(undefined)).toBeNull();
    expect(
      getAutomationTargetSelectorLabel({
        mode: 'server_resolve',
        queryText: 'Arsenal',
        displayLabel: '   ',
      }),
    ).toBeNull();
    expect(
      getAutomationTargetSelectorLabelOrFallback({
        selector: undefined,
        fallback: 'Target needed',
      }),
    ).toBe('Target needed');
    expect(
      buildAutomationTargetTitle(undefined, 'Analyze Arsenal vs Manchester City'),
    ).toBe('Analyze Arsenal vs Manchester City');
  });

  it('normalizes persisted selector records through the shared selector helper', () => {
    expect(
      normalizeAutomationTargetSelectorRecord({
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
      normalizeAutomationTargetSelectorRecord({
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
      normalizeAutomationTargetSelectorRecord({
        mode: 'server_resolve',
        queryText: 'Tonight focus match',
        displayLabel: 'Real Madrid vs Barcelona',
      }),
    ).toEqual({
      mode: 'server_resolve',
      queryText: 'Tonight focus match',
      displayLabel: 'Real Madrid vs Barcelona',
    });
    expect(
      normalizeAutomationTargetSelectorRecord({
        mode: 'league_query',
        leagueKey: 'epl',
      }),
    ).toBeUndefined();
  });
});
