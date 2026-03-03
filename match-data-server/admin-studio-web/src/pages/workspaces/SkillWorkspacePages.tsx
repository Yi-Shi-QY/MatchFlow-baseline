import React, { useEffect, useMemo, useState } from 'react';
import {
  GitCompare,
  History,
  Loader2,
  PackageCheck,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Card, CardContent } from '@/src/components/ui/Card';
import DomainStageTabs from '@/src/components/layout/DomainStageTabs';
import { Select } from '@/src/components/ui/Select';
import {
  AdminStudioApiError,
  CatalogEntry,
  CatalogRevision,
  ManifestDiffResult,
  ReleaseRecord,
  SkillModelPreviewResult,
  ValidationRunRecord,
  createCatalogEntry,
  createCatalogRevision,
  getCatalogRevisionDiff,
  getValidationRun,
  listCatalogEntries,
  listCatalogRevisions,
  listReleaseHistory,
  previewSkillModelInvocation,
  publishCatalogRevision,
  rollbackCatalogRevision,
  runCatalogValidation,
  updateCatalogDraftRevision,
} from '@/src/services/adminStudio';

const BASE_PATH = '/app/skills';

const INPUT_CLASS =
  'w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none';
const TEXTAREA_CLASS =
  'min-h-[72px] w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none';

type FeedbackTone = 'success' | 'error' | 'info';
type CatalogChannel = 'internal' | 'beta' | 'stable';
type ValidationRunType = 'catalog_validate' | 'pre_publish' | 'post_publish';

interface FeedbackState {
  tone: FeedbackTone;
  message: string;
}

interface SkillManifestDraft {
  id: string;
  name: string;
  description: string;
  minAppVersion: string;
  declarationName: string;
  declarationDescription: string;
  parametersJson: string;
  targetSkill: string;
}

interface ValidationCheck {
  name: string;
  status: string;
  message: string;
}

interface SkillInvocationPreview {
  generatedAt: string;
  readiness: 'ready' | 'incomplete';
  requiredKeys: string[];
  payloadKeys: string[];
  missingRequiredKeys: string[];
  warnings: string[];
}

const CHANNEL_OPTIONS: Array<{ value: CatalogChannel; label: string }> = [
  { value: 'internal', label: 'internal' },
  { value: 'beta', label: 'beta' },
  { value: 'stable', label: 'stable' },
];

const VALIDATION_TYPE_OPTIONS: Array<{ value: ValidationRunType; label: string }> = [
  { value: 'catalog_validate', label: 'catalog_validate' },
  { value: 'pre_publish', label: 'pre_publish' },
  { value: 'post_publish', label: 'post_publish' },
];

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseJsonObjectText(text: string, label: string) {
  const normalized = text.trim();
  if (!normalized) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function parseOptionalFloat(text: string) {
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalInteger(text: string) {
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildEmptySkillDraft(itemId: string): SkillManifestDraft {
  return {
    id: itemId || 'skill_item',
    name: 'Skill',
    description: 'Skill manifest managed from Admin Studio.',
    minAppVersion: '',
    declarationName: itemId || 'skill_item',
    declarationDescription: '',
    parametersJson: JSON.stringify({ type: 'object', properties: {} }, null, 2),
    targetSkill: '',
  };
}

function toSkillManifestDraft(manifest: Record<string, unknown>, fallbackItemId: string): SkillManifestDraft {
  const declaration = asRecord(manifest.declaration);
  const runtime = asRecord(manifest.runtime);
  const parameters = asRecord(declaration.parameters);
  const fallbackId = asText(manifest.id) || fallbackItemId || 'skill_item';
  return {
    id: fallbackId,
    name: asText(manifest.name) || 'Skill',
    description: asText(manifest.description) || 'Skill manifest managed from Admin Studio.',
    minAppVersion: asText(manifest.minAppVersion),
    declarationName: asText(declaration.name) || fallbackId,
    declarationDescription: asText(declaration.description),
    parametersJson: JSON.stringify(
      Object.keys(parameters).length > 0 ? parameters : { type: 'object', properties: {} },
      null,
      2,
    ),
    targetSkill: asText(runtime.targetSkill),
  };
}

function toSkillManifest(draft: SkillManifestDraft) {
  return {
    kind: 'skill',
    id: asText(draft.id),
    name: asText(draft.name),
    description: asText(draft.description),
    ...(asText(draft.minAppVersion) ? { minAppVersion: asText(draft.minAppVersion) } : {}),
    declaration: {
      name: asText(draft.declarationName) || asText(draft.id),
      description: asText(draft.declarationDescription),
      parameters: parseJsonObjectText(draft.parametersJson, 'declaration.parameters'),
    },
    runtime: {
      mode: 'builtin_alias',
      targetSkill: asText(draft.targetSkill),
    },
  };
}

function getSkillDraftIssues(draft: SkillManifestDraft | null) {
  if (!draft) {
    return ['Draft not initialized.'];
  }
  const issues: string[] = [];
  if (!asText(draft.id)) {
    issues.push('id is required.');
  }
  if (!asText(draft.name)) {
    issues.push('name is required.');
  }
  if (!asText(draft.declarationName)) {
    issues.push('declaration.name is required.');
  }
  if (!asText(draft.targetSkill)) {
    issues.push('runtime.targetSkill is required.');
  }
  try {
    const parameters = parseJsonObjectText(draft.parametersJson, 'declaration.parameters');
    if (asText(parameters.type) && asText(parameters.type) !== 'object') {
      issues.push('declaration.parameters.type should be object.');
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : 'declaration.parameters JSON invalid.');
  }
  return issues;
}

function buildSkillInvocationPreview(draft: SkillManifestDraft | null, payloadText: string): SkillInvocationPreview | null {
  if (!draft) {
    return null;
  }
  const warnings: string[] = [];
  let payloadObject: Record<string, unknown> = {};
  try {
    payloadObject = parseJsonObjectText(payloadText, 'Invocation payload');
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : 'Invocation payload invalid.');
  }
  let requiredKeys: string[] = [];
  try {
    const parameters = parseJsonObjectText(draft.parametersJson, 'declaration.parameters');
    const requiredRaw = parameters.required;
    requiredKeys = Array.isArray(requiredRaw)
      ? requiredRaw.filter((item): item is string => typeof item === 'string')
      : [];
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : 'declaration.parameters invalid.');
  }

  const payloadKeys = Object.keys(payloadObject);
  const missingRequiredKeys = requiredKeys.filter((key) => !(key in payloadObject));
  if (missingRequiredKeys.length > 0) {
    warnings.push(`Missing required keys: ${missingRequiredKeys.join(', ')}`);
  }
  if (!asText(draft.targetSkill)) {
    warnings.push('runtime.targetSkill is empty.');
  }

  return {
    generatedAt: new Date().toISOString(),
    readiness: warnings.length === 0 ? 'ready' : 'incomplete',
    requiredKeys,
    payloadKeys,
    missingRequiredKeys,
    warnings,
  };
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

function toEntryOptions(entries: CatalogEntry[]) {
  return entries.map((entry) => ({
    value: entry.itemId,
    label: `${entry.itemId} (${entry.latestVersion})`,
  }));
}

function toRevisionOptions(revisions: CatalogRevision[]) {
  return revisions.map((revision) => ({
    value: revision.version,
    label: `${revision.version} [${revision.status}]`,
  }));
}

function getValidationChecks(run: ValidationRunRecord | null): ValidationCheck[] {
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
    };
  });
}

