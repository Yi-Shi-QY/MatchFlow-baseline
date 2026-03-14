import { describe, expect, it } from 'vitest';
import { parseAutomationCommand } from '@/src/services/automation/parser';

describe('automation parser', () => {
  it('splits multi-league recurring commands into multiple drafts', () => {
    const drafts = parseAutomationCommand('每天 09:00 分析英超和西甲全部比赛', {
      defaultDomainId: 'football',
      now: new Date('2026-03-11T09:00:00.000Z'),
    });

    expect(drafts).toHaveLength(2);
    expect(drafts.every((draft) => draft.intentType === 'recurring')).toBe(true);
    expect(drafts.every((draft) => draft.targetSelector?.mode === 'league_query')).toBe(true);
    expect(drafts.every((draft) => draft.executionPolicy.targetExpansion === 'all_matches')).toBe(
      true,
    );
  });

  it('marks underspecified commands as needing clarification', () => {
    const drafts = parseAutomationCommand('明晚分析曼联', {
      defaultDomainId: 'football',
      now: new Date('2026-03-11T09:00:00.000Z'),
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0].status).toBe('needs_clarification');
    expect(drafts[0].clarificationState.lastQuestion?.field).toBe('time');
  });

  it('keeps football league parsing available even when the default domain differs', () => {
    const drafts = parseAutomationCommand('Every day 09:00 analyze Premier League', {
      defaultDomainId: 'stocks',
      now: new Date('2026-03-11T09:00:00.000Z'),
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0].domainId).toBe('football');
    expect(drafts[0].targetSelector).toMatchObject({
      mode: 'league_query',
      leagueLabel: 'Premier League',
    });
  });
});
