import { Match } from '@/src/data/matches';
import { getSettings } from './settings';

export interface MatchDataResponse {
  data: Match[];
}

function createAbortError(): Error & { name: string } {
  const error = new Error('Match data request aborted') as Error & { name: string };
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return;
  }

  throw createAbortError();
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'AbortError'
  );
}

export async function fetchMatches(input: {
  signal?: AbortSignal;
} = {}): Promise<Match[]> {
  const settings = getSettings();
  throwIfAborted(input.signal);
  
  if (!settings.matchDataServerUrl) {
    console.log('No match data server configured, using mock data.');
    return []; // Return empty to signal fallback to mock data in UI
  }

  try {
    throwIfAborted(input.signal);
    const url = new URL('/matches', settings.matchDataServerUrl).toString();
    const response = await fetch(url, {
      method: 'GET',
      signal: input.signal,
      headers: {
        'Authorization': `Bearer ${settings.matchDataApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    throwIfAborted(input.signal);
    if (json && Array.isArray(json.data)) {
      return json.data;
    } else {
      console.warn('Invalid match data format from server', json);
      return [];
    }
  } catch (error) {
    if (input.signal?.aborted || isAbortError(error)) {
      throw error;
    }
    console.error('Failed to fetch matches from server:', error);
    return [];
  }
}
