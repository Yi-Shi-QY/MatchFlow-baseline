import type {
  DataSourceDefinition,
  SourceContext,
  SourceSelection,
} from '@/src/services/dataSources';
import type { SubjectDisplay } from '@/src/services/subjectDisplay';
import type { AnalysisDomain } from '../../types';
import {
  PROJECT_OPS_DOMAIN_ID,
  type ProjectOpsSubjectDisplay,
  coerceProjectOpsSubjectDisplay,
} from './localCases';

function hasText(input: unknown): boolean {
  return typeof input === 'string' ? input.trim().length > 0 : input != null;
}

function hasNumber(input: unknown): boolean {
  return typeof input === 'number' && Number.isFinite(input);
}

function resolveProjectOpsSubject(subjectDisplay: SubjectDisplay): ProjectOpsSubjectDisplay {
  return coerceProjectOpsSubjectDisplay(subjectDisplay, subjectDisplay.id || 'project_ops_subject');
}

function ensureMetadata(data: Record<string, unknown>): Record<string, unknown> {
  if (!data.metadata || typeof data.metadata !== 'object' || Array.isArray(data.metadata)) {
    data.metadata = {};
  }
  return data.metadata as Record<string, unknown>;
}

function applyFundamentalSource(data: Record<string, unknown>, ctx: SourceContext) {
  const subjectDisplay = resolveProjectOpsSubject(ctx.subjectDisplay);
  const metadata = ensureMetadata(data);

  if (data.id === undefined) data.id = subjectDisplay.id;
  if (data.title === undefined) data.title = subjectDisplay.title;
  if (data.subtitle === undefined) data.subtitle = subjectDisplay.subtitle;
  if (data.status === undefined) data.status = subjectDisplay.status;
  if (data.date === undefined) data.date = subjectDisplay.date;
  if (data.subjectType === undefined) data.subjectType = subjectDisplay.subjectType;
  if (data.domainId === undefined) data.domainId = PROJECT_OPS_DOMAIN_ID;

  if (metadata.owner === undefined) metadata.owner = subjectDisplay.metadata.owner;
  if (metadata.stage === undefined) metadata.stage = subjectDisplay.metadata.stage;
  if (metadata.priority === undefined) metadata.priority = subjectDisplay.metadata.priority;
  if (metadata.nextEventTitle === undefined) {
    metadata.nextEventTitle = subjectDisplay.metadata.nextEventTitle;
  }
  if (metadata.nextEventType === undefined) {
    metadata.nextEventType = subjectDisplay.metadata.nextEventType;
  }
  if (metadata.nextEventTime === undefined) {
    metadata.nextEventTime = subjectDisplay.metadata.nextEventTime;
  }
}

function applyRiskSource(data: Record<string, unknown>, ctx: SourceContext) {
  const subjectDisplay = resolveProjectOpsSubject(ctx.subjectDisplay);
  const metadata = ensureMetadata(data);

  if (metadata.riskScore === undefined && hasNumber(subjectDisplay.metadata.riskScore)) {
    metadata.riskScore = subjectDisplay.metadata.riskScore;
  }
  if (metadata.confidence === undefined && hasNumber(subjectDisplay.metadata.confidence)) {
    metadata.confidence = subjectDisplay.metadata.confidence;
  }
  if (metadata.blockers === undefined && Array.isArray(subjectDisplay.metadata.blockers)) {
    metadata.blockers = [...subjectDisplay.metadata.blockers];
  }
  if (metadata.checklist === undefined && Array.isArray(subjectDisplay.metadata.checklist)) {
    metadata.checklist = [...subjectDisplay.metadata.checklist];
  }
}

