import { getAnalysisOutcomeDistribution } from '@/src/services/analysisSummary';
import {
  coerceProjectOpsSubjectDisplay,
  type ProjectOpsSubjectDisplay,
} from '@/src/services/domains/modules/projectOps/localCases';
import type {
  DomainHistoryPresenter,
  DomainHomePresenter,
  DomainResultPresenter,
  DomainSubjectDisplay,
  DomainUiPresenter,
  TranslateFn,
} from '../types';

function resolveProjectOpsSubject(subjectDisplay: DomainSubjectDisplay): ProjectOpsSubjectDisplay {
  return coerceProjectOpsSubjectDisplay(subjectDisplay, subjectDisplay.id || 'project_ops_subject');
}

function resolveStatusLabel(status: string | undefined): string {
  if (status === 'live') return 'In flight';
  if (status === 'finished') return 'Closed';
  return 'Planned';
}

function buildOutcomeLabels(t: TranslateFn) {
  return {
    homeLabel: t('project ops.on_track', { defaultValue: 'On track' }),
    drawLabel: t('project ops.monitor', { defaultValue: 'Monitor' }),
    awayLabel: t('project ops.blocked', { defaultValue: 'Blocked' }),
  };
}

export const projectOpsHomePresenter: DomainHomePresenter = {
  id: 'project_ops_home',
  useRemoteFeed: false,
  sectionTitleKey: 'Project Ops',
  sectionHintKey: 'Projects, tasks, and initiatives',
  refreshActionKey: 'Refresh',
  openActionKey: 'Open',
  noDataKey: 'No project ops data available',
  searchPlaceholderKey: 'Search project or task',
  getEntityDisplay: (subjectDisplay) => {
    const subject = resolveProjectOpsSubject(subjectDisplay);
    return {
      kind: 'single',
      entity: {
        id: subject.id,
        name: subject.title,
        subtitle: `${subject.subjectType} | ${subject.metadata.owner}`,
      },
      caption: subject.subtitle,
    };
  },
  getSearchTokens: (subjectDisplay) => {
    const subject = resolveProjectOpsSubject(subjectDisplay);
    return [
      subject.title,
      subject.subtitle,
      subject.metadata.owner,
      subject.metadata.stage,
      ...subject.metadata.aliases,
    ];
  },
  getStatusLabel: (status) => resolveStatusLabel(status),
  getStatusClassName: (status) => {
    if (status === 'live') return 'bg-amber-500/15 text-amber-300';
    if (status === 'finished') return 'bg-emerald-500/15 text-emerald-300';
    return 'bg-[var(--mf-accent-soft)] text-[var(--mf-accent)]';
  },
  getOutcomeLabels: (_subjectDisplay, ctx) => buildOutcomeLabels(ctx.t),
  getCenterDisplay: (subjectDisplay) => {
    const subject = resolveProjectOpsSubject(subjectDisplay);
    const items: Array<{ label: string; value: string; tone?: 'neutral' | 'positive' | 'negative' }> = [
      {
        label: 'Stage',
        value: subject.metadata.stage,
      },
    ];
    if (typeof subject.metadata.riskScore === 'number') {
      items.push({
        label: 'Risk',
        value: `${subject.metadata.riskScore}`,
        tone: subject.metadata.riskScore >= 70 ? 'negative' : 'neutral',
      });
    }
    return {
      kind: 'metrics',
      items,
    };
  },
};

export const projectOpsHistoryPresenter: DomainHistoryPresenter = {
  id: 'project_ops_history',
  getOutcomeDistribution: (analysis, _subjectDisplay, ctx) =>
    getAnalysisOutcomeDistribution(analysis, buildOutcomeLabels(ctx.t)),
};

export const projectOpsResultPresenter: DomainResultPresenter = {
  id: 'project_ops_result',
  getLoadingContextText: () => 'Loading project ops context...',
  getNotFoundText: () => 'Project ops subject not found',
  getHeader: (subjectDisplay) => {
    const subject = resolveProjectOpsSubject(subjectDisplay);
    return {
      title: subject.title,
      subtitle: `${subject.subjectType} | ${subject.metadata.owner} | ${subject.metadata.stage}`,
    };
  },
  getSummaryHero: (subjectDisplay) => {
    const subject = resolveProjectOpsSubject(subjectDisplay);
    return {
      kind: 'single',
      entity: {
        id: subject.id,
        name: subject.title,
      },
      caption: subject.subtitle,
    };
  },
  getSummaryDistribution: (analysis, _subjectDisplay, _draftData, ctx) =>
    getAnalysisOutcomeDistribution(analysis, buildOutcomeLabels(ctx.t)),
  getExportMeta: (subjectDisplay) => {
    const subject = resolveProjectOpsSubject(subjectDisplay);
    return {
      reportTitle: subject.title,
      primaryEntityName: subject.title,
      statusLabel: resolveStatusLabel(subject.status),
    };
  },
};

export const PROJECT_OPS_DOMAIN_UI_PRESENTER: DomainUiPresenter = {
  id: 'project_ops',
  home: projectOpsHomePresenter,
  history: projectOpsHistoryPresenter,
  result: projectOpsResultPresenter,
};

export const DOMAIN_UI_PRESENTER_ENTRIES: DomainUiPresenter[] = [
  PROJECT_OPS_DOMAIN_UI_PRESENTER,
];
