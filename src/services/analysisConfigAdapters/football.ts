import { getSettings } from '@/src/services/settings';
import type {
  AnalysisConfigSubjectRef,
  DomainAnalysisConfigAdapter,
  SubjectAnalysisConfigPayload,
} from '@/src/services/analysisConfigRegistry';

function normalizeDomainId(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const normalized = input.trim();
  return normalized.length > 0 ? normalized : null;
}

function isRecordObject(input: unknown): input is Record<string, any> {
  return !!input && typeof input === 'object' && !Array.isArray(input);
}

function getRequestHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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

function normalizeAnalysisConfigResponse(payload: any): SubjectAnalysisConfigPayload | null {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  if (!data || typeof data !== 'object') return null;
  if (!data.sourceContext || typeof data.sourceContext !== 'object') return null;
  return {
    ...data,
    subjectId:
      typeof data.subjectId === 'string' && data.subjectId.trim().length > 0
        ? data.subjectId.trim()
        : undefined,
  } as SubjectAnalysisConfigPayload;
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

function mergeFootballPlanning(
  subjectPayload: any,
  config: SubjectAnalysisConfigPayload | null,
): any {
  if (!config?.sourceContext?.planning || typeof subjectPayload !== 'object' || !subjectPayload) {
    return subjectPayload;
  }

  const localSourceContext =
    subjectPayload.sourceContext && typeof subjectPayload.sourceContext === 'object'
      ? subjectPayload.sourceContext
      : {};
  const serverSourceContext =
    config.sourceContext && typeof config.sourceContext === 'object'
      ? config.sourceContext
      : {};
  const localDomainId = normalizeDomainId(localSourceContext.domainId);
  const serverDomainId = normalizeDomainId(serverSourceContext.domainId);
  const resolvedDomainId = localDomainId || serverDomainId;
  const hasDomainMismatch = !!localDomainId && !!serverDomainId && localDomainId !== serverDomainId;

  if (hasDomainMismatch) {
    console.warn(
      '[analysis-config] Ignore server sourceContext override due domain mismatch',
      { localDomainId, serverDomainId },
    );
  }

  const localPlanning = isRecordObject(localSourceContext.planning)
    ? localSourceContext.planning
    : undefined;
  const serverPlanning = isRecordObject(serverSourceContext.planning)
    ? serverSourceContext.planning
    : undefined;

  const mergedPlanning =
    hasDomainMismatch
      ? localPlanning
      : serverPlanning
        ? {
            ...(localPlanning || {}),
            ...serverPlanning,
          }
        : localPlanning;

  return {
    ...subjectPayload,
    sourceContext: {
      ...localSourceContext,
      ...(hasDomainMismatch ? {} : serverSourceContext),
      domainId: resolvedDomainId || undefined,
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
      planning: mergedPlanning,
    },
  };
}

export const footballAnalysisConfigAdapter: DomainAnalysisConfigAdapter = {
  domainId: 'football',
  supportsSubject(subjectRef: AnalysisConfigSubjectRef): boolean {
    return !subjectRef.subjectType || subjectRef.subjectType === 'match';
  },
  async fetchSubjectConfig(subjectRef: AnalysisConfigSubjectRef) {
    const settings = getSettings();
    if (!String(settings.matchDataServerUrl || '').trim() || !subjectRef.subjectId) {
      return null;
    }

    const encodedId = encodeURIComponent(subjectRef.subjectId);
    const url = buildServerUrl(`/analysis/config/match/${encodedId}`);
    if (!url) return null;

    const payload = await fetchJson(url, {
      method: 'GET',
      headers: getRequestHeaders(String(settings.matchDataApiKey || '').trim()),
    });

    return normalizeAnalysisConfigResponse(payload);
  },
  async resolveSubjectConfig(subjectSnapshot: any) {
    const settings = getSettings();
    if (!String(settings.matchDataServerUrl || '').trim()) {
      return null;
    }

    const url = buildServerUrl('/analysis/config/resolve');
    if (!url) return null;

    const payload = await fetchJson(url, {
      method: 'POST',
      headers: getRequestHeaders(String(settings.matchDataApiKey || '').trim()),
      body: JSON.stringify({
        subject: subjectSnapshot,
        match: subjectSnapshot,
      }),
    });

    return normalizeAnalysisConfigResponse(payload);
  },
  mergePlanning(subjectPayload: any, config: SubjectAnalysisConfigPayload | null) {
    return mergeFootballPlanning(subjectPayload, config);
  },
};

export const DOMAIN_ANALYSIS_CONFIG_ADAPTERS = [footballAnalysisConfigAdapter];
