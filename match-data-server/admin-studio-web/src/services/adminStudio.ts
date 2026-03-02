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

export type DatasourcePreviewPathSlot = 'value' | 'home' | 'draw' | 'away';

export interface DatasourcePreviewFieldMapping {
  slot: DatasourcePreviewPathSlot;
  path: string[];
  pathText: string;
}

export interface DatasourcePreviewField {
  fieldId: string;
  fieldType: string;
  mappings: DatasourcePreviewFieldMapping[];
}

export interface DatasourcePreviewPathReference {
  fieldId: string;
  fieldType: string;
  slot: DatasourcePreviewPathSlot;
}

export interface DatasourcePreviewPathCatalogItem {
  pathText: string;
  segments: string[];
  fieldRefs: DatasourcePreviewPathReference[];
}

export interface DatasourcePreviewTreeNode {
  segment: string;
  path: string;
  fieldRefs: DatasourcePreviewPathReference[];
  children: DatasourcePreviewTreeNode[];
}

export interface DatasourceStructurePreview {
  sourceId: string;
  displayName: string;
  requiredPermissions: string[];
  validation: {
    status: 'passed' | 'failed';
    failedChecks: string[];
    checks: Array<{
      name: string;
      status: 'passed' | 'failed';
      message: string;
      details?: unknown;
    }>;
  };
  summary: {
    totalFields: number;
    mappedFieldCount: number;
    mappedPathCount: number;
    duplicatePathCount: number;
    invalidFieldCount: number;
  };
  fieldCatalog: DatasourcePreviewField[];
  pathCatalog: DatasourcePreviewPathCatalogItem[];
  tree: DatasourcePreviewTreeNode;
  sourceContextPreview: Record<string, unknown>;
}

export interface DatasourceDataPreviewRow {
  rowIndex: number;
  matchId: string | null;
  league: string | null;
  status: string | null;
  matchDate: string | null;
  values: Record<string, unknown>;
  sourceRecord?: Record<string, unknown>;
}

export interface DatasourceDataPreview {
  source: string;
  sampledAt: string;
  filters: {
    limit: number;
    statuses: string[];
  };
  summary: {
    rowCount: number;
    fieldCount: number;
    pathCount: number;
  };
  fieldCatalog: DatasourcePreviewField[];
  rows: DatasourceDataPreviewRow[];
}

