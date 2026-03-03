
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
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
  CapabilitiesResponse,
  AdminStudioApiError,
  CatalogRevision,
  DatasourceCollector,
  DatasourceCollectionHealthItem,
  DatasourceCollectionHealthSummary,
  DatasourceCollectionRun,
  DatasourceCollectionSnapshot,
  DatasourceDataPreview,
  DatasourceStructurePreview,
  ManifestDiffResult,
  ReleaseRecord,
  ValidationRunRecord,
  confirmDatasourceCollectionSnapshot,
  createDatasourceCollector,
  createCatalogEntry,
  createCatalogRevision,
  getCurrentUserProfile,
  getMyCapabilities,
  getCatalogRevisionDiff,
  getValidationRun,
  loginWithAccount,
  listDatasourceCollectionHealth,
  listDatasourceCollectionRuns,
  listDatasourceCollectionSnapshots,
  listDatasourceCollectors,
  listCatalogEntries,
  listCatalogRevisions,
  listReleaseHistory,
  previewDatasourceData,
  previewDatasourceStructure,
  releaseDatasourceCollectionSnapshot,
  replayDatasourceCollectionSnapshot,
  logoutAccount,
  publishCatalogRevision,
  rollbackCatalogRevision,
  runCatalogValidation,
  triggerDatasourceCollectorRun,
  updateCatalogDraftRevision,
} from '@/src/services/adminStudio';
import {
  getSettings,
  saveSettings,
  type AdminStudioAuthMode,
  type AdminStudioAuthUser,
} from '@/src/services/settings';

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

