import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  History,
  Loader2,
  PackageCheck,
  PlayCircle,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
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
  DatasourceCollectionHealthItem,
  DatasourceCollectionHealthSummary,
  DatasourceCollectionRun,
  DatasourceCollectionSnapshot,
  DatasourceCollector,
  DatasourceDataPreview,
  DatasourceStructurePreview,
  ReleaseRecord,
  ValidationRunRecord,
  confirmDatasourceCollectionSnapshot,
  createCatalogEntry,
  createCatalogRevision,
  createDatasourceCollector,
  getValidationRun,
  listCatalogEntries,
  listCatalogRevisions,
  listDatasourceCollectionHealth,
  listDatasourceCollectionRuns,
  listDatasourceCollectionSnapshots,
  listDatasourceCollectors,
  listReleaseHistory,
  previewDatasourceData,
  previewDatasourceStructure,
  publishCatalogRevision,
  releaseDatasourceCollectionSnapshot,
  replayDatasourceCollectionSnapshot,
  rollbackCatalogRevision,
  runCatalogValidation,
  triggerDatasourceCollectorRun,
  updateCatalogDraftRevision,
  updateDatasourceCollector,
} from '@/src/services/adminStudio';

const BASE_PATH = '/app/datasources';

const INPUT_CLASS =
  'w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none';
const TEXTAREA_CLASS =
  'min-h-[68px] w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none';

type FeedbackTone = 'success' | 'error' | 'info';
type CatalogChannel = 'internal' | 'beta' | 'stable';
type ValidationRunType = 'catalog_validate' | 'pre_publish' | 'post_publish';
type DatasourceFieldType =
  | 'text'
  | 'number'
  | 'textarea'
  | 'csv_array'
  | 'versus_number'
  | 'odds_triplet';

interface FeedbackState {
  tone: FeedbackTone;
  message: string;
}

interface DatasourceFieldDraft {
  id: string;
  type: DatasourceFieldType;
  pathText: string;
  homePathText: string;
  drawPathText: string;
  awayPathText: string;
}

interface DatasourceManifestDraft {
  id: string;
  name: string;
  labelKey: string;
  requiredPermissionsText: string;
  cardSpan: '1' | '2';
  defaultSelected: boolean;
  fields: DatasourceFieldDraft[];
}

interface ValidationCheck {
  name: string;
  status: string;
  message: string;
}

type PreviewStepStatus = 'idle' | 'running' | 'passed' | 'failed';

interface DatasourcePreviewPipeline {
  runAt: string;
  structure: PreviewStepStatus;
  data: PreviewStepStatus;
  note: string;
}

const DATASOURCE_FIELD_TYPE_OPTIONS: Array<{ value: DatasourceFieldType; label: string }> = [
  { value: 'text', label: 'text' },
  { value: 'number', label: 'number' },
  { value: 'textarea', label: 'textarea' },
  { value: 'csv_array', label: 'csv_array' },
  { value: 'versus_number', label: 'versus_number' },
  { value: 'odds_triplet', label: 'odds_triplet' },
];

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

const COLLECTOR_PROVIDER_OPTIONS: Array<{ value: 'match_snapshot' | 'manual_import'; label: string }> = [
  { value: 'match_snapshot', label: 'match_snapshot' },
  { value: 'manual_import', label: 'manual_import' },
];

