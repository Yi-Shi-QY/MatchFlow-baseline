import {
  MANAGER_MEMORIES_TABLE,
  MANAGER_MESSAGES_TABLE,
  MANAGER_RUNS_TABLE,
  MANAGER_SESSIONS_TABLE,
  MANAGER_SUMMARIES_TABLE,
  getDB,
} from '@/src/services/db';
import { createAutomationId } from '@/src/services/automation/utils';
import type {
  ManagerGatewaySessionStore,
  ManagerMemoryRecord,
  ManagerMessageBlockType,
  ManagerMessageRecord,
  ManagerMessageRole,
  ManagerRunRecord,
  ManagerSessionRecord,
  ManagerSummaryRecord,
} from './types';

const MANAGER_GATEWAY_STORE_KEY = 'matchflow_manager_gateway_store_v1';
const MAIN_MANAGER_SESSION_KEY = 'manager:main';

interface ManagerGatewayStoreSnapshot {
  schemaVersion: 1;
  sessions: ManagerSessionRecord[];
  messages: ManagerMessageRecord[];
  runs: ManagerRunRecord[];
  summaries: ManagerSummaryRecord[];
  memories: ManagerMemoryRecord[];
}

let memoryStoreCache: ManagerGatewayStoreSnapshot | null = null;

function createEmptyStore(): ManagerGatewayStoreSnapshot {
  return {
    schemaVersion: 1,
    sessions: [],
    messages: [],
    runs: [],
    summaries: [],
    memories: [],
  };
}

function safeParse(input: string | null): unknown {
  if (!input) {
    return null;
  }
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function normalizeTimestamp(input: unknown, fallback: number): number {
  return typeof input === 'number' && Number.isFinite(input) ? input : fallback;
}

function normalizeMessageRole(input: unknown): ManagerMessageRole | null {
  if (input === 'user' || input === 'assistant' || input === 'system') {
    return input;
  }
  return null;
}

function normalizeMessageBlockType(input: unknown): ManagerMessageBlockType | null {
  switch (input) {
    case 'user_text':
    case 'assistant_text':
    case 'tool_status':
    case 'tool_result':
    case 'draft_bundle':
    case 'approval_request':
    case 'navigation_intent':
    case 'error_notice':
    case 'context_notice':
      return input;
    default:
      return null;
  }
}

function normalizeSessionStatus(input: unknown): ManagerSessionRecord['status'] | null {
  return input === 'active' || input === 'archived' ? input : null;
}

function normalizeRunStatus(input: unknown): ManagerRunRecord['status'] | null {
  switch (input) {
    case 'queued':
    case 'running':
    case 'completed':
    case 'failed':
    case 'cancelled':
      return input;
    default:
      return null;
  }
}

function normalizeSession(raw: unknown): ManagerSessionRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const value = raw as Record<string, unknown>;
  const status = normalizeSessionStatus(value.status);
  const id = typeof value.id === 'string' ? value.id : '';
  const sessionKey = typeof value.sessionKey === 'string' ? value.sessionKey : '';
  const title = typeof value.title === 'string' ? value.title : '';
  const domainId = typeof value.domainId === 'string' ? value.domainId : '';
  if (!id || !sessionKey || !title || !domainId || !status) {
    return null;
  }

  return {
    id,
    sessionKey,
    title,
    status,
    domainId,
    runtimeDomainVersion:
      typeof value.runtimeDomainVersion === 'string' ? value.runtimeDomainVersion : null,
    activeWorkflowType:
      typeof value.activeWorkflowType === 'string' ? value.activeWorkflowType : null,
    activeWorkflowStateData:
      typeof value.activeWorkflowStateData === 'string' ? value.activeWorkflowStateData : null,
    latestSummaryId:
      typeof value.latestSummaryId === 'string' ? value.latestSummaryId : null,
    latestMessageAt: normalizeTimestamp(value.latestMessageAt, Date.now()),
    createdAt: normalizeTimestamp(value.createdAt, Date.now()),
    updatedAt: normalizeTimestamp(value.updatedAt, Date.now()),
  };
}

function normalizeMessage(raw: unknown): ManagerMessageRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const value = raw as Record<string, unknown>;
  const role = normalizeMessageRole(value.role);
  const blockType = normalizeMessageBlockType(value.blockType);
  const id = typeof value.id === 'string' ? value.id : '';
  const sessionId = typeof value.sessionId === 'string' ? value.sessionId : '';
  const ordinal =
    typeof value.ordinal === 'number' && Number.isFinite(value.ordinal) ? value.ordinal : -1;
  if (!id || !sessionId || ordinal < 0 || !role || !blockType) {
    return null;
  }

  return {
    id,
    sessionId,
    runId: typeof value.runId === 'string' ? value.runId : null,
    ordinal,
    role,
    blockType,
    text: typeof value.text === 'string' ? value.text : null,
    payloadData: typeof value.payloadData === 'string' ? value.payloadData : null,
    createdAt: normalizeTimestamp(value.createdAt, Date.now()),
  };
}

