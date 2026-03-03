import {
  clearAuthSession,
  getSettings,
  saveSettings,
  type AdminStudioAuthMode,
  type AdminStudioAuthUser,
} from './settings';

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

export interface AdminUser {
  id: string;
  tenantId: string;
  username: string;
  email: string;
  displayName: string | null;
  status: 'active' | 'disabled';
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: string[];
}

export interface AdminRole {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  permissions: string[];
}

export interface AdminPermission {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAuditLog {
  id: string;
  actorUserId: string | null;
  actorUsername: string | null;
  tenantId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  beforeState: unknown;
  afterState: unknown;
  metadata: Record<string, unknown>;
  createdAt: string;
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

export interface DatasourceCollectionHealthItem {
  collector: DatasourceCollector;
  latestRun: DatasourceCollectionRun | null;
  health: {
    status: 'healthy' | 'stale' | 'failed' | 'never_run' | 'disabled';
    reasons: string[];
    lastRunStatus: string;
    lastRunAt: string | null;
    lagMinutes: number | null;
    slaMaxLagMinutes: number;
  };
}

export interface DatasourceCollectionHealthSummary {
  total: number;
  healthy: number;
  stale: number;
  failed: number;
  neverRun: number;
  disabled: number;
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

interface DatasourceCollectionHealthResponse {
  generatedAt: string;
  staleAfterMinutes: number;
  summary: DatasourceCollectionHealthSummary;
  data: DatasourceCollectionHealthItem[];
  pagination: Pagination;
}

interface AdminUserListResponse {
  data: AdminUser[];
  pagination: Pagination;
}

interface AdminRoleListResponse {
  data: AdminRole[];
  count: number;
}

interface AdminPermissionListResponse {
  data: AdminPermission[];
  count: number;
}

interface AdminAuditLogListResponse {
  data: AdminAuditLog[];
  pagination: Pagination;
}

interface AuthSessionResponse {
  tokenType: 'Bearer';
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  user: AdminStudioAuthUser;
}

export interface CapabilitiesResponse {
  user: AdminStudioAuthUser;
  availableDataSources: string[];
  availableTemplates: string[];
  recommendedTemplates: string[];
  canUseAdminConsole: boolean;
}

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT';
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
}

const REFRESH_RETRY_ERROR_CODES = new Set([
  'AUTH_INVALID_ACCESS',
  'AUTH_SESSION_EXPIRED',
  'AUTH_SESSION_REVOKED',
  'AUTH_SESSION_NOT_FOUND',
  'AUTH_USER_INACTIVE',
]);

function buildBaseConfig() {
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
    settings,
    apiKey: String(settings.matchDataApiKey || '').trim(),
    accessToken: String(settings.accessToken || '').trim(),
    refreshToken: String(settings.refreshToken || '').trim(),
    authMode: (settings.authMode || 'api_key') as AdminStudioAuthMode,
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

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string | number | boolean | undefined | null>,
) {
  const url = new URL(path, baseUrl);
  const queryString = toQueryString(query);
  if (queryString) {
    url.search = queryString;
  }
  return url.toString();
}

function parseJsonSafe(responseText: string) {
  if (!responseText) return null;
  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return responseText;
  }
}

function toApiError(payload: unknown, status: number) {
  const errorPayload = payload as ApiErrorPayload | null;
  const message =
    errorPayload?.error?.message ||
    `Request failed with status ${status}`;
  const code = errorPayload?.error?.code || null;
  const details = errorPayload?.error?.details ?? payload;
  return new AdminStudioApiError(message, status, code, details);
}

function resolveAuthBearerToken(config: ReturnType<typeof buildBaseConfig>) {
  if (config.authMode === 'account') {
    return config.accessToken;
  }
  if (config.apiKey) {
    return config.apiKey;
  }
  if (config.accessToken) {
    return config.accessToken;
  }
  return '';
}

function toExpiryIsoString(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '';
  }
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function persistAuthSession(
  data: AuthSessionResponse,
  options: {
    accountIdentifier?: string;
  } = {},
) {
  const currentSettings = getSettings();
  saveSettings({
    authMode: 'account',
    accountIdentifier:
      typeof options.accountIdentifier === 'string' && options.accountIdentifier.trim().length > 0
        ? options.accountIdentifier.trim()
        : currentSettings.accountIdentifier,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    accessTokenExpiresAt: toExpiryIsoString(data.expiresIn),
    refreshTokenExpiresAt: toExpiryIsoString(data.refreshExpiresIn),
    authUser: data.user,
  });
}

async function requestPublicJson<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { baseUrl } = buildBaseConfig();
  const url = buildUrl(baseUrl, path, options.query);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const responseText = await response.text();
  const payload = parseJsonSafe(responseText);

