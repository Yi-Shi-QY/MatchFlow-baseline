import { MatchAnalysis } from './ai';
import { Match } from '../data/matches';
import { AgentResult } from './agentParser';

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

export function getHistory(): HistoryRecord[] {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load history', e);
  }
  return [];
}

export function saveHistory(
  match: Match, 
  analysis: MatchAnalysis, 
  parsedStream?: AgentResult, 
  generatedCodes?: Record<string, string>
) {
  try {
    const history = getHistory();
    // Check if we already have this match analyzed recently (e.g., within 1 hour)
    // Or just overwrite the previous analysis for the same match
    const existingIndex = history.findIndex(h => h.matchId === match.id);
    
    const record: HistoryRecord = {
      id: Date.now().toString(),
      matchId: match.id,
      match,
      analysis,
      parsedStream,
      generatedCodes,
      timestamp: Date.now(),
    };

    if (existingIndex >= 0) {
      history[existingIndex] = record;
    } else {
      history.unshift(record); // Add to beginning
    }

    // Keep only last 20 records
    const trimmedHistory = history.slice(0, 20);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmedHistory));
  } catch (e) {
    console.error('Failed to save history', e);
  }
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

export function deleteHistoryRecord(id: string) {
  try {
    const history = getHistory();
    const updatedHistory = history.filter(record => record.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
  } catch (e) {
    console.error('Failed to delete history record', e);
  }
}
