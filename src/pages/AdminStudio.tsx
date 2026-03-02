
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  GitCompare,
  History,
  Loader2,
  PackageCheck,
  PlayCircle,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Card, CardContent } from '@/src/components/ui/Card';
import { Select } from '@/src/components/ui/Select';
import {
  AdminCatalogDomain,
  AdminStudioApiError,
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

const DOMAIN_OPTIONS: Array<{ value: AdminCatalogDomain; label: string }> = [
  { value: 'datasource', label: 'Datasource' },
  { value: 'planning_template', label: 'Planning Template' },
  { value: 'animation_template', label: 'Animation Template' },
  { value: 'agent', label: 'Agent' },
  { value: 'skill', label: 'Skill' },
];

const CHANNEL_OPTIONS = [
  { value: 'internal', label: 'internal' },
  { value: 'beta', label: 'beta' },
  { value: 'stable', label: 'stable' },
];

const VALIDATION_TYPE_OPTIONS = [
  { value: 'catalog_validate', label: 'catalog_validate' },
  { value: 'pre_publish', label: 'pre_publish' },
  { value: 'post_publish', label: 'post_publish' },
];

const CONTEXT_MODE_OPTIONS = [
  { value: 'independent', label: 'independent' },
  { value: 'build_upon', label: 'build_upon' },
  { value: 'all', label: 'all' },
];

const AGENT_DEPENDENCY_MODE_OPTIONS = [
  { value: 'all', label: 'all' },
  { value: 'none', label: 'none' },
  { value: 'list', label: 'custom list' },
];

type FeedbackTone = 'success' | 'error' | 'info';

type PlanningContextMode = 'independent' | 'build_upon' | 'all';
type AgentDependencyMode = 'all' | 'none' | 'list';

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

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function parseCsvText(text: string) {
  return text
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function toCsvText(value: unknown) {
  if (!Array.isArray(value)) {
    return '';
  }
  return value
    .filter((item) => typeof item === 'string')
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

function toPlanningTemplateDraft(manifest: Record<string, unknown>, fallbackItemId: string): PlanningTemplateDraft {
  const segmentCandidates = Array.isArray(manifest.segments) ? manifest.segments : [];
  const segments = segmentCandidates
    .map((segment, index) => {
      const segmentRecord = asRecord(segment);
      const title = asRecord(segmentRecord.title);
      const focus = asRecord(segmentRecord.focus);
      const contextModeRaw = asText(segmentRecord.contextMode);
      const contextMode: PlanningContextMode =
        contextModeRaw === 'build_upon' || contextModeRaw === 'all' || contextModeRaw === 'independent'
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
  const segments = draft.segments.map((segment, index) => ({
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
  }));

  return {
    id: asText(draft.id),
    name: asText(draft.name),
    rule: asText(draft.rule),
    requiredAgents: parseCsvText(draft.requiredAgentsText),
    requiredSkills: parseCsvText(draft.requiredSkillsText),
    segments,
  };
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

function supportsStructuredBuilder(domain: AdminCatalogDomain) {
  return (
    domain === 'planning_template'
    || domain === 'animation_template'
    || domain === 'agent'
    || domain === 'skill'
  );
}

function toAnimationTemplateDraft(
  manifest: Record<string, unknown>,
  fallbackItemId: string,
): AnimationTemplateDraft {
  const schema = asRecord(manifest.schema);
  const example = asRecord(manifest.example);
  return {
    id: asText(manifest.id) || fallbackItemId || 'animation_template_item',
    name: asText(manifest.name) || 'Animation Template',
    description: asText(manifest.description) || 'Template declaration for animation rendering.',
    animationType: asText(manifest.animationType || manifest.type) || 'stats',
    templateId: asText(manifest.templateId) || 'stats-comparison',
    requiredParamsText: toCsvText(manifest.requiredParams),
    schemaJson: prettyJson(Object.keys(schema).length > 0 ? schema : {
      type: 'object',
      properties: {},
    }),
    exampleJson: prettyJson(Object.keys(example).length > 0 ? example : {}),
  };
}

function toAnimationTemplateManifest(draft: AnimationTemplateDraft) {
  return {
    id: asText(draft.id),
    name: asText(draft.name),
    description: asText(draft.description),
    animationType: asText(draft.animationType),
    templateId: asText(draft.templateId),
    requiredParams: parseCsvText(draft.requiredParamsText),
    schema: parseJsonObjectText(draft.schemaJson, 'Animation schema'),
    example: parseJsonObjectText(draft.exampleJson, 'Animation example'),
  };
}

function toAgentManifestDraft(
  manifest: Record<string, unknown>,
  fallbackItemId: string,
): AgentManifestDraft {
  const rolePrompt = asRecord(manifest.rolePrompt);
  const contextDependencies = manifest.contextDependencies;
  let contextDependencyMode: AgentDependencyMode = 'list';
  let contextDependenciesText = '';

  if (contextDependencies === 'all' || contextDependencies === 'none') {
    contextDependencyMode = contextDependencies;
  } else if (Array.isArray(contextDependencies)) {
    contextDependencyMode = 'list';
    contextDependenciesText = contextDependencies
      .filter((item): item is string => typeof item === 'string')
      .join(', ');
  } else {
    contextDependencyMode = 'all';
  }

  return {
    id: asText(manifest.id) || fallbackItemId || 'agent_item',
    name: asText(manifest.name) || 'Agent',
    description: asText(manifest.description) || 'Agent manifest for admin studio.',
    minAppVersion: asText(manifest.minAppVersion),
    rolePromptEn: asText(rolePrompt.en),
    rolePromptZh: asText(rolePrompt.zh),
    skillsText: toCsvText(manifest.skills),
    contextDependencyMode,
    contextDependenciesText,
  };
}

function toAgentManifest(draft: AgentManifestDraft) {
  const dependencyField = draft.contextDependencyMode === 'list'
    ? parseCsvText(draft.contextDependenciesText)
    : draft.contextDependencyMode;

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
    contextDependencies: dependencyField,
  };
}

function toSkillManifestDraft(
  manifest: Record<string, unknown>,
  fallbackItemId: string,
): SkillManifestDraft {
  const declaration = asRecord(manifest.declaration);
  const runtime = asRecord(manifest.runtime);
  const parameters = asRecord(declaration.parameters);
  const fallbackId = asText(manifest.id) || fallbackItemId || 'skill_item';

  return {
    id: fallbackId,
    name: asText(manifest.name) || 'Skill',
    description: asText(manifest.description) || 'Skill manifest for admin studio.',
    minAppVersion: asText(manifest.minAppVersion),
    declarationName: asText(declaration.name) || fallbackId,
    declarationDescription: asText(declaration.description),
    parametersJson: prettyJson(Object.keys(parameters).length > 0 ? parameters : {
      type: 'object',
      properties: {},
    }),
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
      parameters: parseJsonObjectText(draft.parametersJson, 'Skill declaration.parameters'),
    },
    runtime: {
      mode: 'builtin_alias',
      targetSkill: asText(draft.targetSkill),
    },
  };
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function formatTime(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function summarizeError(error: unknown) {
  if (error instanceof AdminStudioApiError) {
    const codePart = error.code ? `[${error.code}] ` : '';
    return `${codePart}${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}

function starterManifest(domain: AdminCatalogDomain, itemIdSeed = 'new_item') {
  if (domain === 'datasource') {
    return {
      id: itemIdSeed,
      name: 'New Datasource',
      fields: [
        {
          id: 'league',
          type: 'text',
          path: ['league'],
        },
      ],
      requiredPermissions: ['datasource:use:market'],
    };
  }

  if (domain === 'planning_template') {
    return {
      id: itemIdSeed,
      name: 'New Planning Template',
      rule: 'Use one concise segment for baseline analysis.',
      requiredAgents: ['overview'],
      requiredSkills: ['select_plan_template_v2'],
      segments: [
        {
          id: 'segment_1',
          agentType: 'overview',
          title: {
            en: 'Overview',
            zh: 'Overview (ZH)',
          },
          focus: {
            en: 'Summarize current form and momentum.',
            zh: 'Summarize current form and momentum (ZH).',
          },
          contextMode: 'independent',
        },
      ],
    };
  }

  if (domain === 'animation_template') {
    return {
      id: itemIdSeed,
      name: 'New Animation Template',
      description: 'Animation template declaration for remotion rendering.',
      animationType: 'stats',
      templateId: 'stats-comparison',
      requiredParams: ['metric', 'homeValue', 'awayValue'],
      schema: {
        type: 'object',
        properties: {},
      },
      example: {},
    };
  }

  if (domain === 'agent') {
    return {
      kind: 'agent',
      id: itemIdSeed,
      name: 'New Agent',
      description: 'Agent manifest created from Admin Studio.',
      rolePrompt: {
        en: 'You are a helpful analyst.',
        zh: 'You are a helpful analyst in zh.',
      },
      skills: ['calculator'],
      contextDependencies: 'all',
    };
  }

  if (domain === 'skill') {
    return {
      kind: 'skill',
      id: itemIdSeed,
      name: 'New Skill',
      description: 'Skill alias manifest created from Admin Studio.',
      declaration: {
        name: itemIdSeed,
        description: 'Runtime callable skill alias.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      runtime: {
        mode: 'builtin_alias',
        targetSkill: 'select_plan_template',
      },
    };
  }

  return {
    id: itemIdSeed,
    name: `New ${domain}`,
    notes: 'Edit this manifest before saving.',
  };
}

function parseManifest(text: string) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Manifest must be a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

export default function AdminStudio() {
  const navigate = useNavigate();
  const [domain, setDomain] = useState<AdminCatalogDomain>('datasource');
  const [entrySearch, setEntrySearch] = useState('');
  const [entries, setEntries] = useState<Array<{
    itemId: string;
    latestVersion: string;
    latestStatus: string;
    latestChannel: string;
    updatedAt: string;
  }>>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);

  const [selectedItemId, setSelectedItemId] = useState('');
  const [revisions, setRevisions] = useState<CatalogRevision[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState('');

  const [manifestEditor, setManifestEditor] = useState(prettyJson(starterManifest('datasource')));
  const [showRawManifestEditor, setShowRawManifestEditor] = useState(true);
  const [planningDraft, setPlanningDraft] = useState<PlanningTemplateDraft | null>(null);
  const [animationTemplateDraft, setAnimationTemplateDraft] = useState<AnimationTemplateDraft | null>(null);
  const [agentDraft, setAgentDraft] = useState<AgentManifestDraft | null>(null);
  const [skillDraft, setSkillDraft] = useState<SkillManifestDraft | null>(null);
  const [editChannel, setEditChannel] = useState('internal');
  const [publishChannel, setPublishChannel] = useState('stable');
  const [validationType, setValidationType] = useState('catalog_validate');
  const [publishWizardOpen, setPublishWizardOpen] = useState(false);
  const [publishNotes, setPublishNotes] = useState('');

  const [newItemId, setNewItemId] = useState('');
  const [newItemVersion, setNewItemVersion] = useState('1.0.0');
  const [newItemManifestText, setNewItemManifestText] = useState(prettyJson(starterManifest('datasource')));

  const [newRevisionVersion, setNewRevisionVersion] = useState('1.0.1');
  const [diffFromVersion, setDiffFromVersion] = useState('');
  const [diffResult, setDiffResult] = useState<ManifestDiffResult | null>(null);

  const [validationRun, setValidationRun] = useState<ValidationRunRecord | null>(null);
  const [validationLookupRunId, setValidationLookupRunId] = useState('');
  const [releaseHistory, setReleaseHistory] = useState<ReleaseRecord[]>([]);
  const [selectedReleaseRecordId, setSelectedReleaseRecordId] = useState('');
  const [releaseHistorySearch, setReleaseHistorySearch] = useState('');
  const [releaseHistoryChannelFilter, setReleaseHistoryChannelFilter] = useState('all');

  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isCreatingItem, setIsCreatingItem] = useState(false);
  const [isCreatingRevision, setIsCreatingRevision] = useState(false);
  const [isDiffing, setIsDiffing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isFetchingValidationRun, setIsFetchingValidationRun] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRollbacking, setIsRollbacking] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const [feedback, setFeedback] = useState<{ tone: FeedbackTone; message: string } | null>(null);

  const selectedRevision = useMemo(
    () => revisions.find((revision) => revision.version === selectedVersion) || null,
    [revisions, selectedVersion],
  );

  const diffFromOptions = useMemo(
    () =>
      revisions
        .filter((revision) => revision.version !== selectedVersion)
        .map((revision) => ({ value: revision.version, label: revision.version })),
    [revisions, selectedVersion],
  );

  const revisionOptions = useMemo(
    () =>
      revisions.map((revision) => ({
        value: revision.version,
        label: `${revision.version} (${revision.status})`,
      })),
    [revisions],
  );

  const publishGate = useMemo(() => {
    const summary = asRecord(selectedRevision?.validationSummary);
    const mode = asText(summary.mode);
    const status = asText(summary.status);
    const failedChecks = Array.isArray(summary.failedChecks)
      ? summary.failedChecks.filter((item): item is string => typeof item === 'string')
      : [];
    const passed = mode === 'validation_run' && status === 'succeeded' && failedChecks.length === 0;
    return {
      summary,
      mode,
      status,
      failedChecks,
      passed,
      checkedAt: asText(summary.checkedAt),
    };
  }, [selectedRevision]);

  function resetEditorForDomain(nextDomain: AdminCatalogDomain) {
    const starter = starterManifest(nextDomain);
    setSelectedItemId('');
    setRevisions([]);
    setSelectedVersion('');
    setDiffResult(null);
    setValidationRun(null);
    setValidationLookupRunId('');
    setNewItemId('');
    setNewItemVersion('1.0.0');
    setNewRevisionVersion('1.0.1');
    setManifestEditor(prettyJson(starter));
    setNewItemManifestText(prettyJson(starter));
    setPlanningDraft(nextDomain === 'planning_template'
      ? toPlanningTemplateDraft(starter as Record<string, unknown>, 'new_template')
      : null);
    setAnimationTemplateDraft(nextDomain === 'animation_template'
      ? toAnimationTemplateDraft(starter as Record<string, unknown>, 'new_animation_template')
      : null);
    setAgentDraft(nextDomain === 'agent'
      ? toAgentManifestDraft(starter as Record<string, unknown>, 'new_agent')
      : null);
    setSkillDraft(nextDomain === 'skill'
      ? toSkillManifestDraft(starter as Record<string, unknown>, 'new_skill')
      : null);
    setShowRawManifestEditor(!supportsStructuredBuilder(nextDomain));
    setPublishWizardOpen(false);
    setPublishNotes('');
    setSelectedReleaseRecordId('');
    setReleaseHistorySearch('');
    setReleaseHistoryChannelFilter('all');
    setFeedback(null);
  }

  async function refreshEntries() {
    setEntriesLoading(true);
    try {
      const result = await listCatalogEntries(domain, {
        search: entrySearch.trim() || undefined,
        limit: 100,
      });
      setEntries(result.data || []);
      if (result.data.length === 0) {
        setSelectedItemId('');
        setRevisions([]);
        setSelectedVersion('');
      } else if (!selectedItemId) {
        setSelectedItemId(result.data[0].itemId);
      }
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setEntriesLoading(false);
    }
  }

  async function refreshRevisions(itemId: string) {
    if (!itemId) {
      setRevisions([]);
      setSelectedVersion('');
      return;
    }

    setRevisionsLoading(true);
    try {
      const result = await listCatalogRevisions(domain, itemId, { limit: 100 });
      const nextRevisions = result.data || [];
      setRevisions(nextRevisions);

      if (nextRevisions.length === 0) {
        setSelectedVersion('');
        const starter = starterManifest(domain, itemId);
        setManifestEditor(prettyJson(starter));
        setPlanningDraft(domain === 'planning_template'
          ? toPlanningTemplateDraft(starter as Record<string, unknown>, itemId)
          : null);
        setAnimationTemplateDraft(domain === 'animation_template'
          ? toAnimationTemplateDraft(starter as Record<string, unknown>, itemId)
          : null);
        setAgentDraft(domain === 'agent'
          ? toAgentManifestDraft(starter as Record<string, unknown>, itemId)
          : null);
        setSkillDraft(domain === 'skill'
          ? toSkillManifestDraft(starter as Record<string, unknown>, itemId)
          : null);
        setEditChannel('internal');
        return;
      }

      const hasCurrentSelected = nextRevisions.some(
        (revision) => revision.version === selectedVersion,
      );
      const nextSelected = hasCurrentSelected ? selectedVersion : nextRevisions[0].version;
      setSelectedVersion(nextSelected);

      const selected =
        nextRevisions.find((revision) => revision.version === nextSelected) ||
        nextRevisions[0];
      setManifestEditor(prettyJson(selected.manifest || {}));
      setEditChannel(selected.channel || 'internal');

      const fallbackDiffFrom =
        nextRevisions.find((revision) => revision.version !== nextSelected)?.version || '';
      setDiffFromVersion((previous) => {
        if (
          previous &&
          previous !== nextSelected &&
          nextRevisions.some((revision) => revision.version === previous)
        ) {
          return previous;
        }
        return fallbackDiffFrom;
      });
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setRevisionsLoading(false);
    }
  }

  async function refreshReleaseHistory() {
    setIsHistoryLoading(true);
    try {
      const channelFilter =
        releaseHistoryChannelFilter !== 'all'
          ? releaseHistoryChannelFilter
          : undefined;
      const result = await listReleaseHistory({
        domain,
        channel: channelFilter as 'internal' | 'beta' | 'stable' | undefined,
        limit: 30,
      });
      setReleaseHistory(result.data || []);
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setIsHistoryLoading(false);
    }
  }

  useEffect(() => {
    void refreshEntries();
    void refreshReleaseHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, releaseHistoryChannelFilter]);

  useEffect(() => {
    if (!selectedItemId) {
      setRevisions([]);
      setSelectedVersion('');
      return;
    }
    void refreshRevisions(selectedItemId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemId, domain]);

  useEffect(() => {
    if (!selectedRevision) {
      setPlanningDraft(null);
      setAnimationTemplateDraft(null);
      setAgentDraft(null);
      setSkillDraft(null);
      return;
    }
    setManifestEditor(prettyJson(selectedRevision.manifest || {}));
    setEditChannel(selectedRevision.channel || 'internal');
    setPublishWizardOpen(false);
    setPublishNotes('');

    const itemId = selectedItemId || selectedRevision.itemId;
    setPlanningDraft(
      domain === 'planning_template'
        ? toPlanningTemplateDraft(selectedRevision.manifest || {}, itemId)
        : null,
    );
    setAnimationTemplateDraft(
      domain === 'animation_template'
        ? toAnimationTemplateDraft(selectedRevision.manifest || {}, itemId)
        : null,
    );
    setAgentDraft(
      domain === 'agent'
        ? toAgentManifestDraft(selectedRevision.manifest || {}, itemId)
        : null,
    );
    setSkillDraft(
      domain === 'skill'
        ? toSkillManifestDraft(selectedRevision.manifest || {}, itemId)
        : null,
    );
  }, [selectedRevision, domain, selectedItemId]);

  useEffect(() => {
    let nextManifest: string | null = null;
    if (domain === 'planning_template' && planningDraft) {
      nextManifest = prettyJson(toPlanningTemplateManifest(planningDraft));
    }
    if (domain === 'animation_template' && animationTemplateDraft) {
      nextManifest = prettyJson(toAnimationTemplateManifest(animationTemplateDraft));
    }
    if (domain === 'agent' && agentDraft) {
      nextManifest = prettyJson(toAgentManifest(agentDraft));
    }
    if (domain === 'skill' && skillDraft) {
      nextManifest = prettyJson(toSkillManifest(skillDraft));
    }
    if (!nextManifest) {
      return;
    }
    setManifestEditor((previous) => (previous === nextManifest ? previous : nextManifest));
  }, [domain, planningDraft, animationTemplateDraft, agentDraft, skillDraft]);

  function readCurrentManifestForWrite() {
    if (domain === 'planning_template' && planningDraft) {
      return toPlanningTemplateManifest(planningDraft);
    }
    if (domain === 'animation_template' && animationTemplateDraft) {
      return toAnimationTemplateManifest(animationTemplateDraft);
    }
    if (domain === 'agent' && agentDraft) {
      return toAgentManifest(agentDraft);
    }
    if (domain === 'skill' && skillDraft) {
      return toSkillManifest(skillDraft);
    }
    return parseManifest(manifestEditor);
  }

  function updatePlanningDraft(patch: Partial<PlanningTemplateDraft>) {
    setPlanningDraft((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        ...patch,
      };
    });
  }

  function updateAnimationTemplateDraft(patch: Partial<AnimationTemplateDraft>) {
    setAnimationTemplateDraft((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        ...patch,
      };
    });
  }

  function updateAgentDraft(patch: Partial<AgentManifestDraft>) {
    setAgentDraft((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        ...patch,
      };
    });
  }

  function updateSkillDraft(patch: Partial<SkillManifestDraft>) {
    setSkillDraft((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        ...patch,
      };
    });
  }

  function updatePlanningSegment(index: number, patch: Partial<PlanningSegmentDraft>) {
    setPlanningDraft((previous) => {
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
  }

  function addPlanningSegment() {
    setPlanningDraft((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        segments: [
          ...previous.segments,
          buildDefaultPlanningSegment(previous.segments.length, 'build_upon'),
        ],
      };
    });
  }

  function removePlanningSegment(index: number) {
    setPlanningDraft((previous) => {
      if (!previous || previous.segments.length <= 1) {
        return previous;
      }
      const nextSegments = previous.segments.filter((_, segmentIndex) => segmentIndex !== index);
      return {
        ...previous,
        segments: nextSegments.map((segment, segmentIndex) => ({
          ...segment,
          contextMode: segmentIndex === 0 ? 'independent' : segment.contextMode,
        })),
      };
    });
  }

  function handleLoadRawJsonToBuilder() {
    try {
      const parsed = parseManifest(manifestEditor);
      if (domain === 'planning_template') {
        setPlanningDraft(toPlanningTemplateDraft(parsed, selectedItemId || 'planning_template_item'));
      }
      if (domain === 'animation_template') {
        setAnimationTemplateDraft(toAnimationTemplateDraft(parsed, selectedItemId || 'animation_template_item'));
      }
      if (domain === 'agent') {
        setAgentDraft(toAgentManifestDraft(parsed, selectedItemId || 'agent_item'));
      }
      if (domain === 'skill') {
        setSkillDraft(toSkillManifestDraft(parsed, selectedItemId || 'skill_item'));
      }
      setFeedback({ tone: 'success', message: 'Builder loaded from raw JSON manifest.' });
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    }
  }

  async function handleCreateItem() {
    if (!newItemId.trim()) {
      setFeedback({ tone: 'error', message: 'itemId is required.' });
      return;
    }

    setIsCreatingItem(true);
    try {
      const manifest = parseManifest(newItemManifestText);
      await createCatalogEntry(domain, {
        itemId: newItemId.trim(),
        version: newItemVersion.trim() || '1.0.0',
        manifest,
        status: 'draft',
        channel: editChannel as 'internal' | 'beta' | 'stable',
      });
      setFeedback({
        tone: 'success',
        message: `Created ${domain}:${newItemId}@${newItemVersion}.`,
      });
      setSelectedItemId(newItemId.trim());
      await refreshEntries();
      await refreshRevisions(newItemId.trim());
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setIsCreatingItem(false);
    }
  }

  async function handleCreateRevision() {
    if (!selectedItemId || !newRevisionVersion.trim()) {
      setFeedback({ tone: 'error', message: 'Select item and fill new version first.' });
      return;
    }

    setIsCreatingRevision(true);
    try {
      const manifest = readCurrentManifestForWrite();
      await createCatalogRevision(domain, selectedItemId, {
        version: newRevisionVersion.trim(),
        manifest,
        status: 'draft',
        channel: editChannel as 'internal' | 'beta' | 'stable',
      });
      setFeedback({
        tone: 'success',
        message: `Created revision ${selectedItemId}@${newRevisionVersion.trim()}.`,
      });
      await refreshRevisions(selectedItemId);
      setSelectedVersion(newRevisionVersion.trim());
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setIsCreatingRevision(false);
    }
  }

  async function handleSaveDraft() {
    if (!selectedItemId || !selectedVersion) {
      setFeedback({ tone: 'error', message: 'Select a revision first.' });
      return;
    }

    setIsSavingDraft(true);
    try {
      const manifest = readCurrentManifestForWrite();
      await updateCatalogDraftRevision(domain, selectedItemId, selectedVersion, {
        manifest,
        channel: editChannel as 'internal' | 'beta' | 'stable',
      });
      setFeedback({ tone: 'success', message: `Draft ${selectedItemId}@${selectedVersion} saved.` });
      await refreshRevisions(selectedItemId);
      await refreshEntries();
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function handleDiff() {
    if (!selectedItemId || !selectedVersion || !diffFromVersion) {
      setFeedback({ tone: 'error', message: 'Select from/to versions for diff.' });
      return;
    }

    setIsDiffing(true);
    try {
      const result = await getCatalogRevisionDiff(
        domain,
        selectedItemId,
        diffFromVersion,
        selectedVersion,
      );
      setDiffResult(result);
      setFeedback({
        tone: 'success',
        message: `Diff loaded: ${diffFromVersion} -> ${selectedVersion}.`,
      });
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setIsDiffing(false);
    }
  }

  async function handleValidate() {
    if (!selectedItemId || !selectedVersion) {
      setFeedback({ tone: 'error', message: 'Select a revision first.' });
      return;
    }

    setIsValidating(true);
    try {
      const started = await runCatalogValidation({
        domain,
        itemId: selectedItemId,
        version: selectedVersion,
        runType: validationType as 'catalog_validate' | 'pre_publish' | 'post_publish',
      });
      const finished = await getValidationRun(started.id);
      setValidationRun(finished);
      setValidationLookupRunId(finished.id);

      if (finished.status === 'succeeded') {
        setFeedback({
          tone: 'success',
          message: `Validation succeeded for ${selectedItemId}@${selectedVersion}.`,
        });
      } else {
        setFeedback({
          tone: 'error',
          message: `Validation ${finished.status} for ${selectedItemId}@${selectedVersion}.`,
        });
      }
      await refreshRevisions(selectedItemId);
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setIsValidating(false);
    }
  }

  async function loadValidationRunById(runId: string) {
    const normalizedRunId = runId.trim();
    if (!normalizedRunId) {
      setFeedback({ tone: 'error', message: 'Please input a runId to load validation result.' });
      return;
    }

    setIsFetchingValidationRun(true);
    try {
      const fetched = await getValidationRun(normalizedRunId);
      setValidationRun(fetched);
      setValidationLookupRunId(fetched.id);
      setFeedback({ tone: 'success', message: `Validation run ${fetched.id} loaded.` });
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setIsFetchingValidationRun(false);
    }
  }

  async function handleFetchValidationRun() {
    await loadValidationRunById(validationLookupRunId);
  }

  async function handleSelectReleaseRecord(record: ReleaseRecord) {
    setSelectedReleaseRecordId(record.id);
    setPublishChannel(record.channel);
    setReleaseHistorySearch(record.itemId);
    setFeedback({
      tone: 'info',
      message: `Selected release ${record.id} (${record.action}) for ${record.itemId}@${record.toVersion}.`,
    });
    if (record.validationRunId) {
      await loadValidationRunById(record.validationRunId);
    }
  }

  async function handlePublish(input: { notes?: string } = {}) {
    if (!selectedItemId || !selectedVersion) {
      setFeedback({ tone: 'error', message: 'Select a revision first.' });
      return;
    }
    if (!publishGate.passed) {
      setPublishWizardOpen(true);
      setFeedback({
        tone: 'error',
        message: 'Publish is blocked. Run validation and ensure status is succeeded before publish.',
      });
      return;
    }

    setIsPublishing(true);
    try {
      const releaseRecord = await publishCatalogRevision(domain, selectedItemId, {
        version: selectedVersion,
        channel: publishChannel as 'internal' | 'beta' | 'stable',
        validationRunId: validationRun?.id || undefined,
        notes: input.notes?.trim() || undefined,
      });
      setFeedback({
        tone: 'success',
        message: `Published ${selectedItemId}@${selectedVersion} to ${publishChannel}. Release ${releaseRecord.id}.`,
      });
      setPublishWizardOpen(false);
      setPublishNotes('');
      await refreshRevisions(selectedItemId);
      await refreshEntries();
      await refreshReleaseHistory();
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleRollback() {
    if (!selectedItemId || !selectedVersion) {
      setFeedback({ tone: 'error', message: 'Select a target revision first.' });
      return;
    }

    setIsRollbacking(true);
    try {
      const releaseRecord = await rollbackCatalogRevision(domain, selectedItemId, {
        targetVersion: selectedVersion,
        channel: publishChannel as 'internal' | 'beta' | 'stable',
        validationRunId: validationRun?.id || undefined,
      });
      setFeedback({
        tone: 'success',
        message: `Rollback completed to ${selectedVersion}. Release ${releaseRecord.id}.`,
      });
      await refreshRevisions(selectedItemId);
      await refreshEntries();
      await refreshReleaseHistory();
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setIsRollbacking(false);
    }
  }

  const validationChecks = useMemo(() => {
    const checks = (validationRun?.result as { checks?: unknown } | undefined)?.checks;
    return Array.isArray(checks) ? checks : [];
  }, [validationRun]);

  const filteredReleaseHistory = useMemo(() => {
    const query = releaseHistorySearch.trim().toLowerCase();
    if (!query) {
      return releaseHistory;
    }
    return releaseHistory.filter((record) => record.itemId.toLowerCase().includes(query));
  }, [releaseHistory, releaseHistorySearch]);

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans pb-10">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/85 px-4 pb-4 pt-4 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full border border-white/10 bg-zinc-900"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white">Admin Studio 2.0</h1>
              <p className="text-xs text-zinc-500">Catalog editor + validation + release workflow</p>
            </div>
          </div>
          <div className="min-w-[220px] sm:w-72">
            <Select
              value={domain}
              onChange={(value) => {
                const nextDomain = value as AdminCatalogDomain;
                setDomain(nextDomain);
                resetEditorForDomain(nextDomain);
              }}
              options={DOMAIN_OPTIONS}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-4 pt-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className="space-y-4">
          <Card className="border-zinc-800 bg-zinc-950">
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Catalog Entries</h2>
                <Button variant="outline" size="sm" onClick={() => void refreshEntries()} disabled={entriesLoading}>
                  {entriesLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                  Refresh
                </Button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={entrySearch}
                  onChange={(event) => setEntrySearch(event.target.value)}
                  placeholder="Search itemId"
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
                <Button size="sm" onClick={() => void refreshEntries()} disabled={entriesLoading}>
                  Go
                </Button>
              </div>
              <div className="max-h-[340px] space-y-2 overflow-auto pr-1">
                {entries.length === 0 && (
                  <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                    No catalog entries in current domain.
                  </div>
                )}
                {entries.map((entry) => {
                  const active = selectedItemId === entry.itemId;
                  return (
                    <button
                      key={entry.itemId}
                      type="button"
                      onClick={() => setSelectedItemId(entry.itemId)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                        active
                          ? 'border-emerald-500/40 bg-emerald-500/10'
                          : 'border-white/10 bg-zinc-900 hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-white">{entry.itemId}</span>
                        <span className="rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-zinc-300">
                          {entry.latestVersion}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-500">
                        <span>{entry.latestStatus}</span>
                        <span>{entry.latestChannel}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-950">
            <CardContent className="space-y-3 p-4">
              <h2 className="text-sm font-semibold text-white">Create New Item</h2>
              <div className="grid grid-cols-1 gap-2">
                <input
                  type="text"
                  value={newItemId}
                  onChange={(event) => setNewItemId(event.target.value)}
                  placeholder="itemId (e.g. market_source_v2)"
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={newItemVersion}
                  onChange={(event) => setNewItemVersion(event.target.value)}
                  placeholder="version (e.g. 1.0.0)"
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <textarea
                value={newItemManifestText}
                onChange={(event) => setNewItemManifestText(event.target.value)}
                spellCheck={false}
                className="min-h-[180px] w-full rounded-lg border border-white/10 bg-zinc-900 p-3 font-mono text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
              <Button onClick={() => void handleCreateItem()} disabled={isCreatingItem} className="w-full gap-2">
                {isCreatingItem ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Create Item
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          {feedback && (
            <div
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                feedback.tone === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : feedback.tone === 'error'
                    ? 'border-red-500/30 bg-red-500/10 text-red-300'
                    : 'border-blue-500/30 bg-blue-500/10 text-blue-300'
              }`}
            >
              {feedback.tone === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
              {feedback.tone === 'error' && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
              {feedback.tone === 'info' && <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
          )}

          <Card className="border-zinc-800 bg-zinc-950">
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-white">Revision Editor</h2>
                  <p className="text-xs text-zinc-500">
                    Item: <span className="font-mono text-zinc-300">{selectedItemId || '-'}</span>
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selectedItemId || revisionsLoading}
                  onClick={() => selectedItemId && void refreshRevisions(selectedItemId)}
                >
                  {revisionsLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                  Revisions
                </Button>
              </div>

              {!selectedItemId && (
                <div className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-zinc-500">
                  Select or create a catalog item to start editing.
                </div>
              )}

              {selectedItemId && (
                <>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Revision</label>
                      {revisionOptions.length > 0 ? (
                        <Select
                          value={selectedVersion || revisionOptions[0].value}
                          onChange={(value) => setSelectedVersion(value)}
                          options={revisionOptions}
                        />
                      ) : (
                        <div className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-500">
                          No revisions yet.
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Draft Channel</label>
                      <Select
                        value={editChannel}
                        onChange={(value) => setEditChannel(value)}
                        options={CHANNEL_OPTIONS}
                      />
                    </div>
                  </div>

                  {selectedRevision && (
                    <div className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-[11px] text-zinc-400">
                      <div className="flex flex-wrap items-center gap-4">
                        <span>Status: <span className="text-zinc-200">{selectedRevision.status}</span></span>
                        <span>Updated: <span className="text-zinc-200">{formatTime(selectedRevision.updatedAt)}</span></span>
                        <span>Checksum: <span className="font-mono text-zinc-300">{selectedRevision.checksum || '-'}</span></span>
                      </div>
                    </div>
                  )}

                  {domain === 'planning_template' && planningDraft && (
                    <div className="space-y-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                            Planning Template Builder
                          </h3>
                          <p className="text-[11px] text-zinc-400">
                            Structured editor for `rule`, `requiredAgents/requiredSkills`, and `segments`.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={handleLoadRawJsonToBuilder}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Load JSON
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => setShowRawManifestEditor((previous) => !previous)}
                          >
                            {showRawManifestEditor ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            {showRawManifestEditor ? 'Hide JSON' : 'Show JSON'}
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-[11px] uppercase tracking-wider text-zinc-500">Template ID</label>
                          <input
                            type="text"
                            value={planningDraft.id}
                            onChange={(event) => updatePlanningDraft({ id: event.target.value })}
                            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] uppercase tracking-wider text-zinc-500">Template Name</label>
                          <input
                            type="text"
                            value={planningDraft.name}
                            onChange={(event) => updatePlanningDraft({ name: event.target.value })}
                            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] uppercase tracking-wider text-zinc-500">Rule</label>
                        <textarea
                          value={planningDraft.rule}
                          onChange={(event) => updatePlanningDraft({ rule: event.target.value })}
                          spellCheck={false}
                          className="min-h-[64px] w-full rounded-lg border border-white/10 bg-zinc-900 p-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-[11px] uppercase tracking-wider text-zinc-500">
                            Required Agents (comma-separated)
                          </label>
                          <input
                            type="text"
                            value={planningDraft.requiredAgentsText}
                            onChange={(event) => updatePlanningDraft({ requiredAgentsText: event.target.value })}
                            placeholder="overview, momentum_agent"
                            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] uppercase tracking-wider text-zinc-500">
                            Required Skills (comma-separated)
                          </label>
                          <input
                            type="text"
                            value={planningDraft.requiredSkillsText}
                            onChange={(event) => updatePlanningDraft({ requiredSkillsText: event.target.value })}
                            placeholder="select_plan_template_v2"
                            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                            Segments ({planningDraft.segments.length})
                          </p>
                          <Button variant="outline" size="sm" className="gap-1" onClick={addPlanningSegment}>
                            <Plus className="h-3.5 w-3.5" />
                            Add Segment
                          </Button>
                        </div>
                        <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
                          {planningDraft.segments.map((segment, segmentIndex) => (
                            <div key={`${segment.id}-${segmentIndex}`} className="space-y-2 rounded-lg border border-white/10 bg-zinc-900 p-3">
                              <div className="flex items-center justify-between">
                                <div className="text-xs font-semibold text-zinc-200">
                                  Segment {segmentIndex + 1}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1 text-red-300 hover:text-red-200"
                                  onClick={() => removePlanningSegment(segmentIndex)}
                                  disabled={planningDraft.segments.length <= 1}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Remove
                                </Button>
                              </div>

                              <div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
                                <input
                                  type="text"
                                  value={segment.id}
                                  onChange={(event) => updatePlanningSegment(segmentIndex, { id: event.target.value })}
                                  placeholder="segment id"
                                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                />
                                <input
                                  type="text"
                                  value={segment.agentType}
                                  onChange={(event) => updatePlanningSegment(segmentIndex, { agentType: event.target.value })}
                                  placeholder="agentType"
                                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                />
                                <Select
                                  value={segment.contextMode}
                                  onChange={(value) => updatePlanningSegment(segmentIndex, { contextMode: value as PlanningContextMode })}
                                  options={CONTEXT_MODE_OPTIONS}
                                />
                              </div>

                              <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                                <input
                                  type="text"
                                  value={segment.titleEn}
                                  onChange={(event) => updatePlanningSegment(segmentIndex, { titleEn: event.target.value })}
                                  placeholder="title.en"
                                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                />
                                <input
                                  type="text"
                                  value={segment.titleZh}
                                  onChange={(event) => updatePlanningSegment(segmentIndex, { titleZh: event.target.value })}
                                  placeholder="title.zh"
                                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                />
                              </div>

                              <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                                <textarea
                                  value={segment.focusEn}
                                  onChange={(event) => updatePlanningSegment(segmentIndex, { focusEn: event.target.value })}
                                  placeholder="focus.en"
                                  spellCheck={false}
                                  className="min-h-[64px] w-full rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                />
                                <textarea
                                  value={segment.focusZh}
                                  onChange={(event) => updatePlanningSegment(segmentIndex, { focusZh: event.target.value })}
                                  placeholder="focus.zh"
                                  spellCheck={false}
                                  className="min-h-[64px] w-full rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                />
                              </div>

                              <input
                                type="text"
                                value={segment.animationType}
                                onChange={(event) => updatePlanningSegment(segmentIndex, { animationType: event.target.value })}
                                placeholder="animationType (optional)"
                                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {domain === 'animation_template' && animationTemplateDraft && (
                    <div className="space-y-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                            Animation Template Builder
                          </h3>
                          <p className="text-[11px] text-zinc-400">
                            Edit animation manifest fields, schema, and example payload.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={handleLoadRawJsonToBuilder}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Load JSON
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => setShowRawManifestEditor((previous) => !previous)}
                          >
                            {showRawManifestEditor ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            {showRawManifestEditor ? 'Hide JSON' : 'Show JSON'}
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        <input
                          type="text"
                          value={animationTemplateDraft.id}
                          onChange={(event) => updateAnimationTemplateDraft({ id: event.target.value })}
                          placeholder="template id"
                          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={animationTemplateDraft.name}
                          onChange={(event) => updateAnimationTemplateDraft({ name: event.target.value })}
                          placeholder="template name"
                          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <textarea
                        value={animationTemplateDraft.description}
                        onChange={(event) => updateAnimationTemplateDraft({ description: event.target.value })}
                        placeholder="description"
                        className="min-h-[64px] w-full rounded-lg border border-white/10 bg-zinc-900 p-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                      />

                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                        <input
                          type="text"
                          value={animationTemplateDraft.animationType}
                          onChange={(event) => updateAnimationTemplateDraft({ animationType: event.target.value })}
                          placeholder="animationType"
                          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={animationTemplateDraft.templateId}
                          onChange={(event) => updateAnimationTemplateDraft({ templateId: event.target.value })}
                          placeholder="templateId"
                          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={animationTemplateDraft.requiredParamsText}
                          onChange={(event) => updateAnimationTemplateDraft({ requiredParamsText: event.target.value })}
                          placeholder="requiredParams (comma-separated)"
                          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        <textarea
                          value={animationTemplateDraft.schemaJson}
                          onChange={(event) => updateAnimationTemplateDraft({ schemaJson: event.target.value })}
                          spellCheck={false}
                          placeholder="schema JSON"
                          className="min-h-[180px] w-full rounded-lg border border-white/10 bg-zinc-900 p-3 font-mono text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                        <textarea
                          value={animationTemplateDraft.exampleJson}
                          onChange={(event) => updateAnimationTemplateDraft({ exampleJson: event.target.value })}
                          spellCheck={false}
                          placeholder="example JSON"
                          className="min-h-[180px] w-full rounded-lg border border-white/10 bg-zinc-900 p-3 font-mono text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {domain === 'agent' && agentDraft && (
                    <div className="space-y-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                            Agent Builder
                          </h3>
                          <p className="text-[11px] text-zinc-400">
                            Edit role prompt, linked skills, and context dependencies.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={handleLoadRawJsonToBuilder}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Load JSON
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => setShowRawManifestEditor((previous) => !previous)}
                          >
                            {showRawManifestEditor ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            {showRawManifestEditor ? 'Hide JSON' : 'Show JSON'}
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                        <input
                          type="text"
                          value={agentDraft.id}
                          onChange={(event) => updateAgentDraft({ id: event.target.value })}
                          placeholder="agent id"
                          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={agentDraft.name}
                          onChange={(event) => updateAgentDraft({ name: event.target.value })}
                          placeholder="agent name"
                          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={agentDraft.minAppVersion}
                          onChange={(event) => updateAgentDraft({ minAppVersion: event.target.value })}
                          placeholder="minAppVersion (optional)"
                          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <textarea
                        value={agentDraft.description}
                        onChange={(event) => updateAgentDraft({ description: event.target.value })}
                        placeholder="description"
                        className="min-h-[64px] w-full rounded-lg border border-white/10 bg-zinc-900 p-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                      />

                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        <textarea
                          value={agentDraft.rolePromptEn}
                          onChange={(event) => updateAgentDraft({ rolePromptEn: event.target.value })}
                          placeholder="rolePrompt.en"
                          className="min-h-[120px] w-full rounded-lg border border-white/10 bg-zinc-900 p-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                        <textarea
                          value={agentDraft.rolePromptZh}
                          onChange={(event) => updateAgentDraft({ rolePromptZh: event.target.value })}
                          placeholder="rolePrompt.zh"
                          className="min-h-[120px] w-full rounded-lg border border-white/10 bg-zinc-900 p-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        <input
                          type="text"
                          value={agentDraft.skillsText}
                          onChange={(event) => updateAgentDraft({ skillsText: event.target.value })}
                          placeholder="skills (comma-separated)"
                          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                        <Select
                          value={agentDraft.contextDependencyMode}
                          onChange={(value) => updateAgentDraft({ contextDependencyMode: value as AgentDependencyMode })}
                          options={AGENT_DEPENDENCY_MODE_OPTIONS}
                        />
                      </div>

                      {agentDraft.contextDependencyMode === 'list' && (
                        <input
                          type="text"
                          value={agentDraft.contextDependenciesText}
                          onChange={(event) => updateAgentDraft({ contextDependenciesText: event.target.value })}
                          placeholder="contextDependencies (comma-separated)"
                          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                      )}
                    </div>
                  )}

                  {domain === 'skill' && skillDraft && (
                    <div className="space-y-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                            Skill Builder
                          </h3>
                          <p className="text-[11px] text-zinc-400">
                            Edit declaration and builtin alias runtime mapping.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={handleLoadRawJsonToBuilder}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Load JSON
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => setShowRawManifestEditor((previous) => !previous)}
                          >
                            {showRawManifestEditor ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            {showRawManifestEditor ? 'Hide JSON' : 'Show JSON'}
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                        <input
                          type="text"
                          value={skillDraft.id}
                          onChange={(event) => updateSkillDraft({ id: event.target.value })}
                          placeholder="skill id"
                          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={skillDraft.name}
                          onChange={(event) => updateSkillDraft({ name: event.target.value })}
                          placeholder="skill name"
                          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={skillDraft.minAppVersion}
                          onChange={(event) => updateSkillDraft({ minAppVersion: event.target.value })}
                          placeholder="minAppVersion (optional)"
                          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <textarea
                        value={skillDraft.description}
                        onChange={(event) => updateSkillDraft({ description: event.target.value })}
                        placeholder="description"
                        className="min-h-[64px] w-full rounded-lg border border-white/10 bg-zinc-900 p-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                      />

                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        <input
                          type="text"
                          value={skillDraft.declarationName}
                          onChange={(event) => updateSkillDraft({ declarationName: event.target.value })}
                          placeholder="declaration.name"
                          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={skillDraft.targetSkill}
                          onChange={(event) => updateSkillDraft({ targetSkill: event.target.value })}
                          placeholder="runtime.targetSkill"
                          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <textarea
                        value={skillDraft.declarationDescription}
                        onChange={(event) => updateSkillDraft({ declarationDescription: event.target.value })}
                        placeholder="declaration.description"
                        className="min-h-[64px] w-full rounded-lg border border-white/10 bg-zinc-900 p-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                      />

                      <textarea
                        value={skillDraft.parametersJson}
                        onChange={(event) => updateSkillDraft({ parametersJson: event.target.value })}
                        spellCheck={false}
                        placeholder="declaration.parameters JSON"
                        className="min-h-[180px] w-full rounded-lg border border-white/10 bg-zinc-900 p-3 font-mono text-xs text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  )}

                  {( !supportsStructuredBuilder(domain) || showRawManifestEditor) && (
                    <textarea
                      value={manifestEditor}
                      onChange={(event) => setManifestEditor(event.target.value)}
                      spellCheck={false}
                      className="min-h-[320px] w-full rounded-lg border border-white/10 bg-zinc-900 p-3 font-mono text-xs text-white focus:border-emerald-500 focus:outline-none"
                    />
                  )}

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <Button
                      onClick={() => void handleSaveDraft()}
                      disabled={!selectedRevision || selectedRevision.status !== 'draft' || isSavingDraft}
                      className="gap-2"
                    >
                      {isSavingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save Draft
                    </Button>
                    <Button
                      onClick={() => void handleValidate()}
                      variant="outline"
                      disabled={!selectedRevision || isValidating}
                      className="gap-2"
                    >
                      {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      Validate
                    </Button>
                    <Button
                      onClick={() => setPublishWizardOpen((previous) => !previous)}
                      variant="outline"
                      disabled={!selectedRevision}
                      className="gap-2"
                    >
                      <PlayCircle className="h-4 w-4" />
                      {publishWizardOpen ? 'Hide Publish Wizard' : 'Publish Wizard'}
                    </Button>
                    <Button
                      onClick={() => void handleRollback()}
                      variant="outline"
                      disabled={!selectedRevision || isRollbacking}
                      className="gap-2"
                    >
                      {isRollbacking ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
                      Rollback
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Validation Type</label>
                      <Select
                        value={validationType}
                        onChange={(value) => setValidationType(value)}
                        options={VALIDATION_TYPE_OPTIONS}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Release Channel</label>
                      <Select
                        value={publishChannel}
                        onChange={(value) => setPublishChannel(value)}
                        options={CHANNEL_OPTIONS}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Create New Revision</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newRevisionVersion}
                          onChange={(event) => setNewRevisionVersion(event.target.value)}
                          placeholder="e.g. 1.0.2"
                          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                        <Button onClick={() => void handleCreateRevision()} disabled={isCreatingRevision} className="shrink-0">
                          {isCreatingRevision ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {publishWizardOpen && (
                    <div className="space-y-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-300">
                            Publish Wizard
                          </h3>
                          <p className="text-[11px] text-zinc-400">
                            Publish is gated by validation-run summary in selected revision.
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => setPublishWizardOpen(false)}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Close
                        </Button>
                      </div>

                      <div className={`rounded-lg border px-3 py-2 text-xs ${
                        publishGate.passed
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                          : 'border-red-500/20 bg-red-500/10 text-red-300'
                      }`}>
                        <div className="font-semibold">
                          Gate: {publishGate.passed ? 'Passed' : 'Blocked'}
                        </div>
                        <div className="mt-1">
                          Required summary: mode=`validation_run`, status=`succeeded`, failedChecks=[]
                        </div>
                        <div className="mt-1 text-[11px] opacity-90">
                          Current mode={publishGate.mode || '-'}, status={publishGate.status || '-'},
                          failedChecks={publishGate.failedChecks.length}
                          {publishGate.checkedAt ? `, checkedAt=${publishGate.checkedAt}` : ''}
                        </div>
                      </div>

                      {!publishGate.passed && (
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                          Run validation for current revision and wait for succeeded status, then publish.
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-[11px] uppercase tracking-wider text-zinc-500">Release Notes</label>
                        <textarea
                          value={publishNotes}
                          onChange={(event) => setPublishNotes(event.target.value)}
                          placeholder="optional notes for release record"
                          className="min-h-[70px] w-full rounded-lg border border-white/10 bg-zinc-900 p-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          className="gap-2"
                          onClick={() => void handleValidate()}
                          disabled={!selectedRevision || isValidating}
                        >
                          {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                          Run Validation
                        </Button>
                        <Button
                          className="gap-2"
                          onClick={() => void handlePublish({ notes: publishNotes })}
                          disabled={!selectedRevision || !publishGate.passed || isPublishing}
                        >
                          {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                          Confirm Publish
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Diff From Version</label>
                      {diffFromOptions.length > 0 ? (
                        <Select
                          value={diffFromVersion || diffFromOptions[0].value}
                          onChange={(value) => setDiffFromVersion(value)}
                          options={diffFromOptions}
                        />
                      ) : (
                        <div className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-500">
                          Need at least two revisions.
                        </div>
                      )}
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        onClick={() => void handleDiff()}
                        disabled={!selectedRevision || !diffFromVersion || isDiffing}
                        className="w-full gap-2"
                      >
                        {isDiffing ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompare className="h-4 w-4" />}
                        Load Diff
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-950">
            <CardContent className="space-y-3 p-4">
              <h2 className="text-sm font-semibold text-white">Validation Result</h2>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={validationLookupRunId}
                  onChange={(event) => setValidationLookupRunId(event.target.value)}
                  placeholder="Validation runId"
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
                <Button
                  variant="outline"
                  className="gap-2 sm:w-[200px]"
                  onClick={() => void handleFetchValidationRun()}
                  disabled={isFetchingValidationRun}
                >
                  {isFetchingValidationRun ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Load Run
                </Button>
              </div>
              {!validationRun && (
                <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                  Run validation to see checks.
                </div>
              )}
              {validationRun && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-[11px] text-zinc-300">
                    <div className="flex flex-wrap items-center gap-4">
                      <span>RunId: <span className="font-mono">{validationRun.id}</span></span>
                      <span>
                        Status:{' '}
                        <span className={validationRun.status === 'succeeded' ? 'text-emerald-400' : 'text-red-400'}>
                          {validationRun.status}
                        </span>
                      </span>
                      <span>Finished: {formatTime(validationRun.finishedAt)}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {validationChecks.length === 0 && (
                      <div className="text-xs text-zinc-500">No checks found in result payload.</div>
                    )}
                    {validationChecks.map((check, index) => {
                      const item = check as { name?: string; status?: string; message?: string };
                      const isPass = item.status === 'passed';
                      return (
                        <div
                          key={`${item.name || 'check'}-${index}`}
                          className={`rounded-lg border px-3 py-2 text-xs ${
                            isPass
                              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                              : 'border-red-500/20 bg-red-500/10 text-red-300'
                          }`}
                        >
                          <div className="font-semibold">{item.name || 'check'}</div>
                          <div className="mt-1 text-[11px] opacity-90">{item.message || item.status || '-'}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-950">
            <CardContent className="space-y-3 p-4">
              <h2 className="text-sm font-semibold text-white">Revision Diff</h2>
              {!diffResult && (
                <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                  Load diff between two revisions to view manifest changes.
                </div>
              )}
              {diffResult && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-[11px] text-zinc-300">
                    <div className="flex flex-wrap gap-4">
                      <span>From: <span className="font-mono">{diffResult.fromRevision.version}</span></span>
                      <span>To: <span className="font-mono">{diffResult.toRevision.version}</span></span>
                      <span>
                        Total changes:{' '}
                        <span className="text-emerald-400">{diffResult.diff.summary.totalChanges}</span>
                      </span>
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
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Release History</h2>
                <Button variant="outline" size="sm" onClick={() => void refreshReleaseHistory()} disabled={isHistoryLoading}>
                  {isHistoryLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                  Refresh
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={releaseHistorySearch}
                  onChange={(event) => setReleaseHistorySearch(event.target.value)}
                  placeholder="Filter by itemId"
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
                <Select
                  value={releaseHistoryChannelFilter}
                  onChange={(value) => setReleaseHistoryChannelFilter(value)}
                  options={[
                    { value: 'all', label: 'all channels' },
                    ...CHANNEL_OPTIONS,
                  ]}
                />
              </div>
              <div className="max-h-[260px] space-y-2 overflow-auto pr-1">
                {filteredReleaseHistory.length === 0 && (
                  <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                    No release records found for current domain.
                  </div>
                )}
                {filteredReleaseHistory.map((record) => {
                  const active = selectedReleaseRecordId === record.id;
                  return (
                    <button
                      type="button"
                      key={record.id}
                      onClick={() => void handleSelectReleaseRecord(record)}
                      className={`w-full rounded-lg border p-3 text-left text-[11px] transition-colors ${
                        active
                          ? 'border-sky-400/40 bg-sky-500/10'
                          : 'border-white/10 bg-zinc-900 hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-zinc-300">{record.itemId}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 ${
                            record.action === 'publish'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {record.action}
                        </span>
                      </div>
                      <div className="mt-1 text-zinc-400">
                        {record.fromVersion || '-'} -&gt; {record.toVersion} ({record.channel})
                      </div>
                      {record.validationRunId && (
                        <div className="mt-1 font-mono text-zinc-500">
                          validationRunId: {record.validationRunId}
                        </div>
                      )}
                      <div className="mt-1 text-zinc-500">{formatTime(record.createdAt)}</div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
