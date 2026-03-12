import type { Match } from '@/src/data/matches';
import { resolveDomainMatchFeed } from '@/src/services/domainMatchFeed';
import { getDB, SYNCED_MATCHES_TABLE } from '@/src/services/db';

const SYNCED_MATCHES_STORAGE_KEY = 'matchflow_synced_matches_v1';

interface StoredSyncedMatchRecord {
  id: string;
  domainId: string;
  league: string;
  status: string;
  matchDate: string;
  kickoffAt: string;
  homeName: string;
  awayName: string;
  payloadData: Match;
  updatedAt: number;
}

export interface SyncedMatchesQuery {
  sql: string;
  params: (string | number)[];
}

export interface SyncedMatchesLookup {
  domainId: string;
  matchDate?: string;
  statuses?: string[];
  leagueTerms?: string[];
}

function createAbortError(): Error & { name: string } {
  const error = new Error('Synced matches operation aborted') as Error & { name: string };
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return;
  }

  throw createAbortError();
}

function toLocalDateKey(input: string | number | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeMatchRecord(match: Match, domainId: string, updatedAt: number): StoredSyncedMatchRecord {
  return {
    id: String(match.id),
    domainId,
    league: String(match.league || ''),
    status: String(match.status || ''),
    matchDate: toLocalDateKey(match.date || Date.now()),
    kickoffAt: typeof match.date === 'string' ? match.date : new Date().toISOString(),
    homeName: String(match.homeTeam?.name || ''),
    awayName: String(match.awayTeam?.name || ''),
    payloadData: match,
    updatedAt,
  };
}

function readStoredMatches(): StoredSyncedMatchRecord[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const raw = localStorage.getItem(SYNCED_MATCHES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is StoredSyncedMatchRecord =>
        !!entry &&
        typeof entry.id === 'string' &&
        typeof entry.domainId === 'string' &&
        typeof entry.matchDate === 'string' &&
        typeof entry.kickoffAt === 'string' &&
        typeof entry.updatedAt === 'number' &&
        typeof entry.payloadData === 'object',
    );
  } catch (error) {
    console.error('Failed to read synced matches cache', error);
    return [];
  }
}

function writeStoredMatches(records: StoredSyncedMatchRecord[]) {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(SYNCED_MATCHES_STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.error('Failed to write synced matches cache', error);
  }
}

async function resolveMatchesForDomain(
  domainId: string,
  signal?: AbortSignal,
): Promise<Match[]> {
  throwIfAborted(signal);
  const matches = await resolveDomainMatchFeed({
    domainId,
    signal,
  });
  throwIfAborted(signal);
  return matches;
}

export function buildSyncedMatchesQueryByDate(
  domainId: string,
  matchDate: string,
): SyncedMatchesQuery {
  return buildSyncedMatchesQuery({
    domainId,
    matchDate,
  });
}

function normalizeStringList(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0),
    ),
  );
}

export function buildSyncedMatchesQuery(filters: SyncedMatchesLookup): SyncedMatchesQuery {
  const whereClauses = ['domainId = ?'];
  const params: Array<string | number> = [filters.domainId];
  const statuses = normalizeStringList(filters.statuses);
  const leagueTerms = normalizeStringList(filters.leagueTerms);

  if (typeof filters.matchDate === 'string' && filters.matchDate.trim().length > 0) {
    whereClauses.push('matchDate = ?');
    params.push(filters.matchDate.trim());
  }

  if (statuses.length > 0) {
    whereClauses.push(`status IN (${statuses.map(() => '?').join(', ')})`);
    params.push(...statuses);
  }

  if (leagueTerms.length > 0) {
    whereClauses.push(
      `(${leagueTerms.map(() => 'LOWER(league) LIKE ?').join(' OR ')})`,
    );
    params.push(...leagueTerms.map((term) => `%${term.toLowerCase()}%`));
  }

  return {
    sql: `
      SELECT payloadData
      FROM ${SYNCED_MATCHES_TABLE}
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY kickoffAt ASC
    `,
    params,
  };
}

export async function syncMatchesToLocalCache(
  domainId: string,
  input: {
    signal?: AbortSignal;
  } = {},
): Promise<Match[]> {
  const matches = await resolveMatchesForDomain(domainId, input.signal);
  const updatedAt = Date.now();
  const records = matches.map((match) => normalizeMatchRecord(match, domainId, updatedAt));
  const db = await getDB();

  if (db) {
    await db.run(`DELETE FROM ${SYNCED_MATCHES_TABLE} WHERE domainId = ?`, [domainId]);
    for (const record of records) {
      await db.run(
        `
          INSERT OR REPLACE INTO ${SYNCED_MATCHES_TABLE}
          (id, domainId, league, status, matchDate, kickoffAt, homeName, awayName, payloadData, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.domainId,
          record.league,
          record.status,
          record.matchDate,
          record.kickoffAt,
          record.homeName,
          record.awayName,
          JSON.stringify(record.payloadData),
          record.updatedAt,
        ],
      );
    }
    return matches;
  }

  const current = readStoredMatches().filter((entry) => entry.domainId !== domainId);
  writeStoredMatches([...current, ...records]);
  return matches;
}

export async function queryLocalMatchesByDate(
  domainId: string,
  matchDate: string,
  input: {
    signal?: AbortSignal;
  } = {},
): Promise<Match[]> {
  throwIfAborted(input.signal);
  return queryLocalMatches({
    domainId,
    matchDate,
  });
}

export async function queryLocalMatches(filters: SyncedMatchesLookup): Promise<Match[]> {
  const normalizedStatuses = normalizeStringList(filters.statuses);
  const normalizedLeagueTerms = normalizeStringList(filters.leagueTerms).map((term) =>
    term.toLowerCase(),
  );
  const db = await getDB();
  if (db) {
    const query = buildSyncedMatchesQuery(filters);
    const result = await db.query(query.sql, query.params);
    return Array.isArray(result.values)
      ? result.values
          .map((row) => {
            if (typeof row?.payloadData !== 'string') return null;
            try {
              return JSON.parse(row.payloadData) as Match;
            } catch {
              return null;
            }
          })
          .filter((entry): entry is Match => Boolean(entry))
      : [];
  }

  return readStoredMatches()
    .filter((entry) => {
      if (entry.domainId !== filters.domainId) {
        return false;
      }
      if (filters.matchDate && entry.matchDate !== filters.matchDate) {
        return false;
      }
      if (normalizedStatuses.length > 0 && !normalizedStatuses.includes(entry.status)) {
        return false;
      }
      if (
        normalizedLeagueTerms.length > 0 &&
        !normalizedLeagueTerms.some((term) => entry.league.toLowerCase().includes(term))
      ) {
        return false;
      }
      return true;
    })
    .sort((left, right) => left.kickoffAt.localeCompare(right.kickoffAt))
    .map((entry) => entry.payloadData);
}

export async function listTodayLocalMatches(
  domainId: string,
  now: Date = new Date(),
  input: {
    signal?: AbortSignal;
  } = {},
): Promise<Match[]> {
  const matchDate = toLocalDateKey(now);
  await syncMatchesToLocalCache(domainId, {
    signal: input.signal,
  });
  throwIfAborted(input.signal);
  return queryLocalMatches({
    domainId,
    matchDate,
  });
}
