import { cloneSubjectSnapshot } from '@/src/services/subjectDisplay';
import type { SubjectDisplay } from '@/src/services/subjectDisplay';

export const PROJECT_OPS_DOMAIN_ID = 'project_ops';
export const PROJECT_OPS_SUBJECT_TYPES = ['project', 'task', 'initiative'] as const;
export const PROJECT_OPS_EVENT_TYPES = ['deadline', 'review', 'handoff'] as const;

export type ProjectOpsSubjectType = (typeof PROJECT_OPS_SUBJECT_TYPES)[number];
export type ProjectOpsEventType = (typeof PROJECT_OPS_EVENT_TYPES)[number];

export interface ProjectOpsMetadata {
  owner: string;
  stage: string;
  priority: string;
  summary: string;
  aliases: string[];
  nextEventType: ProjectOpsEventType;
  nextEventTitle: string;
  nextEventTime: string;
  riskScore?: number;
  confidence?: number;
  checklist?: string[];
  blockers?: string[];
  recommendedAction?: string;
}

export interface ProjectOpsSubjectDisplay extends SubjectDisplay {
  domainId: typeof PROJECT_OPS_DOMAIN_ID;
  subjectType: ProjectOpsSubjectType;
  title: string;
  subtitle: string;
  league: string;
  date: string;
  status: 'upcoming' | 'live' | 'finished';
  homeTeam: {
    id: string;
    name: string;
    logo: string;
    form: string[];
  };
  awayTeam: {
    id: string;
    name: string;
    logo: string;
    form: string[];
  };
  customInfo?: string;
  metadata: ProjectOpsMetadata;
}

const PROJECT_OPS_LEAGUE = 'Project Ops';

function buildLegacyEntity(id: string, name: string): ProjectOpsSubjectDisplay['homeTeam'] {
  return {
    id,
    name,
    logo: '',
    form: [],
  };
}

function normalizeSearchText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRecordObject(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === 'object' && !Array.isArray(input);
}

function readText(input: unknown, fallback = ''): string {
  return typeof input === 'string' && input.trim().length > 0 ? input.trim() : fallback;
}

function readNumber(input: unknown): number | undefined {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return input;
  }
  if (typeof input === 'string' && input.trim().length > 0) {
    const parsed = Number(input);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function readStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry) => readText(entry))
    .filter((entry) => entry.length > 0);
}

function resolveSubjectType(input: unknown): ProjectOpsSubjectType {
  return PROJECT_OPS_SUBJECT_TYPES.includes(input as ProjectOpsSubjectType)
    ? (input as ProjectOpsSubjectType)
    : 'task';
}

function resolveStatus(input: unknown): ProjectOpsSubjectDisplay['status'] {
  return input === 'live' || input === 'finished' || input === 'upcoming'
    ? input
    : 'upcoming';
}

function resolveEventType(input: unknown): ProjectOpsEventType {
  return PROJECT_OPS_EVENT_TYPES.includes(input as ProjectOpsEventType)
    ? (input as ProjectOpsEventType)
    : 'review';
}

export function buildFallbackProjectOpsSubjectDisplay(
  subjectId: string,
): ProjectOpsSubjectDisplay {
  const title = 'Project Ops Intake';
  const stage = 'Intake';

  return {
    id: subjectId,
    domainId: PROJECT_OPS_DOMAIN_ID,
    subjectType: 'task',
    title,
    subtitle: 'Unresolved subject',
    league: PROJECT_OPS_LEAGUE,
    date: new Date().toISOString(),
    status: 'upcoming',
    homeTeam: buildLegacyEntity(`${subjectId}_subject`, title),
    awayTeam: buildLegacyEntity(`${subjectId}_context`, stage),
    metadata: {
      owner: 'Unassigned',
      stage,
      priority: 'P2',
      summary: 'No structured project-ops snapshot was found. Review the stored context before running.',
      aliases: [],
      nextEventType: 'review',
      nextEventTitle: 'Intake review',
      nextEventTime: new Date().toISOString(),
      recommendedAction: 'Confirm scope, owner, and timing before execution.',
    },
  };
}

