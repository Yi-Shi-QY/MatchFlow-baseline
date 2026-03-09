import type { MatchAnalysis, AnalysisResumeState } from './ai';
import { Match } from '../data/matches';
import { AgentResult, parseAgentStream } from './agentParser';
import { getDB, HISTORY_TABLE, RESUME_STATE_TABLE } from './db';
import { Capacitor } from '@capacitor/core';

export interface SubjectRefInput {
  domainId?: string | null;
  subjectId?: string | null;
  subjectType?: string | null;
}

export interface HistoryQueryOptions extends SubjectRefInput {}

export interface HistorySaveOptions extends SubjectRefInput {
  subjectSnapshot?: unknown;
}

export interface ResumeStateOptions extends SubjectRefInput {
  subjectSnapshot?: unknown;
}

interface NormalizedSubjectRef {
  domainId: string;
  subjectId: string;
  subjectType: string;
  subjectKey: string;
}

export interface HistoryRecord {
  id: string;
  matchId: string; // legacy alias of subjectId
  domainId: string;
  subjectId: string;
  subjectType: string;
  subjectSnapshot?: unknown;
  match: Match;
  analysis: MatchAnalysis;
  parsedStream?: AgentResult;
  generatedCodes?: Record<string, string>;
  timestamp: number;
}

const HISTORY_KEY = 'matchflow_history_v3';
const RESUME_STATE_KEY = 'matchflow_resume_state_v3';
const RESUME_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RESUME_STATE_COUNT = 20;
const MAX_HISTORY_RECORD_COUNT = 20;
const DEFAULT_DOMAIN_ID = 'football';
const DEFAULT_SUBJECT_TYPE = 'match';
const SUBJECT_KEY_SEPARATOR = '::';

export interface SavedResumeState {
  matchId: string; // legacy alias of subjectId
  domainId: string;
  subjectId: string;
  subjectType: string;
  state: AnalysisResumeState;
  thoughts: string;
  timestamp: number;
}

export function isResumeStateRecoverable(
  savedState: SavedResumeState | null | undefined,
): boolean {
  if (!savedState) return false;
  const state = savedState.state;
  if (!state || typeof state !== 'object') return false;

  if (state.runtimeStatus?.stage === 'completed') {
    return false;
  }

  const planTotal = Array.isArray(state.plan) ? state.plan.length : 0;
  const completedSegments = Array.isArray(state.completedSegmentIndices)
    ? state.completedSegmentIndices.length
    : 0;
  const thoughts = typeof savedState.thoughts === 'string' ? savedState.thoughts.trim() : '';
  const fullAnalysisText =
    typeof state.fullAnalysisText === 'string' ? state.fullAnalysisText.trim() : '';
  const hasSegmentResults = Array.isArray(state.segmentResults) && state.segmentResults.length > 0;
  const hasRemainingPlanSegments = planTotal > 0 && completedSegments < planTotal;
  const hasArtifacts =
    hasRemainingPlanSegments || hasSegmentResults || thoughts.length > 0 || fullAnalysisText.length > 0;

  if (!hasArtifacts) {
    return false;
  }

  const parseInput = thoughts.length > 0 ? thoughts : fullAnalysisText;
  if (parseInput.length > 0) {
    const parsed = parseAgentStream(parseInput);
    if (parsed.summary) {
      return false;
    }
  }

  return true;
}

type ResumeStateMap = Record<string, SavedResumeState>;

function prefersNativeDB(): boolean {
  return Capacitor.isNativePlatform();
}

function normalizeDomainId(input: unknown): string {
  if (typeof input !== 'string') return DEFAULT_DOMAIN_ID;
  const normalized = input.trim();
  return normalized.length > 0 ? normalized : DEFAULT_DOMAIN_ID;
}