function normalizeRun(raw: unknown): ManagerRunRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const value = raw as Record<string, unknown>;
  const status = normalizeRunStatus(value.status);
  const triggerType =
    value.triggerType === 'user' ||
    value.triggerType === 'system' ||
    value.triggerType === 'resume' ||
    value.triggerType === 'compaction'
      ? value.triggerType
      : null;
  const id = typeof value.id === 'string' ? value.id : '';
  const sessionId = typeof value.sessionId === 'string' ? value.sessionId : '';
  if (!id || !sessionId || !status || !triggerType) {
    return null;
  }

  return {
    id,
    sessionId,
    inputMessageId: typeof value.inputMessageId === 'string' ? value.inputMessageId : null,
    status,
    triggerType,
    plannerMode:
      value.plannerMode === 'deterministic' ||
      value.plannerMode === 'workflow' ||
      value.plannerMode === 'llm_assisted'
        ? value.plannerMode
        : null,
    intentType: typeof value.intentType === 'string' ? value.intentType : null,
    toolPath: typeof value.toolPath === 'string' ? value.toolPath : null,
    errorCode: typeof value.errorCode === 'string' ? value.errorCode : null,
    errorMessage: typeof value.errorMessage === 'string' ? value.errorMessage : null,
    stateData: typeof value.stateData === 'string' ? value.stateData : null,
    startedAt:
      typeof value.startedAt === 'number' && Number.isFinite(value.startedAt)
        ? value.startedAt
        : null,
    finishedAt:
      typeof value.finishedAt === 'number' && Number.isFinite(value.finishedAt)
        ? value.finishedAt
        : null,
    createdAt: normalizeTimestamp(value.createdAt, Date.now()),
    updatedAt: normalizeTimestamp(value.updatedAt, Date.now()),
  };
}

function normalizeSummary(raw: unknown): ManagerSummaryRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const value = raw as Record<string, unknown>;
  const id = typeof value.id === 'string' ? value.id : '';
  const sessionId = typeof value.sessionId === 'string' ? value.sessionId : '';
  const kind = typeof value.kind === 'string' ? value.kind : '';
  const cutoffOrdinal =
    typeof value.cutoffOrdinal === 'number' && Number.isFinite(value.cutoffOrdinal)
      ? value.cutoffOrdinal
      : -1;
  const summaryText = typeof value.summaryText === 'string' ? value.summaryText : '';
  const sourceMessageCount =
    typeof value.sourceMessageCount === 'number' && Number.isFinite(value.sourceMessageCount)
      ? value.sourceMessageCount
      : 0;

  if (!id || !sessionId || !kind || cutoffOrdinal < 0 || !summaryText) {
    return null;
  }

  return {
    id,
    sessionId,
    kind,
    cutoffOrdinal,
    summaryText,
    sourceMessageCount,
    createdAt: normalizeTimestamp(value.createdAt, Date.now()),
  };
}

function normalizeMemory(raw: unknown): ManagerMemoryRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const value = raw as Record<string, unknown>;
  const scopeType =
    value.scopeType === 'global' || value.scopeType === 'domain' || value.scopeType === 'session'
      ? value.scopeType
      : null;
  const id = typeof value.id === 'string' ? value.id : '';
  const scopeId = typeof value.scopeId === 'string' ? value.scopeId : '';
  const memoryType = typeof value.memoryType === 'string' ? value.memoryType : '';
  const keyText = typeof value.keyText === 'string' ? value.keyText : '';
  const contentText = typeof value.contentText === 'string' ? value.contentText : '';

  if (!id || !scopeType || !scopeId || !memoryType || !keyText || !contentText) {
    return null;
  }

  return {
    id,
    scopeType,
    scopeId,
    memoryType,
    keyText,
    contentText,
    importance:
      typeof value.importance === 'number' && Number.isFinite(value.importance)
        ? value.importance
        : null,
    source: typeof value.source === 'string' ? value.source : null,
    createdAt: normalizeTimestamp(value.createdAt, Date.now()),
    updatedAt: normalizeTimestamp(value.updatedAt, Date.now()),
  };
}