function applyCustomSource(data: Record<string, unknown>, ctx: SourceContext) {
  const subjectDisplay = resolveProjectOpsSubject(ctx.subjectDisplay);
  const metadata = ensureMetadata(data);

  if (metadata.summary === undefined) metadata.summary = subjectDisplay.metadata.summary;
  if (metadata.recommendedAction === undefined) {
    metadata.recommendedAction = subjectDisplay.metadata.recommendedAction;
  }
  if (data.customInfo === undefined) {
    data.customInfo = subjectDisplay.customInfo || '';
  }
}

export const PROJECT_OPS_DATA_SOURCES: DataSourceDefinition[] = [
  {
    id: 'fundamental',
    labelKey: 'Project context',
    descriptionKey: 'Owner, stage, priority, and next checkpoint',
    icon: 'layout',
    cardSpan: 1,
    isAvailable: () => true,
    defaultSelected: () => true,
    applyToData: (data, ctx) => applyFundamentalSource(data as Record<string, unknown>, ctx),
    removeFromData: (data) => {
      delete data.id;
      delete data.title;
      delete data.subtitle;
      delete data.status;
      delete data.date;
      delete data.subjectType;
      delete data.domainId;
      if (data.metadata && typeof data.metadata === 'object') {
        delete data.metadata.owner;
        delete data.metadata.stage;
        delete data.metadata.priority;
        delete data.metadata.nextEventTitle;
        delete data.metadata.nextEventType;
        delete data.metadata.nextEventTime;
      }
    },
    formSections: [
      {
        id: 'project_context',
        titleKey: 'Project context',
        columns: 2,
        fields: [
          { id: 'title', type: 'text', path: ['title'], labelKey: 'Title' },
          { id: 'owner', type: 'text', path: ['metadata', 'owner'], labelKey: 'Owner' },
          { id: 'stage', type: 'text', path: ['metadata', 'stage'], labelKey: 'Stage' },
          { id: 'priority', type: 'text', path: ['metadata', 'priority'], labelKey: 'Priority' },
          {
            id: 'next_event_title',
            type: 'text',
            path: ['metadata', 'nextEventTitle'],
            labelKey: 'Next checkpoint',
          },
          {
            id: 'next_event_time',
            type: 'text',
            path: ['metadata', 'nextEventTime'],
            labelKey: 'Checkpoint time',
          },
        ],
      },
    ],
  },
  {
    id: 'market',
    labelKey: 'Execution signals',
    descriptionKey: 'Risk score, confidence, blockers, and checklist health',
    icon: 'trending',
    cardSpan: 1,
    isAvailable: () => true,
    defaultSelected: (ctx) => {
      const subjectDisplay = resolveProjectOpsSubject(ctx.subjectDisplay);
      return (
        hasNumber(subjectDisplay.metadata.riskScore) ||
        hasNumber(subjectDisplay.metadata.confidence) ||
        (Array.isArray(subjectDisplay.metadata.blockers) && subjectDisplay.metadata.blockers.length > 0)
      );
    },
    applyToData: (data, ctx) => applyRiskSource(data as Record<string, unknown>, ctx),
    removeFromData: (data) => {
      if (data.metadata && typeof data.metadata === 'object') {
        delete data.metadata.riskScore;
        delete data.metadata.confidence;
        delete data.metadata.blockers;
        delete data.metadata.checklist;
      }
    },
    formSections: [
      {
        id: 'risk_signals',
        titleKey: 'Execution signals',
        columns: 2,
        fields: [
          { id: 'risk_score', type: 'number', path: ['metadata', 'riskScore'], labelKey: 'Risk score' },
          { id: 'confidence', type: 'number', path: ['metadata', 'confidence'], labelKey: 'Confidence' },
          {
            id: 'blockers',
            type: 'csv_array',
            path: ['metadata', 'blockers'],
            labelKey: 'Blockers',
            placeholder: 'comma separated blockers',
          },
          {
            id: 'checklist',
            type: 'csv_array',
            path: ['metadata', 'checklist'],
            labelKey: 'Checklist',
            placeholder: 'comma separated checklist items',
          },
        ],
      },
    ],
  },
  {
    id: 'custom',
    labelKey: 'Custom notes',
    descriptionKey: 'Freeform context, operating notes, and recommended action',
    icon: 'file',
    cardSpan: 2,
    isAvailable: () => true,
    defaultSelected: (ctx) => {
      const subjectDisplay = resolveProjectOpsSubject(ctx.subjectDisplay);
      return (
        hasText(subjectDisplay.customInfo) ||
        hasText(subjectDisplay.metadata.summary) ||
        hasText(subjectDisplay.metadata.recommendedAction)
      );
    },
    applyToData: (data, ctx) => applyCustomSource(data as Record<string, unknown>, ctx),
    removeFromData: (data) => {
      delete data.customInfo;
      if (data.metadata && typeof data.metadata === 'object') {
        delete data.metadata.summary;
        delete data.metadata.recommendedAction;
      }
    },
    formSections: [
      {
        id: 'custom_notes',
        titleKey: 'Custom notes',
        fields: [
          { id: 'summary', type: 'textarea', path: ['metadata', 'summary'], labelKey: 'Summary', rows: 3 },
          {
            id: 'recommended_action',
            type: 'textarea',
            path: ['metadata', 'recommendedAction'],
            labelKey: 'Recommended action',
            rows: 3,
          },
          {
            id: 'custom_info',
            type: 'textarea',
            path: ['customInfo'],
            labelKey: 'Operating notes',
            rows: 4,
          },
        ],
      },
    ],
  },
];