function normalizeSubjectId(input: unknown, fallback: string): string {
  if (typeof input === 'string' && input.trim().length > 0) {
    return input.trim();
  }
  const normalizedFallback = String(fallback || '').trim();
  return normalizedFallback.length > 0 ? normalizedFallback : 'unknown_subject';
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
  if (!isRecordObject(raw)) {
    return buildFallbackMatch(subjectId, domainId);
  }

  const homeTeamRaw = isRecordObject(raw.homeTeam) ? raw.homeTeam : {};
  const awayTeamRaw = isRecordObject(raw.awayTeam) ? raw.awayTeam : {};
  const statusRaw = raw.status;
  const status: Match['status'] =
    statusRaw === 'live' || statusRaw === 'finished' || statusRaw === 'upcoming'
      ? statusRaw
      : 'upcoming';

  return {
    id: typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id : subjectId,
    league: typeof raw.league === 'string' && raw.league.trim().length > 0 ? raw.league : domainId,
    date:
      typeof raw.date === 'string' && raw.date.trim().length > 0
        ? raw.date
        : new Date().toISOString(),
    status,
    homeTeam: {
      id:
        typeof homeTeamRaw.id === 'string' && homeTeamRaw.id.trim().length > 0
          ? homeTeamRaw.id
          : `${subjectId}_home`,
      name:
        typeof homeTeamRaw.name === 'string' && homeTeamRaw.name.trim().length > 0
          ? homeTeamRaw.name
          : 'Subject A',
      logo:
        typeof homeTeamRaw.logo === 'string' && homeTeamRaw.logo.trim().length > 0
          ? homeTeamRaw.logo
          : 'https://picsum.photos/seed/subject-a/200/200',
      form: Array.isArray(homeTeamRaw.form)
        ? homeTeamRaw.form.filter((entry): entry is string => typeof entry === 'string')
        : ['?', '?', '?', '?', '?'],
    },
    awayTeam: {
      id:
        typeof awayTeamRaw.id === 'string' && awayTeamRaw.id.trim().length > 0
          ? awayTeamRaw.id
          : `${subjectId}_away`,
      name:
        typeof awayTeamRaw.name === 'string' && awayTeamRaw.name.trim().length > 0
          ? awayTeamRaw.name
          : 'Subject B',
      logo:
        typeof awayTeamRaw.logo === 'string' && awayTeamRaw.logo.trim().length > 0
          ? awayTeamRaw.logo
          : 'https://picsum.photos/seed/subject-b/200/200',
      form: Array.isArray(awayTeamRaw.form)
        ? awayTeamRaw.form.filter((entry): entry is string => typeof entry === 'string')
        : ['?', '?', '?', '?', '?'],
    },
    score: isRecordObject(raw.score)
      ? {
          home: Number.isFinite(raw.score.home) ? Number(raw.score.home) : 0,
          away: Number.isFinite(raw.score.away) ? Number(raw.score.away) : 0,
        }
      : undefined,
    stats: isRecordObject(raw.stats) &&
      isRecordObject(raw.stats.possession) &&
      isRecordObject(raw.stats.shots) &&
      isRecordObject(raw.stats.shotsOnTarget)
      ? {
          possession: {
            home: Number.isFinite(raw.stats.possession.home) ? Number(raw.stats.possession.home) : 50,
            away: Number.isFinite(raw.stats.possession.away) ? Number(raw.stats.possession.away) : 50,
          },
          shots: {
            home: Number.isFinite(raw.stats.shots.home) ? Number(raw.stats.shots.home) : 0,
            away: Number.isFinite(raw.stats.shots.away) ? Number(raw.stats.shots.away) : 0,
          },
          shotsOnTarget: {
            home: Number.isFinite(raw.stats.shotsOnTarget.home)
              ? Number(raw.stats.shotsOnTarget.home)
              : 0,
            away: Number.isFinite(raw.stats.shotsOnTarget.away)
              ? Number(raw.stats.shotsOnTarget.away)
              : 0,
          },
        }
      : undefined,
    odds: isRecordObject(raw.odds) ? (raw.odds as Match['odds']) : undefined,
    source: typeof raw.source === 'string' ? raw.source : undefined,
    capabilities: isRecordObject(raw.capabilities)
      ? {
          hasStats: Boolean(raw.capabilities.hasStats),
          hasOdds: Boolean(raw.capabilities.hasOdds),
          hasCustom: Boolean(raw.capabilities.hasCustom),
        }
      : undefined,
  };
}

function isResumeFresh(timestamp: number): boolean {
  return Date.now() - timestamp < RESUME_TTL_MS;
}