function normalizeStore(raw: unknown): ManagerGatewayStoreSnapshot {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return createEmptyStore();
  }

  const value = raw as Record<string, unknown>;
  return {
    schemaVersion: 1,
    sessions: Array.isArray(value.sessions)
      ? value.sessions
          .map(normalizeSession)
          .filter((entry): entry is ManagerSessionRecord => Boolean(entry))
      : [],
    messages: Array.isArray(value.messages)
      ? value.messages
          .map(normalizeMessage)
          .filter((entry): entry is ManagerMessageRecord => Boolean(entry))
      : [],
    runs: Array.isArray(value.runs)
      ? value.runs.map(normalizeRun).filter((entry): entry is ManagerRunRecord => Boolean(entry))
      : [],
    summaries: Array.isArray(value.summaries)
      ? value.summaries
          .map(normalizeSummary)
          .filter((entry): entry is ManagerSummaryRecord => Boolean(entry))
      : [],
    memories: Array.isArray(value.memories)
      ? value.memories
          .map(normalizeMemory)
          .filter((entry): entry is ManagerMemoryRecord => Boolean(entry))
      : [],
  };
}

function cloneStore(store: ManagerGatewayStoreSnapshot): ManagerGatewayStoreSnapshot {
  return {
    schemaVersion: 1,
    sessions: store.sessions.map((entry) => ({ ...entry })),
    messages: store.messages.map((entry) => ({ ...entry })),
    runs: store.runs.map((entry) => ({ ...entry })),
    summaries: store.summaries.map((entry) => ({ ...entry })),
    memories: store.memories.map((entry) => ({ ...entry })),
  };
}

function readFallbackStore(): ManagerGatewayStoreSnapshot {
  if (memoryStoreCache) {
    return cloneStore(memoryStoreCache);
  }

  if (typeof localStorage === 'undefined') {
    memoryStoreCache = createEmptyStore();
    return cloneStore(memoryStoreCache);
  }

  memoryStoreCache = normalizeStore(
    safeParse(localStorage.getItem(MANAGER_GATEWAY_STORE_KEY)),
  );
  return cloneStore(memoryStoreCache);
}

function writeFallbackStore(store: ManagerGatewayStoreSnapshot) {
  memoryStoreCache = cloneStore(store);
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(MANAGER_GATEWAY_STORE_KEY, JSON.stringify(store));
}

