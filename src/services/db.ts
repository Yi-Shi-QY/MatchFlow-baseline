import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

const DB_NAME = 'matchflow_db';
export const HISTORY_TABLE = 'history';
export const SAVED_MATCHES_TABLE = 'saved_matches';
export const RESUME_STATE_TABLE = 'resume_state';

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
  // History v3: domain-aware subject identity + snapshot payload.
  await ensureTableColumn(targetDb, HISTORY_TABLE, 'domainId', 'domainId TEXT');
  await ensureTableColumn(targetDb, HISTORY_TABLE, 'subjectId', 'subjectId TEXT');
  await ensureTableColumn(targetDb, HISTORY_TABLE, 'subjectType', 'subjectType TEXT');
  await ensureTableColumn(
    targetDb,
    HISTORY_TABLE,
    'subjectSnapshotData',
    'subjectSnapshotData TEXT',
  );

  // Saved subjects v3.
  await ensureTableColumn(targetDb, SAVED_MATCHES_TABLE, 'domainId', 'domainId TEXT');
  await ensureTableColumn(targetDb, SAVED_MATCHES_TABLE, 'subjectId', 'subjectId TEXT');
  await ensureTableColumn(targetDb, SAVED_MATCHES_TABLE, 'subjectType', 'subjectType TEXT');
  await ensureTableColumn(targetDb, SAVED_MATCHES_TABLE, 'snapshotData', 'snapshotData TEXT');

  // Resume v3.
  await ensureTableColumn(targetDb, RESUME_STATE_TABLE, 'domainId', 'domainId TEXT');
  await ensureTableColumn(targetDb, RESUME_STATE_TABLE, 'subjectId', 'subjectId TEXT');
  await ensureTableColumn(targetDb, RESUME_STATE_TABLE, 'subjectType', 'subjectType TEXT');
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
        matchId TEXT NOT NULL,
        domainId TEXT,
        subjectId TEXT,
        subjectType TEXT,
        subjectSnapshotData TEXT,
        matchData TEXT NOT NULL,
        analysisData TEXT NOT NULL,
        parsedStreamData TEXT,
        generatedCodesData TEXT,
        timestamp INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${SAVED_MATCHES_TABLE} (
        id TEXT PRIMARY KEY,
        domainId TEXT,
        subjectId TEXT,
        subjectType TEXT,
        snapshotData TEXT,
        matchData TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${RESUME_STATE_TABLE} (
        matchId TEXT PRIMARY KEY,
        domainId TEXT,
        subjectId TEXT,
        subjectType TEXT,
        stateData TEXT NOT NULL,
        thoughts TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_history_match_id ON ${HISTORY_TABLE}(matchId);
      CREATE INDEX IF NOT EXISTS idx_history_timestamp ON ${HISTORY_TABLE}(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_history_domain_subject ON ${HISTORY_TABLE}(domainId, subjectId);
      CREATE INDEX IF NOT EXISTS idx_saved_matches_timestamp ON ${SAVED_MATCHES_TABLE}(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_saved_matches_domain_subject ON ${SAVED_MATCHES_TABLE}(domainId, subjectId);
      CREATE INDEX IF NOT EXISTS idx_resume_state_timestamp ON ${RESUME_STATE_TABLE}(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_resume_state_domain_subject ON ${RESUME_STATE_TABLE}(domainId, subjectId);
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