function normalizeResumeRecord(raw: unknown, keyHint?: string): SavedResumeState | null {
  if (!isRecordObject(raw)) return null;
  if (!isRecordObject(raw.state)) return null;
  if (typeof raw.timestamp !== 'number' || !Number.isFinite(raw.timestamp)) return null;
  if (typeof raw.thoughts !== 'string') return null;

  const keyParsed = parseSubjectKey(keyHint);
  const domainId = normalizeDomainId(raw.domainId ?? keyParsed?.domainId);
  const subjectId = normalizeSubjectId(raw.subjectId ?? raw.matchId ?? keyParsed?.subjectId, 'unknown_subject');
  const subjectType = normalizeSubjectType(raw.subjectType);

  return {
    matchId: subjectId,
    domainId,
    subjectId,
    subjectType,
    state: raw.state as unknown as AnalysisResumeState,
    thoughts: raw.thoughts,
    timestamp: raw.timestamp,
  };
}

function normalizeResumeStateMap(raw: unknown): ResumeStateMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  // Backward compatibility: pre-v3 schema could store one record directly.
  const directRecord = normalizeResumeRecord(raw);
  if (directRecord) {
    return {
      [buildSubjectKey(directRecord.domainId, directRecord.subjectId)]: directRecord,
    };
  }

  const map: ResumeStateMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const normalized = normalizeResumeRecord(value, key);
    if (!normalized) continue;
    map[buildSubjectKey(normalized.domainId, normalized.subjectId)] = normalized;
  }
  return map;
}

function readResumeStateMap(): ResumeStateMap {
  try {
    const data = localStorage.getItem(RESUME_STATE_KEY);
    if (!data) return {};
    return normalizeResumeStateMap(JSON.parse(data));
  } catch {
    return {};
  }
}

function writeResumeStateMap(map: ResumeStateMap) {
  const keys = Object.keys(map);
  if (keys.length === 0) {
    localStorage.removeItem(RESUME_STATE_KEY);
    return;
  }
  localStorage.setItem(RESUME_STATE_KEY, JSON.stringify(map));
}

function pruneResumeStateMap(map: ResumeStateMap): ResumeStateMap {
  const freshEntries = Object.entries(map).filter(([, value]) => isResumeFresh(value.timestamp));
  if (freshEntries.length <= MAX_RESUME_STATE_COUNT) {
    return Object.fromEntries(freshEntries);
  }
  freshEntries.sort((a, b) => b[1].timestamp - a[1].timestamp);
  return Object.fromEntries(freshEntries.slice(0, MAX_RESUME_STATE_COUNT));
}

async function pruneNativeResumeState(): Promise<void> {
  if (!prefersNativeDB()) return;
  const db = await getDB();
  if (!db) return;

  const cutoff = Date.now() - RESUME_TTL_MS;
  await db.run(`DELETE FROM ${RESUME_STATE_TABLE} WHERE timestamp < ?`, [cutoff]);

  const res = await db.query(`SELECT matchId FROM ${RESUME_STATE_TABLE} ORDER BY timestamp DESC`);
  const rows = Array.isArray(res.values) ? res.values : [];
  if (rows.length <= MAX_RESUME_STATE_COUNT) return;

  const staleRows = rows.slice(MAX_RESUME_STATE_COUNT);
  for (const row of staleRows) {
    if (row?.matchId) {
      await db.run(`DELETE FROM ${RESUME_STATE_TABLE} WHERE matchId = ?`, [row.matchId]);
    }
  }
}

function normalizeHistoryRecord(raw: unknown): HistoryRecord | null {
  if (!isRecordObject(raw)) return null;
  if (!raw.analysis) return null;
  if (typeof raw.timestamp !== 'number' || !Number.isFinite(raw.timestamp)) return null;

  const domainId = normalizeDomainId(raw.domainId);
  const subjectId = normalizeSubjectId(raw.subjectId ?? raw.matchId ?? raw.id, 'unknown_subject');
  const subjectType = normalizeSubjectType(raw.subjectType);
  const subjectSnapshot = raw.subjectSnapshot ?? raw.subjectSnapshotData ?? raw.match;
  const match = coerceMatch(raw.match ?? subjectSnapshot, subjectId, domainId);

  const id =
    typeof raw.id === 'string' && raw.id.trim().length > 0
      ? raw.id
      : buildSubjectKey(domainId, subjectId);

  return {
    id,
    matchId: subjectId,
    domainId,
    subjectId,
    subjectType,
    subjectSnapshot,
    match,
    analysis: raw.analysis as MatchAnalysis,
    parsedStream: raw.parsedStream as AgentResult | undefined,
    generatedCodes: raw.generatedCodes as Record<string, string> | undefined,
    timestamp: raw.timestamp,
  };
}

