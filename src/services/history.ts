import type { MatchAnalysis, AnalysisResumeState } from './ai';
import { AgentResult, parseAgentStream } from './agentParser';
import { getDB, HISTORY_TABLE, RESUME_STATE_TABLE } from './db';
import { Capacitor } from '@capacitor/core';
import type { AnalysisOutputEnvelope } from './ai/contracts';
import {
  coerceSubjectSnapshotToDisplayMatch,
  type SubjectDisplayMatch,
} from './subjectDisplayMatch';

export interface SubjectRefInput {
  domainId?: string | null;
  subjectId?: string | null;
  subjectType?: string | null;
}

export interface HistoryQueryOptions extends SubjectRefInput {}

export interface HistorySaveOptions extends SubjectRefInput {
  subjectSnapshot?: unknown;
  analysisOutputEnvelope?: AnalysisOutputEnvelope;
}

export interface SaveHistoryInput extends HistorySaveOptions {
  subjectDisplay?: SubjectDisplayMatch;
  analysis: MatchAnalysis;
  parsedStream?: AgentResult;
  generatedCodes?: Record<string, string>;
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
  domainId: string;
  subjectId: string;
  subjectType: string;
  subjectSnapshot?: unknown;
  subjectDisplay: SubjectDisplayMatch;
  analysis: MatchAnalysis;
  parsedStream?: AgentResult;
  generatedCodes?: Record<string, string>;
  analysisOutputEnvelope?: AnalysisOutputEnvelope;
  timestamp: number;
}

const HISTORY_KEY = 'matchflow_history_v4';
const RESUME_STATE_KEY = 'matchflow_resume_state_v4';
const RESUME_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RESUME_STATE_COUNT = 20;
const MAX_HISTORY_RECORD_COUNT = 20;
const DEFAULT_DOMAIN_ID = 'football';
const DEFAULT_SUBJECT_TYPE = 'match';
const SUBJECT_KEY_SEPARATOR = '::';
export const ANALYSIS_OUTPUT_ENVELOPE_CODE_KEY = 'analysisOutputEnvelope';

