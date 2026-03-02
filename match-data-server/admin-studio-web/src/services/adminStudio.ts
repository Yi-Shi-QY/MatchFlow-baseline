import { getSettings } from './settings';

export type AdminCatalogDomain =
  | 'datasource'
  | 'planning_template'
  | 'animation_template'
  | 'agent'
  | 'skill';

type ValidationRunType = 'catalog_validate' | 'pre_publish' | 'post_publish';
type CatalogStatus = 'draft' | 'validated' | 'published' | 'deprecated';
type CatalogChannel = 'internal' | 'beta' | 'stable';

interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class AdminStudioApiError extends Error {
  readonly code: string | null;
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, code: string | null, details: unknown) {
    super(message);
    this.name = 'AdminStudioApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface Pagination {
  limit: number;
  offset: number;
  count: number;
}

export interface CatalogEntry {
  domain: AdminCatalogDomain;
  itemId: string;
  latestVersion: string;
  latestStatus: CatalogStatus;
  latestChannel: CatalogChannel;
  updatedAt: string;
}

export interface CatalogRevision {
  id: string;
  domain: AdminCatalogDomain;
  tenantId: string;
  itemId: string;
  version: string;
  status: CatalogStatus;
  channel: CatalogChannel;
  manifest: Record<string, unknown>;
  checksum: string | null;
  validationSummary: Record<string, unknown>;
  createdByUserId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ManifestDiffResult {
  domain: AdminCatalogDomain;
  itemId: string;
  fromRevision: {
    version: string;
    status: CatalogStatus;
    channel: CatalogChannel;
    checksum: string | null;
    updatedAt: string;
  };
  toRevision: {
    version: string;
    status: CatalogStatus;
    channel: CatalogChannel;
    checksum: string | null;
    updatedAt: string;
  };
  diff: {
    summary: {
      manifestChanged: boolean;
      addedCount: number;
      removedCount: number;
      changedCount: number;
      totalChanges: number;
    };
    changes: {
      addedPaths: string[];
      removedPaths: string[];
      changedPaths: Array<{
        path: string;
        from: unknown;
        to: unknown;
      }>;
    };
  };
}

export interface ValidationRunRecord {
  id: string;
  tenantId: string;
  runType: ValidationRunType;
  domain: AdminCatalogDomain;
  scope: Record<string, unknown>;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
  logs: Array<{
    timestamp: string;
    level: string;
    message: string;
  }>;
  result: Record<string, unknown>;
  triggeredByUserId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReleaseRecord {
  id: string;
  tenantId: string;
  domain: AdminCatalogDomain;
  itemId: string;
  action: 'publish' | 'rollback';
  channel: CatalogChannel;
  fromVersion: string | null;
  toVersion: string;
  status: 'succeeded' | 'failed';
  notes: string | null;
  validationRunId: string | null;
  triggeredByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CatalogListResponse {
  data: CatalogEntry[];
  pagination: Pagination;
}

interface RevisionListResponse {
  data: CatalogRevision[];
  pagination: Pagination;
}

interface ReleaseHistoryResponse {
  data: ReleaseRecord[];
  pagination: Pagination;
}

function buildBaseUrl() {
  const settings = getSettings();
  const baseUrl = String(settings.matchDataServerUrl || '').trim();
  if (!baseUrl) {
    throw new AdminStudioApiError(
      'Match Data Server URL is not configured in Settings.',
      0,
      'SETTINGS_SERVER_URL_REQUIRED',
      null,
    );
  }
  return {
    baseUrl,
    apiKey: String(settings.matchDataApiKey || '').trim(),
  };
}

function toQueryString(query?: Record<string, string | number | undefined | null>) {
  const searchParams = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || String(value).trim() === '') {
      return;
    }
    searchParams.set(key, String(value));
  });
  return searchParams.toString();
}

function buildUrl(path: string, query?: Record<string, string | number | undefined | null>) {
  const { baseUrl } = buildBaseUrl();
  const url = new URL(path, baseUrl);
  const queryString = toQueryString(query);
  if (queryString) {
    url.search = queryString;
  }
  return url.toString();
}

async function requestJson<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT';
    query?: Record<string, string | number | undefined | null>;
    body?: unknown;
  } = {},
): Promise<T> {
  const { apiKey } = buildBaseUrl();
  const url = buildUrl(path, options.query);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const responseText = await response.text();
  let payload: unknown = null;
  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch {
    payload = responseText;
  }

  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload | null;
    const message =
      errorPayload?.error?.message ||
      `Request failed with status ${response.status}`;
    const code = errorPayload?.error?.code || null;
    const details = errorPayload?.error?.details ?? payload;
    throw new AdminStudioApiError(message, response.status, code, details);
  }

  return payload as T;
}

