import { describe, expect, it } from 'vitest';
import {
  buildSourceCapabilities,
  resolveSourceSelection,
  type SourceSelection,
} from '@/src/services/dataSources';
import type { SubjectDisplay } from '@/src/services/subjectDisplay';

function createSubjectDisplay(overrides: Partial<SubjectDisplay> = {}): SubjectDisplay {
  return {
    id: 'subject-1',
    status: 'upcoming',
    league: 'Premier League',
    date: '2026-03-14T12:00:00.000Z',
    homeTeam: {
      id: 'home',
      name: 'Home',
      logo: '',
      form: [],
    },
    awayTeam: {
      id: 'away',
      name: 'Away',
      logo: '',
      form: [],
    },
    capabilities: {
      hasStats: true,
      hasOdds: true,
      hasCustom: false,
    },
    odds: {
      had: { h: 2.1, d: 3.2, a: 3.4 },
    },
    ...overrides,
  };
}

describe('dataSources', () => {
  it('resolves default source selection from the shared subject contract', () => {
    const selection = resolveSourceSelection(createSubjectDisplay(), null);

    expect(selection.fundamental).toBe(true);
    expect(selection.market).toBe(true);
    expect(selection.custom).toBe(false);
  });

  it('respects previous source overrides', () => {
    const selection = resolveSourceSelection(createSubjectDisplay(), null, {
      market: false,
    });

    expect(selection.market).toBe(false);
  });

  it('builds source capabilities from selected subject data', () => {
    const selectedSources: SourceSelection = {
      fundamental: true,
      market: true,
      custom: false,
    };

    expect(
      buildSourceCapabilities(
        {
          league: 'Premier League',
          homeTeam: { name: 'Home' },
          awayTeam: { name: 'Away' },
          stats: {
            possession: { home: 50, away: 50 },
          },
          odds: {
            had: { h: 2.1, d: 3.2, a: 3.4 },
          },
        },
        selectedSources,
      ),
    ).toEqual({
      hasFundamental: true,
      hasStats: true,
      hasOdds: true,
      hasCustom: false,
    });
  });
});
