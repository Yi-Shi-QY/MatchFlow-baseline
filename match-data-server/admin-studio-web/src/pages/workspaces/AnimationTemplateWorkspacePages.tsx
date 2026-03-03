import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  GitCompare,
  History,
  Loader2,
  Pause,
  PackageCheck,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Upload,
  XCircle,
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

const BASE_PATH = '/app/animation-templates';

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

interface AnimationTemplateDraft {
  id: string;
  name: string;
  description: string;
  animationType: string;
  templateId: string;
  requiredParamsText: string;
  schemaJson: string;
  exampleJson: string;
}

interface ValidationCheck {
  name: string;
  status: string;
  message: string;
}

interface AnimationTestPreview {
  generatedAt: string;
  animationType: string;
  templateId: string;
  requiredParams: string[];
  schemaPropertyKeys: string[];
  missingInSchema: string[];
  missingInExample: string[];
  paramSamples: Array<{
    param: string;
    inSchema: boolean;
    inExample: boolean;
    sampleText: string;
  }>;
}

interface AnimationVisualFrame {
  id: string;
  title: string;
  subtitle: string;
  badges: string[];
  payload: Record<string, unknown>;
}

interface AnimationVisualPreviewModel {
  frames: AnimationVisualFrame[];
  requiredParams: string[];
  animationType: string;
  error: string | null;
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

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return '{}';
  }
}

function parseJsonText(text: string, label: string) {
  const raw = text.trim();
  if (!raw) {
    return {
      value: {},
      error: null,
    } as const;
  }
  try {
    return {
      value: JSON.parse(raw) as unknown,
      error: null,
    } as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid JSON';
    return {
      value: null,
      error: `${label} is not valid JSON: ${message}`,
    } as const;
  }
}

function buildEmptyAnimationDraft(itemId: string): AnimationTemplateDraft {
  return {
    id: itemId || 'animation_template_item',
    name: 'Animation Template',
    description: '',
    animationType: '',
    templateId: '',
    requiredParamsText: '',
    schemaJson: '{}',
    exampleJson: '{}',
  };
}

function toAnimationTemplateDraft(manifest: Record<string, unknown>, fallbackItemId: string): AnimationTemplateDraft {
  const schemaCandidate =
    manifest.schema
    ?? manifest.parametersSchema
    ?? manifest.paramSchema
    ?? {};
  const exampleCandidate =
    manifest.example
    ?? manifest.previewExample
    ?? manifest.sample
    ?? {};

  return {
    id: asText(manifest.id) || fallbackItemId || 'animation_template_item',
    name: asText(manifest.name) || 'Animation Template',
    description: asText(manifest.description),
    animationType: asText(manifest.animationType),
    templateId: asText(manifest.templateId),
    requiredParamsText: toCsvText(manifest.requiredParams),
    schemaJson: prettyJson(schemaCandidate),
    exampleJson: prettyJson(exampleCandidate),
  };
}

function toAnimationTemplateManifest(draft: AnimationTemplateDraft) {
  const schemaParsed = parseJsonText(draft.schemaJson, 'schema');
  if (schemaParsed.error) {
    return {
      manifest: null,
      error: schemaParsed.error,
    } as const;
  }

  const exampleParsed = parseJsonText(draft.exampleJson, 'example');
  if (exampleParsed.error) {
    return {
      manifest: null,
      error: exampleParsed.error,
    } as const;
  }

  return {
    manifest: {
      id: asText(draft.id),
      name: asText(draft.name),
      description: asText(draft.description),
      animationType: asText(draft.animationType),
      templateId: asText(draft.templateId),
      requiredParams: parseCsvText(draft.requiredParamsText),
      schema: schemaParsed.value,
      example: exampleParsed.value,
    } satisfies Record<string, unknown>,
    error: null,
  } as const;
}

