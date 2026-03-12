import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

const DB_NAME = 'matchflow_db';
export const HISTORY_TABLE = 'subject_history';
export const SAVED_SUBJECTS_TABLE = 'saved_subjects';
export const RESUME_STATE_TABLE = 'analysis_resume_state';
export const AUTOMATION_DRAFTS_TABLE = 'automation_drafts';
export const AUTOMATION_RULES_TABLE = 'automation_rules';
export const AUTOMATION_JOBS_TABLE = 'automation_jobs';
export const AUTOMATION_RUNS_TABLE = 'automation_runs';
export const SYNCED_MATCHES_TABLE = 'synced_matches';
export const MANAGER_SESSIONS_TABLE = 'manager_sessions';
export const MANAGER_MESSAGES_TABLE = 'manager_messages';
export const MANAGER_RUNS_TABLE = 'manager_runs';
export const MANAGER_SUMMARIES_TABLE = 'manager_summaries';
export const MANAGER_MEMORIES_TABLE = 'manager_memories';

let db: SQLiteDBConnection | null = null;
let sqlite: SQLiteConnection | null = null;

async function ensureTableColumn(
  targetDb: SQLiteDBConnection,
  table: string,
  columnName: string,
  columnDefinition: string,
) {
  const tableInfo = await targetDb.query(`PRAGMA table_info(${table})`);
  const hasColumn = Array.isArray(tableInfo.values)
    ? tableInfo.values.some((row) => row?.name === columnName)
    : false;

  if (hasColumn) return;
  await targetDb.execute(`ALTER TABLE ${table} ADD COLUMN ${columnDefinition};`);
}

