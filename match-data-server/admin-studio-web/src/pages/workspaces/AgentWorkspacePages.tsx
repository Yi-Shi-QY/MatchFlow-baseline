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
  AgentModelPreviewResult,
  AdminStudioApiError,
  CatalogEntry,
  CatalogRevision,
  ManifestDiffResult,
  ReleaseRecord,
  ValidationRunRecord,
  createCatalogEntry,
  createCatalogRevision,
  getCatalogRevisionDiff,
  getValidationRun,
  listCatalogEntries,
  listCatalogRevisions,
  listReleaseHistory,
  previewAgentModelRun,
  publishCatalogRevision,
  rollbackCatalogRevision,
  runCatalogValidation,
  updateCatalogDraftRevision,
} from '@/src/services/adminStudio';

const BASE_PATH = '/app/agents';

const INPUT_CLASS =
  'w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none';
const TEXTAREA_CLASS =
  'min-h-[72px] w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none';

type FeedbackTone = 'success' | 'error' | 'info';
type CatalogChannel = 'internal' | 'beta' | 'stable';
type ValidationRunType = 'catalog_validate' | 'pre_publish' | 'post_publish';
type AgentDependencyMode = 'all' | 'none' | 'list';

interface FeedbackState {
  tone: FeedbackTone;
  message: string;
}

interface AgentManifestDraft {
  id: string;
  name: string;
  description: string;
  minAppVersion: string;
  rolePromptEn: string;
  rolePromptZh: string;
  skillsText: string;
  contextDependencyMode: AgentDependencyMode;
  contextDependenciesText: string;
}

interface ValidationCheck {
  name: string;
  status: string;
  message: string;
}

