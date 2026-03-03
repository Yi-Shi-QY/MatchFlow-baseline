import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, Loader2, PlayCircle, RefreshCw, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/src/components/ui/Button';
import { Card, CardContent } from '@/src/components/ui/Card';
import { Select } from '@/src/components/ui/Select';
import {
  type AdminCatalogDomain,
  AdminStudioApiError,
  type CatalogEntry,
  type CatalogRevision,
  type ValidationRunRecord,
  getValidationRun,
  listCatalogEntries,
  listCatalogRevisions,
  runCatalogValidation,
} from '@/src/services/adminStudio';

type FeedbackTone = 'success' | 'error' | 'info';
type ValidationRunType = 'catalog_validate' | 'pre_publish' | 'post_publish';

interface FeedbackState {
  tone: FeedbackTone;
  message: string;
}

interface ValidationCheck {
  name: string;
  status: string;
  message: string;
}

const DOMAIN_OPTIONS: Array<{ value: AdminCatalogDomain; label: string }> = [
  { value: 'datasource', label: 'datasource' },
  { value: 'planning_template', label: 'planning_template' },
  { value: 'animation_template', label: 'animation_template' },
  { value: 'agent', label: 'agent' },
  { value: 'skill', label: 'skill' },
  { value: 'domain_pack', label: 'domain_pack' },
];

const RUN_TYPE_OPTIONS: Array<{ value: ValidationRunType; label: string }> = [
  { value: 'catalog_validate', label: 'catalog_validate' },
  { value: 'pre_publish', label: 'pre_publish' },
  { value: 'post_publish', label: 'post_publish' },
];