function getAnimationDraftIssues(draft: AnimationTemplateDraft | null) {
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
  if (!asText(draft.animationType)) {
    issues.push('animationType is required.');
  }
  if (!asText(draft.templateId)) {
    issues.push('templateId is required.');
  }

  const schemaParsed = parseJsonText(draft.schemaJson, 'schema');
  if (schemaParsed.error) {
    issues.push(schemaParsed.error);
  }

  const exampleParsed = parseJsonText(draft.exampleJson, 'example');
  if (exampleParsed.error) {
    issues.push(exampleParsed.error);
  }

  return issues;
}

function readObjectPathValue(source: unknown, pathText: string): unknown {
  const path = pathText
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  if (path.length === 0) {
    return undefined;
  }

  let current: unknown = source;
  for (const segment of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
    if (current === undefined) {
      return undefined;
    }
  }
  return current;
}

function toPreviewText(value: unknown) {
  if (value === undefined) {
    return '-';
  }
  if (typeof value === 'string') {
    return value.length > 120 ? `${value.slice(0, 117)}...` : value;
  }
  try {
    const raw = JSON.stringify(value);
    return raw.length > 120 ? `${raw.slice(0, 117)}...` : raw;
  } catch {
    return String(value);
  }
}

function buildAnimationTestPreview(draft: AnimationTemplateDraft) {
  const parsed = toAnimationTemplateManifest(draft);
  if (!parsed.manifest) {
    return {
      preview: null,
      error: parsed.error,
    } as const;
  }

  const requiredParams = parseCsvText(draft.requiredParamsText);
  const schemaRecord = asRecord(parsed.manifest.schema);
  const schemaProperties = asRecord(schemaRecord.properties);
  const schemaPropertyKeys = Object.keys(schemaProperties)
    .map((key) => key.trim())
    .filter((key) => key.length > 0);

  const example = parsed.manifest.example;
  const missingInSchema: string[] = [];
  const missingInExample: string[] = [];

  const paramSamples = requiredParams.map((param) => {
    const inSchema = schemaPropertyKeys.includes(param);
    const sampleValue = readObjectPathValue(example, param);
    const inExample = sampleValue !== undefined;
    if (!inSchema) {
      missingInSchema.push(param);
    }
    if (!inExample) {
      missingInExample.push(param);
    }
    return {
      param,
      inSchema,
      inExample,
      sampleText: toPreviewText(sampleValue),
    };
  });

  return {
    preview: {
      generatedAt: new Date().toISOString(),
      animationType: asText(draft.animationType),
      templateId: asText(draft.templateId),
      requiredParams,
      schemaPropertyKeys,
      missingInSchema,
      missingInExample,
      paramSamples,
    } satisfies AnimationTestPreview,
    error: null,
  } as const;
}

function toAnimationVisualFrame(candidate: unknown, index: number): AnimationVisualFrame {
  const candidateRecord = asRecord(candidate);
  const payload = Object.keys(candidateRecord).length > 0
    ? candidateRecord
    : { value: candidate };
  const title = (
    asText(candidateRecord.title)
    || asText(candidateRecord.name)
    || asText(candidateRecord.label)
    || asText(candidateRecord.headline)
    || asText(candidateRecord.id)
    || (candidate === undefined || candidate === null ? '' : String(candidate))
    || `Frame ${index + 1}`
  );
  const subtitle = (
    asText(candidateRecord.subtitle)
    || asText(candidateRecord.description)
    || asText(candidateRecord.desc)
    || asText(candidateRecord.focus)
    || asText(candidateRecord.text)
  );
  const badges = [
    asText(candidateRecord.status),
    asText(candidateRecord.stage),
    asText(candidateRecord.type),
    asText(candidateRecord.league),
    asText(candidateRecord.matchId),
  ].filter((badge) => badge.length > 0);

  return {
    id: asText(candidateRecord.id) || `frame_${index + 1}`,
    title,
    subtitle,
    badges,
    payload,
  };
}

function collectAnimationVisualCandidates(example: unknown) {
  if (Array.isArray(example)) {
    return example;
  }

  const exampleRecord = asRecord(example);
  const keyedArrayCandidates = [
    exampleRecord.frames,
    exampleRecord.items,
    exampleRecord.cards,
    exampleRecord.segments,
    exampleRecord.scenes,
  ];
  for (const candidate of keyedArrayCandidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate;
    }
  }

  if (Object.keys(exampleRecord).length > 0) {
    return [exampleRecord];
  }

  return [];
}