export interface DatasourceCollector {
  id: string;
  tenantId: string;
  sourceId: string;
  name: string;
  provider: 'match_snapshot' | 'manual_import';
  config: Record<string, unknown>;
  scheduleCron: string | null;
  isEnabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: 'idle' | 'running' | 'succeeded' | 'failed';
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DatasourceCollectionRun {
  id: string;
  tenantId: string;
  collectorId: string;
  sourceId: string;
  triggerType: 'manual' | 'scheduled' | 'retry';
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
  requestPayload: Record<string, unknown>;
  resultSummary: Record<string, unknown>;
  errorMessage: string | null;
  requestedByUserId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DatasourceCollectionSnapshot {
  id: string;
  tenantId: string;
  collectorId: string;
  runId: string | null;
  sourceId: string;
  payload: Record<string, unknown>;
  recordCount: number;
  contentHash: string | null;
  confirmationStatus: 'pending' | 'confirmed' | 'rejected';
  confirmationNotes: string | null;
  confirmedByUserId: string | null;
  confirmedAt: string | null;
  releaseStatus: 'draft' | 'released' | 'deprecated';
  releaseChannel: 'internal' | 'beta' | 'stable' | null;
  releasedByUserId: string | null;
  releasedAt: string | null;
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

interface DatasourceCollectorListResponse {
  data: DatasourceCollector[];
  pagination: Pagination;
}

interface DatasourceCollectionRunListResponse {
  data: DatasourceCollectionRun[];
  pagination: Pagination;
}

interface DatasourceCollectionSnapshotListResponse {
  data: DatasourceCollectionSnapshot[];
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

function toQueryString(query?: Record<string, string | number | boolean | undefined | null>) {
  const searchParams = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || String(value).trim() === '') {
      return;
    }
    searchParams.set(key, String(value));
  });
  return searchParams.toString();
}

function buildUrl(path: string, query?: Record<string, string | number | boolean | undefined | null>) {
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
    query?: Record<string, string | number | boolean | undefined | null>;
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

export async function previewDatasourceStructure(payload: {
  manifest: Record<string, unknown>;
}) {
  const response = await requestJson<{ data: DatasourceStructurePreview }>(
    '/admin/catalog/datasource/preview/structure',
    {
      method: 'POST',
      body: payload,
    },
  );
  return response.data;
}

export async function previewDatasourceData(payload: {
  manifest: Record<string, unknown>;
  limit?: number;
  statuses?: string[];
  includeSourceRecord?: boolean;
}) {
  const response = await requestJson<{ data: DatasourceDataPreview }>(
    '/admin/catalog/datasource/preview/data',
    {
      method: 'POST',
      body: payload,
    },
  );
  return response.data;
}

export async function listDatasourceCollectors(params: {
  sourceId?: string;
  isEnabled?: boolean;
  limit?: number;
  offset?: number;
} = {}) {
  return requestJson<DatasourceCollectorListResponse>('/admin/data-collections/collectors', {
    method: 'GET',
    query: params,
  });
}

export async function createDatasourceCollector(payload: {
  sourceId: string;
  name: string;
  provider?: 'match_snapshot' | 'manual_import';
  config?: Record<string, unknown>;
  scheduleCron?: string;
  isEnabled?: boolean;
}) {
  const response = await requestJson<{ data: DatasourceCollector }>(
    '/admin/data-collections/collectors',
    {
      method: 'POST',
      body: payload,
    },
  );
  return response.data;
}

export async function updateDatasourceCollector(
  collectorId: string,
  payload: {
    sourceId?: string;
    name?: string;
    provider?: 'match_snapshot' | 'manual_import';
    config?: Record<string, unknown>;
    scheduleCron?: string;
    isEnabled?: boolean;
  },
) {
  const response = await requestJson<{ data: DatasourceCollector }>(
    `/admin/data-collections/collectors/${encodeURIComponent(collectorId)}`,
    {
      method: 'PUT',
      body: payload,
    },
  );
  return response.data;
}

export async function triggerDatasourceCollectorRun(
  collectorId: string,
  payload: {
    triggerType?: 'manual' | 'scheduled' | 'retry';
    statuses?: string[];
    limit?: number;
    force?: boolean;
  } = {},
) {
  const response = await requestJson<{
    data: {
      collector: DatasourceCollector;
      run: DatasourceCollectionRun;
      snapshot: DatasourceCollectionSnapshot;
    };
  }>(
    `/admin/data-collections/collectors/${encodeURIComponent(collectorId)}/run`,
    {
      method: 'POST',
      body: payload,
    },
  );
  return response.data;
}

export async function importDatasourceCollectorSnapshot(
  collectorId: string,
  payload: {
    triggerType?: 'manual' | 'scheduled' | 'retry';
    sourceId?: string;
    payload: Record<string, unknown>;
    recordCount?: number;
    contentHash?: string;
    allowDuplicate?: boolean;
    force?: boolean;
  },
) {
  const response = await requestJson<{
    data: {
      collector: DatasourceCollector;
      run: DatasourceCollectionRun;
      snapshot: DatasourceCollectionSnapshot;
      deduplicated?: boolean;
    };
  }>(
    `/admin/data-collections/collectors/${encodeURIComponent(collectorId)}/import`,
    {
      method: 'POST',
      body: payload,
    },
  );
  return response.data;
}

export async function listDatasourceCollectionRuns(params: {
  collectorId?: string;
  sourceId?: string;
  status?: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
  triggerType?: 'manual' | 'scheduled' | 'retry';
  limit?: number;
  offset?: number;
} = {}) {
  return requestJson<DatasourceCollectionRunListResponse>('/admin/data-collections/runs', {
    method: 'GET',
    query: params,
  });
}

export async function listDatasourceCollectionSnapshots(params: {
  collectorId?: string;
  sourceId?: string;
  confirmationStatus?: 'pending' | 'confirmed' | 'rejected';
  releaseStatus?: 'draft' | 'released' | 'deprecated';
  releaseChannel?: 'internal' | 'beta' | 'stable';
  limit?: number;
  offset?: number;
} = {}) {
  return requestJson<DatasourceCollectionSnapshotListResponse>('/admin/data-collections/snapshots', {
    method: 'GET',
    query: params,
  });
}

export async function confirmDatasourceCollectionSnapshot(
  snapshotId: string,
  payload: {
    action?: 'confirm' | 'reject';
    notes?: string;
  } = {},
) {
  const response = await requestJson<{ data: DatasourceCollectionSnapshot }>(
    `/admin/data-collections/snapshots/${encodeURIComponent(snapshotId)}/confirm`,
    {
      method: 'POST',
      body: payload,
    },
  );
  return response.data;
}

export async function releaseDatasourceCollectionSnapshot(
  snapshotId: string,
  payload: {
    channel?: 'internal' | 'beta' | 'stable';
  } = {},
) {
  const response = await requestJson<{
    data: {
      snapshot: DatasourceCollectionSnapshot;
      deprecatedSnapshotIds: string[];
    };
  }>(
    `/admin/data-collections/snapshots/${encodeURIComponent(snapshotId)}/release`,
    {
      method: 'POST',
      body: payload,
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