const AUTH_MODE_OPTIONS: Array<{ value: AdminStudioAuthMode; label: string }> = [
  { value: 'account', label: 'account token' },
  { value: 'api_key', label: 'api key' },
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

const DATASOURCE_FIELD_TYPE_OPTIONS = [
  { value: 'text', label: 'text' },
  { value: 'number', label: 'number' },
  { value: 'textarea', label: 'textarea' },
  { value: 'csv_array', label: 'csv_array' },
  { value: 'versus_number', label: 'versus_number' },
  { value: 'odds_triplet', label: 'odds_triplet' },
];

const DATASOURCE_CARD_SPAN_OPTIONS = [
  { value: '1', label: '1 column' },
  { value: '2', label: '2 columns' },
];

const DATASOURCE_SECTION_COLUMN_OPTIONS = [
  { value: '1', label: '1 column' },
  { value: '2', label: '2 columns' },
];

type DatasourceEditorStep =
  | 'basics'
  | 'fields'
  | 'layout'
  | 'validate'
  | 'operations'
  | 'all';

type DatasourceFieldViewMode = 'all' | 'issues' | 'ready';

const DATASOURCE_EDITOR_STEP_OPTIONS: Array<{
  value: DatasourceEditorStep;
  label: string;
  hint: string;
}> = [
  { value: 'basics', label: '1) Basics', hint: 'source id/name/permissions' },
  { value: 'fields', label: '2) Fields', hint: 'field mapping paths' },
  { value: 'layout', label: '3) Layout', hint: 'form sections and rules' },
  { value: 'validate', label: '4) Validate', hint: 'precheck + server preview' },
  { value: 'operations', label: '5) Ops', hint: 'collector/snapshot governance' },
  { value: 'all', label: 'All', hint: 'show every block' },
];

const DATASOURCE_FIELD_VIEW_MODE_OPTIONS: Array<{
  value: DatasourceFieldViewMode;
  label: string;
}> = [
  { value: 'all', label: 'all fields' },
  { value: 'issues', label: 'issues only' },
  { value: 'ready', label: 'ready only' },
];

const DATASOURCE_FIELD_TYPE_HINTS: Record<DatasourceFieldType, string> = {
  text: 'Use one path, e.g. league.name',
  number: 'Use one numeric path, e.g. stats.rank',
  textarea: 'Use one long-text path',
  csv_array: 'Use one array path',
  versus_number: 'Need homePath + awayPath',
  odds_triplet: 'Need homePath + drawPath + awayPath',
};

const EMPTY_DATASOURCE_HEALTH_SUMMARY: DatasourceCollectionHealthSummary = {
  total: 0,
  healthy: 0,
  stale: 0,
  failed: 0,
  neverRun: 0,
  disabled: 0,
};

type FeedbackTone = 'success' | 'error' | 'info';

type PlanningContextMode = 'independent' | 'build_upon' | 'all';
type AgentDependencyMode = 'all' | 'none' | 'list';
type DatasourceFieldType =
  | 'text'
  | 'number'
  | 'textarea'
  | 'csv_array'
  | 'versus_number'
  | 'odds_triplet';

interface DatasourceFieldDraft {
  id: string;
  type: DatasourceFieldType;
  pathText: string;
  homePathText: string;
  drawPathText: string;
  awayPathText: string;
}

interface DatasourceFormSectionDraft {
  id: string;
  titleKey: string;
  title: string;
  columns: '1' | '2';
  fieldIdsText: string;
}

interface DatasourceRuleDraft {
  targetPathText: string;
  targetText: string;
}

interface DatasourceManifestDraft {
  id: string;
  name: string;
  labelKey: string;
  requiredPermissionsText: string;
  cardSpan: '1' | '2';
  defaultSelected: boolean;
  fields: DatasourceFieldDraft[];
  formSections: DatasourceFormSectionDraft[];
  applyRules: DatasourceRuleDraft[];
  removeRules: DatasourceRuleDraft[];
}

interface LocalValidationCheck {
  name: 'schema' | 'dependency' | 'compatibility';
  status: 'passed' | 'failed';
  message: string;
  details?: {
    errors: string[];
  };
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

function parsePathText(pathText: string) {
  return pathText
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function isFilledText(value: string) {
  return value.trim().length > 0;
}

function getDatasourceFieldRequiredPathCount(field: DatasourceFieldDraft) {
  if (field.type === 'versus_number') {
    return 2;
  }
  if (field.type === 'odds_triplet') {
    return 3;
  }
  return 1;
}

function getDatasourceFieldProvidedPathCount(field: DatasourceFieldDraft) {
  if (field.type === 'versus_number') {
    return Number(isFilledText(field.homePathText)) + Number(isFilledText(field.awayPathText));
  }
  if (field.type === 'odds_triplet') {
    return (
      Number(isFilledText(field.homePathText))
      + Number(isFilledText(field.drawPathText))
      + Number(isFilledText(field.awayPathText))
    );
  }
  return Number(isFilledText(field.pathText));
}

function isDatasourceStepVisible(active: DatasourceEditorStep, section: DatasourceEditorStep) {
  return active === 'all' || active === section;
}

function normalizeDatasourcePathToken(value: string) {
  return value.trim().replace(/\.+/g, '.').replace(/^\./, '').replace(/\.$/, '');
}

function composeDatasourcePathWithPrefix(prefix: string, suffix: string) {
  const normalizedPrefix = normalizeDatasourcePathToken(prefix);
  const normalizedSuffix = normalizeDatasourcePathToken(suffix);
  if (!normalizedPrefix) return normalizedSuffix;
  if (!normalizedSuffix) return normalizedPrefix;
  return `${normalizedPrefix}.${normalizedSuffix}`;
}

function toPathText(value: unknown) {
  if (!Array.isArray(value)) {
    return '';
  }
  return value
    .filter((segment): segment is string => typeof segment === 'string')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join('.');
}

function buildDefaultDatasourceField(index: number): DatasourceFieldDraft {
  return {
    id: `field_${index + 1}`,
    type: 'text',
    pathText: '',
    homePathText: '',
    drawPathText: '',
    awayPathText: '',
  };
}

function buildDefaultDatasourceSection(index: number): DatasourceFormSectionDraft {
  return {
    id: `section_${index + 1}`,
    titleKey: '',
    title: '',
    columns: '1',
    fieldIdsText: '',
  };
}

function buildDefaultDatasourceRule(): DatasourceRuleDraft {
  return {
    targetPathText: '',
    targetText: '',
  };
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

function toDatasourceManifestDraft(
  manifest: Record<string, unknown>,
  fallbackItemId: string,
): DatasourceManifestDraft {
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

  const formSectionsRaw = Array.isArray(manifest.formSections) ? manifest.formSections : [];
  const formSections = formSectionsRaw
    .map((section, index) => {
      const sectionRecord = asRecord(section);
      const fieldIds = Array.isArray(sectionRecord.fields)
        ? sectionRecord.fields
          .map((field) => {
            if (typeof field === 'string') {
              return asText(field);
            }
            const fieldRecord = asRecord(field);
            return asText(fieldRecord.id);
          })
          .filter((fieldId) => fieldId.length > 0)
        : [];
      return {
        id: asText(sectionRecord.id) || `section_${index + 1}`,
        titleKey: asText(sectionRecord.titleKey),
        title: asText(sectionRecord.title),
        columns: Number(sectionRecord.columns) === 2 ? '2' : '1',
        fieldIdsText: fieldIds.join(', '),
      } satisfies DatasourceFormSectionDraft;
    })
    .filter((section) => section.id.length > 0);

  const toRuleDraft = (rule: unknown): DatasourceRuleDraft => {
    const ruleRecord = asRecord(rule);
    return {
      targetPathText: toPathText(ruleRecord.path),
      targetText: asText(ruleRecord.target || ruleRecord.fieldId || ruleRecord.key),
    };
  };

  const applyRules = Array.isArray(manifest.applyRules)
    ? manifest.applyRules.map((rule) => toRuleDraft(rule))
    : [];
  const removeRules = Array.isArray(manifest.removeRules)
    ? manifest.removeRules.map((rule) => toRuleDraft(rule))
    : [];

  return {
    id: asText(manifest.id || manifest.sourceId) || fallbackItemId || 'datasource_item',
    name: asText(manifest.name || manifest.label || manifest.labelKey) || 'Datasource',
    labelKey: asText(manifest.labelKey),
    requiredPermissionsText: toCsvText(manifest.requiredPermissions),
    cardSpan: String(manifest.cardSpan) === '2' ? '2' : '1',
    defaultSelected: typeof manifest.defaultSelected === 'boolean' ? manifest.defaultSelected : true,
    fields: fields.length > 0 ? fields : [buildDefaultDatasourceField(0)],
    formSections,
    applyRules,
    removeRules,
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

  const fieldById = new Map(
    fields.map((field) => [asText(field.id), field] as const).filter(([id]) => id.length > 0),
  );

  const formSections = draft.formSections.map((section, index) => {
    const sectionFieldIds = parseCsvText(section.fieldIdsText);
    const sectionFields = sectionFieldIds.map((fieldId) => (
      fieldById.get(fieldId) || { id: fieldId }
    ));
    const sectionRecord: Record<string, unknown> = {
      id: asText(section.id) || `section_${index + 1}`,
      columns: Number.parseInt(section.columns, 10) === 2 ? 2 : 1,
      fields: sectionFields,
    };
    if (asText(section.titleKey)) {
      sectionRecord.titleKey = asText(section.titleKey);
    }
    if (asText(section.title)) {
      sectionRecord.title = asText(section.title);
    }
    return sectionRecord;
  });

  const serializeRule = (rule: DatasourceRuleDraft) => {
    const path = parsePathText(rule.targetPathText);
    if (path.length > 0) {
      return { path };
    }
    if (asText(rule.targetText)) {
      return { target: asText(rule.targetText) };
    }
    return null;
  };

  const applyRules = draft.applyRules.flatMap((rule) => {
    const serialized = serializeRule(rule);
    return serialized ? [serialized] : [];
  });

  const removeRules = draft.removeRules.flatMap((rule) => {
    const serialized = serializeRule(rule);
    return serialized ? [serialized] : [];
  });

  return {
    id: asText(draft.id),
    name: asText(draft.name),
    ...(asText(draft.labelKey) ? { labelKey: asText(draft.labelKey) } : {}),
    cardSpan: Number.parseInt(draft.cardSpan, 10) || 1,
    defaultSelected: !!draft.defaultSelected,
    requiredPermissions: parseCsvText(draft.requiredPermissionsText),
    fields,
    ...(formSections.length > 0 ? { formSections } : {}),
    ...(applyRules.length > 0 ? { applyRules } : {}),
    ...(removeRules.length > 0 ? { removeRules } : {}),
  };
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function isPathArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((segment) => typeof segment === 'string' && segment.trim().length > 0);
}

function collectDatasourceManifestFields(manifest: Record<string, unknown>) {
  if (Array.isArray(manifest.fields)) {
    return manifest.fields;
  }
  const schema = asRecord(manifest.schema);
  if (Array.isArray(schema.fields)) {
    return schema.fields;
  }
  if (Array.isArray(manifest.formSections)) {
    return manifest.formSections.flatMap((section) => {
      const sectionRecord = asRecord(section);
      return Array.isArray(sectionRecord.fields) ? sectionRecord.fields : [];
    });
  }
  return [];
}

function buildLocalValidationCheck(
  name: LocalValidationCheck['name'],
  errors: string[],
  passMessage: string,
): LocalValidationCheck {
  if (errors.length === 0) {
    return {
      name,
      status: 'passed',
      message: passMessage,
    };
  }
  return {
    name,
    status: 'failed',
    message: errors[0],
    details: {
      errors,
    },
  };
}

function validateDatasourceManifestSchemaLocal(manifest: Record<string, unknown>) {
  const errors: string[] = [];
  const sourceId = asText(manifest.id || manifest.sourceId);
  if (!sourceId) {
    errors.push('datasource.id (or sourceId) is required');
  } else if (!/^[a-z0-9_][a-z0-9_-]{1,63}$/.test(sourceId)) {
    errors.push('datasource.id must match pattern [a-z0-9_][a-z0-9_-]{1,63}');
  }

  const displayName = asText(manifest.name || manifest.label || manifest.labelKey);
  if (!displayName) {
    errors.push('datasource.name (or label/labelKey) is required');
  }

  const fields = collectDatasourceManifestFields(manifest);
  if (fields.length === 0) {
    errors.push('datasource fields are required (fields[]/schema.fields[]/formSections[].fields[])');
    return errors;
  }

  fields.forEach((field, index) => {
    const fieldRecord = asRecord(field);
    if (Object.keys(fieldRecord).length === 0) {
      errors.push(`datasource.fields[${index}] must be an object`);
      return;
    }
    if (!asText(fieldRecord.id)) {
      errors.push(`datasource.fields[${index}].id is required`);
    }
    const fieldType = asText(fieldRecord.type);
    if (!fieldType) {
      errors.push(`datasource.fields[${index}].type is required`);
    }

    if (isPathArray(fieldRecord.path)) {
      return;
    }
    if (fieldType === 'versus_number') {
      if (!isPathArray(fieldRecord.homePath) || !isPathArray(fieldRecord.awayPath)) {
        errors.push(`datasource.fields[${index}] must include homePath/awayPath`);
      }
      return;
    }
    if (fieldType === 'odds_triplet') {
      if (
        !isPathArray(fieldRecord.homePath)
        || !isPathArray(fieldRecord.drawPath)
        || !isPathArray(fieldRecord.awayPath)
      ) {
        errors.push(`datasource.fields[${index}] must include homePath/drawPath/awayPath`);
      }
      return;
    }

    errors.push(`datasource.fields[${index}] must include path[]`);
  });

  if (Array.isArray(manifest.formSections)) {
    manifest.formSections.forEach((section, index) => {
      const sectionRecord = asRecord(section);
      if (Object.keys(sectionRecord).length === 0) {
        errors.push(`datasource.formSections[${index}] must be an object`);
        return;
      }
      if (!asText(sectionRecord.id)) {
        errors.push(`datasource.formSections[${index}].id is required`);
      }
      if (!asText(sectionRecord.titleKey) && !asText(sectionRecord.title)) {
        errors.push(`datasource.formSections[${index}].titleKey (or title) is required`);
      }
      if (!Array.isArray(sectionRecord.fields) || sectionRecord.fields.length === 0) {
        errors.push(`datasource.formSections[${index}].fields must be non-empty`);
      }
    });
  }

  return errors;
}

function validateDatasourceManifestDependenciesLocal(manifest: Record<string, unknown>) {
  const errors: string[] = [];

  if (manifest.requiredPermissions !== undefined && !Array.isArray(manifest.requiredPermissions)) {
    errors.push('datasource.requiredPermissions must be an array when provided');
  }

  const requiredPermissions = normalizeStringArray(manifest.requiredPermissions);
  requiredPermissions.forEach((permission, index) => {
    if (!permission.startsWith('datasource:use:')) {
      errors.push(`datasource.requiredPermissions[${index}] must start with datasource:use:`);
    }
  });

  const applyTargets = new Set<string>();
  const removeTargets = new Set<string>();

  const collectRuleTarget = (
    rule: unknown,
    index: number,
    fieldName: 'applyRules' | 'removeRules',
    collector: Set<string>,
  ) => {
    const ruleRecord = asRecord(rule);
    if (Object.keys(ruleRecord).length === 0) {
      errors.push(`datasource.${fieldName}[${index}] must be an object`);
      return;
    }
    const pathTarget = toPathText(ruleRecord.path);
    const target = pathTarget || asText(ruleRecord.target || ruleRecord.fieldId || ruleRecord.key);
    if (!target) {
      errors.push(`datasource.${fieldName}[${index}] must provide path[] or target`);
      return;
    }
    collector.add(target);
  };

  if (manifest.applyRules !== undefined && !Array.isArray(manifest.applyRules)) {
    errors.push('datasource.applyRules must be an array when provided');
  }
  if (manifest.removeRules !== undefined && !Array.isArray(manifest.removeRules)) {
    errors.push('datasource.removeRules must be an array when provided');
  }

  if (Array.isArray(manifest.applyRules)) {
    manifest.applyRules.forEach((rule, index) => {
      collectRuleTarget(rule, index, 'applyRules', applyTargets);
    });
  }

  if (Array.isArray(manifest.removeRules)) {
    manifest.removeRules.forEach((rule, index) => {
      collectRuleTarget(rule, index, 'removeRules', removeTargets);
    });
  }

  Array.from(applyTargets).forEach((target) => {
    if (removeTargets.has(target)) {
      errors.push(`datasource.applyRules/removeRules conflict on target: ${target}`);
    }
  });

  return errors;
}

function validateDatasourceManifestCompatibilityLocal(manifest: Record<string, unknown>) {
  const errors: string[] = [];
  const fields = collectDatasourceManifestFields(manifest);
  const seenFieldIds = new Set<string>();
  const seenPaths = new Set<string>();

  fields.forEach((field, index) => {
    const fieldRecord = asRecord(field);
    if (Object.keys(fieldRecord).length === 0) {
      return;
    }

    const fieldId = asText(fieldRecord.id);
    if (fieldId) {
      if (seenFieldIds.has(fieldId)) {
        errors.push(`datasource field id duplicated: ${fieldId}`);
      } else {
        seenFieldIds.add(fieldId);
      }
    }

    const pathCandidates = [
      toPathText(fieldRecord.path),
      toPathText(fieldRecord.homePath),
      toPathText(fieldRecord.drawPath),
      toPathText(fieldRecord.awayPath),
    ].filter((candidate) => candidate.length > 0);

    pathCandidates.forEach((pathValue) => {
      if (seenPaths.has(pathValue)) {
        errors.push(`datasource field path duplicated: ${pathValue} (field index ${index})`);
      } else {
        seenPaths.add(pathValue);
      }
    });
  });

  if (manifest.cardSpan !== undefined && manifest.cardSpan !== 1 && manifest.cardSpan !== 2) {
    errors.push('datasource.cardSpan must be 1 or 2 when provided');
  }
  if (manifest.defaultSelected !== undefined && typeof manifest.defaultSelected !== 'boolean') {
    errors.push('datasource.defaultSelected must be boolean when provided');
  }

  return errors;
}

function toCapabilitySuffix(value: string) {
  return value
    .split(/[_-]+/g)
    .filter((segment) => segment.length > 0)
    .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
    .join('');
}

function setValueAtPath(target: Record<string, unknown>, path: string[], value: unknown) {
  if (path.length === 0) {
    return;
  }
  let cursor: Record<string, unknown> = target;
  path.forEach((segment, index) => {
    const normalizedSegment = segment.trim();
    if (!normalizedSegment) {
      return;
    }
    if (index === path.length - 1) {
      cursor[normalizedSegment] = value;
      return;
    }
    const current = cursor[normalizedSegment];
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      cursor[normalizedSegment] = {};
    }
    cursor = cursor[normalizedSegment] as Record<string, unknown>;
  });
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
    domain === 'datasource'
    || domain === 'planning_template'
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

function formatAuthUserLabel(user: AdminStudioAuthUser | null) {
  if (!user) {
    return 'Not logged in';
  }
  const primary = user.username || user.email || user.id;
  const tenant = user.tenantId ? `tenant=${user.tenantId}` : 'tenant=unknown';
  return `${primary} (${tenant})`;
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
  const initialSettings = getSettings();
  const [serverUrlInput, setServerUrlInput] = useState(initialSettings.matchDataServerUrl);
  const [apiKeyInput, setApiKeyInput] = useState(initialSettings.matchDataApiKey);
  const [authModeInput, setAuthModeInput] = useState<AdminStudioAuthMode>(initialSettings.authMode);
  const [accountIdentifierInput, setAccountIdentifierInput] = useState(initialSettings.accountIdentifier);
  const [accountPasswordInput, setAccountPasswordInput] = useState('');
  const [currentAuthUser, setCurrentAuthUser] = useState<AdminStudioAuthUser | null>(
    initialSettings.authUser,
  );
  const [capabilities, setCapabilities] = useState<CapabilitiesResponse | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
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
  const [datasourceDraft, setDatasourceDraft] = useState<DatasourceManifestDraft | null>(null);
  const [datasourceEditorStep, setDatasourceEditorStep] = useState<DatasourceEditorStep>('all');
  const [datasourceFieldViewMode, setDatasourceFieldViewMode] = useState<DatasourceFieldViewMode>('all');
  const [datasourceFieldFilterText, setDatasourceFieldFilterText] = useState('');
  const [datasourceFieldPathPrefixInput, setDatasourceFieldPathPrefixInput] = useState('');
  const [datasourceStructurePreview, setDatasourceStructurePreview] = useState<DatasourceStructurePreview | null>(null);
  const [datasourceDataPreview, setDatasourceDataPreview] = useState<DatasourceDataPreview | null>(null);
  const [datasourcePreviewLimitInput, setDatasourcePreviewLimitInput] = useState('5');
  const [datasourcePreviewStatusInput, setDatasourcePreviewStatusInput] = useState('');
  const [datasourceCollectorSourceIdInput, setDatasourceCollectorSourceIdInput] = useState('');
  const [datasourceCollectorNameInput, setDatasourceCollectorNameInput] = useState('Match Snapshot Collector');
  const [datasourceCollectors, setDatasourceCollectors] = useState<DatasourceCollector[]>([]);
  const [datasourceCollectionHealth, setDatasourceCollectionHealth] = useState<DatasourceCollectionHealthItem[]>([]);
  const [datasourceCollectionHealthSummary, setDatasourceCollectionHealthSummary] = useState<DatasourceCollectionHealthSummary>(EMPTY_DATASOURCE_HEALTH_SUMMARY);
  const [datasourceCollectionHealthGeneratedAt, setDatasourceCollectionHealthGeneratedAt] = useState('');
  const [datasourceCollectionRuns, setDatasourceCollectionRuns] = useState<DatasourceCollectionRun[]>([]);
  const [datasourceCollectionSnapshots, setDatasourceCollectionSnapshots] = useState<DatasourceCollectionSnapshot[]>([]);
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
  const [isRunningDatasourcePreview, setIsRunningDatasourcePreview] = useState(false);
  const [isDatasourceCollectionLoading, setIsDatasourceCollectionLoading] = useState(false);
  const [isCreatingDatasourceCollector, setIsCreatingDatasourceCollector] = useState(false);
  const [runningCollectorId, setRunningCollectorId] = useState('');
  const [confirmingSnapshotId, setConfirmingSnapshotId] = useState('');
  const [releasingSnapshotId, setReleasingSnapshotId] = useState('');
  const [replayingSnapshotId, setReplayingSnapshotId] = useState('');
  const [isFetchingValidationRun, setIsFetchingValidationRun] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRollbacking, setIsRollbacking] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const [feedback, setFeedback] = useState<{ tone: FeedbackTone; message: string } | null>(null);

  function handleSaveConnectionSettings() {
    const serverUrl = serverUrlInput.trim();
    const apiKey = apiKeyInput.trim();

    saveSettings({
      matchDataServerUrl: serverUrl,
      matchDataApiKey: apiKey,
      authMode: authModeInput,
      accountIdentifier: accountIdentifierInput.trim(),
      ...(authModeInput === 'api_key'
        ? {
            accessToken: '',
            refreshToken: '',
            accessTokenExpiresAt: '',
            refreshTokenExpiresAt: '',
            authUser: null,
          }
        : {}),
    });

    if (authModeInput === 'api_key') {
      setCurrentAuthUser(null);
      setCapabilities(null);
    }

    setFeedback({
      tone: 'success',
      message: 'Admin Studio connection settings saved.',
    });
  }

  async function handleAccountLogin() {
    const identifier = accountIdentifierInput.trim();
    const password = accountPasswordInput;
    if (!identifier || !password) {
      setFeedback({
        tone: 'error',
        message: 'Account login requires identifier and password.',
      });
      return;
    }

    setIsAuthenticating(true);
    try {
      const data = await loginWithAccount({
        identifier,
        password,
      });
      setCurrentAuthUser(data.user || null);
      setAuthModeInput('account');
      setAccountPasswordInput('');
      setFeedback({
        tone: 'success',
        message: `Logged in as ${formatAuthUserLabel(data.user || null)}.`,
      });
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleLogout() {
    setIsAuthenticating(true);
    try {
      await logoutAccount();
      setCurrentAuthUser(null);
      setCapabilities(null);
      setFeedback({
        tone: 'info',
        message: 'Account session cleared.',
      });
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleRefreshIdentity() {
    setIsAuthenticating(true);
    try {
      const user = await getCurrentUserProfile();
      setCurrentAuthUser(user);
      const capabilityData = await getMyCapabilities();
      setCapabilities(capabilityData);
      setFeedback({
        tone: 'success',
        message: `Account profile refreshed: ${formatAuthUserLabel(user)}.`,
      });
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setIsAuthenticating(false);
    }
  }

  useEffect(() => {
    if (authModeInput !== 'account') {
      return;
    }
    const settings = getSettings();
    if (!settings.accessToken) {
      return;
    }
    void handleRefreshIdentity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const datasourceManifestPreview = useMemo(() => {
    if (domain !== 'datasource' || !datasourceDraft) {
      return null;
    }
    return toDatasourceManifest(datasourceDraft) as Record<string, unknown>;
  }, [domain, datasourceDraft]);

  const datasourceLocalChecks = useMemo(() => {
    if (!datasourceManifestPreview) {
      return [];
    }
    return [
      buildLocalValidationCheck(
        'schema',
        validateDatasourceManifestSchemaLocal(datasourceManifestPreview),
        'Datasource schema check passed',
      ),
      buildLocalValidationCheck(
        'dependency',
        validateDatasourceManifestDependenciesLocal(datasourceManifestPreview),
        'Datasource dependency check passed',
      ),
      buildLocalValidationCheck(
        'compatibility',
        validateDatasourceManifestCompatibilityLocal(datasourceManifestPreview),
        'Datasource compatibility check passed',
      ),
    ];
  }, [datasourceManifestPreview]);

  const datasourceLocalFailedChecks = useMemo(
    () => datasourceLocalChecks.filter((check) => check.status === 'failed'),
    [datasourceLocalChecks],
  );

  const datasourceEditorSummary = useMemo(() => {
    if (!datasourceDraft) {
      return {
        fieldCount: 0,
        mappedReadyCount: 0,
        missingMappingCount: 0,
        duplicateFieldIdCount: 0,
        duplicatePathCount: 0,
        sectionCount: 0,
        permissionCount: 0,
        ruleCount: 0,
      };
    }

    const fieldIds = datasourceDraft.fields
      .map((field) => field.id.trim().toLowerCase())
      .filter((fieldId) => fieldId.length > 0);
    const uniqueFieldIds = new Set(fieldIds);
    const duplicateFieldIdCount = fieldIds.length - uniqueFieldIds.size;

    let mappedReadyCount = 0;
    const pathCounter = new Map<string, number>();
    datasourceDraft.fields.forEach((field) => {
      const requiredCount = getDatasourceFieldRequiredPathCount(field);
      const providedCount = getDatasourceFieldProvidedPathCount(field);
      if (providedCount >= requiredCount) {
        mappedReadyCount += 1;
      }

      const pathCandidates =
        field.type === 'versus_number'
          ? [field.homePathText, field.awayPathText]
          : field.type === 'odds_triplet'
            ? [field.homePathText, field.drawPathText, field.awayPathText]
            : [field.pathText];
      pathCandidates
        .map((path) => path.trim().toLowerCase())
        .filter((path) => path.length > 0)
        .forEach((path) => {
          pathCounter.set(path, (pathCounter.get(path) || 0) + 1);
        });
    });

    let duplicatePathCount = 0;
    pathCounter.forEach((count) => {
      if (count > 1) {
        duplicatePathCount += 1;
      }
    });

    return {
      fieldCount: datasourceDraft.fields.length,
      mappedReadyCount,
      missingMappingCount: Math.max(0, datasourceDraft.fields.length - mappedReadyCount),
      duplicateFieldIdCount,
      duplicatePathCount,
      sectionCount: datasourceDraft.formSections.length,
      permissionCount: parseCsvText(datasourceDraft.requiredPermissionsText).length,
      ruleCount: datasourceDraft.applyRules.length + datasourceDraft.removeRules.length,
    };
  }, [datasourceDraft]);

  const datasourceFieldDiagnostics = useMemo(() => {
    if (!datasourceDraft) {
      return [] as Array<{
        index: number;
        field: DatasourceFieldDraft;
        mappingReady: boolean;
        hasIssue: boolean;
        duplicateId: boolean;
        duplicatePath: boolean;
      }>;
    }

    const idCounter = new Map<string, number>();
    const pathCounter = new Map<string, number>();

    datasourceDraft.fields.forEach((field) => {
      const normalizedId = field.id.trim().toLowerCase();
      if (normalizedId) {
        idCounter.set(normalizedId, (idCounter.get(normalizedId) || 0) + 1);
      }

      const candidates =
        field.type === 'versus_number'
          ? [field.homePathText, field.awayPathText]
          : field.type === 'odds_triplet'
            ? [field.homePathText, field.drawPathText, field.awayPathText]
            : [field.pathText];
      candidates
        .map((path) => normalizeDatasourcePathToken(path).toLowerCase())
        .filter((path) => path.length > 0)
        .forEach((path) => {
          pathCounter.set(path, (pathCounter.get(path) || 0) + 1);
        });
    });

    return datasourceDraft.fields.map((field, index) => {
      const normalizedId = field.id.trim().toLowerCase();
      const mappingReady =
        getDatasourceFieldProvidedPathCount(field) >= getDatasourceFieldRequiredPathCount(field);
      const duplicateId = normalizedId.length > 0 && (idCounter.get(normalizedId) || 0) > 1;
      const candidates =
        field.type === 'versus_number'
          ? [field.homePathText, field.awayPathText]
          : field.type === 'odds_triplet'
            ? [field.homePathText, field.drawPathText, field.awayPathText]
            : [field.pathText];
      const duplicatePath = candidates
        .map((path) => normalizeDatasourcePathToken(path).toLowerCase())
        .filter((path) => path.length > 0)
        .some((path) => (pathCounter.get(path) || 0) > 1);

      const hasIssue =
        !mappingReady
        || !normalizedId
        || duplicateId
        || duplicatePath;

      return {
        index,
        field,
        mappingReady,
        hasIssue,
        duplicateId,
        duplicatePath,
      };
    });
  }, [datasourceDraft]);

  const datasourceVisibleFieldRows = useMemo(() => {
    const keyword = datasourceFieldFilterText.trim().toLowerCase();
    return datasourceFieldDiagnostics.filter((row) => {
      if (datasourceFieldViewMode === 'issues' && !row.hasIssue) {
        return false;
      }
      if (datasourceFieldViewMode === 'ready' && row.hasIssue) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      const searchText = [
        row.field.id,
        row.field.type,
        row.field.pathText,
        row.field.homePathText,
        row.field.drawPathText,
        row.field.awayPathText,
      ]
        .join(' ')
        .toLowerCase();
      return searchText.includes(keyword);
    });
  }, [datasourceFieldDiagnostics, datasourceFieldFilterText, datasourceFieldViewMode]);

  const datasourceFieldVisibilitySummary = useMemo(() => {
    const total = datasourceFieldDiagnostics.length;
    const issueCount = datasourceFieldDiagnostics.filter((row) => row.hasIssue).length;
    return {
      total,
      issueCount,
      readyCount: Math.max(0, total - issueCount),
      visibleCount: datasourceVisibleFieldRows.length,
    };
  }, [datasourceFieldDiagnostics, datasourceVisibleFieldRows]);

  const datasourceSourceContextPreview = useMemo(() => {
    if (!datasourceManifestPreview) {
      return null;
    }
    const sourceId = asText(datasourceManifestPreview.id || datasourceManifestPreview.sourceId) || 'datasource';
    const selected = datasourceManifestPreview.defaultSelected !== false;
    const fields = collectDatasourceManifestFields(datasourceManifestPreview);
    const allPaths = fields.flatMap((field) => {
      const fieldRecord = asRecord(field);
      return [
        toPathText(fieldRecord.path),
        toPathText(fieldRecord.homePath),
        toPathText(fieldRecord.drawPath),
        toPathText(fieldRecord.awayPath),
      ]
        .filter((pathText) => pathText.length > 0)
        .map((pathText) => pathText.toLowerCase());
    });

    const hasOdds = allPaths.some((pathText) => pathText.startsWith('odds') || pathText.includes('.odds.'));
    const hasStats = allPaths.some((pathText) => pathText.startsWith('stats') || pathText.includes('.stats.'));
    const hasFundamental = allPaths.some((pathText) => (
      pathText.startsWith('league')
      || pathText.startsWith('status')
      || pathText.startsWith('hometeam')
      || pathText.startsWith('awayteam')
      || pathText.includes('.league')
      || pathText.includes('.hometeam')
      || pathText.includes('.awayteam')
    ));
    const hasCustom = allPaths.some((pathText) => pathText.startsWith('custom') || pathText.includes('.custom'));

    return {
      sourceContext: {
        origin: 'server-db',
        selectedSources: {
          [sourceId]: selected,
        },
        selectedSourceIds: selected ? [sourceId] : [],
        capabilities: {
          hasFundamental,
          hasStats,
          hasOdds,
          hasCustom,
          [`has${toCapabilitySuffix(sourceId)}`]: selected,
        },
        matchStatus: 'upcoming',
      },
    };
  }, [datasourceManifestPreview]);

  const datasourcePayloadPreview = useMemo(() => {
    if (!datasourceManifestPreview) {
      return null;
    }
    const payload: Record<string, unknown> = {};
    const fields = collectDatasourceManifestFields(datasourceManifestPreview);

    fields.forEach((field, index) => {
      const fieldRecord = asRecord(field);
      const fieldType = asText(fieldRecord.type);
      const simplePath = parsePathText(toPathText(fieldRecord.path));
      const homePath = parsePathText(toPathText(fieldRecord.homePath));
      const drawPath = parsePathText(toPathText(fieldRecord.drawPath));
      const awayPath = parsePathText(toPathText(fieldRecord.awayPath));

      if (fieldType === 'versus_number') {
        setValueAtPath(payload, homePath, 0);
        setValueAtPath(payload, awayPath, 0);
        return;
      }
      if (fieldType === 'odds_triplet') {
        setValueAtPath(payload, homePath, 0);
        setValueAtPath(payload, drawPath, 0);
        setValueAtPath(payload, awayPath, 0);
        return;
      }
      if (fieldType === 'csv_array') {
        setValueAtPath(payload, simplePath, [`sample_${index + 1}`]);
        return;
      }
      if (fieldType === 'number') {
        setValueAtPath(payload, simplePath, 0);
        return;
      }
      setValueAtPath(payload, simplePath, '');
    });

    return payload;
  }, [datasourceManifestPreview]);

  useEffect(() => {
    setDatasourceStructurePreview(null);
    setDatasourceDataPreview(null);
  }, [datasourceManifestPreview]);

  useEffect(() => {
    if (domain !== 'datasource') {
      return;
    }
    const fallbackSourceId = datasourceDraft?.id?.trim() || selectedItemId.trim();
    if (!fallbackSourceId) {
      return;
    }
    setDatasourceCollectorSourceIdInput((previous) => (
      previous.trim().length > 0 ? previous : fallbackSourceId
    ));
  }, [domain, datasourceDraft?.id, selectedItemId]);

  useEffect(() => {
    if (domain !== 'datasource') {
      return;
    }
    void refreshDatasourceCollectionGovernance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, datasourceCollectorSourceIdInput, datasourceDraft?.id, selectedItemId]);

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
    setDatasourceDraft(nextDomain === 'datasource'
      ? toDatasourceManifestDraft(starter as Record<string, unknown>, 'new_datasource')
      : null);
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
    setDatasourceStructurePreview(null);
    setDatasourceDataPreview(null);
    setDatasourcePreviewLimitInput('5');
    setDatasourcePreviewStatusInput('');
    setDatasourceCollectorSourceIdInput('');
    setDatasourceCollectorNameInput('Match Snapshot Collector');
    setDatasourceCollectors([]);
    setDatasourceCollectionRuns([]);
    setDatasourceCollectionSnapshots([]);
    setDatasourceEditorStep('all');
    setDatasourceFieldViewMode('all');
    setDatasourceFieldFilterText('');
    setDatasourceFieldPathPrefixInput('');
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
        setDatasourceDraft(domain === 'datasource'
          ? toDatasourceManifestDraft(starter as Record<string, unknown>, itemId)
          : null);
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
      setDatasourceDraft(null);
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
    setDatasourceDraft(
      domain === 'datasource'
        ? toDatasourceManifestDraft(selectedRevision.manifest || {}, itemId)
        : null,
    );
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
    if (domain === 'datasource' && datasourceDraft) {
      nextManifest = prettyJson(toDatasourceManifest(datasourceDraft));
    }
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
  }, [domain, datasourceDraft, planningDraft, animationTemplateDraft, agentDraft, skillDraft]);

  function readCurrentManifestForWrite() {
    if (domain === 'datasource' && datasourceDraft) {
      return toDatasourceManifest(datasourceDraft);
    }
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

  function updateDatasourceDraft(patch: Partial<DatasourceManifestDraft>) {
    setDatasourceDraft((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        ...patch,
      };
    });
  }

  function updateDatasourceField(index: number, patch: Partial<DatasourceFieldDraft>) {
    setDatasourceDraft((previous) => {
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
  }

  function addDatasourceField() {
    setDatasourceDraft((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        fields: [
          ...previous.fields,
          buildDefaultDatasourceField(previous.fields.length),
        ],
      };
    });
  }

  function removeDatasourceField(index: number) {
    setDatasourceDraft((previous) => {
      if (!previous || previous.fields.length <= 1) {
        return previous;
      }
      return {
        ...previous,
        fields: previous.fields.filter((_, fieldIndex) => fieldIndex !== index),
      };
    });
  }

  function updateDatasourceSection(index: number, patch: Partial<DatasourceFormSectionDraft>) {
    setDatasourceDraft((previous) => {
      if (!previous) {
        return previous;
      }
      const nextSections = previous.formSections.map((section, sectionIndex) => (
        sectionIndex === index
          ? { ...section, ...patch }
          : section
      ));
      return {
        ...previous,
        formSections: nextSections,
      };
    });
  }

  function addDatasourceSection() {
    setDatasourceDraft((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        formSections: [
          ...previous.formSections,
          buildDefaultDatasourceSection(previous.formSections.length),
        ],
      };
    });
  }

  function removeDatasourceSection(index: number) {
    setDatasourceDraft((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        formSections: previous.formSections.filter((_, sectionIndex) => sectionIndex !== index),
      };
    });
  }

  function updateDatasourceRule(
    kind: 'applyRules' | 'removeRules',
    index: number,
    patch: Partial<DatasourceRuleDraft>,
  ) {
    setDatasourceDraft((previous) => {
      if (!previous) {
        return previous;
      }
      const nextRules = previous[kind].map((rule, ruleIndex) => (
        ruleIndex === index
          ? { ...rule, ...patch }
          : rule
      ));
      return {
        ...previous,
        [kind]: nextRules,
      };
    });
  }

  function addDatasourceRule(kind: 'applyRules' | 'removeRules') {
    setDatasourceDraft((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        [kind]: [...previous[kind], buildDefaultDatasourceRule()],
      };
    });
  }

  function removeDatasourceRule(kind: 'applyRules' | 'removeRules', index: number) {
    setDatasourceDraft((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        [kind]: previous[kind].filter((_, ruleIndex) => ruleIndex !== index),
      };
    });
  }

  function appendDatasourcePresetFields(presetFields: DatasourceFieldDraft[], presetName: string) {
    let addedCount = 0;
    setDatasourceDraft((previous) => {
      if (!previous) {
        return previous;
      }

      const existingIds = new Set(
        previous.fields
          .map((field) => field.id.trim().toLowerCase())
          .filter((fieldId) => fieldId.length > 0),
      );
      const nextFields = [...previous.fields];
      presetFields.forEach((field) => {
        const normalizedId = field.id.trim().toLowerCase();
        if (!normalizedId || existingIds.has(normalizedId)) {
          return;
        }
        existingIds.add(normalizedId);
        nextFields.push(field);
        addedCount += 1;
      });

      return {
        ...previous,
        fields: nextFields,
      };
    });

    setFeedback({
      tone: 'info',
      message:
        addedCount > 0
          ? `Preset "${presetName}" added ${addedCount} field(s).`
          : `Preset "${presetName}" skipped (all field ids already exist).`,
    });
  }

  function handleApplyPresetBasicFields() {
    appendDatasourcePresetFields(
      [
        {
          id: 'league',
          type: 'text',
          pathText: 'league',
          homePathText: '',
          drawPathText: '',
          awayPathText: '',
        },
        {
          id: 'status',
          type: 'text',
          pathText: 'status',
          homePathText: '',
          drawPathText: '',
          awayPathText: '',
        },
        {
          id: 'home_team',
          type: 'text',
          pathText: 'homeTeam.name',
          homePathText: '',
          drawPathText: '',
          awayPathText: '',
        },
        {
          id: 'away_team',
          type: 'text',
          pathText: 'awayTeam.name',
          homePathText: '',
          drawPathText: '',
          awayPathText: '',
        },
      ],
      'basic fields',
    );
  }

  function handleApplyPresetOddsTriplet() {
    appendDatasourcePresetFields(
      [
        {
          id: 'odds_1x2',
          type: 'odds_triplet',
          pathText: '',
          homePathText: 'odds.home',
          drawPathText: 'odds.draw',
          awayPathText: 'odds.away',
        },
      ],
      '1X2 odds',
    );
  }

  function handleAutoBuildMainSection() {
    setDatasourceDraft((previous) => {
      if (!previous) {
        return previous;
      }
      const fieldIds = previous.fields
        .map((field) => field.id.trim())
        .filter((fieldId) => fieldId.length > 0);
      if (fieldIds.length === 0) {
        return previous;
      }

      const nextSection: DatasourceFormSectionDraft = {
        id: 'main',
        titleKey: 'datasource.main',
        title: 'Main',
        columns: '2',
        fieldIdsText: fieldIds.join(', '),
      };

      const existingIndex = previous.formSections.findIndex(
        (section) => section.id.trim().toLowerCase() === 'main',
      );
      const nextSections =
        existingIndex >= 0
          ? previous.formSections.map((section, index) => (
              index === existingIndex ? nextSection : section
            ))
          : [...previous.formSections, nextSection];

      return {
        ...previous,
        formSections: nextSections,
      };
    });

    setFeedback({
      tone: 'success',
      message: 'Main section rebuilt from current field ids.',
    });
  }

  function handleAutoFillEmptyFieldPaths() {
    if (!datasourceDraft) {
      setFeedback({
        tone: 'info',
        message: 'No datasource draft loaded.',
      });
      return;
    }

    const prefix = datasourceFieldPathPrefixInput.trim();
    let updatedCount = 0;
    const nextFields = datasourceDraft.fields.map((field) => {
      const normalizedId = normalizeDatasourcePathToken(field.id);
      if (!normalizedId) {
        return field;
      }

      let nextField = field;
      if (field.type === 'versus_number') {
        const homeCandidate = composeDatasourcePathWithPrefix(prefix, `${normalizedId}.home`);
        const awayCandidate = composeDatasourcePathWithPrefix(prefix, `${normalizedId}.away`);
        if (!field.homePathText.trim() || !field.awayPathText.trim()) {
          nextField = {
            ...field,
            homePathText: field.homePathText.trim() || homeCandidate,
            awayPathText: field.awayPathText.trim() || awayCandidate,
          };
        }
      } else if (field.type === 'odds_triplet') {
        const homeCandidate = composeDatasourcePathWithPrefix(prefix, `${normalizedId}.home`);
        const drawCandidate = composeDatasourcePathWithPrefix(prefix, `${normalizedId}.draw`);
        const awayCandidate = composeDatasourcePathWithPrefix(prefix, `${normalizedId}.away`);
        if (!field.homePathText.trim() || !field.drawPathText.trim() || !field.awayPathText.trim()) {
          nextField = {
            ...field,
            homePathText: field.homePathText.trim() || homeCandidate,
            drawPathText: field.drawPathText.trim() || drawCandidate,
            awayPathText: field.awayPathText.trim() || awayCandidate,
          };
        }
      } else {
        const pathCandidate = composeDatasourcePathWithPrefix(prefix, normalizedId);
        if (!field.pathText.trim()) {
          nextField = {
            ...field,
            pathText: pathCandidate,
          };
        }
      }

      if (nextField !== field) {
        updatedCount += 1;
      }
      return nextField;
    });

    setDatasourceDraft({
      ...datasourceDraft,
      fields: nextFields,
    });

    setFeedback({
      tone: 'info',
      message:
        updatedCount > 0
          ? `Auto-filled empty mapping paths for ${updatedCount} field(s).`
          : 'No empty mapping path to auto-fill.',
    });
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
      if (domain === 'datasource') {
        setDatasourceDraft(toDatasourceManifestDraft(parsed, selectedItemId || 'datasource_item'));
      }
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

  async function handleRunDatasourcePreview() {
    if (!datasourceManifestPreview) {
      setFeedback({ tone: 'error', message: 'Datasource manifest is not ready for preview.' });
      return;
    }

    const parsedLimit = Number.parseInt(datasourcePreviewLimitInput, 10);
    const statuses = parseCsvText(datasourcePreviewStatusInput);
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : 5;

    setIsRunningDatasourcePreview(true);
    try {
      const [structure, data] = await Promise.all([
        previewDatasourceStructure({
          manifest: datasourceManifestPreview,
        }),
        previewDatasourceData({
          manifest: datasourceManifestPreview,
          limit,
          ...(statuses.length > 0 ? { statuses } : {}),
        }),
      ]);

      setDatasourceStructurePreview(structure);
      setDatasourceDataPreview(data);
      setFeedback({
        tone: 'success',
        message: `Datasource server preview loaded (${data.summary.rowCount} row(s)).`,
      });
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setIsRunningDatasourcePreview(false);
    }
  }

  function resolveDatasourceCollectionSourceId() {
    const fromInput = datasourceCollectorSourceIdInput.trim();
    if (fromInput) {
      return fromInput;
    }
    if (datasourceDraft?.id?.trim()) {
      return datasourceDraft.id.trim();
    }
    if (selectedItemId.trim()) {
      return selectedItemId.trim();
    }
    return '';
  }

  async function refreshDatasourceCollectionGovernance() {
    if (domain !== 'datasource') {
      return;
    }
    const sourceId = resolveDatasourceCollectionSourceId();
    if (!sourceId) {
      setDatasourceCollectors([]);
      setDatasourceCollectionHealth([]);
      setDatasourceCollectionHealthSummary(EMPTY_DATASOURCE_HEALTH_SUMMARY);
      setDatasourceCollectionHealthGeneratedAt('');
      setDatasourceCollectionRuns([]);
      setDatasourceCollectionSnapshots([]);
      return;
    }

    setIsDatasourceCollectionLoading(true);
    try {
      const [collectorsResult, healthResult, runsResult, snapshotsResult] = await Promise.all([
        listDatasourceCollectors({
          sourceId,
          limit: 20,
        }),
        listDatasourceCollectionHealth({
          sourceId,
          limit: 20,
        }),
        listDatasourceCollectionRuns({
          sourceId,
          limit: 20,
        }),
        listDatasourceCollectionSnapshots({
          sourceId,
          limit: 30,
        }),
      ]);

      setDatasourceCollectors(collectorsResult.data || []);
      setDatasourceCollectionHealth(healthResult.data || []);
      setDatasourceCollectionHealthSummary(
        healthResult.summary || EMPTY_DATASOURCE_HEALTH_SUMMARY,
      );
      setDatasourceCollectionHealthGeneratedAt(healthResult.generatedAt || '');
      setDatasourceCollectionRuns(runsResult.data || []);
      setDatasourceCollectionSnapshots(snapshotsResult.data || []);
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setIsDatasourceCollectionLoading(false);
    }
  }

  async function handleCreateDatasourceCollector() {
    const sourceId = resolveDatasourceCollectionSourceId();
    if (!sourceId) {
      setFeedback({ tone: 'error', message: 'collector sourceId is required.' });
      return;
    }
    if (!datasourceCollectorNameInput.trim()) {
      setFeedback({ tone: 'error', message: 'collector name is required.' });
      return;
    }

    setIsCreatingDatasourceCollector(true);
    try {
      await createDatasourceCollector({
        sourceId,
        name: datasourceCollectorNameInput.trim(),
        provider: 'match_snapshot',
        config: {
          sampleLimit: 20,
        },
      });
      setFeedback({ tone: 'success', message: `Collector created for source ${sourceId}.` });
      await refreshDatasourceCollectionGovernance();
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setIsCreatingDatasourceCollector(false);
    }
  }

  async function handleTriggerDatasourceCollectorRun(collectorId: string) {
    setRunningCollectorId(collectorId);
    try {
      const result = await triggerDatasourceCollectorRun(collectorId, {
        triggerType: 'manual',
      });
      setFeedback({
        tone: 'success',
        message: `Collection run succeeded (${result.snapshot.recordCount} record(s)).`,
      });
      await refreshDatasourceCollectionGovernance();
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setRunningCollectorId('');
    }
  }

  async function handleConfirmDatasourceSnapshot(snapshotId: string, action: 'confirm' | 'reject') {
    setConfirmingSnapshotId(snapshotId);
    try {
      await confirmDatasourceCollectionSnapshot(snapshotId, {
        action,
      });
      setFeedback({
        tone: action === 'confirm' ? 'success' : 'info',
        message: `Snapshot ${action} completed.`,
      });
      await refreshDatasourceCollectionGovernance();
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setConfirmingSnapshotId('');
    }
  }

  async function handleReleaseDatasourceSnapshot(snapshotId: string) {
    setReleasingSnapshotId(snapshotId);
    try {
      const data = await releaseDatasourceCollectionSnapshot(snapshotId, {
        channel: publishChannel as 'internal' | 'beta' | 'stable',
      });
      const deprecatedCount = data.deprecatedSnapshotIds.length;
      setFeedback({
        tone: 'success',
        message: `Snapshot released to ${publishChannel}. Deprecated ${deprecatedCount} previous snapshot(s).`,
      });
      await refreshDatasourceCollectionGovernance();
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setReleasingSnapshotId('');
    }
  }

  async function handleReplayDatasourceSnapshot(snapshotId: string) {
    setReplayingSnapshotId(snapshotId);
    try {
      const data = await replayDatasourceCollectionSnapshot(snapshotId, {
        triggerType: 'retry',
        allowDuplicate: true,
      });
      setFeedback({
        tone: 'success',
        message: data.deduplicated
          ? `Snapshot replay deduplicated, reused snapshot ${data.snapshot.id}.`
          : `Snapshot replay created new snapshot ${data.snapshot.id}.`,
      });
      await refreshDatasourceCollectionGovernance();
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setReplayingSnapshotId('');
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
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => navigate('/identity')}
              >
                <ShieldCheck className="h-4 w-4" />
                Identity Center
              </Button>
              <div>
                <h1 className="text-base font-bold tracking-tight text-white">Admin Studio 2.0</h1>
                <p className="text-xs text-zinc-500">
                  Standalone server admin web: catalog + validation + release workflow
                </p>
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
                testId="domain-select"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_1fr_auto]">
              <input
                type="text"
                value={serverUrlInput}
                onChange={(event) => setServerUrlInput(event.target.value)}
                placeholder="Server URL (e.g. http://127.0.0.1:3001)"
                data-testid="settings-server-url"
                className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
              <input
                type="password"
                value={apiKeyInput}
                onChange={(event) => setApiKeyInput(event.target.value)}
                placeholder="API Key"
                data-testid="settings-api-key"
                className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSaveConnectionSettings}
                data-testid="settings-save-connection"
              >
                Save Connection
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-[170px_1fr_1fr_auto_auto_auto]">
              <Select
                value={authModeInput}
                onChange={(value) => setAuthModeInput(value as AdminStudioAuthMode)}
                options={AUTH_MODE_OPTIONS}
              />
              <input
                type="text"
                value={accountIdentifierInput}
                onChange={(event) => setAccountIdentifierInput(event.target.value)}
                placeholder="Account (username/email)"
                className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
              <input
                type="password"
                value={accountPasswordInput}
                onChange={(event) => setAccountPasswordInput(event.target.value)}
                placeholder="Account Password"
                className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleAccountLogin()}
                disabled={isAuthenticating}
              >
                {isAuthenticating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Login'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleRefreshIdentity()}
                disabled={isAuthenticating}
              >
                Me
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleLogout()}
                disabled={isAuthenticating}
              >
                Logout
              </Button>
            </div>
            <div className="text-xs text-zinc-500">
              Auth status: {authModeInput === 'account' ? 'account mode' : 'api key mode'} | {formatAuthUserLabel(currentAuthUser)}
              {capabilities && (
                <span>
                  {' '}
                  | adminConsole={String(capabilities.canUseAdminConsole)} | templates={capabilities.availableTemplates.length}
                </span>
              )}
            </div>
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
                  data-testid="create-item-id"
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={newItemVersion}
                  onChange={(event) => setNewItemVersion(event.target.value)}
                  placeholder="version (e.g. 1.0.0)"
                  data-testid="create-item-version"
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <textarea
                value={newItemManifestText}
                onChange={(event) => setNewItemManifestText(event.target.value)}
                spellCheck={false}
                data-testid="create-item-manifest"
                className="min-h-[180px] w-full rounded-lg border border-white/10 bg-zinc-900 p-3 font-mono text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
              <Button
                onClick={() => void handleCreateItem()}
                disabled={isCreatingItem}
                className="w-full gap-2"
                data-testid="create-item-submit"
              >
                {isCreatingItem ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Create Item
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          {feedback && (
            <div
              data-testid="feedback-banner"
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
                    Item:{' '}
                    <span className="font-mono text-zinc-300" data-testid="revision-editor-item">
                      {selectedItemId || '-'}
                    </span>
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

                  {domain === 'datasource' && datasourceDraft && (
                    <div className="space-y-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                            Datasource Builder
                          </h3>
                          <p className="text-[11px] text-zinc-400">
                            Structured editor for datasource metadata and field mapping paths.
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

                      <div className="space-y-3 rounded-lg border border-emerald-500/20 bg-black/30 p-3">
                        <div className="flex flex-wrap gap-2">
                          {DATASOURCE_EDITOR_STEP_OPTIONS.map((step) => (
                            <button
                              key={`datasource-editor-step-${step.value}`}
                              type="button"
                              onClick={() => setDatasourceEditorStep(step.value)}
                              className={`rounded-full border px-3 py-1 text-[11px] transition ${
                                datasourceEditorStep === step.value
                                  ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
                                  : 'border-white/10 bg-zinc-900 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                              }`}
                            >
                              {step.label}
                            </button>
                          ))}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          Current focus: {DATASOURCE_EDITOR_STEP_OPTIONS.find((step) => step.value === datasourceEditorStep)?.hint || '-'}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4 xl:grid-cols-8">
                          <div className="rounded border border-white/10 bg-zinc-900 px-2 py-1.5 text-zinc-300">
                            fields: {datasourceEditorSummary.fieldCount}
                          </div>
                          <div className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1.5 text-emerald-300">
                            mapped: {datasourceEditorSummary.mappedReadyCount}
                          </div>
                          <div className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-amber-300">
                            missing: {datasourceEditorSummary.missingMappingCount}
                          </div>
                          <div className="rounded border border-red-500/20 bg-red-500/10 px-2 py-1.5 text-red-300">
                            dup paths: {datasourceEditorSummary.duplicatePathCount}
                          </div>
                          <div className="rounded border border-red-500/20 bg-red-500/10 px-2 py-1.5 text-red-300">
                            dup ids: {datasourceEditorSummary.duplicateFieldIdCount}
                          </div>
                          <div className="rounded border border-white/10 bg-zinc-900 px-2 py-1.5 text-zinc-300">
                            sections: {datasourceEditorSummary.sectionCount}
                          </div>
                          <div className="rounded border border-white/10 bg-zinc-900 px-2 py-1.5 text-zinc-300">
                            permissions: {datasourceEditorSummary.permissionCount}
                          </div>
                          <div className="rounded border border-white/10 bg-zinc-900 px-2 py-1.5 text-zinc-300">
                            rules: {datasourceEditorSummary.ruleCount}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={handleApplyPresetBasicFields}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add Basic Preset
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={handleApplyPresetOddsTriplet}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add 1X2 Odds Preset
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={handleAutoBuildMainSection}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Auto Build Main Section
                          </Button>
                        </div>
                      </div>

                      <div className={isDatasourceStepVisible(datasourceEditorStep, 'basics') ? 'space-y-3' : 'hidden'}>
                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                          <input
                            type="text"
                            value={datasourceDraft.id}
                            onChange={(event) => updateDatasourceDraft({ id: event.target.value })}
                          placeholder="datasource id"
                          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={datasourceDraft.name}
                          onChange={(event) => updateDatasourceDraft({ name: event.target.value })}
                          placeholder="datasource name"
                          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={datasourceDraft.labelKey}
                          onChange={(event) => updateDatasourceDraft({ labelKey: event.target.value })}
                          placeholder="labelKey (optional)"
                          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                        </div>

                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                        <input
                          type="text"
                          value={datasourceDraft.requiredPermissionsText}
                          onChange={(event) => updateDatasourceDraft({ requiredPermissionsText: event.target.value })}
                          placeholder="requiredPermissions (comma-separated)"
                          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                        <Select
                          value={datasourceDraft.cardSpan}
                          onChange={(value) => updateDatasourceDraft({ cardSpan: value as '1' | '2' })}
                          options={DATASOURCE_CARD_SPAN_OPTIONS}
                        />
                        <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-200">
                          <input
                            type="checkbox"
                            checked={datasourceDraft.defaultSelected}
                            onChange={(event) => updateDatasourceDraft({ defaultSelected: event.target.checked })}
                            className="h-4 w-4 accent-emerald-500"
                          />
                          defaultSelected
                        </label>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-zinc-400">
                          Step 1 guidance: use stable `id` + clear `name`; permissions usually start with
                          {' '}
                          <span className="font-mono text-zinc-300">datasource:use:</span>
                          {' '}
                          (comma-separated).
                        </div>
                      </div>

                      <div className={isDatasourceStepVisible(datasourceEditorStep, 'fields') ? 'space-y-2' : 'hidden'}>
                        <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                              Step 2: Fields ({datasourceDraft.fields.length})
                            </p>
                            <Button variant="outline" size="sm" className="gap-1" onClick={addDatasourceField}>
                              <Plus className="h-3.5 w-3.5" />
                              Add Field
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 gap-2 xl:grid-cols-[170px_1fr_170px_auto]">
                            <Select
                              value={datasourceFieldViewMode}
                              onChange={(value) => setDatasourceFieldViewMode(value as DatasourceFieldViewMode)}
                              options={DATASOURCE_FIELD_VIEW_MODE_OPTIONS}
                            />
                            <input
                              type="text"
                              value={datasourceFieldFilterText}
                              onChange={(event) => setDatasourceFieldFilterText(event.target.value)}
                              placeholder="Filter by id/type/path"
                              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                            />
                            <input
                              type="text"
                              value={datasourceFieldPathPrefixInput}
                              onChange={(event) => setDatasourceFieldPathPrefixInput(event.target.value)}
                              placeholder="path prefix (optional)"
                              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={handleAutoFillEmptyFieldPaths}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Auto Fill Empty Paths
                            </Button>
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
                              <div className="flex flex-wrap items-center gap-2 text-zinc-400">
                                <span className="rounded border border-white/10 bg-zinc-900 px-2 py-0.5">
                                  visible: {datasourceFieldVisibilitySummary.visibleCount}/{datasourceFieldVisibilitySummary.total}
                                </span>
                                <span className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-amber-300">
                                  issues: {datasourceFieldVisibilitySummary.issueCount}
                                </span>
                                <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                                  ready: {datasourceFieldVisibilitySummary.readyCount}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[10px] text-zinc-400 hover:text-zinc-100"
                                onClick={() => {
                                  setDatasourceFieldViewMode('all');
                                  setDatasourceFieldFilterText('');
                                }}
                                disabled={datasourceFieldViewMode === 'all' && datasourceFieldFilterText.trim().length === 0}
                              >
                                Clear Filters
                              </Button>
                            </div>
                            <div className="mt-1">
                              Tip: choose <span className="text-zinc-300">issues only</span> to focus on missing id/path and duplicate rows.
                            </div>
                          </div>
                        </div>

                        <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
                          {datasourceVisibleFieldRows.length === 0 && (
                            <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                              No rows match current field filters. Clear filters or switch to all fields.
                            </div>
                          )}
                          {datasourceVisibleFieldRows.map((row) => {
                            const { field, index: fieldIndex, hasIssue, duplicateId, duplicatePath, mappingReady } = row;
                            return (
                            <div key={`${field.id}-${fieldIndex}`} className="space-y-2 rounded-lg border border-white/10 bg-zinc-900 p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-200">
                                  <span>Field {fieldIndex + 1}</span>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                      hasIssue
                                        ? 'bg-amber-500/15 text-amber-300'
                                        : 'bg-emerald-500/15 text-emerald-300'
                                    }`}
                                  >
                                    {hasIssue ? 'needs attention' : 'ready'}
                                  </span>
                                  {!field.id.trim() && (
                                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                                      missing id
                                    </span>
                                  )}
                                  {!mappingReady && (
                                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                                      missing path
                                    </span>
                                  )}
                                  {duplicateId && (
                                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                                      duplicate id
                                    </span>
                                  )}
                                  {duplicatePath && (
                                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                                      duplicate path
                                    </span>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1 text-red-300 hover:text-red-200"
                                  onClick={() => removeDatasourceField(fieldIndex)}
                                  disabled={datasourceDraft.fields.length <= 1}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Remove
                                </Button>
                              </div>

                              <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                                <input
                                  type="text"
                                  value={field.id}
                                  onChange={(event) => updateDatasourceField(fieldIndex, { id: event.target.value })}
                                  placeholder="field id"
                                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                />
                                <Select
                                  value={field.type}
                                  onChange={(value) => updateDatasourceField(fieldIndex, { type: value as DatasourceFieldType })}
                                  options={DATASOURCE_FIELD_TYPE_OPTIONS}
                                />
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
                                <span className="text-zinc-500">
                                  {DATASOURCE_FIELD_TYPE_HINTS[field.type]}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 font-semibold ${
                                    getDatasourceFieldProvidedPathCount(field) >= getDatasourceFieldRequiredPathCount(field)
                                      ? 'bg-emerald-500/15 text-emerald-300'
                                      : 'bg-amber-500/15 text-amber-300'
                                  }`}
                                >
                                  mapping {getDatasourceFieldProvidedPathCount(field)}/{getDatasourceFieldRequiredPathCount(field)}
                                </span>
                              </div>

                              {(field.type === 'text'
                                || field.type === 'number'
                                || field.type === 'textarea'
                                || field.type === 'csv_array') && (
                                <input
                                  type="text"
                                  value={field.pathText}
                                  onChange={(event) => updateDatasourceField(fieldIndex, { pathText: event.target.value })}
                                  placeholder="path (dot notation, e.g. stats.form)"
                                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                />
                              )}

                              {field.type === 'versus_number' && (
                                <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                                  <input
                                    type="text"
                                    value={field.homePathText}
                                    onChange={(event) => updateDatasourceField(fieldIndex, { homePathText: event.target.value })}
                                    placeholder="homePath (e.g. odds.home)"
                                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                  />
                                  <input
                                    type="text"
                                    value={field.awayPathText}
                                    onChange={(event) => updateDatasourceField(fieldIndex, { awayPathText: event.target.value })}
                                    placeholder="awayPath (e.g. odds.away)"
                                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                  />
                                </div>
                              )}

                              {field.type === 'odds_triplet' && (
                                <div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
                                  <input
                                    type="text"
                                    value={field.homePathText}
                                    onChange={(event) => updateDatasourceField(fieldIndex, { homePathText: event.target.value })}
                                    placeholder="homePath"
                                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                  />
                                  <input
                                    type="text"
                                    value={field.drawPathText}
                                    onChange={(event) => updateDatasourceField(fieldIndex, { drawPathText: event.target.value })}
                                    placeholder="drawPath"
                                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                  />
                                  <input
                                    type="text"
                                    value={field.awayPathText}
                                    onChange={(event) => updateDatasourceField(fieldIndex, { awayPathText: event.target.value })}
                                    placeholder="awayPath"
                                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                  />
                                </div>
                              )}
                            </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className={isDatasourceStepVisible(datasourceEditorStep, 'layout') ? 'space-y-2' : 'hidden'}>
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                            Step 3: Form Sections ({datasourceDraft.formSections.length})
                          </p>
                          <Button variant="outline" size="sm" className="gap-1" onClick={addDatasourceSection}>
                            <Plus className="h-3.5 w-3.5" />
                            Add Section
                          </Button>
                        </div>
                        {datasourceDraft.formSections.length === 0 && (
                          <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                            Optional: add sections for generated form layout.
                          </div>
                        )}
                        <div className="space-y-2">
                          {datasourceDraft.formSections.map((section, sectionIndex) => (
                            <div key={`${section.id}-${sectionIndex}`} className="space-y-2 rounded-lg border border-white/10 bg-zinc-900 p-3">
                              <div className="flex items-center justify-between">
                                <div className="text-xs font-semibold text-zinc-200">
                                  Section {sectionIndex + 1}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1 text-red-300 hover:text-red-200"
                                  onClick={() => removeDatasourceSection(sectionIndex)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Remove
                                </Button>
                              </div>
                              <div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
                                <input
                                  type="text"
                                  value={section.id}
                                  onChange={(event) => updateDatasourceSection(sectionIndex, { id: event.target.value })}
                                  placeholder="section id"
                                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                />
                                <input
                                  type="text"
                                  value={section.titleKey}
                                  onChange={(event) => updateDatasourceSection(sectionIndex, { titleKey: event.target.value })}
                                  placeholder="titleKey (optional)"
                                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                />
                                <input
                                  type="text"
                                  value={section.title}
                                  onChange={(event) => updateDatasourceSection(sectionIndex, { title: event.target.value })}
                                  placeholder="title (optional)"
                                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                />
                              </div>
                              <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                                <Select
                                  value={section.columns}
                                  onChange={(value) => updateDatasourceSection(sectionIndex, { columns: value as '1' | '2' })}
                                  options={DATASOURCE_SECTION_COLUMN_OPTIONS}
                                />
                                <input
                                  type="text"
                                  value={section.fieldIdsText}
                                  onChange={(event) => updateDatasourceSection(sectionIndex, { fieldIdsText: event.target.value })}
                                  placeholder="field ids (comma-separated)"
                                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className={isDatasourceStepVisible(datasourceEditorStep, 'layout') ? 'grid grid-cols-1 gap-3 xl:grid-cols-2' : 'hidden'}>
                        <div className="space-y-2 rounded-lg border border-white/10 bg-zinc-900 p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                              Step 3: Apply Rules ({datasourceDraft.applyRules.length})
                            </p>
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => addDatasourceRule('applyRules')}>
                              <Plus className="h-3.5 w-3.5" />
                              Add Rule
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {datasourceDraft.applyRules.length === 0 && (
                              <div className="rounded-lg border border-dashed border-white/10 p-2 text-xs text-zinc-500">
                                Optional: define patch/apply targets.
                              </div>
                            )}
                            {datasourceDraft.applyRules.map((rule, ruleIndex) => (
                              <div key={`apply-rule-${ruleIndex}`} className="space-y-2 rounded-lg border border-white/10 bg-black/40 p-2">
                                <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                                  <input
                                    type="text"
                                    value={rule.targetPathText}
                                    onChange={(event) => updateDatasourceRule('applyRules', ruleIndex, { targetPathText: event.target.value })}
                                    placeholder="path (dot notation)"
                                    className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                  />
                                  <input
                                    type="text"
                                    value={rule.targetText}
                                    onChange={(event) => updateDatasourceRule('applyRules', ruleIndex, { targetText: event.target.value })}
                                    placeholder="target (fallback)"
                                    className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                  />
                                </div>
                                <div className="flex justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1 text-red-300 hover:text-red-200"
                                    onClick={() => removeDatasourceRule('applyRules', ruleIndex)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2 rounded-lg border border-white/10 bg-zinc-900 p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                              Step 3: Remove Rules ({datasourceDraft.removeRules.length})
                            </p>
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => addDatasourceRule('removeRules')}>
                              <Plus className="h-3.5 w-3.5" />
                              Add Rule
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {datasourceDraft.removeRules.length === 0 && (
                              <div className="rounded-lg border border-dashed border-white/10 p-2 text-xs text-zinc-500">
                                Optional: define cleanup/remove targets.
                              </div>
                            )}
                            {datasourceDraft.removeRules.map((rule, ruleIndex) => (
                              <div key={`remove-rule-${ruleIndex}`} className="space-y-2 rounded-lg border border-white/10 bg-black/40 p-2">
                                <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                                  <input
                                    type="text"
                                    value={rule.targetPathText}
                                    onChange={(event) => updateDatasourceRule('removeRules', ruleIndex, { targetPathText: event.target.value })}
                                    placeholder="path (dot notation)"
                                    className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                  />
                                  <input
                                    type="text"
                                    value={rule.targetText}
                                    onChange={(event) => updateDatasourceRule('removeRules', ruleIndex, { targetText: event.target.value })}
                                    placeholder="target (fallback)"
                                    className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                  />
                                </div>
                                <div className="flex justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1 text-red-300 hover:text-red-200"
                                    onClick={() => removeDatasourceRule('removeRules', ruleIndex)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className={isDatasourceStepVisible(datasourceEditorStep, 'validate') ? 'grid grid-cols-1 gap-3 xl:grid-cols-2' : 'hidden'}>
                        <div className="space-y-2 rounded-lg border border-white/10 bg-zinc-900 p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                              Step 4: Local Contract Precheck
                            </p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                datasourceLocalFailedChecks.length === 0
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : 'bg-red-500/15 text-red-300'
                              }`}
                            >
                              {datasourceLocalFailedChecks.length === 0
                                ? 'Passed'
                                : `Failed (${datasourceLocalFailedChecks.length})`}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {datasourceLocalChecks.map((check) => (
                              <div
                                key={`datasource-local-check-${check.name}`}
                                className={`rounded-lg border px-3 py-2 text-xs ${
                                  check.status === 'passed'
                                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                                    : 'border-red-500/20 bg-red-500/10 text-red-300'
                                }`}
                              >
                                <div className="font-semibold">{check.name}</div>
                                <div className="mt-1 text-[11px] opacity-90">{check.message}</div>
                                {check.status === 'failed' && (
                                  <div className="mt-1 text-[11px] opacity-80">
                                    {check.details?.errors.length || 0} issue(s)
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1 rounded-lg border border-white/10 bg-zinc-900 p-3">
                        <label className="text-[11px] uppercase tracking-wider text-zinc-500">
                          Step 4: sourceContext Preview
                        </label>
                          <textarea
                            value={prettyJson(datasourceSourceContextPreview || {})}
                            readOnly
                            spellCheck={false}
                            className="min-h-[180px] w-full rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-[11px] text-zinc-200 focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className={isDatasourceStepVisible(datasourceEditorStep, 'validate') ? 'space-y-1 rounded-lg border border-white/10 bg-zinc-900 p-3' : 'hidden'}>
                        <label className="text-[11px] uppercase tracking-wider text-zinc-500">
                          Step 4: Payload Skeleton Preview
                        </label>
                        <textarea
                          value={prettyJson(datasourcePayloadPreview || {})}
                          readOnly
                          spellCheck={false}
                          className="min-h-[180px] w-full rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-[11px] text-zinc-200 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div className={isDatasourceStepVisible(datasourceEditorStep, 'validate') ? 'space-y-3 rounded-lg border border-white/10 bg-zinc-900 p-3' : 'hidden'}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h4 className="text-[11px] uppercase tracking-wider text-zinc-500">
                              Step 4: Server Preview
                            </h4>
                            <p className="text-[11px] text-zinc-400">
                              Query server-side structure and live DB samples using current datasource draft.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={20}
                              value={datasourcePreviewLimitInput}
                              onChange={(event) => setDatasourcePreviewLimitInput(event.target.value)}
                              placeholder="limit"
                              className="w-20 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                              data-testid="datasource-server-preview-limit"
                            />
                            <input
                              type="text"
                              value={datasourcePreviewStatusInput}
                              onChange={(event) => setDatasourcePreviewStatusInput(event.target.value)}
                              placeholder="status filter (csv)"
                              className="w-48 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                              data-testid="datasource-server-preview-statuses"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={handleRunDatasourcePreview}
                              disabled={isRunningDatasourcePreview}
                              data-testid="datasource-server-preview-run"
                            >
                              {isRunningDatasourcePreview ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
                              Run Server Preview
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                          <div className="space-y-2 rounded-lg border border-white/10 bg-black/40 p-3">
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                                Server Structure Preview
                              </p>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  datasourceStructurePreview?.validation.status === 'passed'
                                    ? 'bg-emerald-500/15 text-emerald-300'
                                    : 'bg-zinc-700 text-zinc-300'
                                }`}
                              >
                                {datasourceStructurePreview
                                  ? datasourceStructurePreview.validation.status
                                  : 'idle'}
                              </span>
                            </div>
                            {!datasourceStructurePreview && (
                              <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                                Run server preview to inspect datasource field mappings and path tree.
                              </div>
                            )}
                            {datasourceStructurePreview && (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3 xl:grid-cols-5">
                                  <div className="rounded border border-white/10 bg-zinc-900 px-2 py-1.5 text-zinc-300">
                                    fields: {datasourceStructurePreview.summary.totalFields}
                                  </div>
                                  <div className="rounded border border-white/10 bg-zinc-900 px-2 py-1.5 text-zinc-300">
                                    mapped: {datasourceStructurePreview.summary.mappedFieldCount}
                                  </div>
                                  <div className="rounded border border-white/10 bg-zinc-900 px-2 py-1.5 text-zinc-300">
                                    paths: {datasourceStructurePreview.summary.mappedPathCount}
                                  </div>
                                  <div className="rounded border border-white/10 bg-zinc-900 px-2 py-1.5 text-zinc-300">
                                    duplicates: {datasourceStructurePreview.summary.duplicatePathCount}
                                  </div>
                                  <div className="rounded border border-white/10 bg-zinc-900 px-2 py-1.5 text-zinc-300">
                                    invalid: {datasourceStructurePreview.summary.invalidFieldCount}
                                  </div>
                                </div>
                                <div className="max-h-[200px] space-y-2 overflow-auto pr-1">
                                  {datasourceStructurePreview.fieldCatalog.map((field, fieldIndex) => (
                                    <div key={`server-preview-field-${field.fieldId}-${fieldIndex}`} className="rounded border border-white/10 bg-zinc-900 px-2 py-1.5">
                                      <div className="flex items-center justify-between text-[11px]">
                                        <span className="font-semibold text-zinc-200">{field.fieldId}</span>
                                        <span className="text-zinc-500">{field.fieldType}</span>
                                      </div>
                                      <div className="mt-1 break-all text-[11px] text-zinc-400">
                                        {field.mappings.length > 0
                                          ? field.mappings.map((mapping) => `${mapping.slot}:${mapping.pathText}`).join(' | ')
                                          : 'No valid mapping'}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <textarea
                                  value={prettyJson(datasourceStructurePreview.pathCatalog)}
                                  readOnly
                                  spellCheck={false}
                                  className="min-h-[120px] w-full rounded-lg border border-white/10 bg-zinc-900 p-3 font-mono text-[11px] text-zinc-300 focus:border-emerald-500 focus:outline-none"
                                />
                              </div>
                            )}
                          </div>

                          <div className="space-y-2 rounded-lg border border-white/10 bg-black/40 p-3">
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                                Database Data Preview
                              </p>
                              <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                                rows: {datasourceDataPreview?.summary.rowCount || 0}
                              </span>
                            </div>
                            {!datasourceDataPreview && (
                              <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                                No DB sample yet. Run server preview first.
                              </div>
                            )}
                            {datasourceDataPreview && (
                              <div className="space-y-2">
                                <div className="text-[11px] text-zinc-400">
                                  source: {datasourceDataPreview.source} | limit: {datasourceDataPreview.filters.limit} | statuses: {datasourceDataPreview.filters.statuses.join(', ') || 'all'}
                                </div>
                                {datasourceDataPreview.rows.length === 0 && (
                                  <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                                    Query returned no rows for current filter.
                                  </div>
                                )}
                                {datasourceDataPreview.rows.length > 0 && (
                                  <div className="max-h-[280px] space-y-2 overflow-auto pr-1">
                                    {datasourceDataPreview.rows.map((row) => (
                                      <div key={`server-preview-row-${row.rowIndex}-${row.matchId || 'none'}`} className="space-y-1 rounded border border-white/10 bg-zinc-900 px-2 py-2">
                                        <div className="text-[11px] text-zinc-400">
                                          #{row.rowIndex} | {row.matchId || 'N/A'} | {row.league || '-'} | {row.status || '-'} | {formatTime(row.matchDate)}
                                        </div>
                                        <textarea
                                          value={prettyJson(row.values)}
                                          readOnly
                                          spellCheck={false}
                                          className="min-h-[88px] w-full rounded-lg border border-white/10 bg-black/50 p-2 font-mono text-[11px] text-zinc-300 focus:border-emerald-500 focus:outline-none"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className={isDatasourceStepVisible(datasourceEditorStep, 'operations') ? 'space-y-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3' : 'hidden'}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h4 className="text-[11px] uppercase tracking-wider text-emerald-300">
                              Step 5: Datasource Collection Governance
                            </h4>
                            <p className="text-[11px] text-zinc-400">
                              Collect, confirm, and release lifecycle for datasource snapshots.
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={refreshDatasourceCollectionGovernance}
                            disabled={isDatasourceCollectionLoading}
                          >
                            {isDatasourceCollectionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            Refresh
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 gap-2 xl:grid-cols-[1fr_1fr_auto]">
                          <input
                            type="text"
                            value={datasourceCollectorSourceIdInput}
                            onChange={(event) => setDatasourceCollectorSourceIdInput(event.target.value)}
                            placeholder="sourceId"
                            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                          />
                          <input
                            type="text"
                            value={datasourceCollectorNameInput}
                            onChange={(event) => setDatasourceCollectorNameInput(event.target.value)}
                            placeholder="collector name"
                            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={handleCreateDatasourceCollector}
                            disabled={isCreatingDatasourceCollector}
                          >
                            {isCreatingDatasourceCollector ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                            Create Collector
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                          <div className="space-y-2 rounded-lg border border-white/10 bg-zinc-900 p-3">
                            <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                              Collectors ({datasourceCollectors.length})
                            </div>
                            {datasourceCollectors.length === 0 && (
                              <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                                No collectors for current source.
                              </div>
                            )}
                            {datasourceCollectors.length > 0 && (
                              <div className="max-h-[220px] space-y-2 overflow-auto pr-1">
                                {datasourceCollectors.map((collector) => (
                                  <div key={collector.id} className="rounded-lg border border-white/10 bg-black/40 p-2">
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                      <div>
                                        <div className="font-semibold text-zinc-100">{collector.name}</div>
                                        <div className="text-zinc-400">
                                          {collector.sourceId} | {collector.provider} | last: {collector.lastRunStatus}
                                        </div>
                                      </div>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1"
                                        onClick={() => handleTriggerDatasourceCollectorRun(collector.id)}
                                        disabled={runningCollectorId === collector.id}
                                      >
                                        {runningCollectorId === collector.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
                                        Run
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="space-y-2 rounded-lg border border-white/10 bg-zinc-900 p-3">
                            <div className="flex items-center justify-between">
                              <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                                Collection Health ({datasourceCollectionHealthSummary.total})
                              </div>
                              <div className="text-[10px] text-zinc-500">
                                {datasourceCollectionHealthGeneratedAt
                                  ? `updated ${formatTime(datasourceCollectionHealthGeneratedAt)}`
                                  : 'not available'}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-[10px] text-zinc-400 sm:grid-cols-5">
                              <div className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1">
                                healthy: {datasourceCollectionHealthSummary.healthy}
                              </div>
                              <div className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-1">
                                stale: {datasourceCollectionHealthSummary.stale}
                              </div>
                              <div className="rounded border border-red-500/20 bg-red-500/10 px-2 py-1">
                                failed: {datasourceCollectionHealthSummary.failed}
                              </div>
                              <div className="rounded border border-sky-500/20 bg-sky-500/10 px-2 py-1">
                                never: {datasourceCollectionHealthSummary.neverRun}
                              </div>
                              <div className="rounded border border-zinc-500/20 bg-zinc-500/10 px-2 py-1">
                                disabled: {datasourceCollectionHealthSummary.disabled}
                              </div>
                            </div>
                            {datasourceCollectionHealth.length === 0 && (
                              <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                                No collector health records for current source.
                              </div>
                            )}
                            {datasourceCollectionHealth.length > 0 && (
                              <div className="max-h-[180px] space-y-1 overflow-auto pr-1">
                                {datasourceCollectionHealth.map((item) => {
                                  const status = item.health.status;
                                  const statusClass =
                                    status === 'healthy'
                                      ? 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10'
                                      : status === 'stale'
                                        ? 'text-amber-300 border-amber-500/20 bg-amber-500/10'
                                        : status === 'failed'
                                          ? 'text-red-300 border-red-500/20 bg-red-500/10'
                                          : status === 'never_run'
                                            ? 'text-sky-300 border-sky-500/20 bg-sky-500/10'
                                            : 'text-zinc-300 border-zinc-500/20 bg-zinc-500/10';
                                  return (
                                    <div
                                      key={`collection-health-${item.collector.id}`}
                                      className={`rounded border px-2 py-1.5 text-[11px] ${statusClass}`}
                                    >
                                      <div className="font-mono">{item.collector.sourceId}</div>
                                      <div className="opacity-90">
                                        status={status} | lag={item.health.lagMinutes ?? '-'}m / sla={item.health.slaMaxLagMinutes}m
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="space-y-2 rounded-lg border border-white/10 bg-zinc-900 p-3">
                            <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                              Snapshots ({datasourceCollectionSnapshots.length})
                            </div>
                            {datasourceCollectionSnapshots.length === 0 && (
                              <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                                No snapshots yet. Trigger collector run first.
                              </div>
                            )}
                            {datasourceCollectionSnapshots.length > 0 && (
                              <div className="max-h-[260px] space-y-2 overflow-auto pr-1">
                                {datasourceCollectionSnapshots.map((snapshot) => (
                                  <div key={snapshot.id} className="space-y-2 rounded-lg border border-white/10 bg-black/40 p-2">
                                    <div className="text-[11px] text-zinc-300">
                                      {snapshot.id}
                                    </div>
                                    <div className="text-[11px] text-zinc-400">
                                      records: {snapshot.recordCount} | confirm: {snapshot.confirmationStatus} | release: {snapshot.releaseStatus}{snapshot.releaseChannel ? ` (${snapshot.releaseChannel})` : ''}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1"
                                        onClick={() => handleConfirmDatasourceSnapshot(snapshot.id, 'confirm')}
                                        disabled={confirmingSnapshotId === snapshot.id || snapshot.confirmationStatus === 'confirmed'}
                                      >
                                        {confirmingSnapshotId === snapshot.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                        Confirm
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1"
                                        onClick={() => handleConfirmDatasourceSnapshot(snapshot.id, 'reject')}
                                        disabled={confirmingSnapshotId === snapshot.id || snapshot.releaseStatus === 'released'}
                                      >
                                        <XCircle className="h-3.5 w-3.5" />
                                        Reject
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1"
                                        onClick={() => handleReleaseDatasourceSnapshot(snapshot.id)}
                                        disabled={
                                          releasingSnapshotId === snapshot.id
                                          || snapshot.confirmationStatus !== 'confirmed'
                                          || snapshot.releaseStatus === 'released'
                                        }
                                      >
                                        {releasingSnapshotId === snapshot.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                        Release
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1"
                                        onClick={() => handleReplayDatasourceSnapshot(snapshot.id)}
                                        disabled={replayingSnapshotId === snapshot.id}
                                      >
                                        {replayingSnapshotId === snapshot.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                        Replay
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2 rounded-lg border border-white/10 bg-zinc-900 p-3">
                          <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                            Recent Runs ({datasourceCollectionRuns.length})
                          </div>
                          {datasourceCollectionRuns.length === 0 && (
                            <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                              No run records for current source.
                            </div>
                          )}
                          {datasourceCollectionRuns.length > 0 && (
                            <div className="max-h-[180px] space-y-1 overflow-auto pr-1">
                              {datasourceCollectionRuns.map((run) => (
                                <div key={run.id} className="rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-zinc-300">
                                  {run.id} | {run.status} | {run.triggerType} | started: {formatTime(run.startedAt)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
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
                      data-testid="action-save-draft"
                    >
                      {isSavingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save Draft
                    </Button>
                    <Button
                      onClick={() => void handleValidate()}
                      variant="outline"
                      disabled={!selectedRevision || isValidating}
                      className="gap-2"
                      data-testid="action-validate"
                    >
                      {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      Validate
                    </Button>
                    <Button
                      onClick={() => setPublishWizardOpen((previous) => !previous)}
                      variant="outline"
                      disabled={!selectedRevision}
                      className="gap-2"
                      data-testid="action-toggle-publish-wizard"
                    >
                      <PlayCircle className="h-4 w-4" />
                      {publishWizardOpen ? 'Hide Publish Wizard' : 'Publish Wizard'}
                    </Button>
                    <Button
                      onClick={() => void handleRollback()}
                      variant="outline"
                      disabled={!selectedRevision || isRollbacking}
                      className="gap-2"
                      data-testid="action-rollback"
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
                    <div
                      className="space-y-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3"
                      data-testid="publish-wizard"
                    >
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

                      <div
                        data-testid="publish-gate-status"
                        className={`rounded-lg border px-3 py-2 text-xs ${
                        publishGate.passed
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                          : 'border-red-500/20 bg-red-500/10 text-red-300'
                      }`}
                      >
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
                          data-testid="publish-wizard-run-validation"
                        >
                          {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                          Run Validation
                        </Button>
                        <Button
                          className="gap-2"
                          onClick={() => void handlePublish({ notes: publishNotes })}
                          disabled={!selectedRevision || !publishGate.passed || isPublishing}
                          data-testid="publish-wizard-confirm-publish"
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
                  data-testid="release-history-filter-item"
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
              <div className="max-h-[260px] space-y-2 overflow-auto pr-1" data-testid="release-history-list">
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
                      data-testid={`release-record-${record.id}`}
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