function createFreshSession(input: {
  domainId: string;
  runtimeDomainVersion?: string | null;
  title?: string;
  now: number;
}): ManagerSessionRecord {
  return {
    id: createAutomationId('manager_session'),
    sessionKey: MAIN_MANAGER_SESSION_KEY,
    title: input.title || 'Manager Main Session',
    status: 'active',
    domainId: input.domainId,
    runtimeDomainVersion: input.runtimeDomainVersion || null,
    activeWorkflowType: null,
    activeWorkflowStateData: null,
    latestSummaryId: null,
    latestMessageAt: input.now,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

function mapSessionRow(row: Record<string, unknown>): ManagerSessionRecord {
  return {
    id: String(row.id || ''),
    sessionKey: String(row.sessionKey || ''),
    title: String(row.title || ''),
    status: row.status === 'archived' ? 'archived' : 'active',
    domainId: String(row.domainId || ''),
    runtimeDomainVersion:
      typeof row.runtimeDomainVersion === 'string' ? row.runtimeDomainVersion : null,
    activeWorkflowType:
      typeof row.activeWorkflowType === 'string' ? row.activeWorkflowType : null,
    activeWorkflowStateData:
      typeof row.activeWorkflowStateData === 'string' ? row.activeWorkflowStateData : null,
    latestSummaryId:
      typeof row.latestSummaryId === 'string' ? row.latestSummaryId : null,
    latestMessageAt: normalizeTimestamp(row.latestMessageAt, Date.now()),
    createdAt: normalizeTimestamp(row.createdAt, Date.now()),
    updatedAt: normalizeTimestamp(row.updatedAt, Date.now()),
  };
}

function mapMessageRow(row: Record<string, unknown>): ManagerMessageRecord {
  return {
    id: String(row.id || ''),
    sessionId: String(row.sessionId || ''),
    runId: typeof row.runId === 'string' ? row.runId : null,
    ordinal: Number(row.ordinal || 0),
    role: row.role === 'user' ? 'user' : row.role === 'system' ? 'system' : 'assistant',
    blockType: normalizeMessageBlockType(row.blockType) || 'assistant_text',
    text: typeof row.text === 'string' ? row.text : null,
    payloadData: typeof row.payloadData === 'string' ? row.payloadData : null,
    createdAt: normalizeTimestamp(row.createdAt, Date.now()),
  };
}

function mapRunRow(row: Record<string, unknown>): ManagerRunRecord {
  return {
    id: String(row.id || ''),
    sessionId: String(row.sessionId || ''),
    inputMessageId: typeof row.inputMessageId === 'string' ? row.inputMessageId : null,
    status: normalizeRunStatus(row.status) || 'queued',
    triggerType:
      row.triggerType === 'system' || row.triggerType === 'resume' || row.triggerType === 'compaction'
        ? row.triggerType
        : 'user',
    plannerMode:
      row.plannerMode === 'deterministic' ||
      row.plannerMode === 'workflow' ||
      row.plannerMode === 'llm_assisted'
        ? row.plannerMode
        : null,
    intentType: typeof row.intentType === 'string' ? row.intentType : null,
    toolPath: typeof row.toolPath === 'string' ? row.toolPath : null,
    errorCode: typeof row.errorCode === 'string' ? row.errorCode : null,
    errorMessage: typeof row.errorMessage === 'string' ? row.errorMessage : null,
    stateData: typeof row.stateData === 'string' ? row.stateData : null,
    startedAt:
      typeof row.startedAt === 'number' && Number.isFinite(row.startedAt)
        ? row.startedAt
        : null,
    finishedAt:
      typeof row.finishedAt === 'number' && Number.isFinite(row.finishedAt)
        ? row.finishedAt
        : null,
    createdAt: normalizeTimestamp(row.createdAt, Date.now()),
    updatedAt: normalizeTimestamp(row.updatedAt, Date.now()),
  };
}

function mapSummaryRow(row: Record<string, unknown>): ManagerSummaryRecord {
  return {
    id: String(row.id || ''),
    sessionId: String(row.sessionId || ''),
    kind: String(row.kind || ''),
    cutoffOrdinal: Number(row.cutoffOrdinal || 0),
    summaryText: String(row.summaryText || ''),
    sourceMessageCount: Number(row.sourceMessageCount || 0),
    createdAt: normalizeTimestamp(row.createdAt, Date.now()),
  };
}

function mapMemoryRow(row: Record<string, unknown>): ManagerMemoryRecord {
  return {
    id: String(row.id || ''),
    scopeType:
      row.scopeType === 'global' || row.scopeType === 'session' ? row.scopeType : 'domain',
    scopeId: String(row.scopeId || ''),
    memoryType: String(row.memoryType || ''),
    keyText: String(row.keyText || ''),
    contentText: String(row.contentText || ''),
    importance:
      typeof row.importance === 'number' && Number.isFinite(row.importance)
        ? row.importance
        : null,
    source: typeof row.source === 'string' ? row.source : null,
    createdAt: normalizeTimestamp(row.createdAt, Date.now()),
    updatedAt: normalizeTimestamp(row.updatedAt, Date.now()),
  };
}

async function insertSessionIntoDb(session: ManagerSessionRecord) {
  const db = await getDB();
  if (!db) {
    return;
  }
  await db.run(
    `
      INSERT OR REPLACE INTO ${MANAGER_SESSIONS_TABLE}
      (id, sessionKey, title, status, domainId, runtimeDomainVersion, activeWorkflowType, activeWorkflowStateData, latestSummaryId, latestMessageAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      session.id,
      session.sessionKey,
      session.title,
      session.status,
      session.domainId,
      session.runtimeDomainVersion,
      session.activeWorkflowType,
      session.activeWorkflowStateData,
      session.latestSummaryId,
      session.latestMessageAt,
      session.createdAt,
      session.updatedAt,
    ],
  );
}

async function insertMessagesIntoDb(messages: ManagerMessageRecord[]) {
  const db = await getDB();
  if (!db) {
    return;
  }
  for (const message of messages) {
    await db.run(
      `
        INSERT OR REPLACE INTO ${MANAGER_MESSAGES_TABLE}
        (id, sessionId, runId, ordinal, role, blockType, text, payloadData, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        message.id,
        message.sessionId,
        message.runId,
        message.ordinal,
        message.role,
        message.blockType,
        message.text,
        message.payloadData,
        message.createdAt,
      ],
    );
  }
}

async function insertSummaryIntoDb(summary: ManagerSummaryRecord) {
  const db = await getDB();
  if (!db) {
    return;
  }
  await db.run(
    `
      INSERT OR REPLACE INTO ${MANAGER_SUMMARIES_TABLE}
      (id, sessionId, kind, cutoffOrdinal, summaryText, sourceMessageCount, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      summary.id,
      summary.sessionId,
      summary.kind,
      summary.cutoffOrdinal,
      summary.summaryText,
      summary.sourceMessageCount,
      summary.createdAt,
    ],
  );
}

async function insertMemoryIntoDb(memory: ManagerMemoryRecord) {
  const db = await getDB();
  if (!db) {
    return;
  }
  await db.run(
    `
      INSERT OR REPLACE INTO ${MANAGER_MEMORIES_TABLE}
      (id, scopeType, scopeId, memoryType, keyText, contentText, importance, source, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      memory.id,
      memory.scopeType,
      memory.scopeId,
      memory.memoryType,
      memory.keyText,
      memory.contentText,
      memory.importance,
      memory.source,
      memory.createdAt,
      memory.updatedAt,
    ],
  );
}

async function insertRunIntoDb(run: ManagerRunRecord) {
  const db = await getDB();
  if (!db) {
    return;
  }
  await db.run(
    `
      INSERT OR REPLACE INTO ${MANAGER_RUNS_TABLE}
      (id, sessionId, inputMessageId, status, triggerType, plannerMode, intentType, toolPath, errorCode, errorMessage, stateData, startedAt, finishedAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      run.id,
      run.sessionId,
      run.inputMessageId,
      run.status,
      run.triggerType,
      run.plannerMode,
      run.intentType,
      run.toolPath,
      run.errorCode,
      run.errorMessage,
      run.stateData,
      run.startedAt,
      run.finishedAt,
      run.createdAt,
      run.updatedAt,
    ],
  );
}

async function getNextOrdinalFromDb(sessionId: string): Promise<number> {
  const db = await getDB();
  if (!db) {
    return 0;
  }
  const result = await db.query(
    `SELECT MAX(ordinal) as maxOrdinal FROM ${MANAGER_MESSAGES_TABLE} WHERE sessionId = ?`,
    [sessionId],
  );
  const row = Array.isArray(result.values) ? result.values[0] : null;
  const maxOrdinal =
    row && typeof (row as Record<string, unknown>).maxOrdinal === 'number'
      ? Number((row as Record<string, unknown>).maxOrdinal)
      : -1;
  return maxOrdinal + 1;
}

export interface ManagerSessionStore extends ManagerGatewaySessionStore {
  getSessionByKey(sessionKey: string): Promise<ManagerSessionRecord | null>;
}

export function createManagerSessionStore(): ManagerSessionStore {
  return {
    async getSessionByKey(sessionKey: string): Promise<ManagerSessionRecord | null> {
      const db = await getDB();
      if (db) {
        const result = await db.query(
          `SELECT * FROM ${MANAGER_SESSIONS_TABLE} WHERE sessionKey = ? LIMIT 1`,
          [sessionKey],
        );
        const row = Array.isArray(result.values) ? result.values[0] : null;
        return row ? mapSessionRow(row as Record<string, unknown>) : null;
      }

      const store = readFallbackStore();
      return store.sessions.find((entry) => entry.sessionKey === sessionKey) || null;
    },

    async getOrCreateMainSession(input): Promise<ManagerSessionRecord> {
      const existing = await this.getSessionByKey(MAIN_MANAGER_SESSION_KEY);
      if (existing) {
        return existing;
      }

      const now = Date.now();
      const session = createFreshSession({
        domainId: input.domainId,
        runtimeDomainVersion: input.runtimeDomainVersion,
        title: input.title,
        now,
      });

      const db = await getDB();
      if (db) {
        await insertSessionIntoDb(session);
        return session;
      }

      const store = readFallbackStore();
      store.sessions.push(session);
      writeFallbackStore(store);
      return session;
    },

    async getSessionById(sessionId: string): Promise<ManagerSessionRecord | null> {
      const db = await getDB();
      if (db) {
        const result = await db.query(
          `SELECT * FROM ${MANAGER_SESSIONS_TABLE} WHERE id = ? LIMIT 1`,
          [sessionId],
        );
        const row = Array.isArray(result.values) ? result.values[0] : null;
        return row ? mapSessionRow(row as Record<string, unknown>) : null;
      }

      const store = readFallbackStore();
      return store.sessions.find((entry) => entry.id === sessionId) || null;
    },

    async listMessages(sessionId: string): Promise<ManagerMessageRecord[]> {
      const db = await getDB();
      if (db) {
        const result = await db.query(
          `SELECT * FROM ${MANAGER_MESSAGES_TABLE} WHERE sessionId = ? ORDER BY ordinal ASC`,
          [sessionId],
        );
        return Array.isArray(result.values)
          ? result.values.map((row) => mapMessageRow(row as Record<string, unknown>))
          : [];
      }

      const store = readFallbackStore();
      return store.messages
        .filter((entry) => entry.sessionId === sessionId)
        .sort((left, right) => left.ordinal - right.ordinal)
        .map((entry) => ({ ...entry }));
    },

    async getLatestSummary(sessionId: string): Promise<ManagerSummaryRecord | null> {
      const db = await getDB();
      if (db) {
        const result = await db.query(
          `
            SELECT * FROM ${MANAGER_SUMMARIES_TABLE}
            WHERE sessionId = ?
            ORDER BY createdAt DESC
            LIMIT 1
          `,
          [sessionId],
        );
        const row = Array.isArray(result.values) ? result.values[0] : null;
        return row ? mapSummaryRow(row as Record<string, unknown>) : null;
      }

      const store = readFallbackStore();
      return (
        store.summaries
          .filter((entry) => entry.sessionId === sessionId)
          .sort((left, right) => right.createdAt - left.createdAt)[0] || null
      );
    },

    async saveSummary(input): Promise<ManagerSummaryRecord> {
      const summary: ManagerSummaryRecord = {
        id: createAutomationId('manager_summary'),
        sessionId: input.sessionId,
        kind: input.kind,
        cutoffOrdinal: input.cutoffOrdinal,
        summaryText: input.summaryText,
        sourceMessageCount: input.sourceMessageCount,
        createdAt: input.createdAt || Date.now(),
      };

      const db = await getDB();
      if (db) {
        await insertSummaryIntoDb(summary);
        return summary;
      }

      const store = readFallbackStore();
      store.summaries.push(summary);
      writeFallbackStore(store);
      return summary;
    },

    async listMemories(input): Promise<ManagerMemoryRecord[]> {
      const limit = input.limit && input.limit > 0 ? input.limit : 10;
      const db = await getDB();
      if (db) {
        const result = await db.query(
          `
            SELECT * FROM ${MANAGER_MEMORIES_TABLE}
            WHERE scopeType = ? AND scopeId = ?
            ORDER BY updatedAt DESC
            LIMIT ?
          `,
          [input.scopeType, input.scopeId, limit],
        );
        return Array.isArray(result.values)
          ? result.values.map((row) => mapMemoryRow(row as Record<string, unknown>))
          : [];
      }

      const store = readFallbackStore();
      return store.memories
        .filter(
          (entry) => entry.scopeType === input.scopeType && entry.scopeId === input.scopeId,
        )
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, limit)
        .map((entry) => ({ ...entry }));
    },

    async upsertMemory(input): Promise<ManagerMemoryRecord> {
      const createdAt = input.createdAt || Date.now();
      const updatedAt = input.updatedAt || createdAt;
      const db = await getDB();
      if (db) {
        const existingResult = await db.query(
          `
            SELECT * FROM ${MANAGER_MEMORIES_TABLE}
            WHERE scopeType = ? AND scopeId = ? AND memoryType = ? AND keyText = ?
            ORDER BY updatedAt DESC
            LIMIT 1
          `,
          [input.scopeType, input.scopeId, input.memoryType, input.keyText],
        );
        const existingRow = Array.isArray(existingResult.values) ? existingResult.values[0] : null;
        const memory: ManagerMemoryRecord = {
          id:
            existingRow && typeof (existingRow as Record<string, unknown>).id === 'string'
              ? String((existingRow as Record<string, unknown>).id)
              : createAutomationId('manager_memory'),
          scopeType: input.scopeType,
          scopeId: input.scopeId,
          memoryType: input.memoryType,
          keyText: input.keyText,
          contentText: input.contentText,
          importance:
            typeof input.importance === 'number' && Number.isFinite(input.importance)
              ? input.importance
              : null,
          source: typeof input.source === 'string' ? input.source : null,
          createdAt:
            existingRow && typeof (existingRow as Record<string, unknown>).createdAt === 'number'
              ? Number((existingRow as Record<string, unknown>).createdAt)
              : createdAt,
          updatedAt,
        };
        await insertMemoryIntoDb(memory);
        return memory;
      }

      const store = readFallbackStore();
      const existingIndex = store.memories.findIndex(
        (entry) =>
          entry.scopeType === input.scopeType &&
          entry.scopeId === input.scopeId &&
          entry.memoryType === input.memoryType &&
          entry.keyText === input.keyText,
      );
      const existing = existingIndex >= 0 ? store.memories[existingIndex] : null;
      const memory: ManagerMemoryRecord = {
        id: existing?.id || createAutomationId('manager_memory'),
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        memoryType: input.memoryType,
        keyText: input.keyText,
        contentText: input.contentText,
        importance:
          typeof input.importance === 'number' && Number.isFinite(input.importance)
            ? input.importance
            : null,
        source: typeof input.source === 'string' ? input.source : null,
        createdAt: existing?.createdAt || createdAt,
        updatedAt,
      };

      if (existingIndex >= 0) {
        store.memories[existingIndex] = memory;
      } else {
        store.memories.push(memory);
      }
      writeFallbackStore(store);
      return memory;
    },

    async appendMessage(input): Promise<ManagerMessageRecord> {
      const createdAt = input.createdAt || Date.now();
      const db = await getDB();
      if (db) {
        const message: ManagerMessageRecord = {
          id: createAutomationId('manager_message'),
          sessionId: input.sessionId,
          runId: input.runId || null,
          ordinal: await getNextOrdinalFromDb(input.sessionId),
          role: input.role,
          blockType: input.blockType,
          text: input.text || null,
          payloadData: input.payloadData || null,
          createdAt,
        };
        await insertMessagesIntoDb([message]);
        await this.updateSession?.(input.sessionId, {
          latestMessageAt: createdAt,
          updatedAt: createdAt,
        });
        return message;
      }

      const store = readFallbackStore();
      const nextOrdinal =
        store.messages
          .filter((entry) => entry.sessionId === input.sessionId)
          .reduce((maxOrdinal, entry) => Math.max(maxOrdinal, entry.ordinal), -1) + 1;
      const message: ManagerMessageRecord = {
        id: createAutomationId('manager_message'),
        sessionId: input.sessionId,
        runId: input.runId || null,
        ordinal: nextOrdinal,
        role: input.role,
        blockType: input.blockType,
        text: input.text || null,
        payloadData: input.payloadData || null,
        createdAt,
      };
      store.messages.push(message);
      const sessionIndex = store.sessions.findIndex((entry) => entry.id === input.sessionId);
      if (sessionIndex >= 0) {
        store.sessions[sessionIndex] = {
          ...store.sessions[sessionIndex],
          latestMessageAt: createdAt,
          updatedAt: createdAt,
        };
      }
      writeFallbackStore(store);
      return message;
    },

    async createRun(input): Promise<ManagerRunRecord> {
      const createdAt = input.createdAt || Date.now();
      const updatedAt = input.updatedAt || createdAt;
      const run: ManagerRunRecord = {
        id: createAutomationId('manager_run'),
        sessionId: input.sessionId,
        inputMessageId: input.inputMessageId || null,
        status: input.status,
        triggerType: input.triggerType,
        plannerMode: input.plannerMode || null,
        intentType:
          typeof input.intentType === 'string' ? input.intentType : null,
        toolPath: typeof input.toolPath === 'string' ? input.toolPath : null,
        errorCode: typeof input.errorCode === 'string' ? input.errorCode : null,
        errorMessage: typeof input.errorMessage === 'string' ? input.errorMessage : null,
        stateData: typeof input.stateData === 'string' ? input.stateData : null,
        startedAt:
          typeof input.startedAt === 'number' && Number.isFinite(input.startedAt)
            ? input.startedAt
            : null,
        finishedAt:
          typeof input.finishedAt === 'number' && Number.isFinite(input.finishedAt)
            ? input.finishedAt
            : null,
        createdAt,
        updatedAt,
      };

      const db = await getDB();
      if (db) {
        await insertRunIntoDb(run);
        return run;
      }

      const store = readFallbackStore();
      store.runs.push(run);
      writeFallbackStore(store);
      return run;
    },

    async updateRun(runId, patch): Promise<ManagerRunRecord | null> {
      const db = await getDB();
      if (db) {
        const result = await db.query(
          `SELECT * FROM ${MANAGER_RUNS_TABLE} WHERE id = ? LIMIT 1`,
          [runId],
        );
        const row = Array.isArray(result.values) ? result.values[0] : null;
        if (!row) {
          return null;
        }
        const current = mapRunRow(row as Record<string, unknown>);
        const updated: ManagerRunRecord = {
          ...current,
          inputMessageId:
            typeof patch.inputMessageId !== 'undefined'
              ? patch.inputMessageId
              : current.inputMessageId,
          status: patch.status ?? current.status,
          plannerMode:
            typeof patch.plannerMode !== 'undefined'
              ? patch.plannerMode
              : current.plannerMode,
          intentType:
            typeof patch.intentType !== 'undefined'
              ? patch.intentType
              : current.intentType,
          toolPath:
            typeof patch.toolPath !== 'undefined' ? patch.toolPath : current.toolPath,
          errorCode:
            typeof patch.errorCode !== 'undefined' ? patch.errorCode : current.errorCode,
          errorMessage:
            typeof patch.errorMessage !== 'undefined'
              ? patch.errorMessage
              : current.errorMessage,
          stateData:
            typeof patch.stateData !== 'undefined' ? patch.stateData : current.stateData,
          startedAt:
            typeof patch.startedAt !== 'undefined' ? patch.startedAt : current.startedAt,
          finishedAt:
            typeof patch.finishedAt !== 'undefined' ? patch.finishedAt : current.finishedAt,
          updatedAt: patch.updatedAt ?? Date.now(),
        };
        await insertRunIntoDb(updated);
        return updated;
      }

      const store = readFallbackStore();
      const index = store.runs.findIndex((entry) => entry.id === runId);
      if (index < 0) {
        return null;
      }
      const current = store.runs[index];
      const updated: ManagerRunRecord = {
        ...current,
        inputMessageId:
          typeof patch.inputMessageId !== 'undefined'
            ? patch.inputMessageId
            : current.inputMessageId,
        status: patch.status ?? current.status,
        plannerMode:
          typeof patch.plannerMode !== 'undefined'
            ? patch.plannerMode
            : current.plannerMode,
        intentType:
          typeof patch.intentType !== 'undefined'
            ? patch.intentType
            : current.intentType,
        toolPath:
          typeof patch.toolPath !== 'undefined' ? patch.toolPath : current.toolPath,
        errorCode:
          typeof patch.errorCode !== 'undefined' ? patch.errorCode : current.errorCode,
        errorMessage:
          typeof patch.errorMessage !== 'undefined'
            ? patch.errorMessage
            : current.errorMessage,
        stateData:
          typeof patch.stateData !== 'undefined' ? patch.stateData : current.stateData,
        startedAt:
          typeof patch.startedAt !== 'undefined' ? patch.startedAt : current.startedAt,
        finishedAt:
          typeof patch.finishedAt !== 'undefined' ? patch.finishedAt : current.finishedAt,
        updatedAt: patch.updatedAt ?? Date.now(),
      };
      store.runs[index] = updated;
      writeFallbackStore(store);
      return updated;
    },

    async updateSession(sessionId, patch): Promise<ManagerSessionRecord | null> {
      const current = await this.getSessionById(sessionId);
      if (!current) {
        return null;
      }

      const updated: ManagerSessionRecord = {
        ...current,
        title: patch.title ?? current.title,
        runtimeDomainVersion:
          typeof patch.runtimeDomainVersion !== 'undefined'
            ? patch.runtimeDomainVersion
            : current.runtimeDomainVersion,
        activeWorkflowType:
          typeof patch.activeWorkflowType !== 'undefined'
            ? patch.activeWorkflowType
            : current.activeWorkflowType,
        activeWorkflowStateData:
          typeof patch.activeWorkflowStateData !== 'undefined'
            ? patch.activeWorkflowStateData
            : current.activeWorkflowStateData,
        latestSummaryId:
          typeof patch.latestSummaryId !== 'undefined'
            ? patch.latestSummaryId
            : current.latestSummaryId,
        latestMessageAt: patch.latestMessageAt ?? current.latestMessageAt,
        updatedAt: patch.updatedAt ?? Date.now(),
      };

      const db = await getDB();
      if (db) {
        await insertSessionIntoDb(updated);
        return updated;
      }

      const store = readFallbackStore();
      const sessionIndex = store.sessions.findIndex((entry) => entry.id === sessionId);
      if (sessionIndex < 0) {
        return null;
      }
      store.sessions[sessionIndex] = updated;
      writeFallbackStore(store);
      return updated;
    },

    async getActiveRun(sessionId: string): Promise<ManagerRunRecord | null> {
      const db = await getDB();
      if (db) {
        const result = await db.query(
          `
            SELECT * FROM ${MANAGER_RUNS_TABLE}
            WHERE sessionId = ? AND status IN (?, ?)
            ORDER BY CASE WHEN status = 'running' THEN 0 ELSE 1 END, updatedAt DESC
            LIMIT 1
          `,
          [sessionId, 'queued', 'running'],
        );
        const row = Array.isArray(result.values) ? result.values[0] : null;
        return row ? mapRunRow(row as Record<string, unknown>) : null;
      }

      const store = readFallbackStore();
      const activeRuns = store.runs
        .filter(
          (entry) =>
            entry.sessionId === sessionId &&
            (entry.status === 'queued' || entry.status === 'running'),
        )
        .sort((left, right) => {
          if (left.status === right.status) {
            return right.updatedAt - left.updatedAt;
          }
          return left.status === 'running' ? -1 : 1;
      });
      return activeRuns[0] || null;
    },

    async getLatestRun(sessionId: string): Promise<ManagerRunRecord | null> {
      const db = await getDB();
      if (db) {
        const result = await db.query(
          `
            SELECT * FROM ${MANAGER_RUNS_TABLE}
            WHERE sessionId = ?
            ORDER BY updatedAt DESC, createdAt DESC
            LIMIT 1
          `,
          [sessionId],
        );
        const row = Array.isArray(result.values) ? result.values[0] : null;
        return row ? mapRunRow(row as Record<string, unknown>) : null;
      }

      const store = readFallbackStore();
      const latestRuns = store.runs
        .filter((entry) => entry.sessionId === sessionId)
        .sort((left, right) => {
          if (left.updatedAt === right.updatedAt) {
            return right.createdAt - left.createdAt;
          }
          return right.updatedAt - left.updatedAt;
        });
      return latestRuns[0] || null;
    },
  };
}

export function clearManagerSessionStoreFallback() {
  memoryStoreCache = null;
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.removeItem(MANAGER_GATEWAY_STORE_KEY);
}
