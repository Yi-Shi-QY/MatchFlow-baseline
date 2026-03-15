import { describe, expect, it } from 'vitest';
import {
  isTodayMatchesQuery,
  looksLikeTaskCommand,
} from '@/src/services/managerAgent';
import {
  buildFactorsFollowUp,
  buildSequenceFollowUp,
  parseSequencePreference,
  parseSourcePreferenceIds,
} from '@/src/services/manager-legacy/analysisProfile';

describe('manager agent', () => {
  it('recognizes today match queries', () => {
    expect(isTodayMatchesQuery('今天有哪些比赛')).toBe(true);
    expect(isTodayMatchesQuery('What matches are on today?')).toBe(true);
  });

  it('parses source preferences from natural language', () => {
    expect(parseSourcePreferenceIds('重点看基础面和赔率盘口')).toEqual([
      'fundamental',
      'market',
    ]);
    expect(parseSourcePreferenceIds('default')).toEqual([
      'fundamental',
      'market',
      'custom',
    ]);
  });

  it('parses sequence preferences in order', () => {
    expect(parseSequencePreference('先盘口后基础面再结论')).toEqual([
      'market',
      'fundamental',
      'prediction',
    ]);
  });

  it('marks analysis commands as task commands', () => {
    expect(looksLikeTaskCommand('今晚 20:00 分析皇马 vs 巴萨')).toBe(true);
    expect(looksLikeTaskCommand('今天有哪些比赛')).toBe(false);
  });

  it('builds clear follow-up prompts', () => {
    expect(buildFactorsFollowUp('zh')).toContain('重点看哪些因素');
    expect(buildSequenceFollowUp('en', ['fundamental', 'market'])).toContain('analysis order');
  });
});