function readHistoryFromLocalStorage(): HistoryRecord[] {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];

    const normalized = parsed
      .map((item) => normalizeHistoryRecord(item))
      .filter((item): item is HistoryRecord => Boolean(item))
      .sort((a, b) => b.timestamp - a.timestamp);

    return normalized.slice(0, MAX_HISTORY_RECORD_COUNT);
  } catch {
    return [];
  }
}

function writeHistoryToLocalStorage(records: HistoryRecord[]) {
  const normalized = [...records].sort((a, b) => b.timestamp - a.timestamp);
  const trimmed = normalized.slice(0, MAX_HISTORY_RECORD_COUNT);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}

async function pruneNativeHistory(): Promise<void> {
  if (!prefersNativeDB()) return;
  const db = await getDB();
  if (!db) return;

  const res = await db.query(`SELECT id FROM ${HISTORY_TABLE} ORDER BY timestamp DESC`);
  const rows = Array.isArray(res.values) ? res.values : [];
  if (rows.length <= MAX_HISTORY_RECORD_COUNT) return;

  const staleRows = rows.slice(MAX_HISTORY_RECORD_COUNT);
  for (const row of staleRows) {
    if (row?.id) {
      await db.run(`DELETE FROM ${HISTORY_TABLE} WHERE id = ?`, [row.id]);
    }
  }
}

function matchHistoryQuery(record: HistoryRecord, options?: HistoryQueryOptions): boolean {
  if (!options) return true;
  const domainId = typeof options.domainId === 'string' ? options.domainId.trim() : '';
  const subjectId = typeof options.subjectId === 'string' ? options.subjectId.trim() : '';
  if (domainId && record.domainId !== domainId) return false;
  if (subjectId && record.subjectId !== subjectId) return false;
  return true;
}

function normalizeSqlHistoryRow(row: unknown): HistoryRecord | null {
  try {
    const rowValue = row as Record<string, unknown>;
    const domainId = normalizeDomainId(rowValue?.domainId);
    const subjectId = normalizeSubjectId(
      rowValue?.subjectId ?? rowValue?.matchId,
      typeof rowValue?.id === 'string' ? rowValue.id : '',
    );
    const subjectType = normalizeSubjectType(rowValue?.subjectType);
    const subjectSnapshot =
      typeof rowValue?.subjectSnapshotData === 'string'
        ? JSON.parse(rowValue.subjectSnapshotData)
        : undefined;
    const match = coerceMatch(
      typeof rowValue?.matchData === 'string' ? JSON.parse(rowValue.matchData) : subjectSnapshot,
      subjectId,
      domainId,
    );

    return {
      id:
        typeof rowValue?.id === 'string' && rowValue.id.trim().length > 0
          ? rowValue.id
          : buildSubjectKey(domainId, subjectId),
      matchId: subjectId,
      domainId,
      subjectId,
      subjectType,
      subjectSnapshot,
      match,
      analysis:
        typeof rowValue?.analysisData === 'string'
          ? JSON.parse(rowValue.analysisData)
          : ({} as MatchAnalysis),
      parsedStream:
        typeof rowValue?.parsedStreamData === 'string'
          ? JSON.parse(rowValue.parsedStreamData)
          : undefined,
      generatedCodes:
        typeof rowValue?.generatedCodesData === 'string'
          ? JSON.parse(rowValue.generatedCodesData)
          : undefined,
      timestamp: typeof rowValue?.timestamp === 'number' ? rowValue.timestamp : Date.now(),
    };
  } catch {
    return null;
  }
}

