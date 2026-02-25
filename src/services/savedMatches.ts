import { getDB, SAVED_MATCHES_TABLE } from './db';
import { Match } from '@/src/data/matches';

const LOCAL_STORAGE_KEY = 'matchflow_saved_matches';

export interface SavedMatchRecord {
  id: string;
  match: Match;
  timestamp: number;
}

export async function getSavedMatches(): Promise<SavedMatchRecord[]> {
  const db = await getDB();
  
  if (db) {
    try {
      const result = await db.query(`SELECT * FROM ${SAVED_MATCHES_TABLE} ORDER BY timestamp DESC`);
      if (result.values) {
        return result.values.map(row => ({
          id: row.id,
          match: JSON.parse(row.matchData),
          timestamp: row.timestamp
        }));
      }
    } catch (e) {
      console.error('Failed to fetch saved matches from DB', e);
    }
  }

  // Fallback to localStorage
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to fetch saved matches from localStorage', e);
  }
  
  return [];
}

export async function saveMatch(match: Match): Promise<void> {
  const db = await getDB();
  const timestamp = Date.now();
  const record: SavedMatchRecord = {
    id: match.id,
    match,
    timestamp
  };

  if (db) {
    try {
      await db.run(
        `INSERT OR REPLACE INTO ${SAVED_MATCHES_TABLE} (id, matchData, timestamp) VALUES (?, ?, ?)`,
        [match.id, JSON.stringify(match), timestamp]
      );
    } catch (e) {
      console.error('Failed to save match to DB', e);
    }
  }

  // Always save to localStorage as backup/sync
  try {
    const current = await getSavedMatches();
    // Remove existing if any (to update timestamp)
    const filtered = current.filter(r => r.id !== match.id);
    const updated = [record, ...filtered];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save match to localStorage', e);
  }
}

export async function deleteSavedMatch(id: string): Promise<void> {
  const db = await getDB();
  
  if (db) {
    try {
      await db.run(`DELETE FROM ${SAVED_MATCHES_TABLE} WHERE id = ?`, [id]);
    } catch (e) {
      console.error('Failed to delete saved match from DB', e);
    }
  }

  // Update localStorage
  try {
    const current = await getSavedMatches();
    const updated = current.filter(r => r.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to delete saved match from localStorage', e);
  }
}
