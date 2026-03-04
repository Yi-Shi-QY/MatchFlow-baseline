import { Capacitor } from '@capacitor/core';
import { getDB, SAVED_MATCHES_TABLE } from './db';
import { Match } from '../data/matches';
import type { SubjectRefInput } from './history';

const LOCAL_STORAGE_KEY = 'matchflow_saved_subjects_v3';
const MAX_SAVED_SUBJECT_COUNT = 100;
const DEFAULT_DOMAIN_ID = 'football';
const DEFAULT_SUBJECT_TYPE = 'match';
const SUBJECT_KEY_SEPARATOR = '::';

export interface SaveSubjectOptions extends SubjectRefInput {
  subjectSnapshot?: unknown;
}

export interface SavedSubjectQueryOptions extends SubjectRefInput {}

interface NormalizedSubjectRef {
  domainId: string;
  subjectId: string;
  subjectType: string;
  subjectKey: string;
}

export interface SavedSubjectRecord {
  id: string; // legacy alias of subjectId
  domainId: string;
  subjectId: string;
  subjectType: string;
  subjectSnapshot?: unknown;
  match: Match;
  timestamp: number;
}

function prefersNativeDB(): boolean {
  return Capacitor.isNativePlatform();
}

function normalizeDomainId(input: unknown): string {
  if (typeof input !== 'string') return DEFAULT_DOMAIN_ID;
  const normalized = input.trim();
  return normalized.length > 0 ? normalized : DEFAULT_DOMAIN_ID;
}

function normalizeSubjectId(input: unknown, fallback: string): string {
  if (typeof input === 'string' && input.trim().length > 0) return input.trim();
  const fallbackValue = String(fallback || '').trim();
  return fallbackValue.length > 0 ? fallbackValue : 'unknown_subject';
}

function normalizeSubjectType(input: unknown): string {
  if (typeof input !== 'string') return DEFAULT_SUBJECT_TYPE;
  const normalized = input.trim();
  return normalized.length > 0 ? normalized : DEFAULT_SUBJECT_TYPE;
}

function buildSubjectKey(domainId: string, subjectId: string): string {
  return `${domainId}${SUBJECT_KEY_SEPARATOR}${subjectId}`;
}

function parseSubjectKey(input: string | null | undefined): { domainId: string; subjectId: string } | null {
  if (typeof input !== 'string' || input.trim().length === 0) return null;
  const index = input.indexOf(SUBJECT_KEY_SEPARATOR);
  if (index <= 0) return null;
  const domainId = input.slice(0, index).trim();
  const subjectId = input.slice(index + SUBJECT_KEY_SEPARATOR.length).trim();
  if (!domainId || !subjectId) return null;
  return { domainId, subjectId };
}

function buildSubjectRef(fallbackSubjectId: string, input?: SubjectRefInput): NormalizedSubjectRef {
  const domainId = normalizeDomainId(input?.domainId);
  const subjectId = normalizeSubjectId(input?.subjectId, fallbackSubjectId);
  const subjectType = normalizeSubjectType(input?.subjectType);
  return {
    domainId,
    subjectId,
    subjectType,
    subjectKey: buildSubjectKey(domainId, subjectId),
  };
}

function isRecordObject(input: unknown): input is Record<string, unknown> {
  return !!input && typeof input === 'object' && !Array.isArray(input);
}

function buildFallbackMatch(subjectId: string, domainId: string): Match {
  return {
    id: subjectId,
    league: domainId.toUpperCase(),
    date: new Date().toISOString(),
    status: 'upcoming',
    homeTeam: {
      id: `${subjectId}_home`,
      name: 'Subject A',
      logo: 'https://picsum.photos/seed/subject-a/200/200',
      form: ['?', '?', '?', '?', '?'],
    },
    awayTeam: {
      id: `${subjectId}_away`,
      name: 'Subject B',
      logo: 'https://picsum.photos/seed/subject-b/200/200',
      form: ['?', '?', '?', '?', '?'],
    },
    stats: {
      possession: { home: 50, away: 50 },
      shots: { home: 0, away: 0 },
      shotsOnTarget: { home: 0, away: 0 },
    },
  };
}