export async function getResumeState(
  matchId: string,
  options?: ResumeStateOptions,
): Promise<SavedResumeState | null> {
  const subjectRef = buildSubjectRef(matchId, {
    domainId: options?.domainId,
    subjectId: options?.subjectId,
    subjectType: options?.subjectType,
  });
  const hasExplicitDomain =
    typeof options?.domainId === 'string' && options.domainId.trim().length > 0;

  try {
    if (prefersNativeDB()) {
      const db = await getDB();
      if (db) {
        await pruneNativeResumeState();
        const res = hasExplicitDomain
          ? await db.query(
              `
              SELECT *
              FROM ${RESUME_STATE_TABLE}
              WHERE (domainId = ? AND subjectId = ?)
                 OR (domainId = ? AND matchId = ?)
              ORDER BY timestamp DESC
              LIMIT 1
            `,
              [subjectRef.domainId, subjectRef.subjectId, subjectRef.domainId, subjectRef.subjectKey],
            )
          : await db.query(
              `
              SELECT *
              FROM ${RESUME_STATE_TABLE}
              WHERE (domainId = ? AND subjectId = ?) OR matchId = ? OR matchId = ?
              ORDER BY timestamp DESC
              LIMIT 1
            `,
              [subjectRef.domainId, subjectRef.subjectId, subjectRef.subjectKey, subjectRef.subjectId],
            );

        const row = res.values?.[0];
        if (!row) return null;
        if (!isResumeFresh(row.timestamp)) {
          await db.run(`DELETE FROM ${RESUME_STATE_TABLE} WHERE matchId = ?`, [row.matchId]);
          return null;
        }

        return normalizeResumeRecord(
          {
            matchId: row.subjectId || row.matchId,
            domainId: row.domainId,
            subjectId: row.subjectId,
            subjectType: row.subjectType,
            state: JSON.parse(row.stateData),
            thoughts: typeof row.thoughts === 'string' ? row.thoughts : '',
            timestamp: row.timestamp,
          },
          row.matchId,
        );
      }
    }

    const currentMap = readResumeStateMap();
    const prunedMap = pruneResumeStateMap(currentMap);
    if (Object.keys(prunedMap).length !== Object.keys(currentMap).length) {
      writeResumeStateMap(prunedMap);
    }

    const direct = prunedMap[subjectRef.subjectKey];
    if (direct) return direct;

    if (hasExplicitDomain) {
      return null;
    }

    // Backward-compatible fallback: pick newest record by subjectId across domains.
    const fallbackRecords = Object.values(prunedMap)
      .filter((record) => record.subjectId === subjectRef.subjectId)
      .sort((a, b) => b.timestamp - a.timestamp);
    return fallbackRecords[0] ?? null;
  } catch (e) {
    console.error('Failed to load resume state', e);
  }
  return null;
}