export function coerceProjectOpsSubjectDisplay(
  raw: unknown,
  fallbackSubjectId: string,
): ProjectOpsSubjectDisplay {
  if (!isRecordObject(raw)) {
    return buildFallbackProjectOpsSubjectDisplay(fallbackSubjectId);
  }

  const metadataRaw = isRecordObject(raw.metadata) ? raw.metadata : {};
  const subjectId = readText(raw.id, fallbackSubjectId);
  const title =
    readText(raw.title) ||
    readText((raw.homeTeam as Record<string, unknown> | undefined)?.name) ||
    fallbackSubjectId;
  const subtitle =
    readText(raw.subtitle) ||
    readText((raw.awayTeam as Record<string, unknown> | undefined)?.name) ||
    'Project Ops subject';
  const owner = readText(metadataRaw.owner, 'Unassigned');
  const stage = readText(metadataRaw.stage, 'Intake');

  return {
    id: subjectId,
    domainId: PROJECT_OPS_DOMAIN_ID,
    subjectType: resolveSubjectType(raw.subjectType),
    title,
    subtitle,
    league: readText(raw.league, PROJECT_OPS_LEAGUE),
    date: readText(raw.date, new Date().toISOString()),
    status: resolveStatus(raw.status),
    homeTeam: buildLegacyEntity(
      readText((raw.homeTeam as Record<string, unknown> | undefined)?.id, `${subjectId}_subject`),
      readText((raw.homeTeam as Record<string, unknown> | undefined)?.name, title),
    ),
    awayTeam: buildLegacyEntity(
      readText((raw.awayTeam as Record<string, unknown> | undefined)?.id, `${subjectId}_context`),
      readText((raw.awayTeam as Record<string, unknown> | undefined)?.name, stage),
    ),
    customInfo: readText(raw.customInfo),
    metadata: {
      owner,
      stage,
      priority: readText(metadataRaw.priority, 'P2'),
      summary: readText(metadataRaw.summary, subtitle),
      aliases: readStringArray(metadataRaw.aliases),
      nextEventType: resolveEventType(metadataRaw.nextEventType),
      nextEventTitle: readText(metadataRaw.nextEventTitle, `${stage} review`),
      nextEventTime: readText(
        metadataRaw.nextEventTime,
        readText(raw.date, new Date().toISOString()),
      ),
      riskScore: readNumber(metadataRaw.riskScore),
      confidence: readNumber(metadataRaw.confidence),
      checklist: readStringArray(metadataRaw.checklist),
      blockers: readStringArray(metadataRaw.blockers),
      recommendedAction: readText(metadataRaw.recommendedAction),
    },
  };
}