  if (!response.ok) {
    throw toApiError(payload, response.status);
  }

  return payload as T;
}

async function tryRefreshAccessToken() {
  const config = buildBaseConfig();
  if (config.authMode !== 'account' || !config.refreshToken) {
    return false;
  }

  try {
    const refreshed = await requestPublicJson<{ data: AuthSessionResponse }>('/auth/refresh', {
      method: 'POST',
      body: {
        refreshToken: config.refreshToken,
      },
    });
    persistAuthSession(refreshed.data);
    return true;
  } catch (error) {
    clearAuthSession();
    throw error;
  }
}

function shouldAttemptRefresh(
  config: ReturnType<typeof buildBaseConfig>,
  error: AdminStudioApiError,
) {
  if (config.authMode !== 'account') {
    return false;
  }
  if (!config.refreshToken) {
    return false;
  }
  if (error.status !== 401) {
    return false;
  }
  if (!error.code) {
    return true;
  }
  return REFRESH_RETRY_ERROR_CODES.has(error.code);
}

async function requestJson<T>(
  path: string,
  options: ApiRequestOptions = {},
  allowRefreshRetry = true,
): Promise<T> {
  const config = buildBaseConfig();
  const url = buildUrl(config.baseUrl, path, options.query);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const bearerToken = resolveAuthBearerToken(config);
  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const responseText = await response.text();
  const payload = parseJsonSafe(responseText);

  if (!response.ok) {
    const requestError = toApiError(payload, response.status);
    if (allowRefreshRetry && shouldAttemptRefresh(config, requestError)) {
      await tryRefreshAccessToken();
      return requestJson<T>(path, options, false);
    }
    throw requestError;
  }

  return payload as T;
}

export async function loginWithAccount(input: { identifier: string; password: string }) {
  const identifier = String(input.identifier || '').trim();
  const password = String(input.password || '');
  if (!identifier || !password) {
    throw new AdminStudioApiError(
      'identifier and password are required',
      400,
      'AUTH_INVALID_REQUEST',
      null,
    );
  }

  const response = await requestPublicJson<{ data: AuthSessionResponse }>('/auth/login', {
    method: 'POST',
    body: {
      identifier,
      password,
    },
  });
  persistAuthSession(response.data, {
    accountIdentifier: identifier,
  });
  return response.data;
}