export async function saveResumeState(
  matchId: string,
  state: AnalysisResumeState,
  thoughts: string,
  options?: ResumeStateOptions,
) {
  const subjectRef = buildSubjectRef(matchId, {
    domainId: options?.domainId,
    subjectId: options?.subjectId,
    subjectType: options?.subjectType,
  });

  try {
    const timestamp = Date.now();
    const stateWithSnapshots = state as AnalysisResumeState & {
      subjectSnapshot?: unknown;
      matchSnapshot?: unknown;
    };
    const subjectSnapshot =
      options?.subjectSnapshot ??
      stateWithSnapshots.subjectSnapshot ??
      stateWithSnapshots.matchSnapshot ??
      null;
    const stateToPersist: AnalysisResumeState = {
      ...state,
      subjectSnapshot: subjectSnapshot ?? undefined,
      matchSnapshot:
        subjectRef.subjectType === 'match'
          ? (coerceMatch(subjectSnapshot, subjectRef.subjectId, subjectRef.domainId) as Match)
          : state.matchSnapshot,
    };

    if (prefersNativeDB()) {
      const db = await getDB();
      if (db) {
        await db.run(
          `
          INSERT OR REPLACE INTO ${RESUME_STATE_TABLE}
          (matchId, domainId, subjectId, subjectType, stateData, thoughts, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
          [
            subjectRef.subjectKey,
            subjectRef.domainId,
            subjectRef.subjectId,
            subjectRef.subjectType,
            JSON.stringify(stateToPersist),
            thoughts,
            timestamp,
          ],
        );
        await pruneNativeResumeState();
        return;
      }
    }

    const map = pruneResumeStateMap(readResumeStateMap());
    map[subjectRef.subjectKey] = {
      matchId: subjectRef.subjectId,
      domainId: subjectRef.domainId,
      subjectId: subjectRef.subjectId,
      subjectType: subjectRef.subjectType,
      state: stateToPersist,
      thoughts,
      timestamp,
    };
    writeResumeStateMap(pruneResumeStateMap(map));
  } catch (e) {
    console.error('Failed to save resume state', e);
  }
}

export async function clearResumeState(matchId?: string, options?: ResumeStateOptions) {
  try {
    if (prefersNativeDB()) {
      const db = await getDB();
      if (db) {
        if (!matchId) {
          await db.run(`DELETE FROM ${RESUME_STATE_TABLE}`);
          return;
        }

        if (options?.domainId || options?.subjectId) {
          const subjectRef = buildSubjectRef(matchId, {
            domainId: options?.domainId,
            subjectId: options?.subjectId,
            subjectType: options?.subjectType,
          });
          await db.run(
            `
            DELETE FROM ${RESUME_STATE_TABLE}
            WHERE (domainId = ? AND subjectId = ?) OR matchId = ?
          `,
            [subjectRef.domainId, subjectRef.subjectId, subjectRef.subjectKey],
          );
          return;
        }

        await db.run(
          `
          DELETE FROM ${RESUME_STATE_TABLE}
          WHERE subjectId = ? OR matchId = ?
        `,
          [matchId, matchId],
        );
        return;
      }
    }

    if (!matchId) {
      localStorage.removeItem(RESUME_STATE_KEY);
      return;
    }

    const map = readResumeStateMap();
    const next: ResumeStateMap = {};
    Object.entries(map).forEach(([key, value]) => {
      if (options?.domainId || options?.subjectId) {
        const subjectRef = buildSubjectRef(matchId, options);
        if (key === subjectRef.subjectKey) {
          return;
        }
        next[key] = value;
        return;
      }

      if (value.subjectId === matchId || value.matchId === matchId) {
        return;
      }
      next[key] = value;
    });
    writeResumeStateMap(next);
  } catch (e) {
    console.error('Failed to clear resume state', e);
  }
}

export async function getHistory(options?: HistoryQueryOptions): Promise<HistoryRecord[]> {
  try {
    if (prefersNativeDB()) {
      const db = await getDB();
      if (db) {
        const conditions: string[] = [];
        const params: Array<string> = [];

        const domainId =
          typeof options?.domainId === 'string' && options.domainId.trim().length > 0
            ? options.domainId.trim()
            : '';
        const subjectId =
          typeof options?.subjectId === 'string' && options.subjectId.trim().length > 0
            ? options.subjectId.trim()
            : '';

        if (domainId) {
          conditions.push('domainId = ?');
          params.push(domainId);
        }
        if (subjectId) {
          conditions.push('(subjectId = ? OR matchId = ?)');
          params.push(subjectId, subjectId);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const res = await db.query(
          `SELECT * FROM ${HISTORY_TABLE} ${whereClause} ORDER BY timestamp DESC LIMIT ${MAX_HISTORY_RECORD_COUNT}`,
          params,
        );
        if (!Array.isArray(res.values)) return [];

        return res.values
          .map((row) => normalizeSqlHistoryRow(row))
          .filter((record): record is HistoryRecord => Boolean(record));
      }
    }

    return readHistoryFromLocalStorage().filter((record) => matchHistoryQuery(record, options));
  } catch (e) {
    console.error('Failed to load history', e);
  }
  return [];
}

export async function saveHistory(
  match: Match,
  analysis: MatchAnalysis,
  parsedStream?: AgentResult,
  generatedCodes?: Record<string, string>,
  options?: HistorySaveOptions,
) {
  const subjectRef = buildSubjectRef(match.id, {
    domainId: options?.domainId,
    subjectId: options?.subjectId,
    subjectType: options?.subjectType,
  });

  try {
    const timestamp = Date.now();
    const subjectSnapshot = options?.subjectSnapshot ?? match;
    const record: HistoryRecord = {
      id: subjectRef.subjectKey,
      matchId: subjectRef.subjectId,
      domainId: subjectRef.domainId,
      subjectId: subjectRef.subjectId,
      subjectType: subjectRef.subjectType,
      subjectSnapshot,
      match: coerceMatch(match, subjectRef.subjectId, subjectRef.domainId),
      analysis,
      parsedStream,
      generatedCodes,
      timestamp,
    };

    if (prefersNativeDB()) {
      const db = await getDB();
      if (db) {
        const parsedStreamStr = parsedStream ? JSON.stringify(parsedStream) : null;
        const generatedCodesStr = generatedCodes ? JSON.stringify(generatedCodes) : null;

        await db.run(
          `
          INSERT OR REPLACE INTO ${HISTORY_TABLE}
          (id, matchId, domainId, subjectId, subjectType, subjectSnapshotData, matchData, analysisData, parsedStreamData, generatedCodesData, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            record.id,
            record.matchId,
            record.domainId,
            record.subjectId,
            record.subjectType,
            JSON.stringify(record.subjectSnapshot ?? null),
            JSON.stringify(record.match),
            JSON.stringify(record.analysis),
            parsedStreamStr,
            generatedCodesStr,
            record.timestamp,
          ],
        );

        await pruneNativeHistory();
        return;
      }
    }

    const history = readHistoryFromLocalStorage();
    const existingIndex = history.findIndex(
      (item) => item.domainId === record.domainId && item.subjectId === record.subjectId,
    );
    if (existingIndex >= 0) {
      history[existingIndex] = record;
    } else {
      history.unshift(record);
    }
    writeHistoryToLocalStorage(history);
  } catch (e) {
    console.error('Failed to save history', e);
  }
}