const EMPTY_HEALTH_SUMMARY: DatasourceCollectionHealthSummary = {
  total: 0,
  healthy: 0,
  stale: 0,
  failed: 0,
  neverRun: 0,
  disabled: 0,
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

function parsePathText(pathText: string) {
  return pathText
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function toPathText(value: unknown) {
  if (!Array.isArray(value)) {
    return '';
  }
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .join('.');
}

function buildDefaultField(index: number): DatasourceFieldDraft {
  return {
    id: `field_${index + 1}`,
    type: 'text',
    pathText: '',
    homePathText: '',
    drawPathText: '',
    awayPathText: '',
  };
}

function buildEmptyDatasourceDraft(itemId: string): DatasourceManifestDraft {
  return {
    id: itemId || 'datasource_item',
    name: 'Datasource',
    labelKey: '',
    requiredPermissionsText: '',
    cardSpan: '1',
    defaultSelected: true,
    fields: [buildDefaultField(0)],
  };
}

function toDatasourceManifestDraft(manifest: Record<string, unknown>, fallbackItemId: string): DatasourceManifestDraft {
  const fieldsRaw = Array.isArray(manifest.fields)
    ? manifest.fields
    : Array.isArray(asRecord(manifest.schema).fields)
      ? (asRecord(manifest.schema).fields as unknown[])
      : [];

  const fields = fieldsRaw
    .map((field, index) => {
      const fieldRecord = asRecord(field);
      const typeRaw = asText(fieldRecord.type) as DatasourceFieldType;
      const type: DatasourceFieldType = DATASOURCE_FIELD_TYPE_OPTIONS.some((option) => option.value === typeRaw)
        ? typeRaw
        : 'text';
      return {
        id: asText(fieldRecord.id) || `field_${index + 1}`,
        type,
        pathText: toPathText(fieldRecord.path),
        homePathText: toPathText(fieldRecord.homePath),
        drawPathText: toPathText(fieldRecord.drawPath),
        awayPathText: toPathText(fieldRecord.awayPath),
      } satisfies DatasourceFieldDraft;
    })
    .filter((field) => field.id.length > 0);

  return {
    id: asText(manifest.id || manifest.sourceId) || fallbackItemId || 'datasource_item',
    name: asText(manifest.name || manifest.label || manifest.labelKey) || 'Datasource',
    labelKey: asText(manifest.labelKey),
    requiredPermissionsText: toCsvText(manifest.requiredPermissions),
    cardSpan: String(manifest.cardSpan) === '2' ? '2' : '1',
    defaultSelected: typeof manifest.defaultSelected === 'boolean' ? manifest.defaultSelected : true,
    fields: fields.length > 0 ? fields : [buildDefaultField(0)],
  };
}

function toDatasourceManifest(draft: DatasourceManifestDraft) {
  const fields = draft.fields.map((field, index) => {
    const base = {
      id: asText(field.id) || `field_${index + 1}`,
      type: field.type,
    } as Record<string, unknown>;

    if (field.type === 'versus_number') {
      base.homePath = parsePathText(field.homePathText);
      base.awayPath = parsePathText(field.awayPathText);
      return base;
    }

    if (field.type === 'odds_triplet') {
      base.homePath = parsePathText(field.homePathText);
      base.drawPath = parsePathText(field.drawPathText);
      base.awayPath = parsePathText(field.awayPathText);
      return base;
    }

    base.path = parsePathText(field.pathText);
    return base;
  });

  return {
    id: asText(draft.id),
    name: asText(draft.name),
    ...(asText(draft.labelKey) ? { labelKey: asText(draft.labelKey) } : {}),
    cardSpan: Number.parseInt(draft.cardSpan, 10) || 1,
    defaultSelected: !!draft.defaultSelected,
    requiredPermissions: parseCsvText(draft.requiredPermissionsText),
    fields,
  };
}

function getDatasourceDraftIssues(draft: DatasourceManifestDraft | null) {
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
  if (draft.fields.length === 0) {
    issues.push('At least one field is required.');
  }
  draft.fields.forEach((field, index) => {
    if (!asText(field.id)) {
      issues.push(`field[${index + 1}] id is required.`);
    }
    if (field.type === 'versus_number') {
      if (!asText(field.homePathText) || !asText(field.awayPathText)) {
        issues.push(`field[${index + 1}] requires homePath + awayPath.`);
      }
      return;
    }
    if (field.type === 'odds_triplet') {
      if (!asText(field.homePathText) || !asText(field.drawPathText) || !asText(field.awayPathText)) {
        issues.push(`field[${index + 1}] requires homePath + drawPath + awayPath.`);
      }
      return;
    }
    if (!asText(field.pathText)) {
      issues.push(`field[${index + 1}] path is required.`);
    }
  });
  return issues;
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

export function DatasourceDesignPage() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [revisions, setRevisions] = useState<CatalogRevision[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [draft, setDraft] = useState<DatasourceManifestDraft | null>(null);
  const [publishChannel, setPublishChannel] = useState<CatalogChannel>('internal');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [newItemId, setNewItemId] = useState('');
  const [newEntryVersion, setNewEntryVersion] = useState('1.0.0');
  const [newRevisionVersion, setNewRevisionVersion] = useState('1.0.1');

  const [previewLimit, setPreviewLimit] = useState('5');
  const [previewStatusesText, setPreviewStatusesText] = useState('scheduled,live');
  const [previewIncludeSourceRecord, setPreviewIncludeSourceRecord] = useState(false);

  const [structurePreview, setStructurePreview] = useState<DatasourceStructurePreview | null>(null);
  const [dataPreview, setDataPreview] = useState<DatasourceDataPreview | null>(null);

  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [isLoadingRevisions, setIsLoadingRevisions] = useState(false);
  const [isCreatingEntry, setIsCreatingEntry] = useState(false);
  const [isCreatingRevision, setIsCreatingRevision] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPreviewingStructure, setIsPreviewingStructure] = useState(false);
  const [isPreviewingData, setIsPreviewingData] = useState(false);
  const [isPreviewingSuite, setIsPreviewingSuite] = useState(false);
  const [previewPipeline, setPreviewPipeline] = useState<DatasourcePreviewPipeline | null>(null);

  const selectedRevision = useMemo(
    () => revisions.find((revision) => revision.version === selectedVersion) || null,
    [revisions, selectedVersion],
  );

  const manifestPreview = useMemo(() => {
    if (!draft) {
      return '';
    }
    return JSON.stringify(toDatasourceManifest(draft), null, 2);
  }, [draft]);

  const localIssues = useMemo(() => getDatasourceDraftIssues(draft), [draft]);

  async function loadEntries(preferredItemId?: string) {
    setIsLoadingEntries(true);
    try {
      const response = await listCatalogEntries('datasource', { limit: 100 });
      const nextEntries = [...response.data].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setEntries(nextEntries);

      const keepCurrent = selectedItemId && nextEntries.some((entry) => entry.itemId === selectedItemId);
      const nextItemId = preferredItemId || (keepCurrent ? selectedItemId : nextEntries[0]?.itemId || '');
      setSelectedItemId(nextItemId);

      if (!nextItemId) {
        setRevisions([]);
        setSelectedVersion('');
        setDraft(buildEmptyDatasourceDraft('datasource_item'));
        setPreviewPipeline(null);
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
      setDraft(buildEmptyDatasourceDraft('datasource_item'));
      return;
    }

    setIsLoadingRevisions(true);
    try {
      const response = await listCatalogRevisions('datasource', itemId, { limit: 100 });
      const nextRevisions = [...response.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setRevisions(nextRevisions);

      const keepCurrent = selectedVersion && nextRevisions.some((revision) => revision.version === selectedVersion);
      const nextVersion = preferredVersion || (keepCurrent ? selectedVersion : nextRevisions[0]?.version || '');
      setSelectedVersion(nextVersion);

      const revision = nextRevisions.find((item) => item.version === nextVersion) || null;
      if (revision) {
        setDraft(toDatasourceManifestDraft(revision.manifest || {}, itemId));
        setPublishChannel(revision.channel);
      } else {
        setDraft(buildEmptyDatasourceDraft(itemId));
      }
      setStructurePreview(null);
      setDataPreview(null);
      setPreviewPipeline(null);
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
      setDraft(toDatasourceManifestDraft(revision.manifest || {}, selectedItemId));
      setPublishChannel(revision.channel);
      setStructurePreview(null);
      setDataPreview(null);
      setPreviewPipeline(null);
      setFeedback({
        tone: 'info',
        message: `Loaded ${selectedItemId}@${revision.version} (${revision.status})`,
      });
    }
  }

  function updateDraft(patch: Partial<DatasourceManifestDraft>) {
    setDraft((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        ...patch,
      };
    });
    setPreviewPipeline(null);
  }

  function updateField(index: number, patch: Partial<DatasourceFieldDraft>) {
    setDraft((previous) => {
      if (!previous) {
        return previous;
      }
      const nextFields = previous.fields.map((field, fieldIndex) => (
        fieldIndex === index
          ? { ...field, ...patch }
          : field
      ));
      return {
        ...previous,
        fields: nextFields,
      };
    });
    setPreviewPipeline(null);
  }

  function addField() {
    setDraft((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        fields: [...previous.fields, buildDefaultField(previous.fields.length)],
      };
    });
    setPreviewPipeline(null);
  }

  function removeField(index: number) {
    setDraft((previous) => {
      if (!previous || previous.fields.length <= 1) {
        return previous;
      }
      const nextFields = previous.fields.filter((_, fieldIndex) => fieldIndex !== index);
      return {
        ...previous,
        fields: nextFields,
      };
    });
    setPreviewPipeline(null);
  }

  async function handleCreateEntry() {
    const itemId = newItemId.trim();
    const version = newEntryVersion.trim();
    if (!itemId || !version) {
      setFeedback({ tone: 'error', message: 'itemId and version are required to create datasource entry.' });
      return;
    }

    setIsCreatingEntry(true);
    try {
      const starterDraft = buildEmptyDatasourceDraft(itemId);
      await createCatalogEntry('datasource', {
        itemId,
        version,
        manifest: toDatasourceManifest(starterDraft),
        status: 'draft',
        channel: publishChannel,
      });

      setNewItemId('');
      setFeedback({ tone: 'success', message: `Created datasource ${itemId}@${version}.` });
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

    setIsCreatingRevision(true);
    try {
      await createCatalogRevision('datasource', selectedItemId, {
        version,
        manifest: toDatasourceManifest(draft),
        status: 'draft',
        channel: publishChannel,
      });
      setNewRevisionVersion('');
      setFeedback({ tone: 'success', message: `Created revision ${selectedItemId}@${version}.` });
      await loadRevisions(selectedItemId, version);
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsCreatingRevision(false);
    }
  }

  async function handleSaveDraft() {
    if (!selectedItemId || !selectedVersion || !draft) {
      setFeedback({ tone: 'error', message: 'Select revision before saving draft.' });
      return;
    }

    setIsSavingDraft(true);
    try {
      await updateCatalogDraftRevision('datasource', selectedItemId, selectedVersion, {
        manifest: toDatasourceManifest(draft),
        channel: publishChannel,
      });
      setFeedback({ tone: 'success', message: `Saved ${selectedItemId}@${selectedVersion}.` });
      await loadRevisions(selectedItemId, selectedVersion);
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function handlePreviewStructure() {
    if (!draft) {
      setFeedback({ tone: 'error', message: 'Draft is empty, cannot preview structure.' });
      return;
    }
    const issues = getDatasourceDraftIssues(draft);
    if (issues.length > 0) {
      setFeedback({ tone: 'error', message: `Fix local issues first: ${issues[0]}` });
      return;
    }

    setIsPreviewingStructure(true);
    try {
      const preview = await previewDatasourceStructure({
        manifest: toDatasourceManifest(draft),
      });
      setStructurePreview(preview);
      setFeedback({
        tone: preview.validation.status === 'passed' ? 'success' : 'error',
        message: `Structure preview finished: ${preview.validation.status}.`,
      });
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
      setStructurePreview(null);
    } finally {
      setIsPreviewingStructure(false);
    }
  }

  async function handlePreviewData() {
    if (!draft) {
      setFeedback({ tone: 'error', message: 'Draft is empty, cannot preview data.' });
      return;
    }

    const limit = Number.parseInt(previewLimit, 10);
    const statuses = parseCsvText(previewStatusesText);

    setIsPreviewingData(true);
    try {
      const preview = await previewDatasourceData({
        manifest: toDatasourceManifest(draft),
        limit: Number.isFinite(limit) && limit > 0 ? limit : 5,
        statuses,
        includeSourceRecord: previewIncludeSourceRecord,
      });
      setDataPreview(preview);
      setFeedback({ tone: 'success', message: `Data preview loaded: ${preview.summary.rowCount} rows.` });
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
      setDataPreview(null);
    } finally {
      setIsPreviewingData(false);
    }
  }

  async function handleRunPreviewSuite() {
    if (!draft) {
      setFeedback({ tone: 'error', message: 'Draft is empty, cannot run test preview.' });
      return;
    }

    const issues = getDatasourceDraftIssues(draft);
    if (issues.length > 0) {
      setFeedback({ tone: 'error', message: `Fix local issues first: ${issues[0]}` });
      return;
    }

    const limit = Number.parseInt(previewLimit, 10);
    const statuses = parseCsvText(previewStatusesText);
    const normalizedLimit = Number.isFinite(limit) && limit > 0 ? limit : 5;
    const manifest = toDatasourceManifest(draft);

    setIsPreviewingSuite(true);
    setPreviewPipeline({
      runAt: new Date().toISOString(),
      structure: 'running',
      data: 'idle',
      note: 'Running structure preview...',
    });

    try {
      const structure = await previewDatasourceStructure({ manifest });
      setStructurePreview(structure);

      if (structure.validation.status !== 'passed') {
        setPreviewPipeline((previous) => ({
          runAt: previous?.runAt || new Date().toISOString(),
          structure: 'failed',
          data: 'idle',
          note: `Structure preview failed: ${structure.validation.failedChecks.join(', ') || 'validation_failed'}`,
        }));
        setFeedback({ tone: 'error', message: 'Test preview stopped: structure validation failed.' });
        return;
      }

      setPreviewPipeline((previous) => ({
        runAt: previous?.runAt || new Date().toISOString(),
        structure: 'passed',
        data: 'running',
        note: 'Structure passed, running data preview...',
      }));

      const data = await previewDatasourceData({
        manifest,
        limit: normalizedLimit,
        statuses,
        includeSourceRecord: previewIncludeSourceRecord,
      });
      setDataPreview(data);

      setPreviewPipeline((previous) => ({
        runAt: previous?.runAt || new Date().toISOString(),
        structure: 'passed',
        data: 'passed',
        note: `All preview steps passed (${data.summary.rowCount} rows).`,
      }));
      setFeedback({
        tone: 'success',
        message: `Test preview passed: ${data.summary.rowCount} rows loaded.`,
      });
    } catch (error) {
      setPreviewPipeline((previous) => {
        if (!previous) {
          return {
            runAt: new Date().toISOString(),
            structure: 'failed',
            data: 'failed',
            note: 'Preview failed unexpectedly.',
          } satisfies DatasourcePreviewPipeline;
        }
        if (previous.structure === 'running') {
          return {
            ...previous,
            structure: 'failed',
            data: 'idle',
            note: 'Structure preview request failed.',
          } satisfies DatasourcePreviewPipeline;
        }
        return {
          ...previous,
          data: 'failed',
          note: 'Data preview request failed.',
        } satisfies DatasourcePreviewPipeline;
      });
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsPreviewingSuite(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4">
      <WorkspaceHeader
        title="Datasource Studio / Design"
        description="Design datasource schema and field mappings with draft revision control and preview capabilities."
      />
      <DomainStageTabs basePath={BASE_PATH} activeStage="design" />

      {feedback && <FeedbackBanner feedback={feedback} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="border-zinc-800 bg-zinc-950">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Datasource Catalog</h2>
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
                  No datasource item exists yet.
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
                  placeholder="itemId (e.g. football_matches)"
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
                  onClick={() => void handlePreviewStructure()}
                  disabled={!draft || isPreviewingStructure}
                >
                  {isPreviewingStructure ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Preview Structure
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => void handlePreviewData()}
                  disabled={!draft || isPreviewingData}
                >
                  {isPreviewingData ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                  Preview Data
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => void handleRunPreviewSuite()}
                  disabled={!draft || isPreviewingSuite || isPreviewingStructure || isPreviewingData}
                >
                  {isPreviewingSuite ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Test Preview (All)
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

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <input
                  type="text"
                  value={previewLimit}
                  onChange={(event) => setPreviewLimit(event.target.value)}
                  placeholder="preview row limit"
                  className={INPUT_CLASS}
                />
                <input
                  type="text"
                  value={previewStatusesText}
                  onChange={(event) => setPreviewStatusesText(event.target.value)}
                  placeholder="statuses CSV"
                  className={INPUT_CLASS}
                />
                <button
                  type="button"
                  onClick={() => setPreviewIncludeSourceRecord((value) => !value)}
                  className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                    previewIncludeSourceRecord
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-white/10 bg-zinc-900 text-zinc-400'
                  }`}
                >
                  includeSourceRecord: {previewIncludeSourceRecord ? 'true' : 'false'}
                </button>
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
                Select an item/revision to start datasource editing.
              </CardContent>
            </Card>
          )}

          {draft && (
            <Card className="border-zinc-800 bg-zinc-950">
              <CardContent className="space-y-4 p-4">
                <h2 className="text-sm font-semibold text-white">Datasource Draft Editor</h2>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Datasource ID</label>
                    <input
                      type="text"
                      value={draft.id}
                      onChange={(event) => updateDraft({ id: event.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Datasource Name</label>
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(event) => updateDraft({ name: event.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">labelKey</label>
                    <input
                      type="text"
                      value={draft.labelKey}
                      onChange={(event) => updateDraft({ labelKey: event.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">cardSpan</label>
                    <Select
                      value={draft.cardSpan}
                      onChange={(value) => updateDraft({ cardSpan: value === '2' ? '2' : '1' })}
                      options={[
                        { value: '1', label: '1 column' },
                        { value: '2', label: '2 columns' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">defaultSelected</label>
                    <button
                      type="button"
                      onClick={() => updateDraft({ defaultSelected: !draft.defaultSelected })}
                      className={`w-full rounded-lg border px-3 py-2 text-xs transition-colors ${
                        draft.defaultSelected
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          : 'border-white/10 bg-zinc-900 text-zinc-400'
                      }`}
                    >
                      {draft.defaultSelected ? 'true' : 'false'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">
                    requiredPermissions (CSV)
                  </label>
                  <input
                    type="text"
                    value={draft.requiredPermissionsText}
                    onChange={(event) => updateDraft({ requiredPermissionsText: event.target.value })}
                    className={INPUT_CLASS}
                    placeholder="match.read,odds.read"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Fields</h3>
                  <Button variant="outline" size="sm" className="gap-1" onClick={addField}>
                    <Plus className="h-3.5 w-3.5" />
                    Add Field
                  </Button>
                </div>

                <div className="space-y-3">
                  {draft.fields.map((field, index) => {
                    const needVersus = field.type === 'versus_number';
                    const needOddsTriplet = field.type === 'odds_triplet';
                    const needSinglePath = !needVersus && !needOddsTriplet;

                    return (
                      <div key={`${field.id}-${index}`} className="rounded-lg border border-white/10 bg-zinc-900 p-3">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="text-xs font-semibold text-zinc-200">field #{index + 1}</div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-300 hover:text-red-200"
                            onClick={() => removeField(index)}
                            disabled={draft.fields.length <= 1}
                          >
                            Remove
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          <div>
                            <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Field ID</label>
                            <input
                              type="text"
                              value={field.id}
                              onChange={(event) => updateField(index, { id: event.target.value })}
                              className={INPUT_CLASS}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Field Type</label>
                            <Select
                              value={field.type}
                              onChange={(value) => updateField(index, { type: value as DatasourceFieldType })}
                              options={DATASOURCE_FIELD_TYPE_OPTIONS}
                            />
                          </div>
                          {needSinglePath && (
                            <div>
                              <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Path</label>
                              <input
                                type="text"
                                value={field.pathText}
                                onChange={(event) => updateField(index, { pathText: event.target.value })}
                                className={INPUT_CLASS}
                                placeholder="match.league.name"
                              />
                            </div>
                          )}
                        </div>

                        {needVersus && (
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">homePath</label>
                              <input
                                type="text"
                                value={field.homePathText}
                                onChange={(event) => updateField(index, { homePathText: event.target.value })}
                                className={INPUT_CLASS}
                                placeholder="odds.home"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">awayPath</label>
                              <input
                                type="text"
                                value={field.awayPathText}
                                onChange={(event) => updateField(index, { awayPathText: event.target.value })}
                                className={INPUT_CLASS}
                                placeholder="odds.away"
                              />
                            </div>
                          </div>
                        )}

                        {needOddsTriplet && (
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div>
                              <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">homePath</label>
                              <input
                                type="text"
                                value={field.homePathText}
                                onChange={(event) => updateField(index, { homePathText: event.target.value })}
                                className={INPUT_CLASS}
                                placeholder="odds.home"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">drawPath</label>
                              <input
                                type="text"
                                value={field.drawPathText}
                                onChange={(event) => updateField(index, { drawPathText: event.target.value })}
                                className={INPUT_CLASS}
                                placeholder="odds.draw"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">awayPath</label>
                              <input
                                type="text"
                                value={field.awayPathText}
                                onChange={(event) => updateField(index, { awayPathText: event.target.value })}
                                className={INPUT_CLASS}
                                placeholder="odds.away"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-zinc-800 bg-zinc-950">
            <CardContent className="space-y-3 p-4">
              <h2 className="text-sm font-semibold text-white">Local Validation</h2>
              {localIssues.length === 0 && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  <CheckCircle2 className="mr-1 inline h-4 w-4" />
                  Local draft checks passed.
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
                <h2 className="text-sm font-semibold text-white">Preview Pipeline</h2>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => void handleRunPreviewSuite()}
                  disabled={!draft || isPreviewingSuite || isPreviewingStructure || isPreviewingData}
                >
                  {isPreviewingSuite ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Run All
                </Button>
              </div>

              {!previewPipeline && (
                <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                  Run test preview to execute structure + data preview in one flow.
                </div>
              )}

              {previewPipeline && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-[11px] text-zinc-300">
                    <div className="flex flex-wrap gap-4">
                      <span>runAt: {formatTime(previewPipeline.runAt)}</span>
                      <span className={previewPipeline.structure === 'passed' ? 'text-emerald-300' : previewPipeline.structure === 'failed' ? 'text-red-300' : 'text-zinc-400'}>
                        structure: {previewPipeline.structure}
                      </span>
                      <span className={previewPipeline.data === 'passed' ? 'text-emerald-300' : previewPipeline.data === 'failed' ? 'text-red-300' : 'text-zinc-400'}>
                        data: {previewPipeline.data}
                      </span>
                    </div>
                    <div className="mt-1 text-zinc-500">{previewPipeline.note}</div>
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

          <Card className="border-zinc-800 bg-zinc-950">
            <CardContent className="space-y-3 p-4">
              <h2 className="text-sm font-semibold text-white">Structure Preview</h2>
              {!structurePreview && (
                <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                  Run "Preview Structure" to inspect mapping quality and check results.
                </div>
              )}
              {structurePreview && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-[11px] text-zinc-300">
                    <div className="flex flex-wrap gap-4">
                      <span>sourceId: {structurePreview.sourceId}</span>
                      <span>fields: {structurePreview.summary.totalFields}</span>
                      <span>mappedPaths: {structurePreview.summary.mappedPathCount}</span>
                      <span>
                        validation: <span className={structurePreview.validation.status === 'passed' ? 'text-emerald-400' : 'text-red-400'}>{structurePreview.validation.status}</span>
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {structurePreview.validation.checks.map((check) => (
                      <div
                        key={check.name}
                        className={`rounded-lg border px-3 py-2 text-xs ${
                          check.status === 'passed'
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                            : 'border-red-500/20 bg-red-500/10 text-red-300'
                        }`}
                      >
                        <div className="font-semibold">{check.name}</div>
                        <div className="mt-1 text-[11px] opacity-90">{check.message}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-white/10 bg-zinc-900 p-3">
                    <div className="mb-2 text-xs font-semibold text-zinc-300">Top Path Catalog</div>
                    <div className="max-h-40 space-y-1 overflow-auto text-[11px] text-zinc-300">
                      {structurePreview.pathCatalog.slice(0, 20).map((item) => (
                        <div key={item.pathText} className="font-mono">
                          {item.pathText} ({item.fieldRefs.length})
                        </div>
                      ))}
                      {structurePreview.pathCatalog.length === 0 && <div className="text-zinc-500">No mapped path.</div>}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-950">
            <CardContent className="space-y-3 p-4">
              <h2 className="text-sm font-semibold text-white">Data Preview</h2>
              {!dataPreview && (
                <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                  Run "Preview Data" to sample mapped output rows.
                </div>
              )}
              {dataPreview && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-[11px] text-zinc-300">
                    <div className="flex flex-wrap gap-4">
                      <span>source: {dataPreview.source}</span>
                      <span>sampledAt: {formatTime(dataPreview.sampledAt)}</span>
                      <span>rows: {dataPreview.summary.rowCount}</span>
                    </div>
                  </div>
                  <div className="max-h-[300px] overflow-auto rounded-lg border border-white/10 bg-zinc-900">
                    <table className="w-full min-w-[760px] text-left text-[11px] text-zinc-300">
                      <thead className="border-b border-white/10 text-zinc-400">
                        <tr>
                          <th className="px-3 py-2">row</th>
                          <th className="px-3 py-2">matchId</th>
                          <th className="px-3 py-2">league</th>
                          <th className="px-3 py-2">status</th>
                          <th className="px-3 py-2">matchDate</th>
                          <th className="px-3 py-2">values</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dataPreview.rows.map((row) => (
                          <tr key={`${row.rowIndex}-${row.matchId || 'n/a'}`} className="border-b border-white/5 align-top">
                            <td className="px-3 py-2">{row.rowIndex}</td>
                            <td className="px-3 py-2">{row.matchId || '-'}</td>
                            <td className="px-3 py-2">{row.league || '-'}</td>
                            <td className="px-3 py-2">{row.status || '-'}</td>
                            <td className="px-3 py-2">{row.matchDate || '-'}</td>
                            <td className="px-3 py-2 font-mono text-[10px] text-zinc-400">{JSON.stringify(row.values)}</td>
                          </tr>
                        ))}
                        {dataPreview.rows.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-3 py-4 text-center text-zinc-500">No rows.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

export function DatasourceManagePage() {
  const [sourceEntries, setSourceEntries] = useState<CatalogEntry[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState('');

  const [collectors, setCollectors] = useState<DatasourceCollector[]>([]);
  const [selectedCollectorId, setSelectedCollectorId] = useState('');
  const [runs, setRuns] = useState<DatasourceCollectionRun[]>([]);
  const [snapshots, setSnapshots] = useState<DatasourceCollectionSnapshot[]>([]);

  const [healthSummary, setHealthSummary] = useState<DatasourceCollectionHealthSummary>(EMPTY_HEALTH_SUMMARY);
  const [healthItems, setHealthItems] = useState<DatasourceCollectionHealthItem[]>([]);

  const [createCollectorName, setCreateCollectorName] = useState('');
  const [createCollectorProvider, setCreateCollectorProvider] = useState<'match_snapshot' | 'manual_import'>('match_snapshot');
  const [createCollectorSchedule, setCreateCollectorSchedule] = useState('');
  const [createCollectorEnabled, setCreateCollectorEnabled] = useState(true);

  const [snapshotNotes, setSnapshotNotes] = useState('');
  const [snapshotReleaseChannel, setSnapshotReleaseChannel] = useState<CatalogChannel>('internal');

  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [isLoadingCollectors, setIsLoadingCollectors] = useState(false);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);

  const [isCreatingCollector, setIsCreatingCollector] = useState(false);
  const [isTogglingCollector, setIsTogglingCollector] = useState(false);
  const [isTriggeringRun, setIsTriggeringRun] = useState(false);
  const [snapshotActionId, setSnapshotActionId] = useState('');

  const selectedCollector = useMemo(
    () => collectors.find((collector) => collector.id === selectedCollectorId) || null,
    [collectors, selectedCollectorId],
  );

  async function refreshSources(preferredSourceId?: string) {
    setIsLoadingSources(true);
    try {
      const response = await listCatalogEntries('datasource', { limit: 100 });
      const nextEntries = [...response.data].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setSourceEntries(nextEntries);

      const keepCurrent = selectedSourceId && nextEntries.some((entry) => entry.itemId === selectedSourceId);
      const nextSourceId = preferredSourceId || (keepCurrent ? selectedSourceId : nextEntries[0]?.itemId || '');
      setSelectedSourceId(nextSourceId);

      if (!nextSourceId) {
        setCollectors([]);
        setRuns([]);
        setSnapshots([]);
        setHealthSummary(EMPTY_HEALTH_SUMMARY);
        setHealthItems([]);
      }
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsLoadingSources(false);
    }
  }

  async function refreshCollectors(sourceId: string) {
    if (!sourceId) {
      setCollectors([]);
      setSelectedCollectorId('');
      return;
    }

    setIsLoadingCollectors(true);
    try {
      const response = await listDatasourceCollectors({ sourceId, limit: 100 });
      const nextCollectors = [...response.data].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setCollectors(nextCollectors);

      const keepCurrent = selectedCollectorId && nextCollectors.some((collector) => collector.id === selectedCollectorId);
      const nextCollectorId = keepCurrent ? selectedCollectorId : nextCollectors[0]?.id || '';
      setSelectedCollectorId(nextCollectorId);

      if (!nextCollectorId) {
        setRuns([]);
        setSnapshots([]);
      }
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsLoadingCollectors(false);
    }
  }

  async function refreshRuns(collectorId: string) {
    if (!collectorId) {
      setRuns([]);
      return;
    }
    setIsLoadingRuns(true);
    try {
      const response = await listDatasourceCollectionRuns({ collectorId, limit: 40 });
      setRuns(response.data);
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsLoadingRuns(false);
    }
  }

  async function refreshSnapshots(collectorId: string) {
    if (!collectorId) {
      setSnapshots([]);
      return;
    }
    setIsLoadingSnapshots(true);
    try {
      const response = await listDatasourceCollectionSnapshots({ collectorId, limit: 40 });
      setSnapshots(response.data);
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsLoadingSnapshots(false);
    }
  }

  async function refreshHealth(sourceId: string) {
    if (!sourceId) {
      setHealthSummary(EMPTY_HEALTH_SUMMARY);
      setHealthItems([]);
      return;
    }
    setIsLoadingHealth(true);
    try {
      const response = await listDatasourceCollectionHealth({
        sourceId,
        includeDisabled: true,
        limit: 100,
      });
      setHealthSummary(response.summary);
      setHealthItems(response.data);
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsLoadingHealth(false);
    }
  }

  useEffect(() => {
    void refreshSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedSourceId) {
      return;
    }
    void refreshCollectors(selectedSourceId);
    void refreshHealth(selectedSourceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSourceId]);

  useEffect(() => {
    if (!selectedCollectorId) {
      return;
    }
    void refreshRuns(selectedCollectorId);
    void refreshSnapshots(selectedCollectorId);
  }, [selectedCollectorId]);

  async function handleCreateCollector() {
    if (!selectedSourceId || !createCollectorName.trim()) {
      setFeedback({ tone: 'error', message: 'Select source and enter collector name.' });
      return;
    }

    setIsCreatingCollector(true);
    try {
      const created = await createDatasourceCollector({
        sourceId: selectedSourceId,
        name: createCollectorName.trim(),
        provider: createCollectorProvider,
        scheduleCron: createCollectorSchedule.trim() || undefined,
        isEnabled: createCollectorEnabled,
      });
      setCreateCollectorName('');
      setFeedback({ tone: 'success', message: `Collector created: ${created.name}` });
      await refreshCollectors(selectedSourceId);
      setSelectedCollectorId(created.id);
      await refreshHealth(selectedSourceId);
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsCreatingCollector(false);
    }
  }

  async function handleToggleCollectorEnabled() {
    if (!selectedCollector) {
      setFeedback({ tone: 'error', message: 'Select collector first.' });
      return;
    }

    setIsTogglingCollector(true);
    try {
      await updateDatasourceCollector(selectedCollector.id, {
        isEnabled: !selectedCollector.isEnabled,
      });
      setFeedback({
        tone: 'success',
        message: `Collector ${selectedCollector.name} is now ${selectedCollector.isEnabled ? 'disabled' : 'enabled'}.`,
      });
      await refreshCollectors(selectedSourceId);
      await refreshHealth(selectedSourceId);
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsTogglingCollector(false);
    }
  }

  async function handleTriggerRun() {
    if (!selectedCollector) {
      setFeedback({ tone: 'error', message: 'Select collector first.' });
      return;
    }

    setIsTriggeringRun(true);
    try {
      const result = await triggerDatasourceCollectorRun(selectedCollector.id, {
        triggerType: 'manual',
        force: true,
      });
      setFeedback({ tone: 'success', message: `Triggered run ${result.run.id}.` });
      await refreshRuns(selectedCollector.id);
      await refreshSnapshots(selectedCollector.id);
      await refreshCollectors(selectedSourceId);
      await refreshHealth(selectedSourceId);
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setIsTriggeringRun(false);
    }
  }

  async function handleConfirmSnapshot(snapshotId: string, action: 'confirm' | 'reject') {
    setSnapshotActionId(snapshotId);
    try {
      await confirmDatasourceCollectionSnapshot(snapshotId, {
        action,
        notes: snapshotNotes.trim() || undefined,
      });
      setFeedback({ tone: 'success', message: `${action} snapshot: ${snapshotId}` });
      await refreshSnapshots(selectedCollectorId);
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setSnapshotActionId('');
    }
  }

  async function handleReleaseSnapshot(snapshotId: string) {
    setSnapshotActionId(snapshotId);
    try {
      await releaseDatasourceCollectionSnapshot(snapshotId, {
        channel: snapshotReleaseChannel,
      });
      setFeedback({ tone: 'success', message: `Released snapshot: ${snapshotId} -> ${snapshotReleaseChannel}` });
      await refreshSnapshots(selectedCollectorId);
      await refreshHealth(selectedSourceId);
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setSnapshotActionId('');
    }
  }

  async function handleReplaySnapshot(snapshotId: string) {
    setSnapshotActionId(snapshotId);
    try {
      await replayDatasourceCollectionSnapshot(snapshotId, {
        triggerType: 'manual',
        force: true,
      });
      setFeedback({ tone: 'success', message: `Replayed snapshot: ${snapshotId}` });
      await refreshRuns(selectedCollectorId);
      await refreshSnapshots(selectedCollectorId);
      await refreshHealth(selectedSourceId);
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error) });
    } finally {
      setSnapshotActionId('');
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4">
      <WorkspaceHeader
        title="Datasource Studio / Manage"
        description="Manage collectors, run history, snapshot confirmations, and collection health for each datasource."
      />
      <DomainStageTabs basePath={BASE_PATH} activeStage="manage" />

      {feedback && <FeedbackBanner feedback={feedback} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[330px_minmax(0,1fr)]">
        <Card className="border-zinc-800 bg-zinc-950">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Collector Scope</h2>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  void refreshSources(selectedSourceId);
                  if (selectedSourceId) {
                    void refreshCollectors(selectedSourceId);
                    void refreshHealth(selectedSourceId);
                  }
                }}
                disabled={isLoadingSources || isLoadingCollectors || isLoadingHealth}
              >
                {(isLoadingSources || isLoadingCollectors || isLoadingHealth)
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />}
                Refresh
              </Button>
            </div>

            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Datasource Item</label>
              <Select
                value={selectedSourceId || ''}
                onChange={(value) => setSelectedSourceId(value)}
                options={
                  sourceEntries.length > 0
                    ? toEntryOptions(sourceEntries)
                    : [{ value: '', label: 'No datasource available' }]
                }
              />
            </div>

            <div className="max-h-[220px] space-y-2 overflow-auto pr-1">
              {collectors.length === 0 && (
                <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                  {isLoadingCollectors ? 'Loading collectors...' : 'No collector in selected datasource.'}
                </div>
              )}
              {collectors.map((collector) => (
                <button
                  type="button"
                  key={collector.id}
                  onClick={() => setSelectedCollectorId(collector.id)}
                  className={`w-full rounded-lg border p-3 text-left text-[11px] transition-colors ${
                    selectedCollectorId === collector.id
                      ? 'border-sky-500/35 bg-sky-500/10 text-sky-200'
                      : 'border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <div className="font-semibold text-zinc-200">{collector.name}</div>
                  <div className="mt-1 text-zinc-500">{collector.provider} · {collector.isEnabled ? 'enabled' : 'disabled'}</div>
                  <div className="mt-1 text-zinc-500">lastRun: {collector.lastRunStatus} · {formatTime(collector.lastRunAt)}</div>
                </button>
              ))}
            </div>

            <div className="rounded-lg border border-white/10 bg-zinc-900 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Create Collector</h3>
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  value={createCollectorName}
                  onChange={(event) => setCreateCollectorName(event.target.value)}
                  placeholder="collector name"
                  className={INPUT_CLASS}
                />
                <Select
                  value={createCollectorProvider}
                  onChange={(value) => setCreateCollectorProvider(value as 'match_snapshot' | 'manual_import')}
                  options={COLLECTOR_PROVIDER_OPTIONS}
                />
                <input
                  type="text"
                  value={createCollectorSchedule}
                  onChange={(event) => setCreateCollectorSchedule(event.target.value)}
                  placeholder="schedule cron (optional)"
                  className={INPUT_CLASS}
                />
                <button
                  type="button"
                  onClick={() => setCreateCollectorEnabled((value) => !value)}
                  className={`w-full rounded-lg border px-3 py-2 text-xs transition-colors ${
                    createCollectorEnabled
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-white/10 bg-zinc-900 text-zinc-400'
                  }`}
                >
                  enabled: {createCollectorEnabled ? 'true' : 'false'}
                </button>
                <Button className="w-full gap-2" onClick={() => void handleCreateCollector()} disabled={isCreatingCollector}>
                  {isCreatingCollector ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create Collector
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => void handleToggleCollectorEnabled()}
                disabled={!selectedCollector || isTogglingCollector}
              >
                {isTogglingCollector ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Toggle Enabled
              </Button>
              <Button
                className="w-full gap-2"
                onClick={() => void handleTriggerRun()}
                disabled={!selectedCollector || isTriggeringRun}
              >
                {isTriggeringRun ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                Trigger Manual Run
              </Button>
            </div>
          </CardContent>
        </Card>

        <section className="space-y-4">
          <Card className="border-zinc-800 bg-zinc-950">
            <CardContent className="space-y-3 p-4">
              <h2 className="text-sm font-semibold text-white">Collection Health</h2>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
                <div className="rounded border border-white/10 bg-zinc-900 p-2 text-zinc-300">total: {healthSummary.total}</div>
                <div className="rounded border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-300">healthy: {healthSummary.healthy}</div>
                <div className="rounded border border-amber-500/20 bg-amber-500/10 p-2 text-amber-300">stale: {healthSummary.stale}</div>
                <div className="rounded border border-red-500/20 bg-red-500/10 p-2 text-red-300">failed: {healthSummary.failed}</div>
                <div className="rounded border border-white/10 bg-zinc-900 p-2 text-zinc-300">neverRun: {healthSummary.neverRun}</div>
                <div className="rounded border border-white/10 bg-zinc-900 p-2 text-zinc-300">disabled: {healthSummary.disabled}</div>
              </div>
              <div className="max-h-[200px] space-y-2 overflow-auto pr-1">
                {isLoadingHealth && (
                  <div className="text-xs text-zinc-500">Loading health...</div>
                )}
                {!isLoadingHealth && healthItems.length === 0 && (
                  <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                    No health item for current source.
                  </div>
                )}
                {healthItems.map((item) => (
                  <div key={item.collector.id} className="rounded-lg border border-white/10 bg-zinc-900 p-3 text-[11px] text-zinc-300">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-200">{item.collector.name}</span>
                      <span className="text-zinc-400">{item.health.status}</span>
                    </div>
                    <div className="mt-1 text-zinc-500">
                      lastRun: {item.health.lastRunStatus} · {formatTime(item.health.lastRunAt)}
                    </div>
                    {item.health.reasons.length > 0 && (
                      <div className="mt-1 text-zinc-500">reasons: {item.health.reasons.join(', ')}</div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-950">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Run History</h2>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => void refreshRuns(selectedCollectorId)}
                  disabled={!selectedCollectorId || isLoadingRuns}
                >
                  {isLoadingRuns ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Refresh
                </Button>
              </div>
              <div className="max-h-[240px] space-y-2 overflow-auto pr-1">
                {runs.length === 0 && (
                  <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                    No run record.
                  </div>
                )}
                {runs.map((run) => (
                  <div key={run.id} className="rounded-lg border border-white/10 bg-zinc-900 p-3 text-[11px] text-zinc-300">
                    <div className="flex items-center justify-between">
                      <span className="font-mono">{run.id}</span>
                      <span className={run.status === 'succeeded' ? 'text-emerald-400' : run.status === 'failed' ? 'text-red-400' : 'text-zinc-400'}>{run.status}</span>
                    </div>
                    <div className="mt-1 text-zinc-500">trigger: {run.triggerType} · source: {run.sourceId}</div>
                    <div className="mt-1 text-zinc-500">started: {formatTime(run.startedAt)} · finished: {formatTime(run.finishedAt)}</div>
                    {run.errorMessage && <div className="mt-1 text-red-300">error: {run.errorMessage}</div>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-950">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Snapshot Governance</h2>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => void refreshSnapshots(selectedCollectorId)}
                  disabled={!selectedCollectorId || isLoadingSnapshots}
                >
                  {isLoadingSnapshots ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Refresh
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <textarea
                  value={snapshotNotes}
                  onChange={(event) => setSnapshotNotes(event.target.value)}
                  placeholder="confirmation notes"
                  className={TEXTAREA_CLASS}
                />
                <div className="space-y-2">
                  <label className="block text-[11px] uppercase tracking-wider text-zinc-500">Release Channel</label>
                  <Select
                    value={snapshotReleaseChannel}
                    onChange={(value) => setSnapshotReleaseChannel(value as CatalogChannel)}
                    options={CHANNEL_OPTIONS}
                  />
                </div>
              </div>

              <div className="max-h-[340px] space-y-2 overflow-auto pr-1">
                {snapshots.length === 0 && (
                  <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                    No snapshot for selected collector.
                  </div>
                )}
                {snapshots.map((snapshot) => {
                  const activeAction = snapshotActionId === snapshot.id;
                  return (
                    <div key={snapshot.id} className="rounded-lg border border-white/10 bg-zinc-900 p-3 text-[11px] text-zinc-300">
                      <div className="flex items-center justify-between">
                        <span className="font-mono">{snapshot.id}</span>
                        <span className="text-zinc-400">records: {snapshot.recordCount}</span>
                      </div>
                      <div className="mt-1 text-zinc-500">
                        confirmation: {snapshot.confirmationStatus} · release: {snapshot.releaseStatus}
                        {snapshot.releaseChannel ? ` (${snapshot.releaseChannel})` : ''}
                      </div>
                      <div className="mt-1 text-zinc-500">created: {formatTime(snapshot.createdAt)}</div>

                      <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => void handleConfirmSnapshot(snapshot.id, 'confirm')}
                          disabled={activeAction}
                        >
                          {activeAction ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          Confirm
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => void handleConfirmSnapshot(snapshot.id, 'reject')}
                          disabled={activeAction}
                        >
                          {activeAction ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1"
                          onClick={() => void handleReleaseSnapshot(snapshot.id)}
                          disabled={activeAction}
                        >
                          {activeAction ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          Release
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => void handleReplaySnapshot(snapshot.id)}
                          disabled={activeAction}
                        >
                          {activeAction ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <History className="h-3.5 w-3.5" />}
                          Replay
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

export function DatasourcePublishPage() {
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
      const response = await listCatalogEntries('datasource', { limit: 100 });
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
      const response = await listCatalogRevisions('datasource', itemId, { limit: 100 });
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
        domain: 'datasource',
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
        domain: 'datasource',
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
      await publishCatalogRevision('datasource', selectedItemId, {
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
      await rollbackCatalogRevision('datasource', selectedItemId, {
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
        title="Datasource Studio / Publish"
        description="Validate, publish, and rollback datasource revisions with explicit release gates."
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
            <div className="mt-1 text-[11px]">Need validation status = succeeded and no failed checks.</div>
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
                No release activity yet for selected datasource.
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

