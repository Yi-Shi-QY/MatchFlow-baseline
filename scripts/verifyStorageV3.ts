import {
  clearHistory,
  clearHistoryByDomain,
  clearResumeState,
  clearResumeStateByDomain,
  getHistory,
  getResumeState,
  saveHistory,
  saveResumeState,
} from '../src/services/history.ts';
import {
  clearSavedSubjects,
  clearSavedSubjectsByDomain,
  getSavedSubjects,
  saveSubject,
} from '../src/services/savedSubjects.ts';
import type { Match } from '../src/data/matches.ts';
import type { AnalysisResumeState } from '../src/services/ai.ts';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  key(index: number): string | null {
    if (index < 0 || index >= this.data.size) return null;
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
}

function assertCondition(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function buildMatch(id: string, league: string, home: string, away: string): Match {
  return {
    id,
    league,
    date: new Date().toISOString(),
    status: 'upcoming',
    homeTeam: {
      id: `${id}_home`,
      name: home,
      logo: 'https://picsum.photos/seed/home/200/200',
      form: ['W', 'D', 'W', 'L', 'W'],
    },
    awayTeam: {
      id: `${id}_away`,
      name: away,
      logo: 'https://picsum.photos/seed/away/200/200',
      form: ['D', 'W', 'L', 'W', 'D'],
    },
    stats: {
      possession: { home: 50, away: 50 },
      shots: { home: 10, away: 8 },
      shotsOnTarget: { home: 4, away: 3 },
    },
  };
}

function buildResumeState(label: string): AnalysisResumeState {
  return {
    plan: [{ title: `${label} plan`, agentType: 'general', contextMode: 'full' }],
    completedSegmentIndices: [],
    fullAnalysisText: `${label} analysis text`,
    segmentResults: [],
  };
}

async function main() {
  (globalThis as any).localStorage = new MemoryStorage();

  clearHistory();
  await clearResumeState();
  await clearSavedSubjects();

  const sharedSubjectId = 'shared_subject_1';
  const footballMatch = buildMatch(sharedSubjectId, 'Premier League', 'Arsenal', 'Chelsea');
  const stocksSubject = buildMatch(sharedSubjectId, 'NASDAQ', 'AAPL', 'MSFT');

  await saveHistory(
    footballMatch,
    { prediction: 'Football domain prediction' },
    undefined,
    undefined,
    {
      domainId: 'football',
      subjectId: sharedSubjectId,
      subjectType: 'match',
      subjectSnapshot: footballMatch,
    },
  );

  await saveHistory(
    stocksSubject,
    { prediction: 'Stocks domain prediction' },
    undefined,
    undefined,
    {
      domainId: 'stocks',
      subjectId: sharedSubjectId,
      subjectType: 'instrument',
      subjectSnapshot: { ticker: 'AAPL' },
    },
  );

  const footballHistory = await getHistory({ domainId: 'football' });
  const stocksHistory = await getHistory({ domainId: 'stocks' });
  assertCondition(footballHistory.length === 1, 'Expected one football history record');
  assertCondition(stocksHistory.length === 1, 'Expected one stocks history record');
  assertCondition(
    footballHistory[0].subjectType === 'match' && stocksHistory[0].subjectType === 'instrument',
    'History records should preserve subjectType',
  );

  await saveResumeState(sharedSubjectId, buildResumeState('football'), 'football thoughts', {
    domainId: 'football',
    subjectId: sharedSubjectId,
    subjectType: 'match',
    subjectSnapshot: footballMatch,
  });

  await saveResumeState(sharedSubjectId, buildResumeState('stocks'), 'stocks thoughts', {
    domainId: 'stocks',
    subjectId: sharedSubjectId,
    subjectType: 'instrument',
    subjectSnapshot: { ticker: 'AAPL' },
  });

  const footballResume = await getResumeState(sharedSubjectId, {
    domainId: 'football',
    subjectId: sharedSubjectId,
    subjectType: 'match',
  });
  const stocksResume = await getResumeState(sharedSubjectId, {
    domainId: 'stocks',
    subjectId: sharedSubjectId,
    subjectType: 'instrument',
  });
  assertCondition(footballResume?.thoughts === 'football thoughts', 'Football resume mismatch');
  assertCondition(stocksResume?.thoughts === 'stocks thoughts', 'Stocks resume mismatch');

  await saveSubject(footballMatch, {
    domainId: 'football',
    subjectId: sharedSubjectId,
    subjectType: 'match',
    subjectSnapshot: footballMatch,
  });
  await saveSubject(stocksSubject, {
    domainId: 'stocks',
    subjectId: sharedSubjectId,
    subjectType: 'instrument',
    subjectSnapshot: { ticker: 'AAPL' },
  });

  const footballSaved = await getSavedSubjects({ domainId: 'football' });
  const stocksSaved = await getSavedSubjects({ domainId: 'stocks' });
  assertCondition(footballSaved.length === 1, 'Expected one football saved subject');
  assertCondition(stocksSaved.length === 1, 'Expected one stocks saved subject');

  await clearHistoryByDomain('football');
  await clearResumeStateByDomain('football');
  await clearSavedSubjectsByDomain('football');

  const footballHistoryAfterClear = await getHistory({ domainId: 'football' });
  const stocksHistoryAfterClear = await getHistory({ domainId: 'stocks' });
  assertCondition(footballHistoryAfterClear.length === 0, 'Football history should be cleared');
  assertCondition(stocksHistoryAfterClear.length === 1, 'Stocks history should remain');

  const footballResumeAfterClear = await getResumeState(sharedSubjectId, {
    domainId: 'football',
    subjectId: sharedSubjectId,
    subjectType: 'match',
  });
  const stocksResumeAfterClear = await getResumeState(sharedSubjectId, {
    domainId: 'stocks',
    subjectId: sharedSubjectId,
    subjectType: 'instrument',
  });
  assertCondition(!footballResumeAfterClear, 'Football resume should be cleared');
  assertCondition(!!stocksResumeAfterClear, 'Stocks resume should remain');

  const footballSavedAfterClear = await getSavedSubjects({ domainId: 'football' });
  const stocksSavedAfterClear = await getSavedSubjects({ domainId: 'stocks' });
  assertCondition(footballSavedAfterClear.length === 0, 'Football saved subjects should be cleared');
  assertCondition(stocksSavedAfterClear.length === 1, 'Stocks saved subjects should remain');

  console.log('Storage V3 regression checks passed.');
}

main().catch((error) => {
  console.error('Storage V3 regression checks failed.');
  console.error(error);
  process.exitCode = 1;
});