function coerceMatch(raw: unknown, subjectId: string, domainId: string): Match {
  if (!isRecordObject(raw)) return buildFallbackMatch(subjectId, domainId);
  const match = raw as Partial<Match>;
  return {
    ...buildFallbackMatch(subjectId, domainId),
    ...match,
    id: typeof match.id === 'string' && match.id.trim().length > 0 ? match.id : subjectId,
    league:
      typeof match.league === 'string' && match.league.trim().length > 0
        ? match.league
        : domainId,
  };
}

function normalizeSavedSubjectRecord(raw: unknown): SavedSubjectRecord | null {
  if (!isRecordObject(raw)) return null;
  if (typeof raw.timestamp !== 'number' || !Number.isFinite(raw.timestamp)) return null;

  const parsedFromId = parseSubjectKey(typeof raw.id === 'string' ? raw.id : null);
  const domainId = normalizeDomainId(raw.domainId ?? parsedFromId?.domainId);
  const subjectId = normalizeSubjectId(raw.subjectId ?? raw.id ?? parsedFromId?.subjectId, 'unknown_subject');
  const subjectType = normalizeSubjectType(raw.subjectType);
  const subjectSnapshot = raw.subjectSnapshot ?? raw.snapshotData ?? raw.match;
  const match = coerceMatch(raw.match ?? subjectSnapshot, subjectId, domainId);

  return {
    id: subjectId,
    domainId,
    subjectId,
    subjectType,
    subjectSnapshot,
    match,
    timestamp: raw.timestamp,
  };
}

function matchQuery(record: SavedSubjectRecord, options?: SavedSubjectQueryOptions): boolean {
  if (!options) return true;
  const domainId = typeof options.domainId === 'string' ? options.domainId.trim() : '';
  const subjectId = typeof options.subjectId === 'string' ? options.subjectId.trim() : '';
  if (domainId && record.domainId !== domainId) return false;
  if (subjectId && record.subjectId !== subjectId) return false;
  return true;
}

function readSavedSubjectsFromLocalStorage(): SavedSubjectRecord[] {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => normalizeSavedSubjectRecord(item))
      .filter((item): item is SavedSubjectRecord => Boolean(item))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_SAVED_SUBJECT_COUNT);
  } catch (e) {
    console.error('Failed to fetch saved subjects from localStorage', e);
    return [];
  }
}

function writeSavedSubjectsToLocalStorage(records: SavedSubjectRecord[]) {
  const normalized = [...records].sort((a, b) => b.timestamp - a.timestamp);
  const trimmed = normalized.slice(0, MAX_SAVED_SUBJECT_COUNT);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trimmed));
}