export async function listCatalogEntries(
  domain: AdminCatalogDomain,
  params: { search?: string; status?: string; limit?: number; offset?: number } = {},
) {
  return requestJson<CatalogListResponse>(`/admin/catalog/${domain}`, {
    method: 'GET',
    query: params,
  });
}

export async function listCatalogRevisions(
  domain: AdminCatalogDomain,
  itemId: string,
  params: { status?: string; channel?: string; limit?: number; offset?: number } = {},
) {
  return requestJson<RevisionListResponse>(`/admin/catalog/${domain}/${encodeURIComponent(itemId)}/revisions`, {
    method: 'GET',
    query: params,
  });
}

export async function createCatalogEntry(
  domain: AdminCatalogDomain,
  payload: {
    itemId: string;
    version: string;
    manifest: Record<string, unknown>;
    status?: CatalogStatus;
    channel?: CatalogChannel;
  },
) {
  const response = await requestJson<{ data: CatalogRevision }>(`/admin/catalog/${domain}`, {
    method: 'POST',
    body: payload,
  });
  return response.data;
}

export async function createCatalogRevision(
  domain: AdminCatalogDomain,
  itemId: string,
  payload: {
    version: string;
    manifest: Record<string, unknown>;
    status?: CatalogStatus;
    channel?: CatalogChannel;
  },
) {
  const response = await requestJson<{ data: CatalogRevision }>(
    `/admin/catalog/${domain}/${encodeURIComponent(itemId)}/revisions`,
    {
      method: 'POST',
      body: payload,
    },
  );
  return response.data;
}

export async function updateCatalogDraftRevision(
  domain: AdminCatalogDomain,
  itemId: string,
  version: string,
  payload: {
    manifest: Record<string, unknown>;
    channel?: CatalogChannel;
  },
) {
  const response = await requestJson<{ data: CatalogRevision }>(
    `/admin/catalog/${domain}/${encodeURIComponent(itemId)}/revisions/${encodeURIComponent(version)}`,
    {
      method: 'PUT',
      body: payload,
    },
  );
  return response.data;
}

export async function getCatalogRevisionDiff(
  domain: AdminCatalogDomain,
  itemId: string,
  fromVersion: string,
  toVersion: string,
) {
  const response = await requestJson<{ data: ManifestDiffResult }>(
    `/admin/catalog/${domain}/${encodeURIComponent(itemId)}/diff`,
    {
      method: 'GET',
      query: {
        fromVersion,
        toVersion,
      },
    },
  );
  return response.data;
}

export async function runCatalogValidation(
  input: {
    domain: AdminCatalogDomain;
    itemId: string;
    version?: string;
    runType?: ValidationRunType;
  },
) {
  const response = await requestJson<{ data: ValidationRunRecord }>('/admin/validate/run', {
    method: 'POST',
    body: {
      runType: input.runType || 'catalog_validate',
      domain: input.domain,
      scope: {
        itemId: input.itemId,
        ...(input.version ? { version: input.version } : {}),
      },
    },
  });
  return response.data;
}

export async function getValidationRun(runId: string) {
  const response = await requestJson<{ data: ValidationRunRecord }>(`/admin/validate/${encodeURIComponent(runId)}`, {
    method: 'GET',
  });
  return response.data;
}

export async function publishCatalogRevision(
  domain: AdminCatalogDomain,
  itemId: string,
  payload: {
    version: string;
    channel?: CatalogChannel;
    notes?: string;
    validationRunId?: string;
  },
) {
  const response = await requestJson<{ data: ReleaseRecord }>(
    `/admin/catalog/${domain}/${encodeURIComponent(itemId)}/publish`,
    {
      method: 'POST',
      body: payload,
    },
  );
  return response.data;
}

export async function rollbackCatalogRevision(
  domain: AdminCatalogDomain,
  itemId: string,
  payload: {
    targetVersion: string;
    channel?: CatalogChannel;
    notes?: string;
    validationRunId?: string;
  },
) {
  const response = await requestJson<{ data: ReleaseRecord }>(
    `/admin/catalog/${domain}/${encodeURIComponent(itemId)}/rollback`,
    {
      method: 'POST',
      body: payload,
    },
  );
  return response.data;
}

export async function listReleaseHistory(params: {
  domain?: AdminCatalogDomain;
  channel?: CatalogChannel;
  limit?: number;
  offset?: number;
} = {}) {
  return requestJson<ReleaseHistoryResponse>('/admin/release/history', {
    method: 'GET',
    query: params,
  });
}
