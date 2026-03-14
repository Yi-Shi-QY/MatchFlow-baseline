import { getHistory } from '@/src/services/history';
import { getSavedSubjects } from '@/src/services/savedSubjects';
import type {
  AutomationJob,
  AutomationTargetSnapshotItem,
} from '@/src/services/automation/types';
import {
  PROJECT_OPS_DOMAIN_ID,
  type ProjectOpsSubjectDisplay,
  buildFallbackProjectOpsSubjectDisplay,
  coerceProjectOpsSubjectDisplay,
  findProjectOpsLocalCaseById,
  listProjectOpsLocalCases,
  searchProjectOpsLocalCases,
} from '@/src/services/domains/modules/projectOps/localCases';
import type {
  DomainAutomationCapability,
  DomainAutomationResolvedTarget,
} from '../automation';
import { parseProjectOpsAutomationCommand } from './automationParser';

function isTargetSnapshotItem(input: unknown): input is AutomationTargetSnapshotItem {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return false;
  }

  const value = input as Record<string, unknown>;
  return (
    typeof value.domainId === 'string' &&
    typeof value.subjectId === 'string' &&
    typeof value.subjectType === 'string' &&
    typeof value.title === 'string'
  );
}

function buildSearchTokens(subject: ProjectOpsSubjectDisplay): string {
  return [
    subject.id,
    subject.title,
    subject.subtitle,
    subject.metadata.owner,
    subject.metadata.stage,
    subject.metadata.priority,
    subject.metadata.summary,
    subject.metadata.nextEventTitle,
    ...subject.metadata.aliases,
    ...(subject.metadata.checklist || []),
    ...(subject.metadata.blockers || []),
  ]
    .join(' ')
    .toLowerCase();
}

function buildResolvedTarget(subject: ProjectOpsSubjectDisplay): DomainAutomationResolvedTarget {
  return {
    domainId: PROJECT_OPS_DOMAIN_ID,
    subjectId: subject.id,
    subjectType: subject.subjectType,
    title: subject.title,
    subjectDisplay: subject,
  };
}

function extractProjectOpsSubject(input: {
  subjectId: string;
  subjectSnapshot?: unknown;
  subjectDisplay?: unknown;
}): ProjectOpsSubjectDisplay | null {
  const raw = input.subjectSnapshot ?? input.subjectDisplay;
  if (!raw) {
    return null;
  }
  return coerceProjectOpsSubjectDisplay(raw, input.subjectId);
}

async function listPersistedProjectOpsSubjects(): Promise<ProjectOpsSubjectDisplay[]> {
  const [historyRecords, savedRecords] = await Promise.all([
    getHistory({ domainId: PROJECT_OPS_DOMAIN_ID }),
    getSavedSubjects({ domainId: PROJECT_OPS_DOMAIN_ID }),
  ]);

  const subjects = [
    ...historyRecords.map((record) =>
      extractProjectOpsSubject({
        subjectId: record.subjectId,
        subjectSnapshot: record.subjectSnapshot,
        subjectDisplay: record.subjectDisplay,
      }),
    ),
    ...savedRecords.map((record) =>
      extractProjectOpsSubject({
        subjectId: record.subjectId,
        subjectSnapshot: record.subjectSnapshot,
        subjectDisplay: record.subjectDisplay,
      }),
    ),
  ].filter((subject): subject is ProjectOpsSubjectDisplay => Boolean(subject));

  const byId = new Map<string, ProjectOpsSubjectDisplay>();
  [...listProjectOpsLocalCases(), ...subjects].forEach((subject) => {
    if (!byId.has(subject.id)) {
      byId.set(subject.id, subject);
    }
  });

  return Array.from(byId.values());
}

function resolveSubjectsByQuery(
  subjects: ProjectOpsSubjectDisplay[],
  queryText: string,
): ProjectOpsSubjectDisplay[] {
  const normalizedQuery = queryText.toLowerCase().trim();
  if (!normalizedQuery) {
    return [];
  }

  const localMatches = searchProjectOpsLocalCases(queryText);
  if (localMatches.length > 0) {
    const localIds = new Set(localMatches.map((subject) => subject.id));
    return subjects.filter((subject) => localIds.has(subject.id));
  }

  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  return subjects.filter((subject) =>
    queryTokens.every((token) => buildSearchTokens(subject).includes(token)),
  );
}

export function createProjectOpsAutomationCapability(): DomainAutomationCapability {
  return {
    async resolveJobTargets(job: AutomationJob): Promise<DomainAutomationResolvedTarget[]> {
      const subjects = await listPersistedProjectOpsSubjects();

      if (Array.isArray(job.targetSnapshot)) {
        const snapshotIds = new Set(
          job.targetSnapshot
            .filter((entry): entry is AutomationTargetSnapshotItem => isTargetSnapshotItem(entry))
            .map((entry) => entry.subjectId),
        );
        return subjects
          .filter((subject) => snapshotIds.has(subject.id))
          .map((subject) => buildResolvedTarget(subject));
      }

      if (isTargetSnapshotItem(job.targetSnapshot)) {
        return subjects
          .filter((subject) => subject.id === job.targetSnapshot.subjectId)
          .map((subject) => buildResolvedTarget(subject));
      }

      if (job.targetSelector.mode === 'fixed_subject') {
        const fixed =
          subjects.find((subject) => subject.id === job.targetSelector.subjectId) ||
          findProjectOpsLocalCaseById(job.targetSelector.subjectId);
        return fixed ? [buildResolvedTarget(fixed)] : [];
      }

      if (job.targetSelector.mode === 'server_resolve') {
        return resolveSubjectsByQuery(subjects, job.targetSelector.queryText).map((subject) =>
          buildResolvedTarget(subject),
        );
      }

      return [];
    },

    async createSyntheticTarget(job: AutomationJob): Promise<DomainAutomationResolvedTarget> {
      const label =
        job.targetSelector.mode === 'fixed_subject'
          ? job.targetSelector.subjectLabel
          : job.targetSelector.displayLabel;
      const synthetic = buildFallbackProjectOpsSubjectDisplay(`${PROJECT_OPS_DOMAIN_ID}_${job.id}`);
      synthetic.title = label;
      synthetic.subtitle = 'Synthetic project ops target';
      synthetic.metadata.summary = job.title;
      synthetic.customInfo =
        job.targetSelector.mode === 'server_resolve'
          ? job.targetSelector.queryText
          : synthetic.customInfo;

      return buildResolvedTarget(synthetic);
    },

    parseCommand: parseProjectOpsAutomationCommand,
  };
}

export const projectOpsAutomationCapability = createProjectOpsAutomationCapability();