const DOMAIN_WORKSPACE_PATH: Record<AdminCatalogDomain, string> = {
  datasource: '/app/datasources/design',
  planning_template: '/app/planning-templates/design',
  animation_template: '/app/animation-templates/design',
  agent: '/app/agents/design',
  skill: '/app/skills/design',
  domain_pack: '/app/domain-packs/design',
};

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function describeError(error: unknown) {
  if (error instanceof AdminStudioApiError) {
    return `${error.code ? `${error.code}: ` : ''}${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected request error';
}

function formatTime(iso: string | null | undefined) {
  if (!iso) {
    return '-';
  }
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return iso;
  }
  return new Date(timestamp).toLocaleString();
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'succeeded':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'failed':
      return 'border-red-500/30 bg-red-500/10 text-red-300';
    case 'running':
      return 'border-blue-500/30 bg-blue-500/10 text-blue-300';
    case 'queued':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    case 'canceled':
      return 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300';
    default:
      return 'border-white/20 bg-white/5 text-zinc-300';
  }
}

function getValidationChecks(run: ValidationRunRecord | null) {
  if (!run) {
    return [];
  }
  const result = asRecord(run.result);
  const checksRaw = Array.isArray(result.checks) ? result.checks : [];
  return checksRaw.map((check, index) => {
    const item = asRecord(check);
    return {
      name: asText(item.name) || `check_${index + 1}`,
      status: asText(item.status) || 'unknown',
      message: asText(item.message) || '-',
    } satisfies ValidationCheck;
  });
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default function ValidationCenterPage() {
  const [domain, setDomain] = useState<AdminCatalogDomain>('datasource');
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [revisions, setRevisions] = useState<CatalogRevision[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [runType, setRunType] = useState<ValidationRunType>('catalog_validate');
  const [runIdInput, setRunIdInput] = useState('');

  const [activeRun, setActiveRun] = useState<ValidationRunRecord | null>(null);
  const [recentRuns, setRecentRuns] = useState<ValidationRunRecord[]>([]);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [isLoadingRevisions, setIsLoadingRevisions] = useState(false);
  const [isStartingRun, setIsStartingRun] = useState(false);
  const [isPollingRun, setIsPollingRun] = useState(false);
  const [isLookingUpRun, setIsLookingUpRun] = useState(false);

  const checks = useMemo(() => getValidationChecks(activeRun), [activeRun]);
  const failedChecks = useMemo(
    () => checks.filter((check) => check.status !== 'passed'),
    [checks],
  );

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.itemId === selectedItemId) || null,
    [entries, selectedItemId],
  );

  const entryOptions = useMemo(() => {
    if (entries.length === 0) {
      return [{ value: '', label: 'no items' }];
    }
    return entries.map((entry) => ({
      value: entry.itemId,
      label: `${entry.itemId} (${entry.latestVersion})`,
    }));
  }, [entries]);

  const revisionOptions = useMemo(() => {
    const base = [{ value: '', label: 'latest published/draft' }];
    const mapped = revisions.map((revision) => ({
      value: revision.version,
      label: `${revision.version} [${revision.status}]`,
    }));
    return [...base, ...mapped];
  }, [revisions]);

  function upsertRecentRun(run: ValidationRunRecord) {
    setRecentRuns((previous) => {
      const merged = [run, ...previous.filter((item) => item.id !== run.id)];
      return merged.slice(0, 12);
    });
  }

  async function loadEntries(targetDomain: AdminCatalogDomain) {
    setIsLoadingEntries(true);
    try {
      const response = await listCatalogEntries(targetDomain, { limit: 120 });
      const nextEntries = [...response.data].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setEntries(nextEntries);
      const nextItemId = nextEntries[0]?.itemId || '';
      setSelectedItemId(nextItemId);
      if (!nextItemId) {
        setRevisions([]);
        setSelectedVersion('');
      }
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: describeError(error),
      });
    } finally {
      setIsLoadingEntries(false);
    }
  }

  async function loadRevisions(targetDomain: AdminCatalogDomain, itemId: string) {
    if (!itemId) {
      setRevisions([]);
      setSelectedVersion('');
      return;
    }
    setIsLoadingRevisions(true);
    try {
      const response = await listCatalogRevisions(targetDomain, itemId, { limit: 120 });
      const nextRevisions = [...response.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setRevisions(nextRevisions);
      const keepCurrent = selectedVersion && nextRevisions.some((revision) => revision.version === selectedVersion);
      setSelectedVersion(keepCurrent ? selectedVersion : '');
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: describeError(error),
      });
    } finally {
      setIsLoadingRevisions(false);
    }
  }

  async function pollRunUntilStable(runId: string) {
    setIsPollingRun(true);
    try {
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await delay(1200);
        const run = await getValidationRun(runId);
        setActiveRun(run);
        upsertRecentRun(run);
        if (run.status === 'succeeded' || run.status === 'failed' || run.status === 'canceled') {
          break;
        }
      }
    } finally {
      setIsPollingRun(false);
    }
  }

  async function handleStartRun() {
    if (!selectedItemId) {
      setFeedback({ tone: 'error', message: 'Select itemId before starting validation.' });
      return;
    }
    setIsStartingRun(true);
    try {
      const run = await runCatalogValidation({
        domain,
        itemId: selectedItemId,
        ...(selectedVersion ? { version: selectedVersion } : {}),
        runType,
      });
      setActiveRun(run);
      setRunIdInput(run.id);
      upsertRecentRun(run);
      setFeedback({
        tone: 'success',
        message: `Validation run started: ${run.id}`,
      });
      if (run.status === 'queued' || run.status === 'running') {
        await pollRunUntilStable(run.id);
      }
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: describeError(error),
      });
    } finally {
      setIsStartingRun(false);
    }
  }

  async function handleLookupRun() {
    const runId = runIdInput.trim();
    if (!runId) {
      setFeedback({ tone: 'error', message: 'Provide runId.' });
      return;
    }
    setIsLookingUpRun(true);
    try {
      const run = await getValidationRun(runId);
      setActiveRun(run);
      upsertRecentRun(run);
      setFeedback({
        tone: 'success',
        message: `Loaded run ${run.id}.`,
      });
      if (run.status === 'queued' || run.status === 'running') {
        await pollRunUntilStable(run.id);
      }
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: describeError(error),
      });
    } finally {
      setIsLookingUpRun(false);
    }
  }

  async function handleRefreshCatalog() {
    await loadEntries(domain);
    if (selectedItemId) {
      await loadRevisions(domain, selectedItemId);
    }
    setFeedback({
      tone: 'info',
      message: `Catalog refreshed for ${domain}.`,
    });
  }

  async function handleLoadRecentRun(runId: string) {
    setRunIdInput(runId);
    setIsLookingUpRun(true);
    try {
      const run = await getValidationRun(runId);
      setActiveRun(run);
      upsertRecentRun(run);
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: describeError(error),
      });
    } finally {
      setIsLookingUpRun(false);
    }
  }

  useEffect(() => {
    setEntries([]);
    setRevisions([]);
    setSelectedItemId('');
    setSelectedVersion('');
    void loadEntries(domain);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  useEffect(() => {
    if (!selectedItemId) {
      setRevisions([]);
      setSelectedVersion('');
      return;
    }
    void loadRevisions(domain, selectedItemId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, selectedItemId]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <div>
        <h1 className="text-base font-bold text-white">Validation Center</h1>
        <p className="text-xs text-zinc-500">
          Run cross-domain validation jobs and inspect run status/checks from one page.
        </p>
      </div>

      {feedback && (
        <div
          data-testid="validation-center-feedback"
          className={`rounded-lg border px-3 py-2 text-xs ${
            feedback.tone === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : feedback.tone === 'error'
                ? 'border-red-500/30 bg-red-500/10 text-red-300'
                : 'border-blue-500/30 bg-blue-500/10 text-blue-300'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <Card className="border-zinc-800 bg-zinc-950">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">Run Validation</h2>
            <Link className="text-xs text-emerald-300 underline" to={DOMAIN_WORKSPACE_PATH[domain]}>
              Open {domain} workspace
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-4">
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">domain</div>
              <Select
                value={domain}
                onChange={(value) => setDomain(value as AdminCatalogDomain)}
                options={DOMAIN_OPTIONS}
                testId="validation-center-domain-select"
              />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">itemId</div>
              <Select
                value={selectedItemId}
                onChange={setSelectedItemId}
                options={entryOptions}
                testId="validation-center-item-select"
              />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">version (optional)</div>
              <Select
                value={selectedVersion}
                onChange={setSelectedVersion}
                options={revisionOptions}
                testId="validation-center-version-select"
              />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">runType</div>
              <Select
                value={runType}
                onChange={(value) => setRunType(value as ValidationRunType)}
                options={RUN_TYPE_OPTIONS}
                testId="validation-center-run-type-select"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            <span>entries: {entries.length}</span>
            <span>|</span>
            <span>revisions: {revisions.length}</span>
            <span>|</span>
            <span>latest: {selectedEntry?.latestVersion || '-'}</span>
            {(isLoadingEntries || isLoadingRevisions) && (
              <span className="inline-flex items-center gap-1 text-blue-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                loading catalog
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="gap-2"
              onClick={() => void handleStartRun()}
              disabled={isStartingRun || isPollingRun || !selectedItemId}
              data-testid="validation-center-start-run"
            >
              {isStartingRun ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              Start Run
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => void handleRefreshCatalog()}
              disabled={isLoadingEntries || isLoadingRevisions}
              data-testid="validation-center-refresh-catalog"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Catalog
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-950">
        <CardContent className="space-y-3 p-4">
          <h2 className="text-sm font-semibold text-white">Run Lookup</h2>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_auto]">
            <input
              type="text"
              value={runIdInput}
              onChange={(event) => setRunIdInput(event.target.value)}
              placeholder="validation runId"
              data-testid="validation-center-run-id-input"
              className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
            <Button
              variant="secondary"
              className="gap-2"
              onClick={() => void handleLookupRun()}
              disabled={isLookingUpRun || isPollingRun}
              data-testid="validation-center-load-run"
            >
              {isLookingUpRun ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Load Run
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.5fr_1fr]">
        <Card className="border-zinc-800 bg-zinc-950">
          <CardContent className="space-y-3 p-4" data-testid="validation-center-run-details">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">Run Details</h2>
              {activeRun ? (
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${statusBadgeClass(activeRun.status)}`}
                  data-testid="validation-center-run-status"
                >
                  {activeRun.status}
                </span>
              ) : null}
            </div>
            {!activeRun && (
              <div className="rounded-lg border border-dashed border-white/15 bg-zinc-900/60 px-3 py-3 text-xs text-zinc-500">
                No run selected. Start a run or lookup by runId.
              </div>
            )}

            {activeRun && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-zinc-900/80 p-3">
                    <div className="font-mono text-zinc-300">runId</div>
                    <div className="mt-1 break-all text-zinc-400" data-testid="validation-center-active-run-id">{activeRun.id}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-zinc-900/80 p-3">
                    <div className="font-mono text-zinc-300">scope</div>
                    <div className="mt-1 text-zinc-400">
                      domain={activeRun.domain} | itemId={asText(asRecord(activeRun.scope).itemId) || '-'} | version=
                      {asText(asRecord(activeRun.scope).version) || 'latest'}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                  <div className="rounded-lg border border-white/10 bg-zinc-900/80 p-3">
                    <div className="text-zinc-500">runType</div>
                    <div className="mt-1 text-zinc-300">{activeRun.runType}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-zinc-900/80 p-3">
                    <div className="text-zinc-500">created</div>
                    <div className="mt-1 text-zinc-300">{formatTime(activeRun.createdAt)}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-zinc-900/80 p-3">
                    <div className="text-zinc-500">finished</div>
                    <div className="mt-1 text-zinc-300">{formatTime(activeRun.finishedAt)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                  <div
                    className={`rounded-lg border px-3 py-2 ${
                      failedChecks.length === 0
                        ? 'border-emerald-500/20 bg-emerald-500/10'
                        : 'border-red-500/20 bg-red-500/10'
                    }`}
                  >
                    <div className="text-zinc-400">checks</div>
                    <div className="mt-1 text-white">{checks.length}</div>
                  </div>
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
                    <div className="text-zinc-400">failed checks</div>
                    <div className="mt-1 text-red-300">{failedChecks.length}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2">
                    <div className="text-zinc-400">logs</div>
                    <div className="mt-1 text-zinc-300">{activeRun.logs.length}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-zinc-300">Validation Checks</div>
                  <div className="max-h-[240px] space-y-2 overflow-auto rounded-lg border border-white/10 bg-zinc-900/80 p-2">
                    {checks.map((check) => (
                      <div key={`${check.name}_${check.status}`} className="rounded border border-white/10 bg-black/40 px-2 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-mono text-zinc-200">{check.name}</div>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] ${
                              check.status === 'passed'
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                : 'border-red-500/30 bg-red-500/10 text-red-300'
                            }`}
                          >
                            {check.status}
                          </span>
                        </div>
                        <div className="mt-1 text-zinc-400">{check.message}</div>
                      </div>
                    ))}
                    {checks.length === 0 && (
                      <div className="text-xs text-zinc-500">No checks in this run result.</div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-zinc-300">Logs</div>
                  <div className="max-h-[180px] space-y-1 overflow-auto rounded-lg border border-white/10 bg-zinc-900/80 p-2 text-[11px]">
                    {activeRun.logs.map((log, index) => (
                      <div key={`${activeRun.id}_log_${index}`} className="rounded border border-white/10 bg-black/40 px-2 py-1">
                        <div className="text-zinc-400">{formatTime(log.timestamp)}</div>
                        <div className="font-mono text-zinc-200">{log.level}</div>
                        <div className="text-zinc-300">{log.message}</div>
                      </div>
                    ))}
                    {activeRun.logs.length === 0 && (
                      <div className="text-zinc-500">No logs returned for this run.</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-950">
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-white">Recent Runs</h2>
            <div className="max-h-[640px] space-y-2 overflow-auto" data-testid="validation-center-recent-list">
              {recentRuns.map((run, index) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => void handleLoadRecentRun(run.id)}
                  data-testid={`validation-center-recent-item-${index}`}
                  className="w-full rounded-lg border border-white/10 bg-zinc-900/80 p-3 text-left transition hover:border-white/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-[11px] text-zinc-200">{run.id}</div>
                      <div className="mt-1 text-[11px] text-zinc-500">
                        {run.domain} | {asText(asRecord(run.scope).itemId) || '-'}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${statusBadgeClass(run.status)}`}>
                      {run.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-zinc-500">
                    <Clock3 className="h-3 w-3" />
                    {formatTime(run.createdAt)}
                  </div>
                </button>
              ))}
              {recentRuns.length === 0 && (
                <div className="rounded-lg border border-dashed border-white/15 bg-zinc-900/50 px-3 py-3 text-xs text-zinc-500">
                  No recent runs in this session.
                </div>
              )}
            </div>
            <div className="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2 text-[11px] text-zinc-500">
              A run is considered passed only when all checks return <span className="text-emerald-300">passed</span>.
            </div>
          </CardContent>
        </Card>
      </div>

      {(isPollingRun || isStartingRun) && (
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-300">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Tracking validation run status...
        </div>
      )}
    </div>
  );
}