export function resolveProjectOpsSourceSelection(
  subjectDisplay: SubjectDisplay,
  importedData: unknown,
  previousSelection?: Partial<SourceSelection>,
): SourceSelection {
  const ctx: SourceContext = { subjectDisplay, importedData };
  return PROJECT_OPS_DATA_SOURCES.reduce((selection, source) => {
    if (!source.isAvailable(ctx)) {
      selection[source.id] = false;
      return selection;
    }
    const previous = previousSelection?.[source.id];
    selection[source.id] = typeof previous === 'boolean' ? previous : source.defaultSelected(ctx);
    return selection;
  }, {} as SourceSelection);
}

export function buildProjectOpsSourceCapabilities(
  data: Record<string, unknown>,
  selectedSources: SourceSelection,
) {
  const metadata =
    data.metadata && typeof data.metadata === 'object'
      ? (data.metadata as Record<string, unknown>)
      : {};

  return {
    hasFundamental:
      Boolean(selectedSources.fundamental) &&
      (hasText(data.title) || hasText(metadata.owner) || hasText(metadata.stage)),
    hasRiskSignals:
      Boolean(selectedSources.market) &&
      (hasNumber(metadata.riskScore) ||
        hasNumber(metadata.confidence) ||
        (Array.isArray(metadata.blockers) && metadata.blockers.length > 0)),
    hasCustom:
      Boolean(selectedSources.custom) &&
      (hasText(data.customInfo) || hasText(metadata.summary) || hasText(metadata.recommendedAction)),
  };
}

export const projectOpsDomain: AnalysisDomain = {
  id: PROJECT_OPS_DOMAIN_ID,
  name: 'Project Ops',
  description: 'Built-in project and task operations analysis experience.',
  resources: {
    templates: ['project_ops_review'],
    animations: ['risk-matrix'],
    agents: [
      'planner_autonomous',
      'project_ops_overview',
      'project_ops_risk',
      'project_ops_recommendation',
    ],
    skills: ['select_plan_template'],
  },
  dataSources: PROJECT_OPS_DATA_SOURCES,
  getAvailableDataSources: (context) =>
    PROJECT_OPS_DATA_SOURCES.filter((source) => source.isAvailable(context)),
  resolveSourceSelection: (subjectDisplay, importedData, previousSelection) =>
    resolveProjectOpsSourceSelection(subjectDisplay, importedData, previousSelection),
  buildSourceCapabilities: buildProjectOpsSourceCapabilities,
};
