import { getSettings } from './settings';

interface SourceContextPayload {
  domainId?: string;
  selectedSources?: Record<string, boolean>;
  selectedSourceIds?: string[];
  capabilities?: Record<string, any>;
  matchStatus?: string;
  planning?: Record<string, any>;
}

interface AnalysisConfigPayload {
  matchId?: string;
  sourceContext?: SourceContextPayload;
}

function getRequestHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

function buildServerUrl(path: string): string | null {
  const settings = getSettings();
  const baseUrl = String(settings.matchDataServerUrl || '').trim();
  if (!baseUrl) return null;
  return new URL(path, baseUrl).toString();
}

function normalizeAnalysisConfigResponse(payload: any): AnalysisConfigPayload | null {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  if (!data || typeof data !== 'object') return null;
  if (!data.sourceContext || typeof data.sourceContext !== 'object') return null;
  return data as AnalysisConfigPayload;
}

async function fetchJson(url: string, options: RequestInit): Promise<any | null> {
  const response = await fetch(url, options);
  if (!response.ok) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function fetchMatchAnalysisConfig(matchId: string): Promise<AnalysisConfigPayload | null> {
  const settings = getSettings();
  if (!String(settings.matchDataServerUrl || '').trim() || !matchId) {
    return null;
  }

  const encodedId = encodeURIComponent(matchId);
  const url = buildServerUrl(`/analysis/config/match/${encodedId}`);
  if (!url) return null;

  const payload = await fetchJson(url, {
    method: 'GET',
    headers: getRequestHeaders(String(settings.matchDataApiKey || '').trim()),
  });

  return normalizeAnalysisConfigResponse(payload);
}

export async function resolveAnalysisConfig(matchData: any): Promise<AnalysisConfigPayload | null> {
  const settings = getSettings();
  if (!String(settings.matchDataServerUrl || '').trim()) {
    return null;
  }

  const url = buildServerUrl('/analysis/config/resolve');
  if (!url) return null;

  const payload = await fetchJson(url, {
    method: 'POST',
    headers: getRequestHeaders(String(settings.matchDataApiKey || '').trim()),
    body: JSON.stringify({ match: matchData }),
  });

  return normalizeAnalysisConfigResponse(payload);
}

export function mergeServerPlanningIntoMatchData(matchData: any, config: AnalysisConfigPayload | null): any {
  if (!config?.sourceContext?.planning || typeof matchData !== 'object' || !matchData) {
    return matchData;
  }

  const localSourceContext =
    matchData.sourceContext && typeof matchData.sourceContext === 'object'
      ? matchData.sourceContext
      : {};
  const serverSourceContext =
    config.sourceContext && typeof config.sourceContext === 'object'
      ? config.sourceContext
      : {};

  return {
    ...matchData,
    sourceContext: {
      ...localSourceContext,
      ...serverSourceContext,
      selectedSources:
        localSourceContext.selectedSources ||
        serverSourceContext.selectedSources ||
        undefined,
      selectedSourceIds:
        localSourceContext.selectedSourceIds ||
        serverSourceContext.selectedSourceIds ||
        undefined,
      capabilities: {
        ...(serverSourceContext.capabilities || {}),
        ...(localSourceContext.capabilities || {}),
      },
      planning: serverSourceContext.planning,
    },
  };
}