function hasValidationFailure(run: ValidationRunRecord | null) {
  if (!run) {
    return false;
  }
  return getValidationChecks(run).some((check) => check.status !== 'passed');
}

function WorkspaceHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="text-base font-bold text-white">{title}</h1>
      <p className="text-xs text-zinc-500">{description}</p>
    </div>
  );
}

function FeedbackBanner({ feedback }: { feedback: FeedbackState }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-xs ${
        feedback.tone === 'success'
          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
          : feedback.tone === 'error'
            ? 'border-red-500/20 bg-red-500/10 text-red-300'
            : 'border-sky-500/20 bg-sky-500/10 text-sky-200'
      }`}
    >
      {feedback.message}
    </div>
  );
}

export function SkillDesignPage() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [revisions, setRevisions] = useState<CatalogRevision[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [draft, setDraft] = useState<SkillManifestDraft | null>(null);
  const [publishChannel, setPublishChannel] = useState<CatalogChannel>('internal');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [newItemId, setNewItemId] = useState('');
  const [newEntryVersion, setNewEntryVersion] = useState('1.0.0');
  const [newRevisionVersion, setNewRevisionVersion] = useState('1.0.1');

  const [invocationPayloadText, setInvocationPayloadText] = useState('{\n  "matchId": "demo_001"\n}');
  const [invocationPreview, setInvocationPreview] = useState<SkillInvocationPreview | null>(null);
  const [liveModelResult, setLiveModelResult] = useState<SkillModelPreviewResult | null>(null);
  const [liveModelName, setLiveModelName] = useState('deepseek-chat');
  const [liveTemperature, setLiveTemperature] = useState('0.2');
  const [liveMaxTokens, setLiveMaxTokens] = useState('900');

  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [isLoadingRevisions, setIsLoadingRevisions] = useState(false);
  const [isCreatingEntry, setIsCreatingEntry] = useState(false);
  const [isCreatingRevision, setIsCreatingRevision] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isRunningLiveModelPreview, setIsRunningLiveModelPreview] = useState(false);

  const selectedRevision = useMemo(
    () => revisions.find((revision) => revision.version === selectedVersion) || null,
    [revisions, selectedVersion],
  );
  const localIssues = useMemo(() => getSkillDraftIssues(draft), [draft]);
  const manifestPreview = useMemo(
    () => (draft ? JSON.stringify(toSkillManifest(draft), null, 2) : ''),
    [draft],
  );

  async function loadEntries(preferredItemId?: string) {
    setIsLoadingEntries(true);
    try {
      const response = await listCatalogEntries('skill', { limit: 100 });
      const nextEntries = [...response.data].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setEntries(nextEntries);
      const keepCurrent = selectedItemId && nextEntries.some((entry) => entry.itemId === selectedItemId);
      const nextItemId = preferredItemId || (keepCurrent ? selectedItemId : nextEntries[0]?.itemId || '');
      setSelectedItemId(nextItemId);
      if (!nextItemId) {
        setRevisions([]);
        setSelectedVersion('');
        setDraft(buildEmptySkillDraft('skill_item'));
      }
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsLoadingEntries(false);
    }
  }

  async function loadRevisions(itemId: string, preferredVersion?: string) {
    if (!itemId) {
      setRevisions([]);
      setSelectedVersion('');
      setDraft(buildEmptySkillDraft('skill_item'));
      return;
    }
    setIsLoadingRevisions(true);
    try {
      const response = await listCatalogRevisions('skill', itemId, { limit: 100 });
      const nextRevisions = [...response.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setRevisions(nextRevisions);
      const keepCurrent = selectedVersion && nextRevisions.some((item) => item.version === selectedVersion);
      const nextVersion = preferredVersion || (keepCurrent ? selectedVersion : nextRevisions[0]?.version || '');
      setSelectedVersion(nextVersion);
      const target = nextRevisions.find((item) => item.version === nextVersion) || null;
      if (target) {
        setDraft(toSkillManifestDraft(target.manifest || {}, itemId));
        setPublishChannel(target.channel);
      } else {
        setDraft(buildEmptySkillDraft(itemId));
      }
      setInvocationPreview(null);
      setLiveModelResult(null);
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsLoadingRevisions(false);
    }
  }

  useEffect(() => {
    void loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedItemId) {
      return;
    }
    void loadRevisions(selectedItemId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemId]);

  function updateDraft(patch: Partial<SkillManifestDraft>) {
    setDraft((previous) => (previous ? { ...previous, ...patch } : previous));
  }

  async function handleCreateEntry() {
    const itemId = asText(newItemId);
    const version = asText(newEntryVersion);
    if (!itemId || !version) {
      setFeedback({ tone: 'error', message: 'Provide itemId and version.' });
      return;
    }
    setIsCreatingEntry(true);
    try {
      await createCatalogEntry('skill', {
        itemId,
        version,
        channel: publishChannel,
        manifest: toSkillManifest({ ...(draft || buildEmptySkillDraft(itemId)), id: itemId }),
      });
      setFeedback({ tone: 'success', message: `Created skill:${itemId}@${version}.` });
      await loadEntries(itemId);
      await loadRevisions(itemId, version);
      setNewItemId('');
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsCreatingEntry(false);
    }
  }

  async function handleCreateRevision() {
    const version = asText(newRevisionVersion);
    if (!selectedItemId || !version || !draft) {
      setFeedback({ tone: 'error', message: 'Select item and revision version.' });
      return;
    }
    setIsCreatingRevision(true);
    try {
      await createCatalogRevision('skill', selectedItemId, {
        version,
        channel: publishChannel,
        manifest: toSkillManifest({ ...draft, id: selectedItemId }),
      });
      setFeedback({ tone: 'success', message: `Created revision ${selectedItemId}@${version}.` });
      await loadRevisions(selectedItemId, version);
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsCreatingRevision(false);
    }
  }

  async function handleSaveDraft() {
    if (!selectedItemId || !selectedVersion || !draft || selectedRevision?.status !== 'draft') {
      setFeedback({ tone: 'error', message: 'Select draft revision before saving.' });
      return;
    }
    setIsSavingDraft(true);
    try {
      await updateCatalogDraftRevision('skill', selectedItemId, selectedVersion, {
        channel: publishChannel,
        manifest: toSkillManifest({ ...draft, id: selectedItemId }),
      });
      setFeedback({ tone: 'success', message: `Draft saved: ${selectedItemId}@${selectedVersion}.` });
      await loadRevisions(selectedItemId, selectedVersion);
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsSavingDraft(false);
    }
  }

  function handleRunInvocationPreview() {
    const preview = buildSkillInvocationPreview(draft, invocationPayloadText);
    setInvocationPreview(preview);
    setFeedback({
      tone: preview && preview.readiness === 'ready' ? 'success' : 'info',
      message: preview ? `Invocation preview generated (${preview.readiness}).` : 'Draft unavailable.',
    });
  }

  async function handleRunLiveModelPreview() {
    if (!draft) {
      setFeedback({ tone: 'error', message: 'Draft not initialized.' });
      return;
    }
    setIsRunningLiveModelPreview(true);
    try {
      const invocationPayload = parseJsonObjectText(invocationPayloadText, 'Invocation payload');
      const result = await previewSkillModelInvocation({
        manifest: toSkillManifest(draft),
        invocationPayload,
        model: asText(liveModelName) || undefined,
        temperature: parseOptionalFloat(liveTemperature),
        maxTokens: parseOptionalInteger(liveMaxTokens),
      });
      setLiveModelResult(result);
      setFeedback({
        tone: 'success',
        message: `DeepSeek skill preview completed in ${result.latencyMs}ms (${result.model}).`,
      });
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsRunningLiveModelPreview(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4">
      <WorkspaceHeader
        title="Skill Studio / Design"
        description="Edit declaration/runtime, validate parameters JSON, and run invocation test preview."
      />
      <DomainStageTabs basePath={BASE_PATH} activeStage="design" />
      {feedback && <FeedbackBanner feedback={feedback} />}

      <Card className="border-zinc-800 bg-zinc-950">
        <CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Skill Item</label>
              <Select value={selectedItemId || ''} onChange={(value) => setSelectedItemId(value)} options={toEntryOptions(entries).length > 0 ? toEntryOptions(entries) : [{ value: '', label: 'No item' }]} />
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Revision</label>
              <Select value={selectedVersion || ''} onChange={(value) => setSelectedVersion(value)} options={toRevisionOptions(revisions).length > 0 ? toRevisionOptions(revisions) : [{ value: '', label: 'No revision' }]} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={() => void loadEntries(selectedItemId || undefined)} disabled={isLoadingEntries}>
              {isLoadingEntries ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </Button>
            {isLoadingRevisions && (
              <div className="flex items-center gap-1 text-xs text-zinc-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                loading revisions...
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-950">
        <CardContent className="space-y-3 p-4">
          <h2 className="text-sm font-semibold text-white">Create and Save</h2>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
            <input className={INPUT_CLASS} value={newItemId} onChange={(event) => setNewItemId(event.target.value)} placeholder="new item id" />
            <input className={INPUT_CLASS} value={newEntryVersion} onChange={(event) => setNewEntryVersion(event.target.value)} placeholder="entry version" />
            <input className={INPUT_CLASS} value={newRevisionVersion} onChange={(event) => setNewRevisionVersion(event.target.value)} placeholder="revision version" />
            <Select value={publishChannel} onChange={(value) => setPublishChannel(value as CatalogChannel)} options={CHANNEL_OPTIONS} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleCreateEntry()} disabled={isCreatingEntry} className="gap-2">
                {isCreatingEntry ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create
              </Button>
              <Button variant="outline" onClick={() => void handleCreateRevision()} disabled={isCreatingRevision || !selectedItemId} className="gap-2">
                {isCreatingRevision ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Revision
              </Button>
              <Button variant="outline" onClick={() => void handleSaveDraft()} disabled={isSavingDraft || selectedRevision?.status !== 'draft'} className="gap-2">
                {isSavingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-950">
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-white">Draft Builder</h2>
            {!draft && <div className="text-xs text-zinc-500">Draft not initialized.</div>}
            {draft && (
              <>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                  <input className={INPUT_CLASS} value={draft.id} onChange={(event) => updateDraft({ id: event.target.value })} placeholder="id" />
                  <input className={INPUT_CLASS} value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} placeholder="name" />
                  <input className={INPUT_CLASS} value={draft.minAppVersion} onChange={(event) => updateDraft({ minAppVersion: event.target.value })} placeholder="minAppVersion" />
                </div>
                <textarea className={TEXTAREA_CLASS} value={draft.description} onChange={(event) => updateDraft({ description: event.target.value })} placeholder="description" />
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  <input className={INPUT_CLASS} value={draft.declarationName} onChange={(event) => updateDraft({ declarationName: event.target.value })} placeholder="declaration.name" />
                  <input className={INPUT_CLASS} value={draft.targetSkill} onChange={(event) => updateDraft({ targetSkill: event.target.value })} placeholder="runtime.targetSkill" />
                </div>
                <textarea className={TEXTAREA_CLASS} value={draft.declarationDescription} onChange={(event) => updateDraft({ declarationDescription: event.target.value })} placeholder="declaration.description" />
                <textarea className="min-h-[180px] w-full rounded-lg border border-white/10 bg-zinc-900 p-3 font-mono text-xs text-white focus:border-emerald-500 focus:outline-none" value={draft.parametersJson} onChange={(event) => updateDraft({ parametersJson: event.target.value })} spellCheck={false} placeholder="declaration.parameters JSON" />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-950">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">Validation and Invocation Preview</h2>
              <Button onClick={handleRunInvocationPreview} className="gap-2">
                <PackageCheck className="h-4 w-4" />
                Test Preview
              </Button>
            </div>
            <div className={`rounded-lg border px-3 py-2 text-xs ${localIssues.length === 0 ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-red-500/20 bg-red-500/10 text-red-300'}`}>
              {localIssues.length === 0 ? 'Local validation passed.' : `${localIssues.length} local issues.`}
            </div>
            {localIssues.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-300">
                {localIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            )}
            <textarea className="min-h-[130px] w-full rounded-lg border border-white/10 bg-zinc-900 p-3 font-mono text-xs text-zinc-200 focus:outline-none" value={invocationPayloadText} onChange={(event) => setInvocationPayloadText(event.target.value)} spellCheck={false} />
            {invocationPreview && (
              <div className="rounded-lg border border-white/10 bg-zinc-900/40 p-3 text-xs text-zinc-300">
                <div className={invocationPreview.readiness === 'ready' ? 'text-emerald-300' : 'text-amber-300'}>
                  preview status: {invocationPreview.readiness}
                </div>
                <div>required keys: {invocationPreview.requiredKeys.join(', ') || '-'}</div>
                <div>payload keys: {invocationPreview.payloadKeys.join(', ') || '-'}</div>
                <div>missing keys: {invocationPreview.missingRequiredKeys.join(', ') || '-'}</div>
                <div>generatedAt: {formatTime(invocationPreview.generatedAt)}</div>
                {invocationPreview.warnings.length > 0 && (
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-amber-300">
                    {invocationPreview.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="border-t border-white/10 pt-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">DeepSeek Live Invocation Preview</h3>
                <Button
                  onClick={() => void handleRunLiveModelPreview()}
                  disabled={isRunningLiveModelPreview}
                  className="gap-2"
                >
                  {isRunningLiveModelPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                  Run Live Preview
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">model</label>
                  <input className={INPUT_CLASS} value={liveModelName} onChange={(event) => setLiveModelName(event.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">temperature</label>
                  <input className={INPUT_CLASS} value={liveTemperature} onChange={(event) => setLiveTemperature(event.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">maxTokens</label>
                  <input className={INPUT_CLASS} value={liveMaxTokens} onChange={(event) => setLiveMaxTokens(event.target.value)} />
                </div>
              </div>
              {liveModelResult && (
                <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-zinc-200">
                  <div className="font-semibold text-emerald-300">
                    provider={liveModelResult.provider}, model={liveModelResult.model}, latency={liveModelResult.latencyMs}ms
                  </div>
                  <div className="mt-2 text-zinc-400">
                    usage: {JSON.stringify(liveModelResult.usage)}
                  </div>
                  <div className="mt-2">
                    invocation target: {liveModelResult.invocation.targetSkill || '-'} | missing required:
                    {' '}
                    {liveModelResult.invocation.missingRequiredKeys.join(', ') || 'none'}
                  </div>
                  <div className="mt-2 whitespace-pre-wrap rounded border border-white/10 bg-black/20 p-2">
                    {liveModelResult.output.content}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-800 bg-zinc-950">
        <CardContent className="p-4">
          <h2 className="mb-2 text-sm font-semibold text-white">Manifest Preview</h2>
          <textarea readOnly className="min-h-[240px] w-full rounded-lg border border-white/10 bg-zinc-900 p-3 font-mono text-xs text-zinc-200 focus:outline-none" value={manifestPreview} spellCheck={false} />
        </CardContent>
      </Card>
    </div>
  );
}

export function SkillManagePage() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [revisions, setRevisions] = useState<CatalogRevision[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [diffFromVersion, setDiffFromVersion] = useState('');
  const [diffToVersion, setDiffToVersion] = useState('');
  const [diffResult, setDiffResult] = useState<ManifestDiffResult | null>(null);
  const [releaseHistory, setReleaseHistory] = useState<ReleaseRecord[]>([]);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [isLoadingRevisions, setIsLoadingRevisions] = useState(false);
  const [isDiffing, setIsDiffing] = useState(false);

  const selectedRevision = useMemo(
    () => revisions.find((revision) => revision.version === selectedVersion) || null,
    [revisions, selectedVersion],
  );
  const qualityDraft = useMemo(
    () => (selectedRevision ? toSkillManifestDraft(selectedRevision.manifest || {}, selectedItemId) : null),
    [selectedItemId, selectedRevision],
  );
  const qualityIssues = useMemo(() => getSkillDraftIssues(qualityDraft), [qualityDraft]);

  async function loadEntries(preferredItemId?: string) {
    setIsLoadingEntries(true);
    try {
      const response = await listCatalogEntries('skill', { limit: 100 });
      const nextEntries = [...response.data].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setEntries(nextEntries);
      const keepCurrent = selectedItemId && nextEntries.some((entry) => entry.itemId === selectedItemId);
      setSelectedItemId(preferredItemId || (keepCurrent ? selectedItemId : nextEntries[0]?.itemId || ''));
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsLoadingEntries(false);
    }
  }

  async function loadRevisions(itemId: string, preferredVersion?: string) {
    if (!itemId) {
      setRevisions([]);
      setSelectedVersion('');
      return;
    }
    setIsLoadingRevisions(true);
    try {
      const response = await listCatalogRevisions('skill', itemId, { limit: 100 });
      const nextRevisions = [...response.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setRevisions(nextRevisions);
      const nextVersion = preferredVersion || nextRevisions[0]?.version || '';
      setSelectedVersion(nextVersion);
      setDiffToVersion(nextVersion);
      setDiffFromVersion(nextRevisions[1]?.version || nextVersion);
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsLoadingRevisions(false);
    }
  }

  async function loadHistory() {
    try {
      const response = await listReleaseHistory({ domain: 'skill', limit: 50 });
      setReleaseHistory([...response.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    }
  }

  async function handleDiff() {
    if (!selectedItemId || !diffFromVersion || !diffToVersion) {
      setFeedback({ tone: 'error', message: 'Select item and diff versions.' });
      return;
    }
    setIsDiffing(true);
    try {
      const result = await getCatalogRevisionDiff('skill', selectedItemId, diffFromVersion, diffToVersion);
      setDiffResult(result);
      setFeedback({ tone: 'info', message: `Loaded diff ${diffFromVersion} -> ${diffToVersion}.` });
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsDiffing(false);
    }
  }

  useEffect(() => {
    void loadEntries();
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedItemId) {
      return;
    }
    void loadRevisions(selectedItemId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemId]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4">
      <WorkspaceHeader title="Skill Studio / Manage" description="Compare revisions and inspect declaration/runtime quality." />
      <DomainStageTabs basePath={BASE_PATH} activeStage="manage" />
      {feedback && <FeedbackBanner feedback={feedback} />}

      <Card className="border-zinc-800 bg-zinc-950">
        <CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Select value={selectedItemId || ''} onChange={(value) => setSelectedItemId(value)} options={toEntryOptions(entries).length > 0 ? toEntryOptions(entries) : [{ value: '', label: 'No item' }]} />
            <Select value={selectedVersion || ''} onChange={(value) => setSelectedVersion(value)} options={toRevisionOptions(revisions).length > 0 ? toRevisionOptions(revisions) : [{ value: '', label: 'No revision' }]} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={() => void loadEntries(selectedItemId || undefined)} disabled={isLoadingEntries}>
              {isLoadingEntries ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </Button>
            {isLoadingRevisions && (
              <div className="flex items-center gap-1 text-xs text-zinc-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                loading revisions...
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-950">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">Diff</h2>
              <Button variant="outline" size="sm" onClick={() => void handleDiff()} disabled={isDiffing} className="gap-1">
                {isDiffing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitCompare className="h-3.5 w-3.5" />}
                Run
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <Select value={diffFromVersion || ''} onChange={(value) => setDiffFromVersion(value)} options={toRevisionOptions(revisions).length > 0 ? toRevisionOptions(revisions) : [{ value: '', label: 'No revision' }]} />
              <Select value={diffToVersion || ''} onChange={(value) => setDiffToVersion(value)} options={toRevisionOptions(revisions).length > 0 ? toRevisionOptions(revisions) : [{ value: '', label: 'No revision' }]} />
            </div>
            {!diffResult && <div className="text-xs text-zinc-500">Run diff to inspect manifest changes.</div>}
            {diffResult && (
              <div className="rounded-lg border border-white/10 bg-zinc-900/40 p-3 text-xs text-zinc-300">
                <div>totalChanges: {diffResult.diff.summary.totalChanges}</div>
                <div>added: {diffResult.diff.summary.addedCount}</div>
                <div>removed: {diffResult.diff.summary.removedCount}</div>
                <div>changed: {diffResult.diff.summary.changedCount}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-950">
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-white">Manifest Inspector</h2>
            <textarea
              readOnly
              value={selectedRevision ? JSON.stringify(selectedRevision.manifest || {}, null, 2) : ''}
              spellCheck={false}
              className="min-h-[220px] w-full rounded-lg border border-white/10 bg-zinc-900 p-3 font-mono text-xs text-zinc-200 focus:outline-none"
            />
            <div className={`rounded-lg border px-3 py-2 text-xs ${qualityIssues.length === 0 ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-red-500/20 bg-red-500/10 text-red-300'}`}>
              {qualityIssues.length === 0 ? 'Quality checks passed.' : `${qualityIssues.length} quality issues.`}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-800 bg-zinc-950">
        <CardContent className="space-y-2 p-4">
          <h2 className="text-sm font-semibold text-white">Release History</h2>
          {releaseHistory.length === 0 && <div className="text-xs text-zinc-500">No release records.</div>}
          {releaseHistory.slice(0, 20).map((record) => (
            <div key={record.id} className="rounded-lg border border-white/10 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={record.action === 'publish' ? 'text-emerald-300' : 'text-amber-300'}>
                  {record.action}
                </span>
                <span>{formatTime(record.createdAt)}</span>
              </div>
              <div>
                {record.itemId}: {record.fromVersion || '-'} {'->'} {record.toVersion} ({record.channel})
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function SkillPublishPage() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [revisions, setRevisions] = useState<CatalogRevision[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [publishChannel, setPublishChannel] = useState<CatalogChannel>('internal');
  const [rollbackVersion, setRollbackVersion] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [releaseHistory, setReleaseHistory] = useState<ReleaseRecord[]>([]);

  const [validationType, setValidationType] = useState<ValidationRunType>('catalog_validate');
  const [validationRun, setValidationRun] = useState<ValidationRunRecord | null>(null);
  const [validationLookupRunId, setValidationLookupRunId] = useState('');

  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [isLoadingRevisions, setIsLoadingRevisions] = useState(false);
  const [isRunningValidation, setIsRunningValidation] = useState(false);
  const [isFetchingValidation, setIsFetchingValidation] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRollbacking, setIsRollbacking] = useState(false);

  const selectedRevision = useMemo(
    () => revisions.find((revision) => revision.version === selectedVersion) || null,
    [revisions, selectedVersion],
  );
  const validationChecks = useMemo(() => getValidationChecks(validationRun), [validationRun]);
  const publishGatePassed = useMemo(
    () => !!validationRun && validationRun.status === 'succeeded' && !hasValidationFailure(validationRun),
    [validationRun],
  );

  async function loadEntries(preferredItemId?: string) {
    setIsLoadingEntries(true);
    try {
      const response = await listCatalogEntries('skill', { limit: 100 });
      const nextEntries = [...response.data].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setEntries(nextEntries);
      const keepCurrent = selectedItemId && nextEntries.some((entry) => entry.itemId === selectedItemId);
      setSelectedItemId(preferredItemId || (keepCurrent ? selectedItemId : nextEntries[0]?.itemId || ''));
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsLoadingEntries(false);
    }
  }

  async function loadRevisions(itemId: string, preferredVersion?: string) {
    if (!itemId) {
      setRevisions([]);
      setSelectedVersion('');
      setRollbackVersion('');
      return;
    }
    setIsLoadingRevisions(true);
    try {
      const response = await listCatalogRevisions('skill', itemId, { limit: 100 });
      const nextRevisions = [...response.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setRevisions(nextRevisions);
      const nextVersion = preferredVersion || nextRevisions[0]?.version || '';
      setSelectedVersion(nextVersion);
      const active = nextRevisions.find((item) => item.version === nextVersion) || nextRevisions[0] || null;
      if (active) {
        setPublishChannel(active.channel);
      }
      const rollbackCandidate = nextRevisions
        .filter((item) => item.status === 'published')
        .find((item) => item.version !== nextVersion)?.version || '';
      setRollbackVersion(rollbackCandidate);
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsLoadingRevisions(false);
    }
  }

  async function loadHistory() {
    try {
      const response = await listReleaseHistory({ domain: 'skill', limit: 50 });
      setReleaseHistory([...response.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    }
  }

  async function handleRunValidation() {
    if (!selectedItemId || !selectedVersion) {
      setFeedback({ tone: 'error', message: 'Select item and revision before validation.' });
      return;
    }
    setIsRunningValidation(true);
    try {
      const created = await runCatalogValidation({
        domain: 'skill',
        itemId: selectedItemId,
        version: selectedVersion,
        runType: validationType,
      });
      setValidationRun(created);
      setValidationLookupRunId(created.id);
      setFeedback({ tone: 'info', message: `Validation started: ${created.id} (${created.status}).` });
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsRunningValidation(false);
    }
  }

  async function handleFetchValidationRun() {
    const runId = asText(validationLookupRunId);
    if (!runId) {
      setFeedback({ tone: 'error', message: 'Provide runId first.' });
      return;
    }
    setIsFetchingValidation(true);
    try {
      const record = await getValidationRun(runId);
      setValidationRun(record);
      setFeedback({
        tone: record.status === 'succeeded' && !hasValidationFailure(record) ? 'success' : 'info',
        message: `Validation run ${record.id}: ${record.status}.`,
      });
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsFetchingValidation(false);
    }
  }

  async function handlePublish() {
    if (!selectedItemId || !selectedVersion) {
      setFeedback({ tone: 'error', message: 'Select item and revision before publish.' });
      return;
    }
    if (!publishGatePassed) {
      setFeedback({ tone: 'error', message: 'Publish gate blocked: validation not passed.' });
      return;
    }
    setIsPublishing(true);
    try {
      await publishCatalogRevision('skill', selectedItemId, {
        version: selectedVersion,
        channel: publishChannel,
        validationRunId: validationRun?.id || undefined,
      });
      setFeedback({
        tone: 'success',
        message: `Published ${selectedItemId}@${selectedVersion} to ${publishChannel}.`,
      });
      await loadRevisions(selectedItemId, selectedVersion);
      await loadHistory();
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleRollback() {
    if (!selectedItemId || !rollbackVersion) {
      setFeedback({ tone: 'error', message: 'Select rollback target version.' });
      return;
    }
    setIsRollbacking(true);
    try {
      await rollbackCatalogRevision('skill', selectedItemId, {
        targetVersion: rollbackVersion,
        channel: publishChannel,
        validationRunId: validationRun?.id || undefined,
      });
      setFeedback({ tone: 'success', message: `Rollback submitted: ${selectedItemId} -> ${rollbackVersion}.` });
      await loadRevisions(selectedItemId, rollbackVersion);
      await loadHistory();
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsRollbacking(false);
    }
  }

  useEffect(() => {
    void loadEntries();
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedItemId) {
      return;
    }
    void loadRevisions(selectedItemId);
    setValidationRun(null);
    setValidationLookupRunId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemId]);

  const rollbackOptions = revisions
    .filter((revision) => revision.status === 'published')
    .map((revision) => ({ value: revision.version, label: revision.version }));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4">
      <WorkspaceHeader title="Skill Studio / Publish" description="Run validation gate, publish, and rollback safely." />
      <DomainStageTabs basePath={BASE_PATH} activeStage="publish" />
      {feedback && <FeedbackBanner feedback={feedback} />}

      <Card className="border-zinc-800 bg-zinc-950">
        <CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Skill Item</label>
              <Select value={selectedItemId || ''} onChange={(value) => setSelectedItemId(value)} options={toEntryOptions(entries).length > 0 ? toEntryOptions(entries) : [{ value: '', label: 'No item' }]} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Revision</label>
              <Select value={selectedVersion || ''} onChange={(value) => setSelectedVersion(value)} options={toRevisionOptions(revisions).length > 0 ? toRevisionOptions(revisions) : [{ value: '', label: 'No revision' }]} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Channel</label>
              <Select value={publishChannel} onChange={(value) => setPublishChannel(value as CatalogChannel)} options={CHANNEL_OPTIONS} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={() => void loadEntries(selectedItemId || undefined)} disabled={isLoadingEntries}>
              {isLoadingEntries ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </Button>
            {isLoadingRevisions && (
              <div className="flex items-center gap-1 text-xs text-zinc-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                loading revisions...
              </div>
            )}
            {selectedRevision && (
              <div className="rounded-lg border border-white/10 bg-zinc-900/40 px-2 py-1 text-xs text-zinc-400">
                status={selectedRevision.status}, publishedAt={formatTime(selectedRevision.publishedAt)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-950">
        <CardContent className="space-y-3 p-4">
          <h2 className="text-sm font-semibold text-white">Validation Gate</h2>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
            <Select value={validationType} onChange={(value) => setValidationType(value as ValidationRunType)} options={VALIDATION_TYPE_OPTIONS} />
            <input className={`xl:col-span-2 ${INPUT_CLASS}`} value={validationLookupRunId} onChange={(event) => setValidationLookupRunId(event.target.value)} placeholder="validation run id" />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void handleRunValidation()} disabled={isRunningValidation || !selectedItemId || !selectedVersion} className="gap-2">
                {isRunningValidation ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Run
              </Button>
              <Button variant="outline" onClick={() => void handleFetchValidationRun()} disabled={isFetchingValidation} className="gap-2">
                {isFetchingValidation ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Fetch
              </Button>
            </div>
          </div>
          <div className={`rounded-lg border px-3 py-2 text-xs ${publishGatePassed ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-300'}`}>
            Publish Gate: {publishGatePassed ? 'Passed' : 'Blocked'}
          </div>
          {validationRun && (
            <div className="space-y-1 rounded-lg border border-white/10 bg-zinc-900/40 p-3 text-xs text-zinc-300">
              <div>runId={validationRun.id}, status={validationRun.status}</div>
              {validationChecks.length === 0 && <div className="text-zinc-500">No checks returned.</div>}
              {validationChecks.map((check, index) => (
                <div key={`${check.name}-${index}`}>
                  [{check.status}] {check.name}: {check.message}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-950">
        <CardContent className="space-y-3 p-4">
          <h2 className="text-sm font-semibold text-white">Publish and Rollback</h2>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
            <div className="xl:col-span-2">
              <Select value={rollbackVersion || ''} onChange={(value) => setRollbackVersion(value)} options={rollbackOptions.length > 0 ? rollbackOptions : [{ value: '', label: 'No published revision' }]} />
            </div>
            <Button onClick={() => void handlePublish()} disabled={!publishGatePassed || isPublishing || !selectedItemId || !selectedVersion} className="gap-2">
              {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Publish
            </Button>
            <Button variant="outline" onClick={() => void handleRollback()} disabled={isRollbacking || !selectedItemId || !rollbackVersion} className="gap-2">
              {isRollbacking ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
              Rollback
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-950">
        <CardContent className="space-y-2 p-4">
          <h2 className="text-sm font-semibold text-white">Release History</h2>
          {releaseHistory.length === 0 && <div className="text-xs text-zinc-500">No release records.</div>}
          {releaseHistory.slice(0, 20).map((record) => (
            <div key={record.id} className="rounded-lg border border-white/10 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={record.action === 'publish' ? 'text-emerald-300' : 'text-amber-300'}>
                  {record.action}
                </span>
                <span>{formatTime(record.createdAt)}</span>
              </div>
              <div>
                {record.itemId}: {record.fromVersion || '-'} {'->'} {record.toVersion} ({record.channel})
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