export async function getSavedSubjects(
  options?: SavedSubjectQueryOptions,
): Promise<SavedSubjectRecord[]> {
  if (prefersNativeDB()) {
    const db = await getDB();
    if (db) {
      try {
        const conditions: string[] = [];
        const params: Array<string> = [];
        if (typeof options?.domainId === 'string' && options.domainId.trim().length > 0) {
          conditions.push('domainId = ?');
          params.push(options.domainId.trim());
        }
        if (typeof options?.subjectId === 'string' && options.subjectId.trim().length > 0) {
          conditions.push('(subjectId = ? OR id = ?)');
          params.push(options.subjectId.trim(), options.subjectId.trim());
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const result = await db.query(
          `SELECT * FROM ${SAVED_MATCHES_TABLE} ${whereClause} ORDER BY timestamp DESC LIMIT ${MAX_SAVED_SUBJECT_COUNT}`,
          params,
        );
        if (Array.isArray(result.values)) {
          return result.values
            .map((row) =>
              normalizeSavedSubjectRecord({
                id: row.subjectId || row.id,
                domainId: row.domainId,
                subjectId: row.subjectId,
                subjectType: row.subjectType,
                subjectSnapshot: row.snapshotData ? JSON.parse(row.snapshotData) : undefined,
                match: row.matchData ? JSON.parse(row.matchData) : undefined,
                timestamp: row.timestamp,
              }),
            )
            .filter((row): row is SavedSubjectRecord => Boolean(row));
        }
      } catch (e) {
        console.error('Failed to fetch saved subjects from DB', e);
      }
    }
  }

  return readSavedSubjectsFromLocalStorage().filter((record) => matchQuery(record, options));
}

export async function saveSubject(
  match: Match,
  options?: SaveSubjectOptions,
): Promise<void> {
  const subjectRef = buildSubjectRef(match.id, {
    domainId: options?.domainId,
    subjectId: options?.subjectId,
    subjectType: options?.subjectType,
  });
  const timestamp = Date.now();
  const record: SavedSubjectRecord = {
    id: subjectRef.subjectId,
    domainId: subjectRef.domainId,
    subjectId: subjectRef.subjectId,
    subjectType: subjectRef.subjectType,
    subjectSnapshot: options?.subjectSnapshot ?? match,
    match: coerceMatch(match, subjectRef.subjectId, subjectRef.domainId),
    timestamp,
  };

  if (prefersNativeDB()) {
    const db = await getDB();
    if (db) {
      try {
        await db.run(
          `
          INSERT OR REPLACE INTO ${SAVED_MATCHES_TABLE}
          (id, domainId, subjectId, subjectType, snapshotData, matchData, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
          [
            subjectRef.subjectKey,
            record.domainId,
            record.subjectId,
            record.subjectType,
            JSON.stringify(record.subjectSnapshot ?? null),
            JSON.stringify(record.match),
            timestamp,
          ],
        );
        return;
      } catch (e) {
        console.error('Failed to save subject to DB', e);
      }
    }
  }

  const current = readSavedSubjectsFromLocalStorage();
  const filtered = current.filter(
    (item) => !(item.domainId === record.domainId && item.subjectId === record.subjectId),
  );
  writeSavedSubjectsToLocalStorage([record, ...filtered]);
}

export async function deleteSavedSubject(id: string, options?: SubjectRefInput): Promise<void> {
  const scopedSubject =
    options?.domainId || options?.subjectId
      ? buildSubjectRef(id, {
          domainId: options?.domainId,
          subjectId: options?.subjectId,
          subjectType: options?.subjectType,
        })
      : null;
  const parsedFromId = parseSubjectKey(id);

  if (prefersNativeDB()) {
    const db = await getDB();
    if (db) {
      try {
        if (scopedSubject) {
          await db.run(
            `
            DELETE FROM ${SAVED_MATCHES_TABLE}
            WHERE id = ? OR (domainId = ? AND subjectId = ?)
          `,
            [scopedSubject.subjectKey, scopedSubject.domainId, scopedSubject.subjectId],
          );
          return;
        }

        if (parsedFromId) {
          await db.run(
            `
            DELETE FROM ${SAVED_MATCHES_TABLE}
            WHERE id = ? OR (domainId = ? AND subjectId = ?)
          `,
            [id, parsedFromId.domainId, parsedFromId.subjectId],
          );
          return;
        }

        await db.run(
          `
          DELETE FROM ${SAVED_MATCHES_TABLE}
          WHERE id = ? OR subjectId = ?
        `,
          [id, id],
        );
        return;
      } catch (e) {
        console.error('Failed to delete saved subject from DB', e);
      }
    }
  }

  const current = readSavedSubjectsFromLocalStorage();
  const updated = current.filter((item) => {
    if (scopedSubject) {
      return !(item.domainId === scopedSubject.domainId && item.subjectId === scopedSubject.subjectId);
    }
    if (parsedFromId) {
      return !(item.domainId === parsedFromId.domainId && item.subjectId === parsedFromId.subjectId);
    }
    return item.id !== id && item.subjectId !== id;
  });
  writeSavedSubjectsToLocalStorage(updated);
}

export async function clearSavedSubjects(): Promise<void> {
  if (prefersNativeDB()) {
    const db = await getDB();
    if (db) {
      await db.run(`DELETE FROM ${SAVED_MATCHES_TABLE}`);
      return;
    }
  }
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

export async function clearSavedSubjectsByDomain(domainId: string): Promise<void> {
  const normalizedDomainId = normalizeDomainId(domainId);
  if (prefersNativeDB()) {
    const db = await getDB();
    if (db) {
      await db.run(`DELETE FROM ${SAVED_MATCHES_TABLE} WHERE domainId = ?`, [normalizedDomainId]);
      return;
    }
  }

  const current = readSavedSubjectsFromLocalStorage();
  const filtered = current.filter((item) => item.domainId !== normalizedDomainId);
  writeSavedSubjectsToLocalStorage(filtered);
}

// Backward compatibility aliases.
export type SaveMatchOptions = SaveSubjectOptions;
export type SavedMatchQueryOptions = SavedSubjectQueryOptions;
export type SavedMatchRecord = SavedSubjectRecord;
export const getSavedMatches = getSavedSubjects;
export const saveMatch = saveSubject;
export const deleteSavedMatch = deleteSavedSubject;