async function runSchemaMigrations(targetDb: SQLiteDBConnection) {
  // Subject history storage.
  await ensureTableColumn(targetDb, HISTORY_TABLE, 'domainId', 'domainId TEXT');
  await ensureTableColumn(targetDb, HISTORY_TABLE, 'subjectId', 'subjectId TEXT');
  await ensureTableColumn(targetDb, HISTORY_TABLE, 'subjectType', 'subjectType TEXT');
  await ensureTableColumn(
    targetDb,
    HISTORY_TABLE,
    'subjectSnapshotData',
    'subjectSnapshotData TEXT',
  );
  await ensureTableColumn(
    targetDb,
    HISTORY_TABLE,
    'subjectDisplayData',
    'subjectDisplayData TEXT',
  );

  // Saved subjects storage.
  await ensureTableColumn(targetDb, SAVED_SUBJECTS_TABLE, 'domainId', 'domainId TEXT');
  await ensureTableColumn(targetDb, SAVED_SUBJECTS_TABLE, 'subjectId', 'subjectId TEXT');
  await ensureTableColumn(targetDb, SAVED_SUBJECTS_TABLE, 'subjectType', 'subjectType TEXT');
  await ensureTableColumn(
    targetDb,
    SAVED_SUBJECTS_TABLE,
    'subjectSnapshotData',
    'subjectSnapshotData TEXT',
  );
  await ensureTableColumn(
    targetDb,
    SAVED_SUBJECTS_TABLE,
    'subjectDisplayData',
    'subjectDisplayData TEXT',
  );

  // Resume storage.
  await ensureTableColumn(targetDb, RESUME_STATE_TABLE, 'domainId', 'domainId TEXT');
  await ensureTableColumn(targetDb, RESUME_STATE_TABLE, 'subjectId', 'subjectId TEXT');
  await ensureTableColumn(targetDb, RESUME_STATE_TABLE, 'subjectType', 'subjectType TEXT');

  // Automation v1.
  await ensureTableColumn(targetDb, AUTOMATION_DRAFTS_TABLE, 'status', 'status TEXT');
  await ensureTableColumn(targetDb, AUTOMATION_DRAFTS_TABLE, 'domainId', 'domainId TEXT');
  await ensureTableColumn(targetDb, AUTOMATION_DRAFTS_TABLE, 'payloadData', 'payloadData TEXT');
  await ensureTableColumn(targetDb, AUTOMATION_DRAFTS_TABLE, 'updatedAt', 'updatedAt INTEGER');

  await ensureTableColumn(targetDb, AUTOMATION_RULES_TABLE, 'enabled', 'enabled INTEGER');
  await ensureTableColumn(targetDb, AUTOMATION_RULES_TABLE, 'domainId', 'domainId TEXT');
  await ensureTableColumn(targetDb, AUTOMATION_RULES_TABLE, 'nextPlannedAt', 'nextPlannedAt TEXT');
  await ensureTableColumn(targetDb, AUTOMATION_RULES_TABLE, 'payloadData', 'payloadData TEXT');
  await ensureTableColumn(targetDb, AUTOMATION_RULES_TABLE, 'updatedAt', 'updatedAt INTEGER');

  await ensureTableColumn(targetDb, AUTOMATION_JOBS_TABLE, 'state', 'state TEXT');
  await ensureTableColumn(targetDb, AUTOMATION_JOBS_TABLE, 'domainId', 'domainId TEXT');
  await ensureTableColumn(targetDb, AUTOMATION_JOBS_TABLE, 'scheduledFor', 'scheduledFor TEXT');
  await ensureTableColumn(targetDb, AUTOMATION_JOBS_TABLE, 'retryAfter', 'retryAfter TEXT');
  await ensureTableColumn(targetDb, AUTOMATION_JOBS_TABLE, 'payloadData', 'payloadData TEXT');
  await ensureTableColumn(targetDb, AUTOMATION_JOBS_TABLE, 'updatedAt', 'updatedAt INTEGER');

  await ensureTableColumn(targetDb, AUTOMATION_RUNS_TABLE, 'jobId', 'jobId TEXT');
  await ensureTableColumn(targetDb, AUTOMATION_RUNS_TABLE, 'state', 'state TEXT');
  await ensureTableColumn(targetDb, AUTOMATION_RUNS_TABLE, 'startedAt', 'startedAt INTEGER');
  await ensureTableColumn(targetDb, AUTOMATION_RUNS_TABLE, 'payloadData', 'payloadData TEXT');
  await ensureTableColumn(targetDb, AUTOMATION_RUNS_TABLE, 'updatedAt', 'updatedAt INTEGER');

  // Local synced matches cache v1.
  await ensureTableColumn(targetDb, SYNCED_MATCHES_TABLE, 'domainId', 'domainId TEXT');
  await ensureTableColumn(targetDb, SYNCED_MATCHES_TABLE, 'league', 'league TEXT');
  await ensureTableColumn(targetDb, SYNCED_MATCHES_TABLE, 'status', 'status TEXT');
  await ensureTableColumn(targetDb, SYNCED_MATCHES_TABLE, 'matchDate', 'matchDate TEXT');
  await ensureTableColumn(targetDb, SYNCED_MATCHES_TABLE, 'kickoffAt', 'kickoffAt TEXT');
  await ensureTableColumn(targetDb, SYNCED_MATCHES_TABLE, 'homeName', 'homeName TEXT');
  await ensureTableColumn(targetDb, SYNCED_MATCHES_TABLE, 'awayName', 'awayName TEXT');
  await ensureTableColumn(targetDb, SYNCED_MATCHES_TABLE, 'payloadData', 'payloadData TEXT');
  await ensureTableColumn(targetDb, SYNCED_MATCHES_TABLE, 'updatedAt', 'updatedAt INTEGER');
}