interface AgentTestPreview {
  generatedAt: string;
  readiness: 'ready' | 'incomplete';
  skills: string[];
  dependencyMode: AgentDependencyMode;
  dependencyList: string[];
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

const DEPENDENCY_MODE_OPTIONS: Array<{ value: AgentDependencyMode; label: string }> = [
  { value: 'all', label: 'all' },
  { value: 'none', label: 'none' },
  { value: 'list', label: 'list' },
];

const LOCALE_OPTIONS: Array<{ value: 'en' | 'zh'; label: string }> = [
  { value: 'en', label: 'en' },
  { value: 'zh', label: 'zh' },
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

function parseCsvText(text: string) {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function toCsvText(value: unknown) {
  if (!Array.isArray(value)) {
    return '';
  }
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .join(', ');
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

function buildEmptyAgentDraft(itemId: string): AgentManifestDraft {
  return {
    id: itemId || 'agent_item',
    name: 'Agent',
    description: 'Agent manifest managed from Admin Studio.',
    minAppVersion: '',
    rolePromptEn: '',
    rolePromptZh: '',
    skillsText: '',
    contextDependencyMode: 'all',
    contextDependenciesText: '',
  };
}

function toAgentManifestDraft(manifest: Record<string, unknown>, fallbackItemId: string): AgentManifestDraft {
  const rolePrompt = asRecord(manifest.rolePrompt);
  const contextDependencies = manifest.contextDependencies;
  let contextDependencyMode: AgentDependencyMode = 'all';
  let contextDependenciesText = '';
  if (contextDependencies === 'all' || contextDependencies === 'none') {
    contextDependencyMode = contextDependencies;
  } else if (Array.isArray(contextDependencies)) {
    contextDependencyMode = 'list';
    contextDependenciesText = contextDependencies
      .filter((item): item is string => typeof item === 'string')
      .join(', ');
  }
  return {
    id: asText(manifest.id) || fallbackItemId || 'agent_item',
    name: asText(manifest.name) || 'Agent',
    description: asText(manifest.description) || 'Agent manifest managed from Admin Studio.',
    minAppVersion: asText(manifest.minAppVersion),
    rolePromptEn: asText(rolePrompt.en),
    rolePromptZh: asText(rolePrompt.zh),
    skillsText: toCsvText(manifest.skills),
    contextDependencyMode,
    contextDependenciesText,
  };
}

function toAgentManifest(draft: AgentManifestDraft) {
  return {
    kind: 'agent',
    id: asText(draft.id),
    name: asText(draft.name),
    description: asText(draft.description),
    ...(asText(draft.minAppVersion) ? { minAppVersion: asText(draft.minAppVersion) } : {}),
    rolePrompt: {
      en: asText(draft.rolePromptEn),
      zh: asText(draft.rolePromptZh),
    },
    skills: parseCsvText(draft.skillsText),
    contextDependencies:
      draft.contextDependencyMode === 'list'
        ? parseCsvText(draft.contextDependenciesText)
        : draft.contextDependencyMode,
  };
}

function getAgentDraftIssues(draft: AgentManifestDraft | null) {
  if (!draft) {
    return ['Draft not initialized.'];
  }
  const issues: string[] = [];
  const skills = parseCsvText(draft.skillsText);
  const dependencies = parseCsvText(draft.contextDependenciesText);
  if (!asText(draft.id)) {
    issues.push('id is required.');
  }
  if (!asText(draft.name)) {
    issues.push('name is required.');
  }
  if (!asText(draft.rolePromptEn) && !asText(draft.rolePromptZh)) {
    issues.push('Provide rolePrompt.en or rolePrompt.zh.');
  }
  if (skills.length === 0) {
    issues.push('At least one skill is required.');
  }
  if (draft.contextDependencyMode === 'list' && dependencies.length === 0) {
    issues.push('contextDependencies is required when mode=list.');
  }
  if (dependencies.includes(asText(draft.id))) {
    issues.push('contextDependencies cannot include current id.');
  }
  return issues;
}

function buildAgentTestPreview(draft: AgentManifestDraft | null): AgentTestPreview | null {
  if (!draft) {
    return null;
  }
  const warnings: string[] = [];
  const skills = parseCsvText(draft.skillsText);
  const dependencyList = parseCsvText(draft.contextDependenciesText);
  if (skills.length === 0) {
    warnings.push('No linked skill.');
  }
  if (!asText(draft.rolePromptEn)) {
    warnings.push('rolePrompt.en is empty.');
  }
  if (!asText(draft.rolePromptZh)) {
    warnings.push('rolePrompt.zh is empty.');
  }
  if (draft.contextDependencyMode === 'list' && dependencyList.length === 0) {
    warnings.push('mode=list but contextDependencies is empty.');
  }
  return {
    generatedAt: new Date().toISOString(),
    readiness: warnings.length === 0 ? 'ready' : 'incomplete',
    skills,
    dependencyMode: draft.contextDependencyMode,
    dependencyList,
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

export function AgentDesignPage() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [revisions, setRevisions] = useState<CatalogRevision[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [draft, setDraft] = useState<AgentManifestDraft | null>(null);
  const [publishChannel, setPublishChannel] = useState<CatalogChannel>('internal');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [newItemId, setNewItemId] = useState('');
  const [newEntryVersion, setNewEntryVersion] = useState('1.0.0');
  const [newRevisionVersion, setNewRevisionVersion] = useState('1.0.1');

  const [testPreview, setTestPreview] = useState<AgentTestPreview | null>(null);
  const [liveModelResult, setLiveModelResult] = useState<AgentModelPreviewResult | null>(null);
  const [liveLocale, setLiveLocale] = useState<'en' | 'zh'>('en');
  const [liveInputText, setLiveInputText] = useState('Give me a concise match analysis summary.');
  const [liveContextText, setLiveContextText] = useState('{\n  "matchId": "demo_match_001"\n}');
  const [liveModelName, setLiveModelName] = useState('deepseek-chat');
  const [liveTemperature, setLiveTemperature] = useState('0.2');
  const [liveMaxTokens, setLiveMaxTokens] = useState('900');
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [isLoadingRevisions, setIsLoadingRevisions] = useState(false);
  const [isCreatingEntry, setIsCreatingEntry] = useState(false);
  const [isCreatingRevision, setIsCreatingRevision] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isRunningLiveModelTest, setIsRunningLiveModelTest] = useState(false);

  const selectedRevision = useMemo(
    () => revisions.find((revision) => revision.version === selectedVersion) || null,
    [revisions, selectedVersion],
  );

  const localIssues = useMemo(() => getAgentDraftIssues(draft), [draft]);
  const manifestPreview = useMemo(
    () => (draft ? JSON.stringify(toAgentManifest(draft), null, 2) : ''),
    [draft],
  );

  async function loadEntries(preferredItemId?: string) {
    setIsLoadingEntries(true);
    try {
      const response = await listCatalogEntries('agent', { limit: 100 });
      const nextEntries = [...response.data].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setEntries(nextEntries);
      const keepCurrent = selectedItemId && nextEntries.some((entry) => entry.itemId === selectedItemId);
      const nextItemId = preferredItemId || (keepCurrent ? selectedItemId : nextEntries[0]?.itemId || '');
      setSelectedItemId(nextItemId);
      if (!nextItemId) {
        setRevisions([]);
        setSelectedVersion('');
        setDraft(buildEmptyAgentDraft('agent_item'));
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
      setDraft(buildEmptyAgentDraft('agent_item'));
      return;
    }
    setIsLoadingRevisions(true);
    try {
      const response = await listCatalogRevisions('agent', itemId, { limit: 100 });
      const nextRevisions = [...response.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setRevisions(nextRevisions);
      const keepCurrent = selectedVersion && nextRevisions.some((item) => item.version === selectedVersion);
      const nextVersion = preferredVersion || (keepCurrent ? selectedVersion : nextRevisions[0]?.version || '');
      setSelectedVersion(nextVersion);
      const target = nextRevisions.find((item) => item.version === nextVersion) || null;
      if (target) {
        setDraft(toAgentManifestDraft(target.manifest || {}, itemId));
        setPublishChannel(target.channel);
      } else {
        setDraft(buildEmptyAgentDraft(itemId));
      }
      setTestPreview(null);
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

  function updateDraft(patch: Partial<AgentManifestDraft>) {
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
      await createCatalogEntry('agent', {
        itemId,
        version,
        channel: publishChannel,
        manifest: toAgentManifest({ ...(draft || buildEmptyAgentDraft(itemId)), id: itemId }),
      });
      setFeedback({ tone: 'success', message: `Created agent:${itemId}@${version}.` });
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
      await createCatalogRevision('agent', selectedItemId, {
        version,
        channel: publishChannel,
        manifest: toAgentManifest({ ...draft, id: selectedItemId }),
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
      await updateCatalogDraftRevision('agent', selectedItemId, selectedVersion, {
        channel: publishChannel,
        manifest: toAgentManifest({ ...draft, id: selectedItemId }),
      });
      setFeedback({ tone: 'success', message: `Draft saved: ${selectedItemId}@${selectedVersion}.` });
      await loadRevisions(selectedItemId, selectedVersion);
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsSavingDraft(false);
    }
  }

  function handleRunPreview() {
    const preview = buildAgentTestPreview(draft);
    setTestPreview(preview);
    setFeedback({
      tone: preview && preview.readiness === 'ready' ? 'success' : 'info',
      message: preview ? `Test preview generated (${preview.readiness}).` : 'Draft unavailable.',
    });
  }

  async function handleRunLiveModelTest() {
    if (!draft) {
      setFeedback({ tone: 'error', message: 'Draft not initialized.' });
      return;
    }

    setIsRunningLiveModelTest(true);
    try {
      const context = parseJsonObjectText(liveContextText, 'Live context');
      const result = await previewAgentModelRun({
        manifest: toAgentManifest(draft),
        locale: liveLocale,
        input: liveInputText,
        context,
        model: asText(liveModelName) || undefined,
        temperature: parseOptionalFloat(liveTemperature),
        maxTokens: parseOptionalInteger(liveMaxTokens),
      });
      setLiveModelResult(result);
      setFeedback({
        tone: 'success',
        message: `DeepSeek live test completed in ${result.latencyMs}ms (${result.model}).`,
      });
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsRunningLiveModelTest(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4">
      <WorkspaceHeader
        title="Agent Studio / Design"
        description="Edit prompts and dependencies, then run local test preview before server-side validation."
      />
      <DomainStageTabs basePath={BASE_PATH} activeStage="design" />
      {feedback && <FeedbackBanner feedback={feedback} />}

      <Card className="border-zinc-800 bg-zinc-950">
        <CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Agent Item</label>
              <Select
                value={selectedItemId || ''}
                onChange={(value) => setSelectedItemId(value)}
                options={toEntryOptions(entries).length > 0 ? toEntryOptions(entries) : [{ value: '', label: 'No item' }]}
              />
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Revision</label>
              <Select
                value={selectedVersion || ''}
                onChange={(value) => setSelectedVersion(value)}
                options={toRevisionOptions(revisions).length > 0 ? toRevisionOptions(revisions) : [{ value: '', label: 'No revision' }]}
              />
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
                  <textarea className="min-h-[120px] w-full rounded-lg border border-white/10 bg-zinc-900 p-3 text-xs text-white focus:border-emerald-500 focus:outline-none" value={draft.rolePromptEn} onChange={(event) => updateDraft({ rolePromptEn: event.target.value })} placeholder="rolePrompt.en" />
                  <textarea className="min-h-[120px] w-full rounded-lg border border-white/10 bg-zinc-900 p-3 text-xs text-white focus:border-emerald-500 focus:outline-none" value={draft.rolePromptZh} onChange={(event) => updateDraft({ rolePromptZh: event.target.value })} placeholder="rolePrompt.zh" />
                </div>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                  <input className={`xl:col-span-2 ${INPUT_CLASS}`} value={draft.skillsText} onChange={(event) => updateDraft({ skillsText: event.target.value })} placeholder="skills (csv)" />
                  <Select value={draft.contextDependencyMode} onChange={(value) => updateDraft({ contextDependencyMode: value as AgentDependencyMode })} options={DEPENDENCY_MODE_OPTIONS} />
                </div>
                {draft.contextDependencyMode === 'list' && (
                  <input className={INPUT_CLASS} value={draft.contextDependenciesText} onChange={(event) => updateDraft({ contextDependenciesText: event.target.value })} placeholder="contextDependencies (csv)" />
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-950">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">Validation and Preview</h2>
              <Button onClick={handleRunPreview} className="gap-2">
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
            {testPreview && (
              <div className="rounded-lg border border-white/10 bg-zinc-900/40 p-3 text-xs text-zinc-300">
                <div className={testPreview.readiness === 'ready' ? 'text-emerald-300' : 'text-amber-300'}>
                  preview status: {testPreview.readiness}
                </div>
                <div>skills: {testPreview.skills.join(', ') || '-'}</div>
                <div>
                  context: {testPreview.dependencyMode}
                  {testPreview.dependencyMode === 'list' ? ` (${testPreview.dependencyList.join(', ') || '-'})` : ''}
                </div>
                <div>generatedAt: {formatTime(testPreview.generatedAt)}</div>
                {testPreview.warnings.length > 0 && (
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-amber-300">
                    {testPreview.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="border-t border-white/10 pt-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">DeepSeek Live Test</h3>
                <Button
                  onClick={() => void handleRunLiveModelTest()}
                  disabled={isRunningLiveModelTest}
                  className="gap-2"
                >
                  {isRunningLiveModelTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                  Run Live Test
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">locale</label>
                  <Select value={liveLocale} onChange={(value) => setLiveLocale(value as 'en' | 'zh')} options={LOCALE_OPTIONS} />
                </div>
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
              <div className="mt-3 space-y-2">
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">test input</label>
                  <textarea className={TEXTAREA_CLASS} value={liveInputText} onChange={(event) => setLiveInputText(event.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">context json</label>
                  <textarea
                    className="min-h-[120px] w-full rounded-lg border border-white/10 bg-zinc-900 p-3 font-mono text-xs text-zinc-200 focus:outline-none"
                    value={liveContextText}
                    onChange={(event) => setLiveContextText(event.target.value)}
                    spellCheck={false}
                  />
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

export function AgentManagePage() {
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
    () => (selectedRevision ? toAgentManifestDraft(selectedRevision.manifest || {}, selectedItemId) : null),
    [selectedItemId, selectedRevision],
  );
  const qualityIssues = useMemo(() => getAgentDraftIssues(qualityDraft), [qualityDraft]);

  async function loadEntries(preferredItemId?: string) {
    setIsLoadingEntries(true);
    try {
      const response = await listCatalogEntries('agent', { limit: 100 });
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
      const response = await listCatalogRevisions('agent', itemId, { limit: 100 });
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
      const response = await listReleaseHistory({ domain: 'agent', limit: 50 });
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
      const result = await getCatalogRevisionDiff('agent', selectedItemId, diffFromVersion, diffToVersion);
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
      <WorkspaceHeader title="Agent Studio / Manage" description="Compare revisions and inspect release/change quality." />
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

export function AgentPublishPage() {
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
      const response = await listCatalogEntries('agent', { limit: 100 });
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
      const response = await listCatalogRevisions('agent', itemId, { limit: 100 });
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
      const response = await listReleaseHistory({ domain: 'agent', limit: 50 });
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
        domain: 'agent',
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
      await publishCatalogRevision('agent', selectedItemId, {
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
      await rollbackCatalogRevision('agent', selectedItemId, {
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
      <WorkspaceHeader title="Agent Studio / Publish" description="Run validation gate, publish, and rollback safely." />
      <DomainStageTabs basePath={BASE_PATH} activeStage="publish" />
      {feedback && <FeedbackBanner feedback={feedback} />}

      <Card className="border-zinc-800 bg-zinc-950">
        <CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Agent Item</label>
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
