import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

const DB_NAME = 'matchflow_db';
export const HISTORY_TABLE = 'history';
export const SAVED_MATCHES_TABLE = 'saved_matches';
export const RESUME_STATE_TABLE = 'resume_state';

let db: SQLiteDBConnection | null = null;
let sqlite: SQLiteConnection | null = null;

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

    // Create tables
    const query = `
      CREATE TABLE IF NOT EXISTS ${HISTORY_TABLE} (
        id TEXT PRIMARY KEY,
        matchId TEXT NOT NULL,
        matchData TEXT NOT NULL,
        analysisData TEXT NOT NULL,
        parsedStreamData TEXT,
        generatedCodesData TEXT,
        timestamp INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${SAVED_MATCHES_TABLE} (
        id TEXT PRIMARY KEY,
        matchData TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${RESUME_STATE_TABLE} (
        matchId TEXT PRIMARY KEY,
        stateData TEXT NOT NULL,
        thoughts TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `;
    await db.execute(query);

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
