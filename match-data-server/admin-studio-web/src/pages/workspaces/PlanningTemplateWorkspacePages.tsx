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
  ValidationRunRecord,
  createCatalogEntry,
  createCatalogRevision,
  getCatalogRevisionDiff,
  getValidationRun,
  listCatalogEntries,
  listCatalogRevisions,
  listReleaseHistory,
  publishCatalogRevision,
  rollbackCatalogRevision,
  runCatalogValidation,
  updateCatalogDraftRevision,
} from '@/src/services/adminStudio';

const BASE_PATH = '/app/planning-templates';

const INPUT_CLASS =
  'w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none';
const TEXTAREA_CLASS =
  'min-h-[68px] w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none';

type FeedbackTone = 'success' | 'error' | 'info';
type PlanningContextMode = 'independent' | 'build_upon' | 'all';
type CatalogChannel = 'internal' | 'beta' | 'stable';
type ValidationRunType = 'catalog_validate' | 'pre_publish' | 'post_publish';

interface FeedbackState {
  tone: FeedbackTone;
  message: string;
}

interface PlanningSegmentDraft {
  id: string;
  agentType: string;
  titleEn: string;
  titleZh: string;
  focusEn: string;
  focusZh: string;
  contextMode: PlanningContextMode;
  animationType: string;
}

interface PlanningTemplateDraft {
  id: string;
  name: string;
  rule: string;
  requiredAgentsText: string;
  requiredSkillsText: string;
  segments: PlanningSegmentDraft[];
}

interface ValidationCheck {
  name: string;
  status: string;
  message: string;
}

interface PlanningTestPreview {
  generatedAt: string;
  requiredAgents: string[];
  requiredSkills: string[];
  segmentAgentTypes: string[];
  missingRequiredAgents: string[];
  contextFlowIssues: string[];
  segments: Array<{
    index: number;
    id: string;
    agentType: string;
    contextMode: PlanningContextMode;
    animationType: string;
    titlePreview: string;
    completeness: 'ready' | 'incomplete';
  }>;
}

const CHANNEL_OPTIONS: Array<{ value: CatalogChannel; label: string }> = [
  { value: 'internal', label: 'internal' },
  { value: 'beta', label: 'beta' },
  { value: 'stable', label: 'stable' },
];

