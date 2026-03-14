import { describe, expect, it } from 'vitest';
import { applyClarificationAnswer } from '@/src/services/automation/clarification';
import { parseAutomationCommand } from '@/src/services/automation/parser';

describe('automation clarification', () => {
  it('fills missing time answers into a ready draft when target already exists', () => {
    const [draft] = parseAutomationCommand('分析皇马 vs 巴萨', {
      defaultDomainId: 'football',
      now: new Date('2026-03-11T09:00:00.000Z'),
    });

    expect(draft.status).toBe('needs_clarification');

    const updated = applyClarificationAnswer(draft, '今晚 20:00');

    expect(updated.schedule).toBeDefined();
    expect(updated.targetSelector).toBeDefined();
    expect(updated.status).toBe('ready');
  });

  it('fills missing target answers into a ready recurring draft when time already exists', () => {
    const [draft] = parseAutomationCommand('每天 09:00 自动分析', {
      defaultDomainId: 'football',
      now: new Date('2026-03-11T09:00:00.000Z'),
    });

    expect(draft.status).toBe('needs_clarification');

    const updated = applyClarificationAnswer(draft, '英超全部比赛');

    expect(updated.targetSelector?.mode).toBe('server_resolve');
    expect(updated.executionPolicy.targetExpansion).toBe('all_matches');
    expect(updated.status).toBe('ready');
  });

  it('builds recurring titles from target display text instead of leaking selector mode names', () => {
    const [draft] = parseAutomationCommand('Every day 09:00 automatic analysis', {
      defaultDomainId: 'football',
      now: new Date('2026-03-11T09:00:00.000Z'),
    });

    const updated = applyClarificationAnswer(draft, 'Premier League all matches');

    expect(updated.title).toBe('Premier League all matches @ 09:00');
  });
});