export async function initDB() {
  if (db) return db;

  try {
    sqlite = new SQLiteConnection(CapacitorSQLite);
    
    if (Capacitor.getPlatform() === 'web') {
      // Web platform support requires jeep-sqlite
      // For now, we'll just return null and fallback to localStorage in history.ts
      console.warn('SQLite is not supported on web platform directly without jeep-sqlite. Falling back to localStorage.');
      return null;
    }
    
    // Check if connection exists
    const ret = await sqlite.checkConnectionsConsistency();
    const isConn = (await sqlite.isConnection(DB_NAME, false)).result;

    if (ret.result && isConn) {
      db = await sqlite.retrieveConnection(DB_NAME, false);
    } else {
      db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
    }

    await db.open();

    // Create tables and supporting indexes for frequently queried paths.
    const query = `
      CREATE TABLE IF NOT EXISTS ${HISTORY_TABLE} (
        id TEXT PRIMARY KEY,
        domainId TEXT NOT NULL,
        subjectId TEXT NOT NULL,
        subjectType TEXT NOT NULL,
        subjectSnapshotData TEXT,
        subjectDisplayData TEXT NOT NULL,
        analysisData TEXT NOT NULL,
        parsedStreamData TEXT,
        generatedCodesData TEXT,
        timestamp INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${SAVED_SUBJECTS_TABLE} (
        id TEXT PRIMARY KEY,
        domainId TEXT NOT NULL,
        subjectId TEXT NOT NULL,
        subjectType TEXT NOT NULL,
        subjectSnapshotData TEXT,
        subjectDisplayData TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${RESUME_STATE_TABLE} (
        id TEXT PRIMARY KEY,
        domainId TEXT NOT NULL,
        subjectId TEXT NOT NULL,
        subjectType TEXT NOT NULL,
        stateData TEXT NOT NULL,
        thoughts TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${AUTOMATION_DRAFTS_TABLE} (
        id TEXT PRIMARY KEY,
        status TEXT,
        domainId TEXT,
        payloadData TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${AUTOMATION_RULES_TABLE} (
        id TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL,
        domainId TEXT,
        nextPlannedAt TEXT,
        payloadData TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${AUTOMATION_JOBS_TABLE} (
        id TEXT PRIMARY KEY,
        state TEXT,
        domainId TEXT,
        scheduledFor TEXT,
        retryAfter TEXT,
        payloadData TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${AUTOMATION_RUNS_TABLE} (
        id TEXT PRIMARY KEY,
        jobId TEXT NOT NULL,
        state TEXT,
        startedAt INTEGER NOT NULL,
        payloadData TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${SYNCED_MATCHES_TABLE} (
        id TEXT PRIMARY KEY,
        domainId TEXT NOT NULL,
        league TEXT,
        status TEXT,
        matchDate TEXT,
        kickoffAt TEXT,
        homeName TEXT,
        awayName TEXT,
        payloadData TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${MANAGER_SESSIONS_TABLE} (
        id TEXT PRIMARY KEY,
        sessionKey TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        domainId TEXT NOT NULL,
        runtimeDomainVersion TEXT,
        activeWorkflowType TEXT,
        activeWorkflowStateData TEXT,
        latestSummaryId TEXT,
        latestMessageAt INTEGER NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${MANAGER_MESSAGES_TABLE} (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        runId TEXT,
        ordinal INTEGER NOT NULL,
        role TEXT NOT NULL,
        blockType TEXT NOT NULL,
        text TEXT,
        payloadData TEXT,
        createdAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${MANAGER_RUNS_TABLE} (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        inputMessageId TEXT,
        status TEXT NOT NULL,
        triggerType TEXT NOT NULL,
        plannerMode TEXT,
        intentType TEXT,
        toolPath TEXT,
        errorCode TEXT,
        errorMessage TEXT,
        stateData TEXT,
        startedAt INTEGER,
        finishedAt INTEGER,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${MANAGER_SUMMARIES_TABLE} (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        kind TEXT NOT NULL,
        cutoffOrdinal INTEGER NOT NULL,
        summaryText TEXT NOT NULL,
        sourceMessageCount INTEGER NOT NULL,
        createdAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${MANAGER_MEMORIES_TABLE} (
        id TEXT PRIMARY KEY,
        scopeType TEXT NOT NULL,
        scopeId TEXT NOT NULL,
        memoryType TEXT NOT NULL,
        keyText TEXT NOT NULL,
        contentText TEXT NOT NULL,
        importance REAL,
        source TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_subject_history_timestamp ON ${HISTORY_TABLE}(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_subject_history_domain_subject ON ${HISTORY_TABLE}(domainId, subjectId);
      CREATE INDEX IF NOT EXISTS idx_saved_subjects_timestamp ON ${SAVED_SUBJECTS_TABLE}(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_saved_subjects_domain_subject ON ${SAVED_SUBJECTS_TABLE}(domainId, subjectId);
      CREATE INDEX IF NOT EXISTS idx_analysis_resume_state_timestamp ON ${RESUME_STATE_TABLE}(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_analysis_resume_state_domain_subject ON ${RESUME_STATE_TABLE}(domainId, subjectId);
      CREATE INDEX IF NOT EXISTS idx_automation_drafts_status_updated ON ${AUTOMATION_DRAFTS_TABLE}(status, updatedAt DESC);
      CREATE INDEX IF NOT EXISTS idx_automation_rules_enabled_next ON ${AUTOMATION_RULES_TABLE}(enabled, nextPlannedAt);
      CREATE INDEX IF NOT EXISTS idx_automation_jobs_state_schedule ON ${AUTOMATION_JOBS_TABLE}(state, scheduledFor);
      CREATE INDEX IF NOT EXISTS idx_automation_jobs_retry_after ON ${AUTOMATION_JOBS_TABLE}(retryAfter);
      CREATE INDEX IF NOT EXISTS idx_automation_runs_job_started ON ${AUTOMATION_RUNS_TABLE}(jobId, startedAt DESC);
      CREATE INDEX IF NOT EXISTS idx_synced_matches_domain_date ON ${SYNCED_MATCHES_TABLE}(domainId, matchDate, kickoffAt);
      CREATE INDEX IF NOT EXISTS idx_synced_matches_status ON ${SYNCED_MATCHES_TABLE}(status);
      CREATE INDEX IF NOT EXISTS idx_manager_sessions_status_updated ON ${MANAGER_SESSIONS_TABLE}(status, updatedAt DESC);
      CREATE INDEX IF NOT EXISTS idx_manager_sessions_domain_updated ON ${MANAGER_SESSIONS_TABLE}(domainId, updatedAt DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_manager_messages_session_ordinal ON ${MANAGER_MESSAGES_TABLE}(sessionId, ordinal);
      CREATE INDEX IF NOT EXISTS idx_manager_messages_session_created ON ${MANAGER_MESSAGES_TABLE}(sessionId, createdAt DESC);
      CREATE INDEX IF NOT EXISTS idx_manager_runs_session_created ON ${MANAGER_RUNS_TABLE}(sessionId, createdAt DESC);
      CREATE INDEX IF NOT EXISTS idx_manager_runs_status_updated ON ${MANAGER_RUNS_TABLE}(status, updatedAt DESC);
      CREATE INDEX IF NOT EXISTS idx_manager_summaries_session_created ON ${MANAGER_SUMMARIES_TABLE}(sessionId, createdAt DESC);
      CREATE INDEX IF NOT EXISTS idx_manager_memories_scope_updated ON ${MANAGER_MEMORIES_TABLE}(scopeType, scopeId, updatedAt DESC);
      CREATE INDEX IF NOT EXISTS idx_manager_memories_key ON ${MANAGER_MEMORIES_TABLE}(scopeType, scopeId, keyText);
    `;
    await db.execute(query);
    await runSchemaMigrations(db);

    return db;
  } catch (err) {
    console.error('Error initializing DB', err);
    return null;
  }
}

export async function getDB() {
  if (!db) {
    return await initDB();
  }
  return db;
}

export async function closeDB() {
  if (db) {
    await db.close();
    if (sqlite) {
      await sqlite.closeConnection(DB_NAME, false);
    }
    db = null;
  }
}