const CONTEXT_MODE_OPTIONS: Array<{ value: PlanningContextMode; label: string }> = [
  { value: 'independent', label: 'independent' },
  { value: 'build_upon', label: 'build_upon' },
  { value: 'all', label: 'all' },
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

function buildDefaultPlanningSegment(index: number, contextMode: PlanningContextMode): PlanningSegmentDraft {
  return {
    id: `segment_${index + 1}`,
    agentType: '',
    titleEn: '',
    titleZh: '',
    focusEn: '',
    focusZh: '',
    contextMode,
    animationType: '',
  };
}

function buildEmptyPlanningDraft(itemId: string): PlanningTemplateDraft {
  return {
    id: itemId || 'planning_template_item',
    name: 'Planning Template',
    rule: '',
    requiredAgentsText: '',
    requiredSkillsText: '',
    segments: [buildDefaultPlanningSegment(0, 'independent')],
  };
}

function toPlanningTemplateDraft(manifest: Record<string, unknown>, fallbackItemId: string): PlanningTemplateDraft {
  const segmentCandidates = Array.isArray(manifest.segments) ? manifest.segments : [];
  const segments = segmentCandidates
    .map((segment, index) => {
      const segmentRecord = asRecord(segment);
      const title = asRecord(segmentRecord.title);
      const focus = asRecord(segmentRecord.focus);
      const contextModeRaw = asText(segmentRecord.contextMode);
      const contextMode: PlanningContextMode =
        contextModeRaw === 'independent' || contextModeRaw === 'build_upon' || contextModeRaw === 'all'
          ? contextModeRaw
          : index === 0
            ? 'independent'
            : 'build_upon';

      return {
        id: asText(segmentRecord.id) || `segment_${index + 1}`,
        agentType: asText(segmentRecord.agentType),
        titleEn: asText(title.en),
        titleZh: asText(title.zh),
        focusEn: asText(focus.en),
        focusZh: asText(focus.zh),
        contextMode,
        animationType: asText(segmentRecord.animationType),
      } satisfies PlanningSegmentDraft;
    })
    .filter((segment) => segment.id.length > 0);

  return {
    id: asText(manifest.id) || fallbackItemId || 'planning_template_item',
    name: asText(manifest.name) || 'Planning Template',
    rule: asText(manifest.rule),
    requiredAgentsText: toCsvText(manifest.requiredAgents),
    requiredSkillsText: toCsvText(manifest.requiredSkills),
    segments: segments.length > 0 ? segments : [buildDefaultPlanningSegment(0, 'independent')],
  };
}

function toPlanningTemplateManifest(draft: PlanningTemplateDraft) {
  return {
    id: asText(draft.id),
    name: asText(draft.name),
    rule: asText(draft.rule),
    requiredAgents: parseCsvText(draft.requiredAgentsText),
    requiredSkills: parseCsvText(draft.requiredSkillsText),
    segments: draft.segments.map((segment, index) => ({
      id: asText(segment.id) || `segment_${index + 1}`,
      agentType: asText(segment.agentType),
      title: {
        en: asText(segment.titleEn),
        zh: asText(segment.titleZh),
      },
      focus: {
        en: asText(segment.focusEn),
        zh: asText(segment.focusZh),
      },
      contextMode: segment.contextMode,
      ...(asText(segment.animationType) ? { animationType: asText(segment.animationType) } : {}),
    })),
  };
}

function getPlanningDraftIssues(draft: PlanningTemplateDraft | null) {
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
  if (draft.segments.length === 0) {
    issues.push('At least one segment is required.');
  }

  const segmentIdSet = new Set<string>();
  draft.segments.forEach((segment, index) => {
    const segmentId = asText(segment.id);
    if (!segmentId) {
      issues.push(`segment[${index + 1}] id is required.`);
    } else if (segmentIdSet.has(segmentId)) {
      issues.push(`segment id duplicated: ${segmentId}`);
    } else {
      segmentIdSet.add(segmentId);
    }

    if (!asText(segment.agentType)) {
      issues.push(`segment[${index + 1}] agentType is required.`);
    }
    if (!asText(segment.titleEn) && !asText(segment.titleZh)) {
      issues.push(`segment[${index + 1}] title (EN or ZH) is required.`);
    }
    if (!asText(segment.focusEn) && !asText(segment.focusZh)) {
      issues.push(`segment[${index + 1}] focus (EN or ZH) is required.`);
    }
    if (index === 0 && segment.contextMode !== 'independent') {
      issues.push('segment[1] should use contextMode = independent.');
    }
  });

  const requiredAgents = parseCsvText(draft.requiredAgentsText);
  const segmentAgents = Array.from(new Set(
    draft.segments
      .map((segment) => asText(segment.agentType))
      .filter((agentType) => agentType.length > 0),
  ));
  const missingRequiredAgents = requiredAgents.filter((agent) => !segmentAgents.includes(agent));
  if (missingRequiredAgents.length > 0) {
    issues.push(`requiredAgents missing in segments: ${missingRequiredAgents.join(', ')}`);
  }

  return issues;
}

function buildPlanningTestPreview(draft: PlanningTemplateDraft | null): PlanningTestPreview | null {
  if (!draft) {
    return null;
  }

  const requiredAgents = parseCsvText(draft.requiredAgentsText);
  const requiredSkills = parseCsvText(draft.requiredSkillsText);
  const segmentAgentTypes = Array.from(new Set(
    draft.segments
      .map((segment) => asText(segment.agentType))
      .filter((agentType) => agentType.length > 0),
  ));
  const missingRequiredAgents = requiredAgents.filter((agent) => !segmentAgentTypes.includes(agent));

  const contextFlowIssues: string[] = [];
  if (draft.segments.length > 0 && draft.segments[0].contextMode !== 'independent') {
    contextFlowIssues.push('First segment should be independent for stable context bootstrap.');
  }
  draft.segments.forEach((segment, index) => {
    if (index > 0 && segment.contextMode === 'independent') {
      contextFlowIssues.push(`segment[${index + 1}] is independent; confirm if chain context is expected.`);
    }
  });

  const segments = draft.segments.map((segment, index) => {
    const titlePreview = asText(segment.titleZh) || asText(segment.titleEn) || '-';
    const focusPreview = asText(segment.focusZh) || asText(segment.focusEn);
    const isReady = (
      asText(segment.id).length > 0
      && asText(segment.agentType).length > 0
      && titlePreview.length > 0
      && focusPreview.length > 0
    );
    return {
      index: index + 1,
      id: asText(segment.id) || `segment_${index + 1}`,
      agentType: asText(segment.agentType),
      contextMode: segment.contextMode,
      animationType: asText(segment.animationType),
      titlePreview,
      completeness: isReady ? 'ready' : 'incomplete',
    } satisfies PlanningTestPreview['segments'][number];
  });

  return {
    generatedAt: new Date().toISOString(),
    requiredAgents,
    requiredSkills,
    segmentAgentTypes,
    missingRequiredAgents,
    contextFlowIssues,
    segments,
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

export function PlanningTemplateDesignPage() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [revisions, setRevisions] = useState<CatalogRevision[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [draft, setDraft] = useState<PlanningTemplateDraft | null>(null);
  const [publishChannel, setPublishChannel] = useState<CatalogChannel>('internal');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [newItemId, setNewItemId] = useState('');
  const [newEntryVersion, setNewEntryVersion] = useState('1.0.0');
  const [newRevisionVersion, setNewRevisionVersion] = useState('1.0.1');

  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [isLoadingRevisions, setIsLoadingRevisions] = useState(false);
  const [isCreatingEntry, setIsCreatingEntry] = useState(false);
  const [isCreatingRevision, setIsCreatingRevision] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isRunningPreview, setIsRunningPreview] = useState(false);
  const [testPreview, setTestPreview] = useState<PlanningTestPreview | null>(null);

  const selectedRevision = useMemo(
    () => revisions.find((revision) => revision.version === selectedVersion) || null,
    [revisions, selectedVersion],
  );

  const manifestPreview = useMemo(() => {
    if (!draft) {
      return '';
    }
    return JSON.stringify(toPlanningTemplateManifest(draft), null, 2);
  }, [draft]);

  const localIssues = useMemo(() => getPlanningDraftIssues(draft), [draft]);

  async function loadEntries(preferredItemId?: string) {
    setIsLoadingEntries(true);
    try {
      const response = await listCatalogEntries('planning_template', { limit: 100 });
      const nextEntries = [...response.data].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setEntries(nextEntries);

      const keepCurrent = selectedItemId && nextEntries.some((entry) => entry.itemId === selectedItemId);
      const nextItemId = preferredItemId || (keepCurrent ? selectedItemId : nextEntries[0]?.itemId || '');
      setSelectedItemId(nextItemId);

      if (!nextItemId) {
        setRevisions([]);
        setSelectedVersion('');
        setDraft(buildEmptyPlanningDraft('planning_template_item'));
        setTestPreview(null);
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
      setDraft(buildEmptyPlanningDraft('planning_template_item'));
      return;
    }

    setIsLoadingRevisions(true);
    try {
      const response = await listCatalogRevisions('planning_template', itemId, { limit: 100 });
      const nextRevisions = [...response.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setRevisions(nextRevisions);

      const keepCurrent = selectedVersion && nextRevisions.some((revision) => revision.version === selectedVersion);
      const nextVersion = preferredVersion || (keepCurrent ? selectedVersion : nextRevisions[0]?.version || '');
      setSelectedVersion(nextVersion);

      const revision = nextRevisions.find((item) => item.version === nextVersion) || null;
      if (revision) {
        setDraft(toPlanningTemplateDraft(revision.manifest || {}, itemId));
        setPublishChannel(revision.channel);
      } else {
        setDraft(buildEmptyPlanningDraft(itemId));
      }
      setTestPreview(null);
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

  function handleChangeVersion(version: string) {
    setSelectedVersion(version);
    const revision = revisions.find((item) => item.version === version) || null;
    if (revision) {
      setDraft(toPlanningTemplateDraft(revision.manifest || {}, selectedItemId));
      setPublishChannel(revision.channel);
      setTestPreview(null);
      setFeedback({
        tone: 'info',
        message: `Loaded ${selectedItemId}@${revision.version} (${revision.status})`,
      });
    }
  }

  function updateDraft(patch: Partial<PlanningTemplateDraft>) {
    setDraft((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        ...patch,
      };
    });
    setTestPreview(null);
  }

  function updateSegment(index: number, patch: Partial<PlanningSegmentDraft>) {
    setDraft((previous) => {
      if (!previous) {
        return previous;
      }
      const nextSegments = previous.segments.map((segment, segmentIndex) => (
        segmentIndex === index
          ? { ...segment, ...patch }
          : segment
      ));
      return {
        ...previous,
        segments: nextSegments,
      };
    });
    setTestPreview(null);
  }

  function addSegment() {
    setDraft((previous) => {
      if (!previous) {
        return previous;
      }
      const nextMode: PlanningContextMode = previous.segments.length === 0 ? 'independent' : 'build_upon';
      return {
        ...previous,
        segments: [
          ...previous.segments,
          buildDefaultPlanningSegment(previous.segments.length, nextMode),
        ],
      };
    });
    setTestPreview(null);
  }

  function removeSegment(index: number) {
    setDraft((previous) => {
      if (!previous) {
        return previous;
      }
      if (previous.segments.length <= 1) {
        return previous;
      }
      const nextSegments = previous.segments.filter((_, segmentIndex) => segmentIndex !== index);
      return {
        ...previous,
        segments: nextSegments,
      };
    });
    setTestPreview(null);
  }

  async function handleCreateEntry() {
    const itemId = newItemId.trim();
    const version = newEntryVersion.trim();
    if (!itemId || !version) {
      setFeedback({ tone: 'error', message: 'itemId and version are required to create a template entry.' });
      return;
    }

    setIsCreatingEntry(true);
    try {
      const starterDraft = buildEmptyPlanningDraft(itemId);
      await createCatalogEntry('planning_template', {
        itemId,
        version,
        manifest: toPlanningTemplateManifest(starterDraft),
        status: 'draft',
        channel: publishChannel,
      });

      setNewItemId('');
      setFeedback({ tone: 'success', message: `Created planning template ${itemId}@${version}.` });
      await loadEntries(itemId);
      await loadRevisions(itemId, version);
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsCreatingEntry(false);
    }
  }

  async function handleCreateRevision() {
    const version = newRevisionVersion.trim();
    if (!selectedItemId || !draft || !version) {
      setFeedback({ tone: 'error', message: 'Select an item and prepare draft content before creating revision.' });
      return;
    }

    setIsCreatingRevision(true);
    try {
      await createCatalogRevision('planning_template', selectedItemId, {
        version,
        manifest: toPlanningTemplateManifest(draft),
        status: 'draft',
        channel: publishChannel,
      });
      setNewRevisionVersion('');
      setFeedback({ tone: 'success', message: `Created draft revision ${selectedItemId}@${version}.` });
      await loadRevisions(selectedItemId, version);
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsCreatingRevision(false);
    }
  }

  async function handleSaveDraft() {
    if (!selectedItemId || !selectedVersion || !draft) {
      setFeedback({ tone: 'error', message: 'Select a revision first before saving.' });
      return;
    }

    setIsSavingDraft(true);
    try {
      await updateCatalogDraftRevision('planning_template', selectedItemId, selectedVersion, {
        manifest: toPlanningTemplateManifest(draft),
        channel: publishChannel,
      });
      setFeedback({
        tone: 'success',
        message: `Saved ${selectedItemId}@${selectedVersion} draft manifest.`,
      });
      await loadRevisions(selectedItemId, selectedVersion);
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function handleRunTestPreview() {
    if (!draft) {
      setFeedback({ tone: 'error', message: 'Select revision and edit draft before test preview.' });
      return;
    }

    const issues = getPlanningDraftIssues(draft);
    if (issues.length > 0) {
      setFeedback({ tone: 'error', message: `Fix local issues first: ${issues[0]}` });
      return;
    }

    setIsRunningPreview(true);
    try {
      const preview = buildPlanningTestPreview(draft);
      setTestPreview(preview);
      setFeedback({
        tone: preview && preview.missingRequiredAgents.length === 0 ? 'success' : 'info',
        message: preview
          ? `Test preview generated with ${preview.segments.length} segments.`
          : 'Failed to generate test preview.',
      });
    } finally {
      setIsRunningPreview(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4">
      <WorkspaceHeader
        title="Planning Template Studio / Design"
        description="Build planning-template manifests with structured segment editing and revision-safe draft operations."
      />
      <DomainStageTabs basePath={BASE_PATH} activeStage="design" />

      {feedback && <FeedbackBanner feedback={feedback} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="border-zinc-800 bg-zinc-950">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Template Catalog</h2>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => void loadEntries()}
                disabled={isLoadingEntries}
              >
                {isLoadingEntries ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Refresh
              </Button>
            </div>

            <div className="max-h-[280px] space-y-2 overflow-auto pr-1">
              {entries.length === 0 && (
                <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                  No planning template item exists yet.
                </div>
              )}
              {entries.map((entry) => {
                const active = selectedItemId === entry.itemId;
                return (
                  <button
                    type="button"
                    key={entry.itemId}
                    onClick={() => setSelectedItemId(entry.itemId)}
                    className={`w-full rounded-lg border p-3 text-left text-xs transition-colors ${
                      active
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                        : 'border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    <div className="font-mono">{entry.itemId}</div>
                    <div className="mt-1 text-[11px] text-zinc-500">
                      {entry.latestVersion} · {entry.latestStatus} · {entry.latestChannel}
                    </div>
                    <div className="mt-1 text-[10px] text-zinc-500">{formatTime(entry.updatedAt)}</div>
                  </button>
                );
              })}
            </div>

            <div className="rounded-lg border border-white/10 bg-zinc-900 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Create New Entry</h3>
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  value={newItemId}
                  onChange={(event) => setNewItemId(event.target.value)}
                  placeholder="itemId (e.g. football_pre_match)"
                  className={INPUT_CLASS}
                />
                <input
                  type="text"
                  value={newEntryVersion}
                  onChange={(event) => setNewEntryVersion(event.target.value)}
                  placeholder="version (e.g. 1.0.0)"
                  className={INPUT_CLASS}
                />
                <Button onClick={() => void handleCreateEntry()} disabled={isCreatingEntry} className="w-full gap-2">
                  {isCreatingEntry ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create Entry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <section className="space-y-4">
          <Card className="border-zinc-800 bg-zinc-950">
            <CardContent className="space-y-4 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Item</label>
                  <Select
                    value={selectedItemId || ''}
                    onChange={(value) => setSelectedItemId(value)}
                    options={
                      entries.length > 0
                        ? toEntryOptions(entries)
                        : [{ value: '', label: 'No item available' }]
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Revision</label>
                  <Select
                    value={selectedVersion || ''}
                    onChange={handleChangeVersion}
                    options={
                      revisions.length > 0
                        ? toRevisionOptions(revisions)
                        : [{ value: '', label: isLoadingRevisions ? 'Loading...' : 'No revision' }]
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Channel</label>
                  <Select
                    value={publishChannel}
                    onChange={(value) => setPublishChannel(value as CatalogChannel)}
                    options={CHANNEL_OPTIONS}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => void loadRevisions(selectedItemId)}
                  disabled={!selectedItemId || isLoadingRevisions}
                >
                  {isLoadingRevisions ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Reload Revisions
                </Button>
                <Button
                  className="gap-2"
                  onClick={() => void handleSaveDraft()}
                  disabled={!selectedItemId || !selectedVersion || !draft || isSavingDraft}
                >
                  {isSavingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Draft
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => void handleRunTestPreview()}
                  disabled={!draft || isRunningPreview}
                >
                  {isRunningPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Test Preview
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                <input
                  type="text"
                  value={newRevisionVersion}
                  onChange={(event) => setNewRevisionVersion(event.target.value)}
                  placeholder="new revision version (e.g. 1.0.1)"
                  className={INPUT_CLASS}
                />
                <Button
                  variant="outline"
                  className="gap-2 md:min-w-[170px]"
                  onClick={() => void handleCreateRevision()}
                  disabled={!selectedItemId || !draft || isCreatingRevision}
                >
                  {isCreatingRevision ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Create Revision
                </Button>
              </div>

              {selectedRevision && (
                <div className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-[11px] text-zinc-300">
                  <div className="flex flex-wrap gap-4">
                    <span>status: {selectedRevision.status}</span>
                    <span>channel: {selectedRevision.channel}</span>
                    <span>updated: {formatTime(selectedRevision.updatedAt)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {!draft && (
            <Card className="border-zinc-800 bg-zinc-950">
              <CardContent className="p-4 text-xs text-zinc-500">
                Select an item/revision to start design editing.
              </CardContent>
            </Card>
          )}

          {draft && (
            <Card className="border-zinc-800 bg-zinc-950">
              <CardContent className="space-y-4 p-4">
                <h2 className="text-sm font-semibold text-white">Manifest Draft Editor</h2>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Template ID</label>
                    <input
                      type="text"
                      value={draft.id}
                      onChange={(event) => updateDraft({ id: event.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Template Name</label>
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(event) => updateDraft({ name: event.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Planning Rule</label>
                  <textarea
                    value={draft.rule}
                    onChange={(event) => updateDraft({ rule: event.target.value })}
                    className={TEXTAREA_CLASS}
                    placeholder="rule or policy summary used by runtime planner"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">
                      Required Agents (CSV)
                    </label>
                    <input
                      type="text"
                      value={draft.requiredAgentsText}
                      onChange={(event) => updateDraft({ requiredAgentsText: event.target.value })}
                      className={INPUT_CLASS}
                      placeholder="summary_agent, odds_agent"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">
                      Required Skills (CSV)
                    </label>
                    <input
                      type="text"
                      value={draft.requiredSkillsText}
                      onChange={(event) => updateDraft({ requiredSkillsText: event.target.value })}
                      className={INPUT_CLASS}
                      placeholder="calc_risk, normalize_market"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Segments</h3>
                  <Button variant="outline" size="sm" className="gap-1" onClick={addSegment}>
                    <Plus className="h-3.5 w-3.5" />
                    Add Segment
                  </Button>
                </div>

                <div className="space-y-3">
                  {draft.segments.map((segment, index) => (
                    <div key={`${segment.id}-${index}`} className="rounded-lg border border-white/10 bg-zinc-900 p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-xs font-semibold text-zinc-200">segment #{index + 1}</div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-300 hover:text-red-200"
                          onClick={() => removeSegment(index)}
                          disabled={draft.segments.length <= 1}
                        >
                          Remove
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <div>
                          <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Segment ID</label>
                          <input
                            type="text"
                            value={segment.id}
                            onChange={(event) => updateSegment(index, { id: event.target.value })}
                            className={INPUT_CLASS}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Agent Type</label>
                          <input
                            type="text"
                            value={segment.agentType}
                            onChange={(event) => updateSegment(index, { agentType: event.target.value })}
                            className={INPUT_CLASS}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Animation Type</label>
                          <input
                            type="text"
                            value={segment.animationType}
                            onChange={(event) => updateSegment(index, { animationType: event.target.value })}
                            className={INPUT_CLASS}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Context Mode</label>
                          <Select
                            value={segment.contextMode}
                            onChange={(value) => updateSegment(index, { contextMode: value as PlanningContextMode })}
                            options={CONTEXT_MODE_OPTIONS}
                          />
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Title EN</label>
                          <input
                            type="text"
                            value={segment.titleEn}
                            onChange={(event) => updateSegment(index, { titleEn: event.target.value })}
                            className={INPUT_CLASS}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Title ZH</label>
                          <input
                            type="text"
                            value={segment.titleZh}
                            onChange={(event) => updateSegment(index, { titleZh: event.target.value })}
                            className={INPUT_CLASS}
                          />
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Focus EN</label>
                          <textarea
                            value={segment.focusEn}
                            onChange={(event) => updateSegment(index, { focusEn: event.target.value })}
                            className={TEXTAREA_CLASS}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Focus ZH</label>
                          <textarea
                            value={segment.focusZh}
                            onChange={(event) => updateSegment(index, { focusZh: event.target.value })}
                            className={TEXTAREA_CLASS}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-zinc-800 bg-zinc-950">
            <CardContent className="space-y-3 p-4">
              <h2 className="text-sm font-semibold text-white">Local Validation</h2>
              {localIssues.length === 0 && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="h-4 w-4" />
                    Draft local checks passed.
                  </span>
                </div>
              )}
              {localIssues.length > 0 && (
                <div className="space-y-2">
                  {localIssues.map((issue) => (
                    <div key={issue} className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                      {issue}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-950">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Test Preview</h2>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => void handleRunTestPreview()}
                  disabled={!draft || isRunningPreview}
                >
                  {isRunningPreview ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  Run
                </Button>
              </div>

              {!testPreview && (
                <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                  Edit draft then run test preview to inspect segment flow and dependency coverage.
                </div>
              )}

              {testPreview && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-[11px] text-zinc-300">
                    <div className="flex flex-wrap gap-4">
                      <span>generatedAt: {formatTime(testPreview.generatedAt)}</span>
                      <span>segments: {testPreview.segments.length}</span>
                      <span>requiredAgents: {testPreview.requiredAgents.length}</span>
                      <span>requiredSkills: {testPreview.requiredSkills.length}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-white/10 bg-zinc-900 p-3">
                      <div className="mb-2 text-xs font-semibold text-zinc-300">Agent Coverage</div>
                      <div className="text-[11px] text-zinc-400">
                        Segment agents: {testPreview.segmentAgentTypes.join(', ') || '-'}
                      </div>
                      <div className={`mt-2 text-[11px] ${
                        testPreview.missingRequiredAgents.length > 0 ? 'text-red-300' : 'text-emerald-300'
                      }`}>
                        Missing required agents: {testPreview.missingRequiredAgents.join(', ') || 'none'}
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-zinc-900 p-3">
                      <div className="mb-2 text-xs font-semibold text-zinc-300">Context Flow</div>
                      {testPreview.contextFlowIssues.length === 0 && (
                        <div className="text-[11px] text-emerald-300">No flow warning.</div>
                      )}
                      {testPreview.contextFlowIssues.length > 0 && (
                        <div className="space-y-1 text-[11px] text-amber-300">
                          {testPreview.contextFlowIssues.map((issue) => (
                            <div key={issue}>{issue}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-zinc-900 p-3">
                    <div className="mb-2 text-xs font-semibold text-zinc-300">Segment Sequence Preview</div>
                    <div className="space-y-2">
                      {testPreview.segments.map((segment) => (
                        <div key={`${segment.id}-${segment.index}`} className="rounded border border-white/10 bg-zinc-950 px-3 py-2 text-[11px] text-zinc-300">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="font-mono">#{segment.index} {segment.id}</span>
                            <span className="text-zinc-400">agent: {segment.agentType || '-'}</span>
                            <span className="text-zinc-400">context: {segment.contextMode}</span>
                            <span className="text-zinc-400">animation: {segment.animationType || '-'}</span>
                            <span className={segment.completeness === 'ready' ? 'text-emerald-300' : 'text-amber-300'}>
                              {segment.completeness}
                            </span>
                          </div>
                          <div className="mt-1 text-zinc-400">title: {segment.titlePreview || '-'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-950">
            <CardContent className="space-y-3 p-4">
              <h2 className="text-sm font-semibold text-white">Manifest Preview</h2>
              <pre className="max-h-[320px] overflow-auto rounded-lg border border-white/10 bg-zinc-900 p-3 text-[11px] text-zinc-300">
                {manifestPreview || '// no draft selected'}
              </pre>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

export function PlanningTemplateManagePage() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [revisions, setRevisions] = useState<CatalogRevision[]>([]);
  const [releaseHistory, setReleaseHistory] = useState<ReleaseRecord[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [fromVersion, setFromVersion] = useState('');
  const [toVersion, setToVersion] = useState('');
  const [diffResult, setDiffResult] = useState<ManifestDiffResult | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [isLoadingRevisions, setIsLoadingRevisions] = useState(false);
  const [isDiffLoading, setIsDiffLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const inspectRevision = useMemo(
    () => revisions.find((revision) => revision.version === toVersion) || null,
    [revisions, toVersion],
  );

  async function refreshEntries(preferredItemId?: string) {
    setIsLoadingEntries(true);
    try {
      const response = await listCatalogEntries('planning_template', { limit: 100 });
      const nextEntries = [...response.data].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setEntries(nextEntries);

      const keepCurrent = selectedItemId && nextEntries.some((entry) => entry.itemId === selectedItemId);
      const nextItemId = preferredItemId || (keepCurrent ? selectedItemId : nextEntries[0]?.itemId || '');
      setSelectedItemId(nextItemId);

      if (!nextItemId) {
        setRevisions([]);
        setFromVersion('');
        setToVersion('');
      }
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsLoadingEntries(false);
    }
  }

  async function refreshRevisions(itemId: string) {
    if (!itemId) {
      setRevisions([]);
      setFromVersion('');
      setToVersion('');
      return;
    }

    setIsLoadingRevisions(true);
    try {
      const response = await listCatalogRevisions('planning_template', itemId, { limit: 100 });
      const nextRevisions = [...response.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setRevisions(nextRevisions);

      const latest = nextRevisions[0]?.version || '';
      const previous = nextRevisions[1]?.version || latest;
      setToVersion((current) => current || latest);
      setFromVersion((current) => current || previous);
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsLoadingRevisions(false);
    }
  }

  async function refreshHistory() {
    setIsHistoryLoading(true);
    try {
      const response = await listReleaseHistory({
        domain: 'planning_template',
        limit: 80,
      });
      setReleaseHistory(response.data);
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsHistoryLoading(false);
    }
  }

  useEffect(() => {
    void refreshEntries();
    void refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedItemId) {
      return;
    }
    void refreshRevisions(selectedItemId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemId]);

  async function handleLoadDiff() {
    if (!selectedItemId || !fromVersion || !toVersion) {
      setFeedback({ tone: 'error', message: 'Select item and two revisions before loading diff.' });
      return;
    }
    if (fromVersion === toVersion) {
      setFeedback({ tone: 'error', message: 'fromVersion and toVersion should be different.' });
      return;
    }

    setIsDiffLoading(true);
    try {
      const diff = await getCatalogRevisionDiff('planning_template', selectedItemId, fromVersion, toVersion);
      setDiffResult(diff);
      setFeedback({
        tone: 'info',
        message: `Loaded diff ${selectedItemId}: ${fromVersion} -> ${toVersion}.`,
      });
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
      setDiffResult(null);
    } finally {
      setIsDiffLoading(false);
    }
  }

  const filteredHistory = useMemo(() => (
    selectedItemId
      ? releaseHistory.filter((record) => record.itemId === selectedItemId)
      : releaseHistory
  ), [releaseHistory, selectedItemId]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4">
      <WorkspaceHeader
        title="Planning Template Studio / Manage"
        description="Inspect revisions, compare manifest diffs, and track release records for planning templates."
      />
      <DomainStageTabs basePath={BASE_PATH} activeStage="manage" />

      {feedback && <FeedbackBanner feedback={feedback} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="border-zinc-800 bg-zinc-950">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Revision Explorer</h2>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => void refreshEntries()}
                disabled={isLoadingEntries}
              >
                {isLoadingEntries ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Refresh
              </Button>
            </div>

            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Item</label>
              <Select
                value={selectedItemId || ''}
                onChange={(value) => setSelectedItemId(value)}
                options={
                  entries.length > 0
                    ? toEntryOptions(entries)
                    : [{ value: '', label: 'No item available' }]
                }
              />
            </div>

            <div className="max-h-[330px] space-y-2 overflow-auto pr-1">
              {revisions.length === 0 && (
                <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                  {isLoadingRevisions ? 'Loading revisions...' : 'No revisions in selected item.'}
                </div>
              )}
              {revisions.map((revision) => (
                <button
                  type="button"
                  key={revision.version}
                  onClick={() => setToVersion(revision.version)}
                  className={`w-full rounded-lg border p-3 text-left text-[11px] transition-colors ${
                    toVersion === revision.version
                      ? 'border-sky-500/35 bg-sky-500/10 text-sky-200'
                      : 'border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <div className="font-mono">{revision.version}</div>
                  <div className="mt-1 text-zinc-500">
                    {revision.status} · {revision.channel}
                  </div>
                  <div className="mt-1 text-zinc-500">{formatTime(revision.updatedAt)}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <section className="space-y-4">
          <Card className="border-zinc-800 bg-zinc-950">
            <CardContent className="space-y-3 p-4">
              <h2 className="text-sm font-semibold text-white">Diff Control</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">From</label>
                  <Select
                    value={fromVersion || ''}
                    onChange={(value) => setFromVersion(value)}
                    options={
                      revisions.length > 0
                        ? toRevisionOptions(revisions)
                        : [{ value: '', label: 'No revision' }]
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">To</label>
                  <Select
                    value={toVersion || ''}
                    onChange={(value) => setToVersion(value)}
                    options={
                      revisions.length > 0
                        ? toRevisionOptions(revisions)
                        : [{ value: '', label: 'No revision' }]
                    }
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => void handleLoadDiff()}
                    disabled={!selectedItemId || !fromVersion || !toVersion || isDiffLoading}
                  >
                    {isDiffLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompare className="h-4 w-4" />}
                    Load Diff
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-950">
            <CardContent className="space-y-3 p-4">
              <h2 className="text-sm font-semibold text-white">Diff Result</h2>
              {!diffResult && (
                <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                  Load a diff to view manifest changes.
                </div>
              )}
              {diffResult && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-300">
                    <div className="flex flex-wrap gap-4">
                      <span>from: {diffResult.fromRevision.version}</span>
                      <span>to: {diffResult.toRevision.version}</span>
                      <span>total: {diffResult.diff.summary.totalChanges}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                    <div className="rounded-lg border border-white/10 bg-zinc-900 p-3">
                      <div className="mb-2 text-xs font-semibold text-emerald-400">
                        Added ({diffResult.diff.summary.addedCount})
                      </div>
                      <div className="max-h-40 space-y-1 overflow-auto text-[11px] text-zinc-300">
                        {diffResult.diff.changes.addedPaths.map((path) => (
                          <div key={path} className="font-mono">{path}</div>
                        ))}
                        {diffResult.diff.changes.addedPaths.length === 0 && (
                          <div className="text-zinc-500">None</div>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-zinc-900 p-3">
                      <div className="mb-2 text-xs font-semibold text-amber-400">
                        Removed ({diffResult.diff.summary.removedCount})
                      </div>
                      <div className="max-h-40 space-y-1 overflow-auto text-[11px] text-zinc-300">
                        {diffResult.diff.changes.removedPaths.map((path) => (
                          <div key={path} className="font-mono">{path}</div>
                        ))}
                        {diffResult.diff.changes.removedPaths.length === 0 && (
                          <div className="text-zinc-500">None</div>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-zinc-900 p-3">
                      <div className="mb-2 text-xs font-semibold text-blue-400">
                        Changed ({diffResult.diff.summary.changedCount})
                      </div>
                      <div className="max-h-40 space-y-2 overflow-auto text-[11px] text-zinc-300">
                        {diffResult.diff.changes.changedPaths.map((item) => (
                          <div key={item.path}>
                            <div className="font-mono text-zinc-200">{item.path}</div>
                            <div className="font-mono text-zinc-500">from: {JSON.stringify(item.from)}</div>
                            <div className="font-mono text-zinc-500">to: {JSON.stringify(item.to)}</div>
                          </div>
                        ))}
                        {diffResult.diff.changes.changedPaths.length === 0 && (
                          <div className="text-zinc-500">None</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-950">
            <CardContent className="space-y-3 p-4">
              <h2 className="text-sm font-semibold text-white">Manifest Inspector</h2>
              <pre className="max-h-[260px] overflow-auto rounded-lg border border-white/10 bg-zinc-900 p-3 text-[11px] text-zinc-300">
                {inspectRevision ? JSON.stringify(inspectRevision.manifest || {}, null, 2) : '// select revision'}
              </pre>
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-950">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Release History</h2>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => void refreshHistory()}
                  disabled={isHistoryLoading}
                >
                  {isHistoryLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Refresh
                </Button>
              </div>
              <div className="max-h-[250px] space-y-2 overflow-auto pr-1">
                {filteredHistory.length === 0 && (
                  <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                    No release record for selected planning template.
                  </div>
                )}
                {filteredHistory.map((record) => (
                  <div key={record.id} className="rounded-lg border border-white/10 bg-zinc-900 p-3 text-[11px] text-zinc-300">
                    <div className="flex items-center justify-between">
                      <span className="font-mono">{record.itemId}</span>
                      <span className={record.action === 'publish' ? 'text-emerald-400' : 'text-amber-300'}>
                        {record.action}
                      </span>
                    </div>
                    <div className="mt-1 text-zinc-500">
                      {record.fromVersion || '-'} -&gt; {record.toVersion} ({record.channel}) · {record.status}
                    </div>
                    <div className="mt-1 text-zinc-500">{formatTime(record.createdAt)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

export function PlanningTemplatePublishPage() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [revisions, setRevisions] = useState<CatalogRevision[]>([]);
  const [releaseHistory, setReleaseHistory] = useState<ReleaseRecord[]>([]);

  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [rollbackVersion, setRollbackVersion] = useState('');
  const [channel, setChannel] = useState<CatalogChannel>('internal');
  const [notes, setNotes] = useState('');

  const [validationType, setValidationType] = useState<ValidationRunType>('catalog_validate');
  const [validationRun, setValidationRun] = useState<ValidationRunRecord | null>(null);
  const [validationLookupRunId, setValidationLookupRunId] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [isLoadingRevisions, setIsLoadingRevisions] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isRunningValidation, setIsRunningValidation] = useState(false);
  const [isFetchingValidation, setIsFetchingValidation] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRollbacking, setIsRollbacking] = useState(false);

  const selectedRevision = useMemo(
    () => revisions.find((revision) => revision.version === selectedVersion) || null,
    [revisions, selectedVersion],
  );

  const validationChecks = useMemo(() => getValidationChecks(validationRun), [validationRun]);
  const publishGatePassed = useMemo(() => (
    !!validationRun
    && validationRun.status === 'succeeded'
    && !hasValidationFailure(validationRun)
  ), [validationRun]);

  async function refreshEntries(preferredItemId?: string) {
    setIsLoadingEntries(true);
    try {
      const response = await listCatalogEntries('planning_template', { limit: 100 });
      const nextEntries = [...response.data].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setEntries(nextEntries);

      const keepCurrent = selectedItemId && nextEntries.some((entry) => entry.itemId === selectedItemId);
      const nextItemId = preferredItemId || (keepCurrent ? selectedItemId : nextEntries[0]?.itemId || '');
      setSelectedItemId(nextItemId);
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsLoadingEntries(false);
    }
  }

  async function refreshRevisions(itemId: string, preferredVersion?: string) {
    if (!itemId) {
      setRevisions([]);
      setSelectedVersion('');
      setRollbackVersion('');
      return;
    }
    setIsLoadingRevisions(true);
    try {
      const response = await listCatalogRevisions('planning_template', itemId, { limit: 100 });
      const nextRevisions = [...response.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setRevisions(nextRevisions);

      const keepCurrent = selectedVersion && nextRevisions.some((revision) => revision.version === selectedVersion);
      const nextVersion = preferredVersion || (keepCurrent ? selectedVersion : nextRevisions[0]?.version || '');
      const revision = nextRevisions.find((item) => item.version === nextVersion) || null;
      setSelectedVersion(nextVersion);

      if (revision) {
        setChannel(revision.channel);
      }

      const publishedVersions = nextRevisions
        .filter((item) => item.status === 'published')
        .map((item) => item.version);
      const rollbackCandidate = publishedVersions.find((version) => version !== nextVersion) || publishedVersions[0] || '';
      setRollbackVersion(rollbackCandidate);
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsLoadingRevisions(false);
    }
  }

  async function refreshHistory() {
    setIsLoadingHistory(true);
    try {
      const response = await listReleaseHistory({
        domain: 'planning_template',
        limit: 80,
      });
      setReleaseHistory(response.data);
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsLoadingHistory(false);
    }
  }

  useEffect(() => {
    void refreshEntries();
    void refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedItemId) {
      return;
    }
    setValidationRun(null);
    setValidationLookupRunId('');
    void refreshRevisions(selectedItemId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemId]);

  async function handleRunValidation() {
    if (!selectedItemId || !selectedVersion) {
      setFeedback({ tone: 'error', message: 'Select item and revision before validation.' });
      return;
    }
    setIsRunningValidation(true);
    try {
      const created = await runCatalogValidation({
        domain: 'planning_template',
        itemId: selectedItemId,
        version: selectedVersion,
        runType: validationType,
      });
      setValidationRun(created);
      setValidationLookupRunId(created.id);
      setFeedback({
        tone: 'info',
        message: `Validation started: ${created.id} (${created.status})`,
      });
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsRunningValidation(false);
    }
  }

  async function handleFetchValidationRun() {
    const runId = validationLookupRunId.trim();
    if (!runId) {
      setFeedback({ tone: 'error', message: 'Provide runId to fetch validation result.' });
      return;
    }
    setIsFetchingValidation(true);
    try {
      const record = await getValidationRun(runId);
      setValidationRun(record);
      setFeedback({
        tone: record.status === 'succeeded' && !hasValidationFailure(record) ? 'success' : 'info',
        message: `Validation run ${record.id}: ${record.status}`,
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
      setFeedback({
        tone: 'error',
        message: 'Publish gate blocked: run validation and ensure status=succeeded with no failed checks.',
      });
      return;
    }

    setIsPublishing(true);
    try {
      await publishCatalogRevision('planning_template', selectedItemId, {
        version: selectedVersion,
        channel,
        notes: notes.trim() || undefined,
        validationRunId: validationRun?.id || undefined,
      });
      setFeedback({
        tone: 'success',
        message: `Published ${selectedItemId}@${selectedVersion} to ${channel}.`,
      });
      await refreshRevisions(selectedItemId, selectedVersion);
      await refreshHistory();
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleRollback() {
    if (!selectedItemId || !rollbackVersion) {
      setFeedback({ tone: 'error', message: 'Select rollback target version first.' });
      return;
    }

    setIsRollbacking(true);
    try {
      await rollbackCatalogRevision('planning_template', selectedItemId, {
        targetVersion: rollbackVersion,
        channel,
        notes: notes.trim() || undefined,
        validationRunId: validationRun?.id || undefined,
      });
      setFeedback({
        tone: 'success',
        message: `Rollback request submitted: ${selectedItemId} -> ${rollbackVersion} (${channel}).`,
      });
      await refreshRevisions(selectedItemId, rollbackVersion);
      await refreshHistory();
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsRollbacking(false);
    }
  }

  const filteredHistory = useMemo(() => (
    selectedItemId
      ? releaseHistory.filter((record) => record.itemId === selectedItemId)
      : releaseHistory
  ), [releaseHistory, selectedItemId]);

  const rollbackOptions = useMemo(() => (
    revisions
      .filter((revision) => revision.status === 'published')
      .map((revision) => ({
        value: revision.version,
        label: `${revision.version} (${revision.channel})`,
      }))
  ), [revisions]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4">
      <WorkspaceHeader
        title="Planning Template Studio / Publish"
        description="Validate, publish, and rollback planning-template revisions with explicit release gates."
      />
      <DomainStageTabs basePath={BASE_PATH} activeStage="publish" />

      {feedback && <FeedbackBanner feedback={feedback} />}

      <Card className="border-zinc-800 bg-zinc-950">
        <CardContent className="space-y-4 p-4">
          <h2 className="text-sm font-semibold text-white">Release Target</h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Item</label>
              <Select
                value={selectedItemId || ''}
                onChange={(value) => setSelectedItemId(value)}
                options={
                  entries.length > 0
                    ? toEntryOptions(entries)
                    : [{ value: '', label: 'No item available' }]
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Revision</label>
              <Select
                value={selectedVersion || ''}
                onChange={(value) => setSelectedVersion(value)}
                options={
                  revisions.length > 0
                    ? toRevisionOptions(revisions)
                    : [{ value: '', label: isLoadingRevisions ? 'Loading...' : 'No revision' }]
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Channel</label>
              <Select
                value={channel}
                onChange={(value) => setChannel(value as CatalogChannel)}
                options={CHANNEL_OPTIONS}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="release notes (optional)"
              className={TEXTAREA_CLASS}
            />
            <div className="flex items-end">
              <Button
                variant="outline"
                className="w-full gap-2 lg:min-w-[180px]"
                onClick={() => {
                  void refreshEntries(selectedItemId);
                  void refreshRevisions(selectedItemId, selectedVersion);
                  void refreshHistory();
                }}
                disabled={isLoadingEntries || isLoadingRevisions || isLoadingHistory}
              >
                {(isLoadingEntries || isLoadingRevisions || isLoadingHistory)
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <RefreshCw className="h-4 w-4" />}
                Refresh Data
              </Button>
            </div>
          </div>

          {selectedRevision && (
            <div className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-[11px] text-zinc-300">
              <div className="flex flex-wrap gap-4">
                <span>status: {selectedRevision.status}</span>
                <span>channel: {selectedRevision.channel}</span>
                <span>updated: {formatTime(selectedRevision.updatedAt)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-950">
        <CardContent className="space-y-4 p-4">
          <h2 className="text-sm font-semibold text-white">Validation Gate</h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Validation Type</label>
              <Select
                value={validationType}
                onChange={(value) => setValidationType(value as ValidationRunType)}
                options={VALIDATION_TYPE_OPTIONS}
              />
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Run ID</label>
              <input
                type="text"
                value={validationLookupRunId}
                onChange={(event) => setValidationLookupRunId(event.target.value)}
                placeholder="validation run id"
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => void handleRunValidation()}
                disabled={!selectedItemId || !selectedVersion || isRunningValidation}
              >
                {isRunningValidation ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Run
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => void handleFetchValidationRun()}
                disabled={isFetchingValidation}
              >
                {isFetchingValidation ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Fetch
              </Button>
            </div>
          </div>

          <div
            className={`rounded-lg border px-3 py-2 text-xs ${
              publishGatePassed
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/20 bg-red-500/10 text-red-300'
            }`}
          >
            <div className="font-semibold">Publish Gate: {publishGatePassed ? 'Passed' : 'Blocked'}</div>
            <div className="mt-1 text-[11px]">
              Need validation status = succeeded and no failed checks.
            </div>
            {validationRun && (
              <div className="mt-1 text-[11px]">
                runId={validationRun.id}, status={validationRun.status}
                {validationRun.finishedAt ? `, finished=${formatTime(validationRun.finishedAt)}` : ''}
              </div>
            )}
          </div>

          <div className="space-y-2">
            {validationChecks.length === 0 && (
              <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                No validation checks loaded yet.
              </div>
            )}
            {validationChecks.map((check, index) => {
              const passed = check.status === 'passed';
              return (
                <div
                  key={`${check.name}-${index}`}
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    passed
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                      : 'border-red-500/20 bg-red-500/10 text-red-300'
                  }`}
                >
                  <div className="font-semibold">{check.name}</div>
                  <div className="mt-1 text-[11px] opacity-90">{check.message}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-950">
        <CardContent className="space-y-4 p-4">
          <h2 className="text-sm font-semibold text-white">Publish / Rollback Action</h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Rollback Target</label>
              <Select
                value={rollbackVersion || ''}
                onChange={(value) => setRollbackVersion(value)}
                options={
                  rollbackOptions.length > 0
                    ? rollbackOptions
                    : [{ value: '', label: 'No published revision' }]
                }
              />
            </div>
            <div className="flex items-end">
              <Button
                className="w-full gap-2"
                onClick={() => void handlePublish()}
                disabled={!selectedItemId || !selectedVersion || !publishGatePassed || isPublishing}
              >
                {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                Publish Revision
              </Button>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => void handleRollback()}
                disabled={!selectedItemId || !rollbackVersion || isRollbacking}
              >
                {isRollbacking ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
                Rollback Version
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-950">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Release History</h2>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => void refreshHistory()}
              disabled={isLoadingHistory}
            >
              {isLoadingHistory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </Button>
          </div>
          <div className="max-h-[280px] space-y-2 overflow-auto pr-1">
            {filteredHistory.length === 0 && (
              <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                No release activity yet for selected planning template.
              </div>
            )}
            {filteredHistory.map((record) => (
              <div key={record.id} className="rounded-lg border border-white/10 bg-zinc-900 p-3 text-[11px] text-zinc-300">
                <div className="flex items-center justify-between">
                  <span className="font-mono">{record.itemId}</span>
                  <span className={record.action === 'publish' ? 'text-emerald-400' : 'text-amber-300'}>
                    {record.action}
                  </span>
                </div>
                <div className="mt-1 text-zinc-500">
                  {record.fromVersion || '-'} -&gt; {record.toVersion} ({record.channel}) · {record.status}
                </div>
                {record.validationRunId && (
                  <div className="mt-1 font-mono text-zinc-500">validationRunId: {record.validationRunId}</div>
                )}
                <div className="mt-1 text-zinc-500">{formatTime(record.createdAt)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

