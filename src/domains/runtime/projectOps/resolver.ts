import {
  isAnalysisFactorsQuestion,
  isAnalysisSequenceQuestion,
  looksLikeTaskCommand,
} from '@/src/services/managerAgent';
import {
  PROJECT_OPS_DOMAIN_ID,
  type ProjectOpsSubjectDisplay,
  searchProjectOpsLocalCases,
} from '@/src/services/domains/modules/projectOps/localCases';
import type {
  AnalysisIntent,
  DomainEvent,
  DomainResolver,
  DomainSubject,
  ResolveContext,
} from '../types';

function buildIntent(intentType: AnalysisIntent['intentType'], input: string): AnalysisIntent {
  return {
    domainId: PROJECT_OPS_DOMAIN_ID,
    intentType,
    targetType: 'subject',
    rawInput: input,
  };
}

function toRuntimeSubject(subject: ProjectOpsSubjectDisplay): DomainSubject {
  return {
    domainId: PROJECT_OPS_DOMAIN_ID,
    subjectType: subject.subjectType,
    subjectId: subject.id,
    label: subject.title,
    aliases: subject.metadata.aliases,
    metadata: {
      owner: subject.metadata.owner,
      stage: subject.metadata.stage,
      priority: subject.metadata.priority,
      summary: subject.metadata.summary,
    },
  };
}

function toRuntimeEvent(subject: ProjectOpsSubjectDisplay): DomainEvent {
  return {
    domainId: PROJECT_OPS_DOMAIN_ID,
    eventType: subject.metadata.nextEventType,
    eventId: `${subject.id}:${subject.metadata.nextEventType}`,
    title: subject.metadata.nextEventTitle,
    subjectRefs: [
      {
        subjectType: subject.subjectType,
        subjectId: subject.id,
        role: 'primary',
      },
    ],
    startTime: subject.metadata.nextEventTime,
    status: subject.status,
    metadata: {
      subjectSnapshot: subject,
      owner: subject.metadata.owner,
      stage: subject.metadata.stage,
      summary: subject.metadata.summary,
    },
  };
}

function resolveProjectOpsSubjects(query: string): ProjectOpsSubjectDisplay[] {
  return searchProjectOpsLocalCases(query).slice(0, 5);
}

export const projectOpsRuntimeResolver: DomainResolver = {
  async resolveIntent(rawInput: string, _ctx: ResolveContext): Promise<AnalysisIntent | null> {
    const normalized = rawInput.trim();
    if (!normalized) {
      return null;
    }

    if (isAnalysisFactorsQuestion(normalized) || isAnalysisSequenceQuestion(normalized)) {
      return buildIntent('explain', normalized);
    }

    if (looksLikeTaskCommand(normalized)) {
      const subjectRefs = resolveProjectOpsSubjects(normalized).map(toRuntimeSubject);
      return {
        ...buildIntent(
          /(every|daily|schedule|recurring|every day)/i.test(normalized) ? 'schedule' : 'analyze',
          normalized,
        ),
        subjectRefs: subjectRefs.length > 0 ? subjectRefs : undefined,
      };
    }

    return null;
  },

  async resolveSubjects(query: string): Promise<DomainSubject[]> {
    return resolveProjectOpsSubjects(query).map(toRuntimeSubject);
  },

  async resolveEvents(intent: AnalysisIntent): Promise<DomainEvent[]> {
    return resolveProjectOpsSubjects(intent.rawInput || '').map(toRuntimeEvent);
  },
};