const PROJECT_OPS_LOCAL_CASES: ProjectOpsSubjectDisplay[] = [
  {
    id: 'project_mobile_launch',
    domainId: PROJECT_OPS_DOMAIN_ID,
    subjectType: 'project',
    title: 'Q2 Mobile Launch',
    subtitle: 'Release train coordination',
    league: PROJECT_OPS_LEAGUE,
    date: '2026-03-20T09:00:00.000Z',
    status: 'upcoming',
    homeTeam: buildLegacyEntity('project_mobile_launch_subject', 'Q2 Mobile Launch'),
    awayTeam: buildLegacyEntity('project_mobile_launch_context', 'Execution'),
    customInfo: 'Depends on payment hotfix validation and rollback approval.',
    metadata: {
      owner: 'Growth Platform',
      stage: 'Execution',
      priority: 'P1',
      summary: 'Coordinate final QA, launch comms, rollout gates, and rollback readiness.',
      aliases: ['mobile launch', 'launch readiness', 'growth app release'],
      nextEventType: 'review',
      nextEventTitle: 'Launch readiness review',
      nextEventTime: '2026-03-20T09:00:00.000Z',
      riskScore: 72,
      confidence: 64,
      checklist: ['QA signoff', 'Store metadata', 'Rollback playbook'],
      blockers: ['Payment hotfix pending', 'Legal copy review'],
      recommendedAction: 'Close launch blockers before the readiness review and assign a rollback owner.',
    },
  },
  {
    id: 'task_vendor_cutover',
    domainId: PROJECT_OPS_DOMAIN_ID,
    subjectType: 'task',
    title: 'Vendor Cutover Checklist',
    subtitle: 'Ops task intake',
    league: PROJECT_OPS_LEAGUE,
    date: '2026-03-16T07:30:00.000Z',
    status: 'live',
    homeTeam: buildLegacyEntity('task_vendor_cutover_subject', 'Vendor Cutover Checklist'),
    awayTeam: buildLegacyEntity('task_vendor_cutover_context', 'Delivery'),
    customInfo: 'Finance requested a same-day audit trail for the cutover approvals.',
    metadata: {
      owner: 'Revenue Ops',
      stage: 'Delivery',
      priority: 'P0',
      summary: 'Track the vendor migration checklist, signoffs, and fallback steps before the morning cutover.',
      aliases: ['vendor cutover', 'cutover checklist', 'migration checklist'],
      nextEventType: 'handoff',
      nextEventTitle: 'Cutover handoff',
      nextEventTime: '2026-03-16T07:30:00.000Z',
      riskScore: 83,
      confidence: 58,
      checklist: ['Freeze window confirmed', 'Audit log export', 'Fallback owner online'],
      blockers: ['Billing mapping validation'],
      recommendedAction: 'Escalate the billing mapping validation and confirm the handoff roster before cutover.',
    },
  },
  {
    id: 'initiative_support_rebalance',
    domainId: PROJECT_OPS_DOMAIN_ID,
    subjectType: 'initiative',
    title: 'Support Load Rebalance',
    subtitle: 'Cross-team operating initiative',
    league: PROJECT_OPS_LEAGUE,
    date: '2026-03-11T16:00:00.000Z',
    status: 'finished',
    homeTeam: buildLegacyEntity('initiative_support_rebalance_subject', 'Support Load Rebalance'),
    awayTeam: buildLegacyEntity('initiative_support_rebalance_context', 'Closed'),
    customInfo: 'Postmortem notes show faster escalations but handoff quality still varies by region.',
    metadata: {
      owner: 'Customer Operations',
      stage: 'Closed',
      priority: 'P2',
      summary: 'Redistribute support ownership, tighten escalation windows, and document the new regional rota.',
      aliases: ['support rebalance', 'regional support initiative', 'support load balancing'],
      nextEventType: 'deadline',
      nextEventTitle: 'Postmortem deadline',
      nextEventTime: '2026-03-11T16:00:00.000Z',
      riskScore: 34,
      confidence: 81,
      checklist: ['Region rota signed off', 'Escalation policy shipped', 'Postmortem drafted'],
      blockers: [],
      recommendedAction: 'Capture the handoff quality delta and fold it into the next operating review.',
    },
  },
];

function buildSearchTokens(subject: ProjectOpsSubjectDisplay): string[] {
  return [
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
  ];
}

function scoreProjectOpsSubject(subject: ProjectOpsSubjectDisplay, normalizedQuery: string): number {
  if (!normalizedQuery) {
    return 0;
  }

  const exactId = normalizeSearchText(subject.id) === normalizedQuery ? 100 : 0;
  const tokenMatches = buildSearchTokens(subject).reduce((score, token) => {
    const normalizedToken = normalizeSearchText(token);
    if (!normalizedToken) {
      return score;
    }
    if (normalizedQuery.includes(normalizedToken)) {
      return score + (normalizedToken === normalizeSearchText(subject.title) ? 30 : 10);
    }
    return score;
  }, 0);

  return exactId + tokenMatches;
}

export function listProjectOpsLocalCases(): ProjectOpsSubjectDisplay[] {
  return PROJECT_OPS_LOCAL_CASES.map((subject) => cloneSubjectSnapshot(subject));
}

export function buildProjectOpsLocalCases(caseMinimum: number): ProjectOpsSubjectDisplay[] {
  const count = Math.max(0, Math.floor(caseMinimum));
  return PROJECT_OPS_LOCAL_CASES.slice(0, count).map((subject) => cloneSubjectSnapshot(subject));
}

export function findProjectOpsLocalCaseById(
  subjectId: string | null | undefined,
): ProjectOpsSubjectDisplay | null {
  const normalizedId = readText(subjectId);
  if (!normalizedId) {
    return null;
  }

  const found = PROJECT_OPS_LOCAL_CASES.find((subject) => subject.id === normalizedId);
  return found ? cloneSubjectSnapshot(found) : null;
}

export function searchProjectOpsLocalCases(query: string): ProjectOpsSubjectDisplay[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [];
  }

  return PROJECT_OPS_LOCAL_CASES
    .map((subject) => ({
      subject,
      score: scoreProjectOpsSubject(subject, normalizedQuery),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((entry) => cloneSubjectSnapshot(entry.subject));
}