export async function logoutAccount() {
  const config = buildBaseConfig();
  try {
    if (config.accessToken) {
      const url = buildUrl(config.baseUrl, '/auth/logout');
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.accessToken}`,
        },
        body: JSON.stringify({
          refreshToken: config.refreshToken || undefined,
        }),
      });
    }
  } finally {
    clearAuthSession();
  }
}

export async function getCurrentUserProfile() {
  const response = await requestJson<{ data: AdminStudioAuthUser }>('/auth/me', {
    method: 'GET',
  });
  saveSettings({
    authMode: 'account',
    authUser: response.data,
  });
  return response.data;
}

export async function getMyCapabilities() {
  const response = await requestJson<{ data: CapabilitiesResponse }>('/capabilities/me', {
    method: 'GET',
  });
  return response.data;
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

export async function listDatasourceCollectionHealth(params: {
  sourceId?: string;
  includeDisabled?: boolean;
  staleAfterMinutes?: number;
  limit?: number;
  offset?: number;
} = {}) {
  return requestJson<DatasourceCollectionHealthResponse>('/admin/data-collections/health', {
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

export async function replayDatasourceCollectionSnapshot(
  snapshotId: string,
  payload: {
    triggerType?: 'manual' | 'scheduled' | 'retry';
    allowDuplicate?: boolean;
    force?: boolean;
  } = {},
) {
  const response = await requestJson<{
    data: {
      sourceSnapshotId: string;
      collector: DatasourceCollector;
      run: DatasourceCollectionRun;
      snapshot: DatasourceCollectionSnapshot;
      deduplicated?: boolean;
    };
  }>(
    `/admin/data-collections/snapshots/${encodeURIComponent(snapshotId)}/replay`,
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

export async function listAdminUsers(params: {
  tenantId?: string;
  status?: 'active' | 'disabled';
  search?: string;
  limit?: number;
  offset?: number;
} = {}) {
  return requestJson<AdminUserListResponse>('/admin/users', {
    method: 'GET',
    query: params,
  });
}

export async function createAdminUser(payload: {
  tenantId?: string;
  username: string;
  email: string;
  password: string;
  displayName?: string;
  status?: 'active' | 'disabled';
  roleCodes?: string[];
}) {
  const response = await requestJson<{ data: AdminUser }>('/admin/users', {
    method: 'POST',
    body: payload,
  });
  return response.data;
}

export async function updateAdminUser(
  userId: string,
  payload: {
    email?: string;
    displayName?: string;
    status?: 'active' | 'disabled';
    password?: string;
  },
) {
  const response = await requestJson<{ data: AdminUser }>(
    `/admin/users/${encodeURIComponent(userId)}`,
    {
      method: 'PUT',
      body: payload,
    },
  );
  return response.data;
}

export async function setAdminUserRoles(userId: string, roleCodes: string[]) {
  const response = await requestJson<{ data: AdminUser }>(
    `/admin/users/${encodeURIComponent(userId)}/roles`,
    {
      method: 'POST',
      body: {
        roleCodes,
      },
    },
  );
  return response.data;
}

export async function listAdminRoles() {
  return requestJson<AdminRoleListResponse>('/admin/roles', {
    method: 'GET',
  });
}

export async function createAdminRole(payload: {
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
  permissionCodes?: string[];
}) {
  const response = await requestJson<{ data: AdminRole }>('/admin/roles', {
    method: 'POST',
    body: payload,
  });
  return response.data;
}

export async function updateAdminRole(
  roleId: string,
  payload: {
    name?: string;
    description?: string;
    isActive?: boolean;
    permissionCodes?: string[];
  },
) {
  const response = await requestJson<{ data: AdminRole }>(
    `/admin/roles/${encodeURIComponent(roleId)}`,
    {
      method: 'PUT',
      body: payload,
    },
  );
  return response.data;
}

export async function setAdminRolePermissions(roleId: string, permissionCodes: string[]) {
  const response = await requestJson<{ data: AdminRole }>(
    `/admin/roles/${encodeURIComponent(roleId)}/permissions`,
    {
      method: 'POST',
      body: {
        permissionCodes,
      },
    },
  );
  return response.data;
}

export async function listAdminPermissions() {
  return requestJson<AdminPermissionListResponse>('/admin/permissions', {
    method: 'GET',
  });
}

export async function createAdminPermission(payload: {
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
}) {
  const response = await requestJson<{ data: AdminPermission }>('/admin/permissions', {
    method: 'POST',
    body: payload,
  });
  return response.data;
}

export async function listAdminAuditLogs(params: {
  tenantId?: string;
  action?: string;
  actorUserId?: string;
  limit?: number;
  offset?: number;
} = {}) {
  return requestJson<AdminAuditLogListResponse>('/admin/audit-logs', {
    method: 'GET',
    query: params,
  });
}