export function clearHistory() {
  if (prefersNativeDB()) {
    getDB()
      .then(async (db) => {
        if (db) {
          await db.run(`DELETE FROM ${HISTORY_TABLE}`);
          return;
        }
        localStorage.removeItem(HISTORY_KEY);
      })
      .catch((error) => {
        console.error('Failed to clear history in DB', error);
      });
    return;
  }
  localStorage.removeItem(HISTORY_KEY);
}

export async function clearHistoryByDomain(domainId: string): Promise<void> {
  const normalizedDomainId = normalizeDomainId(domainId);
  if (prefersNativeDB()) {
    const db = await getDB();
    if (db) {
      await db.run(`DELETE FROM ${HISTORY_TABLE} WHERE domainId = ?`, [normalizedDomainId]);
      return;
    }
  }

  const current = readHistoryFromLocalStorage();
  const filtered = current.filter((record) => record.domainId !== normalizedDomainId);
  writeHistoryToLocalStorage(filtered);
}

export async function clearResumeStateByDomain(domainId: string): Promise<void> {
  const normalizedDomainId = normalizeDomainId(domainId);
  if (prefersNativeDB()) {
    const db = await getDB();
    if (db) {
      await db.run(`DELETE FROM ${RESUME_STATE_TABLE} WHERE domainId = ?`, [normalizedDomainId]);
      return;
    }
  }

  const map = readResumeStateMap();
  const filteredEntries = Object.entries(map).filter(
    ([, value]) => value.domainId !== normalizedDomainId,
  );
  writeResumeStateMap(Object.fromEntries(filteredEntries));
}

export function deleteHistoryRecord(id: string, options?: SubjectRefInput) {
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
    getDB()
      .then(async (db) => {
        if (db) {
          if (scopedSubject) {
            await db.run(
              `
              DELETE FROM ${HISTORY_TABLE}
              WHERE id = ? OR (domainId = ? AND subjectId = ?)
            `,
              [scopedSubject.subjectKey, scopedSubject.domainId, scopedSubject.subjectId],
            );
            return;
          }

          if (parsedFromId) {
            await db.run(
              `
              DELETE FROM ${HISTORY_TABLE}
              WHERE id = ? OR (domainId = ? AND subjectId = ?)
            `,
              [id, parsedFromId.domainId, parsedFromId.subjectId],
            );
            return;
          }

          await db.run(
            `
            DELETE FROM ${HISTORY_TABLE}
            WHERE id = ? OR matchId = ? OR subjectId = ?
          `,
            [id, id, id],
          );
          return;
        }

        const history = readHistoryFromLocalStorage();
        const updated = history.filter((record) => {
          if (scopedSubject) {
            return !(
              record.domainId === scopedSubject.domainId &&
              record.subjectId === scopedSubject.subjectId
            );
          }
          if (parsedFromId) {
            return !(
              record.domainId === parsedFromId.domainId && record.subjectId === parsedFromId.subjectId
            );
          }
          return !(record.id === id || record.matchId === id || record.subjectId === id);
        });
        writeHistoryToLocalStorage(updated);
      })
      .catch((error) => {
        console.error('Failed to delete history record from DB', error);
      });
    return;
  }

  try {
    const history = readHistoryFromLocalStorage();
    const updated = history.filter((record) => {
      if (scopedSubject) {
        return !(
          record.domainId === scopedSubject.domainId && record.subjectId === scopedSubject.subjectId
        );
      }
      if (parsedFromId) {
        return !(record.domainId === parsedFromId.domainId && record.subjectId === parsedFromId.subjectId);
      }
      return !(record.id === id || record.matchId === id || record.subjectId === id);
    });
    writeHistoryToLocalStorage(updated);
  } catch (e) {
    console.error('Failed to delete history record', e);
  }
}