export interface SavedResumeState {
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

function resolveResumeStateSubjectDisplaySnapshot(
  state: AnalysisResumeState | undefined,
): AnalysisResumeState['subjectDisplaySnapshot'] {
  return state?.subjectDisplaySnapshot;
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

function normalizeGeneratedCodes(input: unknown): Record<string, string> | undefined {
  if (!isRecordObject(input)) return undefined;
  const entries = Object.entries(input).filter(
    (entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string',
  );
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries);
}

function normalizeOutputBlocks(input: unknown): AnalysisOutputEnvelope['blocks'] {
  if (!Array.isArray(input)) return [];
  return input
    .map((block) => {
      if (!isRecordObject(block) || typeof block.type !== 'string') {
        return null;
      }
      if (
        block.type !== 'text' &&
        block.type !== 'table' &&
        block.type !== 'chart' &&
        block.type !== 'image' &&
        block.type !== 'reference'
      ) {
        return null;
      }
      const nextBlock: AnalysisOutputEnvelope['blocks'][number] = {
        type: block.type,
      };
      if (typeof block.title === 'string') {
        nextBlock.title = block.title;
      }
      if (typeof block.content === 'string') {
        nextBlock.content = block.content;
      }
      if (isRecordObject(block.data)) {
        nextBlock.data = block.data;
      }
      return nextBlock;
    })
    .filter((block): block is AnalysisOutputEnvelope['blocks'][number] => Boolean(block));
}

function normalizeAnalysisOutputEnvelope(input: unknown): AnalysisOutputEnvelope | undefined {
  if (!isRecordObject(input)) return undefined;
  if (typeof input.summaryMarkdown !== 'string') return undefined;
  const blocks = normalizeOutputBlocks(input.blocks);
  return {
    summaryMarkdown: input.summaryMarkdown,
    blocks,
    rawProviderPayload: input.rawProviderPayload,
  };
}

function parseAnalysisOutputEnvelopeFromGeneratedCodes(
  generatedCodes?: Record<string, string>,
): AnalysisOutputEnvelope | undefined {
  if (!generatedCodes) return undefined;
  const rawEnvelope = generatedCodes[ANALYSIS_OUTPUT_ENVELOPE_CODE_KEY];
  if (typeof rawEnvelope !== 'string' || rawEnvelope.trim().length === 0) {
    return undefined;
  }
  try {
    return normalizeAnalysisOutputEnvelope(JSON.parse(rawEnvelope));
  } catch {
    return undefined;
  }
}

function mergeAnalysisOutputEnvelopeIntoGeneratedCodes(
  generatedCodes: Record<string, string> | undefined,
  outputEnvelope: AnalysisOutputEnvelope | undefined,
): Record<string, string> | undefined {
  if (!outputEnvelope) {
    return generatedCodes;
  }
  const merged = generatedCodes ? { ...generatedCodes } : {};
  merged[ANALYSIS_OUTPUT_ENVELOPE_CODE_KEY] = JSON.stringify(outputEnvelope);
  return merged;
}

function isResumeFresh(timestamp: number): boolean {
  return Date.now() - timestamp < RESUME_TTL_MS;
}

function normalizeResumeRecord(raw: unknown, keyHint?: string): SavedResumeState | null {
  if (!isRecordObject(raw)) return null;
  if (!isRecordObject(raw.state)) return null;
  if (typeof raw.timestamp !== 'number' || !Number.isFinite(raw.timestamp)) return null;
  if (typeof raw.thoughts !== 'string') return null;

  const rawId = typeof raw.id === 'string' ? raw.id : undefined;
  const keyParsed = parseSubjectKey(keyHint) ?? parseSubjectKey(rawId);
  const subjectIdInput = raw.subjectId ?? keyParsed?.subjectId;
  if (typeof subjectIdInput !== 'string' || subjectIdInput.trim().length === 0) {
    return null;
  }
  const domainId = normalizeDomainId(raw.domainId ?? keyParsed?.domainId);
  const subjectId = normalizeSubjectId(subjectIdInput, 'unknown_subject');
  const subjectType = normalizeSubjectType(raw.subjectType);

  return {
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

  const res = await db.query(`SELECT id FROM ${RESUME_STATE_TABLE} ORDER BY timestamp DESC`);
  const rows = Array.isArray(res.values) ? res.values : [];
  if (rows.length <= MAX_RESUME_STATE_COUNT) return;

  const staleRows = rows.slice(MAX_RESUME_STATE_COUNT);
  for (const row of staleRows) {
    if (row?.id) {
      await db.run(`DELETE FROM ${RESUME_STATE_TABLE} WHERE id = ?`, [row.id]);
    }
  }
}

function normalizeHistoryRecord(raw: unknown): HistoryRecord | null {
  if (!isRecordObject(raw)) return null;
  if (!raw.analysis) return null;
  if (typeof raw.timestamp !== 'number' || !Number.isFinite(raw.timestamp)) return null;

  const parsedFromId = parseSubjectKey(typeof raw.id === 'string' ? raw.id : undefined);
  const subjectIdInput = raw.subjectId ?? parsedFromId?.subjectId;
  if (typeof subjectIdInput !== 'string' || subjectIdInput.trim().length === 0) {
    return null;
  }
  const domainId = normalizeDomainId(raw.domainId ?? parsedFromId?.domainId);
  const subjectId = normalizeSubjectId(subjectIdInput, 'unknown_subject');
  const subjectType = normalizeSubjectType(raw.subjectType);
  const subjectSnapshot = raw.subjectSnapshot ?? raw.subjectSnapshotData;
  const subjectDisplay = coerceSubjectSnapshotToDisplayMatch(
    raw.subjectDisplay ?? raw.subjectDisplayData ?? subjectSnapshot,
    subjectId,
    domainId,
  );
  const generatedCodes = normalizeGeneratedCodes(raw.generatedCodes);
  const analysisOutputEnvelope =
    normalizeAnalysisOutputEnvelope(raw.analysisOutputEnvelope) ??
    parseAnalysisOutputEnvelopeFromGeneratedCodes(generatedCodes);

  const id =
    typeof raw.id === 'string' && raw.id.trim().length > 0
      ? raw.id
      : buildSubjectKey(domainId, subjectId);

  return {
    id,
    domainId,
    subjectId,
    subjectType,
    subjectSnapshot,
    subjectDisplay,
    analysis: raw.analysis as MatchAnalysis,
    parsedStream: raw.parsedStream as AgentResult | undefined,
    generatedCodes,
    analysisOutputEnvelope,
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
    const parsedFromId = parseSubjectKey(
      typeof rowValue?.id === 'string' ? rowValue.id : undefined,
    );
    const subjectIdInput = rowValue?.subjectId ?? parsedFromId?.subjectId;
    if (typeof subjectIdInput !== 'string' || subjectIdInput.trim().length === 0) {
      return null;
    }
    const domainId = normalizeDomainId(rowValue?.domainId ?? parsedFromId?.domainId);
    const subjectId = normalizeSubjectId(subjectIdInput, 'unknown_subject');
    const subjectType = normalizeSubjectType(rowValue?.subjectType);
    const subjectSnapshot =
      typeof rowValue?.subjectSnapshotData === 'string'
        ? JSON.parse(rowValue.subjectSnapshotData)
        : undefined;
    const subjectDisplay = coerceSubjectSnapshotToDisplayMatch(
      typeof rowValue?.subjectDisplayData === 'string'
        ? JSON.parse(rowValue.subjectDisplayData)
        : subjectSnapshot,
      subjectId,
      domainId,
    );
    const generatedCodes = normalizeGeneratedCodes(
      typeof rowValue?.generatedCodesData === 'string'
        ? JSON.parse(rowValue.generatedCodesData)
        : undefined,
    );
    const analysisOutputEnvelope = parseAnalysisOutputEnvelopeFromGeneratedCodes(generatedCodes);

    return {
      id:
        typeof rowValue?.id === 'string' && rowValue.id.trim().length > 0
          ? rowValue.id
          : buildSubjectKey(domainId, subjectId),
      domainId,
      subjectId,
      subjectType,
      subjectSnapshot,
      subjectDisplay,
      analysis:
        typeof rowValue?.analysisData === 'string'
          ? JSON.parse(rowValue.analysisData)
          : ({} as MatchAnalysis),
      parsedStream:
        typeof rowValue?.parsedStreamData === 'string'
          ? JSON.parse(rowValue.parsedStreamData)
          : undefined,
      generatedCodes,
      analysisOutputEnvelope,
      timestamp: typeof rowValue?.timestamp === 'number' ? rowValue.timestamp : Date.now(),
    };
  } catch {
    return null;
  }
}

export async function getResumeState(
  subjectId: string,
  options?: ResumeStateOptions,
): Promise<SavedResumeState | null> {
  const subjectRef = buildSubjectRef(subjectId, {
    domainId: options?.domainId,
    subjectId: options?.subjectId,
    subjectType: options?.subjectType,
  });
  try {
    if (prefersNativeDB()) {
      const db = await getDB();
      if (db) {
        await pruneNativeResumeState();
        const res = await db.query(
          `
            SELECT *
            FROM ${RESUME_STATE_TABLE}
            WHERE id = ?
            LIMIT 1
          `,
          [subjectRef.subjectKey],
        );

        const row = res.values?.[0];
        if (!row) return null;
        if (!isResumeFresh(row.timestamp)) {
          await db.run(`DELETE FROM ${RESUME_STATE_TABLE} WHERE id = ?`, [row.id]);
          return null;
        }

        return normalizeResumeRecord(
          {
            id: row.id,
            domainId: row.domainId,
            subjectId: row.subjectId,
            subjectType: row.subjectType,
            state: JSON.parse(row.stateData),
            thoughts: typeof row.thoughts === 'string' ? row.thoughts : '',
            timestamp: row.timestamp,
          },
          row.id,
        );
      }
    }

    const currentMap = readResumeStateMap();
    const prunedMap = pruneResumeStateMap(currentMap);
    if (Object.keys(prunedMap).length !== Object.keys(currentMap).length) {
      writeResumeStateMap(prunedMap);
    }

    const direct = prunedMap[subjectRef.subjectKey];
    return direct ?? null;
  } catch (e) {
    console.error('Failed to load resume state', e);
  }
  return null;
}

export async function saveResumeState(
  subjectId: string,
  state: AnalysisResumeState,
  thoughts: string,
  options?: ResumeStateOptions,
) {
  const subjectRef = buildSubjectRef(subjectId, {
    domainId: options?.domainId,
    subjectId: options?.subjectId,
    subjectType: options?.subjectType,
  });

  try {
    const timestamp = Date.now();
    const stateWithSnapshots = state as AnalysisResumeState & {
      subjectSnapshot?: unknown;
    };
    const subjectSnapshot =
      options?.subjectSnapshot ??
      stateWithSnapshots.subjectSnapshot ??
      resolveResumeStateSubjectDisplaySnapshot(stateWithSnapshots) ??
      null;
    const stateToPersist: AnalysisResumeState = {
      ...state,
      subjectSnapshot: subjectSnapshot ?? undefined,
      subjectDisplaySnapshot:
        subjectRef.subjectType === 'match'
          ? coerceSubjectSnapshotToDisplayMatch(
              subjectSnapshot,
              subjectRef.subjectId,
              subjectRef.domainId,
            )
          : resolveResumeStateSubjectDisplaySnapshot(stateWithSnapshots),
    };

    if (prefersNativeDB()) {
      const db = await getDB();
      if (db) {
        await db.run(
          `
          INSERT OR REPLACE INTO ${RESUME_STATE_TABLE}
          (id, domainId, subjectId, subjectType, stateData, thoughts, timestamp)
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

export async function clearResumeState(subjectId?: string, options?: ResumeStateOptions) {
  try {
    if (prefersNativeDB()) {
      const db = await getDB();
      if (db) {
        if (!subjectId) {
          await db.run(`DELETE FROM ${RESUME_STATE_TABLE}`);
          return;
        }

        if (options?.domainId || options?.subjectId) {
          const subjectRef = buildSubjectRef(subjectId, {
            domainId: options?.domainId,
            subjectId: options?.subjectId,
            subjectType: options?.subjectType,
          });
          await db.run(
            `
            DELETE FROM ${RESUME_STATE_TABLE}
            WHERE id = ? OR (domainId = ? AND subjectId = ?)
          `,
            [subjectRef.subjectKey, subjectRef.domainId, subjectRef.subjectId],
          );
          return;
        }

        const parsedFromId = parseSubjectKey(subjectId);
        if (parsedFromId) {
          await db.run(
            `
            DELETE FROM ${RESUME_STATE_TABLE}
            WHERE id = ? OR (domainId = ? AND subjectId = ?)
          `,
            [subjectId, parsedFromId.domainId, parsedFromId.subjectId],
          );
          return;
        }

        await db.run(
          `
          DELETE FROM ${RESUME_STATE_TABLE}
          WHERE subjectId = ?
        `,
          [subjectId],
        );
        return;
      }
    }

    if (!subjectId) {
      localStorage.removeItem(RESUME_STATE_KEY);
      return;
    }

    const map = readResumeStateMap();
    const next: ResumeStateMap = {};
    const parsedFromId = parseSubjectKey(subjectId);
    Object.entries(map).forEach(([key, value]) => {
      if (options?.domainId || options?.subjectId) {
        const subjectRef = buildSubjectRef(subjectId, options);
        if (key === subjectRef.subjectKey) {
          return;
        }
        next[key] = value;
        return;
      }

      if (
        parsedFromId &&
        value.domainId === parsedFromId.domainId &&
        value.subjectId === parsedFromId.subjectId
      ) {
        return;
      }

      if (value.subjectId === subjectId) {
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
          conditions.push('subjectId = ?');
          params.push(subjectId);
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

export async function saveHistory(input: SaveHistoryInput) {
  const fallbackSubjectId =
    typeof input.subjectId === 'string' && input.subjectId.trim().length > 0
      ? input.subjectId.trim()
      : typeof input.subjectDisplay?.id === 'string' && input.subjectDisplay.id.trim().length > 0
        ? input.subjectDisplay.id.trim()
        : 'unknown_subject';
  const subjectRef = buildSubjectRef(fallbackSubjectId, {
    domainId: input.domainId,
    subjectId: input.subjectId,
    subjectType: input.subjectType,
  });

  try {
    const timestamp = Date.now();
    const subjectSnapshot = input.subjectSnapshot ?? input.subjectDisplay;
    const mergedGeneratedCodes = mergeAnalysisOutputEnvelopeIntoGeneratedCodes(
      input.generatedCodes,
      input.analysisOutputEnvelope,
    );
    const analysisOutputEnvelope =
      normalizeAnalysisOutputEnvelope(input.analysisOutputEnvelope) ??
      parseAnalysisOutputEnvelopeFromGeneratedCodes(mergedGeneratedCodes);
    const record: HistoryRecord = {
      id: subjectRef.subjectKey,
      domainId: subjectRef.domainId,
      subjectId: subjectRef.subjectId,
      subjectType: subjectRef.subjectType,
      subjectSnapshot,
      subjectDisplay: coerceSubjectSnapshotToDisplayMatch(
        input.subjectDisplay ?? subjectSnapshot,
        subjectRef.subjectId,
        subjectRef.domainId,
      ),
      analysis: input.analysis,
      parsedStream: input.parsedStream,
      generatedCodes: mergedGeneratedCodes,
      analysisOutputEnvelope,
      timestamp,
    };

    if (prefersNativeDB()) {
      const db = await getDB();
      if (db) {
        const parsedStreamStr = input.parsedStream ? JSON.stringify(input.parsedStream) : null;
        const generatedCodesStr = mergedGeneratedCodes ? JSON.stringify(mergedGeneratedCodes) : null;

        await db.run(
          `
          INSERT OR REPLACE INTO ${HISTORY_TABLE}
          (id, domainId, subjectId, subjectType, subjectSnapshotData, subjectDisplayData, analysisData, parsedStreamData, generatedCodesData, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            record.id,
            record.domainId,
            record.subjectId,
            record.subjectType,
            JSON.stringify(record.subjectSnapshot ?? null),
            JSON.stringify(record.subjectDisplay),
            JSON.stringify(record.analysis),
            parsedStreamStr,
            generatedCodesStr,
            record.timestamp,
          ],
        );

        await pruneNativeHistory();
        return record.id;
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
    return record.id;
  } catch (e) {
    console.error('Failed to save history', e);
  }
  return null;
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
            WHERE id = ? OR subjectId = ?
          `,
            [id, id],
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
          return !(record.id === id || record.subjectId === id);
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
      return !(record.id === id || record.subjectId === id);
    });
    writeHistoryToLocalStorage(updated);
  } catch (e) {
    console.error('Failed to delete history record', e);
  }
}
