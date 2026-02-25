import { MatchAnalysis, AnalysisResumeState } from './ai';
import { Match } from '../data/matches';
import { AgentResult } from './agentParser';
import { getDB, HISTORY_TABLE, RESUME_STATE_TABLE } from './db';
import { Capacitor } from '@capacitor/core';

export interface HistoryRecord {
  id: string; // unique id for the record
  matchId: string;
  match: Match;
  analysis: MatchAnalysis;
  parsedStream?: AgentResult;
  generatedCodes?: Record<string, string>;
  timestamp: number;
}

const HISTORY_KEY = 'matchflow_history';
const RESUME_STATE_KEY = 'matchflow_resume_state';

export interface SavedResumeState {
  matchId: string;
  state: AnalysisResumeState;
  thoughts: string;
  timestamp: number;
}

export async function getResumeState(matchId: string): Promise<SavedResumeState | null> {
  try {
    // Try SQLite first if native
    if (Capacitor.isNativePlatform()) {
      const db = await getDB();
      if (db) {
        const res = await db.query(`SELECT * FROM ${RESUME_STATE_TABLE} WHERE matchId = ?`, [matchId]);
        if (res.values && res.values.length > 0) {
          const row = res.values[0];
          // Check timestamp (24 hours)
          if (Date.now() - row.timestamp < 24 * 60 * 60 * 1000) {
            return {
              matchId: row.matchId,
              state: JSON.parse(row.stateData),
              thoughts: row.thoughts,
              timestamp: row.timestamp
            };
          } else {
            // Expired, delete it
            await db.run(`DELETE FROM ${RESUME_STATE_TABLE} WHERE matchId = ?`, [matchId]);
          }
        }
      }
    }

    // Fallback to localStorage
    const data = localStorage.getItem(RESUME_STATE_KEY);
    if (data) {
      const parsed = JSON.parse(data) as SavedResumeState;
      // Only return if it matches the current match and is less than 24 hours old
      if (parsed.matchId === matchId && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load resume state', e);
  }
  return null;
}

export async function saveResumeState(matchId: string, state: AnalysisResumeState, thoughts: string) {
  try {
    const timestamp = Date.now();
    const record: SavedResumeState = {
      matchId,
      state,
      thoughts,
      timestamp
    };

    // Save to SQLite if native
    if (Capacitor.isNativePlatform()) {
      const db = await getDB();
      if (db) {
        await db.run(`
          INSERT OR REPLACE INTO ${RESUME_STATE_TABLE} (matchId, stateData, thoughts, timestamp)
          VALUES (?, ?, ?, ?)
        `, [matchId, JSON.stringify(state), thoughts, timestamp]);
      }
    }

    // Always save to localStorage as backup
    localStorage.setItem(RESUME_STATE_KEY, JSON.stringify(record));
  } catch (e) {
    console.error('Failed to save resume state', e);
  }
}

export async function clearResumeState() {
  localStorage.removeItem(RESUME_STATE_KEY);
  if (Capacitor.isNativePlatform()) {
    const db = await getDB();
    if (db) {
      await db.run(`DELETE FROM ${RESUME_STATE_TABLE}`);
    }
  }
}

export async function getHistory(): Promise<HistoryRecord[]> {
  try {
    // Try SQLite first if native
    if (Capacitor.isNativePlatform()) {
      const db = await getDB();
      if (db) {
        const res = await db.query(`SELECT * FROM ${HISTORY_TABLE} ORDER BY timestamp DESC`);
        if (res.values) {
          return res.values.map(row => ({
            id: row.id,
            matchId: row.matchId,
            match: JSON.parse(row.matchData),
            analysis: JSON.parse(row.analysisData),
            parsedStream: row.parsedStreamData ? JSON.parse(row.parsedStreamData) : undefined,
            generatedCodes: row.generatedCodesData ? JSON.parse(row.generatedCodesData) : undefined,
            timestamp: row.timestamp
          }));
        }
      }
    }
    
    // Fallback to localStorage
    const data = localStorage.getItem(HISTORY_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load history', e);
  }
  return [];
}

export async function saveHistory(
  match: Match, 
  analysis: MatchAnalysis, 
  parsedStream?: AgentResult, 
  generatedCodes?: Record<string, string>
) {
  try {
    const record: HistoryRecord = {
      id: Date.now().toString(),
      matchId: match.id,
      match,
      analysis,
      parsedStream,
      generatedCodes,
      timestamp: Date.now(),
    };

    // 1. Save to SQLite if native
    if (Capacitor.isNativePlatform()) {
      const db = await getDB();
      if (db) {
        // Check if exists to update or insert
        // For simplicity, we can just delete old one for this matchId if we want "one record per match", 
        // but the current logic in localStorage was "add to beginning".
        // Let's stick to the logic: check if exists, update it, or insert new.
        
        // Actually, let's mirror the localStorage logic:
        // "Check if we already have this match analyzed... existingIndex >= 0"
        
        // Check if record for this matchId exists
        const existing = await db.query(`SELECT id FROM ${HISTORY_TABLE} WHERE matchId = ?`, [match.id]);
        
        const matchDataStr = JSON.stringify(match);
        const analysisDataStr = JSON.stringify(analysis);
        const parsedStreamStr = parsedStream ? JSON.stringify(parsedStream) : null;
        const generatedCodesStr = generatedCodes ? JSON.stringify(generatedCodes) : null;

        if (existing.values && existing.values.length > 0) {
          // Update
          await db.run(`
            UPDATE ${HISTORY_TABLE} 
            SET matchData = ?, analysisData = ?, parsedStreamData = ?, generatedCodesData = ?, timestamp = ?
            WHERE matchId = ?
          `, [matchDataStr, analysisDataStr, parsedStreamStr, generatedCodesStr, Date.now(), match.id]);
        } else {
          // Insert
          await db.run(`
            INSERT INTO ${HISTORY_TABLE} (id, matchId, matchData, analysisData, parsedStreamData, generatedCodesData, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [record.id, match.id, matchDataStr, analysisDataStr, parsedStreamStr, generatedCodesStr, record.timestamp]);
        }
      }
    }

    // 2. Always save to localStorage as backup/sync for now, or for Web platform
    const history = await getHistoryFallback(); // Use a helper to get from localStorage synchronously-ish
    const existingIndex = history.findIndex(h => h.matchId === match.id);
    
    if (existingIndex >= 0) {
      history[existingIndex] = record;
    } else {
      history.unshift(record);
    }
    const trimmedHistory = history.slice(0, 20);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmedHistory));

  } catch (e) {
    console.error('Failed to save history', e);
  }
}

// Helper for localStorage only
function getHistoryFallback(): HistoryRecord[] {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {}
  return [];
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  if (Capacitor.isNativePlatform()) {
    getDB().then(db => {
      if (db) db.run(`DELETE FROM ${HISTORY_TABLE}`);
    });
  }
}

export function deleteHistoryRecord(id: string) {
  try {
    // LocalStorage
    const history = getHistoryFallback();
    const updatedHistory = history.filter(record => record.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));

    // SQLite
    if (Capacitor.isNativePlatform()) {
      getDB().then(db => {
        if (db) db.run(`DELETE FROM ${HISTORY_TABLE} WHERE id = ?`, [id]);
      });
    }
  } catch (e) {
    console.error('Failed to delete history record', e);
  }
}
