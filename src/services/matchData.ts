import { Match } from '@/src/data/matches';
import { getSettings } from './settings';

export interface MatchDataResponse {
  data: Match[];
}

export async function fetchMatches(): Promise<Match[]> {
  const settings = getSettings();
  
  if (!settings.matchDataServerUrl) {
    console.log('No match data server configured, using mock data.');
    return []; // Return empty to signal fallback to mock data in UI
  }

  try {
    const url = new URL('/matches', settings.matchDataServerUrl).toString();
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${settings.matchDataApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    if (json && Array.isArray(json.data)) {
      return json.data;
    } else {
      console.warn('Invalid match data format from server', json);
      return [];
    }
  } catch (error) {
    console.error('Failed to fetch matches from server:', error);
    return [];
  }
}