function buildAnimationVisualPreview(draft: AnimationTemplateDraft | null): AnimationVisualPreviewModel {
  if (!draft) {
    return {
      frames: [],
      requiredParams: [],
      animationType: '',
      error: null,
    };
  }

  const parsed = toAnimationTemplateManifest(draft);
  if (!parsed.manifest) {
    return {
      frames: [],
      requiredParams: parseCsvText(draft.requiredParamsText),
      animationType: asText(draft.animationType),
      error: parsed.error || 'Failed to parse manifest.',
    };
  }

  const candidates = collectAnimationVisualCandidates(parsed.manifest.example);
  const frames = candidates
    .slice(0, 24)
    .map((candidate, index) => toAnimationVisualFrame(candidate, index));

  return {
    frames,
    requiredParams: parseCsvText(draft.requiredParamsText),
    animationType: asText(draft.animationType),
    error: null,
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

export function AnimationTemplateDesignPage() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [revisions, setRevisions] = useState<CatalogRevision[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [draft, setDraft] = useState<AnimationTemplateDraft | null>(null);
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
  const [testPreview, setTestPreview] = useState<AnimationTestPreview | null>(null);
  const [isVisualPlaying, setIsVisualPlaying] = useState(true);
  const [visualIndex, setVisualIndex] = useState(0);
  const [visualTick, setVisualTick] = useState(0);
  const [visualSpeed, setVisualSpeed] = useState('1');
  const [visualLoop, setVisualLoop] = useState(true);

  const selectedRevision = useMemo(
    () => revisions.find((revision) => revision.version === selectedVersion) || null,
    [revisions, selectedVersion],
  );

  const localIssues = useMemo(() => getAnimationDraftIssues(draft), [draft]);
  const visualPreview = useMemo(() => buildAnimationVisualPreview(draft), [draft]);
  const currentVisualFrame = useMemo(() => {
    if (visualPreview.frames.length === 0) {
      return null;
    }
    const safeIndex = Math.min(Math.max(0, visualIndex), visualPreview.frames.length - 1);
    return visualPreview.frames[safeIndex];
  }, [visualPreview.frames, visualIndex]);

  const manifestPreview = useMemo(() => {
    if (!draft) {
      return '';
    }
    const parsed = toAnimationTemplateManifest(draft);
    if (!parsed.manifest) {
      return `// ${parsed.error}`;
    }
    return JSON.stringify(parsed.manifest, null, 2);
  }, [draft]);

  const visualStageClass = useMemo(() => {
    const animationType = visualPreview.animationType.toLowerCase();
    if (animationType.includes('ticker') || animationType.includes('scroll')) {
      return 'bg-gradient-to-br from-zinc-950 via-sky-950/40 to-zinc-900';
    }
    if (animationType.includes('flip')) {
      return 'bg-gradient-to-br from-zinc-950 via-amber-950/30 to-zinc-900';
    }
    if (animationType.includes('slide')) {
      return 'bg-gradient-to-br from-zinc-950 via-emerald-950/30 to-zinc-900';
    }
    if (animationType.includes('zoom')) {
      return 'bg-gradient-to-br from-zinc-950 via-fuchsia-950/20 to-zinc-900';
    }
    return 'bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950';
  }, [visualPreview.animationType]);

  const visualAnimationStyle = useMemo(() => {
    const animationType = visualPreview.animationType.toLowerCase();
    const speed = Number.parseFloat(visualSpeed) || 1;
    const durationMs = Math.max(220, Math.round(520 / speed));
    let keyframeName = 'mfAnimFadeIn';
    if (animationType.includes('ticker') || animationType.includes('scroll')) {
      keyframeName = 'mfAnimTickerIn';
    } else if (animationType.includes('flip')) {
      keyframeName = 'mfAnimFlipIn';
    } else if (animationType.includes('slide')) {
      keyframeName = 'mfAnimSlideIn';
    } else if (animationType.includes('zoom')) {
      keyframeName = 'mfAnimZoomIn';
    }
    return {
      animation: `${keyframeName} ${durationMs}ms cubic-bezier(0.22, 0.8, 0.2, 1)`,
    } satisfies React.CSSProperties;
  }, [visualPreview.animationType, visualSpeed, visualIndex, visualTick]);

  const visualParamSamples = useMemo(() => {
    if (!currentVisualFrame) {
      return [] as Array<{ key: string; valueText: string }>;
    }

    const requiredParams = visualPreview.requiredParams;
    const candidateKeys = requiredParams.length > 0
      ? requiredParams
      : Object.keys(currentVisualFrame.payload).slice(0, 6);

    return candidateKeys.slice(0, 8).map((param) => {
      const value = readObjectPathValue(currentVisualFrame.payload, param);
      return {
        key: param,
        valueText: toPreviewText(value !== undefined ? value : currentVisualFrame.payload[param]),
      };
    });
  }, [currentVisualFrame, visualPreview.requiredParams]);

  useEffect(() => {
    setVisualIndex(0);
    setVisualTick((value) => value + 1);
  }, [draft?.exampleJson, draft?.animationType]);

  useEffect(() => {
    if (!isVisualPlaying) {
      return;
    }
    const frameCount = visualPreview.frames.length;
    if (frameCount <= 1) {
      return;
    }

    const speed = Number.parseFloat(visualSpeed) || 1;
    const intervalMs = Math.max(1000, Math.round(2600 / speed));
    const timerId = window.setInterval(() => {
      setVisualIndex((current) => {
        const next = current + 1;
        if (next >= frameCount) {
          if (visualLoop) {
            return 0;
          }
          setIsVisualPlaying(false);
          return current;
        }
        return next;
      });
      setVisualTick((value) => value + 1);
    }, intervalMs);

    return () => {
      window.clearInterval(timerId);
    };
  }, [isVisualPlaying, visualPreview.frames.length, visualSpeed, visualLoop]);

  function stepVisualFrame(direction: 'next' | 'prev') {
    if (visualPreview.frames.length === 0) {
      return;
    }
    const frameCount = visualPreview.frames.length;
    setVisualIndex((current) => {
      if (direction === 'next') {
        return (current + 1 + frameCount) % frameCount;
      }
      return (current - 1 + frameCount) % frameCount;
    });
    setVisualTick((value) => value + 1);
  }

  function replayVisualPreview() {
    setVisualIndex(0);
    setVisualTick((value) => value + 1);
    setIsVisualPlaying(true);
  }

  async function loadEntries(preferredItemId?: string) {
    setIsLoadingEntries(true);
    try {
      const response = await listCatalogEntries('animation_template', { limit: 100 });
      const nextEntries = [...response.data].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setEntries(nextEntries);

      const keepCurrent = selectedItemId && nextEntries.some((entry) => entry.itemId === selectedItemId);
      const nextItemId = preferredItemId || (keepCurrent ? selectedItemId : nextEntries[0]?.itemId || '');
      setSelectedItemId(nextItemId);

      if (!nextItemId) {
        setRevisions([]);
        setSelectedVersion('');
        setDraft(buildEmptyAnimationDraft('animation_template_item'));
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
      setDraft(buildEmptyAnimationDraft('animation_template_item'));
      return;
    }

    setIsLoadingRevisions(true);
    try {
      const response = await listCatalogRevisions('animation_template', itemId, { limit: 100 });
      const nextRevisions = [...response.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setRevisions(nextRevisions);

      const keepCurrent = selectedVersion && nextRevisions.some((revision) => revision.version === selectedVersion);
      const nextVersion = preferredVersion || (keepCurrent ? selectedVersion : nextRevisions[0]?.version || '');
      setSelectedVersion(nextVersion);

      const revision = nextRevisions.find((item) => item.version === nextVersion) || null;
      if (revision) {
        setDraft(toAnimationTemplateDraft(revision.manifest || {}, itemId));
        setPublishChannel(revision.channel);
      } else {
        setDraft(buildEmptyAnimationDraft(itemId));
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
      setDraft(toAnimationTemplateDraft(revision.manifest || {}, selectedItemId));
      setPublishChannel(revision.channel);
      setTestPreview(null);
      setFeedback({
        tone: 'info',
        message: `Loaded ${selectedItemId}@${revision.version} (${revision.status})`,
      });
    }
  }

  function updateDraft(patch: Partial<AnimationTemplateDraft>) {
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

  function handleFormatJson(field: 'schemaJson' | 'exampleJson') {
    setDraft((previous) => {
      if (!previous) {
        return previous;
      }
      const source = field === 'schemaJson' ? previous.schemaJson : previous.exampleJson;
      const parsed = parseJsonText(source, field === 'schemaJson' ? 'schema' : 'example');
      if (parsed.error) {
        setFeedback({ tone: 'error', message: parsed.error });
        return previous;
      }
      const pretty = JSON.stringify(parsed.value, null, 2);
      return {
        ...previous,
        [field]: pretty,
      };
    });
    setTestPreview(null);
  }

  async function handleCreateEntry() {
    const itemId = newItemId.trim();
    const version = newEntryVersion.trim();
    if (!itemId || !version) {
      setFeedback({ tone: 'error', message: 'itemId and version are required to create template entry.' });
      return;
    }

    setIsCreatingEntry(true);
    try {
      const starterDraft = buildEmptyAnimationDraft(itemId);
      const parsed = toAnimationTemplateManifest(starterDraft);
      if (!parsed.manifest) {
        setFeedback({ tone: 'error', message: parsed.error });
        return;
      }

      await createCatalogEntry('animation_template', {
        itemId,
        version,
        manifest: parsed.manifest,
        status: 'draft',
        channel: publishChannel,
      });

      setNewItemId('');
      setFeedback({ tone: 'success', message: `Created animation template ${itemId}@${version}.` });
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
      setFeedback({ tone: 'error', message: 'Select item and draft content before creating revision.' });
      return;
    }

    const parsed = toAnimationTemplateManifest(draft);
    if (!parsed.manifest) {
      setFeedback({ tone: 'error', message: parsed.error });
      return;
    }

    setIsCreatingRevision(true);
    try {
      await createCatalogRevision('animation_template', selectedItemId, {
        version,
        manifest: parsed.manifest,
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
      setFeedback({ tone: 'error', message: 'Select revision before saving.' });
      return;
    }

    const parsed = toAnimationTemplateManifest(draft);
    if (!parsed.manifest) {
      setFeedback({ tone: 'error', message: parsed.error });
      return;
    }

    setIsSavingDraft(true);
    try {
      await updateCatalogDraftRevision('animation_template', selectedItemId, selectedVersion, {
        manifest: parsed.manifest,
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

    const issues = getAnimationDraftIssues(draft);
    if (issues.length > 0) {
      setFeedback({ tone: 'error', message: `Fix local issues first: ${issues[0]}` });
      return;
    }

    setIsRunningPreview(true);
    try {
      const result = buildAnimationTestPreview(draft);
      if (!result.preview) {
        setFeedback({ tone: 'error', message: result.error || 'Failed to build animation test preview.' });
        return;
      }
      setTestPreview(result.preview);
      const hasGap = result.preview.missingInSchema.length > 0 || result.preview.missingInExample.length > 0;
      setFeedback({
        tone: hasGap ? 'info' : 'success',
        message: hasGap
          ? 'Test preview generated with parameter coverage warnings.'
          : 'Test preview generated successfully.',
      });
    } finally {
      setIsRunningPreview(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4">
      <WorkspaceHeader
        title="Animation Template Studio / Design"
        description="Design animation-template manifest, parameter schema, and example payload with revision-safe editing."
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
                  No animation template item exists yet.
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
                  placeholder="itemId (e.g. short_summary_v1)"
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
                Select an item/revision to start animation-template editing.
              </CardContent>
            </Card>
          )}

          {draft && (
            <Card className="border-zinc-800 bg-zinc-950">
              <CardContent className="space-y-4 p-4">
                <h2 className="text-sm font-semibold text-white">Template Draft Editor</h2>

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

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">animationType</label>
                    <input
                      type="text"
                      value={draft.animationType}
                      onChange={(event) => updateDraft({ animationType: event.target.value })}
                      className={INPUT_CLASS}
                      placeholder="slide_fade / ticker / card_flip"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">templateId</label>
                    <input
                      type="text"
                      value={draft.templateId}
                      onChange={(event) => updateDraft({ templateId: event.target.value })}
                      className={INPUT_CLASS}
                      placeholder="runtime template identifier"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Description</label>
                  <textarea
                    value={draft.description}
                    onChange={(event) => updateDraft({ description: event.target.value })}
                    className={TEXTAREA_CLASS}
                    placeholder="what this animation template is used for"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">requiredParams (CSV)</label>
                  <input
                    type="text"
                    value={draft.requiredParamsText}
                    onChange={(event) => updateDraft({ requiredParamsText: event.target.value })}
                    className={INPUT_CLASS}
                    placeholder="title, odds_home, odds_draw, odds_away"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-[11px] uppercase tracking-wider text-zinc-500">schema (JSON)</label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => handleFormatJson('schemaJson')}
                      >
                        Format
                      </Button>
                    </div>
                    <textarea
                      value={draft.schemaJson}
                      onChange={(event) => updateDraft({ schemaJson: event.target.value })}
                      className="min-h-[200px] w-full rounded-lg border border-white/10 bg-zinc-900 p-3 font-mono text-[11px] text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-[11px] uppercase tracking-wider text-zinc-500">example (JSON)</label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => handleFormatJson('exampleJson')}
                      >
                        Format
                      </Button>
                    </div>
                    <textarea
                      value={draft.exampleJson}
                      onChange={(event) => updateDraft({ exampleJson: event.target.value })}
                      className="min-h-[200px] w-full rounded-lg border border-white/10 bg-zinc-900 p-3 font-mono text-[11px] text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-zinc-800 bg-zinc-950">
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-white">Display Preview</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={visualSpeed}
                    onChange={(value) => setVisualSpeed(value)}
                    options={[
                      { value: '0.75', label: '0.75x' },
                      { value: '1', label: '1x' },
                      { value: '1.25', label: '1.25x' },
                      { value: '1.5', label: '1.5x' },
                      { value: '2', label: '2x' },
                    ]}
                    className="w-[92px]"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => setVisualLoop((value) => !value)}
                  >
                    {visualLoop ? 'Loop: on' : 'Loop: off'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => stepVisualFrame('prev')}
                    disabled={visualPreview.frames.length === 0}
                  >
                    <SkipBack className="h-3.5 w-3.5" />
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => {
                      if (visualPreview.frames.length <= 1) {
                        return;
                      }
                      setIsVisualPlaying((value) => !value);
                    }}
                    disabled={visualPreview.frames.length <= 1}
                  >
                    {isVisualPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    {isVisualPlaying ? 'Pause' : 'Play'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => stepVisualFrame('next')}
                    disabled={visualPreview.frames.length === 0}
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                    Next
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={replayVisualPreview}
                    disabled={visualPreview.frames.length === 0}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Replay
                  </Button>
                </div>
              </div>

              <style>
                {`
                  @keyframes mfAnimFadeIn {
                    0% { opacity: 0; transform: scale(0.98); }
                    100% { opacity: 1; transform: scale(1); }
                  }
                  @keyframes mfAnimSlideIn {
                    0% { opacity: 0; transform: translateX(20px); }
                    100% { opacity: 1; transform: translateX(0); }
                  }
                  @keyframes mfAnimTickerIn {
                    0% { opacity: 0; transform: translateY(18px); }
                    100% { opacity: 1; transform: translateY(0); }
                  }
                  @keyframes mfAnimFlipIn {
                    0% { opacity: 0; transform: perspective(800px) rotateY(70deg); }
                    100% { opacity: 1; transform: perspective(800px) rotateY(0deg); }
                  }
                  @keyframes mfAnimZoomIn {
                    0% { opacity: 0; transform: scale(0.82); }
                    100% { opacity: 1; transform: scale(1); }
                  }
                `}
              </style>

              {visualPreview.error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {visualPreview.error}
                </div>
              )}

              {!visualPreview.error && visualPreview.frames.length === 0 && (
                <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                  Add valid `example` JSON to preview animation rendering result.
                </div>
              )}

              {!visualPreview.error && currentVisualFrame && (
                <div className={`overflow-hidden rounded-xl border border-white/10 ${visualStageClass}`}>
                  <div className="min-h-[260px] p-4">
                    <div
                      key={`${currentVisualFrame.id}-${visualIndex}-${visualTick}`}
                      className="rounded-xl border border-white/10 bg-black/35 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
                      style={visualAnimationStyle}
                    >
                      <div className="text-[11px] uppercase tracking-wider text-zinc-400">
                        {visualPreview.animationType || 'default'} · frame {visualIndex + 1}/{visualPreview.frames.length}
                      </div>
                      <h3 className="mt-2 text-lg font-semibold text-white">{currentVisualFrame.title}</h3>
                      {currentVisualFrame.subtitle && (
                        <p className="mt-1 text-sm text-zinc-300">{currentVisualFrame.subtitle}</p>
                      )}
                      {currentVisualFrame.badges.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {currentVisualFrame.badges.map((badge) => (
                            <span key={`${currentVisualFrame.id}-${badge}`} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">
                              {badge}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {visualParamSamples.map((sample) => (
                          <div key={`${currentVisualFrame.id}-${sample.key}`} className="rounded border border-white/10 bg-zinc-900/70 px-2 py-1.5 text-[11px]">
                            <div className="font-mono text-zinc-400">{sample.key}</div>
                            <div className="mt-1 font-mono text-zinc-200">{sample.valueText}</div>
                          </div>
                        ))}
                        {visualParamSamples.length === 0 && (
                          <div className="text-[11px] text-zinc-500">No param sample available in current frame.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {visualPreview.frames.length > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1">
                    {visualPreview.frames.map((frame, index) => (
                      <button
                        key={`dot-${frame.id}-${index}`}
                        type="button"
                        onClick={() => {
                          setVisualIndex(index);
                          setVisualTick((value) => value + 1);
                        }}
                        className={`h-2 w-6 rounded-full transition-colors ${
                          index === visualIndex ? 'bg-emerald-400' : 'bg-zinc-700 hover:bg-zinc-500'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {isVisualPlaying ? 'Auto-play running' : 'Auto-play paused'}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-950">
            <CardContent className="space-y-3 p-4">
              <h2 className="text-sm font-semibold text-white">Local Validation</h2>
              {localIssues.length === 0 && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  <CheckCircle2 className="mr-1 inline h-4 w-4" />
                  Local template checks passed.
                </div>
              )}
              {localIssues.length > 0 && (
                <div className="space-y-2">
                  {localIssues.map((issue) => (
                    <div key={issue} className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                      <XCircle className="mr-1 inline h-4 w-4" />
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
                  Run test preview to verify required param coverage against schema and example payload.
                </div>
              )}

              {testPreview && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-[11px] text-zinc-300">
                    <div className="flex flex-wrap gap-4">
                      <span>generatedAt: {formatTime(testPreview.generatedAt)}</span>
                      <span>animationType: {testPreview.animationType || '-'}</span>
                      <span>templateId: {testPreview.templateId || '-'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-white/10 bg-zinc-900 p-3">
                      <div className="mb-2 text-xs font-semibold text-zinc-300">Schema Coverage</div>
                      <div className="text-[11px] text-zinc-400">
                        schema properties: {testPreview.schemaPropertyKeys.join(', ') || '-'}
                      </div>
                      <div className={`mt-2 text-[11px] ${
                        testPreview.missingInSchema.length > 0 ? 'text-red-300' : 'text-emerald-300'
                      }`}>
                        missing in schema: {testPreview.missingInSchema.join(', ') || 'none'}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-zinc-900 p-3">
                      <div className="mb-2 text-xs font-semibold text-zinc-300">Example Coverage</div>
                      <div className={`text-[11px] ${
                        testPreview.missingInExample.length > 0 ? 'text-amber-300' : 'text-emerald-300'
                      }`}>
                        missing in example: {testPreview.missingInExample.join(', ') || 'none'}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-zinc-900 p-3">
                    <div className="mb-2 text-xs font-semibold text-zinc-300">Required Param Samples</div>
                    <div className="max-h-[220px] overflow-auto rounded border border-white/10">
                      <table className="w-full text-left text-[11px] text-zinc-300">
                        <thead className="border-b border-white/10 text-zinc-400">
                          <tr>
                            <th className="px-3 py-2">param</th>
                            <th className="px-3 py-2">inSchema</th>
                            <th className="px-3 py-2">inExample</th>
                            <th className="px-3 py-2">sample</th>
                          </tr>
                        </thead>
                        <tbody>
                          {testPreview.paramSamples.map((sample) => (
                            <tr key={sample.param} className="border-b border-white/5 align-top">
                              <td className="px-3 py-2 font-mono">{sample.param}</td>
                              <td className={`px-3 py-2 ${sample.inSchema ? 'text-emerald-300' : 'text-red-300'}`}>
                                {sample.inSchema ? 'yes' : 'no'}
                              </td>
                              <td className={`px-3 py-2 ${sample.inExample ? 'text-emerald-300' : 'text-amber-300'}`}>
                                {sample.inExample ? 'yes' : 'no'}
                              </td>
                              <td className="px-3 py-2 font-mono text-zinc-400">{sample.sampleText}</td>
                            </tr>
                          ))}
                          {testPreview.paramSamples.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-3 py-3 text-center text-zinc-500">No required params.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
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



export function AnimationTemplateManagePage() {
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

  const inspectDraft = useMemo(() => {
    if (!inspectRevision) {
      return null;
    }
    return toAnimationTemplateDraft(inspectRevision.manifest || {}, inspectRevision.itemId);
  }, [inspectRevision]);

  const inspectIssues = useMemo(() => getAnimationDraftIssues(inspectDraft), [inspectDraft]);

  async function refreshEntries(preferredItemId?: string) {
    setIsLoadingEntries(true);
    try {
      const response = await listCatalogEntries('animation_template', { limit: 100 });
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
      const response = await listCatalogRevisions('animation_template', itemId, { limit: 100 });
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
        domain: 'animation_template',
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
      const diff = await getCatalogRevisionDiff('animation_template', selectedItemId, fromVersion, toVersion);
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
        title="Animation Template Studio / Manage"
        description="Inspect revisions, compare manifest diffs, and track release records for animation templates."
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
              <h2 className="text-sm font-semibold text-white">Schema Health</h2>
              {!inspectDraft && (
                <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                  Select a revision to inspect schema and example JSON health.
                </div>
              )}
              {inspectDraft && inspectIssues.length === 0 && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  <CheckCircle2 className="mr-1 inline h-4 w-4" />
                  This revision passes local schema checks.
                </div>
              )}
              {inspectDraft && inspectIssues.length > 0 && (
                <div className="space-y-2">
                  {inspectIssues.map((issue) => (
                    <div key={issue} className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                      <XCircle className="mr-1 inline h-4 w-4" />
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
                    No release record for selected animation template.
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

export function AnimationTemplatePublishPage() {
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
      const response = await listCatalogEntries('animation_template', { limit: 100 });
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
      const response = await listCatalogRevisions('animation_template', itemId, { limit: 100 });
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
        domain: 'animation_template',
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
        domain: 'animation_template',
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
      await publishCatalogRevision('animation_template', selectedItemId, {
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
      await rollbackCatalogRevision('animation_template', selectedItemId, {
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
        title="Animation Template Studio / Publish"
        description="Validate, publish, and rollback animation-template revisions with explicit release gates."
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
                No release activity yet for selected animation template.
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

