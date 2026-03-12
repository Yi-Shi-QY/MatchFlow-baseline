import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildSyncedMatchesQuery,
  buildSyncedMatchesQueryByDate,
  queryLocalMatchesByDate,
  syncMatchesToLocalCache,
} from '@/src/services/syncedMatches';

describe('synced matches query builder', () => {
  beforeEach(() => {
    const map = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        get length() {
          return map.size;
        },
        clear() {
          map.clear();
        },
        getItem(key: string) {
          return map.has(key) ? map.get(key)! : null;
        },
        key(index: number) {
          return Array.from(map.keys())[index] ?? null;
        },
        removeItem(key: string) {
          map.delete(key);
        },
        setItem(key: string, value: string) {
          map.set(key, value);
        },
      } satisfies Storage,
      configurable: true,
    });
  });

  it('builds a domain/date scoped SQL query', () => {
    const query = buildSyncedMatchesQueryByDate('football', '2026-03-11');

    expect(query.sql).toContain('FROM synced_matches');
    expect(query.sql).toContain('domainId = ? AND matchDate = ?');
    expect(query.params).toEqual(['football', '2026-03-11']);
  });

  it('adds status and league filters when requested', () => {
    const query = buildSyncedMatchesQuery({
      domainId: 'football',
      matchDate: '2026-03-11',
      statuses: ['live'],
      leagueTerms: ['La Liga'],
    });

    expect(query.sql).toContain('status IN (?)');
    expect(query.sql).toContain('LOWER(league) LIKE ?');
    expect(query.params).toEqual([
      'football',
      '2026-03-11',
      'live',
      '%la liga%',
    ]);
  });

  it('syncs football matches through the runtime source adapter path', async () => {
    const matches = await syncMatchesToLocalCache('football');
    expect(matches.length).toBeGreaterThan(0);

    const firstMatchDate = matches[0].date.slice(0, 10);
    const sameDayMatches = await queryLocalMatchesByDate('football', firstMatchDate);

    expect(sameDayMatches.length).toBeGreaterThan(0);
    expect(sameDayMatches.some((match) => match.id === matches[0].id)).toBe(true);
  });
});
